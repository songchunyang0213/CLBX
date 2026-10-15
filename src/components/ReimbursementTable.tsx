import React, { useRef, useEffect, useState } from 'react';
import {
  Plus,
  Trash2,
  Edit3,
  SearchCode,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  GripVertical,
  X,
  Check,
  Paperclip,
  Eye,
  FileText,
} from 'lucide-react';
import {
  ReimbursementItem,
  ProjectMaster,
  LocationMaster,
  ExpenseItemMaster,
  TransportMaster,
  BillItem,
} from '../types/reimbursement';

interface ReimbursementTableProps {
  items: ReimbursementItem[];
  selectedIds: string[];
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  projectMasters: ProjectMaster[];
  transportMasters?: TransportMaster[];
  locationMasters?: LocationMaster[];
  expenseMasters?: ExpenseItemMaster[];
  bills?: BillItem[];
  onUpdateRowField?: (id: string, field: keyof ReimbursementItem, value: any) => void;
  onPreviewInvoice?: (bill: BillItem) => void;
  onUpdateRowLocation?: (id: string, field: 'departure' | 'destination', value: string) => void;
  onUpdateRowSubsidyDays?: (id: string, days: number | undefined) => void;
  onUpdateRowRemarks?: (id: string, remarks: string) => void;
  onTraceRow: (item: ReimbursementItem) => void;
  onAddManualRow: () => void;
  onDeleteSelected: () => void;
  onBatchEdit: () => void;
  subsidyRate?: number;
}

type RmbColumnKey =
  | 'checkbox'
  | 'orderNo'
  | 'project'
  | 'expenseItem'
  | 'transport'
  | 'startDate'
  | 'endDate'
  | 'departure'
  | 'destination'
  | 'itinerary'
  | 'subsidyDays'
  | 'totalAmount'
  | 'remarks'
  | 'actions';

interface ColumnDef {
  key: RmbColumnKey;
  label: string;
  defaultWidth: number;
  align?: 'left' | 'center' | 'right';
  draggable: boolean;
}

/** 列宽允许收缩的最小像素值（任何列都不会被拖得比这更窄） */
const MIN_COL_WIDTH = 36;

const DEFAULT_COLUMNS: ColumnDef[] = [
  { key: 'checkbox', label: '', defaultWidth: 44, align: 'left', draggable: false },
  { key: 'orderNo', label: '序号', defaultWidth: 60, align: 'center', draggable: false },
  { key: 'project', label: '项目', defaultWidth: 180, align: 'left', draggable: true },
  { key: 'expenseItem', label: '费用项目', defaultWidth: 150, align: 'left', draggable: true },
  { key: 'transport', label: '交通工具', defaultWidth: 130, align: 'left', draggable: true },
  { key: 'startDate', label: '开始日期', defaultWidth: 120, align: 'left', draggable: true },
  { key: 'endDate', label: '结束日期', defaultWidth: 120, align: 'left', draggable: true },
  { key: 'departure', label: '出发地', defaultWidth: 140, align: 'left', draggable: true },
  { key: 'destination', label: '到达地', defaultWidth: 140, align: 'left', draggable: true },
  { key: 'itinerary', label: '行程单', defaultWidth: 160, align: 'left', draggable: true },
  { key: 'subsidyDays', label: '补贴天数', defaultWidth: 100, align: 'left', draggable: true },
  { key: 'totalAmount', label: '金额', defaultWidth: 140, align: 'left', draggable: true },
  { key: 'remarks', label: '备注', defaultWidth: 200, align: 'left', draggable: true },
  { key: 'actions', label: '', defaultWidth: 56, align: 'left', draggable: false },
];

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];
/** 日历面板约高 320px，用于判断向上/向下展开 */
const CAL_PANEL_H = 320;
const CAL_PANEL_W = 244;

interface CalendarPopoverProps {
  value: string; // YYYY-MM-DD 或空
  anchor: { top: number; left: number };
  onSelect: (date: string) => void;
  onClear: () => void;
  onClose: () => void;
}

/** 自定义深色日历弹层（替代浏览器原生日历，与系统主题一致） */
const CalendarPopover: React.FC<CalendarPopoverProps> = ({
  value,
  anchor,
  onSelect,
  onClear,
  onClose,
}) => {
  const now = new Date();
  const initial = value ? value.split('-').map(Number) : null;
  const [viewYear, setViewYear] = useState(initial ? initial[0] : now.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial ? initial[1] - 1 : now.getMonth()); // 0-11
  const panelRef = useRef<HTMLDivElement>(null);

  // 外部点击 / Esc / 滚动 / 窗口变化时关闭；点击日期触发按钮时不关闭（由触发按钮的 click 切换开关）
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-date-trigger]')) return;
      if (panelRef.current && !panelRef.current.contains(target)) onClose();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', onClose, true);
    window.addEventListener('resize', onClose);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', onClose, true);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose]);

  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

  // 构造 6×7 日格（前后月补位铺满）
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();
  const cells: { date: string; day: number; inMonth: boolean }[] = [];
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const pm = viewMonth === 0 ? 11 : viewMonth - 1;
    const py = viewMonth === 0 ? viewYear - 1 : viewYear;
    cells.push({ date: fmt(py, pm, d), day: d, inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: fmt(viewYear, viewMonth, d), day: d, inMonth: true });
  }
  for (let d = 1; cells.length < 42; d++) {
    const nm = viewMonth === 11 ? 0 : viewMonth + 1;
    const ny = viewMonth === 11 ? viewYear + 1 : viewYear;
    cells.push({ date: fmt(ny, nm, d), day: d, inMonth: false });
  }

  const todayStr = fmt(now.getFullYear(), now.getMonth(), now.getDate());
  const shiftMonth = (delta: number) => {
    const m = viewMonth + delta;
    if (m < 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else if (m > 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth(m);
    }
  };

  return (
    <div
      ref={panelRef}
      className="fixed z-[70] bg-[#0d1424] border border-white/10 rounded-lg shadow-2xl shadow-black/60 p-2.5 select-none animate-in fade-in zoom-in-95 duration-100"
      style={{ top: anchor.top, left: anchor.left, width: CAL_PANEL_W }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 头部：年月切换 */}
      <div className="flex items-center justify-between mb-1.5">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          title="上一月"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <div className="text-sm font-bold text-slate-100 font-mono tracking-wide">
          {viewYear}年{viewMonth + 1}月
        </div>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          title="下一月"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
      {/* 星期表头 */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAY_LABELS.map((w, i) => (
          <div
            key={w}
            className={`h-6 flex items-center justify-center text-[11px] ${
              i === 0 || i === 6 ? 'text-slate-500' : 'text-slate-400'
            }`}
          >
            {w}
          </div>
        ))}
      </div>
      {/* 日格 */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((c) => {
          const isSelected = c.date === value;
          const isToday = c.date === todayStr;
          return (
            <button
              key={c.date}
              type="button"
              onClick={() => onSelect(c.date)}
              title={c.date}
              className={`h-7 w-8 mx-auto flex items-center justify-center rounded-md text-xs transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-sky-500/30 text-sky-100 font-bold ring-1 ring-sky-400/60'
                  : isToday
                    ? 'text-sky-300 font-bold hover:bg-sky-500/15'
                    : c.inMonth
                      ? 'text-slate-300 hover:bg-white/10 hover:text-slate-100'
                      : 'text-slate-600 hover:bg-white/5'
              }`}
            >
              {c.day}
            </button>
          );
        })}
      </div>
      {/* 底部操作 */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/[0.06]">
        <button
          type="button"
          onClick={onClear}
          className="px-2 py-1 rounded text-xs text-rose-300/90 hover:bg-rose-500/15 hover:text-rose-200 transition-colors cursor-pointer"
        >
          清除
        </button>
        <button
          type="button"
          onClick={() => onSelect(todayStr)}
          className="px-2 py-1 rounded text-xs text-sky-300 hover:bg-sky-500/15 hover:text-sky-200 transition-colors cursor-pointer"
        >
          今天
        </button>
      </div>
    </div>
  );
};

export const ReimbursementTable: React.FC<ReimbursementTableProps> = ({
  items,
  selectedIds,
  setSelectedIds,
  projectMasters,
  locationMasters = [],
  expenseMasters = [],
  transportMasters = [],
  bills = [],
  onUpdateRowField,
  onPreviewInvoice,
  onUpdateRowLocation,
  onUpdateRowSubsidyDays,
  onUpdateRowRemarks,
  onTraceRow,
  onAddManualRow,
  onDeleteSelected,
  onBatchEdit,
  subsidyRate = 50,
}) => {
  const [columns, setColumns] = useState<ColumnDef[]>(DEFAULT_COLUMNS);
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    DEFAULT_COLUMNS.forEach((c) => {
      init[c.key] = c.defaultWidth;
    });
    return init;
  });

  // 是否已发生过手动调宽：未调宽时表格 w-full 自动撑满；调宽后改用精确像素总宽，保证每列宽度独立
  const [userSized, setUserSized] = useState(false);

  const [draggedColKey, setDraggedColKey] = useState<RmbColumnKey | null>(null);
  const [dragOverColKey, setDragOverColKey] = useState<RmbColumnKey | null>(null);
  const [expandedRowIds, setExpandedRowIds] = useState<string[]>([]);
  const [previewItinerary, setPreviewItinerary] = useState<{
    name: string;
    url: string;
    type: 'image' | 'pdf';
    row: ReimbursementItem;
  } | null>(null);

  // 自定义日历弹层状态：记录目标行/字段、当前值与 fixed 定位锚点
  const [datePicker, setDatePicker] = useState<{
    rowId: string;
    field: 'startDate' | 'endDate';
    value: string;
    top: number;
    left: number;
  } | null>(null);

  /** 打开日期弹层：按触发元素位置计算锚点（底部放不下时向上展开，右侧越界时左移） */
  const openDatePicker = (
    e: React.MouseEvent<HTMLButtonElement>,
    rowId: string,
    field: 'startDate' | 'endDate',
    value: string
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const openUp = rect.bottom + CAL_PANEL_H > window.innerHeight && rect.top > CAL_PANEL_H;
    setDatePicker({
      rowId,
      field,
      value,
      top: openUp ? rect.top - CAL_PANEL_H - 4 : rect.bottom + 4,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - CAL_PANEL_W - 8)),
    });
  };

  // Column resizing state
  const [resizingCol, setResizingCol] = useState<{ key: string; startX: number; startWidth: number } | null>(null);

  // 外层滚动容器：侧边栏收起/展开或窗口尺寸变化时容器宽度改变。
  // 用户已手动调宽（userSized）时，表格按容器变化比例同步缩放，始终自动适应。
  // 全同步 ref 设计：当前列宽（widthsRef）与缩放基准（baseRef/baseContainerW）都在事件触发的
  // 同一时刻读写，不依赖 React effect 的异步提交——侧边栏过渡动画期间 ResizeObserver 每帧触发，
  // 基准只在 mouseup 时固化一次，任何中间帧都从同一基准重算，因此不存在舍入误差累积。
  const wrapperRef = useRef<HTMLDivElement>(null);
  const prevContainerW = useRef<number>(0);
  const baseContainerW = useRef<number>(0);
  const baseRef = useRef<Record<string, number> | null>(null);
  const widthsRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    prevContainerW.current = el.clientWidth;

    const handleContainerResize = () => {
      const newW = el.clientWidth;
      const oldW = prevContainerW.current;
      prevContainerW.current = newW;
      // 未手动调宽时 w-full 已自动适应；拖拽过程中容器不会变化
      if (oldW === 0 || newW === oldW || !userSized || resizingCol) return;

      const base = baseRef.current;
      const baseW = baseContainerW.current;
      if (!base || baseW === 0) return;

      const ratio = newW / baseW;
      const keys = Object.keys(base);
      const lastIdx = keys.length - 1;
      const next: Record<string, number> = {};
      let exactUsed = 0;
      let roundedUsed = 0;

      keys.forEach((k, i) => {
        const exact = base[k] * ratio;
        if (i < lastIdx) {
          exactUsed += exact;
          const v = Math.max(MIN_COL_WIDTH, Math.round(exact));
          roundedUsed += v;
          next[k] = v;
        } else {
          next[k] = Math.max(
            MIN_COL_WIDTH,
            Math.round(exact - (roundedUsed - exactUsed))
          );
        }
      });
      widthsRef.current = next;
      setColWidths(next);
    };

    const ro = new ResizeObserver(handleContainerResize);
    ro.observe(el);
    return () => ro.disconnect();
  }, [userSized, resizingCol]);
  // ---------------------------------------------------------

  const startResizing = (key: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const handleEl = e.currentTarget as HTMLDivElement;
    const thEl = handleEl.closest('th');
    const startX = e.clientX;

    // 首次手动调宽时，先把各列当前实际渲染宽度（w-full 下可能与默认值不同）固化到 colWidths，
    // 避免切换到精确像素总宽的瞬间出现列宽跳变
    let startWidth: number = colWidths[key] || 100;
    const headerRow = thEl?.parentElement;
    const thEls = headerRow
      ? (Array.from(headerRow.children) as HTMLTableCellElement[])
      : [];
    if (thEls.length === columns.length) {
      const snapshot: Record<string, number> = {};
      columns.forEach((c, i) => {
        snapshot[c.key] =
          thEls[i]?.offsetWidth || colWidths[c.key] || c.defaultWidth;
      });
      startWidth = snapshot[key];
      widthsRef.current = snapshot;
      setColWidths(snapshot);
    }

    setUserSized(true);
    setResizingCol({ key, startX, startWidth });
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (moveEvent: MouseEvent) => {
      // clientX 与 startX 同一坐标系：宽度 = 起始宽度 + 鼠标位移，逐事件独立计算，不做累计叠加
      const newWidth = Math.max(
        MIN_COL_WIDTH,
        startWidth + moveEvent.clientX - startX
      );
      widthsRef.current = { ...widthsRef.current, [key]: newWidth };
      setColWidths(widthsRef.current);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      setResizingCol(null);
      // 拖拽结束的同一时刻固化基准：此后侧边栏收起/展开触发的任何缩放都从此基准重算
      baseRef.current = { ...widthsRef.current };
      baseContainerW.current = wrapperRef.current?.clientWidth ?? 0;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Drag & drop column reordering
  const handleDragStart = (key: RmbColumnKey) => {
    setDraggedColKey(key);
  };

  const handleDragOver = (e: React.DragEvent, key: RmbColumnKey) => {
    e.preventDefault();
    if (draggedColKey !== key) {
      setDragOverColKey(key);
    }
  };

  const handleDrop = (targetKey: RmbColumnKey) => {
    if (!draggedColKey || draggedColKey === targetKey) {
      setDraggedColKey(null);
      setDragOverColKey(null);
      return;
    }

    const newCols = [...columns];
    const sourceIdx = newCols.findIndex((c) => c.key === draggedColKey);
    const targetIdx = newCols.findIndex((c) => c.key === targetKey);

    if (sourceIdx >= 0 && targetIdx >= 0) {
      const [removed] = newCols.splice(sourceIdx, 1);
      newCols.splice(targetIdx, 0, removed);
      setColumns(newCols);
    }

    setDraggedColKey(null);
    setDragOverColKey(null);
  };

  const toggleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(items.map((i) => i.id));
    } else {
      setSelectedIds([]);
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleExpand = (id: string) => {
    setExpandedRowIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const totalAmount = items.reduce((acc, i) => acc + (i.totalAmount || 0), 0);

  // 手动调宽后表格的精确总宽 = 各列宽度之和；超出容器时由外层 overflow-x-auto 横向滚动承接
  const tableWidth = columns.reduce(
    (sum, col) => sum + (colWidths[col.key] ?? col.defaultWidth),
    0
  );

  // 空值时显示可见框线（与补贴天数输入框一致），有值时保持透明底
  const fieldBox = (isEmpty: boolean) =>
    isEmpty
      ? 'bg-white/[0.03] hover:bg-white/[0.06] focus:bg-white/[0.08] border-white/10'
      : 'bg-transparent hover:bg-white/[0.04] focus:bg-white/[0.06] border-transparent hover:border-white/10';

  // Render cell content based on column key
  const renderCell = (row: ReimbursementItem, colKey: RmbColumnKey, isSelected: boolean) => {
    switch (colKey) {
      case 'checkbox':
        return (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => toggleSelectRow(row.id)}
            className="cb-dark w-3.5 h-3.5"
          />
        );
      case 'orderNo':
        return (
          <span className="font-mono text-slate-400 text-xs flex items-center justify-center gap-1">
            {row.orderNo}
          </span>
        );
      case 'project':
        return onUpdateRowField ? (
          <select
            value={row.projectId || ''}
            onChange={(e) => {
              const target = projectMasters.find((p) => p.id === e.target.value);
              onUpdateRowField(row.id, 'projectId', e.target.value);
              if (target) onUpdateRowField(row.id, 'projectName', target.name);
            }}
            className={`w-full text-sm py-0.5 px-1 rounded border focus:border-sky-400/60 text-slate-200 cursor-pointer focus:outline-none truncate font-medium ${fieldBox(!row.projectId)}`}
            title="选择归属项目"
          >
            <option value=""></option>
            {projectMasters
              .filter((p) => p.status === 'enabled')
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            {row.projectName && !projectMasters.some((p) => p.id === row.projectId) && (
              <option value={row.projectId || ''}>{row.projectName}</option>
            )}
          </select>
        ) : (
          <span className="truncate block font-medium text-slate-200" title={row.projectName}>
            {row.projectName || ''}
          </span>
        );
      case 'expenseItem':
        return (
          <div className="flex items-center gap-1 truncate">
            {onUpdateRowField ? (
              <select
                value={row.expenseItemId || ''}
                onChange={(e) => {
                  const target = (expenseMasters || []).find((em) => em.id === e.target.value);
                  onUpdateRowField(row.id, 'expenseItemId', e.target.value);
                  if (target) onUpdateRowField(row.id, 'expenseItemName', target.name);
                }}
                className={`w-full text-sm py-0.5 px-1 rounded border focus:border-sky-400/60 text-slate-100 font-bold cursor-pointer focus:outline-none truncate ${fieldBox(!row.expenseItemId)}`}
                title="选择费用项目"
              >
                <option value=""></option>
                {(expenseMasters || [])
                  .filter((em) => em.status === 'enabled')
                  .map((em) => (
                    <option key={em.id} value={em.id}>
                      {em.name}
                    </option>
                  ))}
                {row.expenseItemName && !(expenseMasters || []).some((em) => em.id === row.expenseItemId) && (
                  <option value={row.expenseItemId || ''}>{row.expenseItemName}</option>
                )}
              </select>
            ) : (
              <span className="font-bold text-slate-100">{row.expenseItemName}</span>
            )}
            {row.isMerged && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30 font-semibold shrink-0">
                合({row.mergedCount})
              </span>
            )}
          </div>
        );
      case 'transport':
        return onUpdateRowField ? (
          <select
            value={row.transportId || ''}
            onChange={(e) => {
              const target = (transportMasters || []).find((tm) => tm.id === e.target.value);
              onUpdateRowField(row.id, 'transportId', e.target.value);
              if (target) onUpdateRowField(row.id, 'transportName', target.name);
            }}
            className={`w-full text-sm py-0.5 px-1 rounded border focus:border-sky-400/60 text-slate-300 cursor-pointer focus:outline-none truncate ${fieldBox(!row.transportId)}`}
            title="选择交通工具"
          >
            <option value=""></option>
            {(transportMasters || [])
              .filter((tm) => tm.status === 'enabled')
              .map((tm) => (
                <option key={tm.id} value={tm.id}>
                  {tm.name}
                </option>
              ))}
            {row.transportName && !(transportMasters || []).some((tm) => tm.id === row.transportId) && (
              <option value={row.transportId || ''}>{row.transportName}</option>
            )}
          </select>
        ) : (
          <span className="text-slate-400">{row.transportName || ''}</span>
        );
      case 'startDate':
        return onUpdateRowField ? (
          <button
            type="button"
            data-date-trigger
            onClick={(e) => {
              e.stopPropagation();
              if (datePicker && datePicker.rowId === row.id && datePicker.field === 'startDate') {
                setDatePicker(null);
              } else {
                openDatePicker(e, row.id, 'startDate', row.startDate || '');
              }
            }}
            className={`w-full min-h-[26px] flex items-center text-left text-sm font-mono py-0.5 px-1 rounded border focus:border-sky-400/60 focus:outline-none whitespace-nowrap truncate ${fieldBox(!row.startDate)} ${
              row.startDate ? 'text-slate-300' : ''
            }`}
            title="选择开始日期"
          >
            {row.startDate || ''}
          </button>
        ) : (
          <span className="font-mono text-slate-400 text-sm">{row.startDate || ''}</span>
        );
      case 'endDate':
        return onUpdateRowField ? (
          <button
            type="button"
            data-date-trigger
            onClick={(e) => {
              e.stopPropagation();
              if (datePicker && datePicker.rowId === row.id && datePicker.field === 'endDate') {
                setDatePicker(null);
              } else {
                openDatePicker(e, row.id, 'endDate', row.endDate || '');
              }
            }}
            className={`w-full min-h-[26px] flex items-center text-left text-sm font-mono py-0.5 px-1 rounded border focus:border-sky-400/60 focus:outline-none whitespace-nowrap truncate ${fieldBox(!row.endDate)} ${
              row.endDate ? 'text-slate-300' : ''
            }`}
            title="选择结束日期"
          >
            {row.endDate || ''}
          </button>
        ) : (
          <span className="font-mono text-slate-400 text-sm">{row.endDate || ''}</span>
        );
      case 'departure':
        return onUpdateRowField || onUpdateRowLocation ? (
          <select
            value={row.departure || ''}
            onChange={(e) => {
              if (onUpdateRowField) onUpdateRowField(row.id, 'departure', e.target.value);
              else if (onUpdateRowLocation) onUpdateRowLocation(row.id, 'departure', e.target.value);
            }}
            className={`w-full text-sm py-0.5 px-1 rounded border focus:border-sky-400/60 text-slate-300 focus:outline-none cursor-pointer truncate ${fieldBox(!row.departure)}`}
            title="选择出发地（引自地点档案）"
          >
            <option value=""></option>
            {locationMasters?.filter((l) => l.status === 'enabled').map((loc) => (
              <option key={loc.id} value={loc.name}>
                {loc.name} {loc.city ? `(${loc.city})` : ''}
              </option>
            ))}
            {row.departure && !locationMasters?.some((l) => l.name === row.departure) && (
              <option value={row.departure}>{row.departure}</option>
            )}
          </select>
        ) : (
          <span className="text-slate-500 truncate block">{row.departure || ''}</span>
        );
      case 'destination':
        return onUpdateRowField || onUpdateRowLocation ? (
          <select
            value={row.destination || ''}
            onChange={(e) => {
              if (onUpdateRowField) onUpdateRowField(row.id, 'destination', e.target.value);
              else if (onUpdateRowLocation) onUpdateRowLocation(row.id, 'destination', e.target.value);
            }}
            className={`w-full text-sm py-0.5 px-1 rounded border focus:border-sky-400/60 text-slate-300 focus:outline-none cursor-pointer truncate ${fieldBox(!row.destination)}`}
            title="选择到达地（引自地点档案）"
          >
            <option value=""></option>
            {locationMasters?.filter((l) => l.status === 'enabled').map((loc) => (
              <option key={loc.id} value={loc.name}>
                {loc.name} {loc.city ? `(${loc.city})` : ''}
              </option>
            ))}
            {row.destination && !locationMasters?.some((l) => l.name === row.destination) && (
              <option value={row.destination}>{row.destination}</option>
            )}
          </select>
        ) : (
          <span className="text-slate-500 truncate block">{row.destination || ''}</span>
        );
      case 'itinerary': {
        const hasAttachment = !!row.itineraryAttachment;
        return (
          <div className="group flex items-center justify-start gap-1 py-0.5" onClick={(e) => e.stopPropagation()}>
            {hasAttachment ? (
              <div
                className="flex items-center gap-1 bg-sky-500/10 border border-sky-500/30 rounded px-1.5 py-0.5 max-w-[105px]"
                title={`已上传行程单附件: ${row.itineraryAttachment?.name}${row.itineraryCount ? `（共${row.itineraryCount}张）` : ''}`}
              >
                <Paperclip className="w-3 h-3 text-sky-300 shrink-0" />
                <button
                  type="button"
                  onClick={() => {
                    setPreviewItinerary({
                      name: row.itineraryAttachment!.name,
                      url: row.itineraryAttachment!.url,
                      type: row.itineraryAttachment!.type,
                      row,
                    });
                  }}
                  className="text-[11px] text-sky-300 hover:text-sky-200 font-medium truncate max-w-[55px] hover:underline cursor-pointer"
                >
                  {row.itineraryAttachment?.name || '行程单'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPreviewItinerary({
                      name: row.itineraryAttachment!.name,
                      url: row.itineraryAttachment!.url,
                      type: row.itineraryAttachment!.type,
                      row,
                    });
                  }}
                  title="预览行程单"
                  className="text-sky-400 hover:text-sky-300 cursor-pointer p-0.5 rounded hover:bg-sky-500/15"
                >
                  <Eye className="w-3 h-3" />
                </button>
                {onUpdateRowField && (
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateRowField(row.id, 'itineraryAttachment', undefined);
                      // 附件删除后行程单计数同步归零，保持计数与实际附件一致
                      onUpdateRowField(row.id, 'itineraryCount', 0);
                    }}
                    title="删除行程单附件"
                    className="text-slate-500 hover:text-rose-400 cursor-pointer p-0.5 rounded hover:bg-rose-500/15"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            ) : onUpdateRowField ? (
              <label className="cursor-pointer inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-dashed border-white/15 hover:border-sky-400/60 hover:bg-sky-500/10 text-xs text-slate-400 hover:text-sky-300 transition-colors">
                <Paperclip className="w-3 h-3 text-slate-500" />
                <span className="whitespace-nowrap">上传附件</span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      const dataUrl = event.target?.result as string;
                      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
                      onUpdateRowField(row.id, 'itineraryAttachment', {
                        name: file.name,
                        type: isPdf ? 'pdf' : 'image',
                        url: dataUrl,
                        fileSize: `${(file.size / 1024).toFixed(1)} KB`,
                        uploadDate: new Date().toLocaleDateString('zh-CN'),
                      });
                      if (!row.itineraryCount || row.itineraryCount === 0) {
                        onUpdateRowField(row.id, 'itineraryCount', 1);
                      }
                    };
                    reader.readAsDataURL(file);
                    e.target.value = '';
                  }}
                />
              </label>
            ) : (
              <span className="font-mono text-slate-400 text-xs"></span>
            )}

            {/* 张数：空值显示框线；有值时悬浮/聚焦才显示 */}
            {onUpdateRowField ? (
              <input
                type="number"
                min="0"
                step="1"
                value={row.itineraryCount ?? ''}
                onChange={(e) =>
                  onUpdateRowField(
                    row.id,
                    'itineraryCount',
                    e.target.value === '' ? undefined : Number(e.target.value)
                  )
                }
                className={`w-8 text-left font-mono py-0.5 px-0.5 rounded border focus:border-sky-400/60 text-slate-300 text-sm focus:outline-none transition-opacity [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${fieldBox(row.itineraryCount == null)} ${
                  row.itineraryCount ? 'opacity-0 group-hover:opacity-100 focus:opacity-100' : ''
                }`}
                title="行程单张数"
              />
            ) : (
              row.itineraryCount && row.itineraryCount > 0 ? (
                <span className="hidden group-hover:inline font-mono text-slate-500 text-sm whitespace-nowrap">
                  {row.itineraryCount}张
                </span>
              ) : null
            )}
          </div>
        );
      }
      case 'subsidyDays':
        return onUpdateRowField || onUpdateRowSubsidyDays ? (
          <div className="flex items-center justify-start">
            <input
              type="number"
              min="0"
              step="1"
              value={row.subsidyDays ?? ''}
              onChange={(e) => {
                const val = e.target.value === '' ? undefined : Number(e.target.value);
                if (onUpdateRowField) onUpdateRowField(row.id, 'subsidyDays', val);
                else if (onUpdateRowSubsidyDays) onUpdateRowSubsidyDays(row.id, val);
              }}
              title={`输入出差补贴天数（标准：¥${subsidyRate}/天）`}
              className="w-14 text-left font-mono py-0.5 px-1 bg-white/[0.03] hover:bg-white/[0.06] focus:bg-white/[0.08] border border-white/10 focus:border-sky-400/60 rounded text-sm text-slate-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
        ) : (
          <span className="font-mono text-slate-400 text-sm">{row.subsidyDays ?? ''}</span>
        );
      case 'totalAmount':
        // 补贴天数差额逻辑：有补贴天数时只显示超/缺/持平差额，不显示票面金额
        if (row.subsidyDays !== undefined && row.subsidyDays > 0) {
          if (row.diffType === 'over') {
            return (
              <div className="flex items-center justify-start">
                <span className="font-mono tabular-nums font-bold amount-flame">
                  超{row.diffValue?.toFixed(2) || '0.00'}
                </span>
              </div>
            );
          }
          if (row.diffType === 'lack') {
            return (
              <div className="flex items-center justify-start">
                <span className="font-mono tabular-nums font-bold amount-rose">
                  缺{row.diffValue?.toFixed(2) || '0.00'}
                </span>
              </div>
            );
          }
          return (
            <div className="flex items-center justify-start">
              <span className="font-mono tabular-nums font-bold amount-mint">
                持平 (0.00)
              </span>
            </div>
          );
        }
        return onUpdateRowField ? (
          <div className="flex items-center justify-start">
            <input
              type="number"
              step="0.01"
              value={row.totalAmount || ''}
              onChange={(e) =>
                onUpdateRowField(row.id, 'totalAmount', parseFloat(e.target.value) || 0)
              }
              className={`w-24 text-left font-mono tabular-nums font-semibold py-0.5 px-1 rounded border focus:border-sky-400/60 text-sm text-slate-100 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${fieldBox(!row.totalAmount)}`}
              title="修改金额"
            />
          </div>
        ) : (
          <span className="font-mono tabular-nums font-semibold amount-mint text-sm">
            ¥{row.totalAmount.toFixed(2)}
          </span>
        );
      case 'remarks':
        return onUpdateRowField || onUpdateRowRemarks ? (
          <input
            type="text"
            value={row.remarks || ''}
            onChange={(e) => {
              if (onUpdateRowField) onUpdateRowField(row.id, 'remarks', e.target.value);
              else if (onUpdateRowRemarks) onUpdateRowRemarks(row.id, e.target.value);
            }}
            placeholder="填写明细说明..."
            className={`w-full text-sm py-0.5 px-1 border focus:border-sky-400/60 rounded text-slate-300 focus:outline-none ${fieldBox(!row.remarks)}`}
          />
        ) : (
          <span className="text-slate-500 truncate block" title={row.remarks}>
            {row.remarks || ''}
          </span>
        );
      case 'actions':
        return row.isMerged ? (
          <button
            onClick={() => toggleExpand(row.id)}
            title={expandedRowIds.includes(row.id) ? '收起发票来源' : '展开查看发票来源'}
            className="p-0.5 text-slate-500 hover:text-slate-200 rounded hover:bg-white/5 cursor-pointer"
          >
            {expandedRowIds.includes(row.id) ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>
        ) : null;
      default:
        return null;
    }
  };

  return (
    <div className="bg-[#0d1424] border-b border-white/[0.06] select-none">
      {/* Section Header & Actions */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06] bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <div className="px-3 py-1 font-bold text-xs text-slate-100 border-b-2 border-sky-400 bg-white/[0.03] shadow-xs rounded-t">
            报销明细
          </div>
        </div>

        {/* Toolbar Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            onClick={onAddManualRow}
            className="btn-flame flex items-center gap-1 px-2.5 py-1 rounded font-semibold transition-colors shadow-2xs cursor-pointer"
            title="增加手动报销明细行"
          >
            <Plus className="w-3.5 h-3.5 text-amber-900" />
            <span>增行</span>
          </button>

          <button
            onClick={onDeleteSelected}
            disabled={selectedIds.length === 0}
            className={`flex items-center gap-1 px-2.5 py-1 border rounded transition-colors ${
              selectedIds.length > 0
                ? 'text-rose-300 bg-rose-500/10 hover:bg-rose-500/15 border-rose-500/30 cursor-pointer'
                : 'text-slate-500 border-white/10 bg-white/[0.02] cursor-not-allowed'
            }`}
          >
            <Trash2 className="w-3 h-3" />
            <span>删行 ({selectedIds.length})</span>
          </button>

          <button
            onClick={onBatchEdit}
            disabled={selectedIds.length === 0}
            className={`flex items-center gap-1 px-2.5 py-1 border rounded transition-colors ${
              selectedIds.length > 0
                ? 'btn-primary border-transparent cursor-pointer'
                : 'text-slate-500 border-white/10 bg-white/[0.02] cursor-not-allowed'
            }`}
          >
            <Edit3 className="w-3 h-3 text-slate-500" />
            <span>批量修改</span>
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div ref={wrapperRef} className="overflow-x-auto w-full">
        <table
          className={`text-sm text-left border-collapse table-fixed ${
            userSized ? '' : 'w-full'
          }`}
          style={userSized ? { width: `${tableWidth}px` } : undefined}
        >
          {/* 列宽权威来源统一收敛到 colgroup，th 不再各自写宽度，避免浏览器二次折算 */}
          <colgroup>
            {columns.map((col) => (
              <col
                key={col.key}
                style={{
                  width: `${colWidths[col.key] ?? col.defaultWidth}px`,
                }}
              />
            ))}
          </colgroup>
          <thead>
            <tr className="bg-white/[0.04] text-slate-300 border-b border-white/[0.06] h-11 font-semibold">
              {columns.map((col) => {
                const isResizing = resizingCol?.key === col.key;
                return (
                  <th
                    key={col.key}
                    className={`group relative px-3 py-3 select-none whitespace-nowrap ${
                      col.align === 'center'
                        ? 'text-center'
                        : col.align === 'right'
                        ? 'text-right'
                        : 'text-left'
                    } ${dragOverColKey === col.key ? 'bg-rose-500/15 border-r-2 border-rose-500' : ''}`}
                    draggable={col.draggable}
                    onDragStart={() => handleDragStart(col.key)}
                    onDragOver={(e) => handleDragOver(e, col.key)}
                    onDrop={() => handleDrop(col.key)}
                  >
                    {col.key === 'checkbox' ? (
                      <input
                        type="checkbox"
                        checked={items.length > 0 && selectedIds.length === items.length}
                        onChange={toggleSelectAll}
                        className="cb-dark w-4 h-4"
                      />
                    ) : (
                      <div
                        className={`flex items-center gap-1 ${
                          col.align === 'center'
                            ? 'justify-center'
                            : col.align === 'right'
                            ? 'justify-end'
                            : 'justify-start'
                        }`}
                      >
                        {col.draggable && (
                          <GripVertical className="w-3 h-3 text-slate-500 opacity-50 hover:opacity-100" />
                        )}
                        <span>{col.label}</span>
                      </div>
                    )}

                    {/* Column resize handle：10px 命中区，悬停表头即出现指示线，拖动时常亮 */}
                    <div
                      onMouseDown={(e) => startResizing(col.key, e)}
                      title="按住拖动调整列宽"
                      className={`absolute right-0 top-0 bottom-0 z-20 w-2.5 cursor-col-resize flex justify-center ${
                        isResizing ? 'bg-sky-400/20' : ''
                      }`}
                    >
                      <div
                        className={`w-px h-full transition-colors ${
                          isResizing
                            ? 'bg-sky-400'
                            : 'bg-transparent group-hover:bg-sky-400/60'
                        }`}
                      />
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04] text-slate-200 text-sm">
            {items.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-8 text-left text-slate-500 bg-white/[0.02]">
                  暂无报销明细。可在上方点击【增行 (无发票)】手动维护，或在下方【发票明细】添加发票自动生成。
                </td>
              </tr>
            ) : (
              items.map((row) => {
                const isSelected = selectedIds.includes(row.id);
                const isExpanded = expandedRowIds.includes(row.id);

                return (
                  <React.Fragment key={row.id}>
                    <tr
                      className={`h-10 hover:bg-sky-500/5 transition-colors ${
                        isSelected ? 'bg-sky-500/10' : row.isMerged ? 'bg-amber-500/5' : ''
                      }`}
                    >
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={`px-1.5 truncate ${
                            col.align === 'center'
                              ? 'text-center'
                              : col.align === 'right'
                              ? 'text-right'
                              : 'text-left'
                          }`}
                        >
                          {renderCell(row, col.key, isSelected)}
                        </td>
                      ))}
                    </tr>

                    {/* Inline Expandable Source Invoices: Sequence: 发票号码, 发票日期, 发票金额 */}
                    {isExpanded && row.isMerged && (
                      <tr className="bg-white/[0.02] border-b border-white/[0.06]">
                        <td colSpan={columns.length} className="p-3">
                          <div className="bg-[#0d1424] rounded border border-white/[0.06] p-2.5 shadow-xs">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-xs text-slate-100">
                                  来源发票追溯（{row.expenseItemName} · 合并 {row.mergedCount} 笔）
                                </span>
                                <span className="text-[11px] text-slate-500">
                                  累计价税合计: ¥{row.invoiceSumAmount?.toFixed(2) || row.totalAmount.toFixed(2)} | 累计税额: ¥{row.taxAmount.toFixed(2)}
                                </span>
                              </div>
                              <button
                                onClick={() => onTraceRow(row)}
                                className="text-xs text-sky-300 hover:text-sky-200 font-medium hover:underline cursor-pointer"
                              >
                                查看原件明细弹窗 →
                              </button>
                            </div>

                            {/* Detailed List sorted as: 发票号码, 发票日期, 发票金额 */}
                            <div className="border border-white/[0.06] rounded overflow-hidden">
                              <table className="w-full text-sm text-left border-collapse">
                                <thead>
                                  <tr className="bg-white/[0.03] text-slate-400 font-semibold h-10">
                                    <th className="px-4">发票号码</th>
                                    <th className="px-4">发票日期</th>
                                    <th className="px-4 text-left">发票金额 (价税合计)</th>
                                    <th className="px-4 text-left">状态</th>
                                    <th className="px-4 text-left">原始凭证</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.04]">
                                  {row.sourceInvoiceNumbers.map((invNo, idx) => {
                                    const matchedBill = bills?.find((b) => b.invoiceNumber === invNo);
                                    return (
                                      <tr key={idx} className="h-10 hover:bg-white/[0.04]">
                                        <td className="px-4 font-mono font-medium text-slate-200">
                                          {matchedBill && onPreviewInvoice ? (
                                            <button
                                              onClick={() => onPreviewInvoice(matchedBill)}
                                              className="text-sky-300 hover:text-sky-200 hover:underline cursor-pointer"
                                              title="查看原始凭证"
                                            >
                                              {invNo}
                                            </button>
                                          ) : (
                                            invNo
                                          )}
                                        </td>
                                        <td className="px-4 font-mono text-slate-400 text-sm">
                                          {matchedBill?.invoiceDate || row.startDate || ''}
                                        </td>
                                        <td className="px-4 text-left font-mono font-bold amount-mint text-sm">
                                          ¥{(matchedBill?.totalAmount ?? (row.totalAmount / row.mergedCount)).toFixed(2)}
                                        </td>
                                        <td className="px-4 text-left">
                                          <span className="badge badge-mint">
                                            已核验
                                          </span>
                                        </td>
                                        <td className="px-4 text-left">
                                          {matchedBill && onPreviewInvoice && (
                                            <button
                                              onClick={() => onPreviewInvoice(matchedBill)}
                                              className="text-sm text-sky-300 hover:text-sky-200 hover:underline cursor-pointer"
                                            >
                                              查看原件
                                            </button>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
          <tfoot>
            <tr className="bg-white/[0.03] font-bold text-slate-100 border-t border-white/[0.06] h-11">
              <td colSpan={2} className="px-3 text-left text-slate-300">
                合计
              </td>
              <td colSpan={columns.length - 5} className="px-3 text-slate-400 font-normal text-sm">
                明细记录共 {items.length} 行
              </td>
              <td className="px-3 text-left font-mono amount-mint text-base">
                ¥{totalAmount.toFixed(2)}
              </td>
              <td colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Itinerary Attachment Preview Modal */}
      {previewItinerary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 select-none animate-in fade-in duration-150">
          <div className="bg-[#0d1424] rounded-lg shadow-2xl border border-white/[0.06] w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-4 py-3 border-b border-white/[0.06] bg-white/[0.02] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-sky-300" />
                <h4 className="text-sm font-bold text-slate-100 truncate max-w-md">
                  行程单附件预览 - {previewItinerary.name}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setPreviewItinerary(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-white/5 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 flex flex-col items-center justify-center bg-white/[0.02] min-h-[300px]">
              {previewItinerary.type === 'image' || previewItinerary.url.startsWith('data:image') ? (
                <img
                  src={previewItinerary.url}
                  alt={previewItinerary.name}
                  className="max-h-[65vh] object-contain rounded shadow-sm border border-slate-300 bg-white"
                />
              ) : (
                <iframe
                  src={previewItinerary.url}
                  title={previewItinerary.name}
                  className="w-full h-[65vh] border-0 rounded bg-white"
                />
              )}
            </div>
            <div className="px-4 py-2.5 border-t border-white/[0.06] bg-[#0d1424] flex items-center justify-between text-xs text-slate-400">
              <span>
                关联行程：{previewItinerary.row.departure || '始发地'} ➔ {previewItinerary.row.destination || '到达地'} ({previewItinerary.row.transportName || '交通'}) · ¥{(previewItinerary.row.totalAmount || 0).toFixed(2)}
              </span>
              <button
                type="button"
                onClick={() => setPreviewItinerary(null)}
                className="btn-ghost px-3 py-1 rounded font-medium cursor-pointer transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 自定义日期选择弹层（fixed 定位，不受表格 overflow 裁剪影响） */}
      {datePicker && (
        <CalendarPopover
          value={datePicker.value}
          anchor={{ top: datePicker.top, left: datePicker.left }}
          onSelect={(date) => {
            onUpdateRowField?.(datePicker.rowId, datePicker.field, date);
            setDatePicker(null);
          }}
          onClear={() => {
            onUpdateRowField?.(datePicker.rowId, datePicker.field, '');
            setDatePicker(null);
          }}
          onClose={() => setDatePicker(null)}
        />
      )}
    </div>
  );
};
