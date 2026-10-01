import {
  collectPreviewSheets,
  landscapePageShellCss,
  printViaIframe
} from "./printViaIframe";

/**
 * Kẻ khung in GPTC — 1 nét mảnh dùng chung (collapse), không đúp.
 * Dùng mm (ổn định khi in Chrome/PDF hơn pt/px).
 */
export function gptcHairlineTableCss(selector = ".gptc-official-table") {
  const line = "0.1mm solid #000";
  return `
${selector} {
  width: 100% !important;
  max-width: 100% !important;
  table-layout: fixed !important;
  border-collapse: collapse !important;
  border-spacing: 0 !important;
  border: ${line} !important;
  empty-cells: show !important;
}
${selector} th,
${selector} td {
  border: ${line} !important;
  background: #fff !important;
  box-sizing: border-box !important;
}
${selector} th {
  font-weight: 700;
  text-align: center;
  font-size: 12pt;
  padding: 2px 3px;
  vertical-align: middle;
}
${selector} td {
  padding: 0 !important;
  vertical-align: top;
  font-size: 12pt;
}
`;
}

export function buildGptcPrintCss(margins) {
  return `
${landscapePageShellCss(margins)}
/* Chừa đáy trang — tránh overflow:hidden cắt nét ngang cuối */
.sheet {
  overflow: hidden !important;
}
.sheet-inner {
  padding-bottom: 1.5mm !important;
  box-sizing: border-box !important;
  overflow: visible !important;
  height: auto !important;
  max-height: 100% !important;
}
.gptc-sheet-title {
  margin: 0 0 4px;
  text-align: center;
  font-family: "Times New Roman", Times, serif;
  font-size: 13pt;
  font-weight: 700;
  text-transform: uppercase;
  line-height: 1.3;
}
.gptc-detail-project-line {
  display: block;
  margin: 0 0 4px;
  font-family: "Times New Roman", Times, serif;
  font-size: 13pt;
  font-weight: 700;
  line-height: 1.3;
}
.gptc-detail-project-name,
.gptc-cell-text {
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
}
.gptc-sheet,
.gptc-table-scroll,
.gptc-table-scroll--fill {
  width: 100% !important;
  max-width: 100% !important;
  overflow: visible !important;
  flex: 0 0 auto !important;
  height: auto !important;
}
${gptcHairlineTableCss(".gptc-official-table")}
.gptc-td-center { text-align: center; vertical-align: middle !important; }
.gptc-empty-row { text-align: center; padding: 8px !important; color: #64748b; }
.gptc-summary-table--print {
  width: 100% !important;
}
.gptc-summary-table--print tbody tr {
  height: var(--gptc-summary-row-h, 12mm);
  max-height: var(--gptc-summary-row-h, 12mm);
}
.gptc-summary-table--print tbody td {
  height: var(--gptc-summary-row-h, 12mm);
  min-height: var(--gptc-summary-row-h, 12mm);
  max-height: var(--gptc-summary-row-h, 12mm);
  vertical-align: top;
  overflow: hidden !important;
}
.gptc-summary-table--print .gptc-cell-text {
  display: block;
  max-height: 100%;
  overflow: hidden;
  white-space: pre-wrap;
  word-break: break-word;
}
.gptc-detail-table--excel tbody td {
  height: var(--gptc-row-h, 9mm);
  min-height: var(--gptc-row-h, 9mm);
  max-height: var(--gptc-row-h, 9mm);
  vertical-align: top;
  overflow: hidden;
}
.gptc-detail-table--print-fit .gptc-cell-text {
  display: block;
  white-space: pre-wrap;
  word-break: break-word;
  overflow: hidden;
  max-height: 100%;
  padding: 2px 4px;
  line-height: 1.25;
}
`;
}

export function printGptcPages(margins, scope = "all") {
  const sheetsHtml = collectPreviewSheets(
    ".gptc-print-stack--preview",
    ".gptc-print-page",
    ".gptc-print-inner"
  );
  if (!sheetsHtml) {
    window.alert("Chưa có tờ xem trước để in. Mở «Xem trước in» trước.");
    return;
  }
  const title =
    scope === "summary"
      ? "BM01 — Bảng tổng hợp cấp phép thi công"
      : scope === "detail"
        ? "BM02 — Theo dõi diễn biến thi công"
        : "Sổ cấp phép thi công";
  printViaIframe({
    title,
    css: buildGptcPrintCss(margins),
    sheetsHtml
  });
}
