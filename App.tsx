
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  CalculationMode,
  Staff,
  Project,
  ProjectType,
  RoleConfig,
  FinancialParams,
  ProjectStaffRole,
  CalculationResult,
  GlobalData,
  MonthSnapshot,
  Department,
  Position,
  KpiTier,
  LogicType
} from './types';
import {
  INITIAL_STAFF,
  INITIAL_PROJECTS,
  INITIAL_FINANCE,
  EMPTY_FINANCE,
  INITIAL_MATRIX,
  ADMIN_PASSWORD,
  INITIAL_DEPARTMENTS,
  INITIAL_POSITIONS,
  INITIAL_KPI_TIERS
} from './constants';
import { calculatePayroll } from './utils/calculations';
import { formatCurrency, formatNumber, formatPercent } from './utils/format';
import { exportPayrollToExcel } from './utils/export';

// --- Storage Utilities ---
const STORAGE_KEY = 'hapro_payroll_v43_data_v2';

const api = {
  async load(): Promise<GlobalData> {
    try {
      const resp = await fetch('/api/data');
      if (!resp.ok) throw new Error('API Error');
      return await resp.json();
    } catch (err) {
      console.error('Failed to load data from API', err);
      return {};
    }
  },
  async save(data: GlobalData): Promise<void> {
    try {
      await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    } catch (err) {
      console.error('Failed to save data to API', err);
    }
  }
};

const NumericInput: React.FC<{
  value: number;
  onChange: (val: number) => void;
  className?: string;
}> = ({ value, onChange, className }) => {
  const [displayValue, setDisplayValue] = useState(formatNumber(value));
  useEffect(() => { setDisplayValue(formatNumber(value)); }, [value]);
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    const numValue = rawValue === '' ? 0 : parseInt(rawValue, 10);
    setDisplayValue(formatNumber(numValue));
    onChange(numValue);
  };
  return (
    <input
      type="text"
      value={displayValue}
      onChange={handleChange}
      className={`text-right font-mono outline-none ${className}`}
      placeholder="0"
    />
  );
};

const SectionCard: React.FC<{ title: string; children: React.ReactNode; action?: React.ReactNode }> = ({ title, children, action }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
    <div className="bg-gray-50 border-b border-gray-100 px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
      {action}
    </div>
    <div className="p-6">{children}</div>
  </div>
);

const HelpBox: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="mt-8 p-5 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-900">
    <div className="flex items-center gap-2 mb-3 text-blue-700 font-bold uppercase tracking-wider text-xs">
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
      {title}
    </div>
    <div className="space-y-2 leading-relaxed opacity-90">
      {children}
    </div>
  </div>
);

const RankBadge: React.FC<{ rank: string }> = ({ rank }) => {
  const colors: Record<string, string> = {
    'A++': 'bg-emerald-600 text-white',
    'A+': 'bg-emerald-500 text-white',
    'A': 'bg-emerald-400 text-white',
    'B+': 'bg-blue-500 text-white',
    'B': 'bg-blue-400 text-white',
    'C+': 'bg-amber-500 text-white',
    'C': 'bg-gray-400 text-white',
    'KHOÁN': 'bg-purple-600 text-white',
    'DIRECTOR': 'bg-[#004d40] text-white'
  };
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${colors[rank] || 'bg-gray-200'}`}>
      {rank}
    </span>
  );
};

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => localStorage.getItem('hapro_auth') === 'true');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [globalData, setGlobalData] = useState<GlobalData>({});

  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedQuarter, setSelectedQuarter] = useState<number>(1);
  const [mode, setMode] = useState<CalculationMode>("MONTH");
  // Thứ tự tab: báo cáo lương, tài chính, dự án, ma trận, nhân sự, cấu hình
  const [activeTab, setActiveTab] = useState<'payroll' | 'finance' | 'performance' | 'projects' | 'staff' | 'kpi_positions' | 'config'>('payroll');

  const [yearOptions, setYearOptions] = useState<number[]>([new Date().getFullYear() - 1, new Date().getFullYear()]);

  const [staff, setStaff] = useState<Staff[]>([]);
  const [departments, setDepartments] = useState<Department[]>(INITIAL_DEPARTMENTS);
  const [projects, setProjects] = useState<Project[]>([]);
  const [bonusRatio, setBonusRatio] = useState<number>(INITIAL_FINANCE.bonusRatio);
  const [companyName, setCompanyName] = useState<string>(INITIAL_FINANCE.companyName);
  const [finance, setFinance] = useState<FinancialParams>(INITIAL_FINANCE);
  const [matrix, setMatrix] = useState<ProjectStaffRole[]>([]);
  const [positions, setPositions] = useState<Position[]>(INITIAL_POSITIONS);
  const [kpiTiers, setKpiTiers] = useState<KpiTier[]>(INITIAL_KPI_TIERS);

  const performLoadData = useCallback((year: number, month: number, quarter: number, calcMode: CalculationMode, data: GlobalData) => {
    const yearData = data[year];

    setBonusRatio(yearData?.bonusRatio ?? INITIAL_FINANCE.bonusRatio);

    let snapshot = null;
    if (calcMode === 'YEAR') snapshot = yearData?.yearSnapshot;
    else if (calcMode === 'QUARTER') snapshot = yearData?.quarters?.[quarter];
    else snapshot = yearData?.months?.[month];

    if (snapshot) {
      setStaff(snapshot.staff);
      setDepartments(snapshot.departments || INITIAL_DEPARTMENTS);
      setPositions(snapshot.positions || snapshot.positions || INITIAL_POSITIONS); // Try to load from snapshot, fallback to global if yearData exists
      setProjects(snapshot.projects);
      setMatrix(snapshot.matrix);
      setFinance(snapshot.config);
      setCompanyName(snapshot.config.companyName);
      setKpiTiers(snapshot.kpiTiers || yearData?.kpiTiers || INITIAL_KPI_TIERS);
    } else if (calcMode === 'MONTH') {
      // Auto-copy staff/departments from previous month if no snapshot exists
      let prevMonth = month - 1;
      let prevYear = year;
      if (prevMonth === 0) { prevMonth = 12; prevYear = year - 1; }
      const prevSnapshot = data[prevYear]?.months?.[prevMonth];
      if (prevSnapshot) {
        // Calculate surpluses from previous month
        const prevResults = calculatePayroll(
          'MONTH', 
          prevSnapshot.staff, 
          prevSnapshot.projects, 
          prevSnapshot.config, 
          prevSnapshot.matrix, 
          prevSnapshot.departments || [], 
          prevSnapshot.positions || [], 
          prevSnapshot.kpiTiers || []
        );

        const updatedStaff = prevSnapshot.staff.map(s => {
          const perf = prevResults.staffPerformance.find(p => p.staffId === s.id);
          return {
            ...s,
            carryOver: perf ? perf.surplus : 0
          };
        });

        setStaff(updatedStaff);
        setDepartments(prevSnapshot.departments || INITIAL_DEPARTMENTS);
        setProjects(INITIAL_PROJECTS);
        setMatrix(INITIAL_MATRIX);
        setFinance(INITIAL_FINANCE);
        setCompanyName(INITIAL_FINANCE.companyName);
        setKpiTiers(prevSnapshot.kpiTiers || INITIAL_KPI_TIERS);
      } else {
        setStaff(INITIAL_STAFF);
        setDepartments(INITIAL_DEPARTMENTS);
        setProjects(INITIAL_PROJECTS);
        setMatrix(INITIAL_MATRIX);
        setFinance(INITIAL_FINANCE);
        setCompanyName(INITIAL_FINANCE.companyName);
        setKpiTiers(INITIAL_KPI_TIERS);
      }
    } else {
      setStaff(INITIAL_STAFF);
      setDepartments(INITIAL_DEPARTMENTS);
      setProjects(INITIAL_PROJECTS);
      setMatrix(INITIAL_MATRIX);
      setFinance(INITIAL_FINANCE);
      setCompanyName(INITIAL_FINANCE.companyName);
      setKpiTiers(yearData?.kpiTiers || INITIAL_KPI_TIERS);
    }
  }, []);

  // Initial load
  useEffect(() => {
    api.load().then(data => {
      setGlobalData(data);
      setIsLoading(false);
      performLoadData(selectedYear, selectedMonth, selectedQuarter, mode, data);
    });
  }, []);

  useEffect(() => {
    if (!isLoading) {
      performLoadData(selectedYear, selectedMonth, selectedQuarter, mode, globalData);
    }
  }, [selectedYear, selectedMonth, selectedQuarter, mode, performLoadData, isLoading, globalData]);

  const saveCurrentSnapshot = (updatedStaff?: Staff[], updatedProjects?: Project[], updatedMatrix?: ProjectStaffRole[], updatedFinance?: FinancialParams, updatedDepartments?: Department[], propagateStaffForward?: boolean, updatedKpiTiers?: KpiTier[]) => {
    const updatedGlobal = { ...globalData };
    if (!updatedGlobal[selectedYear]) {
      updatedGlobal[selectedYear] = { bonusRatio: bonusRatio, months: {}, quarters: {} } as any;
    }
    const snapshot = {
      config: updatedFinance || finance,
      departments: updatedDepartments || departments,
      positions: positions,
      staff: updatedStaff || staff,
      projects: updatedProjects || projects,
      matrix: updatedMatrix || matrix,
      kpiTiers: updatedKpiTiers || kpiTiers
    };
    if (mode === 'YEAR') updatedGlobal[selectedYear].yearSnapshot = snapshot;
    else if (mode === 'QUARTER') {
      if (!updatedGlobal[selectedYear].quarters) updatedGlobal[selectedYear].quarters = {};
      updatedGlobal[selectedYear].quarters![selectedQuarter] = snapshot;
    } else {
      updatedGlobal[selectedYear].months[selectedMonth] = snapshot;
      // Propagate staff/departments forward to future months that exist
      if (propagateStaffForward) {
        for (let m = selectedMonth + 1; m <= 12; m++) {
          const futureSnap = updatedGlobal[selectedYear].months[m];
          if (futureSnap) {
            updatedGlobal[selectedYear].months[m] = {
              ...futureSnap,
              staff: updatedStaff || staff,
              departments: updatedDepartments || departments,
            };
          }
        }
      }
    }

    setGlobalData(updatedGlobal);
    api.save(updatedGlobal);
  };

  const currentFinanceConfig = useMemo(() => ({
    ...finance,
    bonusRatio: bonusRatio,
    companyName: companyName
  }), [finance, bonusRatio, companyName]);

  const results = useMemo(() =>
    calculatePayroll(
      mode,
      staff,
      projects,
      currentFinanceConfig,
      matrix,
      departments,
      positions,
      kpiTiers
    ),
    [mode, staff, projects, currentFinanceConfig, matrix, departments, positions, kpiTiers]
  );

  const handleLogin = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (passwordInput === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      localStorage.setItem('hapro_auth', 'true');
    } else setLoginError(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('hapro_auth');
  };

  const handleSave = () => {
    const updatedGlobal = { ...globalData };
    if (!updatedGlobal[selectedYear]) updatedGlobal[selectedYear] = { bonusRatio, months: {}, quarters: {} } as any;
    updatedGlobal[selectedYear].bonusRatio = bonusRatio;

    setGlobalData(updatedGlobal);
    api.save(updatedGlobal);
    alert("Đã lưu dữ liệu lên server!");
  };

  const handleBackup = () => {
    const data = JSON.stringify(globalData);
    if (!data || data === '{}') { alert("Không có dữ liệu để sao lưu!"); return; }
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `hapro_payroll_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      try {
        const data = JSON.parse(content);
        setGlobalData(data);
        await api.save(data);
        alert('Khôi phục dữ liệu thành công! Trang web sẽ tải lại.');
        window.location.reload();
      } catch (err) {
        alert('File không đúng định dạng!');
      }
    };
    reader.readAsText(file);
  };

  const handleRestore = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = handleImport;
    input.click();
  };

  const handleExport = () => {
    exportPayrollToExcel(results, currentFinanceConfig, staff, projects, selectedYear, selectedMonth, selectedQuarter, mode);
  };

  const handleSummarizeQuarter = () => {
    if (mode !== "QUARTER") return;
    const startMonth = (selectedQuarter - 1) * 3 + 1;
    const endMonth = startMonth + 2;

    const yearData = globalData[selectedYear] || { months: {} };
    const monthSnapshots: MonthSnapshot[] = [];

    for (let m = startMonth; m <= endMonth; m++) {
      monthSnapshots.push(yearData.months[m] || {
        config: { ...INITIAL_FINANCE, fixedCost: Math.round(INITIAL_FINANCE.fixedCost / 12) },
        departments: INITIAL_DEPARTMENTS,
        staff: INITIAL_STAFF,
        projects: INITIAL_PROJECTS.map(p => ({ ...p, revenue: Math.round(p.revenue / 12), directCost: Math.round(p.directCost / 12) })),
        matrix: INITIAL_MATRIX
      });
    }

    const aggFinance = { ...EMPTY_FINANCE, bonusRatio: bonusRatio, companyName: companyName };
    const deptMap: Record<string, Department> = {};
    const staffMap: Record<string, Staff> = {};
    const projMap: Record<string, Project> = {};
    const matrixSet = new Set<string>();

    monthSnapshots.forEach(snap => {
      aggFinance.fixedCost += snap.config.fixedCost;
      (snap.departments || []).forEach(d => {
        if (!deptMap[d.id]) deptMap[d.id] = { ...d };
      });
      snap.staff.forEach(s => {
        if (!staffMap[s.id]) staffMap[s.id] = { ...s, salaryHQ: 0, salaryBase: 0, salaryFull: 0 };
        staffMap[s.id].salaryHQ += s.salaryHQ;
        staffMap[s.id].salaryBase += s.salaryBase;
        staffMap[s.id].salaryFull += s.salaryFull;
      });
      snap.projects.forEach(p => {
        const key = p.code || p.id;
        if (!projMap[key]) projMap[key] = { ...p, revenue: 0, directCost: 0 };
        projMap[key].revenue += p.revenue;
        projMap[key].directCost += p.directCost;
      });
      snap.matrix.forEach(mat => matrixSet.add(`${mat.projectId}|${mat.staffId}|${mat.roleName}`));
    });

    setFinance(aggFinance);
    setDepartments(Object.values(deptMap));
    setStaff(Object.values(staffMap));
    setProjects(Object.values(projMap));
    setMatrix(Array.from(matrixSet).map(str => {
      const [pid, sid, r] = str.split('|');
      return { projectId: pid, staffId: sid, roleName: r };
    }));
    alert(`Tổng hợp dữ liệu Quý ${selectedQuarter} (Tháng ${startMonth}-${endMonth}) hoàn tất!`);
  };

  const handleSummarizeMonths = () => {
    if (mode !== "YEAR") return;
    const yearData = globalData[selectedYear] || { months: {} };
    const monthSnapshots: MonthSnapshot[] = [];

    for (let m = 1; m <= 12; m++) {
      monthSnapshots.push(yearData.months[m] || {
        config: { ...INITIAL_FINANCE, fixedCost: Math.round(INITIAL_FINANCE.fixedCost / 12) },
        departments: INITIAL_DEPARTMENTS,
        staff: INITIAL_STAFF,
        projects: INITIAL_PROJECTS.map(p => ({ ...p, revenue: Math.round(p.revenue / 12), directCost: Math.round(p.directCost / 12) })),
        matrix: INITIAL_MATRIX
      });
    }

    const aggFinance = { ...EMPTY_FINANCE, bonusRatio: bonusRatio, companyName: companyName };
    const deptMap: Record<string, Department> = {};
    const staffMap: Record<string, Staff> = {};
    const projMap: Record<string, Project> = {};
    const matrixSet = new Set<string>();

    monthSnapshots.forEach(snap => {
      aggFinance.fixedCost += snap.config.fixedCost;
      (snap.departments || []).forEach(d => {
        if (!deptMap[d.id]) deptMap[d.id] = { ...d };
      });
      snap.staff.forEach(s => {
        if (!staffMap[s.id]) staffMap[s.id] = { ...s, salaryHQ: 0, salaryBase: 0, salaryFull: 0 };
        staffMap[s.id].salaryHQ += s.salaryHQ;
      });
      snap.projects.forEach(p => {
        const key = p.code || p.id;
        if (!projMap[key]) projMap[key] = { ...p, revenue: 0, directCost: 0 };
        projMap[key].revenue += p.revenue;
        projMap[key].directCost += p.directCost;
      });
      snap.matrix.forEach(mat => matrixSet.add(`${mat.projectId}|${mat.staffId}|${mat.roleName}`));
    });
    setFinance(aggFinance);
    setDepartments(Object.values(deptMap));
    setStaff(Object.values(staffMap));
    setProjects(Object.values(projMap));
    setMatrix(Array.from(matrixSet).map(str => {
      const [pid, sid, r] = str.split('|');
      return { projectId: pid, staffId: sid, roleName: r };
    }));
    alert("Tổng hợp dữ liệu từ 12 tháng hoàn tất!");
  };

  const handleCopyFromPreviousMonth = () => {
    if (mode !== 'MONTH') return;

    let prevMonth = selectedMonth - 1;
    let prevYear = selectedYear;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear = selectedYear - 1;
    }

    const prevSnapshot = globalData[prevYear]?.months?.[prevMonth];
    if (!prevSnapshot) {
      alert(`Không tìm thấy dữ liệu tháng ${prevMonth}/${prevYear} để copy!`);
      return;
    }

    if (confirm(`Bạn có chắc chắn muốn copy toàn bộ dữ liệu từ tháng ${prevMonth}/${prevYear} sang tháng hiện tại không? Dữ liệu hiện tại sẽ bị ghi đè.`)) {
      setStaff(prevSnapshot.staff);
      setDepartments(prevSnapshot.departments || INITIAL_DEPARTMENTS);
      setProjects(prevSnapshot.projects);
      setMatrix(prevSnapshot.matrix);
      setFinance(prevSnapshot.config);
      setCompanyName(prevSnapshot.config.companyName);

      saveCurrentSnapshot(prevSnapshot.staff, prevSnapshot.projects, prevSnapshot.matrix, prevSnapshot.config, prevSnapshot.departments);
      alert(`Đã copy dữ liệu thành công từ tháng ${prevMonth}/${prevYear}!`);
    }
  };

  const CopyButton = () => (
    mode === 'MONTH' ? (
      <button
        type="button"
        onClick={handleCopyFromPreviousMonth}
        className="bg-indigo-500 text-white text-[10px] px-3 py-1.5 rounded font-bold shadow-sm hover:bg-indigo-600 transition-colors flex items-center gap-1"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
        COPY TỪ THÁNG TRƯỚC
      </button>
    ) : null
  );

  const handleUpdateFinance = (field: keyof FinancialParams, value: any) => {
    const updated = { ...finance, [field]: value };
    setFinance(updated);
    if (field === 'companyName') setCompanyName(value);
    saveCurrentSnapshot(undefined, undefined, undefined, updated);
  };



  const handleUpdateStaff = (id: string, field: keyof Staff, value: any) => {
    const updated = staff.map(s => {
      if (s.id === id) {
        const updatedStaff = { ...s, [field]: value };
        
        // Cập nhật Logic Type tự động nếu chọn PositionId
        if (field === 'positionId') {
          const pos = positions.find(p => p.id === value);
          if (pos) {
            updatedStaff.type = pos.logicType;
          }
        }

        // Nếu đổi loại hình, cần dọn dẹp ma trận nếu cần
        if (field === 'type' || field === 'positionId') {
          const logicType = updatedStaff.type;
          if (isKhoanType(logicType)) {
            const roleName = logicType === 'KHOAN_OUTBOUND' ? 'Outbound' : 'Inbound';
            setMatrix(prevM => prevM.map(m => m.staffId === id ? { ...m, roleName } : m));
          } else if (logicType === 'DIRECTOR' || logicType === 'DEPUTY_DIRECTOR') {
            setMatrix(prevM => prevM.filter(m => m.staffId !== id));
          }
        }
        return updatedStaff;
      }
      return s;
    });
    setStaff(updated);
    saveCurrentSnapshot(updated, undefined, undefined, undefined, undefined, true);
  };

  const isKhoanType = (type: LogicType) => type === 'KHOAN' || type === 'KHOAN_INBOUND' || type === 'KHOAN_OUTBOUND';

  const handleUpdatePosition = (id: string, field: keyof Position, value: any) => {
    const updated = positions.map(p => p.id === id ? { ...p, [field]: value } : p);
    setPositions(updated);
    // Sync logic types for staff
    const updatedStaff = staff.map(s => {
      if (s.positionId === id) {
        const pos = updated.find(p => p.id === id);
        return { ...s, type: pos?.logicType || s.type };
      }
      return s;
    });
    setStaff(updatedStaff);
    saveCurrentSnapshot(updatedStaff);
  };

  const handleAddPosition = () => {
    const newPos: Position = { id: Date.now().toString(), name: 'Chức vụ mới', logicType: 'KPI' };
    const updated = [...positions, newPos];
    setPositions(updated);
    saveCurrentSnapshot();
  };

  const handleUpdateKpiTier = (id: string, field: keyof KpiTier, value: number) => {
    const updated = kpiTiers.map(t => t.id === id ? { ...t, [field]: value } : t);
    setKpiTiers(updated);
    saveCurrentSnapshot(undefined, undefined, undefined, undefined, undefined, false, updated);
  };

  const handleAddKpiTier = () => {
    const newTier: KpiTier = { id: Date.now().toString(), minEfficiency: 0, salaryRate: 0.5 };
    const updated = [...kpiTiers, newTier];
    setKpiTiers(updated);
    saveCurrentSnapshot(undefined, undefined, undefined, undefined, undefined, false, updated);
  };

  const handleDeleteKpiTier = (id: string) => {
    if (kpiTiers.length <= 1) {
      alert("Phải có ít nhất một mức KPI!");
      return;
    }
    const updated = kpiTiers.filter(t => t.id !== id);
    setKpiTiers(updated);
    saveCurrentSnapshot(undefined, undefined, undefined, undefined, undefined, false, updated);
  };

  const handleDeletePosition = (id: string) => {
    if (confirm('Xác nhận xóa chức vụ/vị trí này?')) {
      const updated = positions.filter(p => p.id !== id);
      setPositions(updated);
      // Also clear positionId from staff using this position
      const updatedStaff = staff.map(s => s.positionId === id ? { ...s, positionId: undefined, type: 'KPI' } : s);
      setStaff(updatedStaff);
      saveCurrentSnapshot(updatedStaff);
    }
  };

  const handleAddStaff = () => {
    const newStaff: Staff = { 
      id: Date.now().toString(), 
      name: 'Nhân viên mới', 
      salaryFull: 0, 
      salaryHQ: 0, 
      salaryBase: 0, 
      type: 'KPI',
      manualKpiTarget: 0 
    };
    const updated = [...staff, newStaff];
    setStaff(updated);
    saveCurrentSnapshot(updated);
  };





  const handleDeleteStaff = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Xác nhận xóa nhân viên?')) {
      const updatedStaff = staff.filter(s => s.id !== id);
      const updatedMatrix = matrix.filter(m => m.staffId !== id);
      setStaff(updatedStaff);
      setMatrix(updatedMatrix);
      saveCurrentSnapshot(updatedStaff, undefined, updatedMatrix);
    }
  };

  const handleUpdateProject = (id: string, field: keyof Project, value: any) => {
    const updated = projects.map(p => p.id === id ? { ...p, [field]: value } : p);
    setProjects(updated);
    saveCurrentSnapshot(undefined, updated);
  };

  const handleAddProject = () => {
    const newProj: Project = { id: Date.now().toString(), code: 'DA-NEW', name: 'Dự án mới', revenue: 0, directCost: 0 };
    const updated = [...projects, newProj];
    setProjects(updated);
    saveCurrentSnapshot(undefined, updated);
  };

  const handleDeleteProject = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Xác nhận xóa dự án?')) {
      const updatedProjects = projects.filter(p => p.id !== id);
      const updatedMatrix = matrix.filter(m => m.projectId !== id);
      setProjects(updatedProjects);
      setMatrix(updatedMatrix);
      saveCurrentSnapshot(undefined, updatedProjects, updatedMatrix);
    }
  };

  const handleMatrixToggle = (projectId: string, staffId: string, roleName: string, checked: boolean) => {
    let newMatrix = [...matrix];
    if (checked) {
      if (!newMatrix.some(m => m.projectId === projectId && m.staffId === staffId && m.roleName === roleName)) {
        newMatrix.push({ projectId, staffId, roleName });
      }
    } else {
      newMatrix = newMatrix.filter(m => !(m.projectId === projectId && m.staffId === staffId && m.roleName === roleName));
    }
    setMatrix(newMatrix);
    saveCurrentSnapshot(undefined, undefined, newMatrix);
  };


  const handleUpdateBonusRatio = (val: number) => {
    setBonusRatio(val);
    const updatedGlobal = { ...globalData };
    if (updatedGlobal[selectedYear]) {
      updatedGlobal[selectedYear].bonusRatio = val;
      setGlobalData(updatedGlobal);
      api.save(updatedGlobal);
    }
  };

  const netFC = finance.fixedCost - finance.financialProfit - finance.otherProfit;
  const totalSalaryHQAll = staff.reduce((sum, s) => sum + s.salaryHQ, 0);
  const companyTotalTarget = netFC + totalSalaryHQAll;

  const avgEfficiency = useMemo(() => {
    const kpiPerformances = results.staffPerformance.filter(p => p.type === 'KPI');
    if (kpiPerformances.length === 0) return 0;
    return kpiPerformances.reduce((acc, s) => acc + s.efficiency, 0) / kpiPerformances.length;
  }, [results.staffPerformance]);

  // --- Change detection: compare current month vs previous month (MONTH mode only) ---
  const prevMonthSnapshot = useMemo(() => {
    if (mode !== 'MONTH') return null;
    let prevMonth = selectedMonth - 1;
    let prevYear = selectedYear;
    if (prevMonth === 0) { prevMonth = 12; prevYear = selectedYear - 1; }
    return globalData[prevYear]?.months?.[prevMonth] || null;
  }, [mode, selectedMonth, selectedYear, globalData]);

  const changedStaffIds = useMemo(() => {
    if (!prevMonthSnapshot) return new Set<string>();
    const changed = new Set<string>();
    staff.forEach(s => {
      const prev = prevMonthSnapshot.staff?.find(ps => ps.id === s.id);
      if (!prev) { changed.add(s.id); return; }
      if (s.name !== prev.name || s.salaryHQ !== prev.salaryHQ || s.type !== prev.type ||
        s.positionId !== prev.positionId || s.manualKpiTarget !== prev.manualKpiTarget ||
        s.khoanRate !== prev.khoanRate) {
        changed.add(s.id);
      }
    });
    prevMonthSnapshot.staff?.forEach(ps => {
      if (!staff.find(s => s.id === ps.id)) changed.add(ps.id + '_deleted');
    });
    return changed;
  }, [staff, prevMonthSnapshot]);

  const changedDeptIds = useMemo(() => {
    if (!prevMonthSnapshot) return new Set<string>();
    const prevDepts = prevMonthSnapshot.departments || [];
    const changed = new Set<string>();
    departments.forEach(d => {
      const prev = prevDepts.find(pd => pd.id === d.id);
      if (!prev || d.name !== prev.name) changed.add(d.id);
    });
    prevDepts.forEach(pd => {
      if (!departments.find(d => d.id === pd.id)) changed.add(pd.id + '_deleted');
    });
    return changed;
  }, [departments, prevMonthSnapshot]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center font-sans">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#004d40] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 font-bold animate-pulse">ĐANG TẢI DỮ LIỆU CHUNG...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4 font-sans">
        <div className="bg-white p-10 rounded-3xl shadow-2xl border border-gray-100 w-full max-w-md transform transition-all hover:scale-[1.01]">
          <div className="text-center mb-10">
            <div className="bg-gradient-to-br from-[#004d40] to-[#00796b] w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg rotate-3">
              <span className="text-3xl font-black text-white italic">H</span>
            </div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight mb-2">HAPRO PAYROLL</h1>
            <p className="text-gray-500 font-medium">Hệ thống Quản trị Lương Tổng thể</p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Mật khẩu truy cập</label>
              <input
                type="password"
                className={`w-full p-4 bg-gray-50 border-2 rounded-2xl outline-none transition-all duration-300 font-mono text-center text-xl tracking-widest ${loginError ? 'border-red-400 bg-red-50 text-red-900 focus:ring-red-200' : 'border-gray-100 focus:border-[#004d40] focus:ring-4 focus:ring-emerald-50 focus:bg-white text-gray-800'}`}
                value={passwordInput}
                onChange={(e) => { setPasswordInput(e.target.value); setLoginError(false); }}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="••••••••"
                autoFocus
              />
              {loginError && <p className="mt-3 text-red-500 text-xs font-bold text-center animate-pulse">Thông tin xác thực không chính xác</p>}
            </div>

            <button
              onClick={handleLogin}
              className="w-full bg-[#004d40] hover:bg-[#003d33] text-white p-5 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-emerald-900/10 transition-all duration-300 active:scale-[0.98] active:shadow-inner"
            >
              Đăng nhập hệ thống
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-gray-800 font-sans pb-20 selection:bg-emerald-100 selection:text-emerald-900">

      {/* Header */}
      <header className="bg-[#004d40] text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col xl:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="bg-white p-2 rounded-lg text-[#004d40] font-bold">HP</div>
            <div>
              <h1 className="text-xl font-bold uppercase">Hapro Payroll</h1>
              <p className="text-[10px] opacity-70">VERSION 43.12 FIXED</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 justify-center">
            <div className="flex items-center gap-2 bg-white/10 p-1 rounded border border-white/20">
              <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="bg-transparent font-bold text-sm outline-none cursor-pointer">
                {yearOptions.map(y => <option key={y} value={y} className="text-black">{y}</option>)}
              </select>
              {mode === "QUARTER" && (
                <select value={selectedQuarter} onChange={(e) => setSelectedQuarter(Number(e.target.value))} className="bg-transparent font-bold text-sm outline-none cursor-pointer border-l border-white/20 pl-2">
                  {[1, 2, 3, 4].map(q => <option key={q} value={q} className="text-black">Quý {q}</option>)}
                </select>
              )}
              {mode === "MONTH" && (
                <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} className="bg-transparent font-bold text-sm outline-none cursor-pointer border-l border-white/20 pl-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => <option key={m} value={m} className="text-black">Tháng {m}</option>)}
                </select>
              )}
            </div>

            <div className="flex bg-white/50 backdrop-blur p-1 rounded-lg border border-white/50 shadow-sm">
              <button onClick={() => setMode('MONTH')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${mode === 'MONTH' ? 'bg-[#004d40] text-white shadow-lg scale-105' : 'text-gray-500 hover:bg-white'}`}>THÁNG</button>
              <button onClick={() => setMode('QUARTER')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${mode === 'QUARTER' ? 'bg-[#004d40] text-white shadow-lg scale-105' : 'text-gray-500 hover:bg-white'}`}>QUÝ</button>
              <button onClick={() => setMode('YEAR')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${mode === 'YEAR' ? 'bg-[#004d40] text-white shadow-lg scale-105' : 'text-gray-500 hover:bg-white'}`}>NĂM</button>
            </div>

            <div className="flex items-center gap-2 bg-black/10 p-1 rounded-lg">
              <button type="button" onClick={handleSave} className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded text-xs font-bold shadow-sm transition-all flex items-center gap-1.5" title="Lưu vào trình duyệt"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>LƯU</button>
              <button type="button" onClick={handleBackup} className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-xs font-bold shadow-sm transition-all flex items-center gap-1.5" title="Tải tệp sao lưu (.json)"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>BACKUP</button>
              <button type="button" onClick={handleRestore} className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded text-xs font-bold shadow-sm transition-all flex items-center gap-1.5" title="Khôi phục từ tệp (.json)"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>RESTORE</button>
            </div>

            <button type="button" onClick={handleLogout} className="bg-red-500/20 hover:bg-red-500 text-white px-4 py-2 rounded text-xs font-bold transition-colors">THOÁT</button>
          </div>
        </div>
      </header>

      <nav className="bg-white border-b sticky top-[64px] z-40 shadow-sm overflow-x-auto">
        <div className="max-w-7xl mx-auto px-4 flex space-x-6">
          {[
            { id: 'payroll', label: 'Bảng Lương' },
            { id: 'finance', label: 'Tài Chính' },
            { id: 'performance', label: 'Hiệu suất' },
            { id: 'projects', label: 'Dự Án' },
            { id: 'staff', label: 'Nhân Sự' },
            { id: 'kpi_positions', label: 'Vị trí & KPI' },
            { id: 'config', label: 'Cấu Hình' }
          ].map(tab => (
            <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id as any)} className={`py-4 px-1 border-b-2 font-medium text-sm transition-all ${activeTab === tab.id ? 'border-[#004d40] text-[#004d40]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{tab.label}</button>
          ))}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {activeTab === 'payroll' && (
          <div className="space-y-8 animate-fadeIn">
            <SectionCard title="CHI TIẾT THANH TOÁN LƯƠNG" action={<button onClick={handleExport} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded text-xs font-bold flex items-center gap-2 shadow-sm transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>XUẤT EXCEL</button>}>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 text-[10px] font-bold text-gray-500 uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Nhân viên</th>
                      <th className="px-4 py-3 text-right">Loại KPI</th>
                      <th className="px-4 py-4 text-right">KPI Mục Tiêu</th>
                      <th className="px-4 py-4 text-right text-blue-600">Hoàn thành</th>
                      <th className="px-4 py-4 text-right">Hiệu suất</th>
                      <th className="px-4 py-3 text-right text-emerald-600">Lương HQ tối đa</th>
                      <th className="px-4 py-3 text-right">Tỷ lệ hưởng</th>
                      {mode === 'YEAR' && <th className="px-4 py-3 text-right text-orange-600">Thưởng</th>}
                      <th className="px-4 py-3 text-right font-bold text-emerald-800 bg-emerald-50">Lương HQ thực tế</th>
                      {mode === 'QUARTER' && <th className="px-4 py-3 text-right font-bold text-blue-800 bg-blue-50">Đã tạm ứng</th>}
                      {mode === 'QUARTER' && <th className="px-4 py-3 text-right font-bold text-orange-800 bg-orange-50">Quyết toán thu/chi</th>}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100 text-sm">
                    {[...results.staffPerformance]
                      .sort((a, b) => b.salaryHQ - a.salaryHQ)
                      .map((perf) => {
                        // Tính số đã tạm ứng = 50% Lương HQ tối đa của quý (Theo Q1-2026: Tháng 1 25%, tháng 2 25%)
                        const advancePaid = mode === 'QUARTER' ? perf.salaryHQ * 0.5 : 0;
                        const finalSettlement = mode === 'QUARTER' ? perf.realHQSalary - advancePaid : 0;
                        return (
                        <tr key={perf.staffId}>
                          <td className="px-4 py-4 font-semibold">{perf.name}</td>
                          <td className="px-4 py-4 text-right">
                            <span className="text-[10px] font-bold text-gray-400 uppercase">
                              {perf.positionName || (perf.type === 'DIRECTOR' ? 'Giám đốc' : perf.type === 'DEPUTY_DIRECTOR' ? 'Phó Giám đốc' : perf.type)}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-right font-mono">{perf.type === 'KHOAN' ? '-' : formatNumber(perf.kpiTarget)}</td>
                          <td className="px-4 py-4 text-right font-mono text-blue-600">{formatNumber(perf.contribution)}</td>
                          <td className="px-4 py-4 text-right font-mono">{perf.type === 'KHOAN' ? '-' : formatPercent(perf.efficiency)}</td>
                          <td className="px-4 py-4 text-right font-mono text-emerald-600">{perf.type === 'KHOAN' ? '-' : formatNumber(perf.salaryHQ)}</td>
                          <td className="px-4 py-4 text-right font-mono text-indigo-600 font-medium">{perf.type === 'KHOAN' ? '100%' : formatPercent(perf.receivingRate)}</td>
                          {mode === 'YEAR' && <td className="px-4 py-4 text-right font-mono text-orange-600 font-bold">{formatNumber(perf.bonus)}</td>}
                          <td className="px-4 py-4 text-right font-mono font-bold text-emerald-700 bg-emerald-50">{formatNumber(perf.realHQSalary + perf.bonus)}</td>
                          {mode === 'QUARTER' && (
                            <td className="px-4 py-4 text-right font-mono font-bold text-blue-700 bg-blue-50">
                              {perf.type === 'KHOAN' ? '-' : formatNumber(advancePaid)}
                            </td>
                          )}
                          {mode === 'QUARTER' && (
                            <td className="px-4 py-4 text-right font-mono font-bold text-orange-700 bg-orange-50">
                              {perf.type === 'KHOAN' ? '-' : formatNumber(finalSettlement)}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </SectionCard>
            <HelpBox title="Cơ chế tính hiệu quả & Thưởng">
              <p>• <strong>Hiệu suất (KPI):</strong> Được tính bằng Đóng góp thực tế / Mục tiêu KPI đã thiết lập.</p>
              <p>• <strong>Tỷ lệ hưởng (Q1-2026):</strong> Tuyến tính từ 50% đến 100%. Dưới 50% nhận 50%. Trên 100% nhận tối đa 100%.</p>
              <p>• <strong>Quyết toán Quý:</strong> Hệ thống tự động tính 50% lương HQ (tương đương tháng 1 & 2 đã ứng). Lương thực nhận = Lương được tính - Đã ứng.</p>
              <p>• <strong>Quỹ thưởng (YEAR):</strong> Được trích từ Lợi nhuận ròng dựa trên tỷ lệ cấu hình, chỉ dành cho nhân sự KPI và phân bổ theo tỷ lệ đóng góp thực tế.</p>
            </HelpBox>
          </div>
        )}

        {activeTab === 'finance' && (
          <div className="space-y-8 animate-fadeIn">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <SectionCard title={`TỔNG HỢP TÀI CHÍNH (${mode})`}>
                  <div className="grid grid-cols-1 gap-4">
                    {[
                      { label: "1. Tổng Lợi Nhuận Gộp (LNG)", value: results.financeSummary.totalLNG },
                      { label: "2. Chi Phí Cố Định (FC)", value: results.financeSummary.fc },
                      { label: "3. Tổng Lương Hiệu Quả + Khoán", value: results.financeSummary.totalHQSalaryReal, highlight: true },
                      { label: "4. Lợi nhuận ròng (trước thưởng)", value: results.financeSummary.profitBeforeBonus, bold: true, highlight: true },
                      { label: "5. Quỹ thưởng (dành cho KPI)", value: results.financeSummary.totalBonusFund },
                      { label: "6. Lợi nhuận còn lại", value: results.financeSummary.profitBeforeTax, bold: true },
                    ].map((item, idx) => (
                      <div key={idx} className={`flex justify-between items-center py-2 border-b ${item.highlight ? 'bg-emerald-50 px-2 rounded' : ''}`}>
                        <span className={`text-sm ${item.bold ? 'font-bold text-gray-800' : 'text-gray-600'}`}>{item.label}</span>
                        <span className={`font-mono text-sm ${item.bold ? 'text-emerald-700 font-bold' : 'text-gray-800'}`}>{formatNumber(item.value)}</span>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              </div>
              <div className="space-y-6">
                <div className="bg-white rounded-xl p-6 border shadow-sm h-fit">
                  <h4 className="text-xs text-gray-400 font-bold uppercase mb-2">Lợi nhuận ròng dự kiến</h4>
                  <div className="text-3xl font-bold text-[#004d40]">{formatCurrency(results.financeSummary.profitBeforeTax)}</div>
                </div>
                <div className="bg-white rounded-xl p-6 border shadow-sm h-fit">
                  <h4 className="text-xs text-gray-400 font-bold uppercase mb-2">Hiệu suất nhân sự (KPI) TB</h4>
                  <div className="text-3xl font-bold text-[#004d40]">{formatPercent(avgEfficiency)}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'config' && (
          <div className="animate-fadeIn space-y-6">
            <SectionCard title={`CẤU HÌNH HỆ THỐNG (${mode})`} action={
              <div className="flex gap-2">
                <CopyButton />
                {mode === 'YEAR' && (
                  <button type="button" onClick={handleSummarizeMonths} className="bg-orange-500 text-white text-xs px-4 py-2 rounded font-bold shadow-md hover:bg-orange-600 transition-colors">
                    TỔNG HỢP TỪ 12 THÁNG
                  </button>
                )}
                {mode === 'QUARTER' && (
                  <button type="button" onClick={handleSummarizeQuarter} className="bg-orange-500 text-white text-xs px-4 py-2 rounded font-bold shadow-md hover:bg-orange-600 transition-colors">
                    TỔNG HỢP TỪ 3 THÁNG
                  </button>
                )}
              </div>
            }>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <h4 className="text-sm font-bold text-gray-700 border-b pb-2 uppercase tracking-wider">Thông tin chung</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-wider">TÊN CÔNG TY</label>
                      <input
                        type="text"
                        value={companyName}
                        onChange={(e) => handleUpdateFinance('companyName', e.target.value)}
                        className="w-full p-2 border rounded font-bold text-[#004d40] focus:ring-2 focus:ring-[#004d40] outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-wider">TỶ LỆ TRÍCH THƯỞNG (%)</label>
                      <input
                        type="number"
                        value={Math.round((bonusRatio || 0) * 100)}
                        onChange={(e) => handleUpdateBonusRatio(Number(e.target.value) / 100)}
                        className="w-full p-2 border rounded font-bold text-emerald-700 focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-wider">TỶ LỆ DỊCH VỤ DỰ ÁN HỖN HỢP (%)</label>
                      <input
                        type="number"
                        value={Math.round((finance.mixedServiceRatio || 0) * 100)}
                        onChange={(e) => handleUpdateFinance('mixedServiceRatio', Number(e.target.value) / 100)}
                        className="w-full p-2 border rounded font-bold text-blue-700 focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <h4 className="text-sm font-bold text-gray-700 border-b pb-2 uppercase tracking-wider">Thông số tài chính kỳ này</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-wider">CHI PHÍ CỐ ĐỊNH (FC)</label>
                      <NumericInput value={finance.fixedCost} onChange={(val) => handleUpdateFinance('fixedCost', val)} className="w-full p-2 border rounded focus:border-[#004d40]" />
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>
            <HelpBox title="Thông tin Công ty & Tài chính">
              <p>• <strong>Chi phí cố định (FC):</strong> Bao gồm tiền thuê văn phòng, điện nước, lương cơ bản và các chi phí vận hành chung.</p>
              <p>• <strong>Tỷ lệ trích thưởng:</strong> % lợi nhuận ròng được trích ra để thưởng hiệu quả (Year-end) cho nhân sự.</p>
            </HelpBox>
          </div>
        )}

        {activeTab === 'performance' && (
          <div className="space-y-8 animate-fadeIn">
            <SectionCard title="CHI TIẾT HIỆU SUẤT NHÂN SỰ" action={
              <div className="flex gap-2 text-[10px] items-center text-gray-400">
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"></div> Dự án</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Carry-over</span>
              </div>
            }>
              <div className="space-y-6">
                {results.staffPerformance
                  .filter(p => p.type !== 'KHOAN') // Only show KPI types
                  .sort((a, b) => b.contribution - a.contribution)
                  .map((perf) => {
                    const staffAllocations = results.allocations.filter(a => a.staffId === perf.staffId);
                    return (
                      <div key={perf.staffId} className="bg-white border rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                          <div>
                            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                              {perf.name}
                              <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full font-bold uppercase tracking-wider">{perf.positionName}</span>
                            </h3>
                            <div className="text-xs text-gray-400 mt-1">Mục tiêu: <span className="font-mono font-bold text-gray-600">{formatNumber(perf.kpiTarget)}</span></div>
                          </div>
                          <div className="flex gap-8">
                            <div className="text-right">
                              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Hiệu suất</div>
                              <div className={`text-xl font-bold ${perf.efficiency >= 1 ? 'text-emerald-600' : 'text-blue-600'}`}>{formatPercent(perf.efficiency)}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Dư chuyển sau</div>
                              <div className="text-xl font-bold text-orange-500">{formatNumber(perf.surplus)}</div>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="text-[9px] font-bold text-gray-400 uppercase mb-1">Dư từ tháng trước</div>
                            <div className="font-mono font-bold text-emerald-600">{formatNumber(perf.carryOverUsed)}</div>
                          </div>
                          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="text-[9px] font-bold text-gray-400 uppercase mb-1">Thực hiện trong tháng</div>
                            <div className="font-mono font-bold text-blue-600">{formatNumber(perf.contribution - perf.carryOverUsed)}</div>
                          </div>
                          <div className="md:col-span-2 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                            <div className="text-[9px] font-bold text-indigo-400 uppercase mb-1">Tổng đóng góp tính lương</div>
                            <div className="font-mono font-bold text-indigo-700">{formatNumber(perf.contribution)}</div>
                          </div>
                        </div>

                        {staffAllocations.length > 0 ? (
                          <div className="overflow-hidden rounded-xl border border-gray-100 bg-gray-50/30">
                            <table className="min-w-full divide-y text-[11px]">
                              <thead className="bg-gray-100/50 text-gray-500 font-bold uppercase">
                                <tr>
                                  <th className="px-4 py-2 text-left">Dự án</th>
                                  <th className="px-4 py-2 text-left">Vai trò</th>
                                  <th className="px-4 py-2 text-right">LNG đóng góp</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100 bg-white/50">
                                {staffAllocations.map((alloc, idx) => {
                                  const project = projects.find(pr => pr.id === alloc.projectId);
                                  return (
                                    <tr key={idx}>
                                      <td className="px-4 py-2">
                                        <div className="font-bold text-gray-700">{project?.name}</div>
                                        <div className="text-[9px] text-gray-400">{project?.code}</div>
                                      </td>
                                      <td className="px-4 py-2 text-gray-500 font-medium">{alloc.roleName}</td>
                                      <td className="px-4 py-2 text-right font-mono font-bold text-blue-600">{formatNumber(alloc.contributionMoney)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="text-center py-4 bg-gray-50 rounded-xl text-xs text-gray-400 italic">Không có dự án tham gia trong tháng</div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </SectionCard>
          </div>
        )}

        {activeTab === 'projects' && (
          <div className="animate-fadeIn">
            <div>
              <SectionCard title={`DANH SÁCH DỰ ÁN (${mode})`} action={
                <div className="flex gap-2">
                  <CopyButton />
                  {mode === 'YEAR' && (
                    <button type="button" onClick={handleSummarizeMonths} className="bg-orange-500 text-white text-xs px-4 py-2 rounded font-bold shadow-md hover:bg-orange-600 transition-colors">
                      TỔNG HỢP TỪ 12 THÁNG
                    </button>
                  )}
                  {mode === 'QUARTER' && (
                    <button type="button" onClick={handleSummarizeQuarter} className="bg-orange-500 text-white text-xs px-4 py-2 rounded font-bold shadow-md hover:bg-orange-600 transition-colors">
                      TỔNG HỢP TỪ 3 THÁNG
                    </button>
                  )}
                  <button
                    onClick={handleAddProject}
                    className="bg-[#004d40] hover:bg-[#003d33] text-white px-4 py-2 rounded text-xs font-bold flex items-center gap-2 shadow-sm transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                    THÊM DỰ ÁN
                  </button>
                </div>
              }>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left">Mã/Tên Dự án</th>
                        <th className="px-4 py-2 text-center">Loại</th>
                        <th className="px-4 py-2 text-right">Doanh thu</th>
                        <th className="px-4 py-2 text-right">Giá vốn</th>
                        <th className="px-4 py-2 text-right">Thuê ngoài (Q1)</th>
                        <th className="px-4 py-2 text-right font-bold text-emerald-700">LNG</th>
                        <th className="px-4 py-2 text-left">Kinh doanh</th>
                        <th className="px-4 py-2 text-left">Kỹ thuật</th>
                        <th className="px-4 py-2 text-center">Tác vụ</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {projects.map(p => {
                        const pType: ProjectType = p.projectType ?? 'SERVICE';
                        const lngProject = p.revenue - p.directCost;
                        let svcRatioDisplay = pType === 'SERVICE' ? 1 : pType === 'COMMERCIAL' ? 0
                          : (p.serviceRevenue != null && p.revenue > 0 ? Math.min(1, p.serviceRevenue / p.revenue)
                            : Math.min(1, Math.max(0, p.serviceRevenueRatio ?? 0)));
                        const lngSvc = Math.max(0, p.revenue * svcRatioDisplay - (p.outsourcingCost || 0)); // Q1-2026 Logic
                        return (
                          <tr key={p.id} className="border-b">
                            <td className="px-4 py-2 min-w-[150px]">
                              <input type="text" value={p.code} onChange={(e) => handleUpdateProject(p.id, 'code', e.target.value)} className="w-full p-1 text-xs border rounded mb-1 focus:ring-1 focus:ring-indigo-500 outline-none" />
                              <input type="text" value={p.name} onChange={(e) => handleUpdateProject(p.id, 'name', e.target.value)} className="w-full p-1 border rounded font-medium focus:ring-1 focus:ring-indigo-500 outline-none text-xs" />
                            </td>
                            <td className="px-4 py-2">
                              <select
                                value={pType}
                                onChange={(e) => handleUpdateProject(p.id, 'projectType', e.target.value as ProjectType)}
                                className="w-full p-1 border rounded text-[9px] font-semibold outline-none transition-colors border-gray-100 bg-gray-50"
                              >
                                <option value="SERVICE">Dịch vụ</option>
                                <option value="COMMERCIAL">Thương mại</option>
                                <option value="MIXED">Hỗn hợp</option>
                              </select>
                            </td>
                             <td className="px-4 py-2">
                               <NumericInput value={p.revenue} onChange={(v) => handleUpdateProject(p.id, 'revenue', v)} className="w-full p-1.5 border rounded font-mono text-xs text-right bg-white focus:ring-1 focus:ring-emerald-500" />
                             </td>
                             <td className="px-4 py-2">
                               <NumericInput value={p.directCost} onChange={(v) => handleUpdateProject(p.id, 'directCost', v)} className="w-full p-1.5 border rounded font-mono text-xs text-right bg-white focus:ring-1 focus:ring-emerald-500" />
                             </td>
                             <td className="px-4 py-2">
                               <NumericInput value={p.outsourcingCost || 0} onChange={(v) => handleUpdateProject(p.id, 'outsourcingCost', v)} className="w-full p-1.5 border rounded font-mono text-xs text-right bg-white focus:ring-1 focus:ring-orange-500" />
                             </td>
                             <td className="px-4 py-2 text-right">
                               <div className="font-mono font-bold text-emerald-700 text-xs">{formatNumber(lngProject)}</div>
                               <div className="text-[9px] text-blue-500 mt-1">LNG DV: {formatNumber(lngSvc)}</div>
                             </td>
                             <td className="px-3 py-2">
                               <div className="space-y-1 max-h-[100px] overflow-y-auto pr-1">
                                   {staff.filter(s => isKhoanType(s.type) && s.type !== 'DEPUTY_DIRECTOR').map(s => {
                                     const isAssigned = matrix.some(m => m.projectId === p.id && m.staffId === s.id && m.roleName === 'Kinh doanh');
                                   return (
                                     <label key={s.id} className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-50 p-0.5 rounded transition-colors group">
                                       <input
                                         type="checkbox"
                                         checked={isAssigned}
                                         onChange={(e) => {
                                           handleMatrixToggle(p.id, s.id, 'Kinh doanh', e.target.checked);
                                         }}
                                         className="w-3 h-3 rounded text-orange-600 focus:ring-orange-500"
                                       />
                                       <span className={`text-[10px] whitespace-nowrap ${isAssigned ? 'font-bold text-orange-700' : 'text-gray-500'}`}>{s.name}</span>
                                     </label>
                                   );
                                 })}
                               </div>
                             </td>
                             <td className="px-3 py-2">
                               <div className="space-y-1 max-h-[100px] overflow-y-auto pr-1">
                                 {staff.filter(s => !isKhoanType(s.type) && s.type !== 'DIRECTOR' && s.type !== 'DEPT_HEAD' && s.type !== 'DEPUTY_DIRECTOR').map(s => {
                                   const isAssigned = matrix.some(m => m.projectId === p.id && m.staffId === s.id && m.roleName === 'Kỹ thuật');
                                   return (
                                     <label key={s.id} className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-50 p-0.5 rounded transition-colors group">
                                       <input
                                         type="checkbox"
                                         checked={isAssigned}
                                         onChange={(e) => {
                                           handleMatrixToggle(p.id, s.id, 'Kỹ thuật', e.target.checked);
                                         }}
                                         className="w-3 h-3 rounded text-blue-600 focus:ring-blue-500"
                                       />
                                       <span className={`text-[10px] whitespace-nowrap ${isAssigned ? 'font-bold text-blue-700' : 'text-gray-500'}`}>{s.name}</span>
                                     </label>
                                   );
                                 })}
                               </div>
                             </td>
                            <td className="px-4 py-2 text-center">
                              <button type="button" onClick={(e) => handleDeleteProject(e, p.id)} className="bg-red-50 text-red-600 hover:bg-red-600 hover:text-white p-1.5 rounded transition-all text-sm">×</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </SectionCard>


            </div>
            <HelpBox title="Quản lý dự án & Nhân sự">
              <p>• <strong>Kinh doanh:</strong> Chọn những nhân sự được hưởng hoa hồng từ dự án này. LNG dự án sẽ được chia đều cho các Sale trước khi nhân tỷ lệ hoa hồng riêng.</p>
              <p>• <strong>Kỹ thuật:</strong> Chọn những kỹ thuật viên trực tiếp thực hiện dự án. Phần LNG dịch vụ sẽ được chia đều cho những người này.</p>
              <p>• <strong>Thuê ngoài (Q1-2026):</strong> Chi phí thuê nhân sự bên ngoài để thực hiện dự án. Số tiền này sẽ dùng để giảm trừ trực tiếp vào Doanh thu dịch vụ khi tính Lợi nhuận gộp dịch vụ.</p>
              <p>• <strong>Loại dự án:</strong> Ảnh hưởng đến phần LNG được tính vào KPI Kỹ thuật (Dịch vụ: 100%, Thương mại: 0%, Hỗn hợp: theo tỷ lệ cấu hình hoặc nhập tay).</p>
            </HelpBox>
          </div>
        )}

        {activeTab === 'kpi_positions' && (
          <div className="animate-fadeIn space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <SectionCard title="DANH MỤC CHỨC VỤ / VỊ TRÍ" action={
                <button type="button" onClick={handleAddPosition} className="bg-[#004d40] text-white text-xs px-4 py-2 rounded font-bold shadow-md hover:bg-[#003d33] transition-colors">+ THÊM VỊ TRÍ</button>
              }>
                <div className="grid grid-cols-1 gap-4">
                  {positions.map((pos) => (
                    <div key={pos.id} className="flex flex-col gap-2 p-3 border rounded-xl bg-gray-50 border-gray-100 shadow-sm">
                      <div className="flex justify-between items-center bg-white p-2 border rounded-lg">
                        <input
                          type="text"
                          value={pos.name}
                          onChange={(e) => handleUpdatePosition(pos.id, 'name', e.target.value)}
                          className="flex-1 p-1 text-sm font-bold border-none outline-none"
                          placeholder="Tên chức danh"
                        />
                        <button type="button" onClick={() => handleDeletePosition(pos.id)} className="text-red-400 hover:text-red-700 font-bold px-2 text-xl">×</button>
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="text-[10px] text-gray-400 font-bold uppercase shrink-0">Logic KPI:</label>
                        <select
                          value={pos.logicType}
                          onChange={(e) => handleUpdatePosition(pos.id, 'logicType', e.target.value as LogicType)}
                          className="flex-1 p-1.5 text-[11px] border rounded bg-white font-semibold outline-none focus:ring-1 focus:ring-emerald-500"
                        >
                          <option value="KPI">⚙️ KPI cá nhân (LNG DV)</option>
                          <option value="KY_THUAT">💻 Kỹ thuật (LNG DV)</option>
                          <option value="KHOAN_INBOUND">📥 Khoán Inbound (% fix)</option>
                          <option value="KHOAN_OUTBOUND">🚀 Khoán Outbound (Min-Max)</option>
                          <option value="DIRECTOR">💎 Giám đốc (100% Tổng LNG)</option>
                          <option value="DEPUTY_DIRECTOR">🌟 Phó Giám đốc (100% LNG DV)</option>
                          <option value="DEPT_HEAD">📁 Trưởng phòng (Tổng NV)</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="THIẾT LẬP CHỈ TIÊU KPI" action={<CopyButton />}>
                <div className="overflow-hidden rounded-xl border border-gray-100">
                  <table className="min-w-full divide-y text-sm">
                    <thead className="bg-[#f0f4f4] text-[10px] font-bold text-[#004d40] uppercase">
                      <tr>
                        <th className="px-4 py-3 text-left">Nhân viên / Chức vụ</th>
                        <th className="px-4 py-3 text-right">KPI Mục Tiêu</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-50">
                      {staff.map(s => {
                        const position = positions.find(p => p.id === s.positionId);
                        const isKpiType = !isKhoanType(s.type);
                        if (!isKpiType) return null;
                        return (
                          <tr key={s.id}>
                            <td className="px-4 py-3">
                              <div className="font-bold text-gray-800">{s.name}</div>
                              <div className="text-[10px] text-gray-400 uppercase">{position?.name || 'Chưa gán'}</div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <NumericInput
                                value={s.manualKpiTarget ?? 0}
                                onChange={(v) => handleUpdateStaff(s.id, 'manualKpiTarget', v)}
                                className="w-full p-2 border rounded font-bold text-blue-700 bg-blue-50/50 text-right font-mono"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

              </SectionCard>
            </div>
          </div>
        )}

        {activeTab === 'staff' && (
          <div className="animate-fadeIn">
            <SectionCard title="DANH SÁCH NHÂN SỰ" action={
              <div className="flex gap-2">
                <CopyButton />
                <button type="button" onClick={handleAddStaff} className="bg-[#004d40] text-white text-xs px-4 py-2 rounded font-bold shadow-md hover:bg-[#003d33] transition-colors">+ THÊM MỚI</button>
              </div>
            }>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-[#f0f4f4] text-[10px] font-bold text-[#004d40] uppercase tracking-widest">
                    <tr>
                      <th className="px-4 py-3 text-left">Tên nhân sự</th>
                      <th className="px-4 py-3 text-left">Chức vụ / Vị trí</th>
                      <th className="px-4 py-3 text-right">Lương HQ (Đàm phán)</th>
                      <th className="px-4 py-3 text-right">Hoa hồng (%)</th>
                      <th className="px-4 py-3 text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {staff.map(s => {
                      const position = positions.find(p => p.id === s.positionId);
                      return (
                      <tr key={s.id} className={`border-b transition-colors ${changedStaffIds.has(s.id) ? 'bg-red-50' : ''}`}>
                        <td className="px-4 py-3">
                          <input type="text" value={s.name} onChange={(e) => handleUpdateStaff(s.id, 'name', e.target.value)} className="w-full p-2 border rounded focus:ring-1 focus:ring-[#004d40] outline-none font-bold" />
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={s.positionId || ''}
                            onChange={(e) => handleUpdateStaff(s.id, 'positionId', e.target.value || undefined)}
                            className="p-2 border rounded text-xs font-bold w-full"
                          >
                            <option value="">- Chọn chức vụ -</option>
                            {positions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {!isKhoanType(s.type) ? (
                            <NumericInput value={s.salaryHQ} onChange={(v) => handleUpdateStaff(s.id, 'salaryHQ', v)} className="w-32 p-2 border rounded font-mono text-emerald-700 font-bold ml-auto" />
                          ) : <span className="text-gray-300">-</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isKhoanType(s.type) ? (
                            <div className="flex justify-end gap-2">
                              {s.type === 'KHOAN_OUTBOUND' ? (
                                <>
                                  <input type="number" value={Math.round((s.outboundMinRate ?? 0.2)*100)} onChange={(e) => handleUpdateStaff(s.id, 'outboundMinRate', Number(e.target.value)/100)} className="w-12 p-1 border rounded text-xs" title="Min" />
                                  <span className="text-gray-400">-</span>
                                  <input type="number" value={Math.round((s.outboundMaxRate ?? 0.4)*100)} onChange={(e) => handleUpdateStaff(s.id, 'outboundMaxRate', Number(e.target.value)/100)} className="w-12 p-1 border rounded text-xs" title="Max" />
                                </>
                              ) : (
                                <input type="number" value={Math.round((s.khoanRate || 0)*100)} onChange={(e) => handleUpdateStaff(s.id, 'khoanRate', Number(e.target.value)/100)} className="w-16 p-2 border rounded text-right font-mono" />
                              )}
                            </div>
                          ) : <span className="text-gray-300">-</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button type="button" onClick={(e) => handleDeleteStaff(e, s.id)} className="bg-red-50 text-red-500 hover:bg-red-500 hover:text-white px-3 py-1.5 rounded transition-all">XÓA</button>
                        </td>
                      </tr>
                    );})}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            <SectionCard title="CƠ CHẾ TÍNH HIỆU QUẢ (KPI TIERS)" action={
              <button type="button" onClick={handleAddKpiTier} className="bg-emerald-600 text-white text-xs px-4 py-2 rounded font-bold shadow-md hover:bg-emerald-700 transition-colors">+ THÊM MỨC</button>
            }>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2">
                  <div>Mức Hiệu suất (&gt;= %)</div>
                  <div>Tỷ lệ nhận lương (%)</div>
                </div>
                <div className="space-y-2">
                  {kpiTiers.sort((a, b) => a.minEfficiency - b.minEfficiency).map((tier) => (
                    <div key={tier.id} className="flex items-center gap-3 p-2 bg-white border rounded-xl shadow-sm hover:border-emerald-200 transition-all group">
                      <div className="flex-1">
                        <input
                          type="number"
                          value={Math.round(tier.minEfficiency * 100)}
                          onChange={(e) => handleUpdateKpiTier(tier.id, 'minEfficiency', Number(e.target.value) / 100)}
                          className="w-full p-1.5 text-sm font-mono font-bold text-gray-700 border-none focus:ring-0 outline-none"
                        />
                      </div>
                      <div className="w-px h-8 bg-gray-100"></div>
                      <div className="flex-1">
                        <input
                          type="number"
                          value={Math.round(tier.salaryRate * 100)}
                          onChange={(e) => handleUpdateKpiTier(tier.id, 'salaryRate', Number(e.target.value) / 100)}
                          className="w-full p-1.5 text-sm font-mono font-bold text-emerald-600 border-none focus:ring-0 outline-none"
                        />
                      </div>
                      <button 
                        type="button" 
                        onClick={() => handleDeleteKpiTier(tier.id)} 
                        className="text-gray-300 hover:text-red-500 font-bold px-2 text-xl opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <p className="text-[10px] text-blue-700 leading-relaxed italic">
                    * Hệ thống sẽ tự động áp dụng tỷ lệ nhận lương cao nhất mà nhân sự đạt được.
                  </p>
                </div>
              </div>
            </SectionCard>
            <HelpBox title="Quản lý nhân sự">
              <p>• <strong>Lương HQ:</strong> Mức lương mục tiêu nhân viên nhận được khi hoàn thành 100% KPI (áp dụng cho các khối KPI).</p>
              <p>• <strong>Hoa hồng:</strong> Áp dụng cho nhân sự khối Khoán. Outbound sẽ dao động theo tỷ lệ lợi nhuận dự án.</p>
              <p>• <strong>Lưu ý:</strong> Vị trí công việc sẽ quyết định logic tính lương và KPI. Cấu hình vị trí tại tab <strong>Vị trí & KPI</strong>.</p>
            </HelpBox>
          </div>
        )}


      </main>
    </div>
  );
};

export default App;
