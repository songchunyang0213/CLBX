import React, { useMemo, useState } from 'react';
import { X, Download, Scissors, Receipt, Plane, Loader2, ImageIcon, FileText, Printer } from 'lucide-react';
// 使用 legacy 构建：pdfjs v6 依赖 ES2025 新内置（Map.getOrInsertComputed / Promise.try，
// 仅 Chrome 140+ 支持），legacy 包内置 core-js 运行时补丁，兼容 Chrome/Edge 旧版本，
// 否则渲染 PDF 附件会抛 "getOrInsertComputed is not a function" 导致行程单空白
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';
import {
  ReimbursementForm,
  ReimbursementItem,
  BillItem,
  PersonalBillItem,
} from '../types/reimbursement';
import { CalculationResult } from '../utils/reimbursementCalculator';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface PrintSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  form: ReimbursementForm;
  reimbursementItems?: ReimbursementItem[];
  bills?: BillItem[];
  personalBills?: PersonalBillItem[];
  calculation?: CalculationResult;
}

type AttachmentInfo = {
  url?: string;
  type?: 'image' | 'pdf';
  name?: string;
};

type PrintableVoucher =
  | {
      type: 'invoice';
      id: string;
      title: string;
      invoiceNumber: string;
      invoiceDate: string;
      sellerName: string;
      buyerName: string;
      totalAmount: number;
      consumptionType: string;
      remarks?: string;
      attachmentUrl?: string;
      attachmentType?: 'image' | 'pdf';
      attachmentName?: string;
    }
  | {
      type: 'itinerary';
      id: string;
      title: string;
      passenger: string;
      departure: string;
      destination: string;
      transportName: string;
      date: string;
      totalAmount: number;
      ticketNo: string;
      attachmentUrl?: string;
      attachmentType?: 'image' | 'pdf';
      attachmentName?: string;
    };

// 判断附件是否为图片：显式标记优先，其次按 data URL 前缀兜底
function isImageAttachment(att?: AttachmentInfo): boolean {
  if (!att?.url) return false;
  if (att.type === 'image') return true;
  return att.url.startsWith('data:image/');
}

export const PrintSummaryModal: React.FC<PrintSummaryModalProps> = ({
  isOpen,
  onClose,
  form,
  reimbursementItems,
  bills,
  personalBills,
}) => {
  const [isExporting, setIsExporting] = useState(false);

  // 个人账单附件索引：历史单据若发票附件丢失，按发票号回填原件
  const personalAttachmentByInvoiceNo = useMemo(() => {
    const map = new Map<string, AttachmentInfo>();
    (personalBills || []).forEach((pb) => {
      const no = pb.invoiceNumber?.trim();
      if (no && pb.invoiceFile?.url && !map.has(no)) {
        map.set(no, {
          url: pb.invoiceFile.url,
          type: pb.invoiceFile.type,
          name: pb.invoiceFile.name,
        });
      }
    });
    return map;
  }, [personalBills]);

  // resolveAttachment：单据附件优先，缺失时从个人账单库自愈回填
  const resolveAttachment = (
    billAtt: AttachmentInfo | undefined,
    invoiceNumber?: string
  ): AttachmentInfo => {
    if (billAtt?.url) return billAtt;
    if (invoiceNumber) {
      const fallback = personalAttachmentByInvoiceNo.get(invoiceNumber.trim());
      if (fallback?.url) return fallback;
    }
    return billAtt || {};
  };

  if (!isOpen) return null;

  const resolvedItems: ReimbursementItem[] = reimbursementItems || [];
  const resolvedBills: BillItem[] = bills || form?.bills || [];

  // 1. Gather all invoices with original attachments
  const invoicesList: PrintableVoucher[] = resolvedBills.map((b) => {
    const att = resolveAttachment(b.invoiceFile, b.invoiceNumber);
    return {
      type: 'invoice',
      id: b.id,
      title: b.billType || '发票原件',
      invoiceNumber: b.invoiceNumber || '',
      invoiceDate: b.invoiceDate || form.formDate,
      sellerName: b.sellerName || '',
      buyerName: b.buyerName || '',
      totalAmount: b.totalAmount || 0,
      consumptionType: b.consumptionType || '交通',
      remarks: b.remarks,
      attachmentUrl: att.url,
      attachmentType: att.type,
      attachmentName: att.name,
    };
  });

  // 2. Gather all itineraries with original attachments
  const itinerariesList: PrintableVoucher[] = resolvedItems
    .filter(
      (item) =>
        item.itineraryAttachment ||
        (item.itineraryCount && item.itineraryCount > 0)
    )
    .map((item, idx) => ({
      type: 'itinerary' as const,
      id: item.id,
      title: '行程单',
      passenger: form.applicant || '',
      departure: item.departure || '',
      destination: item.destination || '',
      transportName: item.transportName || '',
      date: item.startDate || form.formDate,
      totalAmount: item.totalAmount || 0,
      ticketNo: item.sourceInvoiceNumbers?.[0] || `IT-${String(idx + 1).padStart(4, '0')}`,
      attachmentUrl: item.itineraryAttachment?.url,
      attachmentType: item.itineraryAttachment?.type,
      attachmentName: item.itineraryAttachment?.name,
    }));

  // Combined vouchers: invoices + itineraries, only originals
  const allVouchers: PrintableVoucher[] = [...invoicesList, ...itinerariesList];

  // Pair up vouchers into A4 pages (2 vouchers per page = 二等分)
  const a4Pages: Array<[PrintableVoucher, PrintableVoucher | null]> = [];
  for (let i = 0; i < allVouchers.length; i += 2) {
    a4Pages.push([allVouchers[i], allVouchers[i + 1] || null]);
  }

  // 导出方案（隐藏 iframe + 浏览器原生打印）：
  // 1) 在当前页面创建同源隐藏 iframe 承载打印文档 —— 不弹窗，天然绕过弹窗拦截
  // 2) PDF 附件先用 pdfjs 在主窗口渲染成高清图片 data URL
  // 3) 所有图片在主窗口预解码后写入 iframe
  // 4) 轮询确认 iframe 内图片真正加载完成后再唤起 print()，杜绝"PDF 里图片空白"
  // 5) 打印对话框由 iframe.contentWindow.print() 唤起，目标可选择"另存为 PDF"
  const handleExportPDF = async () => {
    if (isExporting) return;
    if (a4Pages.length === 0) {
      alert('当前单据没有可导出的发票或行程单');
      return;
    }

    // 清理可能残留的打印帧，避免重复
    document.getElementById('print-voucher-frame')?.remove();

    // —— 同步创建隐藏同源 iframe（用户点击上下文内，无需任何弹窗权限）——
    const iframe = document.createElement('iframe');
    iframe.id = 'print-voucher-frame';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText =
      'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none;';
    document.body.appendChild(iframe);

    const printWindow = iframe.contentWindow;
    const printDoc = iframe.contentDocument;
    if (!printWindow || !printDoc) {
      iframe.remove();
      alert('当前浏览器不支持页面内打印，请使用最新版 Chrome 或 Edge 后重试。');
      return;
    }

    setIsExporting(true);
    const failedVoucherTitles: string[] = [];
    // 打印对话框关闭后延迟回收 iframe（保留一段时间，避免打印尚未完成被销毁）
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      setTimeout(() => iframe.remove(), 30000);
    };
    printWindow.addEventListener('afterprint', cleanup, { once: true });
    setTimeout(cleanup, 120000);

    try {
      // 先给用户一个即时反馈页
      printDoc.open();
      printDoc.write(buildLoadingHtml(form.formNo));
      printDoc.close();

      // 1. 预处理所有附件：图片直接用 data URL，PDF 渲染第一页为图片
      const processedVouchers = await Promise.all(
        allVouchers.map(async (v) => {
          let imageUrl = '';
          if (v.attachmentUrl) {
            if (isImageAttachment({ url: v.attachmentUrl, type: v.attachmentType })) {
              imageUrl = v.attachmentUrl;
            } else {
              imageUrl = await renderPdfFirstPageToDataUrl(v.attachmentUrl);
              if (!imageUrl) failedVoucherTitles.push(`${v.title}(${v.type === 'invoice' ? v.invoiceNumber : v.ticketNo})`);
            }
          }
          return { voucher: v, imageUrl };
        })
      );

      // 2. 主窗口预解码所有图片（确保浏览器完成解码，打印时不等待）
      await Promise.all(
        processedVouchers
          .filter((p) => p.imageUrl)
          .map(
            (p) =>
              new Promise<void>((resolve) => {
                const img = new Image();
                img.onload = () => resolve();
                img.onerror = () => {
                  failedVoucherTitles.push(
                    `${p.voucher.title}(${p.voucher.type === 'invoice' ? p.voucher.invoiceNumber : p.voucher.ticketNo})`
                  );
                  resolve();
                };
                img.src = p.imageUrl;
              })
          )
      );

      // 3. 构造打印 HTML 并写入 iframe
      const html = buildPrintHtml(a4Pages, processedVouchers, form);
      printDoc.open();
      printDoc.write(html);
      printDoc.close();

      // 4. 等待文档与全部图片加载完毕（带超时兜底）
      await waitForDocumentReady(printWindow, 30000);
      const { total, failed } = await waitForImagesLoaded(printWindow, 30000);
      // 给布局/字体留一帧稳定时间
      await new Promise((r) => setTimeout(r, 250));

      // 5. 唤起浏览器打印对话框（目标可选择"另存为 PDF"）
      printWindow.focus();
      printWindow.print();

      if (failed > 0 || failedVoucherTitles.length > 0) {
        const names = Array.from(new Set(failedVoucherTitles)).slice(0, 5).join('、');
        alert(
          `共 ${total} 张附件图片，${failed + failedVoucherTitles.length} 张加载失败。\n失败凭证：${names}\n失败联次显示为占位，请检查附件后重新导出。`
        );
      }
    } catch (err) {
      console.error('打印导出失败:', err);
      iframe.remove();
      alert('打印导出失败，请重试或检查发票附件是否有效。');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-2 sm:p-4 select-none">
      <div className="glass-card w-full max-w-5xl overflow-hidden flex flex-col max-h-[96vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Top Header Bar */}
        <div className="flex flex-wrap items-center justify-between px-5 py-3 border-b border-white/5 bg-white/[0.02] gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-rose-500 to-rose-400 text-white shadow-xs">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>导出发票及行程单 (A4 二等分)</span>
                <span className="text-[11px] font-mono text-slate-400 font-normal">
                  ({form.formNo})
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                仅包含本单据上传的发票原图与行程单附件，每页 A4 排布 2 联，方便裁剪粘贴
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportPDF}
              disabled={isExporting || a4Pages.length === 0}
              className="btn-danger flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="打开浏览器打印窗口，可直接打印或选择另存为 PDF"
            >
              {isExporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Printer className="w-3.5 h-3.5" />
              )}
              <span>{isExporting ? '正在准备打印...' : '打印 / 导出 PDF'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-100 rounded-full p-1.5 hover:bg-white/5 cursor-pointer ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Info Banner */}
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-2.5 bg-white/[0.02] text-xs">
          <div className="flex items-center gap-2">
            <Scissors className="w-3.5 h-3.5 text-rose-400" />
            <span className="font-semibold text-slate-100">A4 二等分裁剪版</span>
            <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 text-[11px] font-mono border border-rose-400/30">
              共 {allVouchers.length} 联凭证 · {a4Pages.length} 页 A4
            </span>
          </div>
          <div className="text-[11px] text-slate-500 hidden sm:block">
            点击"打印 / 导出 PDF"后在打印窗口选择"另存为 PDF"即可保存
          </div>
        </div>

        {/* Content Viewport */}
        <div className="p-4 sm:p-6 overflow-y-auto bg-ink-950/60 flex-1 flex justify-center">
          <div
            id="printable-a4-vouchers-container"
            className="w-full flex flex-col items-center gap-6"
          >
            {a4Pages.length === 0 ? (
              <div className="glass-card p-12 text-center text-slate-400">
                <Receipt className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>当前单据尚未录入任何发票或行程单</p>
              </div>
            ) : (
              a4Pages.map((page, pageIdx) => {
                const topItem = page[0];
                const bottomItem = page[1];

                return (
                  <div
                    key={`page-${pageIdx}`}
                    className="a4-sheet-container bg-white shadow-md border border-slate-300 w-full max-w-[794px] h-[1123px] flex flex-col justify-between p-6 box-border relative overflow-hidden"
                    style={{
                      width: '794px',
                      height: '1123px',
                      minHeight: '1123px',
                      maxHeight: '1123px',
                    }}
                  >
                    {/* Top Header Badge */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pb-2 border-b border-slate-100">
                      <span>
                        报销单据号: <strong className="text-slate-700">{form.formNo}</strong> · 申请人: {form.applicant}
                      </span>
                      <span>
                        A4 二等分凭证联 · 第 {pageIdx + 1} 页 / 共 {a4Pages.length} 页
                      </span>
                    </div>

                    {/* Upper Half */}
                    <div className="flex-1 flex flex-col justify-center py-2 overflow-hidden">
                      <VoucherCard item={topItem} index={pageIdx * 2 + 1} form={form} />
                    </div>

                    {/* Middle Cut Line */}
                    <div className="my-2 relative flex items-center justify-center">
                      <div className="w-full border-t-2 border-dashed border-slate-400"></div>
                      <div className="absolute bg-white px-3 text-[11px] text-slate-500 font-medium flex items-center gap-1.5 shadow-2xs border border-slate-200 rounded-full">
                        <Scissors className="w-3.5 h-3.5 text-slate-600" />
                        <span>沿虚线裁剪（财务报销凭单粘贴联 · 1/2 A4）</span>
                      </div>
                    </div>

                    {/* Lower Half */}
                    <div className="flex-1 flex flex-col justify-center py-2 overflow-hidden">
                      {bottomItem ? (
                        <VoucherCard item={bottomItem} index={pageIdx * 2 + 2} form={form} />
                      ) : (
                        <div className="h-full border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                          <Scissors className="w-6 h-6 mb-2 text-slate-300" />
                          <p className="text-xs font-medium">（本联留空 · A4 下半联空白，裁切后可做其他发票粘贴备用）</p>
                          <p className="text-[11px] text-slate-400 mt-1">单据编号: {form.formNo}</p>
                        </div>
                      )}
                    </div>

                    {/* Bottom Footer */}
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-2 border-t border-slate-100">
                      <span>导出日期: {new Date().toLocaleDateString('zh-CN')}</span>
                      <span>财务报销归档联 · 报销专用</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Sub-component: A5 Half-Page Voucher Card (original attachment only)
interface VoucherCardProps {
  item: PrintableVoucher;
  index: number;
  form: ReimbursementForm;
}

const VoucherCard: React.FC<VoucherCardProps> = ({ item, index, form }) => {
  const isInvoice = item.type === 'invoice';
  const hasAttachment = Boolean(item.attachmentUrl);
  const showAsImage = isImageAttachment({
    url: item.attachmentUrl,
    type: item.attachmentType,
  });

  return (
    <div className="border-2 border-slate-300 rounded p-4 bg-white flex flex-col h-[470px] box-border relative font-sans text-slate-800">
      {/* Voucher Header Bar */}
      <div className="flex items-start justify-between border-b pb-2 border-slate-200 shrink-0">
        <div className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded flex items-center justify-center text-white shrink-0 ${
              isInvoice ? 'bg-red-700' : 'bg-blue-700'
            }`}
          >
            {isInvoice ? <Receipt className="w-4 h-4" /> : <Plane className="w-4 h-4" />}
          </div>
          <div>
            <h4
              className={`text-sm font-bold tracking-wider ${
                isInvoice ? 'text-red-800' : 'text-blue-800'
              }`}
            >
              {item.title}
            </h4>
            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
              <span>凭单联次: 第 {index} 联</span> · <span>所属单据: {form.formNo}</span>
            </div>
          </div>
        </div>

        <div className="text-right font-mono">
          <div className="text-xs text-slate-500">
            {isInvoice ? '发票号码' : '行程单号'}:
          </div>
          <div className="text-sm font-bold text-slate-900 tracking-wider">
            {isInvoice ? item.invoiceNumber : item.ticketNo}
          </div>
        </div>
      </div>

      {/* Main Body: original attachment or placeholder */}
      <div className="my-2 flex-1 flex flex-col items-center justify-center border border-slate-200 rounded p-2 bg-slate-50 overflow-hidden">
        {hasAttachment ? (
          showAsImage ? (
            <img
              src={item.attachmentUrl}
              alt={item.attachmentName || '凭证附件'}
              className="max-h-[310px] object-contain rounded border border-slate-200 bg-white"
            />
          ) : (
            <iframe
              src={item.attachmentUrl}
              title={item.attachmentName || '凭证附件'}
              className="w-full h-[310px] border-0 rounded bg-white"
            />
          )
        ) : (
          <div className="flex flex-col items-center justify-center text-slate-400">
            {isInvoice ? <ImageIcon className="w-10 h-10 mb-2 opacity-40" /> : <FileText className="w-10 h-10 mb-2 opacity-40" />}
            <p className="text-xs font-medium">未上传{isInvoice ? '发票' : '行程单'}原件</p>
            <p className="text-[11px] text-slate-400 mt-1">请在单据中补传原件后再导出</p>
          </div>
        )}
      </div>

      {/* Voucher Filing Footer */}
      <div className="border-t border-slate-200 pt-2 flex items-center justify-between text-[11px] text-slate-500 font-mono shrink-0">
        <div className="flex items-center gap-3">
          <span>
            报销人员: <strong className="text-slate-800 font-sans">{form.applicant}</strong>
          </span>
          <span>开票/行程日期: {isInvoice ? item.invoiceDate : item.date}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
            财务报销粘贴联
          </span>
          <span className="font-bold text-slate-800">¥{item.totalAmount.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
};

// ---------- 打印窗口渲染辅助函数 ----------

// 将 base64 data URL 解码为 Uint8Array，供 pdfjs 直接读取
function decodeDataUrlToUint8Array(dataUrl: string): Uint8Array {
  const commaIdx = dataUrl.indexOf(',');
  const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
  const binaryStr = atob(base64);
  const len = binaryStr.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes;
}

// 用 pdfjs（v6 API）渲染 PDF 第一页为高清 JPEG data URL，供打印窗口的 <img> 使用
async function renderPdfFirstPageToDataUrl(dataUrl: string): Promise<string> {
  try {
    const data = decodeDataUrlToUint8Array(dataUrl);
    const pdfDoc = await pdfjsLib.getDocument({ data, useSystemFonts: true }).promise;
    const page = await pdfDoc.getPage(1);
    // 2 倍缩放保证 A4 打印清晰度
    const outputScale = 2;
    const viewport = page.getViewport({ scale: outputScale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    // pdfjs v6：只需传 canvas（内部自动 getContext('2d', {alpha:false})）
    await page.render({ canvas, viewport }).promise;
    const result = canvas.toDataURL('image/jpeg', 0.92);
    // 释放文档资源（legacy 打包互操作下 destroy 可能不存在，失败可忽略，不影响已取得的图片）
    try {
      await (pdfDoc as { destroy?: () => Promise<void> }).destroy?.();
    } catch {
      // ignore
    }
    return result;
  } catch (err) {
    console.error('PDF 渲染失败:', err);
    return '';
  }
}

// 等待打印窗口文档解析完成
function waitForDocumentReady(win: Window, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      const ready = win.document?.readyState;
      if (ready === 'complete' || ready === 'interactive') {
        resolve();
        return;
      }
      if (Date.now() - start > timeoutMs) {
        resolve();
        return;
      }
      setTimeout(tick, 60);
    };
    tick();
  });
}

// 等待打印窗口内所有图片真正加载完成（complete && naturalWidth>0）
function waitForImagesLoaded(
  win: Window,
  timeoutMs: number
): Promise<{ total: number; failed: number }> {
  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      const images = win.document?.images ? Array.from(win.document.images) : [];
      const settled = images.every((img) => img.complete);
      const elapsed = Date.now() - start;

      if (settled || elapsed > timeoutMs) {
        const failed = images.filter((img) => !img.complete || img.naturalWidth === 0).length;
        resolve({ total: images.length, failed });
        return;
      }
      setTimeout(tick, 120);
    };
    tick();
  });
}

type ProcessedVoucher = {
  voucher: PrintableVoucher;
  imageUrl: string;
};

// 点击后立即展示的加载页（同步写入，避免用户看到白屏）
function buildLoadingHtml(formNo: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<title>${formNo}_发票及行程单_A4二等分</title>
<style>
  html,body{margin:0;padding:0;height:100%;background:#f1f5f9;
    font-family:-apple-system,BlinkMacSystemFont,'Microsoft YaHei','Segoe UI',sans-serif;}
  .wrap{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#475569;gap:14px;}
  .spin{width:38px;height:38px;border:4px solid #cbd5e1;border-top-color:#dc2626;border-radius:50%;animation:sp 0.9s linear infinite;}
  @keyframes sp{to{transform:rotate(360deg);}}
  .t{font-size:14px;font-weight:600;}
  .s{font-size:12px;color:#94a3b8;}
</style>
</head>
<body>
  <div class="wrap">
    <div class="spin"></div>
    <div class="t">正在准备发票及行程单原件…</div>
    <div class="s">完成后将自动弹出打印窗口，请在其中选择"另存为 PDF"</div>
  </div>
</body>
</html>`;
}

// 构造打印窗口的完整 HTML：精确 A4 纵向、每页二等分，附件原图以 <img> 内嵌
function buildPrintHtml(
  a4Pages: Array<[PrintableVoucher, PrintableVoucher | null]>,
  processed: ProcessedVoucher[],
  form: ReimbursementForm
): string {
  const today = new Date().toLocaleDateString('zh-CN');

  const pagesHtml = a4Pages
    .map((page, pageIdx) => {
      const top = page[0];
      const bottom = page[1];
      const topIdx = pageIdx * 2 + 1;
      const bottomIdx = pageIdx * 2 + 2;
      const topHtml = renderVoucherHtml(top, processed, form, topIdx);
      const bottomHtml = bottom
        ? renderVoucherHtml(bottom, processed, form, bottomIdx)
        : `<div class="voucher empty"><div class="empty-body">（本联留空 · A4 下半联空白，裁切后可做其他发票粘贴备用）</div></div>`;

      return `
        <div class="a4-page">
          <div class="page-header">
            <span>报销单据号: <strong>${form.formNo}</strong> · 申请人: ${form.applicant}</span>
            <span>A4 二等分凭证联 · 第 ${pageIdx + 1} 页 / 共 ${a4Pages.length} 页</span>
          </div>
          ${topHtml}
          <div class="cut-line">
            <span class="cut-label">✂ 沿虚线裁剪（财务报销凭单粘贴联 · 1/2 A4）</span>
          </div>
          ${bottomHtml}
          <div class="page-footer">
            <span>导出日期: ${today}</span>
            <span>财务报销归档联 · 报销专用</span>
          </div>
        </div>
      `;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${form.formNo}_发票及行程单_A4二等分</title>
  <style>
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html, body {
      margin: 0; padding: 0; background: #fff; color: #1e293b;
      font-family: -apple-system, BlinkMacSystemFont, 'Microsoft YaHei', 'Segoe UI', sans-serif;
    }
    /* 精确 A4：210mm x 297mm，页内留白 6mm，每页严格一张纸，杜绝溢出到空白页 */
    html, body { height: 100%; margin: 0; padding: 0; }
    .a4-page {
      width: 210mm;
      height: 297mm;
      max-height: 297mm;
      padding: 6mm;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: #fff;
      page-break-after: always;
      break-after: page;
    }
    .a4-page:last-child { page-break-after: auto; break-after: auto; }
    .page-header {
      flex: 0 0 auto;
      display: flex; justify-content: space-between;
      font-size: 8pt; color: #64748b;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 1.5mm; margin-bottom: 2mm;
    }
    .voucher {
      flex: 1 1 0;
      min-height: 0;
      max-height: 100%;
      border: 1px solid #94a3b8; border-radius: 2px;
      padding: 2.5mm; display: flex; flex-direction: column;
      overflow: hidden;
    }
    .voucher.empty { background: #f8fafc; border-style: dashed; }
    .empty-body {
      flex: 1; display: flex; align-items: center; justify-content: center;
      text-align: center; color: #94a3b8; font-size: 10pt;
    }
    .voucher-header {
      flex: 0 0 auto;
      display: flex; justify-content: space-between; align-items: flex-start;
      border-bottom: 1px solid #cbd5e1; padding-bottom: 1.5mm; margin-bottom: 2mm;
      gap: 2mm;
    }
    .voucher-title { font-size: 11pt; font-weight: bold; }
    .voucher-title.invoice { color: #b91c1c; }
    .voucher-title.itinerary { color: #1d4ed8; }
    .voucher-subtitle {
      font-size: 7pt; color: #64748b; font-family: monospace; margin-top: 0.5mm;
    }
    .voucher-number-label {
      font-size: 7pt; color: #64748b; text-align: right;
    }
    .voucher-number {
      font-size: 9pt; font-weight: bold; font-family: monospace; color: #0f172a;
      letter-spacing: 0.3px;
      word-break: break-all;
      overflow-wrap: anywhere;
      max-width: 55mm;
      text-align: right;
      line-height: 1.2;
    }
    .voucher-body {
      flex: 1 1 0;
      min-height: 0;
      height: 0;
      display: flex; align-items: center; justify-content: center;
      padding: 1.5mm; background: #fff; border: 1px solid #e2e8f0;
      border-radius: 2px; overflow: hidden;
    }
    .voucher-body img {
      display: block;
      max-width: 100%;
      max-height: 100%;
      width: auto;
      height: auto;
      object-fit: contain;
      flex-shrink: 1;
    }
    .voucher-placeholder {
      text-align: center; color: #94a3b8; font-size: 9pt;
    }
    .voucher-placeholder-icon { font-size: 22pt; margin-bottom: 2mm; }
    .voucher-footer {
      flex: 0 0 auto;
      display: flex; justify-content: space-between; align-items: center;
      border-top: 1px solid #cbd5e1; padding-top: 1.5mm; margin-top: 2mm;
      font-size: 8pt; color: #64748b; font-family: monospace;
      gap: 2mm;
    }
    .voucher-amount {
      font-size: 11pt; font-weight: bold; color: #0f172a;
      white-space: nowrap;
    }
    .cut-line {
      flex: 0 0 auto;
      text-align: center; position: relative;
      border-top: 1px dashed #94a3b8;
      padding: 1.5mm 0; margin: 2mm 0;
    }
    .cut-label {
      background: #fff; padding: 0 2mm;
      font-size: 8pt; color: #64748b;
    }
    .page-footer {
      flex: 0 0 auto;
      display: flex; justify-content: space-between;
      font-size: 7pt; color: #64748b;
      padding-top: 1.5mm; border-top: 1px solid #e2e8f0;
      margin-top: 2mm;
    }
    /* 屏幕预览时给页面加阴影灰底；打印时纯白 */
    @media screen {
      body { background: #e2e8f0; padding: 12px; }
      .a4-page { margin: 0 auto 12px; box-shadow: 0 4px 18px rgba(15,23,42,.18); }
    }
    @media print {
      body { background: #fff; padding: 0; }
      .a4-page { margin: 0; box-shadow: none; }
    }
  </style>
</head>
<body>
  ${pagesHtml}
</body>
</html>`;
}

// 渲染单个凭证的 HTML
function renderVoucherHtml(
  voucher: PrintableVoucher,
  processed: ProcessedVoucher[],
  form: ReimbursementForm,
  index: number
): string {
  const data = processed.find((p) => p.voucher.id === voucher.id);
  const isInvoice = voucher.type === 'invoice';
  const title = voucher.title;
  const number = isInvoice ? voucher.invoiceNumber : voucher.ticketNo;
  const date = isInvoice ? voucher.invoiceDate : voucher.date;
  const amount = voucher.totalAmount || 0;
  const imageUrl = data?.imageUrl;

  const bodyContent = imageUrl
    ? `<img src="${imageUrl}" alt="${voucher.attachmentName || '凭证附件'}" />`
    : `<div class="voucher-placeholder">
         <div class="voucher-placeholder-icon">${isInvoice ? '📄' : '✈'}</div>
         <div>未上传${isInvoice ? '发票' : '行程单'}原件</div>
         <div style="font-size: 8pt; margin-top: 1mm;">请在单据中补传原件后再导出</div>
       </div>`;

  return `
    <div class="voucher">
      <div class="voucher-header">
        <div>
          <div class="voucher-title ${isInvoice ? 'invoice' : 'itinerary'}">${title}</div>
          <div class="voucher-subtitle">凭单联次: 第 ${index} 联 · 所属单据: ${form.formNo}</div>
        </div>
        <div>
          <div class="voucher-number-label">${isInvoice ? '发票号码' : '行程单号'}</div>
          <div class="voucher-number">${number}</div>
        </div>
      </div>
      <div class="voucher-body">${bodyContent}</div>
      <div class="voucher-footer">
        <span>报销人员: ${form.applicant} · 开票/行程日期: ${date}</span>
        <span class="voucher-amount">¥${amount.toFixed(2)}</span>
      </div>
    </div>
  `;
}
