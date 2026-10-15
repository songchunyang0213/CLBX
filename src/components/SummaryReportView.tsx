import React, { useState, useMemo } from 'react';
import { BarChart3, ChevronRight, ArrowLeft } from 'lucide-react';
import { ReimbursementForm } from '../types/reimbursement';

interface SummaryReportViewProps {
  formsList: ReimbursementForm[];
  onOpenForm: (formNo: string) => void;
}

type Dimension = 'paid' | 'status' | 'expense' | 'project' | 'date';

export const SummaryReportView: React.FC<SummaryReportViewProps> = ({
  formsList,
  onOpenForm,
}) => {
  const [activeDim, setActiveDim] = useState<Dimension>('paid');
  const [drillDownKey, setDrillDownKey] = useState<string | null>(null);

  // 从 formsList 的 bills 中提取全部明细并展平
  const allBills = useMemo(() => {
    const result: { form: ReimbursementForm; expenseItemName: string; projectName: string; date: string }[] = [];
    formsList.forEach((f) => {
      (f.bills || []).forEach((b) => {
        result.push({
          form: f,
          expenseItemName: b.expenseItemName || '未分类',
          projectName: b.projectName || '无项目',
          date: b.invoiceDate || f.formDate,
        });
      });
    });
    return result;
  }, [formsList]);

  // 按维度汇总
  const summaryData = useMemo(() => {
    const groups: Record<string, { count: number; amount: number; forms: Set<string>; bills: typeof allBills }> = {};

    const keyOf = (dim: Dimension): string => {
      return dim;
    };

    if (activeDim === 'paid') {
      formsList.forEach((f) => {
        const k = f.isPaid ? '已打款' : '未打款';
        if (!groups[k]) groups[k] = { count: 0, amount: 0, forms: new Set(), bills: [] };
        groups[k].count += f.bills?.length || 0;
        groups[k].amount += f.totalAmount || 0;
        groups[k].forms.add(f.formNo);
      });
    } else if (activeDim === 'status') {
      formsList.forEach((f) => {
        const k = f.approvalStatusName || f.status || '草稿';
        if (!groups[k]) groups[k] = { count: 0, amount: 0, forms: new Set(), bills: [] };
        groups[k].count += f.bills?.length || 0;
        groups[k].amount += f.totalAmount || 0;
        groups[k].forms.add(f.formNo);
      });
    } else if (activeDim === 'expense') {
      allBills.forEach((b) => {
        const k = b.expenseItemName;
        if (!groups[k]) groups[k] = { count: 0, amount: 0, forms: new Set(), bills: [] };
        groups[k].count += 1;
        groups[k].amount += b.form.totalAmount || 0;
        groups[k].forms.add(b.form.formNo);
        groups[k].bills.push(b);
      });
    } else if (activeDim === 'project') {
      allBills.forEach((b) => {
        const k = b.projectName;
        if (!groups[k]) groups[k] = { count: 0, amount: 0, forms: new Set(), bills: [] };
        groups[k].count += 1;
        groups[k].amount += b.form.totalAmount || 0;
        groups[k].forms.add(b.form.formNo);
        groups[k].bills.push(b);
      });
    } else if (activeDim === 'date') {
      allBills.forEach((b) => {
        const k = b.date;
        if (!groups[k]) groups[k] = { count: 0, amount: 0, forms: new Set(), bills: [] };
        groups[k].count += 1;
        groups[k].amount += b.form.totalAmount || 0;
        groups[k].forms.add(b.form.formNo);
        groups[k].bills.push(b);
      });
    }

    // 转为数组并排序
    return Object.entries(groups)
      .map(([key, val]) => ({
        key,
        count: val.count,
        amount: val.amount,
        formCount: val.forms.size,
        formNos: Array.from(val.forms),
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [activeDim, formsList, allBills]);

  const dimensions: { id: Dimension; label: string }[] = [
    { id: 'paid', label: '是否打款' },
    { id: 'status', label: '审批状态' },
    { id: 'expense', label: '费用项目' },
    { id: 'project', label: '项目' },
    { id: 'date', label: '日期' },
  ];

  const totalAmount = summaryData.reduce((s, r) => s + r.amount, 0);
  const totalCount = summaryData.reduce((s, r) => s + r.count, 0);

  // 穿透：点击某行后展开该行关联的单据列表
  if (drillDownKey) {
    const row = summaryData.find((r) => r.key === drillDownKey);
    if (!row) {
      setDrillDownKey(null);
      return null;
    }
    // 从 formsList 找到这些单据
    const drillForms = formsList.filter((f) => row.formNos.includes(f.formNo));

    return (
      <div className="p-4 sm:p-6 max-w-6xl mx-auto">
        <button
          onClick={() => setDrillDownKey(null)}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 mb-4 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          返回汇总
        </button>
        <div className="bg-[#0d1424] rounded-lg shadow-sm border border-white/[0.06] overflow-hidden">
          <div className="px-5 py-3 bg-white/[0.02] border-b border-white/[0.06]">
            <h3 className="text-sm font-bold text-slate-100">
              {drillDownKey} — 关联单据明细（{drillForms.length} 张单据）
            </h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/[0.04] text-slate-300 border-b border-white/[0.06] h-12">
                <th className="px-4 text-left whitespace-nowrap">单据编号</th>
                <th className="px-4 text-left whitespace-nowrap">单据日期</th>
                <th className="px-4 text-left whitespace-nowrap">报销人</th>
                <th className="px-4 text-left whitespace-nowrap">审批状态</th>
                <th className="px-4 text-left whitespace-nowrap">打款</th>
                <th className="px-4 text-left whitespace-nowrap">价税合计</th>
                <th className="px-4 text-left whitespace-nowrap">操作</th>
              </tr>
            </thead>
            <tbody>
              {drillForms.map((f) => (
                <tr
                  key={f.formNo}
                  className="border-b border-white/[0.04] hover:bg-sky-500/5 transition-colors h-14"
                >
                  <td className="px-4 font-mono font-medium text-slate-100">{f.formNo}</td>
                  <td className="px-4 text-slate-400">{f.formDate}</td>
                  <td className="px-4 text-slate-400">{f.applicant}</td>
                  <td className="px-4">
                    <span className="badge badge-accent">
                      {f.approvalStatusName || f.status}
                    </span>
                  </td>
                  <td className="px-4">
                    {f.isPaid ? (
                      <span className="text-emerald-300 font-medium">已打款</span>
                    ) : (
                      <span className="text-slate-400">未打款</span>
                    )}
                  </td>
                  <td className="px-4 text-left font-mono font-bold amount-mint">
                    ¥{(f.totalAmount || 0).toFixed(2)}
                  </td>
                  <td className="px-4 text-left">
                    <button
                      onClick={() => onOpenForm(f.formNo)}
                      className="text-sky-300 hover:text-sky-200 hover:underline font-medium"
                    >
                      查看单据
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <BarChart3 className="w-5 h-5 text-sky-400" />
        <h2 className="text-base font-bold text-slate-100">汇总分项报表</h2>
        <span className="text-xs text-slate-400 ml-2">点击任意汇总行可穿透到关联单据</span>
      </div>

      {/* Dimension Tabs */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {dimensions.map((d) => (
          <button
            key={d.id}
            onClick={() => setActiveDim(d.id)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
              activeDim === d.id
                ? 'btn-primary text-white shadow-sm'
                : 'bg-white/[0.03] text-slate-400 border border-white/10 hover:border-white/20 hover:bg-white/[0.06]'
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* Summary Table */}
      <div className="bg-[#0d1424] rounded-lg shadow-sm border border-white/[0.06] overflow-hidden">
        <div className="px-5 py-3 bg-white/[0.02] border-b border-white/[0.06] flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-200">
            按【{dimensions.find((d) => d.id === activeDim)?.label}】汇总
          </h3>
          <div className="text-xs text-slate-400">
            共 {summaryData.length} 项 | 发票 {totalCount} 张 | 合计 ¥{totalAmount.toFixed(2)}
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/[0.04] text-slate-300 border-b border-white/[0.06] h-12">
              <th className="px-4 text-left w-1/3 whitespace-nowrap">
                {dimensions.find((d) => d.id === activeDim)?.label}
              </th>
              <th className="px-4 text-left whitespace-nowrap">单据数</th>
              <th className="px-4 text-left whitespace-nowrap">发票数</th>
              <th className="px-4 text-left whitespace-nowrap">价税合计</th>
              <th className="px-4 text-left whitespace-nowrap">占比</th>
              <th className="px-4 text-left whitespace-nowrap">操作</th>
            </tr>
          </thead>
          <tbody>
            {summaryData.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-slate-400">
                  <div className="text-center">暂无数据</div>
                </td>
              </tr>
            ) : (
              summaryData.map((row) => (
                <tr
                  key={row.key}
                  className="border-b border-white/[0.04] hover:bg-sky-500/5 transition-colors cursor-pointer h-14"
                  onClick={() => setDrillDownKey(row.key)}
                >
                  <td className="px-4 font-medium text-slate-100 text-left">{row.key}</td>
                  <td className="px-4 text-left text-slate-400">{row.formCount}</td>
                  <td className="px-4 text-left text-slate-400">{row.count}</td>
                  <td className="px-4 text-left font-mono font-bold amount-mint">
                    ¥{row.amount.toFixed(2)}
                  </td>
                  <td className="px-4 text-left text-slate-400">
                    {totalAmount > 0 ? ((row.amount / totalAmount) * 100).toFixed(1) : '0'}%
                  </td>
                  <td className="px-4 text-left">
                    <span className="inline-flex items-center gap-0.5 text-sky-300 hover:text-sky-200 font-medium">
                      穿透
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {summaryData.length > 0 && (
            <tfoot>
              <tr className="bg-white/[0.03] border-t-2 border-white/[0.06] font-bold h-12">
                <td className="px-4 text-slate-100">合计</td>
                <td className="px-4 text-left text-slate-300">
                  {summaryData.reduce((s, r) => s + r.formCount, 0)}
                </td>
                <td className="px-4 text-left text-slate-300">{totalCount}</td>
                <td className="px-4 text-left font-mono amount-mint">
                  ¥{totalAmount.toFixed(2)}
                </td>
                <td className="px-4 text-left text-slate-400">100%</td>
                <td className="px-4"></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};
