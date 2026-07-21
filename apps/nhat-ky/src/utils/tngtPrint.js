import {
  TNGT_COLS,
  getTngtColWidths,
  sumTngtCols
} from "../hooks/useTngtColWidths";
import {
  collectPreviewSheets,
  landscapePageShellCss,
  printViaIframe,
  excelThinTableCss
} from "./printViaIframe";

export function buildTngtPrintCss(margins, widths) {
  const w = widths || getTngtColWidths();
  const total = sumTngtCols(w) || 1;
  const colRules = TNGT_COLS.map(
    (col, i) =>
      `.tngt-table colgroup col:nth-child(${i + 1}){width:${((w[col.key] / total) * 100).toFixed(3)}%}`
  ).join("\n");

  return `
${landscapePageShellCss(margins)}
.tngt-title {
  text-align: center;
  font-family: "Times New Roman", Times, serif;
  font-size: 13pt;
  font-weight: 700;
  margin: 2px 0 2px;
}
.tngt-km-range {
  text-align: center;
  margin: 0 0 4px;
  font-family: "Times New Roman", Times, serif;
  font-size: 13pt;
}
.tngt-table {
  width: 100%;
  table-layout: fixed;
  font-family: "Times New Roman", Times, serif;
  font-size: 12pt;
  line-height: 1.3;
}
${colRules}
${excelThinTableCss(".tngt-table")}
.tngt-table th,
.tngt-table td {
  padding: 2px 3px;
  vertical-align: middle;
  text-align: center;
  word-wrap: break-word;
  overflow-wrap: anywhere;
}
.tngt-table th { font-weight: 700; font-size: 12pt; }
.tngt-col-num { display: block; font-weight: 600; font-size: 12pt; }
.tngt-col-note { text-align: left; white-space: pre-wrap; }
.tngt-col-mark { font-weight: 700; }
`;
}

export function printTngtPages(margins, widths) {
  const sheetsHtml = collectPreviewSheets(
    ".tngt-print-stack--preview",
    ".tngt-print-page",
    ".tngt-print-inner"
  );
  if (!sheetsHtml) {
    window.alert("Chưa có tờ xem trước để in. Bấm «In sổ TNGT» để mở xem trước trước.");
    return;
  }
  printViaIframe({
    title: "Sổ TNGT",
    css: buildTngtPrintCss(margins, widths || getTngtColWidths()),
    sheetsHtml
  });
}
