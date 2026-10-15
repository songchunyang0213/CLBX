export interface ExpenseItemMaster {
  id: string;
  code: string;
  name: string;
  isMerge: boolean; // 是否合并（报销明细聚合核心依据）
  status: 'enabled' | 'disabled'; // 启用/停用
  sortOrder?: number; // 排序
  taxRate?: number; // 预设税率 %
  linkedConsumptionType?: string; // 关联的消费档案类型（如 交通/住宿/替票），发票识别后据此自动选定费用项目
  description?: string;
  isSystem?: boolean;
}

export interface TransportMaster {
  id: string;
  code: string;
  name: string;
  status: 'enabled' | 'disabled';
  sortOrder?: number;
  icon?: string;
}

export interface ProjectMaster {
  id: string;
  code: string;
  name: string;
  status: 'enabled' | 'disabled';
  sortOrder?: number;
  dept?: string;
  description?: string;
}

export interface LocationMaster {
  id: string;
  code: string;
  name: string;
  category?: string; // 类别
  status: 'enabled' | 'disabled';
  sortOrder?: number;
  city?: string;
  description?: string;
}

// 审批状态基础档案 (新增)
export interface ApprovalStatusMaster {
  id: string;
  code: string;
  name: string; // '草稿' | '待提交' | '审批中' | '已审批' | '已驳回'
  status: 'enabled' | 'disabled';
  colorBadge: string; // Tailwind class string for badge
  customColor?: string; // 自定义标签颜色（HEX）；存在时优先于 colorBadge
  sortOrder: number;
  description?: string;
}

// 员工档案
export interface EmployeeMaster {
  id: string;
  code: string; // 员工编码
  name: string; // 员工姓名
  phone: string; // 手机号
  status: 'enabled' | 'disabled';
}

// 消费类型与税务类别规则档案
export interface ConsumptionTypeMaster {
  id: string;
  code: string; // 规则编码，如 CT001
  consumptionType: string; // 目标消费类型名称，如 交通、住宿、餐饮、通行燃油、通讯、办公、替票
  taxMajorCategory: string; // 税务大类，如 运输服务、餐饮住宿服务、生活服务、现代服务、销售货物
  taxSubCategory: string; // 税务小类 / 货物或服务名称关键词，如 旅客运输、铁路客票、航空客票、住宿服务、餐饮服务
  keywords: string[]; // 关键词匹配，如 ['高铁', '火车', '铁路', '动车']
  priority: number; // 匹配优先级（数字越小越优先）
  status: 'enabled' | 'disabled';
  description?: string;
}

export interface BillItem {
  id: string;
  orderNo: number; // 序号
  projectId?: string; // 项目ID
  projectName?: string; // 项目名称
  expenseItemId: string; // 费用项目ID
  expenseItemName: string; // 费用项目名称
  transportId?: string; // 交通工具ID
  transportName?: string; // 交通工具名称
  invoiceNumber: string; // 发票号码
  invoiceCode?: string; // 发票代码 (普通发票可能存在，数电票可无)
  invoiceDate: string; // 开票日期 YYYY-MM-DD
  billType: string; // 账单类型，如 数电票 (普通发票)、增值税专用发票、数电票 (铁路客票)
  consumptionType: string; // 消费类型，如 替票、交通、餐饮、住宿、通讯
  taxMajorCategory?: string; // 识别到的税务大类
  taxSubCategory?: string; // 识别到的税务小类
  totalAmount: number; // 价税合计
  reimbursableAmount: number; // 可报销金额
  netAmount: number; // 不含税金额
  taxAmount: number; // 税额
  sellerName: string; // 销售方名称
  buyerName?: string; // 购买方名称
  invoiceFile?: {
    name: string;
    type: 'image' | 'pdf';
    url?: string;
    fileSize?: string;
  };
  remarks?: string; // 备注
  createdAt: string;
}

export interface ItineraryAttachment {
  name: string;
  type: 'image' | 'pdf';
  url: string; // Base64 or object URL
  fileSize?: string;
  uploadDate?: string;
}

export interface ReimbursementItem {
  id: string;
  orderNo: number;
  projectId?: string; // 关联项目档案ID
  projectName?: string; // 项目名称
  expenseItemId: string; // 费用项目ID
  expenseItemName: string; // 费用项目名称
  transportId?: string; // 交通工具ID
  transportName?: string; // 交通工具名称
  startDate?: string; // 开始日期
  endDate?: string; // 结束日期
  departure?: string; // 出发地
  destination?: string; // 到达地
  itineraryCount?: number; // 行程单数量
  itineraryAttachment?: ItineraryAttachment; // 行程单附件(支持图片或PDF)
  cityTrafficAmount?: number; // 市内交通费发票金额 (旧字段保留兼容)
  subsidyDays?: number; // 补贴天数 (新增)
  totalAmount: number; // 价税合计（根据规则可能为差额或发票金额）
  invoiceSumAmount?: number; // 发票原始价税合计
  diffType?: 'exact' | 'over' | 'lack' | 'none'; // 差额状态：正常 | 超额 | 欠缺 | 无补贴
  diffValue?: number; // 差额绝对值
  taxAmount: number; // 税额
  netAmount: number; // 不含税金额
  remarks?: string; // 备注
  isMerged: boolean; // 是否合并生成
  mergedCount: number; // 合并的账单笔数
  sourceBillIds: string[]; // 关联的来源账单明细ID列表
  sourceInvoiceNumbers: string[]; // 关联的来源发票号码列表
  isManual?: boolean; // 是否为手动增行且无发票行
}

export interface ReimbursementForm {
  id?: string; // 唯一实例标识
  formNo: string; // 单据编号，规则: 常量 TERB + 四位年 + 两位月 + 两位日 + 三位数字流水 (例: TERB20260926001)
  formDate: string; // 单据日期 2026-09-24
  applicant: string; // 报销人员 宋春阳
  applicantCode?: string; // 报销人员工号
  totalAmount: number; // 价税总额
  remarks: string; // 备注
  status: string; // 审批状态编码或名称，与 ApprovalStatusMaster 关联
  approvalStatusName?: string; // 审批状态名称
  isPaid?: boolean; // 是否已打款
  attachmentsCount: number;
  bills: BillItem[];
  createdAt?: string;
}

export interface PersonalBillFolder {
  id: string;
  name: string;
  color?: string;
  description?: string;
  createdAt: string;
}

export interface PersonalBillItem extends BillItem {
  folderId?: string; // 所属文件夹ID，空为未分组
  folderName?: string; // 所属文件夹名称
  isReimbursed: boolean; // 是否已报销
  reimbursedFormNo?: string; // 关联的报销单号
  reimbursedDate?: string;
}
