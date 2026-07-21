import {
  PHIEU_CAU_COLS,
  getPhieuCauColWidths,
  sumPhieuCauCols
} from "../hooks/usePhieuCauColWidths";
import {
  collectPreviewSheets,
  landscapePageShellCss,
  printViaIframe
} from "./printViaIframe";

export function buildPhieuCauPrintCss(margins, widths) {
  const w = widths || getPhieuCauColWidths();
  const total = sumPhieuCauCols(w) || 1;
  const colRules = PHIEU_CAU_COLS.map(
    (col, i) =>
      `.phieu-cau-table colgroup col:nth-child(${i + 1}){width:${((w[col.key] / total) * 100).toFixed(3)}%}`
  ).join("\n");

  return `
${landscapePageShellCss(margins)}
.phieu-cau-header { flex-shrink: 0; text-align: center; margin-bottom: 2px; }
.phieu-cau-org {
  font-family: "Times New Roman", Times, serif;
  font-size: 12pt;
  font-weight: 600;
  line-height: 1.2;
}
.phieu-cau-title {
  margin: 1px 0 2px;
  font-family: "Times New Roman", Times, serif;
  font-size: 12pt;
  font-weight: 700;
  line-height: 1.2;
}
.phieu-cau-meta {
  margin: 0;
  font-family: "Times New Roman", Times, serif;
  font-size: 11pt;
  text-align: left;
  line-height: 1.25;
}
.phieu-cau-meta--unit { display: flex; align-items: baseline; gap: 4px; width: 100%; }
.phieu-cau-unit-value {
  flex: 1 1 auto;
  min-width: 0;
  font-weight: 700;
  border-bottom: none !important;
  text-decoration: none !important;
}
.phieu-cau-table-wrap {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: visible;
}
.phieu-cau-table {
  width: 100%;
  height: 100%;
  table-layout: fixed;
  font-family: "Times New Roman", Times, serif;
  font-size: 11pt;
  line-height: 1.15;
  border-collapse: separate !important;
  border-spacing: 0 !important;
  border: none !important;
  border-right: 0.5pt solid #000 !important;
}
${colRules}
/* 1 nét mảnh Excel: chỉ top+left; mép phải = border bảng (tránh đúp với rowspan Ghi chú) */
.phieu-cau-table th,
.phieu-cau-table td {
  border-top: 0.5pt solid #000 !important;
  border-left: 0.5pt solid #000 !important;
  border-right: none !important;
  border-bottom: none !important;
  background: #fff !important;
  padding: 0 2px;
  vertical-align: middle;
  word-wrap: break-word;
  overflow-wrap: anywhere;
}
.phieu-cau-table th:last-child,
.phieu-cau-table td:last-child {
  border-right: none !important;
}
.phieu-cau-table thead th {
  border-bottom: none !important;
}
.phieu-cau-table tbody tr:last-child td {
  border-bottom: 0.5pt solid #000 !important;
}
.phieu-cau-table th {
  font-weight: 700;
  font-size: 11pt;
  text-align: center;
  line-height: 1.15;
}
.phieu-cau-table tbody td {
  height: var(--phieu-row-h, 8mm);
  max-height: var(--phieu-row-h, 8mm);
  font-size: 11pt;
}
.phieu-cau-stt,
.phieu-cau-date-cell { text-align: center; }
.phieu-cau-date-cell {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.phieu-cau-sign { background: #fff; }
`;
}

export function printPhieuCauPages(margins, widths) {
  const sheetsHtml = collectPreviewSheets(
    ".phieu-cau-print-stack--preview",
    ".phieu-cau-print-page",
    ".phieu-cau-print-inner"
  );
  if (!sheetsHtml) {
    window.alert("Chưa có tờ xem trước để in. Mở «Xem trước in» trước.");
    return;
  }
  printViaIframe({
    title: "Phiếu kiểm tra cầu",
    css: buildPhieuCauPrintCss(margins, widths || getPhieuCauColWidths()),
    sheetsHtml
  });
}
