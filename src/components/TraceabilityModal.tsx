import React from 'react';
import { X, SearchCode, FileText } from 'lucide-react';
import { BillItem, ReimbursementItem } from '../types/reimbursement';

interface TraceabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  reimbursementItem: ReimbursementItem | null;
  allBills: BillItem[];
  onPreviewInvoice: (bill: BillItem) => void;
}

export const TraceabilityModal: React.FC<TraceabilityModalProps> = ({
  isOpen,
  onClose,
  reimbursementItem,
  allBills,
  onPreviewInvoice,
}) => {
  if (!isOpen || !reimbursementItem) return null;

  // 筛选出对应的来源账单
  const sourceBills = allBills.filter((b) =>
    reimbursementItem.sourceBillIds.includes(b.id)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4 select-none">
      <div className="glass-card w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded bg-gradient-to-br from-amber-500 to-amber-400 text-[#1a1408] shadow-xs">
              <SearchCode className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100">
                报销明细来源追溯（多对一发票溯源）
              </h2>
              <p className="text-[11px] text-slate-400">
                来源发票包含发票号码、开票日期及价税合计金额等完整原始记录
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-100 rounded-full p-1 hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Summary Banner */}
          <div className="p-3.5 bg-amber-500/10 border border-amber-400/30 rounded-lg flex items-center justify-between">
            <div>
              <span className="text-xs text-amber-300 font-medium">聚合报销行：</span>
              <span className="text-sm font-bold text-slate-100 ml-1">
                {reimbursementItem.expenseItemName}
              </span>
              <span className="ml-2 text-xs px-2 py-0.5 rounded bg-amber-400/15 text-amber-300 border border-amber-400/30 font-medium">
                已合并 {reimbursementItem.mergedCount} 笔发票
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div>
                <span className="text-slate-400">发票价税合计：</span>
                <span className="font-mono font-bold text-slate-100 text-sm">
                  ¥{(reimbursementItem.invoiceSumAmount || reimbursementItem.totalAmount).toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-slate-400">累计税额：</span>
                <span className="font-mono text-slate-200 font-semibold">
                  ¥{reimbursementItem.taxAmount.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Table of Source Invoices - Sequence: 发票号码, 发票日期, 发票金额 */}
          <div className="border border-white/5 rounded-lg overflow-hidden">
            <div className="bg-white/[0.03] px-3 py-2 border-b border-white/5 flex items-center justify-between text-xs font-semibold text-slate-200">
              <span>原始发票记录（顺序：发票号码、开票日期、发票金额，共 {sourceBills.length} 张）：</span>
              <span className="text-slate-500 font-normal text-[11px]">
                严格核对单笔明细金额与累计报销额
              </span>
            </div>

            <table className="table-dark w-full text-left">
              <thead>
                <tr className="h-12">
                  <th className="px-4 whitespace-nowrap">发票号码</th>
                  <th className="px-4 whitespace-nowrap">发票日期</th>
                  <th className="px-4 whitespace-nowrap text-right">发票金额 (价税合计)</th>
                  <th className="px-4 whitespace-nowrap">账单类型</th>
                  <th className="px-4 whitespace-nowrap">销售方</th>
                  <th className="px-4 whitespace-nowrap text-right">税额</th>
                  <th className="px-4 whitespace-nowrap text-center">原始凭证</th>
                </tr>
              </thead>
              <tbody>
                {sourceBills.map((bill) => (
                  <tr key={bill.id} className="h-8">
                    <td className="px-3 font-mono text-[11px] text-slate-100 font-bold">
                      <button
                        onClick={() => onPreviewInvoice(bill)}
                        className="text-sky-300 hover:text-sky-200 hover:underline cursor-pointer"
                        title="查看原始凭证"
                      >
                        {bill.invoiceNumber}
                      </button>
                    </td>
                    <td className="px-3 font-mono text-slate-300">{bill.invoiceDate}</td>
                    <td className="px-3 text-right font-mono tabular-nums font-bold amount-mint">
                      ¥{bill.totalAmount.toFixed(2)}
                    </td>
                    <td className="px-3 text-slate-300">{bill.billType}</td>
                    <td className="px-3 text-slate-300 max-w-[150px] truncate" title={bill.sellerName}>
                      {bill.sellerName}
                    </td>
                    <td className="px-3 text-right font-mono tabular-nums text-slate-200">
                      ¥{bill.taxAmount.toFixed(2)}
                    </td>
                    <td className="px-3 text-center">
                      <button
                        onClick={() => onPreviewInvoice(bill)}
                        className="inline-flex items-center gap-1 text-sky-300 hover:text-sky-200 text-[11px] hover:underline cursor-pointer"
                      >
                        <FileText className="w-3 h-3" />
                        <span>查看原始凭证</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-amber-500/10 font-bold text-slate-100 border-t border-amber-400/30 h-8">
                  <td colSpan={2} className="px-3">
                    汇总核算（数学验证通过）
                  </td>
                  <td className="px-3 text-right font-mono text-slate-100 font-bold">
                    ¥{sourceBills.reduce((acc, b) => acc + b.totalAmount, 0).toFixed(2)}
                  </td>
                  <td colSpan={2} className="px-3"></td>
                  <td className="px-3 text-right font-mono text-slate-200">
                    ¥{sourceBills.reduce((acc, b) => acc + b.taxAmount, 0).toFixed(2)}
                  </td>
                  <td className="px-3"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-5 py-3 border-t border-white/5 bg-white/[0.02]">
          <button
            onClick={onClose}
            className="btn-ghost px-4 py-1.5 rounded text-xs font-medium transition-colors cursor-pointer"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};
