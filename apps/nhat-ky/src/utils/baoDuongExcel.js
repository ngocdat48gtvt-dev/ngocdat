import ExcelJS from "exceljs";
import { formatDisplayDate } from "./nhatKyFormat";
import {
  entryToBaoDuongRow,
  groupBaoDuongEntriesByExecDay,
  computeBaoDuongPadRows,
  buildBaoDuongDisplayBlocks
} from "./baoDuongFormat";
import { BAO_DUONG_COLS, getBaoDuongColWidths } from "../hooks/useBaoDuongColWidths";

const TITLE =
  "GHI CHÉP KẾT QUẢ BẢO DƯỠNG THƯỜNG XUYÊN THEO CHẤT LƯỢNG THỰC HIỆN";

const HEADERS = [
  "Số thứ tự",
  "Công việc thực hiện",
  "Ghi lý trình, vị trí công việc được thực hiện",
  "Tóm tắt biện pháp thực hiện",
  "Kết quả chủ yếu"
];

const NUMS = ["(1)", "(2)", "(3)", "(4)", "(5)"];

function thinBorder(color = "000000") {
  const side = { style: "thin", color: { argb: `FF${color}` } };
  return { top: side, left: side, bottom: side, right: side };
}

function font(opts = {}) {
  return { name: "Times New Roman", size: 12, ...opts };
}

function periodLabel(periodFrom, periodTo) {
  if (periodFrom && periodTo && periodFrom !== periodTo) {
    return `${formatDisplayDate(periodFrom)} → ${formatDisplayDate(periodTo)}`;
  }
  return formatDisplayDate(periodFrom || periodTo) || "";
}

function sheetNameForDate(iso) {
  const d = formatDisplayDate(iso) || String(iso || "BDTX");
  return d.replace(/[\\/?*[\]:]/g, "-").slice(0, 31);
}

function uniqueSheetName(wb, base) {
  let name = base.slice(0, 31);
  let n = 2;
  while (wb.getWorksheet(name)) {
    name = `${base.slice(0, 28)}_${n++}`;
  }
  return name;
}

/** Đổi px cột UI → width Excel (xấp xỉ). */
function excelColWidths(widths) {
  const w = widths || getBaoDuongColWidths();
  return BAO_DUONG_COLS.map((col) => Math.max(6, Math.round((w[col.key] || 80) / 7)));
}

/**
 * Ghi một tờ BDTX (giống layout preview) vào worksheet.
 */
function writeBaoDuongSheet(ws, { periodFrom, periodTo, entries, margins, chiefName = "", signRole = "Hạt trưởng", routeView = null }) {
  const list = entries || [];
  const blocks = routeView?.road
    ? buildBaoDuongDisplayBlocks(list, routeView.road, routeView)
    : list.map((entry, i) => ({ kind: "entry", entry, stt: i + 1 }));
  const { count: padCount } = computeBaoDuongPadRows(blocks, margins, { withSign: true });

  const title = ws.addRow([TITLE]);
  ws.mergeCells(title.number, 1, title.number, 5);
  title.getCell(1).font = font({ size: 13, bold: true });
  title.getCell(1).alignment = {
    horizontal: "center",
    vertical: "middle",
    wrapText: true
  };
  title.height = 28;

  const period = ws.addRow([
    `1. Thời gian thực hiện: ${periodLabel(periodFrom, periodTo)}`
  ]);
  ws.mergeCells(period.number, 1, period.number, 5);
  period.getCell(1).font = font({ size: 13 });

  const intro = ws.addRow([
    "Các công việc thực hiện trong thời gian trên ghi vào bảng sau:"
  ]);
  ws.mergeCells(intro.number, 1, intro.number, 5);
  intro.getCell(1).font = font({ size: 13 });

  const head = ws.addRow(HEADERS);
  head.eachCell((c) => {
    c.font = font({ bold: true });
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border = thinBorder();
  });
  head.height = 36;

  const nums = ws.addRow(NUMS);
  nums.eachCell((c) => {
    c.font = font({ bold: true });
    c.alignment = { horizontal: "center", vertical: "middle" };
    c.border = thinBorder();
  });

  blocks.forEach((block) => {
    if (block.kind === "routeHeader") {
      const row = ws.addRow([block.heading, "", "", "", ""]);
      ws.mergeCells(row.number, 1, row.number, 5);
      const cell = row.getCell(1);
      cell.font = font({ bold: true, size: 12 });
      cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
      cell.border = thinBorder();
      row.height = 22;
      return;
    }
    const r = entryToBaoDuongRow(block.entry, Math.max(0, (block.stt || 1) - 1));
    r.stt = block.stt;
    const row = ws.addRow([r.stt, r.work, r.viTri, r.measureSummary, r.mainResult]);
    row.eachCell((c, col) => {
      c.border = thinBorder();
      c.font = font();
      c.alignment = {
        horizontal: col === 1 ? "center" : "left",
        vertical: "middle",
        wrapText: true
      };
    });
    const lines = Math.max(
      2,
      String(r.viTri || "").split("\n").length,
      String(r.measureSummary || "").split("\n").length,
      String(r.mainResult || "").split("\n").length
    );
    row.height = Math.min(90, 15 * lines);
  });

  for (let i = 0; i < padCount; i += 1) {
    const empty = ws.addRow(["", "", "", "", ""]);
    empty.eachCell((c) => {
      c.border = thinBorder();
    });
    empty.height = 18;
  }

  ws.addRow([]);
  const roleLabel = String(signRole || "").trim() || "Hạt trưởng";
  const sign = ws.addRow(["", "", "", "", roleLabel]);
  sign.getCell(5).font = font({ bold: true });
  sign.getCell(5).alignment = { horizontal: "center" };
  const name = String(chiefName || "").trim();
  if (!name) {
    const hint = ws.addRow(["", "", "", "", "(Ký, ghi rõ họ tên)"]);
    hint.getCell(5).font = font({ size: 11, italic: true });
    hint.getCell(5).alignment = { horizontal: "center" };
  }
  /* Khoảng trống ~2,45 cm dưới chữ chức danh rồi in tên (0,7 × 3,5 cm) */
  const gap = ws.addRow(["", "", "", "", ""]);
  gap.height = 69;
  const nameRow = ws.addRow(["", "", "", "", name]);
  nameRow.getCell(5).font = font({ bold: true, size: 13 });
  nameRow.getCell(5).alignment = { horizontal: "center" };
}

/**
 * Xuất sổ BDTX ra Excel — bố cục giống preview in.
 * - 1 ngày: 1 sheet
 * - Khoảng A→B (groupByDay): mỗi ngày thực hiện = 1 sheet
 */
export async function exportBaoDuongExcel({
  entries,
  periodFrom,
  periodTo,
  groupByDay = false,
  margins = { top: 12, right: 12, bottom: 12, left: 14 },
  widths,
  chiefName = "",
  signRole = "Hạt trưởng",
  routeView = null
} = {}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Nhật ký tuần đường";
  wb.created = new Date();

  const colWidths = excelColWidths(widths);
  let groups;
  if (groupByDay) {
    const g = groupBaoDuongEntriesByExecDay(entries, periodFrom, periodTo);
    groups = g.length ? g : [{ periodFrom, periodTo, entries: [] }];
  } else {
    groups = [{ periodFrom, periodTo, entries: entries || [] }];
  }

  groups.forEach((group) => {
    const base =
      groupByDay || periodFrom === periodTo
        ? sheetNameForDate(group.periodFrom || periodFrom)
        : "BDTX";
    const ws = wb.addWorksheet(uniqueSheetName(wb, base), {
      pageSetup: {
        paperSize: 9,
        orientation: "portrait",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: {
          left: (Number(margins.left) || 14) / 25.4,
          right: (Number(margins.right) || 12) / 25.4,
          top: (Number(margins.top) || 12) / 25.4,
          bottom: (Number(margins.bottom) || 12) / 25.4,
          header: 0.2,
          footer: 0.2
        }
      },
      properties: { defaultRowHeight: 18 }
    });
    ws.columns = colWidths.map((width) => ({ width }));
    writeBaoDuongSheet(ws, {
      periodFrom: group.periodFrom,
      periodTo: group.periodTo,
      entries: group.entries,
      margins,
      chiefName,
      signRole,
      routeView
    });
  });

  const buffer = await wb.xlsx.writeBuffer();
  const from = formatDisplayDate(periodFrom) || periodFrom || "";
  const to = formatDisplayDate(periodTo) || periodTo || from;
  const filename =
    periodFrom && periodTo && periodFrom !== periodTo
      ? `So_BDTX_${from}_den_${to}.xlsx`.replace(/\//g, "-")
      : `So_BDTX_${from || "xuat"}.xlsx`.replace(/\//g, "-");

  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return { filename, sheetCount: groups.length };
}
