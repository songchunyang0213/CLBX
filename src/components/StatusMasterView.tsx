import React, { useState } from 'react';
import { Plus, Trash2, CheckCircle2, XCircle, Search, X, ShieldCheck } from 'lucide-react';
import { ApprovalStatusMaster } from '../types/reimbursement';

interface StatusMasterViewProps {
  statusMasters: ApprovalStatusMaster[];
  setStatusMasters: React.Dispatch<React.SetStateAction<ApprovalStatusMaster[]>>;
}

export const StatusMasterView: React.FC<StatusMasterViewProps> = ({
  statusMasters,
  setStatusMasters,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ApprovalStatusMaster | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [colorBadge, setColorBadge] = useState('bg-sky-500/15 text-sky-300 border-sky-500/30');
  const [customColor, setCustomColor] = useState('');
  const [status, setStatus] = useState<'enabled' | 'disabled'>('enabled');
  const [description, setDescription] = useState('');

  const CUSTOM_COLOR_KEY = '__custom__';

  const badgeColorOptions = [
    { label: '灰色 (草稿/停用)', value: 'bg-slate-500/15 text-slate-300 border-slate-500/30' },
    { label: '黄色 (待提交/待办)', value: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
    { label: '蓝色 (审批中/处理)', value: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
    { label: '绿色 (已审批/已通过)', value: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
    { label: '红色 (已驳回/已作废)', value: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
    { label: '紫色 (复核/审计)', value: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30' },
    { label: '自定义颜色 (点击色块选取)', value: CUSTOM_COLOR_KEY },
  ];

  /**
   * 自定义颜色时用内联样式渲染标签：
   * 底色约 15% 透明度（HEX 后缀 26）、边框约 30%（4d）、文字为纯色
   */
  const customBadgeStyle = (hex: string): React.CSSProperties => ({
    backgroundColor: `${hex}26`,
    color: hex,
    borderColor: `${hex}4d`,
  });

  const handleOpenAdd = () => {
    setEditingItem(null);
    setName('');
    setCode(`STATUS_${Date.now().toString().slice(-4)}`);
    setColorBadge('bg-sky-500/15 text-sky-300 border-sky-500/30');
    setCustomColor('');
    setStatus('enabled');
    setDescription('');
    setIsModalOpen(true);
  };

  const handleRowDoubleClick = (item: ApprovalStatusMaster) => {
    setEditingItem(item);
    setName(item.name);
    setCode(item.code);
    if (item.customColor) {
      setColorBadge(CUSTOM_COLOR_KEY);
      setCustomColor(item.customColor);
    } else {
      setColorBadge(item.colorBadge);
      setCustomColor('');
    }
    setStatus(item.status);
    setDescription(item.description || '');
    setIsModalOpen(true);
  };

  const handleToggleStatus = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setStatusMasters((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, status: s.status === 'enabled' ? 'disabled' : 'enabled' } : s
      )
    );
  };

  const handleDeleteCurrent = () => {
    if (!editingItem) return;
    if (!confirm(`确认删除审批状态档案【${editingItem.name}】？（误删后可通过侧边栏底部"恢复内置档案"找回）`)) return;
    setStatusMasters((prev) => prev.filter((s) => s.id !== editingItem.id));
    setIsModalOpen(false);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingItem) {
      setStatusMasters((prev) =>
        prev.map((s) =>
          s.id === editingItem.id
            ? {
                ...s,
                name: name.trim(),
                code: code.trim(),
                colorBadge,
                customColor: colorBadge === CUSTOM_COLOR_KEY ? customColor : undefined,
                status,
                description: description.trim(),
              }
            : s
        )
      );
    } else {
      const newItem: ApprovalStatusMaster = {
        id: `st-${Date.now()}`,
        name: name.trim(),
        code: code.trim() || `STATUS_${Date.now().toString().slice(-4)}`,
        colorBadge,
        customColor: colorBadge === CUSTOM_COLOR_KEY ? customColor : undefined,
        status,
        sortOrder: statusMasters.length + 1,
        description: description.trim(),
      };
      setStatusMasters((prev) => [...prev, newItem]);
    }
    setIsModalOpen(false);
  };

  const filteredStatuses = statusMasters.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.description && s.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="p-4 space-y-4 max-w-7xl mx-auto select-none">
      <div className="glass-card p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded bg-gradient-to-br from-indigo-500 to-sky-500 text-white shadow-[0_0_18px_rgba(99,102,241,0.35)]">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100">审批状态基础档案</h2>
            <p className="text-xs text-slate-400 mt-0.5 truncate max-w-2xl">
              维护单据工作台及审批流所引用的状态档案；与单据列表勾稽联动，双击列表行进行编辑
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenAdd}
          className="btn-primary flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>新增状态档案</span>
        </button>
      </div>

      <div className="glass-card p-3 flex items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="搜索状态名称、编码或说明..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-dark w-full pl-8 pr-2.5 py-1 text-xs"
          />
        </div>
        <div className="text-xs text-slate-400">
          共 <span className="font-semibold text-slate-200">{filteredStatuses.length}</span> 个状态
        </div>
      </div>

      <div className="surface-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-dark">
            <thead>
              <tr>
                <th className="w-16 px-4 col-order">序号</th>
                <th className="w-36 px-4">状态编码</th>
                <th className="w-32 px-4">状态名称</th>
                <th className="w-36 px-4 text-center">标签视觉预览</th>
                <th className="px-4">状态业务说明</th>
                <th className="w-28 px-4 text-center">启用状态</th>
              </tr>
            </thead>
            <tbody>
              {filteredStatuses.map((item, idx) => (
                <tr
                  key={item.id}
                  onDoubleClick={() => handleRowDoubleClick(item)}
                  title="双击进入编辑"
                  className="h-10 hover:bg-white/[0.04] cursor-pointer transition-colors"
                >
                  <td className="px-4 col-order font-mono text-slate-400">{idx + 1}</td>
                  <td className="px-4 font-mono font-medium text-slate-200">{item.code}</td>
                  <td className="px-4 font-bold text-slate-100">{item.name}</td>
                  <td className="px-4 text-center">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded text-[11px] font-semibold border ${
                        item.customColor ? '' : item.colorBadge
                      }`}
                      style={item.customColor ? customBadgeStyle(item.customColor) : undefined}
                    >
                      {item.name}
                    </span>
                  </td>
                  <td className="px-4 text-slate-400 truncate max-w-[280px]" title={item.description}>
                    {item.description || '-'}
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
                {editingItem ? '编辑状态档案' : '新增审批状态档案'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-full cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-4 space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  <span className="text-rose-400 mr-0.5">*</span>状态名称
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="如：审批中、已打款、财务初审"
                  className="input-dark w-full px-2.5 py-1.5"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">状态代码</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="如：submitted, auditing"
                  className="input-dark w-full px-2.5 py-1.5 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">标签色彩样式</label>
                <select
                  value={colorBadge}
                  onChange={(e) => {
                    const v = e.target.value;
                    setColorBadge(v);
                    if (v === CUSTOM_COLOR_KEY) {
                      if (!customColor) setCustomColor('#22d3ee');
                    } else {
                      setCustomColor('');
                    }
                  }}
                  className="input-dark w-full px-2.5 py-1.5 cursor-pointer"
                >
                  {badgeColorOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                {/* 自定义颜色选择器 */}
                {colorBadge === CUSTOM_COLOR_KEY && (
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <input
                      type="color"
                      value={customColor || '#22d3ee'}
                      onChange={(e) => setCustomColor(e.target.value)}
                      className="w-9 h-9 p-0.5 bg-transparent border border-white/10 rounded-lg cursor-pointer"
                      title="点按选取任意颜色"
                    />
                    <input
                      type="text"
                      value={customColor}
                      onChange={(e) => setCustomColor(e.target.value)}
                      className="input-dark px-2 py-1.5 font-mono w-24"
                      placeholder="#22d3ee"
                    />
                    <span className="text-slate-500 text-[11px]">任意 HEX 颜色，实时驱动标签</span>
                  </div>
                )}

                <div className="mt-2 flex items-center gap-2">
                  <span className="text-slate-400 text-[11px]">预览:</span>
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded text-[11px] font-semibold border ${
                      colorBadge === CUSTOM_COLOR_KEY ? '' : colorBadge
                    }`}
                    style={
                      colorBadge === CUSTOM_COLOR_KEY && customColor
                        ? customBadgeStyle(customColor)
                        : undefined
                    }
                  >
                    {name || '预览文字'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">启用状态</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'enabled' | 'disabled')}
                  className="input-dark w-full px-2.5 py-1.5 cursor-pointer"
                >
                  <option value="enabled">启用中</option>
                  <option value="disabled">已停用</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">业务说明</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="填写该状态在流程中的含义与流转规则..."
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
                    <span>删除</span>
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
