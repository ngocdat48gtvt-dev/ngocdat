import ExcelJS from "exceljs";
import { OFFICIAL_HEADERS, formatDisplayDate } from "./nhatKyFormat";
import {
  buildNhatKyPrintRows,
  entriesForDate,
  dayMetaForDate,
  SIGN_SPACE_PX,
  SIGN_CELL_CSS_PX
} from "./nhatKyPrintRows";
import { getNhatKyColWidths } from "../hooks/useColumnWidths";
import {
  packRowsForA4,
  estimateRowHeightPx,
  SIGN_CELL_PX,
  clampRowHeightScale
} from "../components/NhatKyPrintDay";

const COL_KEYS = ["c1", "c2", "c3", "c4", "c5", "c6"];

const HEADERS = [
  OFFICIAL_HEADERS.col1,
  OFFICIAL_HEADERS.col2,
  OFFICIAL_HEADERS.col3,
  OFFICIAL_HEADERS.col4,
  OFFICIAL_HEADERS.col5,
  OFFICIAL_HEADERS.col6
];

const NUMS = ["(1)", "(2)", "(3)", "(4)", "(5)", "(6)"];

const FONT_PT = 12.5;

/** px (96dpi) → điểm Excel (pt). */
function pxToExcelRowHeight(px) {
  return Math.max(10, Math.round(Number(px || 0) * 0.75 * 10) / 10);
}

/** px cột PDF → width cột Excel. */
function pxToExcelWidth(px) {
  return Math.max(6, Math.round(Number(px || 80) / 7));
}

function thinBorder() {
  const side = { style: "thin", color: { argb: "FF000000" } };
  return { top: side, left: side, bottom: side, right: side };
}

function font(opts = {}) {
  return { name: "Times New Roman", size: FONT_PT, ...opts };
}

function linesForText(text, charsPerLine) {
  const cpl = Math.max(6, charsPerLine || 36);
  let n = 0;
  String(text || "")
    .split("\n")
    .forEach((line) => {
      n += Math.max(1, Math.ceil(Math.max(String(line).length, 1) / cpl));
    });
  return Math.max(1, n);
}

function estimateHeadMainHeightPx(widths) {
  const w = widths || getNhatKyColWidths();
  const HALF_CHARS = 58;
  const halfLines = (keys, texts) => {
    const total = keys.reduce((s, k) => s + (Number(w[k]) || 0), 0) || 1;
    let lines = 1;
    keys.forEach((key, i) => {
      const share = (Number(w[key]) || 0) / total;
      const cpl = Math.max(8, Math.floor(HALF_CHARS * Math.max(share, 0.12)));
      lines = Math.max(lines, linesForText(texts[i], cpl));
    });
    return lines;
  };
  const lines = Math.max(
    halfLines(["c1", "c2", "c3"], HEADERS.slice(0, 3)),
    halfLines(["c4", "c5", "c6"], HEADERS.slice(3, 6))
  );
  return Math.min(220, Math.ceil(6 + lines * (FONT_PT * 1.15)));
}

function signBlankLineCount() {
  return Math.max(2, Math.round(SIGN_SPACE_PX / (FONT_PT * 1.15)));
}

function signBlockText(role, name) {
  const gaps = Array.from({ length: signBlankLineCount() }, () => "");
  return [String(role || "").trim(), ...gaps, String(name || "").trim()].join(
    "\n"
  );
}

/** Chiều cao ô ký Excel: đủ chứa chức danh + khoảng trống + tên (không cắt chữ). */
function signExcelHeightPt(row, heightByKey, previewSignPx) {
  const lines = 2 + signBlankLineCount();
  const fromText = lines * FONT_PT * 1.3;
  const fromPdf = pxToExcelRowHeight(SIGN_CELL_PX || SIGN_CELL_CSS_PX);
  const measured = resolveSignHeightPx(row, heightByKey, previewSignPx);
  return Math.max(fromText, fromPdf, pxToExcelRowHeight(measured));
}

function resolveRowHeightPx(row, widths, heightByKey, rowHeightScale = 1) {
  const key = row?.key;
  if (key && heightByKey && Number(heightByKey[key]) > 0) {
    return Math.ceil(Number(heightByKey[key]));
  }
  return estimateRowHeightPx(row, widths, rowHeightScale);
}

/** Chiều cao hàng Excel = max(đo PDF, chữ cột 1–3, chữ cột 4–6) — hai nửa cùng hàng. */
function bodyExcelHeightPt(row, widths, heightByKey, rowHeightScale = 1) {
  const colW = widths || getNhatKyColWidths();
  const s = clampRowHeightScale(rowHeightScale);
  const fromPdf = pxToExcelRowHeight(resolveRowHeightPx(row, colW, heightByKey, s));
  let fromText = FONT_PT * 1.25;
  COL_KEYS.forEach((key) => {
    const text = cellText(row, key);
    if (!text) return;
    const excelW = pxToExcelWidth(colW[key]);
    const cpl = Math.max(8, Math.floor(excelW * 1.05));
    fromText = Math.max(fromText, linesForText(text, cpl) * FONT_PT * 1.25);
  });
  return Math.max(fromPdf, fromText * s);
}

function resolveSignHeightPx(row, heightByKey, previewSignPx) {
  const floor = SIGN_CELL_PX || SIGN_CELL_CSS_PX;
  const key = row?.key;
  const fromKey =
    key && heightByKey && Number(heightByKey[key]) > 0
      ? Math.ceil(Number(heightByKey[key]))
      : 0;
  const fromPreview = Number(previewSignPx) > 0 ? Math.ceil(Number(previewSignPx)) : 0;
  return Math.max(floor, fromKey, fromPreview);
}

function collectPreviewHeightByKey() {
  const map = {};
  if (typeof document === "undefined") return map;
  document
    .querySelectorAll(
      ".nhatky-print-stack--preview .nhatky-print-page tbody tr[data-row-key]"
    )
    .forEach((tr) => {
      const key = tr.getAttribute("data-row-key");
      if (!key) return;
      const h = Math.ceil(tr.getBoundingClientRect().height);
      if (h > 0) map[key] = Math.max(map[key] || 0, h);
    });
  return map;
}

function collectPreviewSignHeightPx() {
  if (typeof document === "undefined") return 0;
  let max = 0;
  document
    .querySelectorAll(
      ".nhatky-print-stack--preview .nhatky-print-row--sign-pair, .nhatky-print-stack--preview .nhatky-print-row--sign"
    )
    .forEach((tr) => {
      const h = Math.ceil(tr.getBoundingClientRect().height);
      if (h > max) max = h;
    });
  return max;
}

function collectPreviewHeadHeights() {
  if (typeof document === "undefined") {
    return { main: 0, num: 0 };
  }
  const main = document.querySelector(
    ".nhatky-print-stack--preview .nhatky-print-page--left thead tr.nhatky-print-head-main"
  );
  const num = document.querySelector(
    ".nhatky-print-stack--preview .nhatky-print-page--left thead tr.nhatky-print-head-num"
  );
  return {
    main: main ? Math.ceil(main.getBoundingClientRect().height) : 0,
    num: num ? Math.ceil(num.getBoundingClientRect().height) : 0
  };
}

function cellText(row, key) {
  if (!row) return "";
  const kind = String(row.kind || "");
  if (kind === "filler" || kind === "sign-gap") return "";
  if (kind.startsWith("sign")) return "";
  if (key === "c3" && kind === "empty") return "Không phát sinh";
  return row[key] || "";
}

function applyCell(cell, { bold = false, center = false, top = false, shading } = {}) {
  cell.font = font({ bold });
  cell.alignment = {
    horizontal: center ? "center" : "left",
    vertical: top ? "top" : "middle",
    wrapText: true
  };
  cell.border = thinBorder();
  if (shading) {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: shading }
    };
  }
}

function writeTableHead(ws, colW, headHeights) {
  const head = ws.addRow(HEADERS);
  head.eachCell((cell) => {
    applyCell(cell, { bold: true, center: true, shading: "FFFFFFFF" });
  });
  const headMainPx =
    Number(headHeights?.main) > 0
      ? Number(headHeights.main)
      : estimateHeadMainHeightPx(colW);
  head.height = pxToExcelRowHeight(headMainPx);

  const nums = ws.addRow(NUMS);
  nums.eachCell((cell) => {
    applyCell(cell, { bold: true, center: true, shading: "FFFFFFFF" });
  });
  const headNumPx = Number(headHeights?.num) > 0 ? Number(headHeights.num) : 22;
  nums.height = pxToExcelRowHeight(headNumPx);
}

function writeBodyRows(
  ws,
  {
    rows,
    widths,
    heightByKey,
    previewSignPx,
    signTuanDuong = "",
    signHatTruong = "",
    signHatRole = "Hạt trưởng",
    rowHeightScale = 1
  }
) {
  const colW = widths || getNhatKyColWidths();

  (rows || []).forEach((row) => {
    const kind = String(row?.kind || "");

    if (kind === "sign-pair" || kind === "sign-hat" || kind === "sign-tuan") {
      const excelRow = ws.addRow([
        "",
        "",
        signBlockText("Tuần đường", signTuanDuong),
        "",
        signBlockText(signHatRole || "Hạt trưởng", signHatTruong),
        ""
      ]);
      excelRow.eachCell((cell, col) => {
        applyCell(cell, {
          bold: col === 3 || col === 5,
          center: col === 3 || col === 5,
          top: col === 3 || col === 5
        });
      });
      excelRow.height = signExcelHeightPt(row, heightByKey, previewSignPx);
      return;
    }

    const values = COL_KEYS.map((key) => cellText(row, key));
    const excelRow = ws.addRow(values);
    const bold = kind === "weather" || kind === "section" || kind === "part";
    const shading =
      kind === "section" || kind === "part" ? "FFF8FAFC" : undefined;
    excelRow.eachCell((cell, col) => {
      const key = COL_KEYS[col - 1];
      applyCell(cell, {
        bold: bold || (kind === "weather" && key === "c3"),
        center: kind === "weather" && key === "c1",
        shading
      });
    });
    excelRow.height = bodyExcelHeightPt(row, colW, heightByKey, rowHeightScale);
  });
}

/**
 * Xuất sổ nhật ký ra Excel — 1 sheet:
 * cột 1–3 (trang 1) cạnh cột 4–6 (trang 2). Nhiều ngày nối tiếp trên sheet đó.
 */
export async function exportNhatKyExcel({
  dates = [],
  entries = [],
  dayMeta = {},
  filterByRouteView,
  locationCtx = null,
  margins = { top: 20, right: 15, bottom: 15, left: 20 },
  widths,
  signTuanDuong = "",
  signHatTruong = "",
  signHatRole = "Hạt trưởng",
  rowHeightScale = 1
} = {}) {
  const list = (dates || []).filter(Boolean);
  if (!list.length) throw new Error("Không có ngày để xuất.");

  const colWidths = widths || getNhatKyColWidths();
  const heightByKey = collectPreviewHeightByKey();
  const headHeights = collectPreviewHeadHeights();
  const previewSignPx = collectPreviewSignHeightPx();

  const dayChunks = list.map((date) => {
    let dayEntries = entriesForDate(entries, date);
    if (typeof filterByRouteView === "function") {
      dayEntries = filterByRouteView(dayEntries);
    }
    const rows = buildNhatKyPrintRows(
      date,
      dayEntries,
      dayMetaForDate(dayMeta, date),
      locationCtx
    );
    const chunk = packRowsForA4(rows, 0, 0, colWidths, heightByKey)[0] || [];
    return { date, rows: chunk };
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "Sổ nhật ký tuần đường";
  wb.created = new Date();

  const ws = wb.addWorksheet("Sổ nhật ký", {
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: false,
      scale: 100,
      horizontalCentered: true,
      margins: {
        left: (Number(margins.left) || 20) / 25.4,
        right: (Number(margins.right) || 15) / 25.4,
        top: (Number(margins.top) || 20) / 25.4,
        bottom: (Number(margins.bottom) || 15) / 25.4,
        header: 0.2,
        footer: 0.2
      }
    },
    properties: { defaultRowHeight: 15 }
  });

  ws.columns = COL_KEYS.map((key) => ({
    width: pxToExcelWidth(colWidths[key])
  }));

  writeTableHead(ws, colWidths, headHeights);

  dayChunks.forEach(({ rows }, idx) => {
    if (idx > 0) writeTableHead(ws, colWidths, headHeights);
    writeBodyRows(ws, {
      rows,
      widths: colWidths,
      heightByKey,
      previewSignPx,
      signTuanDuong,
      signHatTruong,
      signHatRole,
      rowHeightScale
    });
  });

  const buffer = await wb.xlsx.writeBuffer();
  const from = list[0];
  const to = list[list.length - 1];
  const filename =
    from === to
      ? `So_nhat_ky_${formatDisplayDate(from) || from}.xlsx`.replace(/\//g, "-")
      : `So_nhat_ky_${formatDisplayDate(from) || from}_den_${formatDisplayDate(to) || to}.xlsx`.replace(
          /\//g,
          "-"
        );

  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return { filename, sheetCount: 1 };
}
