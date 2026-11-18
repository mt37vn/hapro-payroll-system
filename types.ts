export type CalculationMode = "MONTH" | "QUARTER" | "YEAR";

export type LogicType = 'KPI' | 'KY_THUAT' | 'KHOAN' | 'KHOAN_INBOUND' | 'KHOAN_OUTBOUND' | 'DIRECTOR' | 'DEPT_HEAD' | 'DEPUTY_DIRECTOR';

export interface Position {
  id: string;
  name: string;
  logicType: LogicType;
}

export interface KpiTier {
  id: string;
  minEfficiency: number; // Tỷ lệ hiệu suất tối thiểu (0-1)
  salaryRate: number;    // Tỷ lệ nhận lương HQ (0-1)
}

export interface RoleConfig {
  name: string;
  weight: number;
}

export interface Staff {
  id: string;
  name: string;
  salaryFull: number;
  salaryHQ: number;
  salaryBase: number;
  type: LogicType; // Phân loại nhân sự (logic bên dưới)
  positionId?: string;      // ID Chức vụ/Vị trí
  manualKpiTarget?: number; // KPI Mục tiêu nhập tay
  khoanRate?: number;       // Tỷ lệ nhận LNG cho nhân sự khoán / inbound (0-1)
  outboundMinRate?: number; // Hóa hồng outbound tối thiểu (mặc định 0.20)
  outboundMaxRate?: number; // Hóa hồng outbound tối đa (mặc định 0.40)
  departmentId?: string;    // ID Phòng ban (giữ lại để tương thích dữ liệu cũ)
  carryOver?: number;       // LNG chuyển tiếp từ tháng trước
}

export type ProjectType = 'SERVICE' | 'COMMERCIAL' | 'MIXED';

export interface Project {
  id: string;
  code: string;
  name: string;
  revenue: number;
  directCost: number;
  // Loại dự án & hàm lượng dịch vụ (field mới)
  projectType?: ProjectType;      // Mặc định: 'SERVICE'
  serviceRevenueRatio?: number;   // 0–1, dùng khi type = MIXED (tự tính từ serviceRevenue nếu nhập số tiền)
  serviceRevenue?: number;        // Doanh thu dịch vụ (VND) – input option cho MIXED
  outsourcingCost?: number;       // Chi phí thuê ngoài (Q1-2026 KPI)
}

export interface ProjectStaffRole {
  projectId: string;
  staffId: string;
  roleName: string;
}

export interface FinancialParams {
  fixedCost: number;
  bonusRatio: number;
  mixedServiceRatio: number;
  companyName: string;
}

export interface Department {
  id: string;
  name: string;
}

export interface MonthSnapshot {
  config: FinancialParams;
  departments?: Department[];
  positions?: Position[];
  staff: Staff[];
  projects: Project[];
  matrix: ProjectStaffRole[];
  kpiTiers?: KpiTier[];
}

export interface YearData {
  yearSnapshot?: MonthSnapshot;
  roles: RoleConfig[];
  positions?: Position[];
  bonusRatio: number; // Mới: Tỷ lệ thưởng dùng chung cho cả năm
  months: {
    [month: number]: MonthSnapshot;
  };
  quarters?: {
    [quarter: number]: MonthSnapshot;
  };
  kpiTiers?: KpiTier[];
}

export interface GlobalData {
  [year: number]: YearData;
}

export interface CalculationResult {
  projects: Array<{
    id: string;
    grossProfit: number;
    totalW?: number;
    techCount: number;
    salesCount: number;
    khoanDeduction: number;
    remainingGP: number;
    serviceLNG: number;
    serviceRatio: number;
  }>;
  allocations: Array<{
    projectId: string;
    staffId: string;
    roleName: string;
    weight?: number;
    contributionMoney: number;
    isKhoan: boolean;
  }>;
  staffPerformance: Array<{
    staffId: string;
    name: string;
    type: LogicType;
    positionName?: string;
    kpiTarget: number;
    contribution: number;
    efficiency: number;
    receivingRate: number;
    salaryHQ: number;
    realHQSalary: number;
    bonus: number;
    rank: string;
    carryOverUsed: number;   // Phần dư tháng trước dùng vào tháng này
    surplus: number;        // Phần dư tháng này chuyển sang tháng sau
  }>;
  financeSummary: {
    totalLNG: number;
    totalServiceLNG: number; // Tổng LNG phần dịch vụ
    fc: number;
    totalHQSalaryReal: number;
    profitBeforeBonus: number;
    totalBonusFund: number;
    profitBeforeTax: number;
  };
}
