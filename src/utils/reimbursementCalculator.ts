import { BillItem, ExpenseItemMaster, ReimbursementItem } from '../types/reimbursement';

export interface CalculationResult {
  reimbursementItems: ReimbursementItem[];
  totalBillAmount: number; // 账单价税合计总和
  totalReimbursableAmount: number; // 账单可报销金额总和
  totalReimbursementAmount: number; // 报销明细价税合计总和
  totalTaxAmount: number; // 税额总和
  totalNetAmount: number; // 不含税金额总和
  mergedCount: number; // 合并生成的行数
  unmergedCount: number; // 独立单张行数
}

/**
 * 核心合并与报销计算引擎：
 * 严格按照费用项目档案中的 isMerge 字段进行聚合
 * 融入补贴天数与预置补贴标准（每人每天标准金额，默认50元/天）：
 * - 如果费用项目包含“补贴”（或设置了subsidyDays），计算 发票总额 vs (补贴天数 * 补贴日标准)
 * - 若 发票总额 === 补贴标准总额：显示发票金额 (diffType: 'exact')
 * - 若 发票总额 > 补贴标准总额：显示超额超出的金额，如超10 (diffType: 'over', diffValue: 10)
 * - 若 发票总额 < 补贴标准总额：红色显示缺额金额，如缺10 (diffType: 'lack', diffValue: 10)
 */
export function calculateReimbursement(
  bills: BillItem[],
  expenseMasters: ExpenseItemMaster[],
  subsidyRate: number = 50,
  rowOverrides?: Record<string, Partial<ReimbursementItem>>,
  manualRows?: ReimbursementItem[]
): CalculationResult {
  // 构建费用档案查找表（以ID为键，备选以名称为键）
  const masterMap = new Map<string, ExpenseItemMaster>();
  const nameMap = new Map<string, ExpenseItemMaster>();
  expenseMasters.forEach((item) => {
    masterMap.set(item.id, item);
    nameMap.set(item.name, item);
  });

  // 按费用项目分类账单
  const groupedBills = new Map<string, BillItem[]>();
  bills.forEach((bill) => {
    const key = bill.expenseItemId || bill.expenseItemName || 'unknown';
    if (!groupedBills.has(key)) {
      groupedBills.set(key, []);
    }
    groupedBills.get(key)!.push(bill);
  });

  const reimbursementItems: ReimbursementItem[] = [];
  let orderNoCounter = 1;
  let mergedRowCount = 0;
  let unmergedRowCount = 0;

  // 遍历分组进行聚合或一对一展开
  groupedBills.forEach((billList, key) => {
    const master = masterMap.get(key) || nameMap.get(billList[0]?.expenseItemName);
    const shouldMerge = master ? master.isMerge : false;

    if (shouldMerge && billList.length > 1) {
      // 勾选了合并，且有多行：合并为一行
      mergedRowCount++;
      const firstBill = billList[0];
      const sumTotal = round(billList.reduce((acc, b) => acc + (b.totalAmount || 0), 0));
      const sumTax = round(billList.reduce((acc, b) => acc + (b.taxAmount || 0), 0));
      const sumNet = round(billList.reduce((acc, b) => acc + (b.netAmount || 0), 0));

      const distinctProjects = Array.from(new Set(billList.map((b) => b.projectName).filter(Boolean)));
      const projectDisplay = distinctProjects.length > 1 
        ? `${distinctProjects[0]} (多项目)` 
        : distinctProjects[0] || '';

      const rowId = `rmb-merged-${key}-${firstBill.id}`;
      const override = rowOverrides?.[rowId] || {};

      // 补贴天数：默认不预填，由用户手动输入
      const inputDays = override.subsidyDays;

      let diffType: 'exact' | 'over' | 'lack' | 'none' = 'none';
      let diffValue: number | undefined = undefined;
      let displayTotal = override.totalAmount !== undefined ? override.totalAmount : sumTotal;

      if (inputDays !== undefined && inputDays > 0) {
        const standardTotal = round(inputDays * subsidyRate);
        const diff = round(sumTotal - standardTotal);
        if (diff === 0) {
          diffType = 'exact';
          displayTotal = sumTotal;
        } else if (diff > 0) {
          diffType = 'over';
          diffValue = diff;
          displayTotal = sumTotal;
        } else {
          diffType = 'lack';
          diffValue = Math.abs(diff);
          displayTotal = sumTotal;
        }
      }

      reimbursementItems.push({
        id: rowId,
        orderNo: orderNoCounter++,
        projectId: override.projectId || firstBill.projectId,
        projectName: override.projectName || projectDisplay,
        expenseItemId: override.expenseItemId || master?.id || firstBill.expenseItemId,
        expenseItemName: override.expenseItemName || master?.name || firstBill.expenseItemName,
        transportId: override.transportId !== undefined ? override.transportId : firstBill.transportId,
        transportName: override.transportName !== undefined ? override.transportName : firstBill.transportName,
        startDate: override.startDate || billList.map((b) => b.invoiceDate).filter(Boolean).sort()[0] || '',
        endDate: override.endDate || billList.map((b) => b.invoiceDate).filter(Boolean).sort().reverse()[0] || '',
        departure: override.departure || '',
        destination: override.destination || '',
        itineraryCount: override.itineraryCount,
        itineraryAttachment: override.itineraryAttachment,
        subsidyDays: inputDays,
        totalAmount: displayTotal,
        invoiceSumAmount: sumTotal,
        diffType,
        diffValue,
        taxAmount: sumTax,
        netAmount: sumNet,
        remarks: override.remarks || '',
        isMerged: true,
        mergedCount: billList.length,
        sourceBillIds: billList.map((b) => b.id),
        sourceInvoiceNumbers: billList.map((b) => b.invoiceNumber),
        isManual: false,
      });
    } else {
      // 未勾选合并，或者只有1行：逐张保留，一比一对应
      billList.forEach((bill) => {
        unmergedRowCount++;
        const rowId = `rmb-single-${bill.id}`;
        const override = rowOverrides?.[rowId] || {};

        const inputDays = override.subsidyDays;

        let diffType: 'exact' | 'over' | 'lack' | 'none' = 'none';
        let diffValue: number | undefined = undefined;
        let displayTotal = override.totalAmount !== undefined ? override.totalAmount : bill.totalAmount;

        if (inputDays !== undefined && inputDays > 0) {
          const standardTotal = round(inputDays * subsidyRate);
          const diff = round(bill.totalAmount - standardTotal);
          if (diff === 0) {
            diffType = 'exact';
          } else if (diff > 0) {
            diffType = 'over';
            diffValue = diff;
          } else {
            diffType = 'lack';
            diffValue = Math.abs(diff);
          }
        }

        reimbursementItems.push({
          id: rowId,
          orderNo: orderNoCounter++,
          projectId: override.projectId || bill.projectId,
          projectName: override.projectName || bill.projectName || '',
          expenseItemId: override.expenseItemId || master?.id || bill.expenseItemId,
          expenseItemName: override.expenseItemName || master?.name || bill.expenseItemName,
          transportId: override.transportId !== undefined ? override.transportId : bill.transportId,
          transportName: override.transportName !== undefined ? override.transportName : bill.transportName,
          startDate: override.startDate || bill.invoiceDate,
          endDate: override.endDate || bill.invoiceDate,
          departure: override.departure || '',
          destination: override.destination || '',
          itineraryCount: override.itineraryCount,
          itineraryAttachment: override.itineraryAttachment,
          subsidyDays: inputDays,
          totalAmount: displayTotal,
          invoiceSumAmount: bill.totalAmount,
          diffType,
          diffValue,
          taxAmount: bill.taxAmount,
          netAmount: bill.netAmount,
          remarks: override.remarks || bill.remarks || '',
          isMerged: false,
          mergedCount: 1,
          sourceBillIds: [bill.id],
          sourceInvoiceNumbers: [bill.invoiceNumber],
          isManual: false,
        });
      });
    }
  });

  // 加入纯手动增行（无发票报销明细行）
  if (manualRows && manualRows.length > 0) {
    manualRows.forEach((mRow) => {
      const inputDays = mRow.subsidyDays;
      let diffType: 'exact' | 'over' | 'lack' | 'none' = 'none';
      let diffValue: number | undefined = undefined;

      if (inputDays !== undefined && inputDays > 0) {
        const standardTotal = round(inputDays * subsidyRate);
        const diff = round((mRow.totalAmount || 0) - standardTotal);
        if (diff === 0) diffType = 'exact';
        else if (diff > 0) {
          diffType = 'over';
          diffValue = diff;
        } else {
          diffType = 'lack';
          diffValue = Math.abs(diff);
        }
      }

      reimbursementItems.push({
        ...mRow,
        orderNo: orderNoCounter++,
        diffType,
        diffValue,
        invoiceSumAmount: mRow.totalAmount,
      });
    });
  }

  // 按序号排序
  reimbursementItems.sort((a, b) => a.orderNo - b.orderNo);

  // 计算汇总合计
  const totalBillAmount = round(bills.reduce((acc, b) => acc + (b.totalAmount || 0), 0));
  const totalReimbursableAmount = round(bills.reduce((acc, b) => acc + (b.reimbursableAmount || 0), 0));
  const totalReimbursementAmount = round(reimbursementItems.reduce((acc, r) => acc + (r.totalAmount || 0), 0));
  const totalTaxAmount = round(bills.reduce((acc, b) => acc + (b.taxAmount || 0), 0));
  const totalNetAmount = round(bills.reduce((acc, b) => acc + (b.netAmount || 0), 0));

  return {
    reimbursementItems,
    totalBillAmount,
    totalReimbursableAmount,
    totalReimbursementAmount,
    totalTaxAmount,
    totalNetAmount,
    mergedCount: mergedRowCount,
    unmergedCount: unmergedRowCount,
  };
}

function round(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}
