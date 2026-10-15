import React, { useState } from 'react';
import { Plus, Trash2, CheckCircle2, XCircle, MapPin, Search, X } from 'lucide-react';
import { LocationMaster, BillItem } from '../types/reimbursement';

interface LocationMasterViewProps {
  locationMasters: LocationMaster[];
  setLocationMasters: React.Dispatch<React.SetStateAction<LocationMaster[]>>;
  bills: BillItem[];
}

export const LocationMasterView: React.FC<LocationMasterViewProps> = ({
  locationMasters,
  setLocationMasters,
  bills,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LocationMaster | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [city, setCity] = useState('');
  const [status, setStatus] = useState<'enabled' | 'disabled'>('enabled');
  const [description, setDescription] = useState('');

  const handleOpenAdd = () => {
    setEditingItem(null);
    setName('');
    setCode(`LOC0${locationMasters.length + 1}`);
    setCity('');
    setStatus('enabled');
    setDescription('');
    setIsModalOpen(true);
  };

  const handleRowDoubleClick = (item: LocationMaster) => {
    setEditingItem(item);
    setName(item.name);
    setCode(item.code);
    setCity(item.city || '');
    setStatus(item.status);
    setDescription(item.description || '');
    setIsModalOpen(true);
  };

  const handleToggleStatus = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setLocationMasters((prev) =>
      prev.map((loc) =>
        loc.id === id ? { ...loc, status: loc.status === 'enabled' ? 'disabled' : 'enabled' } : loc
      )
    );
  };

  const handleDeleteCurrent = () => {
    if (!editingItem) return;
    if (!confirm(`确认删除地点档案【${editingItem.name}】？`)) return;
    setLocationMasters((prev) => prev.filter((loc) => loc.id !== editingItem.id));
    setIsModalOpen(false);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingItem) {
      setLocationMasters((prev) =>
        prev.map((loc) =>
          loc.id === editingItem.id
            ? { ...loc, name: name.trim(), code, city: city.trim(), status, description: description.trim() }
            : loc
        )
      );
    } else {
      const newItem: LocationMaster = {
        id: `loc-${Date.now()}`,
        name: name.trim(),
        code: code || `LOC${Date.now().toString().slice(-4)}`,
        city: city.trim(),
        status,
        description: description.trim(),
      };
      setLocationMasters((prev) => [...prev, newItem]);
    }
    setIsModalOpen(false);
  };

  const sortedLocations = [...locationMasters].sort((a, b) => a.code.localeCompare(b.code));

  const filteredLocations = sortedLocations.filter((loc) => {
    const matchSearch =
      loc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loc.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (loc.city && loc.city.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchSearch;
  });

  return (
    <div className="p-4 space-y-4 max-w-7xl mx-auto select-none">
      <div className="glass-card p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-[0_0_18px_rgba(16,185,129,0.35)]">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100">地点档案维护</h2>
            <p className="text-xs text-slate-400 mt-0.5 truncate max-w-2xl">
              维护差旅报销常用交通枢纽与城市地点档案；双击列表行进行编辑与维护
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenAdd}
            className="btn-primary flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>新增地点档案</span>
          </button>
        </div>
      </div>

      <div className="glass-card p-3 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="搜索地点名称、编码或城市..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-dark w-full pl-8 pr-2.5 py-1"
            />
          </div>
        </div>

        <div className="text-slate-400 font-medium">
          共 <span className="font-semibold text-slate-200">{filteredLocations.length}</span> 个地点
        </div>
      </div>

      <div className="surface-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-dark">
            <thead>
              <tr>
                <th className="w-16 px-4 col-order">序号</th>
                <th className="w-28 px-4">地点编码</th>
                <th className="px-4">地点名称</th>
                <th className="w-32 px-4">所属城市</th>
                <th className="px-4">说明备注</th>
                <th className="w-28 px-4 text-center">状态</th>
              </tr>
            </thead>
            <tbody>
              {filteredLocations.map((item, idx) => (
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
                  <td className="px-4 text-slate-300">{item.city || '-'}</td>
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
                {editingItem ? '编辑地点档案' : '新增地点档案'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-full cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    <span className="text-rose-400 mr-0.5">*</span>地点编码
                  </label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="LOC001"
                    className="input-dark w-full px-2.5 py-1.5"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">所属城市</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="如：北京、上海"
                    className="input-dark w-full px-2.5 py-1.5"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  <span className="text-rose-400 mr-0.5">*</span>地点名称
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="如：北京大兴国际机场、深圳北站"
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

              <div>
                <label className="block text-slate-300 font-medium mb-1">说明备注</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="枢纽信息或换乘说明..."
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
