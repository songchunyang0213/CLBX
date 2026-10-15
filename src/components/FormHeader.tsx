import React from 'react';
import { FileText, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { ReimbursementForm, EmployeeMaster } from '../types/reimbursement';
import { generateNextFormNo, validateFormNo } from '../utils/formNoGenerator';

interface FormHeaderProps {
  form: ReimbursementForm;
  setForm: React.Dispatch<React.SetStateAction<ReimbursementForm>>;
  calculatedTotal: number;
  onlyRequired?: boolean;
  setOnlyRequired?: (val: boolean) => void;
  openAttachments?: () => void;
  employees?: EmployeeMaster[];
  formsList?: ReimbursementForm[];
  onFormNoChange?: (newFormNo: string) => void;
}

export const FormHeader: React.FC<FormHeaderProps> = ({
  form,
  setForm,
  calculatedTotal,
  employees = [],
  formsList = [],
  onFormNoChange,
}) => {
  const handleApplicantChange = (selectedName: string) => {
    const matched = employees.find((e) => e.name === selectedName);
    setForm((prev) => ({
      ...prev,
      applicant: selectedName,
      applicantCode: matched?.code || prev.applicantCode,
    }));
  };

  const formNoValidation = validateFormNo(
    form.formNo,
    form.id || form.formNo,
    formsList
  );

  const handleInputChange = (val: string) => {
    const upperVal = val.trim();
    if (onFormNoChange) {
      onFormNoChange(val);
    } else {
      setForm((prev) => ({ ...prev, formNo: val }));
    }
  };

  const handleRegenerateStandardFormNo = () => {
    const newStandardNo = generateNextFormNo(formsList, form.formDate);
    if (onFormNoChange) {
      onFormNoChange(newStandardNo);
    } else {
      setForm((prev) => ({ ...prev, formNo: newStandardNo }));
    }
  };

  return (
    <div className="card p-6 select-none">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800/50 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 text-white flex items-center justify-center shadow-lg shadow-cyan-500/30">
            <FileText className="w-4 h-4" />
          </div>
          <h2 className="text-lg font-bold text-slate-100">差旅报销单据信息</h2>
          <span className={`badge ${
            form.status === 'submitted'
              ? 'badge-accent'
              : form.status === 'approved'
              ? 'badge-mint'
              : 'badge-slate'
          }`}>
            {form.status === 'submitted'
              ? '已提交审批'
              : form.status === 'approved'
              ? '已审批通过'
              : '填写中'}
          </span>
        </div>
      </div>

      {/* Form Fields */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-x-6 gap-y-4">
        {/* 单据编号 */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <label className="text-sm text-slate-300 font-medium">
              <span className="text-rose-400 mr-0.5">*</span>单据编号
            </label>
          </div>
          <div className="relative flex items-center">
            <input
              type="text"
              value={form.formNo}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="TERB20260926001"
              className={`input-dark w-full px-3 py-2.5 pr-20 font-mono text-sm font-semibold ${
                !formNoValidation.isValid
                  ? '!border-rose-500/50 !bg-rose-500/5'
                  : ''
              }`}
              title="报销单单据号为常量TERB+四位年+两位月+两位日+三位数字流水"
            />
            <div className="absolute right-2 flex items-center gap-1.5">
              {formNoValidation.isValid ? (
                <span title="单据号有效且全局唯一">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </span>
              ) : (
                <span title={formNoValidation.errorMessage || '单据号异常'}>
                  <AlertCircle className="w-4 h-4 text-rose-400" />
                </span>
              )}
              <button
                type="button"
                onClick={handleRegenerateStandardFormNo}
                className="p-1.5 text-slate-500 hover:text-cyan-400 hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                title="按编码规则自动生成下一个编号"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="pt-1.5">
            {formNoValidation.isDuplicate ? (
              <span className="text-xs text-rose-400 font-medium flex items-center gap-1">
                <AlertCircle className="w-3 h-3 shrink-0" />
                单据编号已存在，全局不允许重复！
              </span>
            ) : formNoValidation.isEmpty ? (
              <span className="text-xs text-rose-400 font-medium flex items-center gap-1">
                <AlertCircle className="w-3 h-3 shrink-0" />
                单据编号不能为空！
              </span>
            ) : null}
          </div>
        </div>

        {/* 单据日期 */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <label className="text-sm text-slate-300 font-medium">
              <span className="text-rose-400 mr-0.5">*</span>单据日期
            </label>
          </div>
          <input
            type="date"
            value={form.formDate}
            onChange={(e) => setForm({ ...form, formDate: e.target.value })}
            className="input-dark w-full px-3 py-2.5 text-sm"
          />
        </div>

        {/* 报销人员 */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <label className="text-sm text-slate-300 font-medium">
              <span className="text-rose-400 mr-0.5">*</span>报销人员
            </label>
          </div>
          {employees.length > 0 ? (
            <select
              value={form.applicant}
              onChange={(e) => handleApplicantChange(e.target.value)}
              className="input-dark w-full px-3 py-2.5 text-sm font-medium cursor-pointer"
            >
              {employees
                .filter((emp) => emp.status === 'enabled')
                .map((emp) => (
                  <option key={emp.id} value={emp.name}>
                    {emp.name} ({emp.code})
                  </option>
                ))}
              {!employees.some((e) => e.name === form.applicant) && (
                <option value={form.applicant}>{form.applicant}</option>
              )}
            </select>
          ) : (
            <input
              type="text"
              value={form.applicant}
              onChange={(e) => setForm({ ...form, applicant: e.target.value })}
              className="input-dark w-full px-3 py-2.5 text-sm font-medium"
            />
          )}
        </div>

        {/* 报销总额 */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <label className="text-sm text-slate-400 font-medium">
              报销总额
            </label>
          </div>
          <input
            type="text"
            readOnly
            value={`¥ ${calculatedTotal.toFixed(2)}`}
            className="w-full bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-2.5 amount-mint font-bold font-mono text-sm focus:outline-none"
          />
        </div>

        {/* 报销说明 */}
        <div className="md:col-span-4 flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <label className="text-sm text-slate-400 font-medium">
              报销说明
            </label>
          </div>
          <input
            type="text"
            value={form.remarks}
            onChange={(e) => setForm({ ...form, remarks: e.target.value })}
            placeholder="填写出差事由、行程目的或费用说明..."
            className="input-dark w-full px-3 py-2.5 text-sm"
          />
        </div>
      </div>
    </div>
  );
};
