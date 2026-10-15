/**
 * 统一存储客户端
 * - 服务端模式（默认）：数据存放在本机 SQLite 文件（data/app.db），通过 /api/storage 读写
 * - 本地降级模式：后端不可用时退回 localStorage，保证应用仍可使用
 * - localStorage 始终双写一份作为离线备份；首次连接到空库时自动把旧 localStorage 数据迁移到 SQLite
 */

let cache = new Map<string, string>();
let mode: 'server' | 'local' = 'local';

async function putRemote(key: string, value: string): Promise<void> {
  const res = await fetch(`/api/storage/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  });
  if (!res.ok) {
    throw new Error(`写入 ${key} 失败：HTTP ${res.status}`);
  }
}

/** 应用启动时调用：加载 SQLite 全量数据；服务端为空则迁移本地旧数据 */
export async function initDbClient(): Promise<'server' | 'local'> {
  try {
    const res = await fetch('/api/storage', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as Record<string, string> | null;
    cache = new Map(Object.entries(data ?? {}));
    mode = 'server';

    // 首次迁移：SQLite 库为空、但浏览器 localStorage 里有旧数据时，一次性搬运上云（本机库）
    if (cache.size === 0) {
      const localKeys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('shuqi_')) localKeys.push(k);
      }
      for (const k of localKeys) {
        const v = localStorage.getItem(k);
        if (v == null) continue;
        cache.set(k, v);
        try {
          await putRemote(k, v);
        } catch {
          /* 单键迁移失败不阻断启动，后续双写会继续尝试 */
        }
      }
    }
    return 'server';
  } catch {
    mode = 'local';
    return 'local';
  }
}

/** 同步读取原始字符串（仅返回已缓存数据，因此必须在 initDbClient 完成后调用） */
export function kvGetString(key: string): string | null {
  if (mode === 'server') {
    return cache.has(key) ? (cache.get(key) as string) : null;
  }
  return localStorage.getItem(key);
}

/** 同步触发写入：立即更新缓存与 localStorage，异步落盘 SQLite */
export function kvSet(key: string, value: string): void {
  // 值与缓存一致时（如组件挂载时 effect 的首轮回写）跳过一切 IO，避免无效写入与刷新风暴
  if (mode === 'server' && cache.get(key) === value) return;
  try {
    localStorage.setItem(key, value);
  } catch {
    /* 本地配额满等异常不影响主链路 */
  }
  cache.set(key, value);
  if (mode === 'server') {
    putRemote(key, value).catch((e) => {
      console.warn('SQLite 异步落盘失败，已暂存本地:', key, e);
    });
  }
}

/** 异步落盘写入：等待 SQLite 文件确实写入后才 resolve（用于"保存"等需要强一致反馈的动作） */
export async function kvSetAsync(key: string, value: string): Promise<void> {
  // 值已与数据库一致则视为已落盘，直接成功返回（用户显式保存但内容无变化的场景）
  if (mode === 'server' && cache.get(key) === value) return;
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
  cache.set(key, value);
  if (mode === 'server') {
    await putRemote(key, value);
  }
}

export function getStorageMode(): 'server' | 'local' {
  return mode;
}
