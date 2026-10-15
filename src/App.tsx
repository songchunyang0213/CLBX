import React, { useState, useMemo, useEffect, useRef } from 'react';
import { X, Trash2, ShieldCheck, AlertCircle, Printer, CheckCircle2 } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { TopHeader, WorkspaceTab } from './components/TopHeader';
import { FormHeader } from './components/FormHeader';
import { ReimbursementTable } from './components/ReimbursementTable';
import { BillTable } from './components/BillTable';
import { AddBillModal } from './components/AddBillModal';
import { TraceabilityModal } from './components/TraceabilityModal';
import { BatchEditModal } from './components/BatchEditModal';
import { InvoicePreviewModal } from './components/InvoicePreviewModal';
import { ExpenseMasterView } from './components/ExpenseMasterView';
import { TransportMasterView } from './components/TransportMasterView';
import { ProjectMasterView } from './components/ProjectMasterView';
import { LocationMasterView } from './components/LocationMasterView';
import { EmployeeMasterView } from './components/EmployeeMasterView';
import { StatusMasterView } from './components/StatusMasterView';
import { ConsumptionTypeMasterView } from './components/ConsumptionTypeMasterView';
import { SummaryReportView } from './components/SummaryReportView';
import { HomeDashboard, DeleteFormMode } from './components/HomeDashboard';
import { PrintSummaryModal } from './components/PrintSummaryModal';
import { PersonalBillsView } from './components/PersonalBillsView';
import { ImportFromPersonalBillsModal } from './components/ImportFromPersonalBillsModal';

import {
  INITIAL_EXPENSE_ITEMS,
  INITIAL_TRANSPORTS,
  INITIAL_PROJECTS,
  INITIAL_LOCATIONS,
  INITIAL_EMPLOYEES,
  INITIAL_APPROVAL_STATUSES,
  INITIAL_CONSUMPTION_TYPES,
  INITIAL_FORM,
  INITIAL_FORMS_LIST,
  INITIAL_PERSONAL_FOLDERS,
  INITIAL_PERSONAL_BILLS,
} from './data/initialData';
import {
  ExpenseItemMaster,
  TransportMaster,
  ProjectMaster,
  LocationMaster,
  EmployeeMaster,
  ApprovalStatusMaster,
  ConsumptionTypeMaster,
  ReimbursementForm,
  BillItem,
  ReimbursementItem,
  PersonalBillFolder,
  PersonalBillItem,
} from './types/reimbursement';
import { calculateReimbursement } from './utils/reimbursementCalculator';
import {
  generateNextFormNo,
  validateFormNo,
  migrateLegacyFormNo,
} from './utils/formNoGenerator';
import { initDbClient, kvGetString, kvSet, kvSetAsync, getStorageMode } from './utils/dbClient';

/** 数据已完成首次种子初始化的标记键：一旦写入，空列表也必须被尊重（删除后刷新不回弹） */
const SEED_FLAG_KEY = 'shuqi_seeded_v1';

function safeParse<T>(key: string, fallback: T): T {
  try {
    const saved = kvGetString(key);
    if (saved === null || saved === undefined) return fallback;
    const parsed = JSON.parse(saved);
    if (parsed === null || parsed === undefined) return fallback;
    return parsed;
  } catch (e) {
    console.warn(`Failed to parse storage key ${key}, falling back to initial data`, e);
    return fallback;
  }
}

/**
 * 恢复某一类内置档案：按固定 id 找出已被删除的内置项并追加回列表尾部（视图按 sortOrder 排序，
 * 追加不影响最终展示顺序）。用户自行新增的项与未删除的内置项均保持不动。
 * 返回本次补回的条数。深拷贝以彻底解耦 INITIAL_* 常量（消费类型含 keywords 数组等嵌套结构）。
 */
function restoreMissingBuiltins<T extends { id: string }>(
  current: T[],
  defaults: T[],
  setter: React.Dispatch<React.SetStateAction<T[]>>
): number {
  const existingIds = new Set(current.map((c) => c.id));
  const missing = defaults.filter((d) => !existingIds.has(d.id));
  if (missing.length > 0) {
    const clones: T[] = JSON.parse(JSON.stringify(missing));
    setter((prev) => [...prev, ...clones]);
  }
  return missing.length;
}

/**
 * 保证列表中每条数据的 id 唯一：重复 id 追加 -2、-3… 后缀。
 * 用于修复历史批量采集在同一毫秒内生成重复账单 id 的问题
 * （重复 id 会导致勾选其中任意一张时，其他同 id 账单一起被选中，表现为"单击复选框变全选"）。
 */
function ensureUniqueIds<T extends { id: string }>(list: T[]): T[] {
  if (!Array.isArray(list)) return list;
  const seen = new Set<string>();
  let changed = false;
  const next = list.map((item) => {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      return item;
    }
    changed = true;
    let n = 2;
    let candidate = `${item.id}-${n}`;
    while (seen.has(candidate)) {
      n++;
      candidate = `${item.id}-${n}`;
    }
    seen.add(candidate);
    return { ...item, id: candidate };
  });
  return changed ? next : list;
}

/** 启动加载层：先从 SQLite 拉取数据，就绪后再挂载业务组件（保证 useState 初值来自数据库） */
export default function App() {
  const [storageReady, setStorageReady] = useState(false);
  const [storageMode, setStorageMode] = useState<'server' | 'local'>('local');

  useEffect(() => {
    let cancelled = false;
    initDbClient().then((m) => {
      if (cancelled) return;
      // 首帧前恢复主题，避免浅色用户看到深色闪烁
      const savedTheme = kvGetString('shuqi_theme_mode');
      document.documentElement.setAttribute(
        'data-theme',
        savedTheme === 'light' ? 'light' : 'dark'
      );
      setStorageMode(m);
      setStorageReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!storageReady) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#070b16]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-[3px] border-slate-700 border-t-sky-400 rounded-full animate-spin shadow-[0_0_18px_rgba(56,189,248,0.35)]" />
          <div className="text-xs text-slate-400">正在从本地数据库加载数据…</div>
        </div>
      </div>
    );
  }

  return <AppInner key={storageMode} />;
}

function AppInner() {
  // 1. Archives & Master State (Safe loading from storage)
  const [expenseMasters, setExpenseMasters] = useState<ExpenseItemMaster[]>(() =>
    safeParse('shuqi_expense_masters', INITIAL_EXPENSE_ITEMS)
  );

  const [transportMasters, setTransportMasters] = useState<TransportMaster[]>(() =>
    safeParse('shuqi_transport_masters', INITIAL_TRANSPORTS)
  );

  const [projectMasters, setProjectMasters] = useState<ProjectMaster[]>(() =>
    safeParse('shuqi_project_masters', INITIAL_PROJECTS)
  );

  const [locationMasters, setLocationMasters] = useState<LocationMaster[]>(() =>
    safeParse('shuqi_location_masters', INITIAL_LOCATIONS)
  );

  const [employeeMasters, setEmployeeMasters] = useState<EmployeeMaster[]>(() =>
    safeParse('shuqi_employee_masters', INITIAL_EMPLOYEES)
  );

  const [statusMasters, setStatusMasters] = useState<ApprovalStatusMaster[]>(() =>
    safeParse('shuqi_status_masters', INITIAL_APPROVAL_STATUSES)
  );

  const [consumptionTypeMasters, setConsumptionTypeMasters] = useState<ConsumptionTypeMaster[]>(() => {
    const list = safeParse<ConsumptionTypeMaster[] | null>('shuqi_consumption_types', null);
    const ALLOWED_CATEGORIES = ['替票', '交通', '住宿'];
    if (Array.isArray(list)) {
      // 迁移：旧档案中存在三种以外的消费类型时，整体替换为新的三类规则
      if (list.some((r) => !ALLOWED_CATEGORIES.includes(r.consumptionType))) {
        return INITIAL_CONSUMPTION_TYPES;
      }
      // 已有数据仅含三种时，补齐缺失的类别
      const existingCats = new Set(list.map((r) => r.consumptionType));
      const missing = INITIAL_CONSUMPTION_TYPES.filter((r) => !existingCats.has(r.consumptionType));
      return missing.length > 0 ? [...list, ...missing] : list;
    }
    return INITIAL_CONSUMPTION_TYPES;
  });

  const [subsidyRate, setSubsidyRate] = useState<number>(() =>
    safeParse('shuqi_subsidy_rate', 50)
  );

  // 明暗主题：深色为默认，切换后持久化
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>(() =>
    kvGetString('shuqi_theme_mode') === 'light' ? 'light' : 'dark'
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeMode);
    kvSetAsync('shuqi_theme_mode', themeMode);
  }, [themeMode]);
  const [isSubsidyModalOpen, setIsSubsidyModalOpen] = useState(false);
  const [tempSubsidyRate, setTempSubsidyRate] = useState<number>(subsidyRate);

  const [rowOverrides, setRowOverrides] = useState<
    Record<string, { subsidyDays?: number; departure?: string; destination?: string; remarks?: string }>
  >({});

  const [manualRows, setManualRows] = useState<ReimbursementItem[]>([]);

  // 行覆盖与手工行按单据编号隔离持久化：避免切换单据时被清空且回不来
  // 形如 { 'TERB20260926001': { overrides: {...}, manualRows: [...] } }
  type FormRowState = {
    overrides: Record<string, { subsidyDays?: number; departure?: string; destination?: string; remarks?: string }>;
    manualRows: ReimbursementItem[];
  };
  const [rowStateByForm, setRowStateByForm] = useState<Record<string, FormRowState>>(() => {
    const stored = safeParse<Record<string, FormRowState>>('shuqi_row_state_by_form', {});
    if (stored && Object.keys(stored).length > 0) return stored;
    // 一次性迁移：把旧版全局共享的 row_overrides / manual_rows 收编到当前单据名下
    const legacyOverrides = safeParse('shuqi_row_overrides', {});
    const legacyManualRows = safeParse('shuqi_manual_rows', []);
    if (
      (legacyOverrides && Object.keys(legacyOverrides).length > 0) ||
      (legacyManualRows && legacyManualRows.length > 0)
    ) {
      const legacyForm = safeParse<ReimbursementForm>('shuqi_reimbursement_form', INITIAL_FORM);
      const legacyFormNo = legacyForm?.formNo;
      if (legacyFormNo) {
        return {
          [legacyFormNo]: {
            overrides: legacyOverrides || {},
            manualRows: legacyManualRows || [],
          },
        };
      }
    }
    return {};
  });

  // 1.1 Personal bills & folders repository
  const [personalFolders, setPersonalFolders] = useState<PersonalBillFolder[]>(() =>
    safeParse('shuqi_personal_folders', INITIAL_PERSONAL_FOLDERS)
  );

  const [personalBills, setPersonalBills] = useState<PersonalBillItem[]>(() =>
    safeParse('shuqi_personal_bills', INITIAL_PERSONAL_BILLS)
  );

  const [isImportPersonalOpen, setIsImportPersonalOpen] = useState(false);

  // 2. Multi-form list for Home Dashboard
  const [formsList, setFormsList] = useState<ReimbursementForm[]>(() => {
    const loaded = safeParse<ReimbursementForm[] | null>('shuqi_forms_list', null);
    const list = Array.isArray(loaded) ? loaded : INITIAL_FORMS_LIST;
    console.log('[App] formsList init:', JSON.stringify({ loaded: Array.isArray(loaded) ? loaded.length : loaded, listLength: list.length }));
    return list.map((f, idx) => ({
      ...f,
      id: f.id || `form-${idx + 1}`,
      formNo: migrateLegacyFormNo(f.formNo),
    }));
  });

  // 3. Current active form & its bills
  const [form, setForm] = useState<ReimbursementForm>(() => {
    const loaded = safeParse<ReimbursementForm>('shuqi_reimbursement_form', INITIAL_FORM);
    const base = loaded && loaded.formNo ? loaded : INITIAL_FORM;
    return {
      ...base,
      id: base.id || 'form-1',
      formNo: migrateLegacyFormNo(base.formNo),
    };
  });

  const [bills, setBills] = useState<BillItem[]>(form.bills || []);

  // 4. Workspace Multi-Tabs (顶部多页签体系)
  const [openTabs, setOpenTabs] = useState<WorkspaceTab[]>([
    { id: '首页', title: '差旅报销工作台', type: '首页', closable: false },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('首页');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  // Open or switch to a workspace tab
  const openWorkspaceTab = (tab: WorkspaceTab) => {
    setOpenTabs((prev) => {
      if (prev.some((t) => t.id === tab.id)) {
        return prev;
      }
      return [...prev, tab];
    });
    setActiveTabId(tab.id);
  };

  /** 当前编辑中的单据是否已写入单据列表（新建未保存的单据不在列表内） */
  const isCurrentFormPersisted = () =>
    formsList.some((f) =>
      f.id ? f.id === form.id : f.formNo === form.formNo
    );

  /**
   * 直接丢弃当前未保存内容，不弹确认框。
   * - 未保存的新单据：不写入单据列表；
   * - 已保存单据：丢弃未落盘修改，单据保留上次保存内容。
   */
  const confirmDiscardUnsavedForm = (): boolean => true;

  // Close workspace tab
  const closeWorkspaceTab = (tabId: string) => {
    // 当前单据标签：未保存的新单据或已保存但有未落盘修改时，先确认丢弃
    if (tabId === `form-${form.formNo}`) {
      if (!confirmDiscardUnsavedForm()) return;
    }
    setOpenTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === tabId);
      if (idx === -1) return prev;
      const nextTabs = prev.filter((t) => t.id !== tabId);
      if (activeTabId === tabId) {
        const nextActive = nextTabs[Math.max(0, idx - 1)] || nextTabs[0];
        if (nextActive) {
          setActiveTabId(nextActive.id);
        }
      }
      return nextTabs;
    });
  };

  // Navigation from Sidebar
  const handleSidebarNav = (name: string) => {
    setIsMobileSidebarOpen(false);
    if (name === '差旅报销' || name === '首页') {
      openWorkspaceTab({
        id: '首页',
        title: '差旅报销工作台',
        type: '首页',
        closable: false,
      });
    } else {
      openWorkspaceTab({
        id: name,
        title: name,
        type: name,
        closable: true,
      });
    }
  };

  // 5. Selected rows for batch operations
  const [selectedRmbIds, setSelectedRmbIds] = useState<string[]>([]);
  const [selectedBillIds, setSelectedBillIds] = useState<string[]>([]);

  // 5.1 保存结果内联反馈（非右上角浮层）
  const [saveFeedback, setSaveFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const saveFeedbackTimer = useRef<number | null>(null);
  const showSaveFeedback = (type: 'success' | 'error', text: string) => {
    setSaveFeedback({ type, text });
    if (saveFeedbackTimer.current) window.clearTimeout(saveFeedbackTimer.current);
    saveFeedbackTimer.current = window.setTimeout(() => setSaveFeedback(null), 4000);
  };

  // 6. Modals
  const [isAddBillOpen, setIsAddBillOpen] = useState(false);
  const [traceItem, setTraceItem] = useState<ReimbursementItem | null>(null);
  const [previewBill, setPreviewBill] = useState<BillItem | null>(null);
  const [isBatchEditOpen, setIsBatchEditOpen] = useState(false);
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [onlyRequired, setOnlyRequired] = useState(false);
  const [formToDelete, setFormToDelete] = useState<{ form: ReimbursementForm; mode: DeleteFormMode } | null>(null);

  // Collect all invoice numbers referenced across other reimbursement forms and current form
  const allReferencedInvoiceNumbers = useMemo(() => {
    const set = new Set<string>();
    (formsList || []).forEach((f) => {
      if (f.formNo !== form.formNo && Array.isArray(f.bills)) {
        f.bills.forEach((b) => {
          if (b.invoiceNumber) set.add(b.invoiceNumber.trim());
        });
      }
    });
    // Also include current form's bills
    (bills || []).forEach((b) => {
      if (b.invoiceNumber) set.add(b.invoiceNumber.trim());
    });
    return Array.from(set);
  }, [formsList, form.formNo, bills]);

  // 7. Core Real-time Aggregation: Recalculates whenever bills, expenseMasters, subsidyRate, rowOverrides or manualRows change!
  const calculation = useMemo(() => {
    return calculateReimbursement(bills, expenseMasters, subsidyRate, rowOverrides, manualRows);
  }, [bills, expenseMasters, subsidyRate, rowOverrides, manualRows]);

  // 同步当前编辑态单据（内存 + shuqi_reimbursement_form）。
  // 注意：此处绝不同步 formsList —— formsList 只在用户点"保存"后更新，
  // 否则未保存的编辑（含发票引用标记）会立即泄漏到已保存单据。
  useEffect(() => {
    setForm((prev) => {
      if (
        prev.bills === bills &&
        prev.attachmentsCount === bills.length &&
        prev.totalAmount === calculation.totalReimbursementAmount
      ) {
        return prev;
      }
      const updated = {
        ...prev,
        bills,
        attachmentsCount: bills.length,
        totalAmount: calculation.totalReimbursementAmount,
      };
      kvSet('shuqi_reimbursement_form', JSON.stringify(updated));
      return updated;
    });
  }, [bills, calculation.totalReimbursementAmount, form.formNo, form.id]);

  useEffect(() => {
    kvSet('shuqi_forms_list', JSON.stringify(formsList));
  }, [formsList]);

  useEffect(() => {
    kvSet('shuqi_expense_masters', JSON.stringify(expenseMasters));
  }, [expenseMasters]);

  useEffect(() => {
    kvSet('shuqi_transport_masters', JSON.stringify(transportMasters));
  }, [transportMasters]);

  useEffect(() => {
    kvSet('shuqi_project_masters', JSON.stringify(projectMasters));
  }, [projectMasters]);

  useEffect(() => {
    kvSet('shuqi_location_masters', JSON.stringify(locationMasters));
  }, [locationMasters]);

  useEffect(() => {
    kvSet('shuqi_employee_masters', JSON.stringify(employeeMasters));
  }, [employeeMasters]);

  useEffect(() => {
    kvSet('shuqi_status_masters', JSON.stringify(statusMasters));
  }, [statusMasters]);

  useEffect(() => {
    kvSet('shuqi_consumption_types', JSON.stringify(consumptionTypeMasters));
  }, [consumptionTypeMasters]);

  useEffect(() => {
    kvSet('shuqi_personal_folders', JSON.stringify(personalFolders));
  }, [personalFolders]);

  useEffect(() => {
    kvSet('shuqi_personal_bills', JSON.stringify(personalBills));
  }, [personalBills]);

  /**
   * 一次性数据修复：历史版本批量采集曾在同一毫秒生成重复账单 id，
   * 导致勾选一张发票时所有同 id 发票被一起选中（单击复选框变全选）。
   * 挂载后立即对个人账单 id 去重；ensureUniqueIds 在无重复时返回原引用，不会引起多余落盘。
   */
  useEffect(() => {
    setPersonalBills((prev) => ensureUniqueIds(prev));
  }, []);

  useEffect(() => {
    kvSet('shuqi_subsidy_rate', JSON.stringify(subsidyRate));
  }, [subsidyRate]);

  // 持久化按单据隔离的行覆盖与手工行存储
  useEffect(() => {
    kvSet('shuqi_row_state_by_form', JSON.stringify(rowStateByForm));
  }, [rowStateByForm]);

  // 首次挂载写入"已初始化"标记：空数据即为用户主动删除结果，不再回填种子
  useEffect(() => {
    kvSet(SEED_FLAG_KEY, JSON.stringify({ initializedAt: new Date().toISOString() }));
  }, []);

  // 单据切换时，从按单据隔离的存储加载对应行覆盖与手工行
  useEffect(() => {
    const saved = rowStateByForm[form.formNo];
    setRowOverrides(saved?.overrides || {});
    setManualRows(saved?.manualRows || []);
    // 故意不依赖 rowStateByForm：避免保存→加载→保存的循环
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.formNo]);

  // 当前单据的行覆盖与手工行变化时，回写到按单据隔离的存储
  useEffect(() => {
    setRowStateByForm((prev) => {
      const current = prev[form.formNo];
      if (
        current &&
        current.overrides === rowOverrides &&
        current.manualRows === manualRows
      ) {
        return prev;
      }
      return {
        ...prev,
        [form.formNo]: { overrides: rowOverrides, manualRows },
      };
    });
  }, [rowOverrides, manualRows, form.formNo]);

  // Row overrides and inline manual row editing handlers
  const handleUpdateRowLocation = (id: string, field: 'departure' | 'destination', value: string) => {
    if (id.startsWith('manual-')) {
      setManualRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
      );
    } else {
      setRowOverrides((prev) => ({
        ...prev,
        [id]: {
          ...prev[id],
          [field]: value,
        },
      }));
    }
  };

  const handleUpdateRowSubsidyDays = (id: string, days: number | undefined) => {
    if (id.startsWith('manual-')) {
      setManualRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, subsidyDays: days } : r))
      );
    } else {
      setRowOverrides((prev) => ({
        ...prev,
        [id]: {
          ...prev[id],
          subsidyDays: days,
        },
      }));
    }
  };

  const handleUpdateRowRemarks = (id: string, remarks: string) => {
    if (id.startsWith('manual-')) {
      setManualRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, remarks } : r))
      );
    } else {
      setRowOverrides((prev) => ({
        ...prev,
        [id]: {
          ...prev[id],
          remarks,
        },
      }));
    }
  };

  // Manual row addition without collecting invoices
  const handleAddManualRow = () => {
    const newId = `manual-${Date.now()}`;
    const newRow: ReimbursementItem = {
      id: newId,
      orderNo: calculation.reimbursementItems.length + 1,
      projectId: '',
      projectName: '',
      expenseItemId: '',
      expenseItemName: '',
      transportId: '',
      transportName: '',
      startDate: '',
      endDate: '',
      departure: '',
      destination: '',
      itineraryCount: undefined,
      subsidyDays: undefined,
      totalAmount: 0,
      invoiceSumAmount: 0,
      diffType: 'none',
      diffValue: undefined,
      taxAmount: 0,
      netAmount: 0,
      remarks: '',
      isMerged: false,
      mergedCount: 1,
      sourceBillIds: [],
      sourceInvoiceNumbers: [],
      isManual: true,
    };
    setManualRows((prev) => [...prev, newRow]);
  };

  // Handle manual formNo change from FormHeader (单据内可以手动调整，全局不允许重复)
  const handleFormNoChange = (newNo: string) => {
    const oldNo = form.formNo;
    const currentId = form.id || oldNo;

    // 1. Update active form state
    setForm((prev) => ({ ...prev, formNo: newNo }));

    // 2. Validate uniqueness across formsList (excluding current form)
    const trimmed = newNo.trim();
    const isDuplicate = formsList.some(
      (f) =>
        (f.id ? f.id !== currentId : f.formNo !== oldNo) &&
        f.formNo.trim().toUpperCase() === trimmed.toUpperCase()
    );

    // 3. If trimmed is not empty and not duplicate, sync across workspace tabs, formsList, and personal bills
    if (trimmed && !isDuplicate) {
      setFormsList((prev) =>
        prev.map((f) =>
          (f.id ? f.id === currentId : f.formNo === oldNo)
            ? { ...f, formNo: trimmed }
            : f
        )
      );

      setOpenTabs((prev) =>
        prev.map((t) => {
          if (t.formNo === oldNo || t.id === `form-${oldNo}`) {
            return {
              ...t,
              id: `form-${trimmed}`,
              title: `报销单 ${trimmed}`,
              formNo: trimmed,
            };
          }
          return t;
        })
      );

      if (activeTabId === `form-${oldNo}`) {
        setActiveTabId(`form-${trimmed}`);
      }

      setPersonalBills((prev) =>
        prev.map((pb) =>
          pb.reimbursedFormNo === oldNo ? { ...pb, reimbursedFormNo: trimmed } : pb
        )
      );
    }
  };

  // Handle switching to a specific form from Home page (Single click formNo or double click row)
  const handleOpenForm = (formNo: string) => {
    // 当前单据有未保存内容（新单据或已保存单据的未落盘修改）：确认丢弃后再切换
    if (!confirmDiscardUnsavedForm()) return;
    // 丢弃未保存单据：同步关闭其残留页签，防止之后点击该页签串显当前单据
    if (!isCurrentFormPersisted()) {
      const staleTabId = `form-${form.formNo}`;
      setOpenTabs((prev) => prev.filter((t) => t.id !== staleTabId));
    }

    // 不再把当前编辑态写回 formsList：用户已确认丢弃，
    // 单据列表保持上次保存的内容不变。

    const target = formsList.find((f) => f.formNo === formNo);
    if (target) {
      setForm(target);
      setBills(target.bills ? [...target.bills] : []);
      // 行覆盖与手工行不再手动清空：交给 form.formNo 变化触发的 effect 自动加载/重置
      setSelectedBillIds([]);
      setSelectedRmbIds([]);
      openWorkspaceTab({
        id: `form-${target.formNo}`,
        title: `报销单 ${target.formNo}`,
        type: '差旅报销',
        formNo: target.formNo,
        closable: true,
      });
    }
  };

  // Create brand new form strictly following coding rule: TERB + 四位年 + 两位月 + 两位日 + 三位数字流水 (例: TERB20260926001)
  const handleCreateNewForm = () => {
    // 0. 当前单据有未保存内容（新单据或已保存单据的未落盘修改）时，先确认丢弃
    if (!confirmDiscardUnsavedForm()) return;
    // 丢弃未保存单据：关闭其残留页签，稍后打开新单据页签
    if (!isCurrentFormPersisted()) {
      const staleTabId = `form-${form.formNo}`;
      setOpenTabs((prev) => prev.filter((t) => t.id !== staleTabId));
    }

    // 1. 不再把当前编辑态写回 formsList：用户已确认丢弃，单据列表保持上次保存内容。

    // 2. Generate a brand new empty form with standard rule TERB+YYYYMMDD+XXX
    const todayStr = new Date().toISOString().split('T')[0];
    const newNo = generateNextFormNo(formsList, todayStr);
    const newFormId = `form-${Date.now()}`;
    const newFormItem: ReimbursementForm = {
      id: newFormId,
      formNo: newNo,
      formDate: todayStr,
      applicant: employeeMasters[0]?.name || '宋春阳',
      applicantCode: employeeMasters[0]?.code || 'YG001',
      bills: [],
      attachmentsCount: 0,
      totalAmount: 0,
      remarks: '新建差旅报销',
      status: 'draft',
      approvalStatusName: '草稿',
      isPaid: false,
      createdAt: new Date().toLocaleString('zh-CN', { hour12: false }),
    };

    // 新单据仅作为当前编辑态存在，不写入 formsList；
    // 只有用户点击“保存”（handleSave）后才加入单据列表并落盘。
    setForm(newFormItem);
    setBills([]);
    // 行覆盖与手工行不再手动清空：交给 form.formNo 变化触发的 effect 自动重置
    setSelectedBillIds([]);
    setSelectedRmbIds([]);
    kvSet('shuqi_reimbursement_form', JSON.stringify(newFormItem));

    openWorkspaceTab({
      id: `form-${newNo}`,
      title: `报销单 ${newNo}`,
      type: '差旅报销',
      formNo: newNo,
      closable: true,
    });
  };

  // Update approval status directly with status archive link
  const handleUpdateFormStatus = (formNo: string, newStatusCode: string, statusName: string) => {
    setFormsList((prev) =>
      prev.map((f) =>
        f.formNo === formNo
          ? {
              ...f,
              status: newStatusCode as any,
              approvalStatusName: statusName,
            }
          : f
      )
    );
    if (form.formNo === formNo) {
      setForm((prev) => ({
        ...prev,
        status: newStatusCode as any,
        approvalStatusName: statusName,
      }));
    }
  };

  // Toggle Is Paid switch
  const handleToggleFormPaid = (formNo: string) => {
    let nextPaid = false;
    setFormsList((prev) =>
      prev.map((f) => {
        if (f.formNo === formNo) {
          nextPaid = !f.isPaid;
          return { ...f, isPaid: nextPaid };
        }
        return f;
      })
    );
    if (form.formNo === formNo) {
      setForm((prev) => ({ ...prev, isPaid: !prev.isPaid }));
    }
  };

  // Open delete confirmation modal from forms list
  // mode='keep_bills': 删除单据但保留发票，释放回个人账单
  // mode='purge_all': 彻底删除，连发票与行程单一并销毁，不释放回个人账单
  const handleRequestDeleteForm = (formNo: string, mode: DeleteFormMode) => {
    const target = formsList.find((f) => f.formNo === formNo);
    if (!target) return;
    const targetWithBills =
      target.formNo === form.formNo ? { ...target, bills: [...bills] } : target;
    setFormToDelete({ form: targetWithBills, mode });
  };

  // Execute delete form according to selected mode
  const handleDeleteForm = async () => {
    if (!formToDelete) return;
    const { form: target, mode } = formToDelete;
    const formNoToDelete = target.formNo;
    const billsToRelease =
      form.formNo === formNoToDelete
        ? [...bills]
        : target.bills
        ? [...target.bills]
        : [];

    // 1. 发票处理
    //    keep_bills 模式：把单据内发票释放回个人账单（解除报销标记）
    //    purge_all 模式：把被该单据引用的发票从个人账单中彻底删除
    if (mode === 'keep_bills') {
      setPersonalBills((prev) => {
        const updated = [...prev];

        // Reset any personal bills marked as reimbursed by this form or matching invoice numbers
        const result = updated.map((pb) => {
          if (pb.reimbursedFormNo === formNoToDelete) {
            return {
              ...pb,
              isReimbursed: false,
              reimbursedFormNo: undefined,
              reimbursedDate: undefined,
            };
          }
          const matched = billsToRelease.find(
            (b) =>
              b.id === pb.id ||
              (b.invoiceNumber && pb.invoiceNumber && b.invoiceNumber.trim() === pb.invoiceNumber.trim())
          );
          if (matched) {
            return {
              ...pb,
              isReimbursed: false,
              reimbursedFormNo: undefined,
              reimbursedDate: undefined,
            };
          }
          return pb;
        });

        // For any invoice that was created directly in this form and not present in personalBills, add it to personalBills
        billsToRelease.forEach((b) => {
          const exists = result.some(
            (pb) =>
              pb.id === b.id ||
              (b.invoiceNumber && pb.invoiceNumber && b.invoiceNumber.trim() === pb.invoiceNumber.trim())
          );
          if (!exists) {
            result.unshift({
              ...b,
              id: b.id.startsWith('bill-') ? `pb-${b.id}` : `pb-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              orderNo: result.length + 1,
              isReimbursed: false,
              reimbursedFormNo: undefined,
              reimbursedDate: undefined,
              createdAt: b.createdAt || new Date().toLocaleString('zh-CN', { hour12: false }),
            });
          }
        });

        return result;
      });
    } else if (mode === 'purge_all') {
      // 彻底删除：把被该单据报销/引用的发票从个人账单中一并移除
      // 匹配条件：reimbursedFormNo 指向本单据，或 id/发票号 与单据内发票一致
      const nextPersonalBills = personalBills.filter((pb) => {
        if (pb.reimbursedFormNo === formNoToDelete) return false;
        const matched = billsToRelease.some(
          (b) =>
            b.id === pb.id ||
            (b.invoiceNumber && pb.invoiceNumber && b.invoiceNumber.trim() === pb.invoiceNumber.trim())
        );
        return !matched;
      });
      setPersonalBills(nextPersonalBills);
      // 同步等待落盘，防止删单后立即刷新导致已"销毁"的发票回弹
      await kvSetAsync('shuqi_personal_bills', JSON.stringify(nextPersonalBills));
    }

    // 2. 清理按单据隔离的行覆盖与手工行存储（两种模式都做）
    setRowStateByForm((prev) => {
      const next = { ...prev };
      delete next[formNoToDelete];
      return next;
    });

    // 3. Remove the form from formsList
    const remainingForms = formsList.filter((f) => f.formNo !== formNoToDelete);
    setFormsList(remainingForms);
    // 显式等待落盘，防止删除后立即刷新导致数据回弹
    await kvSetAsync('shuqi_forms_list', JSON.stringify(remainingForms));

    // 4. Close the workspace tab for this form if open
    closeWorkspaceTab(`form-${formNoToDelete}`);

    // 5. If the active form was the one deleted, switch to another form or home
    if (form.formNo === formNoToDelete) {
      if (remainingForms.length > 0) {
        const nextForm = remainingForms[0];
        setForm(nextForm);
        setBills(nextForm.bills ? [...nextForm.bills] : []);
        // 行覆盖与手工行交给 form.formNo 变化触发的 effect 自动加载
        setSelectedBillIds([]);
        setSelectedRmbIds([]);
      } else {
        // 删除最后一个单据后不再自动新建，当前 form 变为未保存草稿，首页列表为空
        const todayStr = new Date().toISOString().split('T')[0];
        const newNo = generateNextFormNo([], todayStr);
        const freshForm: ReimbursementForm = {
          id: `form-${Date.now()}`,
          formNo: newNo,
          formDate: todayStr,
          applicant: employeeMasters[0]?.name || '宋春阳',
          applicantCode: employeeMasters[0]?.code || 'YG001',
          bills: [],
          attachmentsCount: 0,
          totalAmount: 0,
          remarks: '新建差旅报销',
          status: 'draft',
          approvalStatusName: '草稿',
          isPaid: false,
          createdAt: new Date().toLocaleString('zh-CN', { hour12: false }),
        };
        setFormsList([]);
        setForm(freshForm);
        setBills([]);
        // 行覆盖与手工行交给 form.formNo 变化触发的 effect 自动重置
        setSelectedBillIds([]);
        setSelectedRmbIds([]);
        setActiveTabId('首页');
        await kvSetAsync('shuqi_reimbursement_form', JSON.stringify(freshForm));
        await kvSetAsync('shuqi_forms_list', JSON.stringify([]));
      }
    }

    setFormToDelete(null);
    const msg =
      mode === 'keep_bills'
        ? `单据【${formNoToDelete}】已从单据列表删除！${billsToRelease.length} 张发票已完整释放并保留至发票账单。`
        : `单据【${formNoToDelete}】已彻底删除！${billsToRelease.length} 张发票及行程单一并销毁，未释放至发票账单。`;
  };

  // 发票 id 自增序列：保证同一毫秒内批量入库时每张发票 id 仍然唯一
  const billSeqRef = useRef(0);

  // Add bill to active form with duplicate invoice validation
  const handleAddBill = (newBill: Omit<BillItem, 'id' | 'orderNo' | 'createdAt'>) => {
    const trimmedNo = newBill.invoiceNumber?.trim();
    if (trimmedNo) {
      const isAlreadyInCurrent = bills.some(
        (b) => b.invoiceNumber && b.invoiceNumber.trim() === trimmedNo
      );
      if (isAlreadyInCurrent) {
        alert(`发票号码【${trimmedNo}】在当前单据中已存在，不可重复录入！`);
        return;
      }

      const referencedForm = formsList.find(
        (f) =>
          f.formNo !== form.formNo &&
          f.bills?.some((b) => b.invoiceNumber && b.invoiceNumber.trim() === trimmedNo)
      );
      if (referencedForm) {
        alert(`发票号码【${trimmedNo}】已被单据【${referencedForm.formNo}】引用，不可重复录入！`);
        return;
      }
    }

    const fullBill: BillItem = {
      ...newBill,
      // 必须带自增序列：批量采集在同一毫秒内同步调用本函数时，仅 Date.now() 会产生重复 id
      id: `bill-${Date.now()}-${billSeqRef.current}`,
      orderNo: bills.length + billSeqRef.current + 1,
      createdAt: new Date().toISOString(),
    };
    billSeqRef.current += 1;
    setBills((prev) => [...prev, fullBill]);

    // 同步到个人账单：单据尚未保存，发票一律以"待报销"状态入库，
    // 不写 isReimbursed/reimbursedFormNo；引用标记只在用户点"保存"成功后才打上。
    // 用 pb- 前缀避免与 bills 中的 id 冲突（删除单据 keep_bills 模式按发票号/id 匹配释放）
    setPersonalBills((prev) => {
      // 已存在同发票号的个人账单：保持原引用状态不变，避免重复录入
      const existedIdx = prev.findIndex(
        (pb) => pb.invoiceNumber && pb.invoiceNumber.trim() === trimmedNo
      );
      if (existedIdx >= 0) return prev;
      // 不存在：新增一条待报销的个人账单
      const newPb: PersonalBillItem = {
        ...fullBill,
        id: `pb-${fullBill.id}`,
        isReimbursed: false,
      };
      return [newPb, ...prev];
    });
  };

  /**
   * 用新识别的发票替换当前单据中同号的已有发票（先删旧，再增新，保留原 id/序号/创建时间），
   * 由 AddBillModal 的"保留新发票并覆盖"分支调用。
   * 同时同步个人账单：同号记录更新票面内容并保留报销引用状态。
   */
  const handleReplaceBill = ({
    invoiceNumber,
    newBill,
  }: {
    invoiceNumber: string;
    newBill: Omit<BillItem, 'id' | 'orderNo' | 'createdAt'>;
  }) => {
    const trimmedNo = invoiceNumber.trim();
    if (!trimmedNo) return;
    const target = trimmedNo.toLowerCase();

    // 1) 当前单据：先删旧，再增新（保留原 id/orderNo/createdAt）
    setBills((prev) => {
      const filtered = prev.filter(
        (b) => !(b.invoiceNumber && b.invoiceNumber.trim().toLowerCase() === target)
      );
      // 断言：旧的必须被删掉
      console.assert(
        filtered.length === prev.length - 1,
        '[handleReplaceBill] 旧发票未被删除，可能同号有多张'
      );
      const existing = prev.find(
        (b) => b.invoiceNumber && b.invoiceNumber.trim().toLowerCase() === target
      );
      return [
        ...filtered,
        {
          ...newBill,
          id: existing?.id ?? `bill-${Date.now()}`,
          orderNo: existing?.orderNo ?? filtered.length + 1,
          createdAt: existing?.createdAt ?? new Date().toISOString(),
        },
      ];
    });

    // 2) 个人账单：同理删旧增新，保留报销引用状态
    setPersonalBills((prev) => {
      const filtered = prev.filter(
        (pb) => !(pb.invoiceNumber && pb.invoiceNumber.trim().toLowerCase() === target)
      );
      const existing = prev.find(
        (pb) => pb.invoiceNumber && pb.invoiceNumber.trim().toLowerCase() === target
      );
      return [
        ...filtered,
        {
          ...newBill,
          id: existing?.id ?? `pb-bill-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          orderNo: existing?.orderNo ?? filtered.length + 1,
          createdAt: existing?.createdAt ?? new Date().toISOString(),
          folderId: existing?.folderId,
          folderName: existing?.folderName,
          isReimbursed: existing?.isReimbursed ?? false,
          reimbursedFormNo: existing?.reimbursedFormNo,
          reimbursedDate: existing?.reimbursedDate,
        },
      ];
    });
  };

  // Import personal bills to active form
  const handleImportPersonalBillsToActiveForm = (selectedBills: PersonalBillItem[]) => {
    if (selectedBills.length === 0) return;

    const newBillsToAdd: BillItem[] = selectedBills.map((pb, idx) => ({
      ...pb,
      id: `bill-imported-${Date.now()}-${idx}`,
      orderNo: bills.length + idx + 1,
      createdAt: pb.createdAt || new Date().toISOString(),
    }));

    setBills((prev) => [...prev, ...newBillsToAdd]);

    // 单据尚未保存，不修改个人账单的引用状态；
    // 待用户点"保存"成功后由 handleSave 统一打上报销标记。

    setIsImportPersonalOpen(false);
  };

  /**
   * 从发票账单导入后返回单据视图。
   * 不能复用 handleOpenForm：那是"切换到另一张已保存单据"的入口，
   * 对未保存的新单据会弹"丢弃修改"确认并关闭其页签，
   * 导致刚导入的发票仍在编辑态却没有页签可点。
   * 当前单据（无论是否已保存）都在编辑态，只需确保其页签存在并激活。
   */
  const handleNavigateToCurrentForm = () => {
    openWorkspaceTab({
      id: `form-${form.formNo}`,
      title: `报销单 ${form.formNo}`,
      type: '差旅报销',
      formNo: form.formNo,
      closable: true,
    });
  };

  // Delete selected bills
  const handleDeleteSelectedBills = () => {
    if (selectedBillIds.length === 0) return;
    setBills((prev) => prev.filter((b) => !selectedBillIds.includes(b.id)));
    setSelectedBillIds([]);
  };

  /**
   * 一键恢复默认系统内置档案（费用/项目/交通/地点/人员/状态/消费类型 共 7 类）。
   * 只补回被删除的内置项，用户新增项与未删除内置项的修改一律保留。
   */
  const handleRestoreBuiltinArchives = () => {
    const ok = window.confirm(
      '将一键恢复被删除的系统内置档案（费用/项目/交通/地点/人员/状态/消费类型 共 7 类）。\n\n' +
        '· 被删除的内置档案将全部恢复；\n' +
        '· 您自行新增的档案保留不动；\n' +
        '· 未删除但已修改的内置档案保持现状。\n\n' +
        '是否继续？'
    );
    if (!ok) return;

    const details: string[] = [];
    const collect = (label: string, n: number) => {
      if (n > 0) details.push(`${label} ${n} 条`);
    };

    collect('费用项目', restoreMissingBuiltins(expenseMasters, INITIAL_EXPENSE_ITEMS, setExpenseMasters));
    collect('项目', restoreMissingBuiltins(projectMasters, INITIAL_PROJECTS, setProjectMasters));
    collect('交通工具', restoreMissingBuiltins(transportMasters, INITIAL_TRANSPORTS, setTransportMasters));
    collect('地点', restoreMissingBuiltins(locationMasters, INITIAL_LOCATIONS, setLocationMasters));
    collect('人员', restoreMissingBuiltins(employeeMasters, INITIAL_EMPLOYEES, setEmployeeMasters));
    collect('审批状态', restoreMissingBuiltins(statusMasters, INITIAL_APPROVAL_STATUSES, setStatusMasters));
    collect('消费类型规则', restoreMissingBuiltins(consumptionTypeMasters, INITIAL_CONSUMPTION_TYPES, setConsumptionTypeMasters));

    const total = details.reduce((sum, d) => sum + parseInt(d.match(/\d+/)?.[0] || '0', 10), 0);
    if (total === 0) {
      alert('所有系统内置档案均已存在，无需恢复。');
    } else {
      alert(`已恢复 ${total} 条系统内置档案：\n${details.join('；')}`);
    }
  };

  // Delete selected reimbursement items
  const handleDeleteSelectedReimbursements = () => {
    if (selectedRmbIds.length === 0) return;

    // Separate manual rows vs aggregated bill rows
    const manualIdsToDelete = selectedRmbIds.filter((id) => id.startsWith('manual-'));
    if (manualIdsToDelete.length > 0) {
      setManualRows((prev) => prev.filter((r) => !manualIdsToDelete.includes(r.id)));
    }

    const aggregatedItems = calculation.reimbursementItems.filter((r) =>
      selectedRmbIds.includes(r.id) && !r.isManual
    );

    const billIdsToRemove: string[] = [];
    aggregatedItems.forEach((r) => {
      billIdsToRemove.push(...r.sourceBillIds);
    });

    if (billIdsToRemove.length > 0) {
      setBills((prev) => prev.filter((b) => !billIdsToRemove.includes(b.id)));
    }

    setSelectedRmbIds([]);
  };

  // Update row fields in ReimbursementTable
  const handleUpdateRowField = (id: string, field: keyof ReimbursementItem, value: any) => {
    if (id.startsWith('manual-')) {
      setManualRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
      );
    } else {
      setRowOverrides((prev) => ({
        ...prev,
        [id]: {
          ...prev[id],
          [field]: value,
        },
      }));
    }
  };

  // Batch edit bills
  const handleApplyBatchEdit = (updates: Partial<BillItem>) => {
    if (selectedBillIds.length === 0) return;

    setBills((prev) =>
      prev.map((b) => {
        if (selectedBillIds.includes(b.id)) {
          return {
            ...b,
            ...updates,
          };
        }
        return b;
      })
    );

    setSelectedBillIds([]);
  };

  // Save draft with global uniqueness validation
  // 保存成功的提示只在数据库文件确认落盘后才出现（强一致）
  const handleSave = async () => {
    const trimmedNo = form.formNo?.trim();
    if (!trimmedNo) {
      showSaveFeedback('error', '保存失败：单据编号不能为空，请填写后再保存');
      return;
    }

    const currentId = form.id || form.formNo;
    const isDuplicate = formsList.some(
      (f) =>
        (f.id ? f.id !== currentId : f.formNo !== form.formNo) &&
        f.formNo.trim().toUpperCase() === trimmedNo.toUpperCase()
    );

    if (isDuplicate) {
      showSaveFeedback(
        'error',
        `保存失败：单据编号【${trimmedNo}】已被其他单据使用，单据编号全局不允许重复`
      );
      return;
    }

    const updatedForm = { ...form, formNo: trimmedNo, status: 'draft' as const };
    const formSnapshot: ReimbursementForm = {
      ...updatedForm,
      bills: [...bills],
      attachmentsCount: bills.length,
      totalAmount: calculation.totalReimbursementAmount,
    };

    const exists = formsList.some((f) =>
      f.id ? f.id === currentId : f.formNo === form.formNo
    );
    const nextList = exists
      ? formsList.map((f) =>
          (f.id ? f.id === currentId : f.formNo === form.formNo) ? formSnapshot : f
        )
      : [formSnapshot, ...formsList];

    // 保存成功后按本单据实际包含的发票，统一对账个人账单引用状态：
    // - 本单据发票：标记为已报销并关联单据号；
    // - 曾被本单据占用但已移除的发票：释放回待报销；
    // - 其余个人账单保持不变。
    const savedInvoiceNos = new Set(
      formSnapshot.bills.map((b) => b.invoiceNumber?.trim()).filter(Boolean) as string[]
    );
    const nextPersonalBills = personalBills.map((pb) => {
      const no = pb.invoiceNumber?.trim();
      const inThisForm = no ? savedInvoiceNos.has(no) : false;
      if (inThisForm) {
        if (pb.isReimbursed && pb.reimbursedFormNo === trimmedNo) return pb;
        return {
          ...pb,
          isReimbursed: true as const,
          reimbursedFormNo: trimmedNo,
          reimbursedDate: pb.reimbursedDate || new Date().toISOString(),
        };
      }
      if (pb.isReimbursed && pb.reimbursedFormNo === trimmedNo) {
        return {
          ...pb,
          isReimbursed: false as const,
          reimbursedFormNo: undefined,
          reimbursedDate: undefined,
        };
      }
      return pb;
    });

    try {
      // 先写数据库，确认落盘成功后再更新界面状态
      await kvSetAsync('shuqi_forms_list', JSON.stringify(nextList));
      await kvSetAsync('shuqi_reimbursement_form', JSON.stringify(formSnapshot));
      await kvSetAsync('shuqi_personal_bills', JSON.stringify(nextPersonalBills));
      setForm(updatedForm);
      setFormsList(nextList);
      setPersonalBills(nextPersonalBills);
      const now = new Date();
      const hhmmss = [now.getHours(), now.getMinutes(), now.getSeconds()]
        .map((n) => String(n).padStart(2, '0'))
        .join(':');
      const storageText = getStorageMode() === 'server' ? '，已写入本地数据库' : '';
      showSaveFeedback('success', `单据【${trimmedNo}】保存成功（${hhmmss}${storageText}）`);
    } catch (e) {
      console.error('保存失败：数据库写入异常', e);
      showSaveFeedback('error', '保存失败：本地数据库写入异常，请重试（数据已暂存浏览器）');
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Determine current active tab
  const currentTab = openTabs.find((t) => t.id === activeTabId) || openTabs[0];
  const isFormActive = currentTab?.type === '差旅报销' || currentTab?.type === 'form';
  const isHomeActive = currentTab?.type === '首页' || currentTab?.type === 'home';

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#050810] font-sans text-slate-200 select-none relative">
      {/* Mobile Sidebar Backdrop */}
      {isMobileSidebarOpen && (
        <div
          onClick={() => setIsMobileSidebarOpen(false)}
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
        />
      )}

      {/* 1. Left Functional Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 transition-transform duration-300 md:static md:translate-x-0 h-full flex flex-col shrink-0 ${
          isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <Sidebar
          activeTab={currentTab?.type || '首页'}
          setActiveTab={handleSidebarNav}
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={setIsSidebarCollapsed}
          subsidyRate={subsidyRate}
          onOpenSubsidyModal={() => {
            setTempSubsidyRate(subsidyRate);
            setIsSubsidyModalOpen(true);
          }}
          currentUserName={form.applicant || '宋春阳'}
          onRestoreBuiltinArchives={handleRestoreBuiltinArchives}
        />
      </div>

      {/* 2. Main Content Canvas */}
      <div className="flex-1 flex flex-col h-full overflow-hidden w-full">
        {/* Top Header with Multi-Tabs */}
        <TopHeader
          openTabs={openTabs}
          activeTabId={activeTabId}
          onSelectTab={setActiveTabId}
          onCloseTab={closeWorkspaceTab}
          toggleFullscreen={toggleFullscreen}
          onToggleSidebar={() => setIsMobileSidebarOpen((prev) => !prev)}
          themeMode={themeMode}
          onToggleTheme={() =>
            setThemeMode((prev) => (prev === 'dark' ? 'light' : 'dark'))
          }
        />

        {/* Viewport for current active functional module */}
        {/* 发票账单为固定全高界面：禁用页面级滚动（pb-16 也会产生多余滚动量），仅列表内部滚动 */}
        <main
          className={`flex-1 w-full bg-[#050810] ${
            currentTab?.type === '发票账单' ? 'overflow-hidden' : 'overflow-y-auto pb-16'
          }`}
        >
          {/* 首页: 显示所有报销单表头信息 */}
          {isHomeActive && (
            <HomeDashboard
              forms={formsList}
              currentFormNo={form.formNo}
              statusMasters={statusMasters}
              onOpenForm={handleOpenForm}
              onCreateNewForm={handleCreateNewForm}
              onDeleteForm={handleRequestDeleteForm}
              onUpdateFormStatus={handleUpdateFormStatus}
              onToggleFormPaid={handleToggleFormPaid}
            />
          )}

          {/* 个人账单 */}
          {currentTab?.type === '发票账单' && (
            <PersonalBillsView
              personalBills={personalBills}
              setPersonalBills={setPersonalBills}
              folders={personalFolders}
              setFolders={setPersonalFolders}
              expenseMasters={expenseMasters}
              transportMasters={transportMasters}
              projectMasters={projectMasters}
              onImportToActiveForm={handleImportPersonalBillsToActiveForm}
              onNavigateToForm={handleNavigateToCurrentForm}
              formsList={formsList}
            />
          )}

          {/* 差旅报销核心单据页面 */}
          {isFormActive && (
            <div className="space-y-3 p-2 sm:p-3 w-full h-full relative">
              {/* Form Basic Information */}
              <FormHeader
                form={form}
                setForm={setForm}
                calculatedTotal={calculation.totalReimbursementAmount}
                onlyRequired={onlyRequired}
                setOnlyRequired={setOnlyRequired}
                openAttachments={() => setIsAddBillOpen(true)}
                employees={employeeMasters}
                formsList={formsList}
                onFormNoChange={handleFormNoChange}
              />

              {/* Section 1: 报销明细 */}
              <div className="surface-card overflow-hidden">
                <ReimbursementTable
                  items={calculation.reimbursementItems}
                  selectedIds={selectedRmbIds}
                  setSelectedIds={setSelectedRmbIds}
                  projectMasters={projectMasters}
                  transportMasters={transportMasters}
                  locationMasters={locationMasters}
                  expenseMasters={expenseMasters}
                  bills={bills}
                  onUpdateRowField={handleUpdateRowField}
                  onUpdateRowLocation={handleUpdateRowLocation}
                  onUpdateRowSubsidyDays={handleUpdateRowSubsidyDays}
                  onUpdateRowRemarks={handleUpdateRowRemarks}
                  onTraceRow={(item) => setTraceItem(item)}
                  onPreviewInvoice={(b) => setPreviewBill(b)}
                  onAddManualRow={handleAddManualRow}
                  onDeleteSelected={handleDeleteSelectedReimbursements}
                  onBatchEdit={() => {
                    if (selectedRmbIds.length > 0) setIsBatchEditOpen(true);
                  }}
                  subsidyRate={subsidyRate}
                />
              </div>

              {/* Section 2: 账单明细 */}
              <div className="surface-card overflow-hidden">
                <BillTable
                  bills={bills}
                  selectedIds={selectedBillIds}
                  setSelectedIds={setSelectedBillIds}
                  onAddBill={() => setIsAddBillOpen(true)}
                  onDeleteSelected={handleDeleteSelectedBills}
                  onBatchEdit={() => {
                    if (selectedBillIds.length > 0) setIsBatchEditOpen(true);
                  }}
                  onPreviewInvoice={(b) => setPreviewBill(b)}
                  onUpdateBillExpense={(billId, newExpenseId) => {
                    const exp = expenseMasters.find((e) => e.id === newExpenseId);
                    setBills((prev) =>
                      prev.map((b) =>
                        b.id === billId
                          ? { ...b, expenseItemId: newExpenseId, expenseItemName: exp?.name || b.expenseItemName }
                          : b
                      )
                    );
                  }}
                  onUpdateBillTransport={(billId, newTransportId) => {
                    const tr = transportMasters.find((t) => t.id === newTransportId);
                    setBills((prev) =>
                      prev.map((b) =>
                        b.id === billId
                          ? { ...b, transportId: newTransportId, transportName: tr?.name || b.transportName }
                          : b
                      )
                    );
                  }}
                  onUpdateBillProject={(billId, newProjectId) => {
                    const pr = projectMasters.find((p) => p.id === newProjectId);
                    setBills((prev) =>
                      prev.map((b) =>
                        b.id === billId
                          ? { ...b, projectId: newProjectId, projectName: pr?.name || b.projectName }
                          : b
                      )
                    );
                  }}
                  expenseMasters={expenseMasters}
                  projectMasters={projectMasters}
                  transportMasters={transportMasters}
                  onImportPersonalBills={() => setIsImportPersonalOpen(true)}
                  pendingPersonalCount={personalBills.filter((b) => !b.isReimbursed).length}
                />
              </div>
            </div>
          )}

          {/* 基础档案 - 费用档案 */}
          {currentTab?.type === '费用档案' && (
            <ExpenseMasterView
              expenseMasters={expenseMasters}
              setExpenseMasters={setExpenseMasters}
              bills={bills}
              consumptionTypeMasters={consumptionTypeMasters}
            />
          )}

          {/* 基础档案 - 项目档案 */}
          {currentTab?.type === '项目档案' && (
            <ProjectMasterView
              projectMasters={projectMasters}
              setProjectMasters={setProjectMasters}
              bills={bills}
            />
          )}

          {/* 基础档案 - 交通档案 */}
          {currentTab?.type === '交通档案' && (
            <TransportMasterView
              transportMasters={transportMasters}
              setTransportMasters={setTransportMasters}
              bills={bills}
            />
          )}

          {/* 基础档案 - 地点档案 */}
          {currentTab?.type === '地点档案' && (
            <LocationMasterView
              locationMasters={locationMasters}
              setLocationMasters={setLocationMasters}
              bills={bills}
            />
          )}

          {/* 基础档案 - 人员档案 */}
          {currentTab?.type === '人员档案' && (
            <EmployeeMasterView
              employees={employeeMasters}
              setEmployees={setEmployeeMasters}
            />
          )}

          {/* 基础档案 - 状态档案 (审批状态档案) */}
          {currentTab?.type === '状态档案' && (
            <StatusMasterView
              statusMasters={statusMasters}
              setStatusMasters={setStatusMasters}
            />
          )}

          {/* 基础档案 - 消费类型 */}
          {(currentTab?.type === '消费类型' || currentTab?.type === '消费类型档案') && (
            <ConsumptionTypeMasterView
              consumptionTypeMasters={consumptionTypeMasters}
              setConsumptionTypeMasters={setConsumptionTypeMasters}
            />
          )}

          {/* 汇总分项报表 */}
          {currentTab?.type === '汇总报表' && (
            <SummaryReportView
              formsList={formsList}
              onOpenForm={handleOpenForm}
            />
          )}
        </main>

        {/* 3. Bottom Fixed Action Bar (Only on single form view) */}
        {isFormActive && (
          <footer className="fixed bottom-4 right-6 flex items-center justify-end gap-2.5 z-30 pointer-events-none">
            {saveFeedback && (
              <div
                className={`pointer-events-auto flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium shadow-lg border backdrop-blur-md animate-in fade-in slide-in-from-right-2 duration-200 ${
                  saveFeedback.type === 'success'
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 shadow-[0_4px_18px_rgba(16,185,129,0.18)]'
                    : 'bg-rose-500/15 text-rose-300 border-rose-500/30 shadow-[0_4px_18px_rgba(225,29,72,0.18)]'
                }`}
              >
                {saveFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span>{saveFeedback.text}</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => setIsPrintOpen(true)}
              className="pointer-events-auto btn-ghost px-4 py-2 text-xs font-semibold rounded-md cursor-pointer flex items-center gap-1.5"
              title="打印/导出当前单据的发票及行程单（支持A4二等分裁剪PDF）"
            >
              <Printer className="w-3.5 h-3.5 text-slate-300" />
              <span>打印/导出</span>
            </button>
            <button
              onClick={handleSave}
              className="pointer-events-auto btn-mint px-6 py-2 text-xs font-semibold rounded-md cursor-pointer"
            >
              保存
            </button>
          </footer>
        )}
      </div>

      {/* Add Bill Modal (OCR / Upload) */}
      <AddBillModal
        isOpen={isAddBillOpen}
        onClose={() => setIsAddBillOpen(false)}
        onAddBill={handleAddBill}
        expenseMasters={expenseMasters}
        transportMasters={transportMasters}
        projectMasters={projectMasters}
        consumptionTypeMasters={consumptionTypeMasters}
        referencedInvoiceNumbers={allReferencedInvoiceNumbers}
        existingBills={bills}
        onReplaceBill={handleReplaceBill}
      />

      {/* Source Invoices Traceability Modal */}
      <TraceabilityModal
        isOpen={!!traceItem}
        onClose={() => setTraceItem(null)}
        reimbursementItem={traceItem}
        allBills={bills}
        onPreviewInvoice={(b) => setPreviewBill(b)}
      />

      {/* Invoice Certificate Paper Preview Modal */}
      <InvoicePreviewModal
        isOpen={!!previewBill}
        onClose={() => setPreviewBill(null)}
        bill={previewBill}
      />

      {/* Batch Edit Modal */}
      <BatchEditModal
        isOpen={isBatchEditOpen}
        onClose={() => setIsBatchEditOpen(false)}
        onApply={handleApplyBatchEdit}
        selectedCount={selectedBillIds.length}
        expenseMasters={expenseMasters}
        transportMasters={transportMasters}
        projectMasters={projectMasters}
      />

      {/* Print & Summary Modal */}
      <PrintSummaryModal
        isOpen={isPrintOpen}
        onClose={() => setIsPrintOpen(false)}
        form={form}
        reimbursementItems={calculation.reimbursementItems}
        bills={bills}
        personalBills={personalBills}
        calculation={calculation}
      />

      {/* Import from Personal Bills Modal */}
      <ImportFromPersonalBillsModal
        isOpen={isImportPersonalOpen}
        onClose={() => setIsImportPersonalOpen(false)}
        personalBills={personalBills}
        folders={personalFolders}
        existingBillNumbers={bills.map((b) => b.invoiceNumber).filter(Boolean)}
        allReferencedInvoiceNumbers={allReferencedInvoiceNumbers}
        onConfirmImport={handleImportPersonalBillsToActiveForm}
      />

      {/* Configure Subsidy Standard Modal */}
      {isSubsidyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm">
          <div className="glass-card w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-white/[0.02]">
              <h3 className="text-xs font-bold text-slate-100">配置差旅出差补贴标准</h3>
              <button
                onClick={() => setIsSubsidyModalOpen(false)}
                className="text-slate-400 hover:text-white rounded p-1 hover:bg-white/5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  每日出差补贴金额标准（元/天）
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-slate-400 text-xs">
                    ¥
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={tempSubsidyRate}
                    onChange={(e) => setTempSubsidyRate(Math.max(0, Number(e.target.value) || 0))}
                    className="input-dark w-full pl-7 pr-3 py-1.5 text-sm font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    placeholder="如：50"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  该标准将用于计算报销明细行中出差补贴的总额。
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-4 py-2.5 bg-white/[0.02] border-t border-white/5">
              <button
                onClick={() => setIsSubsidyModalOpen(false)}
                className="btn-ghost px-3 py-1.5 rounded text-xs"
              >
                取消
              </button>
              <button
                onClick={() => {
                  setSubsidyRate(tempSubsidyRate);
                  setIsSubsidyModalOpen(false);
                }}
                className="btn-mint px-4 py-1.5 rounded text-xs font-medium"
              >
                保存标准
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Form Confirmation Modal (在单据列表触发，删除单据不删除单据里的发票) */}
      {formToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 select-none animate-in fade-in duration-150">
          <div className="glass-card w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className={`px-5 py-3.5 border-b flex items-center justify-between ${
              formToDelete.mode === 'purge_all'
                ? 'border-rose-500/30 bg-rose-500/10'
                : 'border-amber-500/30 bg-amber-500/[0.08]'
            }`}>
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-full text-white shadow-[0_0_12px_rgba(225,29,72,0.4)] ${
                  formToDelete.mode === 'purge_all' ? 'btn-danger' : 'bg-rose-600'
                }`}>
                  {formToDelete.mode === 'purge_all' ? (
                    <AlertCircle className="w-4 h-4" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </div>
                <h3 className="text-sm font-bold text-slate-100">
                  {formToDelete.mode === 'purge_all' ? '彻底删除单据确认' : '删除单据确认（保留发票）'}
                </h3>
              </div>
              <button
                onClick={() => setFormToDelete(null)}
                className="text-slate-400 hover:text-white rounded p-1 hover:bg-white/5 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-3 text-xs">
              <div className="space-y-1">
                <p className="text-slate-200 text-sm font-medium">
                  确定{formToDelete.mode === 'purge_all' ? '彻底删除' : '从单据列表中删除'}报销单【<span className="font-mono font-bold text-sky-300">{formToDelete.form.formNo}</span>】吗？
                </p>
                <div className="text-[11px] text-slate-400 flex flex-wrap gap-x-4 gap-y-1 bg-white/[0.03] p-2 rounded border border-white/5">
                  <span>申请人：<strong className="text-slate-200">{formToDelete.form.applicant}</strong></span>
                  <span>报销总额：<strong className="text-emerald-400 font-mono">¥{(formToDelete.form.totalAmount || 0).toFixed(2)}</strong></span>
                  <span>单据日期：<strong className="text-slate-200">{formToDelete.form.formDate}</strong></span>
                </div>
              </div>

              {formToDelete.mode === 'keep_bills' ? (
                <div className="p-3 bg-amber-500/[0.08] border border-amber-500/30 rounded-lg space-y-1 text-slate-200 leading-relaxed">
                  <p className="font-bold text-amber-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>发票资产保护说明（删除单据不删除发票）</span>
                  </p>
                  <p className="text-[11px] text-slate-300">
                    删除此报销单后，单据内包含的 <span className="font-bold text-amber-300">{formToDelete.form.bills?.length || 0}</span> 张发票将完整保留并恢复至【发票账单】中，解除报销占用状态（重置为待报销），绝不会造成发票数据丢失。
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-rose-500/[0.08] border border-rose-500/30 rounded-lg space-y-1 text-slate-200 leading-relaxed">
                  <p className="font-bold text-rose-300 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>销毁警告（连发票与行程单一并销毁）</span>
                  </p>
                  <p className="text-[11px] text-rose-200">
                    此操作将彻底删除单据及其内含的 <span className="font-bold text-rose-300">{formToDelete.form.bills?.length || 0}</span> 张发票与行程单附件，<span className="font-bold">不会</span>释放回发票账单，且无法恢复，请谨慎确认。
                  </p>
                </div>
              )}

              {(formToDelete.form.bills?.length || 0) > 0 && (
                <div className="text-[11px] text-slate-400 bg-white/[0.03] p-2.5 rounded border border-white/5 max-h-36 overflow-y-auto space-y-1">
                  <p className="font-semibold text-slate-200">
                    {formToDelete.mode === 'keep_bills' ? '保留并发票释放清单' : '将一并销毁的发票清单'} ({formToDelete.form.bills?.length} 笔)：
                  </p>
                  {formToDelete.form.bills?.map((b, idx) => (
                    <div key={b.id || idx} className="flex items-center justify-between text-slate-400">
                      <span className="font-mono truncate max-w-[240px]">
                        {b.invoiceNumber || '无号码'} ({b.consumptionType || '账单'})
                      </span>
                      <span className="font-mono font-medium text-slate-200 shrink-0">
                        ¥{(b.totalAmount || 0).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-white/5 bg-white/[0.02] flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setFormToDelete(null)}
                className="btn-ghost px-4 py-1.5 rounded font-medium cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => handleDeleteForm()}
                className={`px-4 py-1.5 text-white rounded font-medium shadow-lg cursor-pointer transition-all flex items-center gap-1.5 ${
                  formToDelete.mode === 'purge_all'
                    ? 'btn-danger'
                    : 'bg-rose-600 hover:bg-rose-500'
                }`}
              >
                {formToDelete.mode === 'purge_all' ? (
                  <AlertCircle className="w-3.5 h-3.5" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>{formToDelete.mode === 'purge_all' ? '确认彻底删除' : '确认删除单据'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
