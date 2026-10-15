import React, { useState, useMemo } from 'react';
import {
  Tag,
  Plus,
  Search,
  Edit2,
  Trash2,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { ConsumptionTypeMaster } from '../types/reimbursement';
import { INITIAL_CONSUMPTION_TYPES } from '../data/initialData';

interface ConsumptionTypeMasterViewProps {
  consumptionTypeMasters: ConsumptionTypeMaster[];
  setConsumptionTypeMasters: React.Dispatch<React.SetStateAction<ConsumptionTypeMaster[]>>;
}

// Common preset tax major categories for easy selection
const PRESET_TAX_MAJOR_CATEGORIES = [
  '运输服务',
  '餐饮住宿服务',
  '生活服务',
  '电信服务',
  '销售货物',
  '现代服务',
  '商务辅助服务',
];

const TYPE_COLOR_PALETTE = [
  'bg-sky-500/15 text-sky-300 border-sky-500/30',
  'bg-amber-500/15 text-amber-300 border-amber-500/30',
  'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
  'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  'bg-rose-500/15 text-rose-300 border-rose-500/30',
  'bg-teal-500/15 text-teal-300 border-teal-500/30',
  'bg-orange-500/15 text-orange-300 border-orange-500/30',
  'bg-violet-500/15 text-violet-300 border-violet-500/30',
  'bg-lime-500/15 text-lime-300 border-lime-500/30',
];

export const ConsumptionTypeMasterView: React.FC<ConsumptionTypeMasterViewProps> = ({
  consumptionTypeMasters,
  setConsumptionTypeMasters,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('all');

  // 从用户已有规则中动态提取全部消费类型名称（完全由用户自定义，无预设限制）
  const existingTypes = useMemo(() => {
    const set = new Set<string>();
    consumptionTypeMasters.forEach((r) => {
      if (r.consumptionType.trim()) set.add(r.consumptionType.trim());
    });
    return Array.from(set);
  }, [consumptionTypeMasters]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ConsumptionTypeMaster | null>(null);

  // Form Fields
  const [formCode, setFormCode] = useState('');
  const [formConsumptionType, setFormConsumptionType] = useState('');
  const [formTaxMajor, setFormTaxMajor] = useState('');
  const [formTaxSub, setFormTaxSub] = useState('');
  const [formKeywords, setFormKeywords] = useState('');
  const [formPriority, setFormPriority] = useState<number>(1);
  const [formStatus, setFormStatus] = useState<'enabled' | 'disabled'>('enabled');
  const [formDescription, setFormDescription] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Interactive Test Sandbox State (实时税务分类匹配模拟器)
  const [testInput, setTestInput] = useState('*运输服务*铁路电子客票（G123次二等座）');

  // Match evaluator logic
  const evaluateMatch = (input: string) => {
    if (!input.trim()) return null;
    const lower = input.toLowerCase();
    const activeRules = [...consumptionTypeMasters]
      .filter((r) => r.status === 'enabled')
      .sort((a, b) => a.priority - b.priority);

    for (const rule of activeRules) {
      // 1. Check keyword hit
      if (rule.keywords && rule.keywords.length > 0) {
        const hitKw = rule.keywords.find((kw) => kw && lower.includes(kw.toLowerCase()));
        if (hitKw) {
          return {
            rule,
            reason: `命中关键词【${hitKw}】`,
            matchedType: rule.consumptionType,
          };
        }
      }
      // 2. Check major and sub category match
      const majorHit = rule.taxMajorCategory && lower.includes(rule.taxMajorCategory.toLowerCase());
      const subHit = rule.taxSubCategory && lower.includes(rule.taxSubCategory.toLowerCase());

      if (majorHit && subHit) {
        return {
          rule,
          reason: `同时命中税务大类【${rule.taxMajorCategory}】与小类【${rule.taxSubCategory}】`,
          matchedType: rule.consumptionType,
        };
      }
      if (majorHit && !rule.taxSubCategory) {
        return {
          rule,
          reason: `命中税务大类【${rule.taxMajorCategory}】`,
          matchedType: rule.consumptionType,
        };
      }
      if (subHit) {
        return {
          rule,
          reason: `命中税务小类【${rule.taxSubCategory}】`,
          matchedType: rule.consumptionType,
        };
      }
    }

    return {
      rule: null,
      reason: '未匹配到任何启用的特定规则，回退到默认【其他】',
      matchedType: '其他',
    };
  };

  const testResult = useMemo(() => evaluateMatch(testInput), [testInput, consumptionTypeMasters]);

  // Filtered rules
  const filteredRules = useMemo(() => {
    return consumptionTypeMasters
      .filter((item) => {
        if (selectedTypeFilter !== 'all' && item.consumptionType !== selectedTypeFilter) {
          return false;
        }
        if (!searchTerm.trim()) return true;
        const q = searchTerm.toLowerCase();
        return (
          item.code.toLowerCase().includes(q) ||
          item.consumptionType.toLowerCase().includes(q) ||
          item.taxMajorCategory.toLowerCase().includes(q) ||
          item.taxSubCategory.toLowerCase().includes(q) ||
          item.keywords.some((k) => k.toLowerCase().includes(q)) ||
          (item.description && item.description.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => a.priority - b.priority);
  }, [consumptionTypeMasters, selectedTypeFilter, searchTerm]);

  // Open Add Modal
  const handleOpenAddModal = () => {
    setEditingItem(null);
    const nextNum = consumptionTypeMasters.length + 1;
    setFormCode(`CT${String(nextNum).padStart(3, '0')}`);
    setFormConsumptionType('');
    setFormTaxMajor('运输服务');
    setFormTaxSub('');
    setFormKeywords('');
    setFormPriority(nextNum);
    setFormStatus('enabled');
    setFormDescription('');
    setErrorMsg('');
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (item: ConsumptionTypeMaster) => {
    setEditingItem(item);
    setFormCode(item.code);
    setFormConsumptionType(item.consumptionType);
    setFormTaxMajor(item.taxMajorCategory);
    setFormTaxSub(item.taxSubCategory);
    setFormKeywords(item.keywords.join(', '));
    setFormPriority(item.priority);
    setFormStatus(item.status);
    setFormDescription(item.description || '');
    setErrorMsg('');
    setIsModalOpen(true);
  };

  // Save Modal
  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCode.trim()) {
      setErrorMsg('请输入规则编码');
      return;
    }
    if (!formConsumptionType.trim()) {
      setErrorMsg('请输入您指定的匹配后消费类型名称');
      return;
    }
    if (!formTaxMajor.trim() && !formTaxSub.trim() && !formKeywords.trim()) {
      setErrorMsg('请至少填写税务大类、税务小类或匹配关键词中的一项');
      return;
    }

    const parsedKeywords = formKeywords
      .split(/[,，\s]+/)
      .map((k) => k.trim())
      .filter(Boolean);

    if (editingItem) {
      setConsumptionTypeMasters((prev) =>
        prev.map((r) =>
          r.id === editingItem.id
            ? {
                ...r,
                code: formCode.trim(),
                consumptionType: formConsumptionType.trim(),
                taxMajorCategory: formTaxMajor.trim(),
                taxSubCategory: formTaxSub.trim(),
                keywords: parsedKeywords,
                priority: Number(formPriority) || 1,
                status: formStatus,
                description: formDescription.trim(),
              }
            : r
        )
      );
    } else {
      const newRule: ConsumptionTypeMaster = {
        id: `ct-${Date.now()}`,
        code: formCode.trim(),
        consumptionType: formConsumptionType.trim(),
        taxMajorCategory: formTaxMajor.trim(),
        taxSubCategory: formTaxSub.trim(),
        keywords: parsedKeywords,
        priority: Number(formPriority) || 1,
        status: formStatus,
        description: formDescription.trim(),
      };
      setConsumptionTypeMasters((prev) => [...prev, newRule]);
    }

    setIsModalOpen(false);
  };

  // Toggle Rule Status
  const handleToggleStatus = (id: string) => {
    setConsumptionTypeMasters((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, status: r.status === 'enabled' ? 'disabled' : 'enabled' }
          : r
      )
    );
  };

  // Delete Rule
  const handleDeleteRule = (id: string, code: string) => {
    if (window.confirm(`确定要删除规则【${code}】吗？`)) {
      setConsumptionTypeMasters((prev) => prev.filter((r) => r.id !== id));
    }
  };

  // Reset to default
  const handleResetDefaults = () => {
    if (window.confirm('确定要恢复为系统默认的消费类型税务匹配规则吗？')) {
      setConsumptionTypeMasters(INITIAL_CONSUMPTION_TYPES);
    }
  };

  // Badge color helper：按名称哈希稳定取色，支持任意自定义类型名
  const getConsumptionTypeBadge = (type: string) => {
    let hash = 0;
    for (let i = 0; i < type.length; i++) {
      hash = (hash * 31 + type.charCodeAt(i)) >>> 0;
    }
    return TYPE_COLOR_PALETTE[hash % TYPE_COLOR_PALETTE.length];
  };

  return (
    <div className="p-3 sm:p-5 max-w-[1600px] mx-auto space-y-4">
      <div className="glass-card p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500/20 to-sky-500/20 border border-indigo-500/30 flex items-center justify-center text-sky-300 shrink-0 shadow-[0_0_18px_rgba(99,102,241,0.18)]">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-100 tracking-tight">
                  消费类型
                </h1>
                <span className="text-xs bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded font-mono">
                  共 {consumptionTypeMasters.length} 条匹配规则
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                设置发票识别出的【税务大类/小类/关键词】条件，并自定义命中后的消费类型名称；匹配结果完全按您指定的名称归属，驱动记账与报销聚合。
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleResetDefaults}
              className="btn-ghost flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium cursor-pointer"
              title="重置为系统预设规则"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>恢复默认规则</span>
            </button>

            <button
              onClick={handleOpenAddModal}
              className="btn-flame flex items-center gap-1.5 px-3.5 py-1.5 rounded text-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>新增匹配规则</span>
            </button>
          </div>
        </div>
      </div>

      <div className="glass-card p-3.5 bg-gradient-to-r from-sky-500/[0.06] via-indigo-500/[0.05] to-transparent">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-100">
            <Sparkles className="w-4 h-4 text-sky-400" />
            <span>实时税务分类匹配校验测试</span>
            <span className="text-[11px] font-normal text-slate-400">
              （输入发票货物名称或税务分类，即时预览规则匹配效果）
            </span>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              placeholder="如：*运输服务*客运车票、*餐饮服务*工作餐、*住宿服务*房费..."
              className="input-dark w-full px-3 py-2 text-xs"
            />
            {testInput && (
              <button
                onClick={() => setTestInput('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-xs"
              >
                清空
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 bg-white/[0.03] px-3 py-2 border border-white/[0.06] rounded shrink-0">
            <span className="text-xs text-slate-400">匹配结果:</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            {testResult ? (
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs px-2 py-0.5 rounded font-bold border ${getConsumptionTypeBadge(
                    testResult.matchedType
                  )}`}
                >
                  {testResult.matchedType}
                </span>
                {testResult.rule && (
                  <span className="text-[11px] font-mono text-slate-400 bg-white/[0.05] px-1.5 py-0.5 rounded border border-white/[0.06]">
                    规则: {testResult.rule.code} (优先级 {testResult.rule.priority})
                  </span>
                )}
                <span className="text-[11px] text-slate-400 hidden lg:inline">
                  [{testResult.reason}]
                </span>
              </div>
            ) : (
              <span className="text-xs text-slate-400">请输入文本测试</span>
            )}
          </div>
        </div>
      </div>

      <div className="glass-card p-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="搜索规则编码、税务大类、小类、关键词或消费类型..."
            className="input-dark w-full pl-9 pr-3 py-1.5 text-xs"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 no-scrollbar">
          <button
            onClick={() => setSelectedTypeFilter('all')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer shrink-0 ${
              selectedTypeFilter === 'all'
                ? 'bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-semibold shadow-[0_0_12px_rgba(56,189,248,0.35)]'
                : 'bg-white/[0.05] text-slate-300 hover:bg-white/[0.08] border border-white/[0.06]'
            }`}
          >
            全部类型
          </button>
          {existingTypes.map((type) => (
            <button
              key={type}
              onClick={() => setSelectedTypeFilter(type)}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                selectedTypeFilter === type
                  ? 'bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-semibold shadow-[0_0_12px_rgba(56,189,248,0.35)]'
                  : 'bg-white/[0.05] text-slate-300 hover:bg-white/[0.08] border border-white/[0.06]'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <div className="surface-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-dark">
            <thead>
              <tr className="h-12">
                <th className="px-4 w-16 text-center whitespace-nowrap">优先级</th>
                <th className="px-4 w-24 whitespace-nowrap">规则编码</th>
                <th className="px-4 w-28 whitespace-nowrap">匹配后消费类型</th>
                <th className="px-4 w-36 whitespace-nowrap">识别税务大类</th>
                <th className="px-4 w-40 whitespace-nowrap">识别税务小类</th>
                <th className="px-4 min-w-[200px] whitespace-nowrap">匹配关键词标签</th>
                <th className="px-4 min-w-[150px] whitespace-nowrap">规则说明</th>
                <th className="px-4 w-24 text-center whitespace-nowrap">状态</th>
                <th className="px-4 w-24 text-center whitespace-nowrap">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredRules.length > 0 ? (
                filteredRules.map((rule) => {
                  const isEnabled = rule.status === 'enabled';
                  return (
                    <tr
                      key={rule.id}
                      className={`hover:bg-white/[0.04] transition-colors ${
                        !isEnabled ? 'opacity-50 bg-white/[0.02]' : ''
                      }`}
                    >
                      <td className="py-2 px-3 text-center font-mono font-bold text-slate-400">
                        {rule.priority}
                      </td>
                      <td className="py-2 px-3 font-mono font-medium text-slate-200">
                        {rule.code}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-semibold border ${getConsumptionTypeBadge(
                            rule.consumptionType
                          )}`}
                        >
                          {rule.consumptionType}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-200 font-medium">
                        {rule.taxMajorCategory || <span className="text-slate-500">-</span>}
                      </td>
                      <td className="py-2 px-3 text-slate-300">
                        {rule.taxSubCategory || <span className="text-slate-500">任意小类</span>}
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex flex-wrap gap-1">
                          {rule.keywords && rule.keywords.length > 0 ? (
                            rule.keywords.map((kw, idx) => (
                              <span
                                key={idx}
                                className="bg-white/[0.06] text-slate-300 border border-white/[0.08] px-1.5 py-0.2 rounded text-[11px]"
                              >
                                {kw}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-500 text-[11px]">-</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-slate-400 text-[11px] truncate max-w-[200px]" title={rule.description}>
                        {rule.description || '-'}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <button
                          onClick={() => handleToggleStatus(rule.id)}
                          className={`relative inline-flex h-4.5 w-8 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            isEnabled
                              ? 'bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.35)]'
                              : 'bg-slate-600'
                          }`}
                          title={isEnabled ? '点击停用' : '点击启用'}
                        >
                          <span
                            className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              isEnabled ? 'translate-x-3.5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <div className="flex items-center justify-start gap-1.5">
                          <button
                            onClick={() => handleOpenEditModal(rule)}
                            className="p-1 text-slate-400 hover:text-sky-300 hover:bg-sky-500/10 rounded transition-colors"
                            title="编辑规则"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteRule(rule.id, rule.code)}
                            className="p-1 text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 rounded transition-colors"
                            title="删除规则"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500 text-xs">
                    没有找到符合条件的消费类型匹配规则
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3">
          <div className="surface-card w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-white/[0.03]">
              <h3 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-sky-400" />
                <span>{editingItem ? '编辑消费类型规则' : '新增消费类型规则'}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 rounded p-1 text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="p-4 space-y-3 text-xs">
              {errorMsg && (
                <div className="p-2 bg-rose-500/10 border border-rose-500/30 rounded text-rose-300 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    规则编码 <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    placeholder="如：CT001"
                    className="input-dark w-full px-2.5 py-1.5 font-mono text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    优先级（数字越小越优先）
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={formPriority}
                    onChange={(e) => setFormPriority(Number(e.target.value) || 1)}
                    className="input-dark w-full px-2.5 py-1.5 font-mono text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  匹配后的消费类型名称 <span className="text-rose-400">*</span>
                  <span className="ml-1.5 font-normal text-slate-400">（由您自定义，发票命中此规则后即归属该类型）</span>
                </label>
                <input
                  type="text"
                  value={formConsumptionType}
                  onChange={(e) => setFormConsumptionType(e.target.value)}
                  list="existing-consumption-types"
                  placeholder="请输入您指定的类型名称，如：交通、住宿、市内打车、高铁出行..."
                  className="input-dark w-full px-2.5 py-1.5 text-xs"
                  required
                />
                <datalist id="existing-consumption-types">
                  {existingTypes.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
                {existingTypes.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    <span className="text-[11px] text-slate-400">已有类型快捷填入:</span>
                    {existingTypes.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setFormConsumptionType(t)}
                        className={`px-2 py-0.5 rounded border text-[11px] transition-colors ${
                          formConsumptionType === t
                            ? 'bg-gradient-to-r from-sky-500 to-indigo-500 text-white border-transparent font-medium'
                            : 'bg-white/[0.05] hover:bg-white/[0.08] border-white/[0.06] text-slate-300'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  识别税务大类
                </label>
                <div className="flex flex-wrap gap-1 mb-1">
                  {PRESET_TAX_MAJOR_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setFormTaxMajor(cat)}
                      className={`px-1.5 py-0.5 rounded border text-[11px] transition-colors ${
                        formTaxMajor === cat
                          ? 'bg-gradient-to-r from-sky-500 to-indigo-500 text-white border-transparent'
                          : 'bg-white/[0.05] hover:bg-white/[0.08] border-white/[0.06] text-slate-300'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={formTaxMajor}
                  onChange={(e) => setFormTaxMajor(e.target.value)}
                  placeholder="如：运输服务、餐饮住宿服务、生活服务..."
                  className="input-dark w-full px-2.5 py-1.5 text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  识别税务小类 / 货物服务分类
                </label>
                <input
                  type="text"
                  value={formTaxSub}
                  onChange={(e) => setFormTaxSub(e.target.value)}
                  placeholder="如：铁路旅客运输、旅客航空服务、住宿服务、餐饮服务..."
                  className="input-dark w-full px-2.5 py-1.5 text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  匹配关键词（用逗号或空格隔开）
                </label>
                <input
                  type="text"
                  value={formKeywords}
                  onChange={(e) => setFormKeywords(e.target.value)}
                  placeholder="如：火车票, 高铁, 动车, 中铁, 二等座..."
                  className="input-dark w-full px-2.5 py-1.5 text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  规则说明 / 备注
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="输入此规则的业务用途或适用说明..."
                  rows={2}
                  className="input-dark w-full px-2.5 py-1.5 text-xs"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="formStatusToggle"
                  checked={formStatus === 'enabled'}
                  onChange={(e) => setFormStatus(e.target.checked ? 'enabled' : 'disabled')}
                  className="cb-dark"
                />
                <label htmlFor="formStatusToggle" className="text-slate-300 select-none cursor-pointer">
                  立即启用该匹配规则
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-ghost px-3 py-1.5 rounded text-xs"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="btn-mint px-4 py-1.5 rounded text-xs"
                >
                  保存规则
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
