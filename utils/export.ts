
import { CalculationResult, FinancialParams, CalculationMode, Staff, Project } from '../types';

declare const XLSX: any;

// Định nghĩa các kiểu style chung
const BORDER_STYLE = {
  top: { style: "thin" },
  bottom: { style: "thin" },
  left: { style: "thin" },
  right: { style: "thin" }
};

const HEADER_STYLE = {
  font: { bold: true, name: "Arial", sz: 11 },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  fill: { fgColor: { rgb: "D9D9D9" } },
  border: BORDER_STYLE
};

const BODY_STYLE = {
  font: { name: "Arial", sz: 10 },
  border: BORDER_STYLE,
  alignment: { vertical: "center" }
};

const TITLE_STYLE = {
  font: { bold: true, sz: 14, name: "Arial" },
  alignment: { horizontal: "center", vertical: "center" }
};

const SIGN_STYLE = {
  font: { italic: true, sz: 10, name: "Arial" },
  alignment: { horizontal: "center" }
};

/**
 * Hàm tạo ô Excel có style
 */
const createCell = (val: any, style: any = BODY_STYLE, format: string = "") => {
  const cell: any = { v: val, s: style };
  if (typeof val === 'number') {
    cell.t = 'n';
    cell.z = format || '#,##0';
  } else {
    cell.t = 's';
  }
  return cell;
};

/**
 * Hàm tạo khu vực ký tên linh hoạt theo số cột
 */
const addSignatures = (rows: any[], lastCol: number = 7) => {
  rows.push([], []);
  const dateStr = `.........., ngày .... tháng .... năm ....`;

  // Dòng ngày tháng
  const dateRow = new Array(lastCol + 1).fill(null);
  dateRow[lastCol] = createCell(dateStr, { alignment: { horizontal: "center" } });
  rows.push(dateRow);

  // Dòng chức danh
  const labelRow = new Array(lastCol + 1).fill(null);
  const mid = Math.floor(lastCol / 2);
  labelRow[0] = createCell("LẬP BIỂU", { font: { bold: true }, alignment: { horizontal: "center" } });
  if (lastCol > 2) {
    labelRow[mid] = createCell("KẾ TOÁN TRƯỞNG", { font: { bold: true }, alignment: { horizontal: "center" } });
  }
  labelRow[lastCol] = createCell("GIÁM ĐỐC", { font: { bold: true }, alignment: { horizontal: "center" } });
  rows.push(labelRow);

  // Dòng hướng dẫn ký
  const signRow = new Array(lastCol + 1).fill(null);
  signRow[0] = createCell("(Ký, họ tên)", SIGN_STYLE);
  if (lastCol > 2) {
    signRow[mid] = createCell("(Ký, họ tên)", SIGN_STYLE);
  }
  signRow[lastCol] = createCell("(Ký, họ tên, đóng dấu)", SIGN_STYLE);
  rows.push(signRow);

  // Thêm khoảng trống cuối để chữ ký không bị sát mép trang
  rows.push([], [], []);
};

export const exportPayrollToExcel = (
  results: CalculationResult,
  finance: FinancialParams,
  staffList: Staff[],
  projectList: Project[],
  year: number,
  month: number,
  quarter: number,
  mode: CalculationMode
) => {
  const timeStr = mode === 'YEAR' ? `NĂM ${year}` : (mode === 'QUARTER' ? `QUÝ ${quarter} NĂM ${year}` : `THÁNG ${month}/${year}`);
  const fileName = `Hapro_Payroll_${mode === 'YEAR' ? year : (mode === 'QUARTER' ? `Q${quarter}_${year}` : `M${month}_${year}`)}.xlsx`;

  const wb = XLSX.utils.book_new();

  // --- SHEET 1: BẢNG QUYẾT TOÁN LƯƠNG ---
  const wsRows: any[] = [];
  wsRows.push([createCell(finance.companyName.toUpperCase(), { font: { bold: true, name: "Arial" } })]);
  wsRows.push([createCell("BẢNG QUYẾT TOÁN LƯƠNG HIỆU QUẢ THEO KPI & KHOÁN", TITLE_STYLE)]);
  wsRows.push([createCell(`Kỳ báo cáo: ${timeStr}`, { font: { italic: true, name: "Arial" }, alignment: { horizontal: "center" } })]);
  wsRows.push([]);

  // Cấu trúc cột mới đồng bộ với UI
  const tableHeaders = ["STT", "Họ và Tên", "Loại KPI", "KPI Mục tiêu", "Hoàn thành", "Hiệu suất (%)", "Tỷ lệ hưởng", "Thưởng", "Lương HQ thực tế"];
  wsRows.push(tableHeaders.map(h => createCell(h, HEADER_STYLE)));

  const sortedPerformance = [...results.staffPerformance].sort((a, b) => {
    if (a.type === 'DIRECTOR' && b.type !== 'DIRECTOR') return -1;
    if (a.type !== 'DIRECTOR' && b.type === 'DIRECTOR') return 1;
    return b.realHQSalary - a.realHQSalary;
  });

  sortedPerformance.forEach((p, index) => {
    wsRows.push([
      createCell(index + 1, { ...BODY_STYLE, alignment: { horizontal: "center" } }),
      createCell(p.name, BODY_STYLE),
      createCell(p.type === 'KPI' ? 'KPI CÁ NHÂN' : p.type === 'DIRECTOR' ? 'KPI CÔNG TY' : p.type === 'DEPUTY_DIRECTOR' ? 'KPI DỊCH VỤ' : p.type === 'DEPT_HEAD' ? 'KPI PHÒNG' : 'KHOÁN', { ...BODY_STYLE, alignment: { horizontal: "center" } }),
      createCell(p.type === 'KHOAN' ? '-' : p.kpiTarget, BODY_STYLE),
      createCell(p.contribution, BODY_STYLE),
      createCell(p.type === 'KHOAN' ? '-' : (p.efficiency * 100).toFixed(1) + "%", { ...BODY_STYLE, alignment: { horizontal: "right" } }),
      createCell(p.type === 'KHOAN' ? '100%' : (p.receivingRate * 100).toFixed(0) + "%", { ...BODY_STYLE, alignment: { horizontal: "center" } }),
      createCell(p.bonus || 0, BODY_STYLE),
      createCell(p.realHQSalary + (p.bonus || 0), { ...BODY_STYLE, font: { bold: true } })
    ]);
  });

  const totals = [
    createCell("TỔNG CỘNG", { ...HEADER_STYLE, alignment: { horizontal: "right" } }),
    createCell("", HEADER_STYLE),
    createCell("", HEADER_STYLE),
    createCell(results.staffPerformance.filter(p => p.type === 'KPI').reduce((s, p) => s + p.kpiTarget, 0), HEADER_STYLE),
    createCell(results.staffPerformance.reduce((s, p) => s + p.contribution, 0), HEADER_STYLE),
    createCell("", HEADER_STYLE),
    createCell("", HEADER_STYLE),
    createCell(results.staffPerformance.reduce((s, p) => s + p.bonus, 0), HEADER_STYLE),
    createCell(results.staffPerformance.reduce((s, p) => s + (p.realHQSalary + p.bonus), 0), HEADER_STYLE)
  ];
  wsRows.push(totals);

  addSignatures(wsRows, 9); // Sheet có 10 cột (0-9)

  const ws = XLSX.utils.aoa_to_sheet(wsRows);
  // Điều chỉnh chiều rộng các cột
  ws['!cols'] = [{ wch: 5 }, { wch: 25 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 18 }];
  ws['!merges'] = [
    { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 8 } },
    { s: { r: 5 + results.staffPerformance.length, c: 0 }, e: { r: 5 + results.staffPerformance.length, c: 2 } }
  ];
  // Append will be done at the end in correct order
  // XLSX.utils.book_append_sheet(wb, ws, "Bang Luong HQ & Khoan");


  // --- SHEET 2: TÓM TẮT QUẢN TRỊ TÀI CHÍNH ---
  const wsFinRows: any[] = [];
  wsFinRows.push([createCell(finance.companyName.toUpperCase(), { font: { bold: true, name: "Arial" } })]);
  wsFinRows.push([createCell("BÁO CÁO TÓM TẮT QUẢN TRỊ TÀI CHÍNH", TITLE_STYLE)]);
  wsFinRows.push([createCell(`Kỳ báo cáo: ${timeStr}`, { font: { italic: true, name: "Arial" }, alignment: { horizontal: "center" } })]);
  wsFinRows.push([]);

  const finSummaryData: [string, number][] = [
    ["1. Tổng Lợi Nhuận Gộp (LNG) từ các dự án", results.financeSummary.totalLNG],
    ["2. Chi phí cố định (FC) quản lý doanh nghiệp", results.financeSummary.fc],
    ["3. Tổng quỹ lương hiệu quả thực tế chi trả (+ Khoán)", results.financeSummary.totalHQSalaryReal],
    ["4. LỢI NHUẬN RÒNG (TRƯỚC THƯỞNG)", results.financeSummary.profitBeforeBonus],
    ["5. Quỹ thưởng phân bổ (dành cho KPI)", results.financeSummary.totalBonusFund],
    ["6. Lợi nhuận còn lại", results.financeSummary.profitBeforeTax]
  ];

  wsFinRows.push([
    createCell("CHỈ TIÊU TÀI CHÍNH", HEADER_STYLE),
    createCell("GIÁ TRỊ (VNĐ)", HEADER_STYLE)
  ]);

  finSummaryData.forEach(item => {
    const isMain = item[0].includes("Lợi nhuận còn lại") || item[0].includes("LỢI NHUẬN RÒNG");
    wsFinRows.push([
      createCell(item[0], { ...BODY_STYLE, font: { bold: isMain } }),
      createCell(item[1], { ...BODY_STYLE, font: { bold: isMain }, alignment: { horizontal: "right" } })
    ]);
  });

  addSignatures(wsFinRows, 1); // Sheet có 2 cột (0-1)

  const wsFin = XLSX.utils.aoa_to_sheet(wsFinRows);
  wsFin['!cols'] = [{ wch: 50 }, { wch: 25 }];
  wsFin['!merges'] = [
    { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 1 } }
  ];
  // Append will be done at the end in correct order
  // XLSX.utils.book_append_sheet(wb, wsFin, "Quan tri Tai chinh");


  // --- SHEET 3: PHỤ LỤC CHI TIẾT DỰ ÁN ---
  const wsAppRows: any[] = [];
  wsAppRows.push([createCell(finance.companyName.toUpperCase(), { font: { bold: true, name: "Arial" } })]);
  wsAppRows.push([createCell("PHỤ LỤC CHI TIẾT PHÂN BỔ ĐÓNG GÓP DỰ ÁN", TITLE_STYLE)]);
  wsAppRows.push([createCell(`Kỳ báo cáo: ${timeStr}`, { font: { italic: true, name: "Arial" }, alignment: { horizontal: "center" } })]);
  wsAppRows.push([]);

  const appHeaders = ["STT", "Nhân viên", "Mã dự án", "Tên dự án", "Vai trò", "Trọng số", "Đóng góp chi tiết"];
  wsAppRows.push(appHeaders.map(h => createCell(h, HEADER_STYLE)));

  // Sắp xếp tương tự Sheet 1 để đảm bảo thứ tự thống nhất (Giám đốc lên đầu)
  const sortedPerformanceForApp = sortedPerformance;

  let globalStt = 1;
  sortedPerformanceForApp.forEach(perf => {
    const staffAllocations = results.allocations.filter(a => a.staffId === perf.staffId);
    staffAllocations.forEach((alloc, idx) => {
      const project = projectList.find(p => p.id === alloc.projectId);
      wsAppRows.push([
        createCell(idx === 0 ? globalStt++ : "", { ...BODY_STYLE, alignment: { horizontal: "center" } }),
        createCell(idx === 0 ? perf.name : "", BODY_STYLE),
        createCell(project?.code || "", BODY_STYLE),
        createCell(project?.name || "", BODY_STYLE),
        createCell(alloc.roleName, BODY_STYLE),
        createCell(alloc.weight || (alloc.isKhoan ? "-" : 0), { ...BODY_STYLE, alignment: { horizontal: "center" } }),
        createCell(alloc.contributionMoney, BODY_STYLE)
      ]);
    });
    wsAppRows.push([
      createCell("", BODY_STYLE),
      createCell(`CỘNG: ${perf.name}`, { ...BODY_STYLE, font: { bold: true, italic: true } }),
      createCell("", BODY_STYLE),
      createCell("", BODY_STYLE),
      createCell("", BODY_STYLE),
      createCell("", BODY_STYLE),
      createCell(perf.contribution, { ...BODY_STYLE, font: { bold: true } })
    ]);
    wsAppRows.push([]);
  });

  addSignatures(wsAppRows, 6); // Sheet có 7 cột (0-6)

  const wsApp = XLSX.utils.aoa_to_sheet(wsAppRows);
  wsApp['!cols'] = [{ wch: 5 }, { wch: 25 }, { wch: 12 }, { wch: 35 }, { wch: 15 }, { wch: 10 }, { wch: 20 }];
  wsApp['!merges'] = [
    { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 6 } }
  ];
  XLSX.utils.book_append_sheet(wb, wsApp, "Phu luc Chi tiet");
  XLSX.utils.book_append_sheet(wb, ws, "Bang Luong HQ & Khoan");
  XLSX.utils.book_append_sheet(wb, wsFin, "Quan tri Tai chinh");

  XLSX.writeFile(wb, fileName);
};
