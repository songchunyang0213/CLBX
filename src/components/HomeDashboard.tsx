import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  FileText,
  Plus,
  ArrowUpRight,
  Receipt,
  CheckCircle2,
  Search,
  ExternalLink,
  ChevronDown,
  Trash2,
} from 'lucide-react';
import { ReimbursementForm, ApprovalStatusMaster } from '../types/reimbursement';

export type DeleteFormMode = 'keep_bills' | 'purge_all';

interface HomeDashboardProps {
  forms: ReimbursementForm[];
  currentFormNo: string;
  statusMasters?: ApprovalStatusMaster[];
  onOpenForm: (formNo: string) => void;
  onCreateNewForm: () => void;
  onDeleteForm?: (formNo: string, mode: DeleteFormMode) => void;
  onUpdateFormStatus?: (formNo: string, newStatusCode: string, statusName: string) => void;
  onToggleFormPaid?: (formNo: string) => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  forms,
  currentFormNo,
  statusMasters = [],
  onOpenForm,
  onCreateNewForm,
  onDeleteForm,
  onUpdateFormStatus,
  onToggleFormPaid,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPaid, setFilterPaid] = useState<string>('all');
  const [dropdownAnchor, setDropdownAnchor] = useState<{
    formNo: string;
    rect: DOMRect;
  } | null>(null);

  useEffect(() => {
    const handleGlobalClick = () => {
      setDropdownAnchor(null);
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  const filteredForms = forms.filter((f) => {
    const matchesSearch =
      f.formNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.applicant.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.remarks.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      filterStatus === 'all' || f.status === filterStatus || f.approvalStatusName === filterStatus;
    const matchesPaid =
      filterPaid === 'all' ||
      (filterPaid === 'paid' && f.isPaid) ||
      (filterPaid === 'unpaid' && !f.isPaid);
    return matchesSearch && matchesStatus && matchesPaid;
  });

  const totalAmountSum = forms.reduce((acc, f) => acc + (f.totalAmount || 0), 0);
  const totalBillsCount = forms.reduce((acc, f) => acc + (f.bills?.length || 0), 0);
  const paidCount = forms.filter((f) => f.isPaid).length;

  const getStatusBadgeClass = (statusCode: string): string => {
    switch (statusCode) {
      case 'approved':
      case 'paid':
        return 'badge-mint';
      case 'submitted':
      case 'pending_submit':
        return 'badge-accent';
      case 'draft':
        return 'badge-slate';
      case 'rejected':
        return 'badge-rose';
      default:
        return 'badge-accent';
    }
  };

  const isDarkBadge = (s?: string): boolean =>
    !!s && /bg-\w+-500\/\d+/.test(s);

  const renderDeleteDropdown = () => {
    if (!dropdownAnchor) return null;
    const item = forms.find((f) => f.formNo === dropdownAnchor.formNo);
    if (!item) return null;
    return createPortal(
      <div
        onClick={(e) => e.stopPropagation()}
        className="fixed z-[100] w-64 card py-2 text-left animate-in fade-in zoom-in-95 duration-100"
        style={{
          top: dropdownAnchor.rect.bottom + 8,
          left: Math.max(8, dropdownAnchor.rect.right - 256),
        }}
      >
        <button
          type="button"
          onClick={() => {
            setDropdownAnchor(null);
            onDeleteForm && onDeleteForm(item.formNo, 'keep_bills');
          }}
          className="w-full px-4 py-3 text-left hover:bg-cyan-500/10 flex items-start gap-3 text-sm transition-colors cursor-pointer group"
        >
          <div className="p-2 rounded-lg bg-cyan-500/15 text-cyan-400 group-hover:bg-cyan-500 group-hover:text-white transition-colors shrink-0 mt-0.5">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-slate-200 group-hover:text-cyan-300 flex items-center gap-2">
              <span>删除单据</span>
              <span className="text-xs px-2 py-0.5 rounded bg-white/5 text-slate-400 font-normal">保留发票</span>
            </div>
            <div className="text-xs text-slate-500 mt-1 leading-relaxed">
              删除单据，发票与行程单完整释放回发票账单
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setDropdownAnchor(null);
            onDeleteForm && onDeleteForm(item.formNo, 'purge_all');
          }}
          className="w-full px-4 py-3 text-left hover:bg-rose-500/10 flex items-start gap-3 text-sm transition-colors cursor-pointer group"
        >
          <div className="p-2 rounded-lg bg-rose-500/15 text-rose-400 group-hover:bg-rose-500 group-hover:text-white transition-colors shrink-0 mt-0.5">
            <Trash2 className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-rose-400 group-hover:text-rose-300 flex items-center gap-2">
              <span>彻底删除</span>
              <span className="text-xs px-2 py-0.5 rounded bg-rose-500/15 text-rose-400 font-normal">销毁发票</span>
            </div>
            <div className="text-xs text-rose-300/80 mt-1 leading-relaxed">
              彻底删除单据，并清除单据里的行程单及发票
            </div>
          </div>
        </button>
      </div>,
      document.body
    );
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto select-none">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-slate-400 font-medium">累计报销单据</span>
            <div className="w-8 h-8 rounded-lg bg-cyan-500/15 text-cyan-400 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-100">{forms.length}</span>
            <span className="text-sm text-slate-500">单</span>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-slate-400 font-medium">累计价税总额</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold amount-mint">
              ¥{totalAmountSum.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-slate-400 font-medium">已打款结算</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-emerald-400">{paidCount}</span>
            <span className="text-sm text-slate-500">/ {forms.length} 单</span>
          </div>
        </div>

        <div className="card-glow p-5 flex flex-col justify-between col-span-2 md:col-span-1 bg-gradient-to-br from-cyan-500/10 to-blue-600/5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-cyan-300">快速发起业务</span>
            <ArrowUpRight className="w-5 h-5 text-cyan-400" />
          </div>
          <button
            onClick={onCreateNewForm}
            className="mt-4 btn-primary flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-semibold text-sm"
          >
            <Plus className="w-4 h-4" />
            <span>新建差旅报销单</span>
          </button>
        </div>
      </div>

      {/* Table Card */}
      <div className="card overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800/50 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-100">
              差旅报销单据工作台
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              单据列表可直接维护审批状态与是否打款；双击行或点击单据号可展开详情
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-64">
              <input
                type="text"
                placeholder="搜索单据号、申请人或事由..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-dark w-full h-10 pl-10 pr-4 text-sm"
              />
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="input-dark h-10 px-4 text-sm cursor-pointer"
            >
              <option value="all">全部审批状态</option>
              {statusMasters
                .filter((s) => s.status === 'enabled')
                .map((st) => (
                  <option key={st.id} value={st.code}>
                    {st.name}
                  </option>
                ))}
            </select>

            <select
              value={filterPaid}
              onChange={(e) => setFilterPaid(e.target.value)}
              className="input-dark h-10 px-4 text-sm cursor-pointer"
            >
              <option value="all">全部打款状态</option>
              <option value="paid">已打款</option>
              <option value="unpaid">未打款</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto w-full">
          <table className="table-dark w-full text-left min-w-[900px]">
            <thead>
              <tr>
                <th className="w-16 px-4 col-order">序号</th>
                <th className="w-48 px-4">单据编号</th>
                <th className="w-32 px-4">单据日期</th>
                <th className="w-28 px-4">报销人员</th>
                <th className="w-32 px-4 text-right">报销总额</th>
                <th className="w-28 px-4 text-center">发票</th>
                <th className="w-40 px-4 text-center">审批状态</th>
                <th className="w-32 px-4 text-center">是否已打款</th>
                <th className="px-4">报销说明</th>
                <th className="w-44 px-4">创建时间</th>
                <th className="w-24 px-4 text-center">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredForms.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-16 text-center text-slate-500">
                    未检索到符合条件的报销单据
                  </td>
                </tr>
              ) : (
                filteredForms.map((item, idx) => {
                  const isCurrent = item.formNo === currentFormNo;
                  const matchedStatus = statusMasters.find(
                    (s) => s.code === item.status || s.name === item.status || s.name === item.approvalStatusName
                  );
                  const badgeClass = matchedStatus?.customColor
                    ? 'border'
                    : matchedStatus?.colorBadge && isDarkBadge(matchedStatus.colorBadge)
                      ? matchedStatus.colorBadge
                      : getStatusBadgeClass(item.status);
                  const badgeStyle: React.CSSProperties | undefined = matchedStatus?.customColor
                    ? {
                        backgroundColor: `${matchedStatus.customColor}26`,
                        color: matchedStatus.customColor,
                        borderColor: `${matchedStatus.customColor}4d`,
                      }
                    : undefined;

                  return (
                    <tr
                      key={item.formNo}
                      onDoubleClick={() => onOpenForm(item.formNo)}
                      title="双击进入单据内部"
                      className={`h-10 cursor-pointer ${isCurrent ? 'row-active' : ''}`}
                    >
                      <td className="px-4 col-order font-mono text-slate-400 text-sm">
                        {idx + 1}
                      </td>

                      <td className="px-4">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenForm(item.formNo);
                          }}
                          className="font-mono font-semibold text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-1.5 group cursor-pointer text-sm"
                        >
                          <span className="whitespace-nowrap">{item.formNo}</span>
                          <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-cyan-400 transition-opacity" />
                        </button>
                      </td>

                      <td className="px-4 font-mono text-slate-400 text-sm whitespace-nowrap">{item.formDate}</td>

                      <td className="px-4">
                        <span className="font-medium text-slate-200 text-sm whitespace-nowrap">{item.applicant}</span>
                      </td>

                      <td className="px-4 text-right font-mono font-bold amount-mint text-sm whitespace-nowrap">
                        ¥{item.totalAmount.toFixed(2)}
                      </td>

                      <td className="px-4 text-center font-mono">
                        <span className="badge badge-slate text-xs whitespace-nowrap">
                          {item.bills?.length || item.attachmentsCount || 0} 张
                        </span>
                      </td>

                      <td className="px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center relative">
                          <select
                            value={matchedStatus?.code || item.status}
                            onChange={(e) => {
                              const newCode = e.target.value;
                              const found = statusMasters.find((s) => s.code === newCode);
                              if (onUpdateFormStatus && found) {
                                onUpdateFormStatus(item.formNo, found.code, found.name);
                              }
                            }}
                            className={`badge ${badgeClass} py-1.5 pl-3 pr-8 appearance-none cursor-pointer focus:outline-none transition-colors text-xs`}
                            style={badgeStyle}
                            title="点击可直接更改单据审批状态"
                          >
                            {statusMasters
                              .filter((s) => s.status === 'enabled')
                              .map((st) => (
                                <option key={st.id} value={st.code}>
                                  {st.name}
                                </option>
                              ))}
                          </select>
                          <ChevronDown className="w-3.5 h-3.5 pointer-events-none absolute right-2.5 opacity-60" />
                        </div>
                      </td>

                      <td className="px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-start gap-2">
                          <button
                            type="button"
                            onClick={() => onToggleFormPaid && onToggleFormPaid(item.formNo)}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              item.isPaid
                                ? 'bg-emerald-500 shadow-lg shadow-emerald-500/30'
                                : 'bg-slate-700 hover:bg-slate-600'
                            }`}
                            title={item.isPaid ? '已打款 (点击变更为未打款)' : '未打款 (点击变更为已打款)'}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                                item.isPaid ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                          <span
                            className={`text-xs font-semibold min-w-[40px] text-left ${
                              item.isPaid ? 'text-emerald-400' : 'text-slate-500'
                            }`}
                          >
                            {item.isPaid ? '已打款' : '未打款'}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 text-slate-400 truncate max-w-[200px] text-sm" title={item.remarks}>
                        {item.remarks || '-'}
                      </td>

                      <td className="px-4 font-mono text-slate-400 text-xs whitespace-nowrap">
                        {item.createdAt || '2026-09-24 10:00'}
                      </td>

                      <td className="px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            setDropdownAnchor((prev) =>
                              prev?.formNo === item.formNo ? null : { formNo: item.formNo, rect }
                            );
                          }}
                          className={`inline-flex items-center justify-center gap-1.5 px-3 py-[3px] border rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                            dropdownAnchor?.formNo === item.formNo
                              ? 'border-rose-500 bg-rose-600 text-white shadow-[0_4px_14px_rgba(244,63,94,0.35)]'
                              : 'border-rose-500/30 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/50'
                          }`}
                          title="点击展开删除选项"
                        >
                          <Trash2 className="w-3.5 h-3.5 shrink-0" />
                          <span className="whitespace-nowrap">删除</span>
                          <ChevronDown className="w-3 h-3 opacity-70 shrink-0" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      {renderDeleteDropdown()}
    </div>
  );
};
