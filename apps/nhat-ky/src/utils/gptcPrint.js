import {
  collectPreviewSheets,
  landscapePageShellCss,
  printViaIframe
} from "./printViaIframe";

/** Nét mảnh đen Excel — chỉ trên/trái (tránh đúp nét bôi đậm). */
function gptcTableCss(selector) {
  return `
${selector} {
  border-collapse: separate !important;
  border-spacing: 0 !important;
  border: none !important;
  border-right: 0.5pt solid #000 !important;
}
${selector} th,
${selector} td {
  border-top: 0.5pt solid #000 !important;
  border-left: 0.5pt solid #000 !important;
  border-right: none !important;
  border-bottom: none !important;
  background: #fff !important;
}
${selector} th:last-child,
${selector} td:last-child {
  border-right: none !important;
}
${selector} thead tr:last-child th,
${selector} thead th[rowspan] {
  border-bottom: none !important;
}
${selector} tbody tr:last-child td {
  border-bottom: 0.5pt solid #000 !important;
}
${selector} th {
  background: #fff !important;
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
.gptc-sheet-title {
  margin: 0 0 6px;
  text-align: center;
  font-family: "Times New Roman", Times, serif;
  font-size: 13pt;
  font-weight: 700;
  text-transform: uppercase;
  line-height: 1.35;
}
.gptc-detail-project-line {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 0 0 6px;
  font-family: "Times New Roman", Times, serif;
  font-size: 13pt;
}
.gptc-detail-project-label { font-weight: 700; flex-shrink: 0; }
.gptc-detail-project-name,
.gptc-cell-text {
  white-space: pre-wrap;
  word-break: break-word;
}
.gptc-table-scroll { overflow: visible; }
.gptc-official-table {
  width: 100%;
  table-layout: fixed;
  font-family: "Times New Roman", Times, serif;
  font-size: 12pt;
}
${gptcTableCss(".gptc-official-table")}
.gptc-td-center { text-align: center; vertical-align: middle !important; }
.gptc-empty-row { text-align: center; padding: 8px !important; color: #64748b; }
.gptc-summary-table--print tbody tr {
  height: var(--gptc-summary-row-h, 14mm);
}
.gptc-summary-table--print tbody td {
  height: var(--gptc-summary-row-h, 14mm);
  min-height: var(--gptc-summary-row-h, 14mm);
  vertical-align: top;
}
.gptc-summary-table--print tbody tr:not(.gptc-summary-row--pad) td {
  height: auto;
  min-height: var(--gptc-summary-row-h, 14mm);
}
.gptc-detail-table--excel tbody td {
  height: var(--gptc-row-h, 9mm);
  min-height: var(--gptc-row-h, 9mm);
  max-height: var(--gptc-row-h, 9mm);
}
`;
}

export function printGptcPages(margins) {
  const sheetsHtml = collectPreviewSheets(
    ".gptc-print-stack--preview",
    ".gptc-print-page",
    ".gptc-print-inner"
  );
  if (!sheetsHtml) {
    window.alert("Chưa có tờ xem trước để in. Mở «Xem trước in» trước.");
    return;
  }
  printViaIframe({
    title: "Sổ cấp phép thi công",
    css: buildGptcPrintCss(margins),
    sheetsHtml
  });
}
