import { BillItem, ConsumptionTypeMaster } from '../types/reimbursement';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';
// tesseract 本地 worker 与非 SIMD core（避免 CDN worker 的 require 问题与 SIMD wasm 崩溃）
import tesseractWorkerUrl from 'tesseract.js/dist/worker.min.js?url';
import tesseractCoreUrl from 'tesseract.js-core/tesseract-core.wasm.js?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export interface RecognizedInvoice {
  invoiceNumber: string;
  invoiceDate: string;
  sellerName: string;
  buyerName: string;
  totalAmount: number;
  netAmount: number;
  taxAmount: number;
  billType: string;
  consumptionType: string;
  taxMajorCategory?: string;
  taxSubCategory?: string;
  recommendedExpenseItemId?: string;
  recommendedExpenseItemName?: string;
  recommendedTransportId?: string;
  recommendedTransportName?: string;
  confidence: number;
  fileName: string;
  fileUrl?: string;
  fileType: 'image' | 'pdf';
  fileSizeText?: string;
  rawTextPreview?: string;
}

/**
 * 根据识别到的税务大类、小类及货物服务名称，利用消费类型基础档案规则匹配消费类型
 */
export function matchConsumptionTypeByRules(
  taxMajor?: string,
  taxSub?: string,
  goodsName?: string,
  rules?: ConsumptionTypeMaster[]
): { consumptionType: string; matchedRule?: ConsumptionTypeMaster } {
  if (!rules || rules.length === 0) {
    return { consumptionType: '交通' };
  }

  const activeRules = [...rules]
    .filter((r) => r.status === 'enabled')
    .sort((a, b) => a.priority - b.priority);

  const textToMatch = `${taxMajor || ''} ${taxSub || ''} ${goodsName || ''}`.toLowerCase();

  for (const rule of activeRules) {
    // 1. 关键词命中
    if (rule.keywords && rule.keywords.length > 0) {
      const hit = rule.keywords.some((kw) => kw && textToMatch.includes(kw.toLowerCase()));
      if (hit) return { consumptionType: rule.consumptionType, matchedRule: rule };
    }
    // 2. 税务大类和小类匹配
    const majorHit = rule.taxMajorCategory && textToMatch.includes(rule.taxMajorCategory.toLowerCase());
    const subHit = rule.taxSubCategory && textToMatch.includes(rule.taxSubCategory.toLowerCase());

    if (majorHit && subHit) {
      return { consumptionType: rule.consumptionType, matchedRule: rule };
    }
    if (majorHit && !rule.taxSubCategory) {
      return { consumptionType: rule.consumptionType, matchedRule: rule };
    }
    if (subHit) {
      return { consumptionType: rule.consumptionType, matchedRule: rule };
    }
  }

  // 消费档案仅保留 交通/住宿/替票 三类，未命中任何规则时统一兜底为替票
  return { consumptionType: '替票' };
}

export const PRESET_SAMPLE_INVOICES: RecognizedInvoice[] = [
  {
    invoiceNumber: '26442000000839218392',
    invoiceDate: '2026-09-20',
    sellerName: '海底捞餐饮股份有限公司',
    buyerName: '测试公司C',
    totalAmount: 268.00,
    netAmount: 252.83,
    taxAmount: 15.17,
    billType: '数电票 (普通发票)',
    consumptionType: '餐饮',
    recommendedExpenseItemName: '餐饮费用',
    confidence: 0.99,
    fileName: '餐饮发票_海底捞_268元.pdf',
    fileType: 'pdf',
    fileSizeText: '142 KB',
    rawTextPreview: '数电普通发票\n发票号码: 26442000000839218392\n开票日期: 2026年09月20日\n购买方: 测试公司C\n销售方: 海底捞餐饮股份有限公司\n项目: *餐饮服务*餐费\n金额: ¥252.83\n税率: 6%\n税额: ¥15.17\n价税合计: ¥268.00 (贰佰陆拾捌元整)',
  },
  {
    invoiceNumber: '26442000000839218393',
    invoiceDate: '2026-09-21',
    sellerName: '西贝餐饮管理集团有限公司',
    buyerName: '测试公司C',
    totalAmount: 185.50,
    netAmount: 175.00,
    taxAmount: 10.50,
    billType: '数电票 (普通发票)',
    consumptionType: '餐饮',
    recommendedExpenseItemName: '餐饮费用',
    confidence: 0.98,
    fileName: '餐饮发票_西贝莜面村_185.5元.png',
    fileType: 'image',
    fileSizeText: '286 KB',
    rawTextPreview: '数电普通发票\n发票号码: 26442000000839218393\n开票日期: 2026年09月21日\n购买方: 测试公司C\n销售方: 西贝餐饮管理集团有限公司\n项目: *餐饮服务*工作就餐\n金额: ¥175.00\n税额: ¥10.50\n价税合计: ¥185.50',
  },
  {
    invoiceNumber: '26442000000839218394',
    invoiceDate: '2026-09-22',
    sellerName: '星巴克企业管理(中国)有限公司',
    buyerName: '测试公司C',
    totalAmount: 76.00,
    netAmount: 71.70,
    taxAmount: 4.30,
    billType: '数电票 (普通发票)',
    consumptionType: '餐饮',
    recommendedExpenseItemName: '餐饮费用',
    confidence: 0.99,
    fileName: '咖啡就餐发票_星巴克_76元.png',
    fileType: 'image',
    fileSizeText: '98 KB',
    rawTextPreview: '电子发票\n发票号码: 26442000000839218394\n开票日期: 2026年09月22日\n购买方: 测试公司C\n销售方: 星巴克企业管理(中国)有限公司\n项目: *餐饮服务*商务咖啡饮品\n价税合计: ¥76.00',
  },
  {
    invoiceNumber: '26117000005829104821',
    invoiceDate: '2026-09-23',
    sellerName: '滴滴出行科技有限公司',
    buyerName: '测试公司C',
    totalAmount: 38.60,
    netAmount: 37.48,
    taxAmount: 1.12,
    billType: '数电票 (普通发票)',
    consumptionType: '交通',
    recommendedExpenseItemName: '交通费用',
    recommendedTransportName: '出租车/网约车',
    confidence: 0.99,
    fileName: '滴滴行程电子发票_38.6元.pdf',
    fileType: 'pdf',
    fileSizeText: '189 KB',
    rawTextPreview: '数电普通发票\n发票号码: 26117000005829104821\n开票日期: 2026年09月23日\n销售方: 滴滴出行科技有限公司\n项目: *运输服务*网约车客运服务\n价税合计: ¥38.60\n行程: 首都机场T3 -> 朝阳门SOHO',
  },
  {
    invoiceNumber: '26312000003928172635',
    invoiceDate: '2026-09-23',
    sellerName: '中国铁路网络有限公司',
    buyerName: '测试公司C',
    totalAmount: 553.00,
    netAmount: 507.34,
    taxAmount: 45.66,
    billType: '数电票 (铁路客票)',
    consumptionType: '交通',
    recommendedExpenseItemName: '交通费用',
    recommendedTransportName: '火车/高铁',
    confidence: 0.99,
    fileName: '铁路电子客票_G102_553元.pdf',
    fileType: 'pdf',
    fileSizeText: '115 KB',
    rawTextPreview: '中国铁路电子发票\n发票号码: 26312000003928172635\n开票日期: 2026年09月23日\n车次: G102 上海虹桥 - 北京南\n席别: 二等座 08车12F号\n票价: ¥553.00 (含税9%)',
  },
  {
    invoiceNumber: '26210000009482910293',
    invoiceDate: '2026-09-22',
    sellerName: '华住酒店管理有限公司',
    buyerName: '测试公司C',
    totalAmount: 380.00,
    netAmount: 358.49,
    taxAmount: 21.51,
    billType: '增值税专用发票',
    consumptionType: '住宿',
    recommendedExpenseItemName: '住宿费用',
    confidence: 0.97,
    fileName: '全季酒店住宿发票_380元.png',
    fileType: 'image',
    fileSizeText: '310 KB',
    rawTextPreview: '增值税专用发票\n发票号码: 26210000009482910293\n销售方: 华住酒店管理有限公司\n项目: *住宿服务*房费1间夜\n金额: ¥358.49\n税额: ¥21.51\n价税合计: ¥380.00',
  }
];

/**
 * 从文件名中推断最终金额。
 * 1) 优先匹配带“元/块”后缀的金额（如 45元、45.5块）
 * 2) 匹配票据关键词前缀后紧跟的数字（如 客车票45、发票45、车票45、票价45、金额45.00、汽车票45_1）
 * 3) 过滤掉日期、发票号等干扰数字，如果仅剩唯一有效数字直接采信
 */
function extractAmountFromFileName(fileName: string): number | null {
  if (!fileName) return null;
  const nameWithoutExt = fileName.replace(/\.[^.]+$/, '');

  // 1. 优先匹配明确带“元/块”后缀的金额
  const yuanMatch = nameWithoutExt.match(/(\d+(?:\.\d{1,2})?)\s*(?:元|块)/);
  if (yuanMatch) {
    const val = parseFloat(yuanMatch[1]);
    if (val > 0 && val <= 100000) return val;
  }

  // 1b. 票据关键词前缀后紧跟的数字（如 客车票45、发票45、车票45、汽车票45、票价45、金额45.00、客车票45_1）
  const ticketKeywordMatch = nameWithoutExt.match(
    /(?:客车票|汽车票|客运票|客票|车票|发票|机票|门票|票价|金额|合计|费用|总计)[_\s-]*([1-9][0-9]{0,4}(?:\.\d{1,2})?)/i
  );
  if (ticketKeywordMatch) {
    const val = parseFloat(ticketKeywordMatch[1]);
    if (val > 0 && val <= 100000) return val;
  }

  // 2. 收集文件名中所有数字片段
  const numbers: { value: number; raw: string; index: number }[] = [];
  const numRegex = /\d+(?:\.\d{1,2})?/g;
  let m: RegExpExecArray | null;
  while ((m = numRegex.exec(nameWithoutExt)) !== null) {
    numbers.push({ value: parseFloat(m[0]), raw: m[0], index: m.index });
  }

  // 3. 过滤掉明显不是金额的数字
  const candidates = numbers.filter((n) => {
    // 排除超长整数（发票号、流水号等）
    if (!n.raw.includes('.') && n.raw.length >= 7) return false;
    // 排除 6 位（如 260923）或 8 位（如 20260924）无小数整数，通常是日期
    if (!n.raw.includes('.') && (n.raw.length === 6 || n.raw.length === 8)) return false;
    // 排除常见年份（如 2024、2025、2026）
    if (!n.raw.includes('.') && n.value >= 2020 && n.value <= 2035) return false;
    // 金额合理范围
    return n.value > 0 && n.value <= 100000;
  });

  if (candidates.length === 0) return null;

  // 4. 优先带小数点的数字作为金额（如 256.00、45.00）
  const decimalCandidate = candidates.find((n) => n.raw.includes('.'));
  if (decimalCandidate) return decimalCandidate.value;

  // 5. 若文件名仅有一个有效整数候选（如 客车票45.jpg 中只有 45），直接作为金额采信
  if (candidates.length === 1) {
    return candidates[0].value;
  }

  return null;
}

/**
 * 从发票正文中提取“价税合计”或客车票“执行票价/发票金额”。
 * 空间重排后的数电票文本形如（数字行在标签行上方）：
 *   “贰拾壹圆整 ¥ 21.00”
 *   “价税合计（大写） （小写）”
 * OCR 连排文本则可能是：
 *   “价税合计（大写）贰拾壹圆整（小写）¥21.00”
 * 客车票文本形如：
 *   “执行票价 发票 45.00” 或 “发票 45.00” 或 “票价 45.00”
 */
function extractTotalAmount(text: string): number | null {
  if (!text) return null;
  const numRe = '[0-9][0-9,]*\\.\\d{1,2}';
  const toNum = (s: string): number | null => {
    const v = parseFloat(s.replace(/,/g, ''));
    return Number.isFinite(v) && v > 0 ? v : null;
  };

  // 1) 最强锚点：中文大写金额与 ¥ 数字连排
  let m = text.match(
    /[零壹贰叁肆伍陆柒捌玖拾佰仟圆角分元]{2,}整?\s*[￥¥]\s*([0-9][0-9,]*\.\d{1,2})/
  );
  if (m) {
    const v = toNum(m[1]);
    if (v) return v;
  }

  // 2) “（小写）”后 30 字内首个 ¥ 金额
  m = text.match(
    /[（(]?\s*小写\s*[)）]?[\s\S]{0,30}?[￥¥]\s*([0-9][0-9,]*\.\d{1,2})/
  );
  if (m) {
    const v = toNum(m[1]);
    if (v) return v;
  }

  // 3) “价税合计”标签后 60 字内首个 ¥ 金额
  m = text.match(/价\s*税\s*合\s*计[\s\S]{0,60}?[￥¥]\s*([0-9][0-9,]*\.\d{1,2})/);
  if (m) {
    const v = toNum(m[1]);
    if (v) return v;
  }

  // 4) “小写”后 20 字内不带货币符号的两位小数
  m = text.match(/[（(]?\s*小写\s*[)）]?[\s\S]{0,20}?([0-9][0-9,]*\.\d{2})(?![0-9])/);
  if (m) {
    const v = toNum(m[1]);
    if (v) return v;
  }

  // 4b) 火车票/客车票“票价: ¥40.00”或“票价 40.00”
  m = text.match(/票\s*价[\s\S]{0,15}?[￥¥]?\s*([0-9][0-9,]*\.\d{2})(?![0-9])/);
  if (m) {
    const v = toNum(m[1]);
    if (v) return v;
  }

  // 4c) 客车票核心票价：“执行票价”、“发票金额”、“上限票价”后接的票额（如“执行票价 发票 45.00”）
  m = text.match(
    /(?:执行票价|上限票价|票面票价|客票票价|发票金额|票面金额|实收金额|实付金额|票款|金税合计)[\s\S]{0,35}?(?:发\s*票|[￥¥])?\s*([1-9][0-9]{0,3}(?:\.\d{1,2})?)(?![0-9])/
  );
  if (m) {
    const v = toNum(m[1]);
    if (v && v >= 1 && v <= 10000) return v;
  }

  // 4d) 客运发票印章或表格内的“发票 45.00”或“发票 45”
  m = text.match(/发\s*票\s*[:：]?\s*([1-9][0-9]{0,3}(?:\.\d{1,2})?)(?![0-9])/);
  if (m) {
    const v = toNum(m[1]);
    if (v && v >= 1 && v <= 10000) return v;
  }

  // 5) “合计”后 15 字内唯一的 ¥ 金额
  m = text.match(
    new RegExp(`合\\s*计[\\s\\S]{0,15}?[￥¥]\\s*(${numRe})(?![\\s\\S]{0,8}?[￥¥])`)
  );
  if (m) {
    const v = toNum(m[1]);
    if (v) return v;
  }

  // 6) ¥ 金额紧跟“元”
  m = text.match(new RegExp(`[￥¥]\\s*(${numRe})\\s*元`));
  if (m) {
    const v = toNum(m[1]);
    if (v) return v;
  }

  // 6b) 客车票/客运发票语境
  if (/客运|客车|汽车票|乘车|检票|车票|发票/.test(text) || /\b[0-9]{10,12}\b/.test(text)) {
    const decimals = [...text.matchAll(/(?<![0-9.])([1-9][0-9]{0,3}\.\d{2})(?![0-9])/g)].map((x) => {
      const val = parseFloat(x[1].replace(/,/g, ''));
      return { val, index: x.index ?? 0, raw: x[1] };
    }).filter((x) => Number.isFinite(x.val) && x.val >= 1 && x.val <= 5000);

    if (decimals.length) {
      // 过滤时间格式（如 08:37 误读为 08.37）
      const purePrices = decimals.filter((d) => {
        const sub = text.slice(Math.max(0, d.index - 15), Math.min(text.length, d.index + 20));
        return !/时间|分|秒|月|日/.test(sub);
      });
      if (purePrices.length > 0) {
        // 优先靠近“票价/发票/金额/全/执行”的候选
        const anchors = [...text.matchAll(/票\s*价|金\s*额|发\s*票|执\s*行|全|[元￥¥]/g)];
        for (const a of anchors) {
          const near = purePrices.find(
            (x) => Math.abs(x.index - (a.index ?? 0)) <= 35
          );
          if (near) return near.val;
        }
        return purePrices[0].val;
      }
    }
  }

  // 7) 最终兜底：取全票最大的 ¥ 金额
  const allYen = [...text.matchAll(new RegExp(`[￥¥]\\s*(${numRe})`, 'g'))]
    .map((x) => parseFloat(x[1].replace(/,/g, '')))
    .filter((x) => Number.isFinite(x) && x <= 100000);
  if (allYen.length) return Math.max(...allYen);

  return null;
}

/**
 * 从“合计”区域提取不含税金额与税额（金额在前、税额在后）。
 * 数电票空间布局：数字行在“合 计”标签行上方：
 *   “¥ 19.81 ¥ 1.19”
 *   “合 计”
 * OCR 连排则是：“合计 ¥19.81 ¥1.19”。
 */
function extractNetAndTax(text: string): { net: number | null; tax: number | null } {
  if (!text) return { net: null, tax: null };
  const numRe = '[0-9][0-9,]*\\.\\d{1,2}';

  // A) 两个 ¥ 数字后，12 字内出现“合 计”标签（空间布局）
  let m = text.match(
    new RegExp(`[￥¥]\\s*(${numRe})\\s+[￥¥]\\s*(${numRe})[\\s\\S]{0,12}?合\\s*计`)
  );
  // B) “合 计”标签后紧跟两个 ¥ 数字（OCR 连排）
  if (!m) {
    m = text.match(
      new RegExp(`合\\s*计\\s+[￥¥]\\s*(${numRe})\\s+[￥¥]\\s*(${numRe})`)
    );
  }
  // C) 跨内容流坐标容差导致标签与金额混排：“（小写）”后紧跟两个 ¥ 金额
  if (!m) {
    m = text.match(
      new RegExp(`小\\s*写\\s*[)）][\\s\\S]{0,10}?[￥¥]\\s*(${numRe})\\s+[￥¥]\\s*(${numRe})`)
    );
  }
  if (!m) return { net: null, tax: null };
  const net = parseFloat(m[1].replace(/,/g, ''));
  const tax = parseFloat(m[2].replace(/,/g, ''));
  return {
    net: Number.isFinite(net) ? net : null,
    tax: Number.isFinite(tax) ? tax : null,
  };
}

/**
 * 将 pdfjs 的文本项按空间位置（行 y、列 x）重排为接近视觉阅读顺序的文本。
 * pdfjs items 默认按 PDF 内容流排列，数字与标签常被拆开且乱序（如“（小写）”
 * 与金额相距很远），直接 join 会导致字段抽取失败。
 */
function layoutPositioned(items: { s: string; x: number; y: number }[]): string {
  const rows: { y: number; parts: { x: number; s: string }[] }[] = [];
  for (const it of items) {
    const s = (it.s || '').replace(/\s+/g, ' ').trim();
    if (!s) continue;
    let row = rows.find((r) => Math.abs(r.y - it.y) <= 3);
    if (!row) {
      row = { y: it.y, parts: [] };
      rows.push(row);
    }
    row.parts.push({ x: it.x, s });
  }
  // PDF 坐标 y 向上增大，视觉自上而下 = y 降序
  rows.sort((a, b) => b.y - a.y);
  return rows
    .map((r) => {
      r.parts.sort((a, b) => a.x - b.x);
      return r.parts.map((p) => p.s).join(' ');
    })
    .join('\n');
}

function layoutTextItems(items: Array<{ str: string; transform: number[] }>): string {
  return layoutPositioned(
    items.map((it) => ({ s: it.str, x: it.transform[4], y: it.transform[5] }))
  );
}

// ============================================================================
// 自包含 PDF 底层解析回退引擎
// ----------------------------------------------------------------------------
// 部分发票（如各省税局生成的电子发票）使用未内嵌 ToUnicode 的标准 CMap 字体
// （STSong-Light + UniGB-UCS2-H 等），pdfjs 在缺少 cMapUrl 时提取不到任何
// 数值。下面直接解析 PDF 对象/字体字典/内容流，支持三种解码路径：
//   1) 字体自带 ToUnicode CMap（最通用，含 Identity-H 子集字体）
//   2) Type0 字体的 UCS2/UTF16 标准编码（码点即 Unicode）
//   3) 简单字体 WinAnsiEncoding
// 输出与 pdfjs 路径同构的“按空间布局重排”文本，复用后续字段抽取规则。
// ============================================================================

function bytesToLatin1(bytes: Uint8Array): string {
  let out = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    out += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return out;
}

async function inflateFlate(buf: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  const ds = new DecompressionStream('deflate');
  // 复制到纯 ArrayBuffer 支撑的缓冲区（满足 BlobPart 类型，且避免 SharedArrayBuffer 问题）
  const ab = new ArrayBuffer(buf.length);
  new Uint8Array(ab).set(buf);
  const decoded = new Blob([ab]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(decoded).arrayBuffer());
}

interface RawObj {
  body: string;
  stream: Uint8Array | null;
}

/** 扫描全部间接对象（含 ObjStm 压缩对象流），返回 objNum → RawObj */
async function buildObjectDb(fileBytes: Uint8Array): Promise<Map<string, RawObj>> {
  const latin = bytesToLatin1(fileBytes);
  const db = new Map<string, RawObj>();

  const objRe = /(\d+)\s+(\d+)\s+obj/g;
  let m: RegExpExecArray | null;
  while ((m = objRe.exec(latin)) !== null) {
    const start = objRe.lastIndex;
    const end = latin.indexOf('endobj', start);
    if (end === -1) break;
    db.set(m[1], { body: latin.substring(start, end), stream: null });
  }

  // 解析 ObjStm（PDF 1.5+ 压缩对象流）
  for (const [n, obj] of [...db]) {
    if (!/\/Type\s*\/ObjStm/.test(obj.body)) continue;
    try {
      const stream = await getDecodedStream(obj);
      if (!stream) continue;
      const text = bytesToLatin1(stream);
      const nCount = parseInt(obj.body.match(/\/N\s+(\d+)/)?.[1] || '0', 10);
      const first = parseInt(obj.body.match(/\/First\s+(\d+)/)?.[1] || '0', 10);
      const header = text.substring(0, first).trim().split(/\s+/);
      for (let i = 0; i < nCount; i++) {
        const objNum = header[i * 2];
        const off = parseInt(header[i * 2 + 1], 10);
        const nextOff =
          i + 1 < nCount ? parseInt(header[i * 2 + 3], 10) : text.length - first;
        if (!objNum || !Number.isFinite(off)) continue;
        db.set(objNum, {
          body: text.substring(first + off, first + nextOff),
          stream: null,
        });
      }
    } catch (e) {
      console.warn('ObjStm 解析失败 obj', n, e);
    }
  }
  return db;
}

/** 按对象字典声明的 /Filter 解码其 stream（目前支持 FlateDecode 与无压缩） */
async function getDecodedStream(obj: RawObj): Promise<Uint8Array | null> {
  if (obj.stream) return obj.stream;
  const sm = obj.body.match(/\bstream(\r\n|\n|\r)/);
  if (!sm) return null;
  const start = obj.body.indexOf(sm[0]) + sm[0].length;
  let end = obj.body.indexOf('endstream', start);
  if (end === -1) return null;
  let rawStr = obj.body.substring(start, end);
  // 去掉结尾 EOL
  rawStr = rawStr.replace(/\r?\n$/, '');
  const filterMatch = obj.body.match(/\/Filter(\s*\/\w+|\s*\[[^\]]*\])/);
  let filters: string[] = [];
  if (filterMatch) {
    filters = [...filterMatch[1].matchAll(/\/(\w+)/g)].map((x) => x[1]);
  }
  let bytes = Uint8Array.from([...rawStr].map((c) => c.charCodeAt(0) & 0xff));
  for (const f of filters) {
    if (f === 'FlateDecode') {
      bytes = await inflateFlate(bytes);
    } else {
      // 其他过滤器（ASCII85/LZW 等）暂不支持
      return null;
    }
  }
  obj.stream = bytes;
  return bytes;
}

// ---- 迷你 PDF 语法扫描器（用于解析字典/内容流） ----

type PDFValue =
  | Map<string, PDFValue>
  | PDFValue[]
  | { name: string }
  | { ref: number }
  | { bytes: Uint8Array }
  | number
  | string;

const isDict = (v: unknown): v is Map<string, PDFValue> => v instanceof Map;
const isName = (v: unknown, n?: string): v is { name: string } =>
  typeof v === 'object' && v !== null && !(v instanceof Map) && !Array.isArray(v) &&
  'name' in v && (n ? (v as { name: string }).name === n : true);
const isRef = (v: unknown): v is { ref: number } =>
  typeof v === 'object' && v !== null && !(v instanceof Map) && !Array.isArray(v) &&
  'ref' in v;
const isBytes = (v: unknown): v is { bytes: Uint8Array } =>
  typeof v === 'object' && v !== null && !(v instanceof Map) && !Array.isArray(v) &&
  'bytes' in v;

class PdfScan {
  p = 0;
  constructor(public s: string) {}
  eof() { return this.p >= this.s.length; }
  skip() {
    while (this.p < this.s.length) {
      const c = this.s[this.p];
      if (c === '%') {
        while (this.p < this.s.length && this.s[this.p] !== '\n') this.p++;
      } else if (/\s/.test(c)) this.p++;
      else break;
    }
  }
  startsWith(lit: string) { return this.s.startsWith(lit, this.p); }
  readBareWord(): string {
    const start = this.p;
    while (this.p < this.s.length && !/[\s()<>\[\]{}%/]/.test(this.s[this.p])) this.p++;
    return this.s.substring(start, this.p);
  }
}

/** 解析“字典/对象”语境的一个值（支持间接引用 N G R） */
function parseDictValue(sc: PdfScan): PDFValue {
  sc.skip();
  if (sc.startsWith('<<')) {
    sc.p += 2;
    const map = new Map<string, PDFValue>();
    for (;;) {
      sc.skip();
      if (sc.startsWith('>>')) { sc.p += 2; return map; }
      if (sc.eof()) return map;
      const key = parseDictValue(sc);
      if (!isName(key)) return map;
      const val = parseDictValue(sc);
      map.set(key.name, val);
    }
  }
  if (sc.startsWith('[')) {
    sc.p++;
    const arr: PDFValue[] = [];
    for (;;) {
      sc.skip();
      if (sc.startsWith(']')) { sc.p++; return arr; }
      if (sc.eof()) return arr;
      arr.push(parseDictValue(sc));
    }
  }
  return parseAtom(sc, true);
}

/** 解析原子：名称/字符串/数字/关键字；dictMode 下数字可能构成间接引用 */
function parseAtom(sc: PdfScan, dictMode: boolean): PDFValue {
  sc.skip();
  const c = sc.s[sc.p];

  if (c === '/') {
    sc.p++;
    let name = '';
    while (sc.p < sc.s.length && !/[\s()<>\[\]{}%/]/.test(sc.s[sc.p])) {
      if (sc.s[sc.p] === '#' && sc.p + 2 < sc.s.length) {
        name += String.fromCharCode(parseInt(sc.s.substring(sc.p + 1, sc.p + 3), 16));
        sc.p += 3;
      } else {
        name += sc.s[sc.p++];
      }
    }
    return { name };
  }

  if (c === '(') {
    sc.p++;
    const out: number[] = [];
    let depth = 1;
    while (sc.p < sc.s.length && depth > 0) {
      const ch = sc.s[sc.p++];
      if (ch === '\\') {
        const e = sc.s[sc.p];
        if (/[0-7]/.test(e)) {
          let oct = '';
          while (oct.length < 3 && /[0-7]/.test(sc.s[sc.p])) oct += sc.s[sc.p++];
          out.push(parseInt(oct, 8) & 0xff);
        } else {
          const mapEsc: Record<string, number> = {
            n: 0x0a, r: 0x0d, t: 0x09, b: 0x08, f: 0x0c,
            '(': 0x28, ')': 0x29, '\\': 0x5c,
          };
          sc.p++;
          if (e === '\n' || e === '\r') {
            if (e === '\r' && sc.s[sc.p] === '\n') sc.p++;
          } else {
            out.push(mapDecEsc(e, mapEsc));
          }
        }
      } else if (ch === '(') { depth++; out.push(0x28); }
      else if (ch === ')') { depth--; if (depth > 0) out.push(0x29); }
      else out.push(ch.charCodeAt(0) & 0xff);
    }
    return { bytes: Uint8Array.from(out) };
  }

  if (c === '<') {
    const end = sc.s.indexOf('>', sc.p + 1);
    const hex = sc.s.substring(sc.p + 1, end).replace(/\s+/g, '');
    sc.p = end + 1;
    const padded = hex.length % 2 ? hex + '0' : hex;
    const bytes = Uint8Array.from(
      { length: padded.length / 2 },
      (_, i) => parseInt(padded.substr(i * 2, 2), 16)
    );
    return { bytes };
  }

  if (/[+-]?(\d|\.)/.test(c) || (c === '-' || c === '+') && /\d|\./.test(sc.s[sc.p + 1] || '')) {
    const start = sc.p;
    if (sc.s[sc.p] === '+' || sc.s[sc.p] === '-') sc.p++;
    while (sc.p < sc.s.length && /[\d.]/.test(sc.s[sc.p])) sc.p++;
    const numStr = sc.s.substring(start, sc.p);
    if (dictMode) {
      // 形如“N G R”的间接引用？（当前数字 N，后接代数 G 与关键字 R）
      const rest = sc.s.substring(sc.p);
      const refM = rest.match(/^\s+(\d+)\s+R(?=[\s()<>\[\]{}%/]|$)/);
      if (refM) {
        sc.p += refM[0].length;
        return { ref: parseInt(numStr, 10) };
      }
    }
    return Number(numStr);
  }

  // 裸关键字
  return sc.readBareWord();
}

function mapDecEsc(e: string, m: Record<string, number>): number {
  return m[e] ?? (e.charCodeAt(0) & 0xff);
}

// ---- ToUnicode CMap 解析 ----

function hexBytes(hex: string): Uint8Array {
  const padded = hex.length % 2 ? hex + '0' : hex;
  return Uint8Array.from(
    { length: padded.length / 2 },
    (_, i) => parseInt(padded.substr(i * 2, 2), 16)
  );
}

/** 将 UTF-16BE 字节序列解码为字符串（自动含代理对） */
function utf16BeToStr(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    out += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
  }
  return out;
}

function parseToUnicode(bytes: Uint8Array): { codeSize: number; map: Map<number, string> } {
  const text = bytesToLatin1(bytes);
  let codeSize = 2;
  const csBlk = text.match(/begincodespacerange([\s\S]*?)endcodespacerange/);
  if (csBlk) {
    const lens = [...csBlk[1].matchAll(/<([0-9A-Fa-f]+)>/g)].map((x) => x[1].length / 2);
    if (lens.length) codeSize = Math.max(...lens);
  }
  const map = new Map<number, string>();

  const addMapping = (src: number, dstHex: string) => {
    const dst = utf16BeToStr(hexBytes(dstHex));
    if (dst) map.set(src, dst);
  };

  for (const blk of [...text.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)]) {
    for (const pair of [...blk[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)]) {
      addMapping(parseInt(pair[1], 16), pair[2]);
    }
  }
  for (const blk of [...text.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)]) {
    // 逐条处理 <lo> <hi> <dst> 或 <lo> <hi> [<d1> <d2> ...]
    const tokenRe = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(?:<([0-9A-Fa-f]+)>|\[([\s\S]*?)\])/g;
    let tm: RegExpExecArray | null;
    while ((tm = tokenRe.exec(blk[1])) !== null) {
      const lo = parseInt(tm[1], 16);
      const hi = parseInt(tm[2], 16);
      if (tm[3] !== undefined) {
        const base = hexBytes(tm[3]);
        for (let code = lo; code <= hi; code++) {
          const next = Uint8Array.from(base);
          // 目标按 UTF-16BE，末单元 +code-lo
          next[next.length - 1] = (next[next.length - 1] + (code - lo)) & 0xff;
          const s = utf16BeToStr(next);
          if (s) map.set(code, s);
        }
      } else {
        const dsts = [...tm[4].matchAll(/<([0-9A-Fa-f]+)>/g)].map((x) => x[1]);
        for (let i = 0; i < dsts.length; i++) addMapping(lo + i, dsts[i]);
      }
    }
  }
  return { codeSize, map };
}

// ---- WinAnsi 单字节编码表（0x80–0x9F 特殊区） ----

const WIN_ANSI_HIGH: Record<number, string> = {
  0x80: '€', 0x82: '‚', 0x83: 'ƒ', 0x84: '„', 0x85: '…', 0x86: '†',
  0x87: '‡', 0x88: 'ˆ', 0x89: '‰', 0x8a: 'Š', 0x8b: '‹', 0x8c: 'Œ',
  0x8e: 'Ž', 0x91: '‘', 0x92: '’', 0x93: '“', 0x94: '”', 0x95: '•',
  0x96: '–', 0x97: '—', 0x98: '˜', 0x99: '™', 0x9a: 'š', 0x9b: '›',
  0x9c: 'œ', 0x9e: 'ž', 0x9f: 'Ÿ',
};

interface DecodedFont {
  codeSize: number;
  toUnicode: Map<number, string> | null;
  directUcs2: boolean;
  winAnsi: boolean;
  /** GBK 混合编码（中文双字节、ASCII 单字节，无 ToUnicode 的 Type0 字体，如铁路电子客票） */
  gbk: boolean;
}

/** GBK 解码器（浏览器与 Node 均内置支持），按需单例创建 */
let gbkDecoder: TextDecoder | null = null;
function decodeGbkBytes(bytes: Uint8Array): string {
  if (!gbkDecoder) gbkDecoder = new TextDecoder('gbk');
  // GBK 为无状态编码：字节 <0x80 直接是 ASCII，≥0x81 起为双字节汉字，
  // 因此内容流里“中文双字节 + ASCII 单字节”混排也能一次正确解码。
  const s = gbkDecoder.decode(bytes);
  // 剔除控制字符（个别票证的符号字形会解出 NUL/SOH 等 C0 字符）
  return s.replace(/[\x00-\x1f]/g, '');
}

function decodeWithFont(font: DecodedFont, bytes: Uint8Array): string {
  let out = '';
  if (font.toUnicode) {
    for (let i = 0; i + font.codeSize - 1 < bytes.length; i += font.codeSize) {
      let code = 0;
      for (let k = 0; k < font.codeSize; k++) code = (code << 8) | bytes[i + k];
      out += font.toUnicode.get(code) ?? '';
    }
    return out;
  }
  if (font.gbk) {
    return decodeGbkBytes(bytes);
  }
  if (font.directUcs2) {
    // 税局标准 CMap（UniGB-UCS2-H 等）实测为混合双字节编码：
    // 汉字 code 即真实 UCS2 码点（5E74=年）；ASCII/符号编码为
    // 0x20 + Latin1 字节（20A5=¥、2032='2'、202E='.'、2020=空格）
    for (let i = 0; i + 1 < bytes.length; i += 2) {
      const code = ((bytes[i] << 8) | bytes[i + 1]) & 0xffff;
      if ((code & 0xff00) === 0x2000) {
        const b = code & 0xff;
        out += b < 0x80 ? String.fromCharCode(b) : WIN_ANSI_HIGH[b] ?? String.fromCharCode(b);
      } else {
        out += String.fromCharCode(code);
      }
    }
    return out;
  }
  if (font.winAnsi) {
    for (const b of bytes) {
      if (b < 0x80) out += String.fromCharCode(b);
      else out += WIN_ANSI_HIGH[b] ?? String.fromCharCode(b);
    }
    return out;
  }
  return '';
}

/** 由字体对象构建 DecodedFont */
async function buildDecodedFont(fontRef: number, db: Map<string, RawObj>): Promise<DecodedFont | null> {
  const obj = db.get(String(fontRef));
  if (!obj) return null;
  const sc = new PdfScan(obj.body);
  const dictVal = parseDictValue(sc);
  if (!isDict(dictVal)) return null;
  const getN = (k: string) => {
    const v = dictVal.get(k);
    return isName(v) ? v.name : null;
  };
  const subtype = getN('Subtype');
  const encVal = dictVal.get('Encoding');
  let encName = isName(encVal) ? encVal.name : null;
  // Encoding 也可能是间接引用的 CMap 对象，读取其 /CMapName
  if (!encName && isRef(encVal)) {
    const cmObj = db.get(String(encVal.ref));
    encName = cmObj?.body.match(/\/CMapName\s*\/([A-Za-z0-9\-]+)/)?.[1] ?? null;
  }
  const isType0 = subtype === 'Type0';

  // ToUnicode
  let toUnicode: Map<number, string> | null = null;
  let tuCodeSize = isType0 ? 2 : 1;
  const tuVal = dictVal.get('ToUnicode');
  if (isRef(tuVal)) {
    const tuObj = db.get(String(tuVal.ref));
    if (tuObj) {
      const stream = await getDecodedStream(tuObj);
      if (stream) {
        const parsed = parseToUnicode(stream);
        toUnicode = parsed.map;
        tuCodeSize = parsed.codeSize;
      }
    }
  }

  const ucs2Like =
    !!encName && /(UCS2|UTF16)/.test(encName);

  // GBK 系列编码（铁路 12306、WPS 等生成的电子客票/发票）
  const gbkLike =
    isType0 &&
    !toUnicode &&
    !!encName &&
    /GBK|GB2312|GBK2K|GB-EUC-H|GBpc-EUC-H|^GB1?$/.test(encName);

  let winAnsi = false;
  if (!isType0) {
    winAnsi = !encName || encName === 'WinAnsiEncoding';
    // 标准 14 款西文基础字体（无 Encoding）按 StandardEncoding，ASCII 区相同
    const base = getN('BaseFont');
    if (/^(Helvetica|Times|Courier|Symbol)/.test(base || '')) winAnsi = true;
  }

  return {
    codeSize: toUnicode ? tuCodeSize : isType0 ? 2 : 1,
    toUnicode,
    directUcs2: isType0 && !toUnicode && ucs2Like,
    winAnsi: !isType0 && !toUnicode && winAnsi,
    gbk: gbkLike,
  };
}

/** 解析单个页面的内容流，输出带坐标的文本片段 */
async function parsePageText(
  pageObjNum: number,
  db: Map<string, RawObj>
): Promise<{ s: string; x: number; y: number }[]> {
  const pageObj = db.get(String(pageObjNum));
  if (!pageObj) return [];
  const pageDictVal = parseDictValue(new PdfScan(pageObj.body));
  if (!isDict(pageDictVal)) return [];

  // Resources（支持从 /Pages 父节点继承）
  let resVal = pageDictVal.get('Resources');
  if (isRef(resVal)) {
    const ro = db.get(String(resVal.ref));
    if (ro) resVal = parseDictValue(new PdfScan(ro.body));
  }
  let parentRes: PDFValue | null = null;
  const parentVal = pageDictVal.get('Parent');
  if (isRef(parentVal)) {
    const po = db.get(String(parentVal.ref));
    if (po) {
      const pd = parseDictValue(new PdfScan(po.body));
      if (isDict(pd)) {
        const rv = pd.get('Resources');
        if (isRef(rv)) {
          const ro = db.get(String(rv.ref));
          parentRes = ro ? parseDictValue(new PdfScan(ro.body)) : null;
        } else if (isDict(rv)) parentRes = rv;
      }
    }
  }
  let resDict: Map<string, PDFValue>;
  if (isDict(resVal)) resDict = resVal;
  else if (isDict(parentRes)) resDict = parentRes;
  else return [];

  // 字体资源映射
  let fontDictVal = resDict.get('Font');
  if (!isDict(fontDictVal) && isDict(parentRes)) {
    fontDictVal = parentRes.get('Font');
  }
  const fonts = new Map<string, DecodedFont>();
  if (isDict(fontDictVal)) {
    for (const [resName, fv] of fontDictVal) {
      const ref = isRef(fv) ? fv.ref : null;
      if (ref === null) continue;
      const f = await buildDecodedFont(ref, db);
      if (f) fonts.set(resName, f);
    }
  }

  // 内容流（单个或数组，允许多层）
  let contentsVal = pageDictVal.get('Contents');
  const refList: number[] = [];
  const collectRef = (v?: PDFValue) => {
    if (isRef(v)) refList.push(v.ref);
    else if (Array.isArray(v)) v.forEach(collectRef);
  };
  collectRef(contentsVal);

  let contentLatin = '';
  for (const ref of refList) {
    const co = db.get(String(ref));
    if (!co) continue;
    const stream = await getDecodedStream(co);
    if (stream) contentLatin += bytesToLatin1(stream) + '\n';
  }
  if (!contentLatin) return [];

  // ---- 内容流状态机 ----
  const sc = new PdfScan(contentLatin);
  const pieces: { s: string; x: number; y: number }[] = [];
  const ARRAY_MARK: unique symbol = Symbol('array-mark');
  const stack: (PDFValue | typeof ARRAY_MARK)[] = [];
  let curFont: DecodedFont | null = null;
  let fontSize = 10;
  let m = [1, 0, 0, 1, 0, 0];
  let tx = 0, ty = 0;
  let leading = 0, TL = 0;

  const emit = (data: Uint8Array) => {
    if (!curFont) return;
    // 旋转/倾斜矩阵（发票监制章环形文字）直接忽略，避免污染行
    if (Math.abs(m[1]) > 0.01 || Math.abs(m[2]) > 0.01) return;
    const s = decodeWithFont(curFont, data);
    if (!s) return;
    pieces.push({ s, x: tx, y: ty });
    // 近似推进：无宽度表，按码长估算（CJK≈1em，ASCII≈0.55em）
    const hScale = Math.hypot(m[0], m[2]);
    if (curFont.gbk) {
      // GBK 混排：逐字符按宽窄估算
      for (const ch of s) {
        const code = ch.codePointAt(0) || 0;
        tx += (code < 0x80 ? fontSize * 0.55 : fontSize) * hScale;
      }
    } else {
      const perChar = curFont.codeSize === 2 ? fontSize : fontSize * 0.55;
      tx += [...s].length * perChar * hScale;
    }
  };

  while (!sc.eof()) {
    sc.skip();
    if (sc.eof()) break;
    const c0 = sc.s[sc.p];
    if (c0 === '[') { stack.push(ARRAY_MARK); sc.p++; continue; }
    if (c0 === ']') {
      const els: PDFValue[] = [];
      while (stack.length && stack[stack.length - 1] !== ARRAY_MARK) {
        els.unshift(stack.pop() as PDFValue);
      }
      if (stack.length) stack.pop(); // 移除标记
      stack.push(els);
      sc.p++;
      continue;
    }
    const before = sc.p;
    const val = parseAtom(sc, false);
    // 防御：未知 token 未推进游标时强制前进，避免死循环
    if (val === '' && sc.p === before) { sc.p++; continue; }
    if (typeof val === 'string') {
      const args = stack.splice(0) as PDFValue[];
      const num = (i: number) => (typeof args[i] === 'number' ? (args[i] as number) : 0);
      switch (val) {
        case 'BT':
          m = [1, 0, 0, 1, 0, 0]; tx = 0; ty = 0; break;
        case 'ET': break;
        case 'Tf': {
          const nameV = args[0];
          fontSize = num(1) || fontSize;
          curFont = isName(nameV) ? fonts.get(nameV.name) || null : null;
          break;
        }
        case 'Tm':
          m = [num(0), num(1), num(2), num(3), num(4), num(5)];
          tx = m[4]; ty = m[5]; break;
        case 'Td':
        case 'TD':
          if (val === 'TD') leading = -num(1);
          tx += num(0); ty += num(1); break;
        case 'TL': TL = num(0); break;
        case 'T*': ty -= leading || TL || fontSize * 1.2; break;
        case 'Tj':
          if (isBytes(args[0])) emit(args[0].bytes);
          break;
        case 'TJ': {
          const arr = args[0];
          if (Array.isArray(arr)) {
            for (const el of arr) {
              if (isBytes(el)) emit(el.bytes);
              else if (typeof el === 'number') {
                const hScale = Math.hypot(m[0], m[2]);
                tx -= (el / 1000) * fontSize * hScale;
              }
            }
          }
          break;
        }
        case "'":
          ty -= leading || TL || fontSize * 1.2;
          if (isBytes(args[0])) emit(args[0].bytes);
          break;
        case '"':
          ty -= leading || TL || fontSize * 1.2;
          if (isBytes(args[2]) ) emit(args[2].bytes);
          break;
      }
    } else {
      stack.push(val);
    }
  }
  return pieces;
}

/** 回退引擎入口：解析全部页面并按空间布局重排 */
async function extractTextFromPdfRaw(fileBytes: Uint8Array): Promise<string> {
  const db = await buildObjectDb(fileBytes);
  const pageNums = [...db]
    .filter(([, o]) => /\/Type\s*\/Page(?![s])/.test(o.body))
    .map(([n]) => parseInt(n, 10));
  let all = '';
  for (const n of pageNums) {
    const pieces = await parsePageText(n, db);
    if (pieces.length) all += layoutPositioned(pieces) + '\n';
  }
  return all;
}

/**
 * 将 PDF 文件的全部页面文本提取出来（按视觉布局重排，合并所有页）
 */
async function extractTextFromPdf(file: File): Promise<string> {
  // pdfjs 会把传入的底层 ArrayBuffer “转移”给 worker（转移后即分离不可再用），
  // 因此保留原始字节用于可能的底层回退，交给 pdfjs 的是一份独立副本。
  const fileBytes = new Uint8Array(await file.arrayBuffer());
  let primary = '';
  try {
    const pdfDoc = await pdfjsLib.getDocument({ data: fileBytes.slice(), useSystemFonts: true }).promise;
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const textContent = await page.getTextContent();
      primary += layoutTextItems(textContent.items as any) + '\n';
    }
    try { await (pdfDoc as { destroy?: () => Promise<void> }).destroy?.(); } catch { /* ignore */ }
  } catch (err) {
    console.error('pdfjs 文本提取失败，转底层解析:', err);
  }

  // 任一关键字段缺失（典型：标准 CMap 字体无 ToUnicode）→ 启用自包含回退引擎
  const hasAll =
    extractTotalAmount(primary) !== null &&
    extractInvoiceNumber(primary) !== '' &&
    extractInvoiceDate(primary) !== '';
  if (hasAll) return primary;
  try {
    const fallback = await extractTextFromPdfRaw(fileBytes);
    return fallback ? (primary ? primary + '\n' + fallback : fallback) : primary;
  } catch (err) {
    console.error('PDF 底层解析失败:', err);
    return primary;
  }
}

/**
 * Bradley 局部阈值自适应二值化（积分图加速）。
 * 专治暗背景低曝光照片：纸面 ~200、浅色小字 ~150、背景 ~28 时，全局阈值/拉伸
 * 无法同时保留浅字与压掉背景，而局部均值阈值让浅字在任意底色上稳定显影。
 * （实测：暗背景客车票照片全局拉伸后 tesseract 只能读出大号 serial，
 *  发票代码/号码/金额等小字全部"看不见"）
 */
function adaptiveBinarize(
  d: Uint8ClampedArray,
  w: number,
  h: number,
  channel: 'max' | 'green'
) {
  const gray = new Float64Array(w * h);
  for (let p = 0, i = 0; p < w * h; p++, i += 4) {
    // 与主预处理一致：max 通道下红章变浅、黑字保留，避免红章被二值化成黑噪声
    gray[p] = channel === 'green' ? d[i + 1] : Math.max(d[i], d[i + 1], d[i + 2]);
  }
  const W = w + 1;
  const integral = new Float64Array(W * (h + 1));
  for (let y = 0; y < h; y++) {
    let rowSum = 0;
    for (let x = 0; x < w; x++) {
      rowSum += gray[y * w + x];
      integral[(y + 1) * W + (x + 1)] = integral[y * W + (x + 1)] + rowSum;
    }
  }
  const half = Math.max(15, Math.round(Math.min(w, h) / 32));
  const K = 0.85; // 偏高阈值保留浅色笔画（实测 0.90 笔画过粗粘连、0.80 断笔）
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - half);
    const y1 = Math.min(h - 1, y + half);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - half);
      const x1 = Math.min(w - 1, x + half);
      const area = (x1 - x0 + 1) * (y1 - y0 + 1);
      const sum =
        integral[(y1 + 1) * W + (x1 + 1)] -
        integral[y0 * W + (x1 + 1)] -
        integral[(y1 + 1) * W + x0] +
        integral[y0 * W + x0];
      const v = gray[y * w + x] * area < sum * K ? 0 : 255;
      const i = (y * w + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = v;
    }
  }
}

/**
 * 清除票券打孔边/装订孔噪声：二值化前票边缘的成列孔洞会变黑，
 * 干扰版面分析。左右边缘带内整列暗像素占比 >60% 时将该列置白。
 */
function clearDarkEdgeColumns(d: Uint8ClampedArray, w: number, h: number) {
  const colDark = new Int32Array(w);
  let anyDark = false;
  for (let y = 0; y < h; y++) {
    const base = y * w * 4;
    for (let x = 0; x < w; x++) {
      const i = base + x * 4;
      if (Math.max(d[i], d[i + 1], d[i + 2]) < 128) {
        colDark[x]++;
        anyDark = true;
      }
    }
  }
  if (!anyDark) return;
  const bandL = Math.max(4, Math.round(w * 0.04));
  const bandR = Math.max(4, Math.round(w * 0.05));
  const th = h * 0.6;
  for (let x = 0; x < w; x++) {
    if ((x < bandL || x >= w - bandR) && colDark[x] > th) {
      for (let y = 0, i = x * 4; y < h; y++, i += w * 4) {
        d[i] = d[i + 1] = d[i + 2] = 255;
      }
    }
  }
}

/**
 * 图片预处理（OCR 前置增强），返回处理后的 dataURL：
 * 1) 旋转 angle 度（0/90/180/270，矫正横拍/倒拍的车票照片）
 * 2) 亮区自动裁剪：暗背景拍照时票面（白纸）只占画面一部分，
 *    按亮度包围盒裁掉黑边/桌面，票面文字等效放大、噪声大幅减少
 *    （实测 2843x1280 暗背景车票照片，AUTO 模式裁剪前几乎读不出任何字段）
 * 3) 缩放（裁剪区长边放大到 2880px，上限 2 倍——小字放大后识别率显著提升）
 * 4) enhance=true 时：灰度化 + 红章抑制（取三通道最大值，红章变浅、黑字保留）+ 对比度拉伸
 *    该参数组合基于真实客车票照片的 OCR 实验选定（tessdata_best + PSM3 + 放大增强）
 *    binarize='adaptive'：低曝光照片救援通道——红章掩膜（鲜红像素置白）+ 打孔边
 *    清除 + Bradley 局部阈值二值化，三者共用同一分支（实验验证的组合效果）
 */
function preprocessForOcr(
  img: HTMLImageElement,
  angle: number,
  enhance: boolean = true,
  crop: boolean = true,
  stretch: boolean = true,
  channel: 'max' | 'green' = 'green',
  region: 'full' | 'top-header' | 'top-right' | 'bottom-right' = 'full',
  binarize: boolean | 'adaptive' = false
): string {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const swap = angle === 90 || angle === 270;
  const rotW = swap ? h : w;
  const rotH = swap ? w : h;

  // 第一步：仅旋转绘制到临时画布（不缩放），用于票面亮区检测
  const rotCanvas = document.createElement('canvas');
  rotCanvas.width = Math.max(1, rotW);
  rotCanvas.height = Math.max(1, rotH);
  const rctx = rotCanvas.getContext('2d')!;
  rctx.translate(rotCanvas.width / 2, rotCanvas.height / 2);
  rctx.rotate((angle * Math.PI) / 180);
  rctx.drawImage(img, -w / 2, -h / 2);

  // 第二步：按亮度包围盒检测票面区域（亮像素=白纸/浅色印刷，暗背景被排除）
  let sx = 0;
  let sy = 0;
  let sW = rotCanvas.width;
  let sH = rotCanvas.height;
  if (crop) {
    try {
      const d = rctx.getImageData(0, 0, rotCanvas.width, rotCanvas.height).data;
      const colCnt = new Int32Array(rotCanvas.width);
      const rowCnt = new Int32Array(rotCanvas.height);
      for (let y = 0; y < rotCanvas.height; y++) {
        const base = y * rotCanvas.width * 4;
        for (let x = 0; x < rotCanvas.width; x++) {
          const i = base + x * 4;
          if (Math.max(d[i], d[i + 1], d[i + 2]) > 105) {
            colCnt[x]++;
            rowCnt[y]++;
          }
        }
      }
      const colTh = Math.max(4, Math.round(rotCanvas.height * 0.04));
      const rowTh = Math.max(4, Math.round(rotCanvas.width * 0.04));
      let minX = -1;
      let maxX = -1;
      let minY = -1;
      let maxY = -1;
      for (let x = 0; x < rotCanvas.width; x++) {
        if (colCnt[x] >= colTh) {
          if (minX < 0) minX = x;
          maxX = x;
        }
      }
      for (let y = 0; y < rotCanvas.height; y++) {
        if (rowCnt[y] >= rowTh) {
          if (minY < 0) minY = y;
          maxY = y;
        }
      }
      if (minX >= 0 && minY >= 0) {
        const bw = maxX - minX + 1;
        const bh = maxY - minY + 1;
        const areaRatio = (bw * bh) / (rotCanvas.width * rotCanvas.height);
        if (areaRatio > 0.15 && areaRatio < 0.98) {
          // 预留 5% 安全边距，避免边缘的发票代码或号码被裁切
          const mx = Math.round(bw * 0.05);
          const my = Math.round(bh * 0.05);
          sx = Math.max(0, minX - mx);
          sy = Math.max(0, minY - my);
          sW = Math.min(rotCanvas.width - sx, bw + 2 * mx);
          sH = Math.min(rotCanvas.height - sy, bh + 2 * my);
        }
      }
    } catch {
      /* 亮区检测失败按原图处理 */
    }
  }

  // 第三步：区域裁剪（定向局部增强）
  let regionX = sx, regionY = sy, regionW = sW, regionH = sH;
  if (region === 'top-header' || region === 'top-right') {
    // 顶部标题带：全宽度，顶部 38% 高度，完整包含左侧发票代码与右侧发票号码
    regionX = sx;
    regionY = sy;
    regionW = sW;
    regionH = Math.min(sH, Math.max(120, Math.floor(sH * 0.38)));
  } else if (region === 'bottom-right') {
    regionX = sx + Math.floor(sW * 0.45);
    regionY = sy + Math.floor(sH * 0.45);
    regionW = sW - Math.floor(sW * 0.45);
    regionH = sH - Math.floor(sH * 0.45);
  }

  // 第四步：缩放（合理限制长边至 2200-2400px，字符高度适中，保证毫秒级极速 OCR）
  const isRegion = region !== 'full';
  const maxSide = Math.max(regionW, regionH);
  const targetLong = isRegion ? 2400 : 2200;
  const scale = Math.min(targetLong / maxSide, 2.0);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(regionW * scale));
  canvas.height = Math.max(1, Math.round(regionH * scale));
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(rotCanvas, regionX, regionY, regionW, regionH, 0, 0, canvas.width, canvas.height);

  if (enhance) {
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imgData.data;
    if (binarize === 'adaptive') {
      clearDarkEdgeColumns(d, canvas.width, canvas.height);
      adaptiveBinarize(d, canvas.width, canvas.height, channel);
    } else {
      const totalPixels = canvas.width * canvas.height;
      const hist = new Int32Array(256);
      const grays = new Uint8Array(totalPixels);
      for (let p = 0, i = 0; p < totalPixels; p++, i += 4) {
        // 绿色通道让红印章/红字（G极低）与黑字（G亦低）在白纸（G极高）上对比度均大幅增强
        const g = channel === 'green' ? d[i + 1] : Math.max(d[i], d[i + 1], d[i + 2]);
        grays[p] = g;
        hist[g]++;
      }

      if (binarize) {
        for (let p = 0, i = 0; p < totalPixels; p++, i += 4) {
          const v = grays[p] < 200 ? 0 : 255;
          d[i] = d[i + 1] = d[i + 2] = v;
        }
      } else if (stretch) {
        // 自适应直方图分位数对比度拉伸（P3 ~ P97），自动消除各种环境光照阴影
        let p3 = 0, p97 = 255;
        let c = 0;
        const lowTh = Math.round(totalPixels * 0.03);
        const highTh = Math.round(totalPixels * 0.03);
        for (let j = 0; j < 256; j++) {
          c += hist[j];
          if (c >= lowTh) { p3 = j; break; }
        }
        c = 0;
        for (let j = 255; j >= 0; j--) {
          c += hist[j];
          if (c >= highTh) { p97 = j; break; }
        }
        const range = Math.max(25, p97 - p3);
        for (let p = 0, i = 0; p < totalPixels; p++, i += 4) {
          const g = grays[p];
          const v = g <= p3 ? 0 : g >= p97 ? 255 : Math.round(((g - p3) / range) * 255);
          d[i] = d[i + 1] = d[i + 2] = v;
        }
      } else {
        for (let p = 0, i = 0; p < totalPixels; p++, i += 4) {
          const v = grays[p];
          d[i] = d[i + 1] = d[i + 2] = v;
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }
  return canvas.toDataURL('image/jpeg', 0.92);
}

/** 加载图片，失败返回 null（调用方回退到原图直接 OCR） */
function loadImageFromUrl(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * 对 OCR 识别结果评分：中文关键词命中数 + 中文字符数 + 数字数
 */
function scoreOcrText(text: string): number {
  if (!text) return 0;
  let score = 0;
  const keywords = [
    '发票', '日期', '号码', '代码', '金额', '价税', '合计', '票价',
    '乘车', '客运', '汽车', '开票', '销售', '购买', '济南', '宁津',
    '山东', '出发', '到达', '身份证', '座', '口', '全',
  ];
  for (const kw of keywords) {
    if (text.includes(kw)) score += 1;
  }
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  score += Math.min(chineseChars / 10, 5);
  const digits = (text.match(/[0-9]/g) || []).length;
  score += Math.min(digits / 20, 3);
  return score;
}

/** 本地高速轻量模型路径（仅 3.5MB，秒级极速就绪，彻底避免国外 CDN 的 40MB 慢速下载与卡顿） */
const LOCAL_MODEL_PATH = '/tessdata';
const CDN_FALLBACK_MODEL_PATH = 'https://tessdata.projectnaptha.com/4.0.0_fast';

/** 方向扫描结果：最优角度 + 最优评分 + 各方向识别文本（非空） */
interface AngleSweepResult {
  bestAngle: number;
  bestScore: number;
  texts: string[];
}

let cachedWorkerPromise: Promise<{
  setParameters: (p: Record<string, unknown>) => Promise<unknown>;
  recognize: (url: string) => Promise<{ data: { text: string } }>;
  terminate: () => Promise<unknown>;
}> | null = null;

async function getTesseractWorker() {
  if (!cachedWorkerPromise) {
    cachedWorkerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      const langPath = typeof window !== 'undefined'
        ? new URL(LOCAL_MODEL_PATH, window.location.origin).href
        : CDN_FALLBACK_MODEL_PATH;
      return createWorker('chi_sim+eng', 1, {
        langPath,
        workerPath: new URL(tesseractWorkerUrl, window.location.origin).href,
        corePath: new URL(tesseractCoreUrl, window.location.origin).href,
        logger: () => {},
      });
    })().catch((err) => {
      console.warn('本地模型加载异常，尝试 CDN 快速模型:', err);
      cachedWorkerPromise = null;
      throw err;
    });
  }
  return cachedWorkerPromise;
}

/** 预加载 tesseract worker（弹窗打开时调用，上传时省去模型加载时间） */
export function preloadOcrWorker() {
  getTesseractWorker().catch(() => { /* ignore */ });
}

function raceTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([p, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/** 单次 recognize 超时上限（大幅缩短，避免长时间卡住） */
const RECOGNIZE_TIMEOUT_MS = 12_000;

async function sweepAngles(
  worker: {
    setParameters: (p: Record<string, unknown>) => Promise<unknown>;
    recognize: (url: string) => Promise<{ data: { text: string } }>;
  },
  img: HTMLImageElement,
  PSM: { AUTO: unknown; SINGLE_BLOCK?: unknown },
  angles: number[] = [0, 90],
  confidenceExit: number = 8,
  preprocessOpts: {
    binarize?: boolean | 'adaptive';
    channel?: 'max' | 'green';
    psm?: unknown;
    region?: 'full' | 'top-header' | 'top-right' | 'bottom-right';
    deadline?: number;
  } = {}
): Promise<AngleSweepResult> {
  await raceTimeout(
    worker.setParameters({ tessedit_pageseg_mode: preprocessOpts.psm ?? PSM.AUTO }),
    3_000,
    undefined
  );
  const texts: string[] = [];
  let bestAngle = 0;
  let bestScore = 0;
  for (const angle of angles) {
    if (preprocessOpts.deadline && Date.now() > preprocessOpts.deadline) break;
    try {
      const processedUrl = preprocessForOcr(
        img,
        angle,
        true,
        true,
        true,
        preprocessOpts.channel ?? 'green',
        preprocessOpts.region ?? 'full',
        preprocessOpts.binarize ?? false
      );
      const txt = await raceTimeout(
        worker.recognize(processedUrl).then((r) => r.data.text || ''),
        RECOGNIZE_TIMEOUT_MS,
        ''
      );
      const sc = scoreOcrText(txt);
      if (sc > bestScore) {
        bestScore = sc;
        bestAngle = angle;
      }
      if (txt) texts.push(txt);
      if (bestScore >= confidenceExit) break;
    } catch {
      // ignore
    }
  }
  return { bestAngle, bestScore, texts };
}

/**
 * 极速高精 OCR 识别流程（针对客车票及各类发票高度优化）：
 * 1) 优先使用绿色通道结合直方图自适应拉伸，完整保留黑色发票代码、红色发票号码与印章票价
 * 2) 阶段 1 首轮 0° 识别要素齐备时直接早退（通常 0.8~1.2 秒完成，保证极速体验）
 * 3) 缺失代码或号码时，毫秒级定向聚焦 top-header（全宽顶部标题带，避开表格干扰，毫秒级提取）
 * 4) 严格控制识别耗时，超高准确率与毫秒级速度兼得
 */
async function recognizeTextFromImage(
  file: File,
  onProgress?: (msg: string) => void
): Promise<string> {
  try {
    const { PSM } = await import('tesseract.js');
    const worker = await raceTimeout(getTesseractWorker(), 15_000, null);
    if (!worker) return '';

    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string || '');
      reader.readAsDataURL(file);
    });

    const img = await loadImageFromUrl(dataUrl);
    if (!img) {
      const txt = await raceTimeout(
        worker.recognize(dataUrl).then((r) => r.data.text || ''),
        RECOGNIZE_TIMEOUT_MS,
        ''
      );
      return txt;
    }

    const merged: string[] = [];
    const deadline = Date.now() + 18_000;

    // 阶段 1：首轮 0° 全图极速识别（通常 0.8 ~ 1.2 秒完成）
    onProgress?.('正在识别发票票面要素…');
    const sweep = await sweepAngles(worker, img, PSM, [0], 7, {
      channel: 'green',
      deadline,
    });
    merged.push(...sweep.texts);
    let bestAngle = sweep.bestAngle;
    let bestScore = sweep.bestScore;

    // 检查核心字段是否齐备（发票号码与价税合计齐备即可极速返回，无需等待发票代码）
    let curText = merged.join('\n');
    let curNum = extractInvoiceNumber(curText);
    let hasAmt = !!extractTotalAmount(curText) || (extractAmountFromFileName(file.name) ?? 0) > 0;

    // 关键要素齐备，直接极速返回！（秒级识别）
    if (curNum && hasAmt) {
      return curText;
    }

    // 若 0° 得分过低（竖置或倒置照片），尝试 90° 旋转校正
    if (bestScore < 4 && Date.now() < deadline) {
      onProgress?.('校正图片方向并重新识别…');
      const sweep90 = await sweepAngles(worker, img, PSM, [90], 6, {
        channel: 'green',
        deadline,
      });
      merged.push(...sweep90.texts);
      curText = merged.join('\n');
      curNum = extractInvoiceNumber(curText);
      if (sweep90.bestScore > bestScore) {
        bestAngle = sweep90.bestAngle;
        bestScore = sweep90.bestScore;
      }
    }

    // 阶段 2：若仍缺少发票号码，定向聚焦顶部标题区域（top-header）
    if (!curNum && Date.now() < deadline) {
      onProgress?.('正在聚焦识别发票号码区域…');
      const headerRegion = await sweepAngles(worker, img, PSM, [bestAngle], 99, {
        binarize: false,
        channel: 'green',
        psm: PSM.AUTO,
        region: 'top-header',
        deadline,
      });
      merged.push(...headerRegion.texts);
      curText = merged.join('\n');
      curNum = extractInvoiceNumber(curText);
    }

    // 阶段 3：若仍缺少金额（且文件名中无金额），对右下角印章票价区进行一次快速聚焦识别
    const missingAmount = !extractTotalAmount(curText) && !(extractAmountFromFileName(file.name) ?? 0);
    if (missingAmount && Date.now() < deadline) {
      onProgress?.('正在重点识别票价与金额区域…');
      const amountRegion = await sweepAngles(worker, img, PSM, [bestAngle], 99, {
        binarize: false,
        channel: 'green',
        psm: PSM.AUTO,
        region: 'bottom-right',
        deadline,
      });
      merged.push(...amountRegion.texts);
    }

    return merged.join('\n');
  } catch (err) {
    console.error('图片 OCR 识别失败:', err);
    return '';
  }
}

/** 方向检测会话级缓存：同一张发票重复预览时不重复跑 OCR */
const orientationCache = new Map<string, number>();

/** 将任意 URL 转为 data URL 以便解析 EXIF；data URL 直接返回原值 */
async function ensureDataUrl(url: string): Promise<string> {
  if (url.startsWith('data:')) return url;
  try {
    const blob = await fetch(url).then((r) => r.blob());
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string || '');
      reader.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
}

/**
 * 解析 JPEG EXIF Orientation 标记，返回浏览器 <img> 默认渲染时
 * 已"自动矫正"的顺时针角度（tag 1→0 / 6→90 / 3→180 / 8→270）。
 * 无标记或非 JPEG 返回 0（微信等渠道保存的图片通常已剥离 EXIF）。
 */
function getExifOrientationAngle(dataUrl: string): number {
  try {
    const comma = dataUrl.indexOf(',');
    const bin = atob(comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return 0; // 非 JPEG
    let i = 2;
    while (i + 4 <= bytes.length) {
      if (bytes[i] !== 0xff) break;
      const marker = bytes[i + 1];
      if (marker === 0xd9 || marker === 0xda) break; // EOI / SOS
      const segLen = (bytes[i + 2] << 8) | bytes[i + 3];
      if (marker === 0xe1) {
        const p = i + 4; // APP1 内容起点
        // 必须以 "Exif\0\0" 开头
        if (
          bytes[p] === 0x45 && bytes[p + 1] === 0x78 && bytes[p + 2] === 0x69 &&
          bytes[p + 3] === 0x66 && bytes[p + 4] === 0 && bytes[p + 5] === 0
        ) {
          const tiff = p + 6;
          const little = bytes[tiff] === 0x49; // II=小端，MM=大端
          const u16 = (o: number) =>
            little ? bytes[o] | (bytes[o + 1] << 8) : (bytes[o] << 8) | bytes[o + 1];
          const u32 = (o: number) =>
            little
              ? bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16) | (bytes[o + 3] << 24)
              : (bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3];
          const ifd = tiff + u32(tiff + 4);
          const count = u16(ifd);
          for (let k = 0; k < count; k++) {
            const e = ifd + 2 + k * 12;
            if (u16(e) === 0x0112) {
              const tag = u16(e + 8);
              return (({ 1: 0, 6: 90, 3: 180, 8: 270 } as Record<number, number>)[tag]) ?? 0;
            }
          }
        }
      }
      i += 2 + segLen;
    }
  } catch {
    /* EXIF 解析失败按 0 处理 */
  }
  return 0;
}

/**
 * 检测图片发票预览时需要额外旋转的角度（CSS rotate 值）。
 *
 * 优化后的策略（消除 OCR–EXIF 差值计算，避免误旋转）：
 * 1. EXIF 方向标记存在 → 浏览器 <img> 默认 image-orientation:from-image
 *    已自动矫正方向，直接返回 0°（无需 CSS 旋转，也无需跑 OCR）。
 * 2. 无 EXIF（微信图片已剥离标记 / JFIF-only 客车票）→ 跑 4 方向 OCR
 *    扫描（0°/90°/180°/270°），取最高得分方向；置信度过低则保持 0°。
 *
 * 旧方案的 (OCR − EXIF) 差值计算在低质量照片上曾导致 270° 误旋转，
 * 新方案信任 EXIF（浏览器标准行为可靠），仅在无 EXIF 时依赖 OCR。
 * @returns 0 / 90 / 180 / 270；检测失败返回 0
 */
export async function detectImageOrientation(imageUrl: string): Promise<number> {
  if (!imageUrl) return 0;
  const cached = orientationCache.get(imageUrl);
  if (cached !== undefined) return cached;
  let angle = 0;
  try {
    // 先尝试 EXIF：手机拍照通常携带方向标记
    const dataUrl = await ensureDataUrl(imageUrl);
    if (dataUrl) {
      const exifAngle = getExifOrientationAngle(dataUrl);
      if (exifAngle > 0) {
        // EXIF 存在 → 浏览器 <img> 已按 EXIF 自动矫正方向，无需额外 CSS 旋转
        orientationCache.set(imageUrl, 0);
        return 0;
      }
    }
    // 无 EXIF → 用 OCR 4 方向扫描判断（微信图片、JFIF-only 客车票等）
    const { PSM } = await import('tesseract.js');
    const worker = await getTesseractWorker();
    const img = await loadImageFromUrl(imageUrl);
    if (img) {
      const sweep = await sweepAngles(worker, img, PSM, [0, 90, 180, 270]);
      // 置信度保护：bestScore < 6 说明无法从像素判断方向，保持 0°
      if (sweep.bestScore >= 6) {
        angle = sweep.bestAngle;
      }
    }
  } catch (err) {
    console.warn('发票方向检测失败，按原图展示:', err);
    angle = 0;
  }
  orientationCache.set(imageUrl, angle);
  return angle;
}

/**
 * 将 OCR 数字候选串清理为纯数字：
 * 1) 剔除空格/换行等分隔符；
 * 2) 纠正常见字符混淆（O→0、I/l→1、S→5、B→8 等）
 */
function cleanDigitCandidate(raw: string): string {
  const map: Record<string, string> = {
    O: '0', o: '0', D: '0', Q: '0',
    I: '1', i: '1', l: '1', '|': '1',
    Z: '2', z: '2',
    S: '5', s: '5',
    G: '6', b: '6',
    T: '7',
    B: '8',
    g: '9', q: '9',
  };
  let out = '';
  for (const ch of raw) {
    if (ch >= '0' && ch <= '9') out += ch;
    else if (map[ch]) out += map[ch];
  }
  return out;
}

function extractAllDigitRuns(text: string): { raw: string; cleaned: string; index: number }[] {
  const runRe = /[0-9OoIlQDqbgGSsZzTB|][0-9OoIlQDqbgGSsZzTB| \t\-_]*/g;
  const runs: { raw: string; cleaned: string; index: number }[] = [];
  for (const m of text.matchAll(runRe)) {
    const raw = m[0];
    const cleaned = cleanDigitCandidate(raw);
    runs.push({ raw, cleaned, index: m.index ?? 0 });
  }
  return runs;
}

/**
 * 在文本中查找“标签 + 数字串”组合（数字与标签可在同一行或下一行）。
 * 兼容 OCR 在汉字间插入的空格，以及数字内部的空格分隔。
 */
function findLabeledDigits(text: string, label: string): string {
  const spacedLabel = label.split('').join('\\s*');
  const labelRe = new RegExp(`${spacedLabel}\\s*[:：]?\\s*`);
  const runRe = /[0-9OoIlQDqbgGSsZzTB|][0-9OoIlQDqbgGSsZzTB| \t]*/;
  const lines = text.split(/\n/);
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(labelRe);
    if (!m) continue;
    // 同行：取标签后的第一个数字串
    const rest = lines[i].slice((m.index ?? 0) + m[0].length);
    const run = rest.match(runRe);
    const digits = run ? cleanDigitCandidate(run[0]) : '';
    if (digits.length === 9 && digits.startsWith('0')) {
      return digits.slice(0, 1) + digits.slice(2);
    }
    if (digits.length >= 8) return digits;
    // 下一行整行都是数字
    if (i + 1 < lines.length && /^[0-9OoIlQDqbgGSsZzTB|\s]+$/.test(lines[i + 1])) {
      const nextDigits = cleanDigitCandidate(lines[i + 1]);
      if (nextDigits.length >= 8) return nextDigits;
    }
  }
  return '';
}

/**
 * 从识别文本中提取发票号码：
 * - 客车票/传统发票：8 位发票号码（识别红框真实发票号码，排除左上角存根号、打卡序列号如 6-04502694 或 №）
 * - 数电票：20 位数电发票号码（以 24/25/26/27 等年份开头）
 * 优先级：
 * 1) 显式标签匹配：包含“发票号码”或“发票号”（支持单行及跨行，必须含有“发票”前缀，严禁取左上角印刷序号/存根号）
 * 2) 数电票 20 位号码（以 24/25/26/27 等年份开头）
 * 3) 标签 "NO."、“No.”、“号码” 后的纯 8 位数字（排除带横杠的终端机打卡编号及日期）
 * 4) 全文 8 位独立数字候选（过滤掉日期与左上角前缀编号，优先匹配靠近发票标题后方的真实发票号）
 */
function extractInvoiceNumber(text: string): string {
  if (!text) return '';

  // 1. 严格标签匹配：包含“发票号码”或“发票号”
  const strictLabelRe = /发\s*票\s*号\s*[码玛号]?\s*[-:：_—.\s]?\s*([0-9OoIlQDqbgGSsZzTB| \t]{7,24})/i;
  const mStrict = text.match(strictLabelRe);
  if (mStrict) {
    const cleaned = cleanDigitCandidate(mStrict[1]);
    if (cleaned.length === 8 || cleaned.length === 20) return cleaned;
    for (const part of mStrict[1].trim().split(/\s+/)) {
      const c = cleanDigitCandidate(part);
      if (c.length === 8 || c.length === 20) return c;
    }
  }

  // 1b. 跨行情况：某行仅有“发票号码”，数字在下一行
  const lines = text.split(/\n+/);
  for (let i = 0; i < lines.length; i++) {
    if (/发\s*票\s*号\s*[码玛号]?/.test(lines[i])) {
      const afterMatch = lines[i].match(/发\s*票\s*号\s*[码玛号]?\s*[-:：_—.\s]?\s*([0-9OoIlQDqbgGSsZzTB| \t]{7,24})/);
      if (afterMatch) {
        const cleaned = cleanDigitCandidate(afterMatch[1]);
        if (cleaned.length === 8 || cleaned.length === 20) return cleaned;
      }
      if (i + 1 < lines.length) {
        const nextCleaned = cleanDigitCandidate(lines[i + 1]);
        if (nextCleaned.length === 8 || nextCleaned.length === 20) return nextCleaned;
      }
    }
  }

  // 2. 数电票 20 位标准号码（以 24/25/26/27 年份开头）
  const mShudian = text.match(/(?<![0-9])(2[4-9][0-9]{18})(?![0-9])/);
  if (mShudian) return mShudian[1];

  // 3. 标签 "NO." 或 "号码"（排除左上角带横杠打卡编号如 6-04502694，且排除日期）
  const noMatches = text.matchAll(/(?:[Nn][Oo][.:：\s]?|号\s*码\s*[-:：\s]?)\s*([0-9OoIlQDqbgGSsZzTB| \t]{8,20})/g);
  for (const m of noMatches) {
    const cleaned = cleanDigitCandidate(m[1]);
    if (cleaned.length === 8 || cleaned.length === 20) {
      return cleaned;
    }
  }

  // 4. 全文扫描独立 8 位候选（必须排除日期如 20240817，排除前缀带有横杠 - 或 № 的左上角打卡序号）
  const runRe = /[0-9OoIlQDqbgGSsZzTB|][0-9OoIlQDqbgGSsZzTB| \t\-_]*/g;
  const candidates8: string[] = [];
  for (const m of text.matchAll(runRe)) {
    const raw = m[0];
    const cleaned = cleanDigitCandidate(raw);
    const idx = m.index ?? 0;
    // 排除年份日期如 202[0-9]...
    if (/^202[0-9](0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])$/.test(cleaned)) continue;
    // 排除左上角带有横杠或 № 的编号（如 6-04502694 或 №04502694）
    const prefixSnippet = text.slice(Math.max(0, idx - 6), idx);
    if (/[-_№#]/.test(prefixSnippet) || raw.includes('-')) continue;

    if (cleaned.length === 8) {
      candidates8.push(cleaned);
    }
  }

  if (candidates8.length > 0) {
    return candidates8[candidates8.length - 1];
  }

  return '';
}

/**
 * 从识别文本中提取日期：
 * - 客车票（客运发票）：优先提取“乘车日期”/“发车日期”/“乘车时间”/“发车时间”/“出发日期”
 * - 电子发票（数电票/增值税发票）：优先提取“开票日期”/“填开日期”
 * 严格按照票面提取，若未识别到不自动填入当前系统时间
 */
function extractInvoiceDate(text: string, isBusTicket: boolean = false): string {
  if (!text) return '';

  const rideLabels = /(?:乘\s*车\s*日\s*期|发\s*车\s*日\s*期|乘\s*车\s*时\s*间|发\s*车\s*时\s*间|出\s*发\s*日\s*期|开\s*车\s*日\s*期|乘\s*车\s*日|发\s*车\s*日|乘\s*车|发\s*车)/;
  const invoiceLabels = /(?:开\s*票\s*日\s*期|填\s*开\s*日\s*期|开\s*票\s*日|填\s*发\s*日\s*期)/;

  const tryMatchRide = (): string => {
    const mRide = text.match(
      new RegExp(rideLabels.source + '[\\s:：_—\\-]*([0-9OoIlQD|]{2,4}[-年/._\\s][0-9OoIlQD|]{1,2}[-月/._\\s][0-9OoIlQD|]{1,2}(?:日)?)', 'i')
    );
    if (mRide) {
      const norm = normalizeDate(mRide[1]);
      if (norm) return norm;
    }
    const tableRide = text.match(
      new RegExp(rideLabels.source + '[\\s\\S]{0,60}?((?:20[23][0-9]|[23][0-9])[-_/.年\\s][0-9OoIlQD|]{1,2}[-_/.月\\s][0-9OoIlQD|]{1,2}(?:日)?)', 'i')
    );
    if (tableRide) {
      const norm = normalizeDate(tableRide[1]);
      if (norm) return norm;
    }
    const mRideDigits = text.match(
      new RegExp(rideLabels.source + '[\\s:：_—\\-]*((?:20[23][0-9]|[23][0-9])[0-9Oo]{4})', 'i')
    );
    if (mRideDigits) {
      const norm = normalizeDate(mRideDigits[1]);
      if (norm) return norm;
    }
    return '';
  };

  const tryMatchInvoice = (): string => {
    const mInv = text.match(
      new RegExp(invoiceLabels.source + '[\\s:：_—\\-]*([0-9OoIlQD|]{2,4}[-年/._\\s][0-9OoIlQD|]{1,2}[-月/._\\s][0-9OoIlQD|]{1,2}(?:日)?)', 'i')
    );
    if (mInv) {
      const norm = normalizeDate(mInv[1]);
      if (norm) return norm;
    }
    const tableInv = text.match(
      new RegExp(invoiceLabels.source + '[\\s\\S]{0,60}?((?:20[23][0-9]|[23][0-9])[-_/.年\\s][0-9OoIlQD|]{1,2}[-_/.月\\s][0-9OoIlQD|]{1,2}(?:日)?)', 'i')
    );
    if (tableInv) {
      const norm = normalizeDate(tableInv[1]);
      if (norm) return norm;
    }
    const mInvDigits = text.match(
      new RegExp(invoiceLabels.source + '[\\s:：_—\\-]*((?:20[23][0-9]|[23][0-9])[0-9Oo]{4})', 'i')
    );
    if (mInvDigits) {
      const norm = normalizeDate(mInvDigits[1]);
      if (norm) return norm;
    }
    return '';
  };

  if (isBusTicket) {
    const r = tryMatchRide();
    if (r) return r;
    const inv = tryMatchInvoice();
    if (inv) return inv;
  } else {
    const inv = tryMatchInvoice();
    if (inv) return inv;
    const r = tryMatchRide();
    if (r) return r;
  }

  // 3. 通用日期标签（如 “日期:” / “日 期”）
  const genericLabels = /(?:日\s*期)/;
  const mGen = text.match(
    new RegExp(genericLabels.source + '[\\s:：_—\\-]*([0-9OoIlQD|]{2,4}[-年/._\\s][0-9OoIlQD|]{1,2}[-月/._\\s][0-9OoIlQD|]{1,2}(?:日)?)', 'i')
  );
  if (mGen) {
    const norm = normalizeDate(mGen[1]);
    if (norm) return norm;
  }

  // 4. 全文搜索标准 4 位年份日期（2020-2039 年）
  const fullDates = text.matchAll(/(20[23][0-9])[-年/._\s](0?[1-9]|1[0-2])[-月/._\s](0?[1-9]|[12][0-9]|3[01])(?![\d])/g);
  for (const m of fullDates) {
    const norm = normalizeDate(`${m[1]}-${m[2]}-${m[3]}`);
    if (norm) return norm;
  }

  return '';
}

/** 把各种日期格式统一为 YYYY-MM-DD（支持 2 位年份转换，如 24-08-17 转为 2024-08-17，并纠正 OCR 字符混淆） */
function normalizeDate(raw: string): string {
  if (!raw) return '';
  const map: Record<string, string> = {
    O: '0', o: '0', D: '0', Q: '0',
    I: '1', i: '1', l: '1', '|': '1',
    Z: '2', z: '2',
    S: '5', s: '5',
    B: '8',
  };
  let s = '';
  for (const ch of raw.trim()) {
    if (map[ch]) s += map[ch];
    else s += ch;
  }

  // 格式 1：带分隔符（2024-08-17、2024年08月17日、2024/08/17、2024.08.17、24-08-17、24年8月17日等）
  const m = s.match(/([0-9]{2,4})[-年/\s._]([0-9]{1,2})[-月/\s._]([0-9]{1,2})(?:日)?/);
  if (m) {
    let y = m[1];
    if (y.length === 2) {
      y = '20' + y;
    }
    const mo = m[2].padStart(2, '0');
    const d = m[3].padStart(2, '0');
    const yNum = parseInt(y, 10);
    const mNum = parseInt(mo, 10);
    const dNum = parseInt(d, 10);
    if (yNum >= 2000 && yNum <= 2099 && mNum >= 1 && mNum <= 12 && dNum >= 1 && dNum <= 31) {
      return `${y}-${mo}-${d}`;
    }
  }

  // 格式 2：8 位纯数字（如 20240817、20240520）
  const m8 = s.match(/(20[23][0-9])(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])/);
  if (m8) {
    return `${m8[1]}-${m8[2]}-${m8[3]}`;
  }

  return '';
}

/**
 * 从文件名中尝试提取日期（回退用）
 */
function extractDateFromFileName(fileName: string): string {
  const nameWithoutExt = fileName.replace(/\.[^.]+$/, '');
  // YYYYMMDD
  const m1 = nameWithoutExt.match(/(20\d{2})(\d{2})(\d{2})/);
  if (m1) return `${m1[1]}-${m1[2]}-${m1[3]}`;
  // YYYY-MM-DD 或 YYYY_MM_DD
  const m2 = nameWithoutExt.match(/(20\d{2})[-_](\d{1,2})[-_](\d{1,2})/);
  if (m2) return `${m2[1]}-${m2[2].padStart(2, '0')}-${m2[3].padStart(2, '0')}`;
  return '';
}

/**
 * 离线本地 OCR / PDF 文本解析引擎：
 * - PDF：用 pdfjs 提取文本
 * - 图片：用 tesseract.js 做 OCR
 * 然后从文本中正则抽取发票号码、开票日期等核心字段
 */
export async function parseInvoiceFileOffline(
  file: File,
  readAsDataUrl: boolean = true,
  consumptionRules?: ConsumptionTypeMaster[],
  onProgress?: (msg: string) => void
): Promise<RecognizedInvoice> {
  let fileUrl = '';
  if (readAsDataUrl) {
    fileUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string || '');
      reader.readAsDataURL(file);
    });
  }

  const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type.includes('pdf');
  const sizeKb = Math.round(file.size / 1024);
  const fileSizeText = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`;

  const nameLower = file.name.toLowerCase();

  // ---- 真正从发票内容提取文本 ----
  let rawText = isPdf
    ? await extractTextFromPdf(file)
    : await recognizeTextFromImage(file, onProgress);

  const isBusTicket =
    /客运|客票|汽车票|汽车客运|公路客运|长途|大巴|乘车|发车|检票|济南总站|宁津|车站|站务|座号|班次|班车|客车/.test(rawText) ||
    /客车|汽车票|客票|大巴|客运/.test(nameLower);

  // ---- 从文本中提取发票号码（精准识别红框中的真实发票号码，严禁误取左上角存根或打卡编号） ----
  let invoiceNumber = extractInvoiceNumber(rawText);
  if (!invoiceNumber) {
    // 回退：文件名中 20 位数字
    const numMatches = file.name.match(/\d{20}/);
    invoiceNumber = numMatches ? numMatches[0] : '';
  }

  // ---- 提取日期：如果是电子发票取发票上的开票日期，如果是客车票取乘车日期 ----
  let invoiceDate = extractInvoiceDate(rawText, isBusTicket);
  if (!invoiceDate) {
    invoiceDate = extractDateFromFileName(file.name);
  }
  // 注意：未在票面或文件名中找到有效日期时保持为空，由用户核对填写，绝不自动赋当前系统时间

  // 价税合计提取优先级：
  // 1) 发票正文（“价税合计（小写）”锚点，真实票面金额）
  // 2) 文件名中携带的金额（图片型 PDF / 扫描件提取不到文本时的回退）
  // 3) 识别不到给 0，由用户手工核对填写——不再生成随机金额
  const contentAmount = extractTotalAmount(rawText);
  const fileNameAmount = extractAmountFromFileName(file.name);
  let totalAmount: number;
  let amountSource: 'content' | 'filename' | 'none';
  if (contentAmount && contentAmount > 0) {
    totalAmount = contentAmount;
    amountSource = 'content';
  } else if (fileNameAmount && fileNameAmount > 0) {
    totalAmount = fileNameAmount;
    amountSource = 'filename';
  } else {
    totalAmount = 0;
    amountSource = 'none';
  }

  // 识别税务大类与小类
  let taxMajorCategory = '生活服务';
  let taxSubCategory = '综合服务';
  let taxRate = 0.06;
  let recommendedItem = '差旅补贴';
  let transport = '出租车/网约车';

  if (nameLower.includes('餐') || nameLower.includes('饭') || nameLower.includes('食') || nameLower.includes('星巴克') || nameLower.includes('海底捞')) {
    taxMajorCategory = '餐饮住宿服务';
    taxSubCategory = '餐饮服务';
    recommendedItem = '餐饮费用';
    taxRate = 0.06;
  } else if (isBusTicket) {
    taxMajorCategory = '运输服务';
    taxSubCategory = '公路旅客运输';
    recommendedItem = '交通费用';
    transport = '城市地铁/公交';
    taxRate = 0.03;
  } else if (nameLower.includes('车') || nameLower.includes('打车') || nameLower.includes('滴滴') || nameLower.includes('高德') || nameLower.includes('交通') || nameLower.includes('客票') || nameLower.includes('铁路') || nameLower.includes('航空')) {
    taxMajorCategory = '运输服务';
    taxRate = 0.09;
    recommendedItem = '交通费用';
    if (nameLower.includes('高铁') || nameLower.includes('铁路') || nameLower.includes('火车')) {
      taxSubCategory = '铁路旅客运输';
      transport = '火车/高铁';
    } else if (nameLower.includes('航') || nameLower.includes('机票')) {
      taxSubCategory = '旅客运输服务';
      transport = '飞机/航空客运';
    } else {
      taxSubCategory = '公路旅客运输';
    }
  } else if (nameLower.includes('住') || nameLower.includes('酒店') || nameLower.includes('宾馆')) {
    taxMajorCategory = '餐饮住宿服务';
    taxSubCategory = '住宿服务';
    recommendedItem = '住宿费用';
    taxRate = 0.06;
  } else if (nameLower.includes('话费') || nameLower.includes('通讯') || nameLower.includes('电信') || nameLower.includes('移动') || nameLower.includes('联通')) {
    taxMajorCategory = '电信服务';
    taxSubCategory = '通信服务';
    recommendedItem = '通讯费用';
    taxRate = 0.06;
  } else if (nameLower.includes('办公') || nameLower.includes('文具') || nameLower.includes('纸')) {
    taxMajorCategory = '销售货物';
    taxSubCategory = '办公用品';
    recommendedItem = '办公用品';
    taxRate = 0.13;
  } else if (nameLower.includes('通行') || nameLower.includes('加油') || nameLower.includes('etc')) {
    taxMajorCategory = '现代服务/生活服务';
    taxSubCategory = '通行费/加油充电';
    recommendedItem = '交通费用';
    taxRate = 0.05;
  }

  // 利用消费类型基础档案规则匹配消费类型
  const matchResult = matchConsumptionTypeByRules(
    taxMajorCategory,
    taxSubCategory,
    isBusTicket ? '客运 汽车 交通' : nameLower,
    consumptionRules
  );
  const consumptionType = isBusTicket ? '交通' : matchResult.consumptionType;

  // 发票正文出现税率（如“6%”）时以票面为准
  const rateMatch = rawText.match(/(\d{1,2}(?:\.\d+)?)\s*%/);
  if (rateMatch) {
    const r = parseFloat(rateMatch[1]) / 100;
    if (r > 0 && r < 1) taxRate = r;
  }

  // 不含税金额/税额：优先取票面“合计”行，取不到再按税率反推
  const nt = extractNetAndTax(rawText);
  const netAmount = nt.net ?? Math.round((totalAmount / (1 + taxRate)) * 100) / 100;
  const taxAmount = nt.tax ?? Math.round((totalAmount - netAmount) * 100) / 100;

  // 销售方名称智能推断
  let sellerName = '上海企业综合管理服务商';
  if (isBusTicket) {
    sellerName = rawText.includes('交通') ? '山东省交通运输集团有限公司' : '公路客运有限公司';
  } else if (nameLower.includes('滴滴')) {
    sellerName = '滴滴出行科技有限公司';
  } else if (nameLower.includes('餐饮')) {
    sellerName = '本地餐饮品质管理服务有限公司';
  }

  return {
    invoiceNumber,
    invoiceDate,
    sellerName,
    buyerName: '测试公司C',
    totalAmount,
    netAmount,
    taxAmount,
    billType: isBusTicket ? '客运发票' : '数电票 (普通发票)',
    consumptionType,
    taxMajorCategory,
    taxSubCategory,
    recommendedExpenseItemName: recommendedItem,
    recommendedTransportName: transport,
    confidence:
      amountSource === 'content'
        ? 0.98
        : amountSource === 'filename'
          ? 0.7
          : 0.4,
    fileName: file.name,
    fileUrl,
    fileType: isPdf ? 'pdf' : 'image',
    fileSizeText,
    rawTextPreview: rawText
      ? `[OCR 识别文本]\n${rawText.slice(0, 800)}${rawText.length > 800 ? '...' : ''}`
      : `[未识别到文本，请手动核对发票号码与开票日期]\n价税合计: ¥${totalAmount.toFixed(2)}`
  };
}
