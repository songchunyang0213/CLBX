import React, { useState, useMemo } from 'react';
import {
  Folder,
  FolderPlus,
  Plus,
  Trash2,
  Edit2,
  Search,
  Eye,
  CheckCircle2,
  Clock,
  ArrowRight,
  Receipt,
  Layers,
  ChevronRight,
  MoreVertical,
  Check,
  MoveRight,
  X,
  AlertTriangle,
} from 'lucide-react';
import {
  PersonalBillFolder,
  PersonalBillItem,
  BillItem,
  ExpenseItemMaster,
  TransportMaster,
  ProjectMaster,
  ReimbursementForm,
} from '../types/reimbursement';
import { AddBillModal } from './AddBillModal';
import { InvoicePreviewModal } from './InvoicePreviewModal';

interface PersonalBillsViewProps {
  personalBills: PersonalBillItem[];
  setPersonalBills: React.Dispatch<React.SetStateAction<PersonalBillItem[]>>;
  folders: PersonalBillFolder[];
  setFolders: React.Dispatch<React.SetStateAction<PersonalBillFolder[]>>;
  expenseMasters: ExpenseItemMaster[];
  transportMasters: TransportMaster[];
  projectMasters: ProjectMaster[];
  onImportToActiveForm: (bills: PersonalBillItem[]) => void;
  onNavigateToForm: () => void;
  formsList: ReimbursementForm[];
}

export const PersonalBillsView: React.FC<PersonalBillsViewProps> = ({
  personalBills,
  setPersonalBills,
  folders,
  setFolders,
  expenseMasters,
  transportMasters,
  projectMasters,
  onImportToActiveForm,
  onNavigateToForm,
  formsList,
}) => {
  const [activeFolderId, setActiveFolderId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unreimbursed' | 'reimbursed'>('all');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modals & States
  const [isAddBillOpen, setIsAddBillOpen] = useState(false);
  const [previewBill, setPreviewBill] = useState<BillItem | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [targetMoveFolderId, setTargetMoveFolderId] = useState<string>('');

  // Editing folder name
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState<string>('');

  // Editing consumption type inline
  const [editingConsumptionBillId, setEditingConsumptionBillId] = useState<string | null>(null);
  const CONSUMPTION_TYPE_OPTIONS = ['替票', '交通', '住宿'];

  // Compute stats
  const totalBillsCount = personalBills.length;
  const unreimbursedCount = personalBills.filter((b) => !b.isReimbursed).length;
  const reimbursedCount = personalBills.filter((b) => b.isReimbursed).length;
  const unreimbursedAmount = personalBills
    .filter((b) => !b.isReimbursed)
    .reduce((sum, b) => sum + (b.totalAmount || 0), 0);

  // Filter bills
  const filteredBills = useMemo(() => {
    return personalBills.filter((bill) => {
      // Folder filter
      if (activeFolderId === 'unreimbursed_quick') {
        if (bill.isReimbursed) return false;
      } else if (activeFolderId === 'reimbursed_quick') {
        if (!bill.isReimbursed) return false;
      } else if (activeFolderId === 'ungrouped') {
        if (bill.folderId) return false;
      } else if (activeFolderId !== 'all') {
        if (bill.folderId !== activeFolderId) return false;
      }

      // Status filter
      if (statusFilter === 'unreimbursed' && bill.isReimbursed) return false;
      if (statusFilter === 'reimbursed' && !bill.isReimbursed) return false;

      // Keyword filter
      if (searchKeyword.trim()) {
        const kw = searchKeyword.toLowerCase();
        const m1 = bill.invoiceNumber.toLowerCase().includes(kw);
        const m2 = bill.sellerName?.toLowerCase().includes(kw);
        const m3 = bill.remarks?.toLowerCase().includes(kw);
        const m4 = bill.consumptionType?.toLowerCase().includes(kw);
        if (!m1 && !m2 && !m3 && !m4) return false;
      }

      return true;
    });
  }, [personalBills, activeFolderId, statusFilter, searchKeyword]);

  // Handle new folder creation
  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;
    const newFolder: PersonalBillFolder = {
      id: `f-${Date.now()}`,
      name: newFolderName.trim(),
      color: '#3b82f6',
      createdAt: new Date().toISOString().split('T')[0],
    };
    setFolders((prev) => [...prev, newFolder]);
    setNewFolderName('');
    setIsCreatingFolder(false);
    setActiveFolderId(newFolder.id);
  };

  // Handle folder rename
  const handleRenameFolder = (folderId: string) => {
    if (!editingFolderName.trim()) {
      setEditingFolderId(null);
      return;
    }
    setFolders((prev) =>
      prev.map((f) => (f.id === folderId ? { ...f, name: editingFolderName.trim() } : f))
    );
    setPersonalBills((prev) =>
      prev.map((b) =>
        b.folderId === folderId ? { ...b, folderName: editingFolderName.trim() } : b
      )
    );
    setEditingFolderId(null);
  };

  // Handle folder deletion
  const handleDeleteFolder = (folderId: string) => {
    const targetFolder = folders.find((f) => f.id === folderId);
    if (!confirm(`确认删除文件夹【${targetFolder?.name}】？该文件夹下的发票将移至“未分组”。`)) {
      return;
    }
    setFolders((prev) => prev.filter((f) => f.id !== folderId));
    setPersonalBills((prev) =>
      prev.map((b) => (b.folderId === folderId ? { ...b, folderId: undefined, folderName: undefined } : b))
    );
    if (activeFolderId === folderId) {
      setActiveFolderId('all');
    }
  };

  // State for duplicate invoice manual confirmation
  const [duplicateConfirm, setDuplicateConfirm] = useState<{
    newBill: Omit<BillItem, 'id' | 'orderNo' | 'createdAt'>;
    existingBill: PersonalBillItem;
  } | null>(null);

  // Handle collecting new bill from AddBillModal
  const handleAddBillToPersonal = (
    newBillData: Omit<BillItem, 'id' | 'orderNo' | 'createdAt'>
  ) => {
    // 校验重复发票：再次采集发票如果重复需人工确认是否添加
    const trimmedNo = newBillData.invoiceNumber?.trim();
    if (trimmedNo) {
      const existing = personalBills.find(
        (b) => b.invoiceNumber && b.invoiceNumber.trim() === trimmedNo
      );
      if (existing) {
        // 发现重复，保存待确认数据并打开人工确认对话框
        setDuplicateConfirm({
          newBill: newBillData,
          existingBill: existing,
        });
        return;
      }
    }

    // 无重复则直接保存
    confirmAddBillToPersonal(newBillData);
  };

  const confirmAddBillToPersonal = (
    newBillData: Omit<BillItem, 'id' | 'orderNo' | 'createdAt'>
  ) => {
    const currentFolder = folders.find((f) => f.id === activeFolderId);
    const newPersonalBill: PersonalBillItem = {
      ...newBillData,
      id: `pb-${Date.now()}`,
      orderNo: personalBills.length + 1,
      folderId: currentFolder ? currentFolder.id : undefined,
      folderName: currentFolder ? currentFolder.name : undefined,
      createdAt: new Date().toLocaleString('zh-CN', { hour12: false }),
      isReimbursed: false,
    };

    setPersonalBills((prev) => [newPersonalBill, ...prev]);
    setDuplicateConfirm(null);
  };

  // Handle batch move
  const handleConfirmBatchMove = () => {
    if (selectedIds.length === 0) return;
    const targetFolder = folders.find((f) => f.id === targetMoveFolderId);
    setPersonalBills((prev) =>
      prev.map((b) => {
        if (selectedIds.includes(b.id)) {
          return {
            ...b,
            folderId: targetFolder?.id,
            folderName: targetFolder?.name,
          };
        }
        return b;
      })
    );
    setIsMoveModalOpen(false);
    setSelectedIds([]);
  };

  // 勾稽关系：检查个人账单发票是否已被报销单据引用
  const checkBillInUse = (invoiceNumber: string): { inUse: boolean; formNos: string[] } => {
    const formNos: string[] = [];
    formsList.forEach((f) => {
      if (f.bills?.some((b) => b.invoiceNumber?.trim() === invoiceNumber.trim())) {
        formNos.push(f.formNo);
      }
    });
    return { inUse: formNos.length > 0, formNos };
  };

  // Handle batch delete
  const handleDeleteSelectedBills = () => {
    if (selectedIds.length === 0) return;
    // 勾稽校验：被报销单引用的发票不允许删除
    const billsToDelete = personalBills.filter((b) => selectedIds.includes(b.id));
    const blocked = billsToDelete
      .map((b) => ({ bill: b, check: checkBillInUse(b.invoiceNumber) }))
      .filter((x) => x.check.inUse);
    if (blocked.length > 0) {
      const detail = blocked
        .map((x) => `发票 ${x.bill.invoiceNumber} 已被单据 ${x.check.formNos.join('、')} 引用`)
        .join('\n');
      alert(`以下发票已被报销单据引用，不可删除：\n${detail}`);
      return;
    }
    if (!confirm(`确定删除选中的 ${selectedIds.length} 张个人发票吗？`)) return;
    setPersonalBills((prev) => prev.filter((b) => !selectedIds.includes(b.id)));
    setSelectedIds([]);
  };

  // Batch import selected to active form
  const handleBatchImportToForm = () => {
    const toImport = personalBills.filter(
      (b) => selectedIds.includes(b.id) && !b.isReimbursed
    );
    if (toImport.length === 0) {
      alert('请勾选待报销的发票！');
      return;
    }
    onImportToActiveForm(toImport);
    setSelectedIds([]);
    onNavigateToForm();
  };

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

  const currentFolder = folders.find((f) => f.id === activeFolderId);

  return (
    <div className="flex h-full bg-[#070b16] select-none">
      {/* 1. Left Folder Navigator */}
      <aside className="w-64 bg-[#0d1424] border-r border-white/[0.06] flex flex-col shrink-0">
        {/* Top Header */}
        <div className="p-4 border-b border-white/[0.06]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
              <Folder className="w-4 h-4 text-sky-300" />
              <span>发票账单与发票夹</span>
            </h2>
            <button
              onClick={() => setIsCreatingFolder(true)}
              className="p-1 text-sky-300 hover:bg-sky-500/10 rounded text-xs flex items-center gap-0.5 cursor-pointer font-medium"
              title="新建发票分组文件夹"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>新建文件夹</span>
            </button>
          </div>

          {/* Quick stats banner */}
          <div className="bg-sky-500/10 rounded-lg p-2.5 border border-sky-500/30 text-xs">
            <div className="text-slate-400 text-[11px]">待报销总额</div>
            <div className="text-base font-bold font-mono text-slate-50">
              ¥{unreimbursedAmount.toFixed(2)}
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>待报销: {unreimbursedCount} 张</span>
              <span>已报销: {reimbursedCount} 张</span>
            </div>
          </div>
        </div>

        {/* Folder List Scroll Area */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1 text-xs">
          {/* Virtual system views */}
          <button
            onClick={() => setActiveFolderId('all')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-md font-medium transition-colors cursor-pointer ${
              activeFolderId === 'all'
                ? 'bg-gradient-to-r from-sky-500 to-indigo-500 text-white shadow-2xs'
                : 'text-slate-300 hover:bg-white/[0.04]'
            }`}
          >
            <div className="flex items-center gap-2">
              <Layers className="w-3.5 h-3.5" />
              <span>全部发票</span>
            </div>
            <span
              className={`font-mono text-[11px] px-1.5 py-0.2 rounded-full ${
                activeFolderId === 'all' ? 'bg-white/20 text-white' : 'bg-white/10 text-slate-400'
              }`}
            >
              {totalBillsCount}
            </span>
          </button>

          <button
            onClick={() => setActiveFolderId('unreimbursed_quick')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-md font-medium transition-colors cursor-pointer ${
              activeFolderId === 'unreimbursed_quick'
                ? 'bg-gradient-to-r from-emerald-500 to-emerald-400 text-white shadow-2xs'
                : 'text-slate-300 hover:bg-white/[0.04]'
            }`}
          >
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-emerald-300" />
              <span>待报销发票</span>
            </div>
            <span
              className={`font-mono text-[11px] px-1.5 py-0.2 rounded-full ${
                activeFolderId === 'unreimbursed_quick'
                  ? 'bg-white/20 text-white'
                  : 'bg-emerald-500/15 text-emerald-300'
              }`}
            >
              {unreimbursedCount}
            </span>
          </button>

          <button
            onClick={() => setActiveFolderId('reimbursed_quick')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-md font-medium transition-colors cursor-pointer ${
              activeFolderId === 'reimbursed_quick'
                ? 'bg-gradient-to-r from-slate-600 to-slate-500 text-white shadow-2xs'
                : 'text-slate-300 hover:bg-white/[0.04]'
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-sky-300" />
              <span>已报销归档</span>
            </div>
            <span
              className={`font-mono text-[11px] px-1.5 py-0.2 rounded-full ${
                activeFolderId === 'reimbursed_quick'
                  ? 'bg-white/20 text-white'
                  : 'bg-white/10 text-slate-400'
              }`}
            >
              {reimbursedCount}
            </span>
          </button>

          {/* Section Divider */}
          <div className="pt-3 pb-1 px-1 flex items-center justify-between text-[11px] font-bold text-slate-400">
            <span>我的文件夹 / 发票分组</span>
            <span>{folders.length} 个</span>
          </div>

          {/* New folder inline input */}
          {isCreatingFolder && (
            <div className="p-2 border border-sky-500/30 bg-sky-500/10 rounded-md space-y-2">
              <input
                type="text"
                autoFocus
                placeholder="输入文件夹名称，如：9月北京出差"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateFolder();
                  if (e.key === 'Escape') setIsCreatingFolder(false);
                }}
                className="input-dark w-full px-2 py-1 text-xs rounded"
              />
              <div className="flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsCreatingFolder(false)}
                  className="px-2 py-0.5 text-[11px] text-slate-400 hover:bg-white/5 rounded"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleCreateFolder}
                  className="btn-primary px-2 py-0.5 text-[11px] font-medium rounded"
                >
                  创建
                </button>
              </div>
            </div>
          )}

          {/* Custom Folders */}
          {folders.map((folder) => {
            const count = personalBills.filter((b) => b.folderId === folder.id).length;
            const isEditing = editingFolderId === folder.id;
            const isActive = activeFolderId === folder.id;

            return (
              <div
                key={folder.id}
                className={`group flex items-center justify-between px-2.5 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-sky-500 to-indigo-500 text-white shadow-2xs'
                    : 'text-slate-300 hover:bg-white/[0.04]'
                }`}
                onClick={() => !isEditing && setActiveFolderId(folder.id)}
              >
                {isEditing ? (
                  <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      value={editingFolderName}
                      onChange={(e) => setEditingFolderName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameFolder(folder.id);
                        if (e.key === 'Escape') setEditingFolderId(null);
                      }}
                      className="input-dark w-full px-1.5 py-0.5 text-xs rounded"
                    />
                    <button
                      onClick={() => handleRenameFolder(folder.id)}
                      className="btn-mint p-1 rounded text-[10px]"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 truncate">
                      <Folder className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-sky-300'}`} />
                      <span className="truncate">{folder.name}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <span
                        className={`font-mono text-[10px] px-1.5 py-0.2 rounded-full ${
                          isActive ? 'bg-white/20 text-white' : 'bg-white/10 text-slate-400'
                        }`}
                      >
                        {count}
                      </span>

                      {/* Folder Actions (hover) */}
                      <div
                        className={`items-center gap-0.5 hidden group-hover:flex ${
                          isActive ? 'text-white' : 'text-slate-400'
                        }`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => {
                            setEditingFolderId(folder.id);
                            setEditingFolderName(folder.name);
                          }}
                          className="p-0.5 hover:text-sky-300 rounded"
                          title="重命名"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteFolder(folder.id)}
                          className="p-0.5 hover:text-rose-300 rounded"
                          title="删除文件夹"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}

          <button
            onClick={() => setActiveFolderId('ungrouped')}
            className={`w-full flex items-center justify-between px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
              activeFolderId === 'ungrouped'
                ? 'bg-gradient-to-r from-sky-500 to-indigo-500 text-white shadow-2xs'
                : 'text-slate-300 hover:bg-white/[0.04]'
            }`}
          >
            <div className="flex items-center gap-2">
              <Folder className="w-3.5 h-3.5 text-slate-400" />
              <span>未分组发票</span>
            </div>
            <span
              className={`font-mono text-[10px] px-1.5 py-0.2 rounded-full ${
                activeFolderId === 'ungrouped'
                  ? 'bg-white/20 text-white'
                  : 'bg-white/10 text-slate-400'
              }`}
            >
              {personalBills.filter((b) => !b.folderId).length}
            </span>
          </button>
        </div>

        {/* Bottom shortcut: Go to reimbursement form */}
        <div className="p-3 border-t border-white/[0.06] bg-white/[0.02]">
          <button
            onClick={onNavigateToForm}
            className="btn-primary w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-md shadow-xs transition-colors cursor-pointer"
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>进入差旅报销工作台</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </aside>

      {/* 2. Right Main Bills Table Area */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#0a0e1a]">
        {/* Top bar */}
        <div className="p-4 border-b border-white/[0.06] flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-100">
                {activeFolderId === 'all'
                  ? '全部个人发票'
                  : activeFolderId === 'unreimbursed_quick'
                  ? '待报销发票'
                  : activeFolderId === 'reimbursed_quick'
                  ? '已报销归档'
                  : activeFolderId === 'ungrouped'
                  ? '未分组发票'
                  : currentFolder?.name || '文件夹明细'}
              </h1>
              <span className="text-xs text-slate-400 font-normal">
                共 {filteredBills.length} 张发票 · 金额合计 ¥
                {filteredBills.reduce((acc, b) => acc + (b.totalAmount || 0), 0).toFixed(2)}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              可以在此处事先采集和归类发票，稍后在报销单中一键导入添加
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAddBillOpen(true)}
              className="btn-primary flex items-center gap-1 px-3.5 py-1.5 text-white text-xs font-semibold rounded shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>采集发票 / 上传账单</span>
            </button>

            {selectedIds.length > 0 && (
              <>
                <button
                  onClick={() => setIsMoveModalOpen(true)}
                  className="btn-ghost flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded shadow-2xs transition-colors cursor-pointer"
                >
                  <Folder className="w-3.5 h-3.5 text-sky-300" />
                  <span>移入文件夹 ({selectedIds.length})</span>
                </button>

                <button
                  onClick={handleBatchImportToForm}
                  className="btn-mint flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded shadow-2xs transition-colors cursor-pointer"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>导入当前报销单</span>
                </button>

                <button
                  onClick={handleDeleteSelectedBills}
                  className="text-rose-300 bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/30 text-xs font-medium rounded shadow-2xs transition-colors cursor-pointer flex items-center gap-1 px-3 py-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>删除</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="px-4 py-2 border-b border-white/[0.06] bg-white/[0.02] flex items-center justify-between text-xs">
          <div className="flex items-center gap-1 bg-white/[0.04] p-0.5 rounded">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-white/[0.08] font-bold text-slate-100 shadow-2xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              全部状态
            </button>
            <button
              onClick={() => setStatusFilter('unreimbursed')}
              className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${
                statusFilter === 'unreimbursed'
                  ? 'bg-white/[0.08] font-bold text-emerald-300 shadow-2xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              待报销
            </button>
            <button
              onClick={() => setStatusFilter('reimbursed')}
              className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${
                statusFilter === 'reimbursed'
                  ? 'bg-white/[0.08] font-bold text-sky-300 shadow-2xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              已报销
            </button>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
            <input
              type="text"
              placeholder="搜索发票号、销方或备注..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="input-dark search-input-pad pr-3 py-1 rounded text-xs w-64"
            />
          </div>
        </div>

        {/* Bills Table */}
        <div className="flex-1 overflow-y-auto">
          {filteredBills.length === 0 ? null : (
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-[#0a0e1a] border-b border-white/[0.1] text-slate-300 font-semibold sticky top-0 z-10">
                <tr className="h-12">
                  <th className="w-10 px-4 text-left whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={toggleSelectAll}
                      className="cb-dark"
                    />
                  </th>
                  <th className="px-4 whitespace-nowrap">发票号码</th>
                  <th className="px-4 whitespace-nowrap">开票日期</th>
                  <th className="px-4 whitespace-nowrap">消费类型</th>
                  <th className="px-4 whitespace-nowrap">所属文件夹</th>
                  <th className="px-4 whitespace-nowrap">销售方公司</th>
                  <th className="px-4 whitespace-nowrap text-left">价税合计</th>
                  <th className="px-4 whitespace-nowrap text-left">报销状态</th>
                  <th className="px-4 whitespace-nowrap text-left">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04] font-sans text-slate-200 text-sm">
                {filteredBills.map((bill) => {
                  const isSelected = selectedIds.includes(bill.id);
                  const folder = folders.find((f) => f.id === bill.folderId);
                  return (
                    <tr
                      key={bill.id}
                      onClick={() => toggleSelectRow(bill.id)}
                      className={`h-14 hover:bg-sky-500/5 cursor-pointer transition-colors ${
                        isSelected ? 'bg-sky-500/10 font-medium' : ''
                      }`}
                    >
                      <td className="px-4 py-2.5 text-left" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectRow(bill.id)}
                          className="cb-dark"
                        />
                      </td>
                      <td className="px-4 py-2.5 font-mono font-bold text-slate-100">
                        {bill.invoiceNumber}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-slate-400">{bill.invoiceDate}</td>
                      <td
                        className="px-4 py-2.5"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingConsumptionBillId(bill.id);
                        }}
                      >
                        {editingConsumptionBillId === bill.id ? (
                          <select
                            autoFocus
                            ref={(el) => {
                              // 挂载即展开下拉菜单：点击文字一次就能直接选择，无需再点第二次
                              const picker = el as
                                | (HTMLSelectElement & { showPicker?: () => void })
                                | null;
                              if (picker && typeof picker.showPicker === 'function') {
                                try {
                                  picker.showPicker();
                                } catch {
                                  /* 个别浏览器/非用户手势下不支持自动展开时，再点一次即可 */
                                }
                              }
                            }}
                            value={bill.consumptionType || '交通'}
                            onChange={(e) => {
                              setPersonalBills((prev) =>
                                prev.map((b) =>
                                  b.id === bill.id ? { ...b, consumptionType: e.target.value } : b
                                )
                              );
                              setEditingConsumptionBillId(null);
                            }}
                            onBlur={() => setEditingConsumptionBillId(null)}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') {
                                e.preventDefault();
                                setEditingConsumptionBillId(null);
                              }
                            }}
                            className="w-[80px] h-6 px-1 rounded text-xs text-center text-slate-200 bg-white/[0.06] border border-white/10 cursor-pointer whitespace-nowrap appearance-none [-webkit-appearance:none] focus:outline-none focus:border-cyan-400/60"
                          >
                            {CONSUMPTION_TYPE_OPTIONS.map((type) => (
                              <option key={type} value={type}>
                                {type}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span
                            className="flex justify-center items-center w-[80px] h-6 px-2 py-0 rounded bg-white/[0.05] text-slate-300 text-xs cursor-pointer hover:bg-sky-500/10 hover:text-sky-300 transition-colors whitespace-nowrap overflow-hidden"
                            title="单击修改消费类型"
                          >
                            {bill.consumptionType || '交通'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={bill.folderId || ''}
                          onChange={(e) => {
                            const newFid = e.target.value;
                            const newF = folders.find((f) => f.id === newFid);
                            setPersonalBills((prev) =>
                              prev.map((b) =>
                                b.id === bill.id
                                  ? { ...b, folderId: newF?.id, folderName: newF?.name }
                                  : b
                              )
                            );
                          }}
                          className="bg-transparent hover:bg-white/[0.04] border border-transparent hover:border-white/10 rounded px-1.5 py-0.5 text-xs text-slate-300 cursor-pointer"
                        >
                          <option value="">未分组</option>
                          {folders.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2.5 truncate max-w-[200px] text-slate-400">
                        {bill.sellerName}
                      </td>
                      <td className="px-4 py-2.5 text-left font-mono font-bold amount-mint">
                        ¥{bill.totalAmount.toFixed(2)}
                      </td>
                      <td className="px-4 py-2.5 text-left">
                        {bill.isReimbursed ? (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigateToForm();
                            }}
                            className="badge badge-mint inline-flex items-center gap-1 px-2 py-0.5 rounded cursor-pointer"
                            title="点击查看此报销单"
                          >
                            已报销 · {bill.reimbursedFormNo || 'TERB'}
                          </span>
                        ) : (
                          <span className="badge badge-flame inline-flex items-center px-2 py-0.5 rounded text-[11px]">
                            待报销
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-left" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-start gap-1">
                          <button
                            onClick={() => setPreviewBill(bill)}
                            className="p-1 text-slate-400 hover:text-sky-300 hover:bg-sky-500/10 rounded transition-colors"
                            title="预览发票原件"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              const { inUse, formNos } = checkBillInUse(bill.invoiceNumber);
                              if (inUse) {
                                alert(`发票【${bill.invoiceNumber}】已被报销单据 ${formNos.join('、')} 引用，不可删除！\n如需删除，请先从对应报销单中移除该发票。`);
                                return;
                              }
                              if (confirm(`确认删除发票【${bill.invoiceNumber}】？`)) {
                                setPersonalBills((prev) => prev.filter((b) => b.id !== bill.id));
                              }
                            }}
                            className="p-1 text-slate-500 hover:text-rose-300 hover:bg-rose-500/10 rounded transition-colors"
                            title="删除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* Add Bill Modal */}
      <AddBillModal
        isOpen={isAddBillOpen}
        onClose={() => setIsAddBillOpen(false)}
        onAddBill={handleAddBillToPersonal}
        expenseMasters={expenseMasters}
        transportMasters={transportMasters}
        projectMasters={projectMasters}
      />

      {/* Invoice spec preview */}
      <InvoicePreviewModal
        isOpen={!!previewBill}
        onClose={() => setPreviewBill(null)}
        bill={previewBill}
      />

      {/* Batch move modal */}
      {isMoveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-[#0d1424] rounded-lg shadow-xl border border-white/[0.06] w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-4 py-3 border-b border-white/[0.06] bg-white/[0.02] flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-100">
                移入文件夹（已选 {selectedIds.length} 张）
              </h3>
              <button
                onClick={() => setIsMoveModalOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3 text-xs">
              <label className="block text-slate-300 font-medium">选择目标文件夹：</label>
              <select
                value={targetMoveFolderId}
                onChange={(e) => setTargetMoveFolderId(e.target.value)}
                className="input-dark w-full rounded px-2.5 py-1.5 text-xs"
              >
                <option value="">移出文件夹 (设为未分组)</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="px-4 py-2.5 border-t border-white/[0.06] bg-white/[0.02] flex justify-end gap-2 text-xs">
              <button
                onClick={() => setIsMoveModalOpen(false)}
                className="btn-ghost px-3 py-1 rounded"
              >
                取消
              </button>
              <button
                onClick={handleConfirmBatchMove}
                className="btn-primary px-4 py-1 font-medium rounded"
              >
                确认移动
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Invoice Manual Confirmation Dialog */}
      {duplicateConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 select-none animate-in fade-in duration-150">
          <div className="bg-[#0d1424] rounded-lg shadow-2xl border border-white/[0.06] w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-5 py-3.5 border-b border-amber-500/30 bg-amber-500/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-full bg-amber-500 text-white shadow-xs">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">
                    发票重复采集提醒 (需人工确认)
                  </h3>
                  <p className="text-[11px] text-amber-300">
                    系统检测到发票号码在发票账单中已存在
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDuplicateConfirm(null)}
                className="text-slate-400 hover:text-slate-200 rounded p-1 hover:bg-white/5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-slate-300 leading-relaxed">
                <p className="font-semibold text-amber-200 mb-1">
                  发票号码：<span className="font-mono text-slate-100 text-sm font-bold">{duplicateConfirm.newBill.invoiceNumber}</span>
                </p>
                <p className="text-[11px] text-slate-400">
                  为避免重复入账与报销风险，系统已拦截此重复发票采集。请核对下方发票详情，人工确认是否仍要重复添加：
                </p>
              </div>

              {/* Comparison cards */}
              <div className="grid grid-cols-2 gap-3">
                {/* Existing invoice */}
                <div className="p-3 rounded-lg border border-white/[0.06] bg-white/[0.02] space-y-1.5">
                  <div className="flex items-center justify-between pb-1 border-b border-white/[0.06]">
                    <span className="font-bold text-slate-200">已有发票记录</span>
                    <span
                      className={`badge ${
                        duplicateConfirm.existingBill.isReimbursed ? 'badge-iris' : 'badge-mint'
                      }`}
                    >
                      {duplicateConfirm.existingBill.isReimbursed ? '已报销' : '待报销'}
                    </span>
                  </div>
                  <div className="text-[11px] space-y-1 text-slate-400">
                    <p>
                      <span className="text-slate-400">价税合计：</span>
                      <span className="font-bold text-slate-100 font-mono">
                        ¥{duplicateConfirm.existingBill.totalAmount.toFixed(2)}
                      </span>
                    </p>
                    <p>
                      <span className="text-slate-400">开票日期：</span>
                      {duplicateConfirm.existingBill.invoiceDate}
                    </p>
                    <p>
                      <span className="text-slate-400">消费类型：</span>
                      {duplicateConfirm.existingBill.consumptionType}
                    </p>
                    <p className="truncate" title={duplicateConfirm.existingBill.sellerName}>
                      <span className="text-slate-400">销售方：</span>
                      {duplicateConfirm.existingBill.sellerName}
                    </p>
                    <p>
                      <span className="text-slate-400">所在文件夹：</span>
                      {duplicateConfirm.existingBill.folderName || '未分组'}
                    </p>
                  </div>
                </div>

                {/* New invoice to add */}
                <div className="p-3 rounded-lg border border-sky-500/30 bg-sky-500/10 space-y-1.5">
                  <div className="flex items-center justify-between pb-1 border-b border-sky-500/30">
                    <span className="font-bold text-sky-200">本次采集发票</span>
                    <span className="badge badge-accent">
                      待加入
                    </span>
                  </div>
                  <div className="text-[11px] space-y-1 text-slate-400">
                    <p>
                      <span className="text-slate-400">价税合计：</span>
                      <span className="font-bold text-slate-100 font-mono">
                        ¥{duplicateConfirm.newBill.totalAmount.toFixed(2)}
                      </span>
                    </p>
                    <p>
                      <span className="text-slate-400">开票日期：</span>
                      {duplicateConfirm.newBill.invoiceDate}
                    </p>
                    <p>
                      <span className="text-slate-400">消费类型：</span>
                      {duplicateConfirm.newBill.consumptionType}
                    </p>
                    <p className="truncate" title={duplicateConfirm.newBill.sellerName}>
                      <span className="text-slate-400">销售方：</span>
                      {duplicateConfirm.newBill.sellerName}
                    </p>
                    <p>
                      <span className="text-slate-400">目标文件夹：</span>
                      {folders.find((f) => f.id === activeFolderId)?.name || '未分组'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-white/[0.06] bg-white/[0.02] flex items-center justify-between text-xs">
              <span className="text-[11px] text-slate-500">点击取消将放弃采集此重复发票</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDuplicateConfirm(null)}
                  className="btn-ghost px-3.5 py-1.5 rounded font-medium cursor-pointer transition-colors"
                >
                  取消添加
                </button>
                <button
                  type="button"
                  onClick={() => confirmAddBillToPersonal(duplicateConfirm.newBill)}
                  className="btn-flame px-4 py-1.5 rounded font-medium shadow-xs cursor-pointer transition-colors flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>确认人工添加</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
