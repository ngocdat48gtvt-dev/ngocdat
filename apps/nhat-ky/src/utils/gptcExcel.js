import ExcelJS from "exceljs";
import { isPermitRowFilled, normalizeDetailColWidths, normalizeSummaryColWidths } from "./gptcSummaryGrid";
import { permitBm02Title } from "./gptcStore";
import { formatDisplayDate } from "./nhatKyFormat";

const SUMMARY_HEADERS = [
  "STT",
  "Giấy phép thi công",
  "Ngày nhận giấy phép",
  "Ngày bàn giao mặt bằng thi công",
  "Tên cơ quan, đơn vị được chấp thuận xây dựng",
  "Nội dung cấp phép thi công",
  "Ngày bắt đầu",
  "Ngày kết thúc",
  "Ghi chú"
];

const DETAIL_HEADERS = [
  "Ngày/ tháng/ năm",
  "Diễn biến trong quá trình thi công",
  "Xác nhận, ý kiến chỉ đạo của hạt trưởng",
  "Ý kiến chỉ đạo của tuần kiểm"
];

function thinBorder(color = "000000") {
  const side = { style: "thin", color: { argb: `FF${color}` } };
  return { top: side, left: side, bottom: side, right: side };
}

function font(opts = {}) {
  return { name: "Times New Roman", size: 12, ...opts };
}

function pxToExcelWidth(px) {
  return Math.max(4, Math.round(Number(px || 80) / 7));
}

function uniqueSheetName(wb, base) {
  let name = String(base || "Sheet")
    .replace(/[\\/?*[\]:]/g, "-")
    .slice(0, 31);
  if (!name) name = "Sheet";
  let n = 2;
  let candidate = name;
  while (wb.getWorksheet(candidate)) {
    candidate = `${name.slice(0, 28)}_${n++}`;
  }
  return candidate;
}

function formatCellDate(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
  return formatDisplayDate(s) || s;
}

function downloadBuffer(buffer, filename) {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

function applyPageSetup(ws, margins) {
  ws.pageSetup = {
    paperSize: 9,
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: {
      left: (Number(margins?.left) || 10) / 25.4,
      right: (Number(margins?.right) || 10) / 25.4,
      top: (Number(margins?.top) || 8) / 25.4,
      bottom: (Number(margins?.bottom) || 8) / 25.4,
      header: 0.2,
      footer: 0.2
    }
  };
}

function writeSummarySheet(wb, ledger, margins) {
  const ws = wb.addWorksheet(uniqueSheetName(wb, "BM01 Tong hop"), {
    properties: { defaultRowHeight: 22 }
  });
  applyPageSetup(ws, margins);

  const widths = normalizeSummaryColWidths(ledger?.summaryColWidths);
  ws.columns = widths.map((w) => ({ width: pxToExcelWidth(w) }));

  const titleRoad = ledger?.tenTuyen || "…………………………";
  const year = ledger?.year || "…………";
  const title = ws.addRow([
    `BẢNG TỔNG HỢP CÔNG TRÌNH ĐƯỢC CẤP PHÉP TUYẾN ${titleRoad} NĂM ${year}`
  ]);
  ws.mergeCells(title.number, 1, title.number, 9);
  title.getCell(1).font = font({ size: 13, bold: true });
  title.getCell(1).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  title.height = 28;

  const r1 = ws.addRow([
    "STT",
    "Giấy phép thi công",
    "Ngày nhận giấy phép",
    "Ngày bàn giao mặt bằng thi công",
    "Tên cơ quan, đơn vị được chấp thuận xây dựng",
    "Nội dung cấp phép thi công",
    "Thời hạn thi công",
    "",
    "Ghi chú"
  ]);
  const r2 = ws.addRow(["", "", "", "", "", "", "Ngày bắt đầu", "Ngày kết thúc", ""]);
  // Cột 1–6, 9: gộp 2 hàng; cột 7–8: gộp ngang «Thời hạn»
  [1, 2, 3, 4, 5, 6, 9].forEach((col) => {
    ws.mergeCells(r1.number, col, r2.number, col);
  });
  ws.mergeCells(r1.number, 7, r1.number, 8);
  for (let col = 1; col <= 9; col += 1) {
    [r1, r2].forEach((row) => {
      const c = row.getCell(col);
      c.font = font({ bold: true });
      c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      c.border = thinBorder();
    });
  }
  r1.height = 36;
  r2.height = 22;

  const nums = ws.addRow(SUMMARY_HEADERS.map((_, i) => `(${i + 1})`));
  nums.eachCell((c) => {
    c.font = font({ bold: true });
    c.alignment = { horizontal: "center", vertical: "middle" };
    c.border = thinBorder();
  });

  const permits = (ledger?.permits || []).filter(isPermitRowFilled);
  if (!permits.length) {
    const empty = ws.addRow(["Chưa có công trình cấp phép."]);
    ws.mergeCells(empty.number, 1, empty.number, 9);
    empty.getCell(1).font = font({ italic: true });
    empty.getCell(1).alignment = { horizontal: "center" };
  } else {
    permits.forEach((p) => {
      const row = ws.addRow([
        p.stt,
        p.tenCongTrinh || "",
        p.soNgayCapPhep || "",
        p.ngayBanGiao || "",
        p.donViDuocCap || "",
        p.noiDungCapPhep || "",
        p.ngayBatDau || "",
        p.ngayKetThuc || "",
        p.ghiChu || ""
      ]);
      row.eachCell((c, col) => {
        c.font = font();
        c.alignment = {
          horizontal: col === 1 ? "center" : "left",
          vertical: "top",
          wrapText: true
        };
        c.border = thinBorder();
      });
      row.height = 48;
    });
  }
}

function writeDetailSheet(wb, permit, ledger, margins) {
  const title = permitBm02Title(permit) || `CT ${permit.stt || ""}`;
  const ws = wb.addWorksheet(uniqueSheetName(wb, `BM02 ${permit.stt || ""}`), {
    properties: { defaultRowHeight: 36 }
  });
  applyPageSetup(ws, margins);

  const widths = normalizeDetailColWidths(ledger?.detailColWidths);
  ws.columns = widths.map((w) => ({ width: pxToExcelWidth(w) }));

  const h1 = ws.addRow([
    "BIỂU THEO DÕI DIỄN BIẾN TRONG QUÁ TRÌNH THI CÔNG CÔNG TRÌNH CẤP PHÉP"
  ]);
  ws.mergeCells(h1.number, 1, h1.number, 4);
  h1.getCell(1).font = font({ size: 13, bold: true });
  h1.getCell(1).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  h1.height = 28;

  const h2 = ws.addRow([title || "…………………………………………"]);
  ws.mergeCells(h2.number, 1, h2.number, 4);
  h2.getCell(1).font = font({ bold: true });
  h2.getCell(1).alignment = { horizontal: "left", vertical: "middle", wrapText: true };
  h2.height = 24;

  const head = ws.addRow(DETAIL_HEADERS);
  head.eachCell((c) => {
    c.font = font({ bold: true });
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border = thinBorder();
  });
  head.height = 36;

  const nums = ws.addRow(["(1)", "(2)", "(3)", "(4)"]);
  nums.eachCell((c) => {
    c.font = font({ bold: true });
    c.alignment = { horizontal: "center", vertical: "middle" };
    c.border = thinBorder();
  });

  const entries = permit.entries || [];
  const rows = entries.length ? entries : [null];
  rows.forEach((entry) => {
    const row = ws.addRow([
      formatCellDate(entry?.ngay),
      entry?.dienBien || "",
      entry?.yKienHatTruong || "",
      entry?.yKienTuanKiem || ""
    ]);
    row.eachCell((c, col) => {
      c.font = font();
      c.alignment = {
        horizontal: col === 1 ? "center" : "left",
        vertical: "top",
        wrapText: true
      };
      c.border = thinBorder();
    });
    row.height = 42;
  });
}

/**
 * Xuất Excel sổ cấp phép.
 * @param {object} ledger
 * @param {{ scope?: "summary"|"detail"|"all", margins?: object }} opts
 */
export async function exportGptcExcel(ledger, opts = {}) {
  const scope = opts.scope || "summary";
  const margins = opts.margins || { top: 8, right: 10, bottom: 8, left: 10 };
  if (!ledger) throw new Error("Chưa có dữ liệu sổ cấp phép.");

  const wb = new ExcelJS.Workbook();
  wb.creator = "Nhat ky tuan duong";
  wb.created = new Date();

  const wantSummary = scope === "summary" || scope === "all";
  const wantDetail = scope === "detail" || scope === "all";

  if (wantSummary) {
    writeSummarySheet(wb, ledger, margins);
  }

  if (wantDetail) {
    const permits = (ledger.permits || []).filter(isPermitRowFilled);
    if (!permits.length && !wantSummary) {
      throw new Error("Chưa có công trình / sổ chi tiết để xuất.");
    }
    permits.forEach((p) => writeDetailSheet(wb, p, ledger, margins));
  }

  const buffer = await wb.xlsx.writeBuffer();
  const road = String(ledger.tenTuyen || "tuyen")
    .replace(/[\\/?*[\]:]/g, "-")
    .slice(0, 40);
  const year = ledger.year || new Date().getFullYear();
  const tag =
    scope === "detail" ? "BM02_chi_tiet" : scope === "all" ? "BM01_BM02" : "BM01_tong_hop";
  const filename = `Cap_phep_thi_cong_${tag}_${road}_${year}.xlsx`;
  downloadBuffer(buffer, filename);
  return { filename };
}
