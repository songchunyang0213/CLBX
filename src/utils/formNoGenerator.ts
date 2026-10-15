import { ReimbursementForm } from '../types/reimbursement';

/**
 * 报销单单据号编码规则:
 * 常量 TERB + 四位年 (YYYY) + 两位月 (MM) + 两位日 (DD) + 三位数字流水 (001, 002...)
 * 示例: TERB20260926001
 */
export function generateNextFormNo(
  existingForms: ReimbursementForm[] = [],
  targetDate?: string
): string {
  const d = targetDate ? new Date(targetDate) : new Date();
  const year = isNaN(d.getFullYear()) ? new Date().getFullYear() : d.getFullYear();
  const month = String(isNaN(d.getMonth()) ? new Date().getMonth() + 1 : d.getMonth() + 1).padStart(2, '0');
  const day = String(isNaN(d.getDate()) ? new Date().getDate() : d.getDate()).padStart(2, '0');
  const prefix = `TERB${year}${month}${day}`;

  // 扫描已有单据中以当前前缀开头的流水号最大值
  let maxSeq = 0;
  const regex = new RegExp(`^${prefix}(\\d{3})$`);
  (existingForms || []).forEach((f) => {
    if (f.formNo) {
      const match = f.formNo.trim().match(regex);
      if (match) {
        const seq = parseInt(match[1], 10);
        if (seq > maxSeq) {
          maxSeq = seq;
        }
      }
    }
  });

  let nextSeq = maxSeq + 1;
  let candidate = `${prefix}${String(nextSeq).padStart(3, '0')}`;

  // 全局唯一性兜底保障：若 candidate 已被其他单据占用，则继续自增直到唯一
  const existingSet = new Set((existingForms || []).map((f) => f.formNo?.trim().toUpperCase()));
  while (existingSet.has(candidate.toUpperCase())) {
    nextSeq++;
    candidate = `${prefix}${String(nextSeq).padStart(3, '0')}`;
  }

  return candidate;
}

/**
 * 校验单据号的合法性、唯一性与格式
 */
export function validateFormNo(
  formNo: string,
  currentFormIdOrNo: string,
  existingForms: ReimbursementForm[] = []
): {
  isValid: boolean;
  isEmpty: boolean;
  isDuplicate: boolean;
  isStandardFormat: boolean;
  errorMessage?: string;
} {
  const trimmed = formNo ? formNo.trim() : '';
  if (!trimmed) {
    return {
      isValid: false,
      isEmpty: true,
      isDuplicate: false,
      isStandardFormat: false,
      errorMessage: '单据编号不能为空',
    };
  }

  // 校验是否与其他单据重复（排除当前正在编辑的单据本身）
  const isDuplicate = existingForms.some((f) => {
    if (f.id && f.id === currentFormIdOrNo) return false;
    if (f.formNo === currentFormIdOrNo) return false;
    return f.formNo?.trim().toUpperCase() === trimmed.toUpperCase();
  });

  if (isDuplicate) {
    return {
      isValid: false,
      isEmpty: false,
      isDuplicate: true,
      isStandardFormat: false,
      errorMessage: `单据编号【${trimmed}】已存在，单据编号作为唯一标识全局不允许重复！`,
    };
  }

  // 标准格式正则: TERB + 4位年 + 2位月 + 2位日 + 3位数字流水 (共15位)
  const isStandardFormat = /^TERB\d{4}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}$/.test(trimmed);

  return {
    isValid: true,
    isEmpty: false,
    isDuplicate: false,
    isStandardFormat,
  };
}

/**
 * 将可能残留的旧版 TERD 格式无缝升级为新标准 TERB 格式
 */
export function migrateFormNoToStandard(no: string): string {
  if (!no) return no;
  const trimmed = no.trim();
  if (trimmed.startsWith('TERD')) {
    // 匹配 TERD + 2位年 + 2位月 + 2位日 + 流水号
    return trimmed.replace(/^TERD(\d{2})(\d{2})(\d{2})(\d+)$/, (_m, yy, mm, dd, seq) => {
      const year = `20${yy}`;
      const threeDigitSeq = seq.slice(-3).padStart(3, '0');
      return `TERB${year}${mm}${dd}${threeDigitSeq}`;
    }).replace(/^TERD/, 'TERB');
  }
  return trimmed;
}

export const migrateLegacyFormNo = migrateFormNoToStandard;
