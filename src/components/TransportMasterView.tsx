import React, { useState } from 'react';
import { Plus, Trash2, CheckCircle2, XCircle, Navigation, X } from 'lucide-react';
import { TransportMaster, BillItem } from '../types/reimbursement';

interface TransportMasterViewProps {
  transportMasters: TransportMaster[];
  setTransportMasters: React.Dispatch<React.SetStateAction<TransportMaster[]>>;
  bills: BillItem[];
}

export const TransportMasterView: React.FC<TransportMasterViewProps> = ({
  transportMasters,
  setTransportMasters,
  bills,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TransportMaster | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'enabled' | 'disabled'>('enabled');

  const handleOpenAdd = () => {
    setEditingItem(null);
    setName('');
    setCode(`TR00${transportMasters.length + 1}`);
    setStatus('enabled');
    setIsModalOpen(true);
  };

  const handleRowDoubleClick = (item: TransportMaster) => {
    setEditingItem(item);
    setName(item.name);
    setCode(item.code);
    setStatus(item.status);
    setIsModalOpen(true);
  };

  const handleToggleStatus = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTransportMasters((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, status: t.status === 'enabled' ? 'disabled' : 'enabled' } : t
      )
    );
  };

  const handleDeleteCurrent = () => {
    if (!editingItem) return;
    const usageCount = bills.filter((b) => b.transportId === editingItem.id).length;
    if (usageCount > 0) {
      if (!confirm(`交通工具【${editingItem.name}】已有 ${usageCount} 笔账单关联，确认删除吗？`)) return;
    } else {
      if (!confirm(`确认删除交通工具档案【${editingItem.name}】？`)) return;
    }
    setTransportMasters((prev) => prev.filter((t) => t.id !== editingItem.id));
    setIsModalOpen(false);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingItem) {
      setTransportMasters((prev) =>
        prev.map((t) =>
          t.id === editingItem.id ? { ...t, name: name.trim(), code, status } : t
        )
      );
    } else {
      const newItem: TransportMaster = {
        id: `tr-${Date.now()}`,
        name: name.trim(),
        code: code || `TR${Date.now().toString().slice(-4)}`,
        status,
      };
      setTransportMasters((prev) => [...prev, newItem]);
    }
    setIsModalOpen(false);
  };

  const sortedMasters = [...transportMasters].sort((a, b) => a.code.localeCompare(b.code));

  return (
    <div className="p-4 space-y-4 max-w-7xl mx-auto select-none">
      <div className="glass-card p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded bg-gradient-to-br from-indigo-500 to-sky-500 text-white shadow-[0_0_18px_rgba(99,102,241,0.35)]">
            <Navigation className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100">交通工具档案维护</h2>
            <p className="text-xs text-slate-400 mt-0.5 truncate max-w-2xl">
              维护允许报销的交通工具基础数据；双击列表行进入编辑与维护界面
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenAdd}
            className="btn-primary flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>新增交通工具</span>
          </button>
        </div>
      </div>

      <div className="surface-card overflow-hidden">
        <div className="px-4 py-2 bg-white/[0.03] border-b border-white/[0.06] flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300">
            交通工具列表（共 {sortedMasters.length} 项 · 双击任意行进行编辑）
          </span>
          <span className="text-[11px] text-slate-400">
            自动按编码排序 · 序号自增
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="table-dark">
            <thead>
              <tr>
                <th className="w-16 px-4 col-order">序号</th>
                <th className="w-32 px-4">工具编码</th>
                <th className="px-4">交通工具名称</th>
                <th className="w-32 px-4 text-center">状态</th>
              </tr>
            </thead>
            <tbody>
              {sortedMasters.map((item, idx) => (
                <tr
                  key={item.id}
                  onDoubleClick={() => handleRowDoubleClick(item)}
                  title="双击进入编辑与删除"
                  className="h-10 hover:bg-white/[0.04] cursor-pointer transition-colors"
                >
                  <td className="px-4 col-order font-mono text-slate-400">
                    {idx + 1}
                  </td>
                  <td className="px-4 font-mono text-slate-200 font-semibold">{item.code}</td>
                  <td className="px-4 font-semibold text-slate-100">{item.name}</td>
                  <td className="px-4 text-center">
                    <button
                      onClick={(e) => handleToggleStatus(item.id, e)}
                      className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded cursor-pointer ${
                        item.status === 'enabled'
                          ? 'text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20'
                          : 'text-slate-400 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.06]'
                      }`}
                    >
                      {item.status === 'enabled' ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>启用中</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3 text-slate-400" />
                          <span>已停用</span>
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="surface-card w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-white/[0.03]">
              <h3 className="text-sm font-bold text-slate-100">
                {editingItem ? '编辑交通工具档案' : '新增交通工具档案'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-full cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-4 space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  <span className="text-rose-400 mr-0.5">*</span>工具编码
                </label>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="TR001"
                  className="input-dark w-full px-2.5 py-1.5"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  <span className="text-rose-400 mr-0.5">*</span>交通工具名称
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="如：高铁/动车/火车"
                  className="input-dark w-full px-2.5 py-1.5"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">状态</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'enabled' | 'disabled')}
                  className="input-dark w-full px-2.5 py-1.5 cursor-pointer"
                >
                  <option value="enabled">启用中</option>
                  <option value="disabled">已停用</option>
                </select>
              </div>

              <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between">
                {editingItem ? (
                  <button
                    type="button"
                    onClick={handleDeleteCurrent}
                    className="btn-danger flex items-center gap-1 px-3 py-1.5 rounded cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>删除此档案</span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="btn-ghost px-3 py-1.5 rounded cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="btn-primary px-4 py-1.5 rounded font-medium cursor-pointer"
                  >
                    保存
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
