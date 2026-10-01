import {
  BAO_DUONG_COLS,
  getBaoDuongColWidths,
  sumBaoDuongCols
} from "../hooks/useBaoDuongColWidths";
import { printViaIframe } from "./printViaIframe";
import { printFolioCss, printFolioMarkup } from "./printFolio";

/** CSS in A4 dọc — dùng trong iframe (tránh Chrome lệch khung khi in từ DOM app). */
export function buildBaoDuongPrintCss(margins, widths) {
  const top = Number(margins?.top) || 0;
  const right = Number(margins?.right) || 0;
  const bottom = Number(margins?.bottom) || 0;
  const left = Number(margins?.left) || 0;
  const w = widths || getBaoDuongColWidths();
  const total = sumBaoDuongCols(w) || 1;
  const colRules = BAO_DUONG_COLS.map(
    (col, i) =>
      `.baoduong-table colgroup col:nth-child(${i + 1}){width:${((w[col.key] / total) * 100).toFixed(3)}%}`
  ).join("\n");

  return `
@page baoduongPrintPage {
  size: A4 portrait;
  margin: 0;
}
* { box-sizing: border-box; }
html, body {
  margin: 0;
  padding: 0;
  width: 210mm;
  background: #fff;
  color: #111827;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
  font-family: "Times New Roman", Times, serif;
  font-size: 12pt;
}
.sheet {
  page: baoduongPrintPage;
  width: 210mm;
  height: 296.8mm;
  max-height: 296.8mm;
  padding: ${top}mm ${right}mm ${bottom}mm ${left}mm;
  overflow: hidden;
  page-break-after: always;
  break-after: page;
  page-break-inside: avoid;
  break-inside: avoid;
  box-sizing: border-box;
}
.sheet:last-child {
  page-break-after: auto;
  break-after: auto;
}
.sheet-inner {
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.baoduong-title {
  text-align: center;
  font-family: "Times New Roman", Times, serif;
  font-size: 13pt;
  font-weight: 700;
  margin: 0 0 6px;
  line-height: 1.28;
  text-transform: uppercase;
  flex: 0 0 auto;
}
.baoduong-period {
  margin: 0 0 4px;
  font-family: "Times New Roman", Times, serif;
  font-size: 13pt;
  flex: 0 0 auto;
}
.baoduong-intro {
  margin: 0 0 8px;
  font-family: "Times New Roman", Times, serif;
  font-size: 13pt;
  flex: 0 0 auto;
}
.baoduong-table {
  width: 100%;
  border-collapse: collapse !important;
  border-spacing: 0 !important;
  border: none !important;
  table-layout: fixed;
  font-family: "Times New Roman", Times, serif;
  font-size: 12pt;
  line-height: 1.03;
  flex: 0 1 auto;
  max-width: 100%;
  box-sizing: border-box;
}
${colRules}
.baoduong-table th,
.baoduong-table td {
  border: 0.5pt solid #000 !important;
  padding: 2.5px 4px;
  vertical-align: top;
  text-align: left !important;
  word-wrap: break-word;
  overflow-wrap: anywhere;
  background: #fff !important;
  position: static !important;
  box-sizing: border-box !important;
}
.baoduong-table th {
  font-weight: 700;
  text-align: center !important;
  font-size: 12pt;
  vertical-align: middle;
}
.baoduong-header-num th {
  font-size: 12pt;
  padding: 2px 3px;
  font-weight: 400 !important;
  font-style: normal;
}
.baoduong-table tbody td { text-align: left !important; }
.baoduong-table tbody td.baoduong-col-stt {
  text-align: center !important;
  vertical-align: middle !important;
}
.baoduong-col-stt { text-align: center !important; vertical-align: middle !important; }
.baoduong-pre {
  margin: 0;
  white-space: pre-wrap;
  font-family: inherit;
  font-size: inherit;
  display: block;
  width: 100%;
  text-align: left !important;
}
.baoduong-sign {
  margin-top: 6px;
  flex: 0 0 auto;
  display: flex;
  justify-content: flex-end;
  padding-right: 6%;
  padding-top: 2mm;
  padding-bottom: 2mm;
  page-break-inside: avoid;
  break-inside: avoid;
}
.baoduong-sign-box {
  position: relative;
  width: 45%;
  text-align: center;
}
.baoduong-sign-role {
  font-family: "Times New Roman", Times, serif;
  font-weight: 700;
  font-size: 13pt;
  line-height: 1.25;
  margin: 0;
}
.baoduong-sign-hint {
  position: absolute;
  left: 0;
  right: 0;
  top: 1.35em;
  font-family: "Times New Roman", Times, serif;
  font-size: 11pt;
  color: #334155;
  font-style: italic;
}
.baoduong-sign-name {
  position: static;
  margin: var(--bd-sign-name-gap, 24.5mm) 0 0;
  min-height: 1.2em;
  font-family: "Times New Roman", Times, serif;
  font-weight: 700;
  font-size: 13pt;
  line-height: 1.25;
}
.no-print { display: none !important; }
.col-resize-handle { display: none !important; }
.baoduong-print-page-num { display: none !important; }
`;
}

/**
 * In sổ BDTX qua iframe — khổ A4 dọc ổn định (PDF / máy in).
 */
export function printBaoDuongPages(margins, widths, pageStart) {
  const pages = Array.from(
    document.querySelectorAll(".baoduong-print-stack--preview .baoduong-print-page")
  );
  if (!pages.length) {
    window.alert("Chưa có tờ xem trước để in. Bấm «In sổ bảo dưỡng» để mở xem trước trước.");
    return;
  }

  const w = widths || getBaoDuongColWidths();
  const sheetsHtml = pages
    .map((page) => {
      const inner = page.querySelector(".baoduong-print-inner");
      const html = inner ? inner.innerHTML : page.innerHTML;
      const folio = printFolioMarkup(pageStart);
      return `<div class="sheet">${folio}<div class="sheet-inner">${html}</div></div>`;
    })
    .join("\n");

  printViaIframe({
    title: "Sổ bảo dưỡng thường xuyên",
    css: `${buildBaoDuongPrintCss(margins, w)}\n${printFolioCss(pageStart)}`,
    sheetsHtml,
    pageWMm: 210,
    pageHMm: 297
  });
}
