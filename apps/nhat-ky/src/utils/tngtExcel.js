import ExcelJS from "exceljs";
import {
  entryToTngtRow,
  formatMonthTitle,
  formatTngtKmLine
} from "./tngtFormat";
import { formatYearMonthVN } from "./nhatKyFormat";
import { TNGT_COLS, getTngtColWidths } from "../hooks/useTngtColWidths";

function thinBorder(color = "000000") {
  const side = { style: "thin", color: { argb: `FF${color}` } };
  return { top: side, left: side, bottom: side, right: side };
}

function font(opts = {}) {
  return { name: "Times New Roman", size: 11, ...opts };
}

function pxToExcelWidth(px) {
  return Math.max(3, Math.round(Number(px || 40) / 7));
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

/** Xuất Excel sổ TNGT — 14 cột theo mẫu in. */
export async function exportTngtExcel({
  yearMonth,
  reportMeta,
  entries,
  margins,
  widths
} = {}) {
  const list = Array.isArray(entries) ? entries : [];
  const wb = new ExcelJS.Workbook();
  wb.creator = "Nhat ky tuan duong";
  wb.created = new Date();

  const label = formatYearMonthVN(yearMonth) || yearMonth || "thang";
  const ws = wb.addWorksheet(
    String(label)
      .replace(/[\\/?*[\]:]/g, "-")
      .slice(0, 31) || "TNGT",
    { properties: { defaultRowHeight: 22 } }
  );

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

  const colW = widths || getTngtColWidths();
  ws.columns = TNGT_COLS.map((c) => ({
    width: pxToExcelWidth(colW[c.key] ?? c.defaultWidth)
  }));

  const title = ws.addRow([
    `TỔNG HỢP TAI NẠN GIAO THÔNG ĐƯỜNG BỘ ${formatMonthTitle(yearMonth)}`
  ]);
  ws.mergeCells(title.number, 1, title.number, 14);
  title.getCell(1).font = font({ size: 13, bold: true });
  title.getCell(1).alignment = {
    horizontal: "center",
    vertical: "middle",
    wrapText: true
  };
  title.height = 26;

  const km = formatTngtKmLine(reportMeta);
  if (km) {
    const kmLine = ws.addRow([km]);
    ws.mergeCells(kmLine.number, 1, kmLine.number, 14);
    kmLine.getCell(1).font = font({ size: 12, bold: true });
    kmLine.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
    kmLine.height = 20;
  }

  const h1 = ws.addRow([
    "TT",
    "Vị trí, Lý trình",
    "Ngày xảy ra tai nạn",
    "Phương tiện",
    "",
    "",
    "Nguyên nhân",
    "",
    "",
    "Thiệt hại",
    "",
    "",
    "",
    "Ghi chú"
  ]);
  const h2 = ws.addRow([
    "",
    "",
    "",
    "Ô tô",
    "Xe máy",
    "Xe đạp",
    "Do đường",
    "Do người",
    "Do phương tiện",
    "Số người",
    "",
    "Giá trị (triệu đồng)",
    "",
    ""
  ]);
  const h3 = ws.addRow([
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "Chết",
    "Bị thương",
    "Cầu đường",
    "Phương tiện",
    ""
  ]);

  ws.mergeCells(h1.number, 1, h3.number, 1);
  ws.mergeCells(h1.number, 2, h3.number, 2);
  ws.mergeCells(h1.number, 3, h3.number, 3);
  ws.mergeCells(h1.number, 4, h1.number, 6);
  ws.mergeCells(h1.number, 7, h1.number, 9);
  ws.mergeCells(h1.number, 10, h1.number, 13);
  ws.mergeCells(h1.number, 14, h3.number, 14);
  ws.mergeCells(h2.number, 4, h3.number, 4);
  ws.mergeCells(h2.number, 5, h3.number, 5);
  ws.mergeCells(h2.number, 6, h3.number, 6);
  ws.mergeCells(h2.number, 7, h3.number, 7);
  ws.mergeCells(h2.number, 8, h3.number, 8);
  ws.mergeCells(h2.number, 9, h3.number, 9);
  ws.mergeCells(h2.number, 10, h2.number, 11);
  ws.mergeCells(h2.number, 12, h2.number, 13);

  [h1, h2, h3].forEach((row) => {
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = font({ bold: true, size: 10 });
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = thinBorder();
    });
    row.height = 24;
  });

  const nums = ws.addRow(Array.from({ length: 14 }, (_, i) => `(${i + 1})`));
  nums.eachCell((cell) => {
    cell.font = font({ bold: true, size: 10, italic: true });
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = thinBorder();
  });
  nums.height = 18;

  list.forEach((entry, index) => {
    const r = entryToTngtRow(entry, index);
    const row = ws.addRow([
      r.tt,
      r.location,
      r.occurDate,
      r.vehicleAuto,
      r.vehicleMoto,
      r.vehicleBike,
      r.causeDuong,
      r.causeNguoi,
      r.causePhuongTien,
      r.dead,
      r.injured,
      r.damageRoad,
      r.damageVehicle,
      r.note
    ]);
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.font = font();
      cell.border = thinBorder();
      cell.alignment = {
        horizontal: col === 2 || col === 14 ? "left" : "center",
        vertical: "middle",
        wrapText: true
      };
    });
    row.height = 22;
  });

  const monthTag = String(yearMonth || "xuat").replace("-", "_");
  const roadTag = String(reportMeta?.roadName || "tuyen")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "_");
  const filename = `So_TNGT_${roadTag}_${monthTag}.xlsx`;
  const buffer = await wb.xlsx.writeBuffer();
  downloadBuffer(buffer, filename);
  return { filename };
}
