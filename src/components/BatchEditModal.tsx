import React, { useState } from 'react';
import { X, Edit3 } from 'lucide-react';
import { ExpenseItemMaster, TransportMaster, ProjectMaster } from '../types/reimbursement';

interface BatchEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  expenseMasters: ExpenseItemMaster[];
  transportMasters: TransportMaster[];
  projectMasters: ProjectMaster[];
  onConfirmBatchEdit?: (updates: {
    expenseItemId?: string;
    transportId?: string;
    projectId?: string;
  }) => void;
  onApply?: (updates: {
    expenseItemId?: string;
    transportId?: string;
    projectId?: string;
  }) => void;
}

export const BatchEditModal: React.FC<BatchEditModalProps> = ({
  isOpen,
  onClose,
  selectedCount,
  expenseMasters,
  transportMasters,
  projectMasters,
  onConfirmBatchEdit,
  onApply,
}) => {
  const [expenseItemId, setExpenseItemId] = useState<string>('');
  const [transportId, setTransportId] = useState<string>('');
  const [projectId, setProjectId] = useState<string>('');
  const [updateExpense, setUpdateExpense] = useState<boolean>(true);
  const [updateTransport, setUpdateTransport] = useState<boolean>(false);
  const [updateProject, setUpdateProject] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleConfirm = () => {
    const updates: { expenseItemId?: string; transportId?: string; projectId?: string } = {};
    if (updateExpense && expenseItemId) {
      updates.expenseItemId = expenseItemId;
    }
    if (updateTransport && transportId) {
      updates.transportId = transportId;
    }
    if (updateProject && projectId) {
      updates.projectId = projectId;
    }

    if (onApply) {
      onApply(updates);
    } else if (onConfirmBatchEdit) {
      onConfirmBatchEdit(updates);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4 select-none">
      <div className="glass-card w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-sky-300" />
            <h3 className="text-sm font-bold text-slate-100">批量修改（已选择 {selectedCount} 行）</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-100 rounded-full p-1 hover:bg-white/5 transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3 text-xs">
          <p className="text-slate-400 text-[11px]">
            批量修改选中账单的归属项目、费用项目或交通工具，报销明细将自动同步重算。
          </p>

          <div className="space-y-3">
            {/* 项目 */}
            <div className="border border-white/5 rounded p-2.5 bg-white/[0.02]">
              <label className="flex items-center gap-2 font-medium text-slate-200 mb-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={updateProject}
                  onChange={(e) => setUpdateProject(e.target.checked)}
                  className="cb-dark"
                />
                <span>批量设置归属项目</span>
              </label>
              <select
                disabled={!updateProject}
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="input-dark w-full px-2 py-1.5 text-xs disabled:opacity-50"
              >
                <option value="">请选择项目</option>
                {projectMasters
                  .filter((m) => m.status === 'enabled')
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      [{m.code}] {m.name}
                    </option>
                  ))}
              </select>
            </div>

            {/* 费用项目 */}
            <div className="border border-white/5 rounded p-2.5 bg-white/[0.02]">
              <label className="flex items-center gap-2 font-medium text-slate-200 mb-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={updateExpense}
                  onChange={(e) => setUpdateExpense(e.target.checked)}
                  className="cb-dark"
                />
                <span>批量调整费用项目</span>
              </label>
              <select
                disabled={!updateExpense}
                value={expenseItemId}
                onChange={(e) => setExpenseItemId(e.target.value)}
                className="input-dark w-full px-2 py-1.5 text-xs disabled:opacity-50"
              >
                <option value="">请选择目标费用项目</option>
                {expenseMasters
                  .filter((m) => m.status === 'enabled')
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} {m.isMerge ? '(自动合并)' : '(逐张保留)'}
                    </option>
                  ))}
              </select>
            </div>

            {/* 交通工具 */}
            <div className="border border-white/5 rounded p-2.5 bg-white/[0.02]">
              <label className="flex items-center gap-2 font-medium text-slate-200 mb-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={updateTransport}
                  onChange={(e) => setUpdateTransport(e.target.checked)}
                  className="cb-dark"
                />
                <span>批量调整交通工具</span>
              </label>
              <select
                disabled={!updateTransport}
                value={transportId}
                onChange={(e) => setTransportId(e.target.value)}
                className="input-dark w-full px-2 py-1.5 text-xs disabled:opacity-50"
              >
                <option value="">请选择交通工具</option>
                {transportMasters
                  .filter((m) => m.status === 'enabled')
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-white/5 bg-white/[0.02]">
          <button
            onClick={onClose}
            className="btn-ghost px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            className="btn-primary px-4 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer"
          >
            确认批改
          </button>
        </div>
      </div>
    </div>
  );
};
