import React, { useState } from 'react';
import { Plus, Trash2, CheckCircle2, XCircle, Sliders, X } from 'lucide-react';
import { ExpenseItemMaster, BillItem, ConsumptionTypeMaster } from '../types/reimbursement';

interface ExpenseMasterViewProps {
  expenseMasters: ExpenseItemMaster[];
  setExpenseMasters: React.Dispatch<React.SetStateAction<ExpenseItemMaster[]>>;
  bills: BillItem[];
  consumptionTypeMasters: ConsumptionTypeMaster[];
}

export const ExpenseMasterView: React.FC<ExpenseMasterViewProps> = ({
  expenseMasters,
  setExpenseMasters,
  bills,
  consumptionTypeMasters,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ExpenseItemMaster | null>(null);

  // 可选的消费档案类型（去重，仅启用规则），如 交通/住宿/替票
  const consumptionTypeOptions = React.useMemo(
    () =>
      Array.from(
        new Set(
          consumptionTypeMasters
            .filter((c) => c.status === 'enabled')
            .map((c) => c.consumptionType)
        )
      ),
    [consumptionTypeMasters]
  );

  // Form states for Add/Edit
  const [formData, setFormData] = useState<Partial<ExpenseItemMaster>>({
    name: '',
    code: '',
    isMerge: true,
    status: 'enabled',
    description: '',
  });

  // Toggle 是否合并 directly from the table
  const handleToggleMerge = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpenseMasters((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return { ...item, isMerge: !item.isMerge };
        }
        return item;
      })
    );
  };

  // Toggle 启用/停用
  const handleToggleStatus = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpenseMasters((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, status: item.status === 'enabled' ? 'disabled' : 'enabled' }
          : item
      )
    );
  };

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormData({
      name: '',
      code: `FY00${expenseMasters.length + 1}`,
      isMerge: true,
      status: 'enabled',
      linkedConsumptionType: '',
      description: '',
    });
    setIsModalOpen(true);
  };

  const handleRowDoubleClick = (item: ExpenseItemMaster) => {
    setEditingItem(item);
    setFormData({ ...item });
    setIsModalOpen(true);
  };

  const handleDeleteCurrent = () => {
    if (!editingItem) return;
    const linkedCount = bills.filter((b) => b.expenseItemId === editingItem.id).length;
    if (linkedCount > 0) {
      if (!confirm(`费用项目【${editingItem.name}】已有 ${linkedCount} 笔账单关联，确认删除吗？`)) {
        return;
      }
    } else {
      if (!confirm(`确认删除费用项目【${editingItem.name}】？`)) return;
    }

    setExpenseMasters((prev) => prev.filter((item) => item.id !== editingItem.id));
    setIsModalOpen(false);
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      alert('请输入费用项目名称');
      return;
    }

    if (editingItem) {
      setExpenseMasters((prev) =>
        prev.map((item) =>
          item.id === editingItem.id
            ? ({ ...item, ...formData } as ExpenseItemMaster)
            : item
        )
      );
    } else {
      const newItem: ExpenseItemMaster = {
        id: `exp-${Date.now()}`,
        code: formData.code || `FY${Date.now().toString().slice(-4)}`,
        name: formData.name.trim(),
        isMerge: formData.isMerge ?? true,
        status: formData.status as 'enabled' | 'disabled',
        linkedConsumptionType: formData.linkedConsumptionType || undefined,
        description: formData.description || '',
        isSystem: false,
      };
      setExpenseMasters((prev) => [...prev, newItem]);
    }

    setIsModalOpen(false);
  };

  // Rule 9: 自动按照编码排序
  const sortedMasters = [...expenseMasters].sort((a, b) => a.code.localeCompare(b.code));

  return (
    <div className="p-4 space-y-4 max-w-7xl mx-auto select-none">
      <div className="glass-card p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded bg-gradient-to-br from-sky-500 to-indigo-500 text-white shadow-[0_0_18px_rgba(56,189,248,0.35)] shrink-0">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100">
              费用项目档案维护
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 truncate max-w-2xl">
              维护报销费用科目分类规则与合并控制策略；支持双击行进入编辑模式
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleOpenAdd}
            className="btn-primary flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>新增费用项目</span>
          </button>
        </div>
      </div>

      <div className="surface-card overflow-hidden">
        <div className="px-4 py-2 bg-white/[0.03] border-b border-white/[0.06] flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300">
            费用项目列表（共 {sortedMasters.length} 项 · 双击任意行进行编辑）
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
                <th className="w-32 px-4">编码</th>
                <th className="w-48 px-4">费用项目名称</th>
                <th className="w-32 px-4 text-center">关联消费档案</th>
                <th className="w-40 px-4 text-center">是否合并</th>
                <th className="w-28 px-4 text-center">状态</th>
                <th className="px-4">描述说明</th>
              </tr>
            </thead>
            <tbody>
              {sortedMasters.map((item, idx) => (
                <tr
                  key={item.id}
                  onDoubleClick={() => handleRowDoubleClick(item)}
                  title="双击进入编辑与删除"
                  className={`h-10 hover:bg-white/[0.04] cursor-pointer transition-colors ${
                    item.status === 'disabled' ? 'opacity-60 bg-white/[0.02]' : ''
                  }`}
                >
                  <td className="px-4 col-order font-mono text-slate-400">
                    {idx + 1}
                  </td>
                  <td className="px-4 font-mono text-slate-200 font-semibold">{item.code}</td>
                  <td className="px-4">
                    <span className="font-semibold text-slate-100">{item.name}</span>
                    {item.isSystem && (
                      <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-300 border border-white/[0.06]">
                        系统
                      </span>
                    )}
                  </td>

                  <td className="px-4 text-center">
                    {item.linkedConsumptionType ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-sky-500/10 text-sky-300 border border-sky-500/20">
                        {item.linkedConsumptionType}
                      </span>
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </td>

                  <td className="px-4 text-center">
                    <button
                      type="button"
                      onClick={(e) => handleToggleMerge(item.id, e)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                        item.isMerge
                          ? 'bg-gradient-to-r from-rose-500 to-rose-400 text-white shadow-[0_0_10px_rgba(244,63,94,0.35)]'
                          : 'bg-white/[0.06] text-slate-300 hover:bg-white/[0.1] border border-white/[0.06]'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          item.isMerge ? 'bg-white' : 'bg-slate-500'
                        }`}
                      />
                      <span>{item.isMerge ? '是 (自动合并)' : '否 (逐张展开)'}</span>
                    </button>
                  </td>

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

                  <td className="px-4 text-slate-400 truncate max-w-[280px]" title={item.description}>
                    {item.description || '-'}
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
                {editingItem ? '编辑费用项目' : '新增费用项目'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-full cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="p-4 space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  <span className="text-rose-400 mr-0.5">*</span>编码
                </label>
                <input
                  type="text"
                  required
                  value={formData.code || ''}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="FY001"
                  className="input-dark w-full px-2.5 py-1.5"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  <span className="text-rose-400 mr-0.5">*</span>费用项目名称
                </label>
                <input
                  type="text"
                  required
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="如：差旅补贴、市内交通费"
                  className="input-dark w-full px-2.5 py-1.5"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  关联消费档案
                </label>
                <select
                  value={formData.linkedConsumptionType || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, linkedConsumptionType: e.target.value })
                  }
                  className="input-dark w-full px-2.5 py-1.5 cursor-pointer"
                >
                  <option value="">不关联（不参与自动选定）</option>
                  {consumptionTypeOptions.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  报销单上传发票时，将按发票识别出的消费类型自动选定关联的费用项目
                </p>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">是否合并报销明细</label>
                <div className="flex items-center gap-4 mt-1">
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                    <input
                      type="radio"
                      name="isMerge"
                      checked={formData.isMerge === true}
                      onChange={() => setFormData({ ...formData, isMerge: true })}
                      className="accent-sky-500 focus:ring-0"
                    />
                    <span>是 (同类自动合并)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                    <input
                      type="radio"
                      name="isMerge"
                      checked={formData.isMerge === false}
                      onChange={() => setFormData({ ...formData, isMerge: false })}
                      className="accent-sky-500 focus:ring-0"
                    />
                    <span>否 (逐张展开)</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">使用状态</label>
                <select
                  value={formData.status || 'enabled'}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value as 'enabled' | 'disabled' })
                  }
                  className="input-dark w-full px-2.5 py-1.5 cursor-pointer"
                >
                  <option value="enabled">启用中</option>
                  <option value="disabled">已停用</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">描述说明</label>
                <textarea
                  rows={2}
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="费用科目开支范围及核算要点..."
                  className="input-dark w-full px-2.5 py-1.5"
                />
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
