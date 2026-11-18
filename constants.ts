
import { Staff, Project, RoleConfig, FinancialParams, Department, Position, KpiTier } from './types';

export const INITIAL_KPI_TIERS: KpiTier[] = [
  { id: '1', minEfficiency: 0, salaryRate: 0.5 },
  { id: '2', minEfficiency: 0.5, salaryRate: 0.5 }, // 50% - <100% will be handled dynamically in calculations.ts
  { id: '3', minEfficiency: 1.0, salaryRate: 1.0 }
];

export const COLORS = {
  primary: "#004d40",
  secondary: "#00796b",
  accent: "#ffab91",
  border: "#e2e8f0"
};

export const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || "demo-admin";

export const INITIAL_STAFF: Staff[] = [
  { id: '1', name: "Nguyễn Văn A", salaryFull: 30000000, salaryHQ: 20000000, salaryBase: 10000000, type: 'DIRECTOR', positionId: 'pos1', manualKpiTarget: 1000000000 },
  { id: '2', name: "Trần Thị B", salaryFull: 20000000, salaryHQ: 10000000, salaryBase: 10000000, type: 'KPI', positionId: 'pos3', manualKpiTarget: 200000000 },
  { id: '3', name: "Lê Văn C", salaryFull: 12000000, salaryHQ: 6000000, salaryBase: 6000000, type: 'KY_THUAT', positionId: 'pos4', manualKpiTarget: 100000000 },
  { id: '4', name: "Phạm Thị D", salaryFull: 12000000, salaryHQ: 6000000, salaryBase: 6000000, type: 'KY_THUAT', positionId: 'pos4', manualKpiTarget: 100000000 },
  { id: '5', name: "Hoàng Văn E", salaryFull: 12000000, salaryHQ: 6000000, salaryBase: 6000000, type: 'KPI', positionId: 'pos3', manualKpiTarget: 150000000 },
  { id: '6', name: "Vũ Thị F", salaryFull: 0, salaryHQ: 0, salaryBase: 0, type: 'KHOAN_INBOUND', positionId: 'pos5', khoanRate: 0.1 }
];

export const INITIAL_POSITIONS: Position[] = [
  { id: 'pos1', name: "Giám đốc", logicType: 'DIRECTOR' },
  { id: 'pos2', name: "Phó giám đốc", logicType: 'DEPUTY_DIRECTOR' },
  { id: 'pos3', name: "Kinh doanh", logicType: 'KPI' },
  { id: 'pos4', name: "Kỹ thuật", logicType: 'KY_THUAT' },
  { id: 'pos5', name: "Kinh doanh Inbound", logicType: 'KHOAN_INBOUND' },
  { id: 'pos6', name: "Kinh doanh Outbound", logicType: 'KHOAN_OUTBOUND' },
];

export const INITIAL_DEPARTMENTS: Department[] = [];

export const INITIAL_PROJECTS: Project[] = [
  { id: 'p1', code: "DA-001", name: "Dịch Vụ Bảo trì Hệ thống", revenue: 1104000000, directCost: 100800000 },
  { id: 'p2', code: "DA-002", name: "Phần Mềm Trueconf", revenue: 1668000000, directCost: 1068000000 },
  { id: 'p3', code: "DA-003", name: "Đấu Thầu Mua Sắm Công", revenue: 960000000, directCost: 840000000 }
];

export const INITIAL_ROLES: RoleConfig[] = [
  { name: "Director", weight: 5 },
  { name: "Sale", weight: 3.5 },
  { name: "Presale", weight: 1.5 },
  { name: "PM", weight: 3 },
  { name: "Tech", weight: 2 },
  { name: "Support", weight: 1 }
];

export const INITIAL_FINANCE: FinancialParams = {
  fixedCost: 1200000000,
  bonusRatio: 0.3,
  mixedServiceRatio: 0.5,
  companyName: "CÔNG TY CỔ PHẦN THÔNG TIN HAPRO"
};

export const EMPTY_FINANCE: FinancialParams = {
  fixedCost: 0,
  bonusRatio: 0.3,
  mixedServiceRatio: 0.5,
  companyName: "CÔNG TY CỔ PHẦN THÔNG TIN HAPRO"
};

export const INITIAL_MATRIX = [
  { projectId: 'p1', staffId: '1', roleName: 'Director' },
  { projectId: 'p1', staffId: '2', roleName: 'PM' },
  { projectId: 'p1', staffId: '3', roleName: 'Tech' },
  { projectId: 'p1', staffId: '4', roleName: 'Tech' },
  { projectId: 'p1', staffId: '5', roleName: 'Support' },
  { projectId: 'p2', staffId: '1', roleName: 'Director' },
  { projectId: 'p2', staffId: '2', roleName: 'Support' },
  { projectId: 'p2', staffId: '3', roleName: 'Presale' },
  { projectId: 'p2', staffId: '5', roleName: 'Sale' },
  { projectId: 'p2', staffId: '6', roleName: 'Khoán' }, // Fix role for KHOAN staff
  { projectId: 'p3', staffId: '1', roleName: 'Director' },
  { projectId: 'p3', staffId: '2', roleName: 'PM' },
  { projectId: 'p3', staffId: '3', roleName: 'Tech' },
  { projectId: 'p3', staffId: '5', roleName: 'Sale' },
];
