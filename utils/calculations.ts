
import {
  CalculationMode,
  Staff,
  Project,
  RoleConfig,
  FinancialParams,
  ProjectStaffRole,
  CalculationResult,
  Department,
  Position,
  KpiTier
} from '../types';

/**
 * Tính toán tỷ lệ nhận lương và xếp hạng dựa trên bảng quy định động
 */
function getKpiRank(efficiency: number, tiers: KpiTier[]): { rank: string; rate: number } {
  // Q1-2026 KPI Logic
  if (efficiency < 0.5) {
    return { rank: "Dưới 50%", rate: 0.5 };
  } else if (efficiency >= 0.5 && efficiency < 1.0) {
    return { rank: "Từ 50% đến dưới 100%", rate: efficiency }; // Nhận theo tỷ lệ hoàn thành KPI
  } else {
    return { rank: "Từ 100% trở lên", rate: 1.0 };
  }
}

/** Tỷ lệ dịch vụ (0–1) của một dự án */
function getServiceRatio(project: Project, config: FinancialParams): number {
  const pType = project.projectType ?? 'SERVICE';
  let serviceRatio = 0;
  if (pType === 'SERVICE') {
    serviceRatio = 1;
  } else if (pType === 'COMMERCIAL') {
    serviceRatio = 0;
  } else if (pType === 'MIXED') {
    // Use project-specific ratio if available, otherwise use global config
    if (project.serviceRevenue != null && project.revenue > 0) {
      serviceRatio = Math.min(1, project.serviceRevenue / project.revenue);
    } else if (project.serviceRevenueRatio != null) {
      serviceRatio = Math.min(1, Math.max(0, project.serviceRevenueRatio));
    } else {
      serviceRatio = config.mixedServiceRatio;
    }
  } else { // Default for other types or if not specified
    if (project.serviceRevenue != null && project.revenue > 0) {
      serviceRatio = Math.min(1, Math.max(0, project.serviceRevenue / project.revenue));
    } else {
      serviceRatio = Math.min(1, Math.max(0, project.serviceRevenueRatio ?? 0));
    }
  }
  return serviceRatio;
}

/** Kiểm tra nhân sự thuộc nhóm "khoán" (nhận hoa hồng, không chịu FC) */
function isKhoanType(type: Staff['type']): boolean {
  return type === 'KHOAN' || type === 'KHOAN_INBOUND' || type === 'KHOAN_OUTBOUND';
}

/** Kiểm tra nhân sự thuộc nhóm KPI dự án (dùng LNG dịch vụ) */
function isKpiProjectType(type: Staff['type']): boolean {
  return type === 'KPI' || type === 'KY_THUAT';
}

export const calculatePayroll = (
  mode: CalculationMode,
  staff: Staff[],
  projects: Project[],
  config: FinancialParams,
  matrix: ProjectStaffRole[],
  departments: Department[] = [],
  positions: Position[] = [],
  kpiTiers: KpiTier[] = []
): CalculationResult => {

  // 1. Phân loại nhân sự
  const directors        = staff.filter(s => s.type === 'DIRECTOR');
  const deputyDirectors  = staff.filter(s => s.type === 'DEPUTY_DIRECTOR');
  const kpiStaff         = staff.filter(s => s.type === 'KPI' || s.type === 'KY_THUAT');
  const deptHeadStaff    = staff.filter(s => s.type === 'DEPT_HEAD'); 
  const khoanAll         = staff.filter(s => isKhoanType(s.type));
  const inboundStaff     = staff.filter(s => s.type === 'KHOAN' || s.type === 'KHOAN_INBOUND');
  const outboundStaff    = staff.filter(s => s.type === 'KHOAN_OUTBOUND');

  // 2. Chi phí tổ chức & mục tiêu chung
  const netFC = config.fixedCost;
  const totalSalaryHQAll = staff.reduce((sum, s) => sum + s.salaryHQ, 0);
  const companyTotalTarget = netFC + totalSalaryHQAll;

  // 3. Tiền xử lý Dự án
  const processedProjects = projects.map(p => {
    // Theo Q1-2026: LNG = Doanh thu - Giá vốn
    // Giá vốn nhân sự kỹ thuật = 0.
    // Lợi nhuận gộp dịch vụ = Doanh thu dịch vụ - Chi phí thuê ngoài (nếu có)
    const grossProfit  = p.revenue - p.directCost;
    const serviceRatio = getServiceRatio(p, config);
    const lngRatio     = p.revenue > 0 ? grossProfit / p.revenue : 0; 
    
    // Tính LNG phần Dịch vụ
    // - Tính doanh thu dịch vụ: revenue * serviceRatio (hoặc serviceRevenue nếu có nhập tay)
    const serviceRevenue = (p.projectType === 'MIXED' && p.serviceRevenue != null && p.revenue > 0) 
      ? p.serviceRevenue 
      : p.revenue * serviceRatio;
    
    const outsourcingCost = p.outsourcingCost || 0;
    // LNG Dịch vụ = Doanh thu dịch vụ (thuộc mảng DV CNTT/Triển khai) - Chi phí thuê ngoài.
    // Nếu projectType = COMMERCIAL, serviceRatio = 0 -> serviceRevenue = 0 -> serviceLNG = 0.
    let baseServiceLNG = serviceRevenue - outsourcingCost;
    if (baseServiceLNG < 0) baseServiceLNG = 0;

    const projectParticipants = matrix.filter(m => m.projectId === p.id);

    // --- Inbound & Outbound (Kinh doanh) ---
    // Inbound: Khoán Inbound hoặc Khoán cơ bản
    // Outbound: Khoán Outbound
    const projSales = projectParticipants.filter(m => m.roleName === 'Kinh doanh');
    const salesCount = projSales.length;
    let khoanDeduction = 0;

    projSales.forEach(m => {
      const s = staff.find(st => st.id === m.staffId);
      if (s) {
        const splitGP = salesCount > 0 ? grossProfit / salesCount : 0;
        if (s.type === 'KHOAN_OUTBOUND') {
          const minR = s.outboundMinRate ?? 0.20;
          const maxR = s.outboundMaxRate ?? 0.40;
          const oRate = Math.min(maxR, Math.max(minR, lngRatio));
          khoanDeduction += splitGP * oRate;
        } else if (isKhoanType(s.type)) {
          khoanDeduction += splitGP * (s.khoanRate || 0);
        }
      }
    });

    const remainingGP = grossProfit - khoanDeduction;
    
    // Điều chỉnh ServiceLNG theo tỷ lệ Remaining GP (nếu có trừ khoán) để logic nhất quán
    // Hoặc giữ nguyên logic cũ: serviceLNG = remainingGP * serviceRatio (nhưng giờ cần tính lại tỷ lệ)
    // Cách đúng theo luật mới nhất: LNG Dịch Vụ phải là: Doanh thu dịch vụ - Thuê ngoài. Do Khoán chỉ trừ trên GP chung,
    // ta sẽ ưu tiên ServiceLNG = (RemainingGP / GrossProfit) * baseServiceLNG nếu GP > 0
    let finalServiceLNG = baseServiceLNG;
    if (grossProfit > 0 && khoanDeduction > 0) {
        finalServiceLNG = baseServiceLNG * (remainingGP / grossProfit);
    }
    
    const serviceLNG = finalServiceLNG;

    // Participants for Tech (Kỹ thuật)
    const projTech = projectParticipants.filter(m => m.roleName === 'Kỹ thuật');
    const techCount = projTech.length;

    return {
      id: p.id, grossProfit, 
      techCount, salesCount,
      khoanDeduction, remainingGP,
      serviceLNG, serviceRatio,
      lngRatio
    };
  });

  // 4. Phân bổ đóng góp
  const allocations = matrix.map(m => {
    const project = processedProjects.find(pp => pp.id === m.projectId);
    const s = staff.find(st => st.id === m.staffId);
    let contributionMoney = 0;

    if (project && s) {
      if (m.roleName === 'Kinh doanh') {
        const splitGP = project.salesCount > 0 ? project.grossProfit / project.salesCount : 0;
        if (s.type === 'KHOAN_OUTBOUND') {
          const minR  = s.outboundMinRate ?? 0.20;
          const maxR  = s.outboundMaxRate ?? 0.40;
          const oRate = Math.min(maxR, Math.max(minR, project.lngRatio));
          contributionMoney = splitGP * oRate;
        } else if (isKhoanType(s.type)) {
          contributionMoney = splitGP * (s.khoanRate || 0);
        }
      } else if (m.roleName === 'Kỹ thuật' && isKpiProjectType(s.type)) {
        if (project.techCount > 0 && project.serviceLNG > 0) {
          contributionMoney = project.serviceLNG / project.techCount;
        }
      }
    }

    return {
      projectId: m.projectId,
      staffId: m.staffId,
      roleName: m.roleName,
      weight: 1, // Defaulting to 1 for backward compatibility in types
      contributionMoney,
      isKhoan: m.roleName === 'Kinh doanh'
    };
  });

  // 5a. KPI cá nhân + Kỹ thuật
  const kpiPerformances = kpiStaff.map(s => {
    const carryOverUsed = s.carryOver ?? 0;
    const projectContribution = allocations
      .filter(a => a.staffId === s.id)
      .reduce((sum, a) => sum + a.contributionMoney, 0);
    
    const totalContribution = projectContribution + carryOverUsed;
    const kpiTarget = s.manualKpiTarget ?? 0; // Luôn dùng manual target
    const efficiency = kpiTarget <= 0 ? 0 : totalContribution / kpiTarget;
    const kpiInfo    = getKpiRank(efficiency, kpiTiers);
    const surplus    = kpiTarget > 0 ? Math.max(0, totalContribution - kpiTarget) : 0;

    return {
      staffId: s.id, name: s.name,
      type: s.type,
      positionName: positions.find(pos => pos.id === s.positionId)?.name,
      kpiTarget, 
      contribution: totalContribution, // Tổng bao gồm cả carry-over
      efficiency,
      receivingRate: kpiInfo.rate,
      salaryHQ: s.salaryHQ,
      realHQSalary: s.salaryHQ * kpiInfo.rate,
      rank: kpiInfo.rank, bonus: 0,
      carryOverUsed,
      surplus
    };
  });

  // 5b. DEPT_HEAD (giữ nguyên logic hoàn thành nhưng target manual)
  const deptHeadPerformances = deptHeadStaff.map(s => {
    const deptMemberIds = s.departmentId
      ? staff.filter(st => st.departmentId === s.departmentId && st.id !== s.id).map(st => st.id)
      : [];
    const carryOverUsed = s.carryOver ?? 0;
    const projectContribution = allocations
      .filter(a => deptMemberIds.includes(a.staffId))
      .reduce((sum, a) => sum + a.contributionMoney, 0);

    const totalContribution = projectContribution + carryOverUsed;
    const kpiTarget = s.manualKpiTarget ?? 0;
    const efficiency = kpiTarget <= 0 ? 0 : totalContribution / kpiTarget;
    const kpiInfo    = getKpiRank(efficiency, kpiTiers);
    const surplus    = kpiTarget > 0 ? Math.max(0, totalContribution - kpiTarget) : 0;

    return {
      staffId: s.id, name: s.name, type: 'DEPT_HEAD' as const,
      positionName: positions.find(pos => pos.id === s.positionId)?.name,
      kpiTarget, 
      contribution: totalContribution, 
      efficiency,
      receivingRate: kpiInfo.rate, salaryHQ: s.salaryHQ,
      realHQSalary: s.salaryHQ * kpiInfo.rate,
      rank: kpiInfo.rank, bonus: 0,
      carryOverUsed,
      surplus
    };
  });

  // 6. Tổng LNG
  const totalLNG        = processedProjects.reduce((sum, p) => sum + p.grossProfit, 0);
  const totalRemainingGP = processedProjects.reduce((sum, p) => sum + p.remainingGP, 0);
  const totalServiceLNG  = processedProjects.reduce((sum, p) => sum + p.serviceLNG, 0);

  // 7. Giám đốc
  const directorPerformances = directors.map(s => {
    const carryOverUsed = s.carryOver ?? 0;
    const contribution = totalRemainingGP + carryOverUsed;
    const kpiTarget    = s.manualKpiTarget ?? companyTotalTarget; // Fallback to company target if not set
    const efficiency   = kpiTarget <= 0 ? 0 : contribution / kpiTarget;
    const kpiInfo      = getKpiRank(efficiency, kpiTiers);
    const surplus      = kpiTarget > 0 ? Math.max(0, contribution - kpiTarget) : 0;

    return {
      staffId: s.id, name: s.name, type: 'DIRECTOR' as const,
      positionName: positions.find(pos => pos.id === s.positionId)?.name,
      kpiTarget, 
      contribution, 
      efficiency,
      receivingRate: kpiInfo.rate, salaryHQ: s.salaryHQ,
      realHQSalary: s.salaryHQ * kpiInfo.rate,
      rank: kpiInfo.rank, bonus: 0,
      carryOverUsed,
      surplus
    };
  });

  // 8. Phó giám đốc
  const deputyDirectorPerformances = deputyDirectors.map(s => {
    const carryOverUsed = s.carryOver ?? 0;
    const contribution = totalServiceLNG + carryOverUsed;
    const kpiTarget    = s.manualKpiTarget ?? companyTotalTarget;
    const efficiency   = kpiTarget <= 0 ? 0 : contribution / kpiTarget;
    const kpiInfo      = getKpiRank(efficiency, kpiTiers);
    const surplus      = kpiTarget > 0 ? Math.max(0, contribution - kpiTarget) : 0;

    return {
      staffId: s.id, name: s.name, type: 'DEPUTY_DIRECTOR' as const,
      positionName: positions.find(pos => pos.id === s.positionId)?.name,
      kpiTarget, 
      contribution, 
      efficiency,
      receivingRate: kpiInfo.rate, salaryHQ: s.salaryHQ,
      realHQSalary: s.salaryHQ * kpiInfo.rate,
      rank: kpiInfo.rank, bonus: 0,
      carryOverUsed,
      surplus
    };
  });

  // 9. Nhân sự khoán
  const khoanPerformances = khoanAll.map(s => {
    const contribution = allocations
      .filter(a => a.staffId === s.id)
      .reduce((sum, a) => sum + a.contributionMoney, 0);
    const khoanLabel = s.type === 'KHOAN_OUTBOUND' ? 'OUTBOUND' : 'INBOUND';
    return {
      staffId: s.id, name: s.name,
      type: s.type,
      positionName: positions.find(pos => pos.id === s.positionId)?.name,
      kpiTarget: 0, contribution,
      efficiency: 1.0, 
      receivingRate: 1.0,
      salaryHQ: 0, realHQSalary: contribution,
      rank: khoanLabel, bonus: 0,
      carryOverUsed: 0, surplus: 0
    };
  });

  const allStaffPerformance = [
    ...kpiPerformances,
    ...deptHeadPerformances,
    ...directorPerformances,
    ...deputyDirectorPerformances,
    ...khoanPerformances
  ];

  // 10. Tổng hợp tài chính
  const totalHQSalaryReal = allStaffPerformance.reduce((sum, sp) => sum + sp.realHQSalary, 0);
  const profitBeforeBonus = totalLNG - config.fixedCost - totalHQSalaryReal;
  const totalBonusFund    = mode === "YEAR" ? Math.max(0, profitBeforeBonus * config.bonusRatio) : 0;
  const profitBeforeTax   = profitBeforeBonus - totalBonusFund;

  const totalKPIContribution = [...kpiPerformances, ...deptHeadPerformances].reduce((sum, p) => sum + p.contribution, 0);

  const staffPerformance = allStaffPerformance.map(p => ({
    ...p,
    bonus: mode === "YEAR" && (p.type === 'KPI' || p.type === 'KY_THUAT' || p.type === 'DEPT_HEAD') && totalKPIContribution > 0
      ? (p.contribution / totalKPIContribution) * totalBonusFund
      : 0
  }));

  return {
    projects: processedProjects,
    allocations,
    staffPerformance,
    financeSummary: {
      totalLNG, totalServiceLNG,
      fc: config.fixedCost,
      totalHQSalaryReal,
      profitBeforeBonus, totalBonusFund, profitBeforeTax
    }
  };
}
