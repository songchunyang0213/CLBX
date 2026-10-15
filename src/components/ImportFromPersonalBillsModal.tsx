import React, { useState, useMemo, useEffect } from 'react';
import { X, FolderInput, Folder, Search, Check, ShieldCheck, AlertCircle } from 'lucide-react';
import { PersonalBillItem, PersonalBillFolder } from '../types/reimbursement';

interface ImportFromPersonalBillsModalProps {
  isOpen: boolean;
  onClose: () => void;
  personalBills: PersonalBillItem[];
  folders: PersonalBillFolder[];
  existingBillNumbers?: string[]; // Already added in the current form
  allReferencedInvoiceNumbers?: string[]; // Referenced across other forms
  onImport?: (selectedBills: PersonalBillItem[]) => void;
  onConfirmImport?: (selectedBills: PersonalBillItem[]) => void;
  onNavigateToPersonalBills?: () => void;
}

export const ImportFromPersonalBillsModal: React.FC<ImportFromPersonalBillsModalProps> = ({
  isOpen,
  onClose,
  personalBills = [],
  folders = [],
  existingBillNumbers = [],
  allReferencedInvoiceNumbers = [],
  onImport,
  onConfirmImport,
  onNavigateToPersonalBills,
}) => {
  const [selectedFolderId, setSelectedFolderId] = useState<string>('all');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Collect all blocked/referenced invoice numbers
  const referencedSet = useMemo(() => {
    const set = new Set<string>();
    (allReferencedInvoiceNumbers || []).forEach((n) => {
      if (n) set.add(n.trim());
    });
    (existingBillNumbers || []).forEach((n) => {
      if (n) set.add(n.trim());
    });
    return set;
  }, [allReferencedInvoiceNumbers, existingBillNumbers]);

  // Filter bills: strictly exclude any bill that has already been referenced or reimbursed
  const filteredBills = useMemo(() => {
    return (personalBills || []).filter((bill) => {
      // 1. Exclude if already marked as reimbursed in personal bills
      if (bill.isReimbursed || bill.reimbursedFormNo) {
        return false;
      }
      // 2. Exclude if referenced by any form or current form
      if (bill.invoiceNumber && referencedSet.has(bill.invoiceNumber.trim())) {
        return false;
      }
      // 3. Folder filter
      if (selectedFolderId !== 'all') {
        if (selectedFolderId === 'ungrouped') {
          if (bill.folderId) return false;
        } else if (bill.folderId !== selectedFolderId) {
          return false;
        }
      }
      // 4. Keyword search
      if (searchKeyword.trim()) {
        const kw = searchKeyword.toLowerCase();
        const matchNo = bill.invoiceNumber?.toLowerCase().includes(kw);
        const matchSeller = bill.sellerName?.toLowerCase().includes(kw);
        const matchRemark = bill.remarks?.toLowerCase().includes(kw);
        if (!matchNo && !matchSeller && !matchRemark) return false;
      }
      return true;
    });
  }, [personalBills, referencedSet, selectedFolderId, searchKeyword]);

  // 切换文件夹或搜索关键字后，把选中集合收敛到当前可见列表内，
  // 避免用户在看不见的发票上"静默"导入
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.length === 0) return prev;
      const visibleIdSet = new Set(filteredBills.map((b) => b.id));
      const next = prev.filter((id) => visibleIdSet.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [filteredBills]);

  if (!isOpen) return null;

  const isAllSelected =
    filteredBills.length > 0 && filteredBills.every((b) => selectedIds.includes(b.id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredBills.map((b) => b.id));
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const selectedBills = (personalBills || []).filter((b) => selectedIds.includes(b.id));
  const selectedTotalAmount = selectedBills.reduce((acc, b) => acc + (b.totalAmount || 0), 0);

  const handleConfirm = () => {
    if (selectedBills.length === 0) return;
    if (onImport) {
      onImport(selectedBills);
    } else if (onConfirmImport) {
      onConfirmImport(selectedBills);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4 select-none">
      <div className="glass-card w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded bg-gradient-to-br from-indigo-500 to-indigo-400 text-white shadow-xs">
              <FolderInput className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100">从发票账单中添加发票</h2>
              <p className="text-[11px] text-slate-400">
                勾选已事先在发票账单中采集或分类的发票，一键批量导入当前差旅报销单
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-100 rounded-full p-1 hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Bar */}
        <div className="px-5 py-2.5 bg-white/[0.02] border-b border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium">所属文件夹:</span>
            <select
              value={selectedFolderId}
              onChange={(e) => setSelectedFolderId(e.target.value)}
              className="input-dark px-2.5 py-1 text-xs"
            >
              <option value="all">全部文件夹 ({(personalBills || []).length} 张)</option>
              {(folders || []).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({(personalBills || []).filter((b) => b.folderId === f.id).length})
                </option>
              ))}
              <option value="ungrouped">未分组发票</option>
            </select>

            <div className="flex items-center gap-1.5 ml-3 px-2 py-0.5 bg-emerald-400/10 text-emerald-300 border border-emerald-400/30 rounded text-[11px] font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>已自动过滤已被引用的发票 (仅展示可报销发票)</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <input
                type="text"
                placeholder="搜索发票号、销售方、备注..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="input-dark w-52 pl-7 pr-2 py-1 text-xs"
              />
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2 top-2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-auto p-5">
          {filteredBills.length === 0 ? (
            <div className="py-16 text-center text-slate-500">
              <p className="text-xs">暂无可导入的发票</p>
              {onNavigateToPersonalBills && (
                <button
                  onClick={() => {
                    onClose();
                    onNavigateToPersonalBills();
                  }}
                  className="mt-2 text-sky-300 hover:text-sky-200 text-xs font-medium underline"
                >
                  前往发票账单添加发票 &rarr;
                </button>
              )}
            </div>
          ) : (
            <div className="border border-white/5 rounded overflow-hidden shadow-2xs">
              <table className="table-dark w-full text-left">
                <thead>
                  <tr className="h-12">
                    <th className="w-10 px-4 text-center whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={toggleSelectAll}
                        className="cb-dark"
                      />
                    </th>
                    <th className="px-4 whitespace-nowrap">发票号码</th>
                    <th className="px-4 whitespace-nowrap">开票日期</th>
                    <th className="px-4 whitespace-nowrap">归属文件夹</th>
                    <th className="px-4 whitespace-nowrap">消费类型</th>
                    <th className="px-4 whitespace-nowrap">销售方</th>
                    <th className="px-4 whitespace-nowrap text-right">价税合计</th>
                    <th className="px-4 whitespace-nowrap text-center">报销状态</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBills.map((bill) => {
                    const isSelected = selectedIds.includes(bill.id);
                    const folder = (folders || []).find((f) => f.id === bill.folderId);
                    return (
                      <tr
                        key={bill.id}
                        onClick={() => toggleSelectRow(bill.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'row-active font-medium' : ''
                        }`}
                      >
                        <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectRow(bill.id)}
                            className="cb-dark"
                          />
                        </td>
                        <td className="px-3 py-2 font-mono font-bold text-slate-100">
                          {bill.invoiceNumber}
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-300">{bill.invoiceDate}</td>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/5 text-slate-300 text-[11px] border border-white/5">
                            <Folder className="w-2.5 h-2.5 text-sky-300" />
                            <span>{folder?.name || '未分组'}</span>
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-300">{bill.consumptionType}</td>
                        <td className="px-3 py-2 truncate max-w-[180px] text-slate-300">
                          {bill.sellerName}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-bold amount-mint">
                          ¥{bill.totalAmount.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {bill.isReimbursed ? (
                            <span className="badge badge-slate">
                              已在单据中
                            </span>
                          ) : (
                            <span className="badge badge-mint">
                              待报销
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer Summary & Confirm */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-white/5 bg-white/[0.02]">
          <div className="text-xs text-slate-300 flex items-center gap-3">
            <span>
              已选择 <strong className="text-sky-300 text-sm font-bold">{selectedIds.length}</strong> 张发票
            </span>
            <span>
              所选合计金额：<strong className="amount-flame text-sm font-bold font-mono">¥{selectedTotalAmount.toFixed(2)}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="btn-ghost px-4 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedIds.length === 0}
              className={`flex items-center gap-1 px-5 py-1.5 rounded text-xs font-semibold shadow-xs transition-colors ${
                selectedIds.length > 0
                  ? 'btn-primary cursor-pointer'
                  : 'bg-slate-700/60 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
              <span>导入当前报销单 ({selectedIds.length})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
