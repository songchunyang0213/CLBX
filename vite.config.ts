import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';
import { createRequire } from 'node:module';

import fs from 'node:fs';

// 运行时加载 CJS 服务端代码（绕过 esbuild 对配置文件的打包，确保 node:sqlite 由 Node 原生加载）
const nodeRequire = createRequire(import.meta.url);

/** 把 SQLite Express API 挂到 Vite 开发/预览服务器的 /api 下 */
function sqliteApiPlugin(): Plugin {
  const mount = (server: { middlewares: unknown }) => {
    const { createApiRouter } = nodeRequire('./server/api.cjs');
    // Express Router 本身是兼容 connect 的 (req,res,next) 处理函数
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (server.middlewares as any).use('/api', createApiRouter());
  };
  return {
    name: 'sqlite-api-middleware',
    configureServer: (server) => mount(server),
    configurePreviewServer: (server) => mount(server),
  };
}

/** 智能路径解析：兼容 components 存放在 /src/components 或根目录 /components 两种情况 */
function componentResolveFallbackPlugin(): Plugin {
  return {
    name: 'component-resolve-fallback',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!importer) return null;

      // 1. 从 src/App.tsx 等处引用 ./components/xxx 或 /components/xxx
      if (
        source.startsWith('./components/') ||
        source.startsWith('../components/') ||
        source.startsWith('/components/') ||
        source.startsWith('components/')
      ) {
        const sub = source.replace(/^(\.|\.\.|\/)*components\//, '');
        const cleanName = sub.replace(/\.(tsx|ts|jsx|js)$/, '');

        const candidates = [
          path.resolve(import.meta.dirname, 'src/components', `${cleanName}.tsx`),
          path.resolve(import.meta.dirname, 'components', `${cleanName}.tsx`),
          path.resolve(import.meta.dirname, 'src/components', `${cleanName}.ts`),
          path.resolve(import.meta.dirname, 'components', `${cleanName}.ts`),
        ];
        for (const candidate of candidates) {
          if (fs.existsSync(candidate)) {
            return candidate;
          }
        }
      }

      // 2. 根目录 components/ 下的文件引用 ../types/xxx、../utils/xxx、../data/xxx
      if (importer.includes('/components/') || importer.includes('\\components\\')) {
        if (
          source.startsWith('../types/') ||
          source.startsWith('../utils/') ||
          source.startsWith('../data/')
        ) {
          const subPath = source.replace(/^\.\.\//, '');
          const cleanSub = subPath.replace(/\.(tsx|ts|jsx|js)$/, '');
          const candidates = [
            path.resolve(import.meta.dirname, 'src', `${cleanSub}.ts`),
            path.resolve(import.meta.dirname, 'src', `${cleanSub}.tsx`),
            path.resolve(import.meta.dirname, `${cleanSub}.ts`),
            path.resolve(import.meta.dirname, `${cleanSub}.tsx`),
          ];
          for (const candidate of candidates) {
            if (fs.existsSync(candidate)) {
              return candidate;
            }
          }
        }
      }
      return null;
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), sqliteApiPlugin(), componentResolveFallbackPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    optimizeDeps: {
      // PaddleOCR 与 tesseract.js 均需预构建（dynamic/static import 的 bare specifier）
      include: ['@paddlejs-models/ocr', 'tesseract.js'],
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      // 必须忽略 data/ 目录：SQLite 每次写入都会改动 data/app.db(-wal)，
      // 若被 Vite watcher 捕获会触发页面 full-reload，而页面挂载又会回写数据库，形成无限刷新风暴。
      watch:
        process.env.DISABLE_HMR === 'true'
          ? null
          : {
              ignored: ['**/data/**', '**/data'],
            },
    },
  };
});
