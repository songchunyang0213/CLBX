import React, { useState } from 'react';
import { Plus, Trash2, CheckCircle2, XCircle, Users, X, Phone, UserCheck } from 'lucide-react';
import { EmployeeMaster } from '../types/reimbursement';

interface EmployeeMasterViewProps {
  employees: EmployeeMaster[];
  setEmployees: React.Dispatch<React.SetStateAction<EmployeeMaster[]>>;
}

export const EmployeeMasterView: React.FC<EmployeeMasterViewProps> = ({
  employees,
  setEmployees,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EmployeeMaster | null>(null);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<'enabled' | 'disabled'>('enabled');

  const handleOpenAdd = () => {
    setEditingItem(null);
    setCode(`YG00${employees.length + 1}`);
    setName('');
    setPhone('');
    setStatus('enabled');
    setIsModalOpen(true);
  };

  const handleRowDoubleClick = (emp: EmployeeMaster) => {
    setEditingItem(emp);
    setCode(emp.code);
    setName(emp.name);
    setPhone(emp.phone);
    setStatus(emp.status);
    setIsModalOpen(true);
  };

  const handleToggleStatus = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEmployees((prev) =>
      prev.map((emp) =>
        emp.id === id ? { ...emp, status: emp.status === 'enabled' ? 'disabled' : 'enabled' } : emp
      )
    );
  };

  const handleDeleteCurrent = () => {
    if (!editingItem) return;
    if (!confirm(`确认删除人员档案【${editingItem.name}】？`)) return;
    setEmployees((prev) => prev.filter((emp) => emp.id !== editingItem.id));
    setIsModalOpen(false);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) return;

    if (editingItem) {
      setEmployees((prev) =>
        prev.map((emp) =>
          emp.id === editingItem.id
            ? { ...emp, code: code.trim(), name: name.trim(), phone: phone.trim(), status }
            : emp
        )
      );
    } else {
      const newEmp: EmployeeMaster = {
        id: `emp-${Date.now()}`,
        code: code.trim(),
        name: name.trim(),
        phone: phone.trim(),
        status,
      };
      setEmployees((prev) => [...prev, newEmp]);
    }
    setIsModalOpen(false);
  };

  const sortedEmployees = [...employees].sort((a, b) => a.code.localeCompare(b.code));

  return (
    <div className="p-4 space-y-4 max-w-7xl mx-auto select-none">
      <div className="glass-card p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded bg-gradient-to-br from-sky-500 to-indigo-500 text-white shadow-[0_0_18px_rgba(56,189,248,0.35)]">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100">人员档案维护</h2>
            <p className="text-xs text-slate-400 mt-0.5 truncate max-w-2xl">
              维护企业内部报销员工基础数据，并与差旅报销单报销人员建立勾稽选用关系
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenAdd}
            className="btn-primary flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>新增人员</span>
          </button>
        </div>
      </div>

      <div className="surface-card overflow-hidden">
        <div className="px-4 py-2 bg-white/[0.03] border-b border-white/[0.06] flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300">
            人员档案列表（共 {sortedEmployees.length} 人 · 双击任意行进行编辑）
          </span>
          <span className="text-[11px] text-slate-400">
            字段包含：序号、员工编码、员工姓名、手机号
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="table-dark">
            <thead>
              <tr>
                <th className="w-16 px-4 col-order">序号</th>
                <th className="w-36 px-4">员工编码</th>
                <th className="w-48 px-4">员工姓名</th>
                <th className="px-4">手机号</th>
                <th className="w-28 px-4 text-center">状态</th>
              </tr>
            </thead>
            <tbody>
              {sortedEmployees.map((emp, idx) => (
                <tr
                  key={emp.id}
                  onDoubleClick={() => handleRowDoubleClick(emp)}
                  title="双击进入编辑与删除"
                  className="h-10 hover:bg-white/[0.04] cursor-pointer transition-colors"
                >
                  <td className="px-4 col-order font-mono text-slate-400">
                    {idx + 1}
                  </td>
                  <td className="px-4 font-mono text-slate-200 font-semibold">{emp.code}</td>
                  <td className="px-4 font-semibold text-slate-100 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-sky-400" />
                    <span>{emp.name}</span>
                  </td>
                  <td className="px-4 font-mono text-slate-300">
                    {emp.phone || '-'}
                  </td>
                  <td className="px-4 text-center">
                    <button
                      onClick={(e) => handleToggleStatus(emp.id, e)}
                      className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded cursor-pointer ${
                        emp.status === 'enabled'
                          ? 'text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20'
                          : 'text-slate-400 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.06]'
                      }`}
                    >
                      {emp.status === 'enabled' ? (
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
                {editingItem ? '编辑人员档案' : '新增人员档案'}
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
                  <span className="text-rose-400 mr-0.5">*</span>员工编码
                </label>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="YG001"
                  className="input-dark w-full px-2.5 py-1.5"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  <span className="text-rose-400 mr-0.5">*</span>员工姓名
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="如：宋春阳"
                  className="input-dark w-full px-2.5 py-1.5"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  手机号
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="如：13800138000"
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
                    <span>删除此人员</span>
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
