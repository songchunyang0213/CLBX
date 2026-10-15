import React, { useRef, useEffect, useState } from 'react';
import {
  Plus,
  Trash2,
  Edit3,
  ExternalLink,
  GripVertical,
} from 'lucide-react';
import { BillItem, ExpenseItemMaster, TransportMaster, ProjectMaster } from '../types/reimbursement';

interface BillTableProps {
  bills: BillItem[];
  selectedIds: string[];
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  expenseMasters: ExpenseItemMaster[];
  transportMasters: TransportMaster[];
  projectMasters: ProjectMaster[];
  onAddBill: () => void;
  onImportPersonalBills?: () => void;
  pendingPersonalCount?: number;
  onDeleteSelected: () => void;
  onBatchEdit: () => void;
  onUpdateBillExpense: (billId: string, newExpenseId: string) => void;
  onUpdateBillTransport: (billId: string, newTransportId: string) => void;
  onUpdateBillProject: (billId: string, newProjectId: string) => void;
  onPreviewInvoice: (bill: BillItem) => void;
}

type BillColumnKey =
  | 'checkbox'
  | 'orderNo'
  | 'project'
  | 'expenseItem'
  | 'invoiceNumber'
  | 'invoiceDate'
  | 'consumptionType'
  | 'totalAmount'
  | 'transport';

interface ColumnDef {
  key: BillColumnKey;
  label: string;
  defaultWidth: number;
  align?: 'left' | 'center' | 'right';
  draggable: boolean;
}

/** 列宽允许收缩的最小像素值（任何列都不会被拖得比这更窄） */
const MIN_COL_WIDTH = 36;

const DEFAULT_BILL_COLUMNS: ColumnDef[] = [
  { key: 'checkbox', label: '', defaultWidth: 44, align: 'left', draggable: false },
  { key: 'orderNo', label: '序号', defaultWidth: 60, align: 'center', draggable: false },
  { key: 'project', label: '项目', defaultWidth: 180, align: 'left', draggable: true },
  { key: 'expenseItem', label: '费用项目', defaultWidth: 160, align: 'left', draggable: true },
  { key: 'invoiceNumber', label: '发票号码', defaultWidth: 200, align: 'left', draggable: true },
  { key: 'invoiceDate', label: '开票日期', defaultWidth: 120, align: 'left', draggable: true },
  { key: 'consumptionType', label: '消费类型', defaultWidth: 120, align: 'left', draggable: true },
  { key: 'totalAmount', label: '金额', defaultWidth: 120, align: 'left', draggable: true },
  { key: 'transport', label: '交通工具', defaultWidth: 140, align: 'left', draggable: true },
];

export const BillTable: React.FC<BillTableProps> = ({
  bills,
  selectedIds,
  setSelectedIds,
  expenseMasters,
  transportMasters,
  projectMasters,
  onAddBill,
  onImportPersonalBills,
  pendingPersonalCount = 0,
  onDeleteSelected,
  onBatchEdit,
  onUpdateBillExpense,
  onUpdateBillTransport,
  onUpdateBillProject,
  onPreviewInvoice,
}) => {
  const [columns, setColumns] = useState<ColumnDef[]>(DEFAULT_BILL_COLUMNS);
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    DEFAULT_BILL_COLUMNS.forEach((c) => {
      init[c.key] = c.defaultWidth;
    });
    return init;
  });

  // 是否已发生过手动调宽：未调宽时表格 w-full 自动撑满；调宽后改用精确像素总宽，保证每列宽度独立
  const [userSized, setUserSized] = useState(false);

  const [draggedColKey, setDraggedColKey] = useState<BillColumnKey | null>(null);
  const [dragOverColKey, setDragOverColKey] = useState<BillColumnKey | null>(null);

  // Column resizing state
  const [resizingCol, setResizingCol] = useState<{ key: string; startX: number; startWidth: number } | null>(null);

  // 外层滚动容器：侧边栏收起/展开或窗口尺寸变化时容器宽度改变。
  // 用户已手动调宽（userSized）时，表格按容器变化比例同步缩放，始终自动适应。
  // 全同步 ref 设计：当前列宽与缩放基准都在事件触发的同一时刻读写，不依赖 React effect 异步提交；
  // 基准只在 mouseup 时固化一次，过渡动画的任何中间帧都从同一基准重算，无舍入误差累积。
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
          // 尾列吸收四舍五入误差，保证总宽精确
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

  const handleDragStart = (key: BillColumnKey) => {
    setDraggedColKey(key);
  };

  const handleDragOver = (e: React.DragEvent, key: BillColumnKey) => {
    e.preventDefault();
    if (draggedColKey !== key) {
      setDragOverColKey(key);
    }
  };

  const handleDrop = (targetKey: BillColumnKey) => {
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
      setSelectedIds(bills.map((b) => b.id));
    } else {
      setSelectedIds([]);
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const totalAmount = bills.reduce((acc, b) => acc + (b.totalAmount || 0), 0);

  // 手动调宽后表格的精确总宽 = 各列宽度之和；超出容器时由外层 overflow-x-auto 横向滚动承接
  const tableWidth = columns.reduce(
    (sum, col) => sum + (colWidths[col.key] ?? col.defaultWidth),
    0
  );

  const renderCell = (bill: BillItem, colKey: BillColumnKey, isSelected: boolean) => {
    switch (colKey) {
      case 'checkbox':
        return (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => toggleSelectRow(bill.id)}
            className="cb-dark w-3.5 h-3.5"
          />
        );
      case 'orderNo':
        return <span className="text-slate-500 font-mono text-[11px]">{bill.orderNo}</span>;
      case 'project':
        return (
          <select
            value={bill.projectId || ''}
            onChange={(e) => onUpdateBillProject(bill.id, e.target.value)}
            className="w-full bg-transparent hover:bg-white/[0.04] focus:bg-white/[0.06] border border-transparent hover:border-white/10 focus:border-sky-400/60 rounded py-0.5 px-1 text-xs text-slate-200 focus:outline-none transition-colors cursor-pointer truncate"
            title="选择所属项目"
          >
            <option value="">未指定项目</option>
            {projectMasters
              .filter((pm) => pm.status === 'enabled')
              .map((pm) => (
                <option key={pm.id} value={pm.id}>
                  {pm.name}
                </option>
              ))}
          </select>
        );
      case 'expenseItem':
        // Rule 7: 只显示费用项目的名字，不要带有(合并)或(不合并)
        return (
          <select
            value={bill.expenseItemId}
            onChange={(e) => onUpdateBillExpense(bill.id, e.target.value)}
            className="w-full bg-transparent hover:bg-white/[0.04] focus:bg-white/[0.06] border border-transparent hover:border-white/10 focus:border-sky-400/60 rounded py-0.5 px-1 text-xs text-slate-100 font-medium focus:outline-none transition-colors cursor-pointer truncate"
            title="修改费用项目将自动更新报销明细聚合"
          >
            {expenseMasters
              .filter((em) => em.status === 'enabled')
              .map((em) => (
                <option key={em.id} value={em.id}>
                  {em.name}
                </option>
              ))}
          </select>
        );
      case 'invoiceNumber':
        return (
          <button
            onClick={() => onPreviewInvoice(bill)}
            title="单击查看发票原件及核验信息"
            className="text-slate-200 hover:text-sky-300 hover:underline flex items-center gap-1 group truncate font-mono text-[11px] cursor-pointer"
          >
            <span className="truncate">{bill.invoiceNumber}</span>
            <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 text-sky-400 shrink-0" />
          </button>
        );
      case 'invoiceDate':
        return <span className="font-mono text-slate-400 text-[11px]">{bill.invoiceDate}</span>;
      case 'consumptionType':
        return <span className="text-slate-400 truncate block">{bill.consumptionType}</span>;
      case 'totalAmount':
        return (
          <span className="font-mono tabular-nums font-semibold amount-mint">
            ¥{bill.totalAmount.toFixed(2)}
          </span>
        );
      case 'transport':
        return (
          <select
            value={bill.transportId || ''}
            onChange={(e) => onUpdateBillTransport(bill.id, e.target.value)}
            className="w-full bg-transparent hover:bg-white/[0.04] focus:bg-white/[0.06] border border-transparent hover:border-white/10 focus:border-sky-400/60 rounded py-0.5 px-1 text-xs text-slate-300 focus:outline-none transition-colors cursor-pointer truncate"
          >
            <option value="">-</option>
            {transportMasters
              .filter((tm) => tm.status === 'enabled')
              .map((tm) => (
                <option key={tm.id} value={tm.id}>
                  {tm.name}
                </option>
              ))}
          </select>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-[#0d1424] border-b border-white/[0.06] select-none">
      {/* Section Header & Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06] bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <div className="px-3 py-1 font-bold text-xs text-slate-100 border-b-2 border-sky-400 bg-white/[0.03] shadow-xs rounded-t">
            发票明细
          </div>
        </div>

        {/* Toolbar Buttons */}
        <div className="flex items-center gap-1.5 text-xs">
          {onImportPersonalBills && (
            <button
              onClick={onImportPersonalBills}
              className="btn-ghost flex items-center gap-1 px-2.5 py-1 rounded font-medium transition-colors cursor-pointer"
              title="打开发票账单"
            >
              <span>发票账单</span>
            </button>
          )}

          <button
            onClick={onAddBill}
            className="btn-primary flex items-center gap-1 px-2.5 py-1 rounded transition-colors cursor-pointer"
          >
            <Plus className="w-3 h-3 text-slate-500" />
            <span>采集发票</span>
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
            <span>删除 ({selectedIds.length})</span>
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
                    } ${dragOverColKey === col.key ? 'bg-sky-500/15 border-r-2 border-sky-500' : ''}`}
                    draggable={col.draggable}
                    onDragStart={() => handleDragStart(col.key)}
                    onDragOver={(e) => handleDragOver(e, col.key)}
                    onDrop={() => handleDrop(col.key)}
                  >
                    {col.key === 'checkbox' ? (
                      <input
                        type="checkbox"
                        checked={bills.length > 0 && selectedIds.length === bills.length}
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
          <tbody className="divide-y divide-white/[0.04] text-slate-200">
            {bills.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-10 text-left text-slate-500 bg-white/[0.02]">
                  当前报销单尚未添加任何发票。点击上方按钮采集或从发票账单导入。
                </td>
              </tr>
            ) : (
              bills.map((bill) => {
                const isSelected = selectedIds.includes(bill.id);
                return (
                  <tr
                    key={bill.id}
                    className={`h-10 hover:bg-sky-500/5 transition-colors ${
                      isSelected ? 'bg-sky-500/10' : ''
                    }`}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`px-3 ${
                          col.align === 'center'
                            ? 'text-center'
                            : col.align === 'right'
                            ? 'text-right'
                            : 'text-left'
                        }`}
                      >
                        {renderCell(bill, col.key, isSelected)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
          <tfoot>
            <tr className="bg-white/[0.03] font-bold text-slate-100 border-t border-white/[0.06] h-11">
              <td colSpan={2} className="px-3 text-left text-slate-300">
                合计
              </td>
              <td colSpan={5} className="px-3 text-slate-400 font-normal text-sm">
                发票共 {bills.length} 笔
              </td>
              <td className="px-3 text-left font-mono amount-mint text-base">
                ¥{totalAmount.toFixed(2)}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
