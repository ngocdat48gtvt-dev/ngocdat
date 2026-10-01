import { collectPreviewSheets, printViaIframe } from "./printViaIframe";

/** CSS in sổ đếm xe theo quý — A4 dọc, lề theo margins (mm). */
export function buildDemXeQuarterPrintCss(margins = {}) {
  const top = Number(margins?.top) || 0;
  const right = Number(margins?.right) || 0;
  const bottom = Number(margins?.bottom) || 0;
  const left = Number(margins?.left) || 0;

  return `
@page demXeQuarterPage {
  size: A4 portrait;
  margin: 0;
}
* { box-sizing: border-box; }
html, body {
  margin: 0;
  padding: 0;
  width: 210mm;
  background: #fff;
  color: #0f172a;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
  font-family: "Times New Roman", Times, serif;
}
.sheet {
  page: demXeQuarterPage;
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
}
.no-print { display: none !important; }
.nhatky-margin-guides { display: none !important; }
.demxe-xcell-input,
.demxe-count-sheet--editable .demxe-xcell-input {
  border: none !important;
  background: transparent !important;
  box-shadow: none !important;
  width: 100%;
  font: inherit;
  text-align: inherit;
  padding: 0;
}
.demxe-info-meta-table td.demxe-info-cell { width: 50%; }
.demxe-info-cell__inner {
  display: flex;
  flex-direction: row;
  align-items: center;
  flex-wrap: nowrap;
  gap: 6px;
  width: 100%;
  min-width: 0;
}
.demxe-info-cell__label { flex: 0 0 auto; white-space: nowrap; }
.demxe-info-cell__edit { flex: 1 1 auto; min-width: 0; }
.demxe-info-meta-table .demxe-xcell-input--inline {
  display: block !important;
  width: 100% !important;
  height: auto !important;
  min-height: 0 !important;
  padding: 0 !important;
}
.demxe-summary-page,
.demxe-count-sheet--a4 {
  width: 100%;
  min-height: 0;
  max-width: none;
  margin: 0;
  padding: 0 !important;
  border: none !important;
  box-shadow: none !important;
  page-break-after: auto;
  display: flex;
  flex-direction: column;
  font-family: "Times New Roman", Times, serif;
  font-size: 12pt;
  color: #0f172a;
}
.demxe-count-sheet--a4 { font-size: 12pt; }
.demxe-summary-page__head { flex-shrink: 0; margin-bottom: 8px; }
.demxe-summary-title,
.demxe-form-title {
  text-align: center;
  font-family: "Times New Roman", Times, serif;
  font-size: 13pt;
  font-weight: 700;
  margin: 0 0 4px;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}
.demxe-form-title {
  font-size: 13pt;
  margin: 8px 0 6px;
  text-transform: none;
}
.demxe-summary-subtitle,
.demxe-form-subline {
  text-align: center;
  margin: 0 0 4px;
  font-family: "Times New Roman", Times, serif;
  font-size: 13pt;
}
.demxe-form-ref {
  margin: 0;
  font-family: "Times New Roman", Times, serif;
  font-size: 13pt;
}
.demxe-form-subline--center { text-align: center; }
.demxe-official-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  border: none;
  border-right: 0.5pt solid #808080;
  table-layout: fixed;
}
.demxe-official-table th,
.demxe-official-table td {
  border-top: 0.5pt solid #808080;
  border-left: 0.5pt solid #808080;
  border-right: none;
  border-bottom: none;
  padding: 3px 4px;
  vertical-align: middle;
  background: #fff;
}
.demxe-official-table th:last-child,
.demxe-official-table td:last-child { border-right: none; }
.demxe-official-table thead th { border-bottom: none; }
.demxe-official-table tbody tr:last-child td { border-bottom: 0.5pt solid #808080; }
.demxe-summary-official-table + .demxe-summary-official-table { margin-top: 5mm; }
.demxe-summary-official-table th {
  font-weight: 700;
  text-align: center;
  font-size: 12pt;
}
.demxe-summary-direction-cell { text-align: center; font-size: 12pt; }
.demxe-summary-type-cell { text-align: left; font-size: 12pt; }
.demxe-num { text-align: center; }
.demxe-summary-sign-row,
.demxe-sign-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 10px;
  text-align: center;
  font-size: 13px;
}
.demxe-summary-sign-row p,
.demxe-sign-row p { margin: 0; }
.demxe-info-meta-table { margin-bottom: 0; }
.demxe-info-cell { font-size: 12pt; }
.demxe-count-data-table { margin-top: 5mm; }
.demxe-count-data-table th { font-weight: 700; text-align: center; text-transform: uppercase; }
.demxe-col-type { text-align: left; width: 38%; }
.demxe-col-count { text-align: center; width: 52%; }
.demxe-col-sum { text-align: center; width: 10%; }
.demxe-col-count--tally { height: auto !important; padding: 2px 3px !important; }
.demxe-count-cell { position: relative; min-height: 18px; }
.demxe-tally { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; }
.demxe-tally-row { display: flex; flex-wrap: nowrap; gap: 1.5px; justify-content: flex-start; }
.demxe-tally-box { stroke: #000; stroke-width: 1.5; fill: none; }
.demxe-count-num-input { display: none !important; }
.demxe-quarter-print-kicker { display: none !important; }
`;
}

export function printDemXeQuarterPages(margins) {
  const sheetsHtml = collectPreviewSheets(
    ".demxe-quarter-print-stack--preview",
    ".demxe-quarter-print-page",
    ".demxe-quarter-print-inner"
  );
  if (!sheetsHtml) {
    window.alert("Chưa có tờ xem trước để in. Bấm «In sổ quý này» để mở xem trước trước.");
    return;
  }
  printViaIframe({
    title: "Sổ đếm xe theo quý",
    css: buildDemXeQuarterPrintCss(margins),
    sheetsHtml,
    pageWMm: 210,
    pageHMm: 297
  });
}
