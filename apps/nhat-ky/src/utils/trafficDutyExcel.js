import ExcelJS from "exceljs";
import {
  entryToTrafficDutyRow,
  formatMonthTitle,
  formatTrafficDutyKmLine
} from "./trafficDutyFormat";
import { formatYearMonthVN } from "./nhatKyFormat";
import { TRAFFIC_DUTY_COLS, getTrafficDutyColWidths } from "../hooks/useTrafficDutyColWidths";
import { setExcelDecimalCell, setExcelKmCell } from "./excelCellFormat";

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

/**
 * Xuất Excel sổ trực ĐBGT.
 * Lý trình = số mét + format Km a+b; Dài/Rộng/Cao/KL = số + thập phân dấu phẩy.
 */
export async function exportTrafficDutyExcel({
  yearMonth,
  reportMeta,
  entries,
  dayMetaMap,
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
      .slice(0, 31) || "DBGT",
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

  const colW = widths || getTrafficDutyColWidths();
  ws.columns = TRAFFIC_DUTY_COLS.map((c) => ({
    width: pxToExcelWidth(colW[c.key] ?? c.defaultWidth)
  }));

  const title = ws.addRow([
    `TỔNG HỢP KHỐI LƯỢNG THIỆT HẠI BÃO LŨ ${formatMonthTitle(yearMonth)}`
  ]);
  ws.mergeCells(title.number, 1, title.number, 16);
  title.getCell(1).font = font({ size: 13, bold: true });
  title.getCell(1).alignment = {
    horizontal: "center",
    vertical: "middle",
    wrapText: true
  };
  title.height = 26;

  const kmLine = ws.addRow([formatTrafficDutyKmLine(reportMeta)]);
  ws.mergeCells(kmLine.number, 1, kmLine.number, 16);
  kmLine.getCell(1).font = font({ size: 12, bold: true });
  kmLine.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
  kmLine.height = 20;

  const h1 = ws.addRow([
    "Ngày trực",
    "Tình hình thời tiết",
    "Nội dung thiệt hại",
    "Lý trình",
    "",
    "Phía",
    "Kích thước",
    "",
    "",
    "Khối lượng",
    "Nguyên nhân",
    "Người trực",
    "Người nhận báo cáo",
    "Ý kiến chỉ đạo",
    "Thời gian thông xe",
    "Ghi chú"
  ]);
  const h2 = ws.addRow([
    "",
    "",
    "",
    "Điểm đầu",
    "Điểm cuối",
    "",
    "Dài",
    "Rộng",
    "Cao",
    "",
    "",
    "",
    "",
    "",
    "",
    ""
  ]);

  [1, 2, 3, 6, 10, 11, 12, 13, 14, 15, 16].forEach((col) => {
    ws.mergeCells(h1.number, col, h2.number, col);
  });
  ws.mergeCells(h1.number, 4, h1.number, 5);
  ws.mergeCells(h1.number, 7, h1.number, 9);

  for (let col = 1; col <= 16; col += 1) {
    [h1, h2].forEach((row) => {
      const c = row.getCell(col);
      c.font = font({ size: 10, bold: true });
      c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      c.border = thinBorder();
    });
  }
  h1.height = 28;
  h2.height = 18;

  if (!list.length) {
    const empty = ws.addRow(["Chưa có dòng thiệt hại bão lũ trong tháng."]);
    ws.mergeCells(empty.number, 1, empty.number, 16);
    empty.getCell(1).font = font({ italic: true, size: 10 });
    empty.getCell(1).alignment = { horizontal: "center" };
  } else {
    list.forEach((entry) => {
      const r = entryToTrafficDutyRow(entry, dayMetaMap, reportMeta);
      const row = ws.addRow([
        r.dutyDate,
        r.weather,
        r.damageContent,
        null,
        null,
        r.side,
        null,
        null,
        null,
        null,
        r.cause,
        r.dutyPerson,
        r.reportRecipient,
        r.directives,
        r.restoredAt,
        r.note
      ]);

      setExcelKmCell(row.getCell(4), entry.kmFrom);
      setExcelKmCell(row.getCell(5), entry.kmTo);
      setExcelDecimalCell(row.getCell(7), entry.length, { forceDecimals: true });
      setExcelDecimalCell(row.getCell(8), entry.width, { forceDecimals: true });
      setExcelDecimalCell(row.getCell(9), entry.height, { forceDecimals: true });
      setExcelDecimalCell(row.getCell(10), entry.quantity, { forceDecimals: true });

      row.eachCell((c, col) => {
        c.font = font({ size: 10 });
        c.border = thinBorder();
        const isKm = col === 4 || col === 5;
        const isDec = col >= 7 && col <= 10;
        c.alignment = {
          horizontal:
            isKm || isDec || col === 1 || col === 2 || col === 6 ? "center" : "left",
          vertical: "top",
          wrapText: true
        };
      });
      row.height = 28;
    });
  }

  const buffer = await wb.xlsx.writeBuffer();
  const road = String(reportMeta?.roadName || "tuyen")
    .replace(/[\\/?*[\]:]/g, "-")
    .slice(0, 30);
  const ym = String(yearMonth || "thang").replace(/[\\/?*[\]:]/g, "-");
  downloadBuffer(buffer, `So_truc_DBGT_${road}_${ym}.xlsx`);
  return { filename: `So_truc_DBGT_${road}_${ym}.xlsx` };
}
