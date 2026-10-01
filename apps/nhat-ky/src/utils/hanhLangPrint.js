import {
  HANH_LANG_COLS,
  getHanhLangColWidths,
  sumHanhLangCols
} from "../hooks/useHanhLangColWidths";
import {
  collectPreviewSheets,
  landscapePageShellCss,
  printViaIframe,
  excelThinTableCss
} from "./printViaIframe";

export function buildHanhLangPrintCss(margins, widths) {
  const w = widths || getHanhLangColWidths();
  const total = sumHanhLangCols(w) || 1;
  const colRules = HANH_LANG_COLS.map(
    (col, i) =>
      `.hanh-lang-table colgroup col:nth-child(${i + 1}){width:${((w[col.key] / total) * 100).toFixed(3)}%}`
  ).join("\n");

  return `
${landscapePageShellCss(margins)}
.hanh-lang-sheet-top { flex: 0 0 auto; }
.hanh-lang-sheet-head {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
  margin-bottom: 4px;
}
.hanh-lang-head-left,
.hanh-lang-head-right {
  text-align: center;
  font-weight: 700;
  font-family: "Times New Roman", Times, serif;
  font-size: 13pt;
  line-height: 1.4;
}
.hanh-lang-head-line { margin: 0 0 1px; }
.hanh-lang-head-line--company {
  white-space: pre;
  overflow-wrap: normal;
  word-break: normal;
}
.hanh-lang-motto {
  text-decoration: underline;
  text-underline-offset: 4px;
}
.hanh-lang-title {
  text-align: center;
  font-family: "Times New Roman", Times, serif;
  font-size: 13pt;
  font-weight: 700;
  margin: 4px 0 2px;
}
.hanh-lang-km-range {
  text-align: center;
  margin: 0 0 4px;
  font-family: "Times New Roman", Times, serif;
  font-size: 13pt;
}
.hanh-lang-table-area { flex: 0 0 auto; }
.hanh-lang-table {
  width: 100%;
  table-layout: fixed;
  font-family: "Times New Roman", Times, serif;
  font-size: 12pt;
  line-height: 1.3;
}
${colRules}
${excelThinTableCss(".hanh-lang-table")}
.hanh-lang-table th,
.hanh-lang-table td {
  padding: 2px 3px;
  vertical-align: middle;
  text-align: center;
  word-wrap: break-word;
  overflow-wrap: anywhere;
}
.hanh-lang-table th { font-weight: 700; font-size: 12pt; }
.hanh-lang-header-num th { font-size: 12pt; font-style: italic; }
.hanh-lang-col-content,
.hanh-lang-col-process { text-align: left; white-space: pre-wrap; }
.hanh-lang-footer-label { font-weight: 700; text-align: center; }
`;
}

export function printHanhLangPages(margins, widths) {
  const sheetsHtml = collectPreviewSheets(
    ".hanh-lang-print-stack--preview",
    ".hanh-lang-print-page",
    ".hanh-lang-print-inner"
  );
  if (!sheetsHtml) {
    window.alert("Chưa có tờ xem trước để in. Bấm «In sổ hành lang» để mở xem trước trước.");
    return;
  }
  printViaIframe({
    title: "Sổ hành lang",
    css: buildHanhLangPrintCss(margins, widths || getHanhLangColWidths()),
    sheetsHtml
  });
}
