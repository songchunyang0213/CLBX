import React, { useEffect, useState } from 'react';
import { X, Eye, ImageIcon, FileText, RotateCw } from 'lucide-react';
import { BillItem } from '../types/reimbursement';

interface InvoicePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  bill: BillItem | null;
}

export const InvoicePreviewModal: React.FC<InvoicePreviewModalProps> = ({
  isOpen,
  onClose,
  bill,
}) => {
  // 附件信息（bill 可能为 null，需在 early return 前安全取值以满足 Hooks 规则）
  const imageUrl = bill?.invoiceFile?.url || '';
  const hasAttachment = Boolean(imageUrl);
  const isImage =
    hasAttachment &&
    (bill?.invoiceFile?.type === 'image' || imageUrl.startsWith('data:image'));

  // rotation: 手动旋转角度（0/90/180/270），每次点击 +90°
  const [rotation, setRotation] = useState(0);

  // 弹窗打开 / 切换发票时：重置旋转角度
  useEffect(() => {
    if (isOpen) setRotation(0);
  }, [isOpen, imageUrl]);

  if (!isOpen || !bill) return null;

  const handleManualRotate = () => setRotation((r) => (r + 90) % 360);
  const isSideways = rotation === 90 || rotation === 270;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4">
      <div className="glass-card w-full max-w-4xl overflow-hidden flex flex-col max-h-[95vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded bg-gradient-to-br from-sky-400 to-indigo-500 text-white shadow-xs">
              <Eye className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">发票原件预览</h3>
              <p className="text-[11px] text-slate-400">
                可点击旋转按钮调整发票方向
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

        {/* Original attachment preview */}
        <div className="flex-1 overflow-y-auto bg-ink-950/60 p-4 flex flex-col items-center">
          {hasAttachment ? (
            <div className="w-full bg-white rounded border border-slate-200 shadow-sm">
              <div className="px-4 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">上传发票原件</span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500 font-mono truncate max-w-[240px]">
                    {bill.invoiceFile?.name}
                  </span>
                  {isImage && (
                    <button
                      type="button"
                      onClick={handleManualRotate}
                      title="手动旋转 90°"
                      className="flex items-center gap-1 px-2 py-0.5 text-[11px] text-slate-600 hover:text-sky-600 border border-slate-300 hover:border-sky-400 rounded bg-white transition-colors cursor-pointer"
                    >
                      <RotateCw className="w-3 h-3" />
                      旋转
                    </button>
                  )}
                </div>
              </div>
              {/*
               * 旋转时容器保持固定高度 + overflow-auto，图片在容器内旋转。
               * 不再用 isSideways 切换 max-w/max-h——那会导致外框尺寸跳变、
               * 旋转后的图片被 overflow-hidden 裁切。改为统一约束 + 滚动兜底。
               */}
              <div className="flex items-center justify-center bg-slate-100 overflow-auto min-h-[300px] max-h-[75vh] p-2">
                {isImage ? (
                  <img
                    src={imageUrl}
                    alt={bill.invoiceFile?.name || '发票原件'}
                    style={{
                      transform: `rotate(${rotation}deg)`,
                      imageOrientation: 'from-image',
                    }}
                    className="object-contain rounded border border-slate-200 bg-white transition-transform duration-300 max-h-[70vh] max-w-full"
                  />
                ) : (
                  <iframe
                    src={imageUrl}
                    title={bill.invoiceFile?.name || '发票原件'}
                    className="w-full h-[70vh] border-0 rounded bg-white"
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="glass-card p-12 text-center text-slate-400">
              {bill.billType?.includes('pdf') ? (
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
              ) : (
                <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-40" />
              )}
              <p className="text-sm font-medium text-slate-300">未上传发票原件</p>
              <p className="text-xs text-slate-500 mt-1">该账单暂无附件，仅保存了结构化信息</p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-white/5 bg-white/[0.02]">
          <span className="text-xs text-slate-400">
            发票号码：<strong className="text-slate-100 font-mono">{bill.invoiceNumber}</strong>
            <span className="mx-2">|</span>
            价税合计：<strong className="font-mono amount-mint">¥{bill.totalAmount.toFixed(2)}</strong>
            <span className="mx-2">|</span>
            费用项目：<strong className="text-slate-100">{bill.expenseItemName}</strong>
          </span>
          <button
            onClick={onClose}
            className="btn-ghost px-4 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer"
          >
            关闭预览
          </button>
        </div>
      </div>
    </div>
  );
};
