import ExcelJS from "exceljs";
import {
  entryToMatDuongRow,
  formatMatDuongKmLine,
  formatMatDuongMonthTitle
} from "./matDuongFormat";
import {
  MAT_DUONG_COLS,
  getMatDuongColWidths
} from "../hooks/useMatDuongColWidths";

const MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function border() {
  const side = { style: "thin", color: { argb: "FF000000" } };
  return { top: side, left: side, bottom: side, right: side };
}

function font(options = {}) {
  return { name: "Times New Roman", size: 11, ...options };
}

function styleCell(cell, options = {}) {
  cell.font = font(options.font);
  cell.alignment = {
    horizontal: options.horizontal || "center",
    vertical: "middle",
    wrapText: true
  };
  if (options.withBorder !== false) cell.border = border();
}

function download(buffer, filename) {
  const blob = new Blob([buffer], { type: MIME });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Xuất sổ mặt đường theo đúng 12 cột Phụ lục 09. */
export async function exportMatDuongExcel({
  entries = [],
  yearMonth,
  reportMeta = {},
  margins = { top: 8, right: 10, bottom: 8, left: 10 },
  widths
} = {}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Nhật ký tuần đường";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Sổ mặt đường", {
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: (Number(margins.left) || 10) / 25.4,
        right: (Number(margins.right) || 10) / 25.4,
        top: (Number(margins.top) || 8) / 25.4,
        bottom: (Number(margins.bottom) || 8) / 25.4,
        header: 0.1,
        footer: 0.1
      }
    },
    properties: { defaultRowHeight: 18 }
  });

  const colWidths = widths || getMatDuongColWidths();
  worksheet.columns = MAT_DUONG_COLS.map((col) => ({
    width: Math.max(5, Math.round((colWidths[col.key] || col.defaultWidth) / 7))
  }));

  worksheet.mergeCells("A1:F1");
  worksheet.mergeCells("G1:L1");
  worksheet.mergeCells("A2:F2");
  worksheet.mergeCells("G2:L2");
  worksheet.mergeCells("A3:F3");
  worksheet.getCell("A1").value = reportMeta.company || "";
  worksheet.getCell("G1").value = "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM";
  worksheet.getCell("A2").value = `Tên Hạt: ${reportMeta.hat || ""}`;
  worksheet.getCell("G2").value = "Độc lập - Tự do - Hạnh phúc";
  worksheet.getCell("A3").value = `Tên đường: ${reportMeta.roadName || ""}`;

  ["A1", "G1", "A2", "G2", "A3"].forEach((address) => {
    styleCell(worksheet.getCell(address), {
      font: { bold: true, size: 12 },
      withBorder: false
    });
  });
  worksheet.getCell("G2").font = font({ bold: true, size: 12, underline: true });

  worksheet.mergeCells("A4:L4");
  worksheet.getCell("A4").value =
    `ĐÁNH GIÁ TÌNH TRẠNG MẶT ĐƯỜNG ${formatMatDuongMonthTitle(yearMonth)}`;
  styleCell(worksheet.getCell("A4"), {
    font: { bold: true, size: 13 },
    withBorder: false
  });

  worksheet.mergeCells("A5:L5");
  worksheet.getCell("A5").value =
    formatMatDuongKmLine(reportMeta) || "Đoạn Km… - Km…";
  styleCell(worksheet.getCell("A5"), {
    font: { size: 12 },
    withBorder: false
  });

  const merges = [
    "A6:A7",
    "B6:C6",
    "D6:D7",
    "E6:F6",
    "G6:G7",
    "H6:H7",
    "I6:J6",
    "K6:K7",
    "L6:L7"
  ];
  merges.forEach((range) => worksheet.mergeCells(range));

  const topHeaders = [
    ["A6", "Ngày, tháng kiểm tra"],
    ["B6", "Vị trí, lý trình hư hỏng"],
    ["D6", "Phía"],
    ["E6", "Kích thước"],
    ["G6", "Diện tích hư hỏng (m²)"],
    ["H6", "Loại sự cố"],
    ["I6", "Đã giải quyết, xử lý và kết quả"],
    ["K6", "Người kiểm tra ký tên"],
    ["L6", "Ý kiến của tuần kiểm viên"],
    ["B7", "Điểm đầu"],
    ["C7", "Điểm cuối"],
    ["E7", "Dài (m)"],
    ["F7", "Rộng (m)"],
    ["I7", "Có"],
    ["J7", "Chưa"]
  ];
  topHeaders.forEach(([address, value]) => {
    worksheet.getCell(address).value = value;
  });
  for (let row = 6; row <= 7; row += 1) {
    for (let col = 1; col <= 12; col += 1) {
      styleCell(worksheet.getCell(row, col), { font: { bold: true } });
    }
  }
  worksheet.getRow(6).height = 42;
  worksheet.getRow(7).height = 25;

  const numberRow = worksheet.addRow(
    Array.from({ length: 12 }, (_, index) => `(${index + 1})`)
  );
  numberRow.eachCell((cell) =>
    styleCell(cell, { font: { bold: true, size: 10 } })
  );
  numberRow.height = 20;

  entries.forEach((entry) => {
    const rowData = entryToMatDuongRow(entry);
    if (entry?._matDuongMaintenanceSummary) {
      const row = worksheet.addRow([
        rowData.date,
        entry.maintenanceText || "",
        "",
        "",
        "",
        "",
        "",
        "",
        rowData.resolvedCo,
        rowData.resolvedChua,
        rowData.inspectorSign,
        rowData.inspectorNote
      ]);
      worksheet.mergeCells(row.number, 2, row.number, 8);
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        styleCell(cell, { horizontal: col === 2 || col === 12 ? "left" : "center" });
      });
      row.height = 30;
      return;
    }

    const row = worksheet.addRow([
      rowData.date,
      rowData.kmFrom,
      rowData.kmTo,
      rowData.side,
      rowData.length,
      rowData.width,
      rowData.area,
      rowData.damageLevel,
      rowData.resolvedCo,
      rowData.resolvedChua,
      rowData.inspectorSign,
      rowData.inspectorNote
    ]);
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      styleCell(cell, {
        horizontal: col === 8 || col === 12 ? "left" : "center"
      });
    });
    row.height = 22;
  });

  worksheet.views = [{ state: "frozen", ySplit: 8 }];
  worksheet.autoFilter = { from: "A8", to: "L8" };
  worksheet.pageSetup.printTitlesRow = "1:8";

  const buffer = await workbook.xlsx.writeBuffer();
  const monthTag = String(yearMonth || "xuat").replace("-", "_");
  const roadTag = String(reportMeta.roadName || "tuyen")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "_");
  const filename = `So_mat_duong_${roadTag}_${monthTag}.xlsx`;
  download(buffer, filename);
  return { filename };
}
