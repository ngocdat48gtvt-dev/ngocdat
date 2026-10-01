import { SIGN_CELL_CSS_PX, SIGN_SPACE_PX } from "./nhatKyPrintRows";
import { layoutSpreadForPrint } from "../components/NhatKyPrintDay";
import { printViaIframe } from "./printViaIframe";
import { printFolioCss, printFolioMarkup } from "./printFolio";

function mm(n, fallback = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

/** CSS tối thiểu cho iframe in — mỗi .sheet = đúng 1 tờ A4 dọc. */
export function buildNhatKyPrintCss(margins) {
  const top = mm(margins?.top);
  const right = mm(margins?.right);
  const bottom = mm(margins?.bottom);
  const left = mm(margins?.left);
  const signSpace = SIGN_SPACE_PX;
  const signCell = SIGN_CELL_CSS_PX;

  // Lề chỉ nằm trong .sheet padding — khớp đường kéo trên preview.
  // @page margin phải = 0 (khi in chọn Margins: None).
  return `
@page {
  size: A4 portrait;
  margin: 0;
}
@page nhatkyPrintPage {
  size: A4 portrait;
  margin: 0;
}
* { box-sizing: border-box; }
html, body {
  margin: 0 !important;
  padding: 0 !important;
  width: 210mm;
  min-width: 210mm;
  max-width: 210mm;
  background: #fff;
  color: #0f172a;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
  font-family: "Times New Roman", Times, serif;
  font-size: 12.5pt;
}
.sheet {
  page: nhatkyPrintPage;
  width: 210mm;
  min-width: 210mm;
  max-width: 210mm;
  height: 296.8mm;
  max-height: 296.8mm;
  padding: ${top}mm ${right}mm ${bottom}mm ${left}mm !important;
  overflow: hidden;
  page-break-after: always;
  break-after: page;
  page-break-inside: auto;
  break-inside: auto;
  box-sizing: border-box;
  margin: 0 !important;
  border: none !important;
}
.sheet:last-child {
  page-break-after: auto;
  break-after: auto;
}
.sheet-inner {
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
  margin: 0;
  padding: 0;
}
.nhatky-print-table {
  width: 100% !important;
  margin: 0 !important;
  border-collapse: separate !important;
  border-spacing: 0 !important;
  border: none !important;
  border-right: 0.1mm solid #000 !important;
  table-layout: fixed;
  font-size: 12.5pt;
  line-height: 1.0;
  font-family: "Times New Roman", Times, serif;
  transform: none !important;
  zoom: 1 !important;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.nhatky-print-table thead {
  font-size: 12.5pt;
}
.nhatky-print-table tbody {
  font-size: 12.5pt;
}
.nhatky-print-table tbody td,
.nhatky-print-table tbody .nhatky-print-pre,
.nhatky-print-table tbody .nhatky-print-empty {
  font-size: 12.5pt;
}
.nhatky-print-table tbody .nhatky-sign-block {
  font-size: 12.5pt;
}
.nhatky-print-table th,
.nhatky-print-table td {
  border-top: 0.1mm solid #000 !important;
  border-left: 0.1mm solid #000 !important;
  border-right: none !important;
  border-bottom: none !important;
  vertical-align: middle !important;
  padding: 2px 3px;
  word-wrap: break-word;
  overflow-wrap: anywhere;
  background: #fff;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.nhatky-print-table tbody tr:last-child td {
  border-bottom: 0.1mm solid #000 !important;
}
.nhatky-print-table tbody td {
  padding-top: calc(1.6px * var(--nk-row-scale, 1));
  padding-bottom: calc(1.6px * var(--nk-row-scale, 1));
}
.nhatky-print-table tbody .nhatky-print-row--sign td {
  padding-top: 1px;
  padding-bottom: 0;
}
.nhatky-print-table thead th {
  padding: 2px 3px;
  line-height: 1.15;
  font-size: 12.5pt;
  vertical-align: middle !important;
}
.nhatky-print-head-main th {
  background: #fff;
  font-weight: 700;
  font-size: 12.5pt;
  text-align: center;
  line-height: 1.15;
  padding: 2px 3px;
}
.nhatky-print-head-num th {
  background: #fff;
  font-weight: 700;
  text-align: center;
  font-size: 12.5pt;
  padding: 1px 3px;
  line-height: 1.1;
}
.nhatky-print-cellbox {
  display: flex;
  flex-direction: column;
  justify-content: center;
  box-sizing: border-box;
  width: 100%;
  min-height: 0;
  height: 100%;
}
.nhatky-print-row--sign .nhatky-print-cellbox {
  justify-content: flex-start;
}
.nhatky-print-pre {
  display: block;
  width: 100%;
  margin: 0;
  white-space: pre-wrap;
  font-family: inherit;
  font-size: inherit;
  line-height: max(0.85, var(--nk-row-scale, 1));
}
.nhatky-print-empty {
  display: block;
  width: 100%;
  color: #111827;
  font-family: "Times New Roman", Times, serif;
  font-size: inherit;
  font-style: normal;
  line-height: max(0.85, var(--nk-row-scale, 1));
}
.nhatky-print-row--part .nhatky-print-td--3 {
  font-weight: 800;
  color: #000;
  background: #f8fafc;
}
.nhatky-print-row--section .nhatky-print-td--3 {
  font-weight: 700;
  color: #000;
}
.nhatky-print-row--weather .nhatky-print-td--1,
.nhatky-print-row--weather .nhatky-print-td--3,
.nhatky-print-row--weather .nhatky-print-pre {
  font-style: normal;
  font-weight: 700;
}
.nhatky-print-row--sign td {
  vertical-align: top !important;
  min-height: ${signCell}px;
  padding-top: 1px;
  padding-bottom: 0;
}
.nhatky-print-row--sign-gap td {
  height: 0;
}
.nhatky-sign-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  width: 100%;
  height: 100%;
  min-height: 0;
  max-height: 100%;
  padding: 1px 2px 3mm;
  box-sizing: border-box;
  text-align: center;
  font-family: "Times New Roman", Times, serif;
  font-size: 12.5pt;
  font-weight: 700;
  line-height: 1.15;
}
.nhatky-sign-role { font-weight: 700; flex: 0 0 auto; }
.nhatky-sign-space {
  flex: 1 1 auto;
  height: auto;
  min-height: ${signSpace}px;
  max-height: none;
  width: 100%;
}
.nhatky-sign-name { font-weight: 700; margin-top: 0; flex: 0 0 auto; }
.nhatky-sign-line {
  text-align: center;
  font-family: "Times New Roman", Times, serif;
  font-size: 12.5pt;
  font-weight: 700;
  line-height: 1.15;
}
@media print {
  html, body {
    width: 210mm !important;
    margin: 0 !important;
    padding: 0 !important;
  }
}
`;
}

/**
 * In qua iframe — mỗi nửa (cột 1–3 hoặc 4–6) = 1 tờ A4 dọc.
 * Lề = đúng số mm đang kéo trên preview (không scale bảng).
 */
export function nhatKyPagesToSheetsHtml(pages, margins, pageStart) {
  const top = mm(margins?.top);
  const right = mm(margins?.right);
  const bottom = mm(margins?.bottom);
  const left = mm(margins?.left);
  const pad = `${top}mm ${right}mm ${bottom}mm ${left}mm`;
  const list = Array.from(pages || []);
  return list
    .map((page) => {
      const table = page.querySelector("table");
      if (table) {
        table.style.transform = "";
        table.style.transformOrigin = "";
      }
      const scale =
        page.closest("[data-row-height-scale]")?.getAttribute("data-row-height-scale") ||
        "1";
      const inner = table ? table.outerHTML : page.innerHTML;
      const folio = printFolioMarkup(pageStart);
      return `<div class="sheet" style="padding:${pad};--nk-row-scale:${scale}">${folio}<div class="sheet-inner">${inner}</div></div>`;
    })
    .join("\n");
}

export function printNhatKySheetsHtml(sheetsHtml, margins, pageStart) {
  const top = mm(margins?.top);
  const right = mm(margins?.right);
  const bottom = mm(margins?.bottom);
  const left = mm(margins?.left);
  if (!String(sheetsHtml || "").trim()) {
    window.alert("Chưa có tờ để in.");
    return;
  }
  const sheetCount = (String(sheetsHtml).match(/class="sheet"/g) || []).length;
  printViaIframe({
    title: "Sổ nhật ký",
    css: `${buildNhatKyPrintCss({ top, right, bottom, left })}\n${printFolioCss(pageStart)}`,
    sheetsHtml,
    pageWMm: 210,
    pageHMm: 297,
    /** Khoảng nhiều ngày: Chrome cần thời gian vẽ hết tờ trước khi Save as PDF. */
    printDelayMs: Math.min(2200, 450 + sheetCount * 28)
  });
}

export function printNhatKyPages(margins, pageStart) {
  const spreads = document.querySelectorAll(
    ".nhatky-print-stack--preview .nhatky-print-spread"
  );
  if (spreads.length <= 20) {
    spreads.forEach((spread) => {
      layoutSpreadForPrint(spread);
    });
  }

  const pages = Array.from(
    document.querySelectorAll(".nhatky-print-stack--preview .nhatky-print-page")
  );

  if (!pages.length) {
    window.alert("Chưa có tờ xem trước để in.");
    return;
  }

  printNhatKySheetsHtml(nhatKyPagesToSheetsHtml(pages, margins, pageStart), margins, pageStart);
}
