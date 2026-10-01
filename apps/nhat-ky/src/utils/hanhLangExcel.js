import ExcelJS from "exceljs";
import {
  entryToHanhLangRow,
  formatHanhLangKmLine,
  formatHanhLangMonthTitle
} from "./hanhLangFormat";
import { HANH_LANG_COLS, getHanhLangColWidths } from "../hooks/useHanhLangColWidths";

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

/** Xuất Excel sổ hành lang — 10 cột Phụ lục 05. */
export async function exportHanhLangExcel({
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

  const ws = wb.addWorksheet("Sổ hành lang", {
    properties: { defaultRowHeight: 22 }
  });

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

  const colW = widths || getHanhLangColWidths();
  ws.columns = HANH_LANG_COLS.map((c) => ({
    width: pxToExcelWidth(colW[c.key] ?? c.defaultWidth)
  }));

  ws.mergeCells("A1:E1");
  ws.mergeCells("F1:J1");
  ws.mergeCells("A2:E2");
  ws.mergeCells("F2:J2");
  ws.mergeCells("A3:E3");
  ws.getCell("A1").value = reportMeta?.company || "";
  ws.getCell("F1").value = "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM";
  ws.getCell("A2").value = `Tên Hạt: ${reportMeta?.hat || ""}`;
  ws.getCell("F2").value = "Độc lập - Tự do - Hạnh phúc";
  ws.getCell("A3").value = `Tên đường: ${reportMeta?.roadName || ""}`;
  ["A1", "F1", "A2", "F2", "A3"].forEach((addr) => {
    const cell = ws.getCell(addr);
    cell.font = font({ bold: true, size: 12 });
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });
  ws.getCell("F2").font = font({ bold: true, size: 12, underline: true });

  ws.mergeCells("A4:J4");
  ws.getCell("A4").value =
    `TỔNG HỢP VI PHẠM HÀNH LANG AN TOÀN GIAO THÔNG ${formatHanhLangMonthTitle(yearMonth)}`;
  ws.getCell("A4").font = font({ bold: true, size: 13 });
  ws.getCell("A4").alignment = { horizontal: "center", vertical: "middle" };

  ws.mergeCells("A5:J5");
  ws.getCell("A5").value = formatHanhLangKmLine(reportMeta) || "… đoạn Km… - Km…";
  ws.getCell("A5").font = font({ size: 12 });
  ws.getCell("A5").alignment = { horizontal: "center", vertical: "middle" };

  const headers = [
    "TT",
    "Người lập biên bản",
    "Tổ chức (Cá nhân) vi phạm",
    "Địa chỉ",
    "Lý trình",
    "Ngày lập biên bản",
    "Nội dung vi phạm",
    "Diện tích vi phạm (dài*rộng)",
    "Theo dõi nội dung xử lý vi phạm",
    "Ghi chú"
  ];
  const head = ws.addRow(headers);
  head.eachCell((cell) => {
    cell.font = font({ bold: true, size: 10 });
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = thinBorder();
  });
  head.height = 36;

  const nums = ws.addRow(Array.from({ length: 10 }, (_, i) => `(${i + 1})`));
  nums.eachCell((cell) => {
    cell.font = font({ bold: true, size: 10 });
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = thinBorder();
  });

  list.forEach((entry, index) => {
    const r = entryToHanhLangRow(entry, index);
    const row = ws.addRow([
      r.tt,
      r.recorder,
      r.violator,
      r.address,
      r.location,
      r.recordDate,
      r.content,
      r.area,
      r.process,
      r.note
    ]);
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.font = font();
      cell.border = thinBorder();
      cell.alignment = {
        horizontal: col === 1 || col === 6 || col === 8 ? "center" : "left",
        vertical: "middle",
        wrapText: true
      };
    });
    row.height = 24;
  });

  const total = ws.addRow(["TỔNG CỘNG", "", "", "", "", "", "", "", "", ""]);
  ws.mergeCells(total.number, 1, total.number, 2);
  total.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = font({ bold: true });
    cell.border = thinBorder();
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });

  const monthTag = String(yearMonth || "xuat").replace("-", "_");
  const roadTag = String(reportMeta?.roadName || "tuyen")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "_");
  const filename = `So_hanh_lang_${roadTag}_${monthTag}.xlsx`;
  const buffer = await wb.xlsx.writeBuffer();
  downloadBuffer(buffer, filename);
  return { filename };
}
