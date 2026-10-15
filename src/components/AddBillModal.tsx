import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  X,
  UploadCloud,
  FileText,
  CheckCircle2,
  Cpu,
  Eye,
  XCircle,
  Check,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react';
import {
  BillItem,
  ExpenseItemMaster,
  TransportMaster,
  ProjectMaster,
  ConsumptionTypeMaster,
} from '../types/reimbursement';
import { parseInvoiceFileOffline, RecognizedInvoice, preloadOcrWorker } from '../utils/invoiceOCR';
import { InvoicePreviewModal } from './InvoicePreviewModal';

interface AddBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddBill: (newBill: Omit<BillItem, 'id' | 'orderNo' | 'createdAt'>) => void;
  expenseMasters: ExpenseItemMaster[];
  transportMasters: TransportMaster[];
  projectMasters: ProjectMaster[];
  consumptionTypeMasters?: ConsumptionTypeMaster[];
  referencedInvoiceNumbers?: string[];
  /** 当前单据已有的账单明细，用于展示"系统已有"那张重复发票 */
  existingBills?: BillItem[];
  /** 用新识别的发票覆盖系统中同号的已有发票（保留原 id/序号/创建时间） */
  onReplaceBill?: (params: {
    invoiceNumber: string;
    newBill: Omit<BillItem, 'id' | 'orderNo' | 'createdAt'>;
  }) => void;
}

/** 批量采集时单个文件的识别状态 */
interface BatchItem {
  id: string;
  file: File;
  status: 'pending' | 'processing' | 'success' | 'error' | 'duplicate';
  result?: RecognizedInvoice;
  error?: string;
}

export const AddBillModal: React.FC<AddBillModalProps> = ({
  isOpen,
  onClose,
  onAddBill,
  expenseMasters,
  transportMasters,
  projectMasters,
  consumptionTypeMasters = [],
  referencedInvoiceNumbers = [],
  existingBills = [],
  onReplaceBill,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [recognized, setRecognized] = useState<RecognizedInvoice | null>(null);
  const [ocrStatus, setOcrStatus] = useState<string>('');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // 批量采集：多文件队列；非 null 即处于批量模式
  const [batchItems, setBatchItems] = useState<BatchItem[] | null>(null);
  // 批量结果列表中"查看原件"的预览对象与临时文件 URL
  const [batchPreviewBill, setBatchPreviewBill] = useState<BillItem | null>(null);
  const batchPreviewUrlRef = useRef<string | null>(null);
  // 重复发票：是否弹出"保留哪一张写入系统"选择
  const [dupChoiceOpen, setDupChoiceOpen] = useState(false);

  // Form editable state (Cleaned up: removed invoiceCode, expenseItem, etc.)
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [remarks, setRemarks] = useState('');

  // Auto-resolved background attributes
  const [consumptionType, setConsumptionType] = useState('交通');
  const [billType, setBillType] = useState('数电票 (普通发票)');
  const [sellerName, setSellerName] = useState('滴滴出行科技有限公司');
  const [recommendedExpenseId, setRecommendedExpenseId] = useState<string>('');
  const [recommendedTransportId, setRecommendedTransportId] = useState<string>('');

  // 弹窗打开时预加载 tesseract worker（模型加载需 3-5 秒，提前加载可让上传识别更快）
  useEffect(() => {
    if (isOpen) preloadOcrWorker();
  }, [isOpen]);

  // 每次关闭（确认采集或取消）后清空全部采集记录，避免下次打开残留上次的发票数据
  useEffect(() => {
    if (isOpen) return;
    setRecognized(null);
    setOcrStatus('');
    setIsPreviewOpen(false);
    setInvoiceNumber('');
    setInvoiceDate('');
    setTotalAmount(0);
    setRemarks('');
    setConsumptionType('交通');
    setBillType('数电票 (普通发票)');
    setSellerName('滴滴出行科技有限公司');
    setRecommendedExpenseId('');
    setRecommendedTransportId('');
    setBatchItems(null);
    setDupChoiceOpen(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [isOpen]);

  // 组件卸载时释放预览用临时 URL（必须位于早期 return 之前，遵守 Hooks 调用规则）
  useEffect(() => {
    return () => {
      if (batchPreviewUrlRef.current) {
        URL.revokeObjectURL(batchPreviewUrlRef.current);
      }
    };
  }, []);

  // Check if invoice number is already referenced
  const isInvoiceReferenced = Boolean(
    invoiceNumber.trim() &&
      referencedInvoiceNumbers &&
      referencedInvoiceNumbers.some(
        (num) => num.trim().toLowerCase() === invoiceNumber.trim().toLowerCase()
      )
  );

  // 当前单据中同号的已有发票（用于"保留哪一张"对比展示与覆盖写入）
  const duplicateExistingBill = useMemo(() => {
    const target = invoiceNumber.trim().toLowerCase();
    if (!target) return null;
    return (
      existingBills.find(
        (b) => b.invoiceNumber && b.invoiceNumber.trim().toLowerCase() === target
      ) || null
    );
  }, [existingBills, invoiceNumber]);

  if (!isOpen) return null;

  const handleFileUpload = async (file: File) => {
    setIsProcessing(true);
    setOcrStatus('正在启动发票结构化解析引擎抽取发票要素...');

    setTimeout(async () => {
      try {
        const result = await parseInvoiceFileOffline(file, true, consumptionTypeMasters, setOcrStatus);
        setRecognized(result);
        applyRecognizedToForm(result);
        setOcrStatus('解析成功！已自动抽取票据要素。');
      } catch (err) {
        console.error(err);
        setOcrStatus('解析完成，请核对信息');
      } finally {
        setIsProcessing(false);
      }
    }, 450);
  };

  /**
   * 根据识别结果选定费用项目，优先级：
   * 1) 费用档案中"关联消费档案"等于发票消费类型的启用项（核心自动匹配）；
   * 2) OCR 推荐费用项目名称命中；
   * 3) 费用项目名称包含发票消费类型；
   * 4) 兜底：取第二个/第一个费用项目。
   */
  const findTargetExpense = (res: RecognizedInvoice) =>
    expenseMasters.find(
      (e) =>
        e.status === 'enabled' &&
        !!e.linkedConsumptionType &&
        e.linkedConsumptionType === res.consumptionType
    ) ||
    expenseMasters.find((e) => e.name === res.recommendedExpenseItemName) ||
    expenseMasters.find((e) => e.name.includes(res.consumptionType)) ||
    expenseMasters[1] ||
    expenseMasters[0];

  const applyRecognizedToForm = (res: RecognizedInvoice) => {
    setInvoiceNumber(res.invoiceNumber);
    setInvoiceDate(res.invoiceDate);
    setTotalAmount(res.totalAmount);
    setSellerName(res.sellerName || '智能开票服务商');
    setBillType(res.billType || '数电票 (普通发票)');
    setConsumptionType(res.consumptionType || '交通');

    // Auto-match background masters
    const targetExpense = findTargetExpense(res);
    if (targetExpense) setRecommendedExpenseId(targetExpense.id);
    if (res.recommendedTransportName) {
      const matchedTr = transportMasters.find((t) => t.name === res.recommendedTransportName);
      if (matchedTr) setRecommendedTransportId(matchedTr.id);
    }

    // 备注字段不取任何默认值，仅限手工填写
    setRemarks('');
  };

  /** 多文件入口：单张走原有单票流程，多张进入批量识别队列 */
  const handleFilesUpload = (files: File[]) => {
    if (files.length === 0) return;
    if (files.length === 1) {
      setBatchItems(null);
      handleFileUpload(files[0]);
      return;
    }
    // 批量模式：清空单票编辑态，建立队列
    setRecognized(null);
    setOcrStatus('');
    setBatchItems(
      files.map((f, i) => ({
        id: `batch-${Date.now()}-${i}`,
        file: f,
        status: 'pending' as const,
      }))
    );
    processBatch(files);
  };

  /** 顺序逐张识别（不并发，保证 pdfjs 解析稳定性与识别准确性），并做重复/缺要素校验 */
  const processBatch = async (files: File[]) => {
    setIsProcessing(true);
    const seen = new Set<string>(
      (referencedInvoiceNumbers || []).map((n) => n.trim().toLowerCase()).filter(Boolean)
    );
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setOcrStatus(`正在识别第 ${i + 1} / ${files.length} 张：${file.name}`);
      setBatchItems((prev) =>
        prev ? prev.map((b, idx) => (idx === i ? { ...b, status: 'processing' } : b)) : prev
      );
      try {
        const result = await parseInvoiceFileOffline(
          file,
          true,
          consumptionTypeMasters,
          (stage) => setOcrStatus(`正在识别第 ${i + 1} / ${files.length} 张：${file.name} · ${stage}`)
        );
        const num = (result.invoiceNumber || '').trim();
        let status: BatchItem['status'] = 'success';
        let error = '';
        if (num && seen.has(num.toLowerCase())) {
          status = 'duplicate';
          const isSystemDup = (referencedInvoiceNumbers || []).some(
            (n) => n.trim().toLowerCase() === num.toLowerCase()
          );
          if (isSystemDup) {
            error = `与已有单据发票号【${num}】重复，已标记跳过`;
          } else {
            error = `与本批次其他文件发票号【${num}】重复，已标记跳过`;
          }
        }
        if (num && status === 'success') seen.add(num.toLowerCase());
        setBatchItems((prev) =>
          prev
            ? prev.map((b, idx) =>
                idx === i ? { ...b, status, result, error: error || undefined } : b
              )
            : prev
        );
      } catch (err) {
        console.error('批量识别失败:', file.name, err);
        setBatchItems((prev) =>
          prev
            ? prev.map((b, idx) =>
                idx === i ? { ...b, status: 'error', error: '解析失败' } : b
              )
            : prev
        );
      }
    }
    setOcrStatus('');
    setIsProcessing(false);
  };

  /** 根据识别结果构建一条账单数据（净额/税额优先使用识别值，保证准确性） */
  const buildBillFromRecognized = (
    res: RecognizedInvoice
  ): Omit<BillItem, 'id' | 'orderNo' | 'createdAt'> => {
    const targetExpense = findTargetExpense(res);
    const targetTransport = transportMasters.find((t) => t.name === res.recommendedTransportName);
    const targetProject = projectMasters[0];
    const net = res.netAmount > 0 ? res.netAmount : Math.round((res.totalAmount / 1.06) * 100) / 100;
    const tax =
      res.taxAmount >= 0 && res.netAmount > 0
        ? res.taxAmount
        : Math.round((res.totalAmount - net) * 100) / 100;
    return {
      expenseItemId: targetExpense ? targetExpense.id : 'exp-2',
      expenseItemName: targetExpense ? targetExpense.name : '交通费用',
      transportId: targetTransport?.id,
      transportName: targetTransport?.name,
      projectId: targetProject?.id,
      projectName: targetProject?.name,
      invoiceNumber: res.invoiceNumber.trim(),
      invoiceDate: res.invoiceDate,
      billType: res.billType || '数电票 (普通发票)',
      consumptionType: res.consumptionType || '交通',
      totalAmount: res.totalAmount,
      reimbursableAmount: res.totalAmount,
      netAmount: net,
      taxAmount: tax,
      sellerName: res.sellerName || '优质服务供应商',
      buyerName: '测试公司C',
      remarks: '',
      invoiceFile: {
        name: res.fileName,
        type: res.fileType,
        url: res.fileUrl,
        fileSize: res.fileSizeText,
      },
    };
  };

  /** 批量确认：将所有识别成功且不重复的发票一次性入库 */
  const handleBatchSubmit = () => {
    if (!batchItems) return;
    const okItems = batchItems.filter((b) => b.status === 'success' && b.result);
    if (okItems.length === 0) {
      alert('没有可采集的发票：请检查识别失败或重复的条目');
      return;
    }
    okItems.forEach((b) => onAddBill(buildBillFromRecognized(b.result!)));
    onClose();
  };

  /**
   * 批量结果列表中"查看原件"：为用户上传的原始文件生成临时本地 URL 并打开预览，
   * 方便与识别出的号码、日期、金额逐张核对。
   */
  const handlePreviewBatchItem = (b: BatchItem) => {
    if (!b.result) return;
    // 释放上一次预览的临时 URL，避免内存泄漏
    if (batchPreviewUrlRef.current) {
      URL.revokeObjectURL(batchPreviewUrlRef.current);
    }
    const url = URL.createObjectURL(b.file);
    batchPreviewUrlRef.current = url;
    const base = buildBillFromRecognized(b.result);
    setBatchPreviewBill({
      ...base,
      id: 'batch-preview-temp',
      orderNo: 1,
      createdAt: '',
      invoiceFile: {
        name: b.file.name,
        // blob URL 不是 data:image，需显式标注类型，预览弹窗才能按图片渲染
        type: b.file.type.startsWith('image/') ? 'image' : 'pdf',
        url,
      },
    });
  };

  /** 清空批量队列，回到待上传状态 */
  const handleClearBatch = (e: React.MouseEvent) => {
    e.stopPropagation();
    setBatchItems(null);
    setOcrStatus('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 取消选择当前发票
  const handleCancelSelectedFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRecognized(null);
    setInvoiceNumber('');
    setTotalAmount(0);
    setRemarks('');
    setOcrStatus('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 预览当前选择的发票
  const handlePreviewCurrentFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPreviewOpen(true);
  };

  // 本次采集将写入的费用项目 / 交通工具名称（用于"保留哪一张"对比卡片）
  const newExpenseItemName =
    expenseMasters.find((e) => e.id === recommendedExpenseId)?.name ||
    expenseMasters.find(
      (e) => e.status === 'enabled' && e.linkedConsumptionType === consumptionType
    )?.name ||
    expenseMasters.find((e) => e.name.includes(consumptionType))?.name ||
    expenseMasters[1]?.name ||
    expenseMasters[0]?.name ||
    '—';
  const newTransportName =
    transportMasters.find((t) => t.id === recommendedTransportId)?.name || '';

  /** 根据当前表单态构建一条待入库账单（净额/税额按 6% 自动拆分） */
  const buildNewBillData = (): Omit<BillItem, 'id' | 'orderNo' | 'createdAt'> => {
    // Auto resolve expense item：优先用户已选项，其次按消费档案关联匹配
    const targetExpense =
      expenseMasters.find((e) => e.id === recommendedExpenseId) ||
      expenseMasters.find(
        (e) => e.status === 'enabled' && e.linkedConsumptionType === consumptionType
      ) ||
      expenseMasters.find((e) => e.name.includes(consumptionType)) ||
      expenseMasters[1] ||
      expenseMasters[0];

    const targetTransport = transportMasters.find((t) => t.id === recommendedTransportId);
    const targetProject = projectMasters[0];

    // Compute net and tax amounts automatically
    const net = Math.round((totalAmount / 1.06) * 100) / 100;
    const tax = Math.round((totalAmount - net) * 100) / 100;

    return {
      expenseItemId: targetExpense ? targetExpense.id : 'exp-2',
      expenseItemName: targetExpense ? targetExpense.name : '交通费用',
      transportId: targetTransport?.id,
      transportName: targetTransport?.name,
      projectId: targetProject?.id,
      projectName: targetProject?.name,
      invoiceNumber: invoiceNumber.trim(),
      invoiceDate,
      billType,
      consumptionType,
      totalAmount,
      reimbursableAmount: totalAmount,
      netAmount: net,
      taxAmount: tax,
      sellerName: sellerName || '优质服务供应商',
      buyerName: '测试公司C',
      remarks,
      invoiceFile: recognized
        ? {
            name: recognized.fileName,
            type: recognized.fileType,
            url: recognized.fileUrl,
            fileSize: recognized.fileSizeText,
          }
        : undefined,
    };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isInvoiceReferenced) {
      // 检测到重复发票：不再硬拦截，弹出"保留哪一张写入系统"由用户决定
      setDupChoiceOpen(true);
      return;
    }
    if (totalAmount <= 0) {
      alert('价税合计金额必须大于0');
      return;
    }

    onAddBill(buildNewBillData());
    onClose();
  };

  /** 保留系统已有发票：不写入本次识别的发票，结束采集 */
  const handleKeepExistingInvoice = () => {
    setDupChoiceOpen(false);
    onClose();
  };

  /** 保留新识别的发票：用新票覆盖系统中同号旧票后写入 */
  const handleKeepNewInvoice = () => {
    if (totalAmount <= 0) {
      alert('价税合计金额必须大于0');
      return;
    }
    // 重复仅来自其他单据（当前单据无同号发票）时无法在此覆盖
    if (!duplicateExistingBill) return;
    // 必须走替换；父组件已保证提供 onReplaceBill
    onReplaceBill?.({ invoiceNumber: invoiceNumber.trim(), newBill: buildNewBillData() });
    setDupChoiceOpen(false);
    onClose();
  };

  // Simulated bill preview object for InvoicePreviewModal
  const previewBillItem: BillItem = {
    id: 'preview-temp',
    orderNo: 1,
    invoiceNumber: invoiceNumber || '26437000002674910482',
    invoiceDate: invoiceDate || '2026-09-24',
    billType: billType || '数电票 (普通发票)',
    consumptionType: consumptionType || '交通',
    totalAmount: totalAmount || 45.5,
    reimbursableAmount: totalAmount || 45.5,
    netAmount: Math.round(((totalAmount || 45.5) / 1.06) * 100) / 100,
    taxAmount: Math.round(((totalAmount || 45.5) - (totalAmount || 45.5) / 1.06) * 100) / 100,
    sellerName: sellerName || '北京首汽智行科技有限公司',
    buyerName: '测试公司C',
    expenseItemId: recommendedExpenseId || 'exp-2',
    expenseItemName: '交通费用',
    remarks: remarks || '',
    createdAt: new Date().toLocaleString(),
    invoiceFile: recognized
      ? {
          name: recognized.fileName,
          type: recognized.fileType,
          url: recognized.fileUrl || '',
          fileSize: recognized.fileSizeText,
        }
      : undefined,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 select-none">
      <div className={`glass-card w-full ${batchItems ? 'max-w-5xl' : 'max-w-3xl'} overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150 shadow-2xl border border-white/10`}>
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-gradient-to-br from-sky-400 to-indigo-500 text-white shadow-xs">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-100">发票采集与智能识别</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                支持数电票 / 电子普通发票 / 公路客运发票等图片及 PDF，自动解析票面信息
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-100 rounded-full p-1.5 hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {/* Upload Dropzone with cancel selection and preview buttons */}
          <div
            onClick={() => {
              if (!recognized && !isProcessing && !batchItems) {
                fileInputRef.current?.click();
              }
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handleFilesUpload(Array.from(e.dataTransfer.files));
              }
            }}
            className={`border-2 border-dashed rounded-xl p-5 transition-all ${
              batchItems
                ? 'border-sky-400/50 bg-sky-400/5'
                : recognized
                ? 'border-emerald-400/70 bg-emerald-400/10'
                : 'border-slate-600/60 hover:border-sky-400/60 bg-white/[0.02] hover:bg-sky-400/5 cursor-pointer'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*,.pdf"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFilesUpload(Array.from(e.target.files));
                }
              }}
            />

            {batchItems ? (
              /* 批量模式：队列概要 */
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-sky-400/15 text-sky-300 flex items-center justify-center shrink-0">
                    {isProcessing ? (
                      <Cpu className="w-5 h-5 animate-spin" />
                    ) : (
                      <FileText className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-100">
                      批量采集：已选择 {batchItems.length} 个发票文件
                    </div>
                    <p className="text-xs text-sky-300 font-medium mt-0.5">
                      {isProcessing
                        ? ocrStatus
                        : `识别完成：成功 ${batchItems.filter((b) => b.status === 'success').length} 张，失败/重复 ${batchItems.filter((b) => b.status !== 'success').length} 张`}
                    </p>
                  </div>
                </div>
                {!isProcessing && (
                  <button
                    type="button"
                    onClick={handleClearBatch}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-400/30 rounded-md text-xs font-medium transition-colors cursor-pointer"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>清空重选</span>
                  </button>
                )}
              </div>
            ) : isProcessing ? (
              <div className="flex flex-col items-center py-4 space-y-2 text-center">
                <Cpu className="w-8 h-8 text-sky-400 animate-spin" />
                <p className="text-sm font-medium text-sky-300">{ocrStatus}</p>
                <span className="text-xs text-slate-400">正在抽取发票号码、开票/乘车日期与价税总额</span>
              </div>
            ) : recognized ? (
              /* 已选中发票展示区：带有【取消选择当前发票】与【预览】功能 */
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-400/15 text-emerald-300 flex items-center justify-center shrink-0 shadow-2xs">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-100 flex items-center gap-2">
                        <span className="truncate max-w-[280px]">{recognized.fileName}</span>
                      </div>
                      <p className="text-xs text-emerald-300 font-medium mt-0.5 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        要素识别已完成 (发票号: {recognized.invoiceNumber ? recognized.invoiceNumber.slice(-8) : '未识别'})
                      </p>
                    </div>
                  </div>

                  {/* Top Action Buttons: Preview and Cancel */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handlePreviewCurrentFile}
                      className="btn-ghost flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer"
                      title="预览发票原件"
                    >
                      <Eye className="w-4 h-4 text-sky-300" />
                      <span>预览发票</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelSelectedFile}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-400/30 rounded-md text-xs font-medium transition-colors shadow-2xs cursor-pointer"
                      title="取消选择当前发票"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>取消选择</span>
                    </button>
                  </div>
                </div>

                {/* 票面要素摘要 */}
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm bg-white/[0.03] p-3 rounded-lg border border-emerald-400/20 text-slate-200 font-mono">
                  <span>发票号码：<strong className="text-white font-bold">{recognized.invoiceNumber || '未识别'}</strong></span>
                  <span>
                    {recognized.billType === '客运发票' ? '乘车日期' : '开票日期'}：
                    <strong className="text-white font-bold">{recognized.invoiceDate || '未识别'}</strong>
                  </span>
                  <span className="font-bold amount-flame text-sm">价税合计：¥{recognized.totalAmount.toFixed(2)}</span>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-sky-300 hover:underline cursor-pointer ml-auto font-sans text-xs"
                  >
                    重新上传
                  </button>
                </div>

                {/* 重复发票小提示 */}
                {isInvoiceReferenced && (
                  <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-500/15 border border-amber-400/40 text-amber-200 text-xs sm:text-sm animate-in fade-in duration-200">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-amber-300 flex items-center gap-1.5">
                        <span>⚠️ 重复发票提示</span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-200 font-mono font-bold">
                          {invoiceNumber.trim()}
                        </span>
                      </div>
                      <div className="mt-1 text-amber-200/90 text-xs leading-relaxed">
                        系统检测到该发票号码在已有报销单据或当前账单中已存在，可能为重复发票，请注意核实。
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* 未选择发票：点击上传或拖拽 */
              <div className="flex flex-col items-center py-4 space-y-2 text-center">
                <UploadCloud className="w-10 h-10 text-sky-400/80" />
                <div className="text-sm font-semibold text-slate-100">
                  点击上传或拖拽发票文件（图片 / PDF），支持多选批量识别
                </div>
                <div className="text-xs text-slate-400">
                  支持数电票、普通电子发票、公路客运大巴票等，自动抽取发票号码与乘车/开票日期
                </div>
              </div>
            )}
          </div>

          {/* 批量模式：识别结果列表 + 批量入库 */}
          {batchItems ? (
            <div className="space-y-3 pt-1">
              {batchItems.some((b) => b.status === 'duplicate') && (
                <div className="flex items-center gap-2 p-2.5 bg-amber-500/10 border border-amber-400/30 rounded-lg text-amber-200 text-xs sm:text-sm">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    提示：本批次识别发现 <strong>{batchItems.filter((b) => b.status === 'duplicate').length}</strong> 张重复发票，已在表格对应行给出逐行提示，批量提交时将自动跳过。
                  </span>
                </div>
              )}

              <div className="rounded-lg border border-white/5 overflow-hidden">
                <table className="w-full text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-white/[0.04] text-slate-300 text-left">
                      <th className="px-3 py-2.5 font-medium w-10">#</th>
                      <th className="px-3 py-2.5 font-medium">文件名</th>
                      <th className="px-3 py-2.5 font-medium">发票号码</th>
                      <th className="px-3 py-2.5 font-medium">乘车/开票日期</th>
                      <th className="px-3 py-2.5 font-medium text-right">价税合计</th>
                      <th className="px-3 py-2.5 font-medium min-w-[140px]">状态与提示</th>
                      <th className="px-3 py-2.5 font-medium w-20 text-center">原件</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batchItems.map((b, i) => {
                      const isDup = b.status === 'duplicate';
                      return (
                        <tr
                          key={b.id}
                          className={`border-t border-white/5 transition-colors ${
                            isDup ? 'bg-amber-500/[0.08] hover:bg-amber-500/[0.12]' : 'hover:bg-white/[0.02]'
                          }`}
                        >
                          <td className="px-3 py-2.5 text-slate-500 font-mono">{i + 1}</td>
                          <td className="px-3 py-2.5 max-w-[240px] text-slate-200">
                            <div className="truncate font-medium" title={b.file.name}>
                              {b.file.name}
                            </div>
                            {isDup && (
                              <div className="text-[11px] text-amber-300 flex items-center gap-1 mt-0.5 font-normal">
                                <AlertTriangle className="w-3 h-3 shrink-0 text-amber-400" />
                                <span>{b.error || '重复发票'}</span>
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-slate-200">
                            {b.result?.invoiceNumber || '—'}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-slate-200">
                            <div>{b.result?.invoiceDate || '—'}</div>
                            {b.result?.invoiceDate && (
                              <span className="text-[10px] text-emerald-400 font-sans">自动识别</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold amount-flame">
                            {b.result && b.status !== 'error' ? `¥${b.result.totalAmount.toFixed(2)}` : '—'}
                          </td>
                          <td className="px-3 py-2.5">
                            {b.status === 'pending' && (
                              <span className="text-slate-500">等待中</span>
                            )}
                            {b.status === 'processing' && (
                              <span className="text-sky-300 flex items-center gap-1 font-medium">
                                <Cpu className="w-3.5 h-3.5 animate-spin" />识别中
                              </span>
                            )}
                            {b.status === 'success' && (
                              <span className="text-emerald-300 flex items-center gap-1 font-medium">
                                <CheckCircle2 className="w-3.5 h-3.5" />正常
                              </span>
                            )}
                            {isDup && (
                              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/15 border border-amber-400/30 text-amber-300 text-xs font-semibold">
                                <AlertTriangle className="w-3 h-3 text-amber-400" />
                                <span>重复提示</span>
                              </div>
                            )}
                            {b.status === 'error' && (
                              <span className="text-rose-300 flex items-center gap-1 font-medium" title={b.error}>
                                <AlertCircle className="w-3.5 h-3.5" />
                                {b.error || '失败'}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            {b.result ? (
                              <button
                                type="button"
                                onClick={() => handlePreviewBatchItem(b)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-sky-300 hover:text-sky-100 hover:bg-sky-400/15 transition-colors cursor-pointer"
                                title="查看上传的发票原件，核对识别结果"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                查看
                              </button>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/5">
                <span className="text-xs text-slate-400">
                  仅识别成功且不重复的发票会被采集；重复项已按行提示并自动跳过
                </span>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={onClose}
                    className="btn-ghost px-5 py-2 text-sm font-medium rounded-lg cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={handleBatchSubmit}
                    disabled={isProcessing || batchItems.every((b) => b.status !== 'success')}
                    className={`px-6 py-2 text-sm font-semibold rounded-lg shadow-xs transition-colors ${
                      isProcessing || batchItems.every((b) => b.status !== 'success')
                        ? 'bg-slate-700/60 cursor-not-allowed text-slate-500'
                        : 'btn-primary cursor-pointer'
                    }`}
                  >
                    批量采集 {batchItems.filter((b) => b.status === 'success').length} 张
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 pt-1">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs sm:text-sm">
                {/* 发票号码 */}
                <div>
                  <label className="block text-slate-200 text-sm font-medium mb-1.5">
                    发票号码
                    <span className="ml-1 text-xs text-slate-400 font-normal">选填，可手动输入</span>
                  </label>
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="20位或8位发票号码"
                    className={`input-dark w-full px-3 py-2 text-sm font-mono rounded-lg ${
                      isInvoiceReferenced
                        ? '!border-amber-400/70 !bg-amber-500/10 !text-amber-200'
                        : ''
                    }`}
                  />
                  {isInvoiceReferenced && (
                    <div className="mt-1.5 flex items-center gap-1.5 p-2 bg-amber-500/10 border border-amber-400/30 rounded-md text-amber-300 text-xs leading-tight">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                      <span>提示：该发票已被引用，不可重复采集添加！</span>
                    </div>
                  )}
                </div>

                {/* 价税合计（代替原发票代码位置） */}
                <div>
                  <label className="block text-slate-200 text-sm font-medium mb-1.5">
                    <span className="text-rose-400 mr-0.5">*</span>价税合计 (元)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-sm leading-none">¥</span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={totalAmount || ''}
                      onChange={(e) => setTotalAmount(parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className="input-dark w-full amount-input-pad pr-3 py-2 text-sm font-mono font-bold amount-rose rounded-lg"
                    />
                  </div>
                </div>

                {/* 开票日期 / 乘车日期 */}
                <div>
                  <label className="block text-slate-200 text-sm font-medium mb-1.5">
                    <span className="text-rose-400 mr-0.5">*</span>
                    {billType === '客运发票' ? '乘车日期' : '开票日期'}
                    {invoiceDate && (
                      <span className="ml-1.5 text-xs text-emerald-400 font-normal">（已自动识别）</span>
                    )}
                  </label>
                  <input
                    type="date"
                    required
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="input-dark w-full px-3 py-2 text-sm rounded-lg [color-scheme:dark]"
                  />
                </div>
              </div>

              {/* 备注说明（不取任何默认值，仅限手工填写） */}
              <div>
                <label className="block text-slate-200 text-sm font-medium mb-1.5">
                  备注说明
                  <span className="ml-1 text-xs text-slate-400 font-normal">选填，手工填写</span>
                </label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="手工填写备注说明（如：市内出差拜访客户交通支出）"
                  className="input-dark w-full px-3 py-2 text-sm rounded-lg"
                />
              </div>

              {/* Actions Bar：左侧重复发票提示，右侧 取消 / 确认采集 */}
              <div className="flex items-center justify-between gap-3 pt-4 border-t border-white/5">
                {/* 左侧：重复发票提示（位于 取消/确认采集 左侧） */}
                <div className="flex-1 min-w-0">
                  {isInvoiceReferenced && (
                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/15 border border-amber-400/40 text-amber-200 text-xs animate-in fade-in duration-200">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div className="leading-snug">
                        <span className="font-semibold text-amber-300">检测到重复发票</span>
                        <span className="font-mono font-bold mx-1">{invoiceNumber.trim()}</span>
                        <span>系统中已存在同号发票，点击「确认采集」可选择保留哪一张写入系统。</span>
                      </div>
                    </div>
                  )}
                </div>
                {/* 右侧：取消 / 确认采集 */}
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={onClose}
                    className="btn-ghost px-5 py-2 text-sm font-medium rounded-lg cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 text-sm font-semibold rounded-lg shadow-xs transition-colors btn-primary cursor-pointer"
                    title={
                      isInvoiceReferenced
                        ? '检测到重复发票，可选择保留哪一张写入系统'
                        : '确认采集'
                    }
                  >
                    确认采集
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Invoice spec / preview modal */}
      <InvoicePreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        bill={previewBillItem}
      />

      {/* 批量结果列表：查看发票原件 */}
      <InvoicePreviewModal
        isOpen={!!batchPreviewBill}
        onClose={() => setBatchPreviewBill(null)}
        bill={batchPreviewBill}
      />

      {/* 重复发票：由用户选择保留哪一张写入系统 */}
      {dupChoiceOpen && isInvoiceReferenced && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none">
          <div className="glass-card w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150 shadow-2xl border border-amber-400/30">
            {/* Header */}
            <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-white/5 bg-amber-400/[0.06]">
              <div className="p-2 rounded-lg bg-amber-400/15 text-amber-300">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-slate-100">
                  发票号码 <span className="font-mono text-amber-300">{invoiceNumber.trim()}</span> 已存在
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  系统中检测到与本次识别相同的发票号码，请选择保留哪一张写入系统
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDupChoiceOpen(false)}
                className="ml-auto text-slate-400 hover:text-slate-100 rounded-full p-1.5 hover:bg-white/5 transition-colors cursor-pointer"
                title="返回修改"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 对比卡片 */}
            <div className="p-5 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 系统已有发票 */}
                <div
                  className={`rounded-xl border p-4 ${
                    duplicateExistingBill
                      ? 'border-sky-400/40 bg-sky-400/[0.06]'
                      : 'border-white/10 bg-white/[0.02]'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="w-4 h-4 text-sky-300" />
                    <span className="text-sm font-bold text-slate-100">系统已有发票</span>
                    <span
                      className={`ml-auto text-[11px] px-2 py-0.5 rounded-full font-medium ${
                        duplicateExistingBill
                          ? 'bg-sky-400/15 text-sky-300'
                          : 'bg-white/10 text-slate-400'
                      }`}
                    >
                      {duplicateExistingBill ? '当前单据' : '其他单据'}
                    </span>
                  </div>
                  {duplicateExistingBill ? (
                    <dl className="space-y-1.5 text-xs text-slate-300 font-mono">
                      <div className="flex justify-between gap-2">
                        <dt className="text-slate-400 shrink-0">发票号码</dt>
                        <dd className="text-slate-100 text-right break-all">
                          {duplicateExistingBill.invoiceNumber}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-slate-400 shrink-0">
                          {duplicateExistingBill.billType === '客运发票' ? '乘车日期' : '开票日期'}
                        </dt>
                        <dd>{duplicateExistingBill.invoiceDate || '—'}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-slate-400 shrink-0">价税合计</dt>
                        <dd className="font-bold amount-flame">
                          ¥{(duplicateExistingBill.totalAmount || 0).toFixed(2)}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-slate-400 shrink-0">销售方</dt>
                        <dd className="text-right break-all">
                          {duplicateExistingBill.sellerName || '—'}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-slate-400 shrink-0">费用项目</dt>
                        <dd>{duplicateExistingBill.expenseItemName || '—'}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-slate-400 shrink-0">消费类型</dt>
                        <dd>{duplicateExistingBill.consumptionType || '—'}</dd>
                      </div>
                      {duplicateExistingBill.transportName && (
                        <div className="flex justify-between gap-2">
                          <dt className="text-slate-400 shrink-0">交通工具</dt>
                          <dd>{duplicateExistingBill.transportName}</dd>
                        </div>
                      )}
                      {duplicateExistingBill.invoiceFile?.name && (
                        <div className="flex justify-between gap-2">
                          <dt className="text-slate-400 shrink-0">原件</dt>
                          <dd className="text-right break-all">
                            {duplicateExistingBill.invoiceFile.name}
                          </dd>
                        </div>
                      )}
                    </dl>
                  ) : (
                    <p className="text-xs text-slate-400 leading-relaxed">
                      该发票号码已被其他报销单据引用；当前单据中不存在同号发票，因此无法用本次识别的发票覆盖。
                    </p>
                  )}
                </div>

                {/* 本次识别发票 */}
                <div className="rounded-xl border border-emerald-400/40 bg-emerald-400/[0.06] p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Cpu className="w-4 h-4 text-emerald-300" />
                    <span className="text-sm font-bold text-slate-100">本次识别发票</span>
                    <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full bg-emerald-400/15 text-emerald-300 font-medium">
                      新
                    </span>
                  </div>
                  <dl className="space-y-1.5 text-xs text-slate-300 font-mono">
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-400 shrink-0">发票号码</dt>
                      <dd className="text-slate-100 text-right break-all">{invoiceNumber.trim()}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-400 shrink-0">
                        {billType === '客运发票' ? '乘车日期' : '开票日期'}
                      </dt>
                      <dd>{invoiceDate || '—'}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-400 shrink-0">价税合计</dt>
                      <dd className="font-bold amount-flame">¥{totalAmount.toFixed(2)}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-400 shrink-0">销售方</dt>
                      <dd className="text-right break-all">{sellerName || '—'}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-400 shrink-0">费用项目</dt>
                      <dd>{newExpenseItemName}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-400 shrink-0">消费类型</dt>
                      <dd>{consumptionType || '—'}</dd>
                    </div>
                    {newTransportName && (
                      <div className="flex justify-between gap-2">
                        <dt className="text-slate-400 shrink-0">交通工具</dt>
                        <dd>{newTransportName}</dd>
                      </div>
                    )}
                    {recognized?.fileName && (
                      <div className="flex justify-between gap-2">
                        <dt className="text-slate-400 shrink-0">原件</dt>
                        <dd className="text-right break-all">{recognized.fileName}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              </div>

              <p className="mt-4 text-[11px] text-slate-500 leading-relaxed">
                · 「保留系统已有」：不写入本次识别的发票，系统中保留原发票。
                <br />· 「保留新发票并覆盖」：用本次识别的发票覆盖系统中同号的旧发票后写入。
              </p>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-5 py-3.5 border-t border-white/5 bg-white/[0.02]">
              <button
                type="button"
                onClick={handleKeepExistingInvoice}
                className="btn-ghost px-5 py-2 text-sm font-medium rounded-lg cursor-pointer"
              >
                保留系统已有
              </button>
              <button
                type="button"
                onClick={handleKeepNewInvoice}
                disabled={!duplicateExistingBill}
                title={
                  duplicateExistingBill
                    ? '用本次识别的发票覆盖系统中同号的旧发票并写入'
                    : '该发票仅在其他单据中引用，无法覆盖'
                }
                className={`px-6 py-2 text-sm font-semibold rounded-lg shadow-xs transition-colors ${
                  duplicateExistingBill
                    ? 'btn-primary cursor-pointer'
                    : 'bg-slate-700/60 cursor-not-allowed text-slate-500'
                }`}
              >
                保留新发票并覆盖
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
