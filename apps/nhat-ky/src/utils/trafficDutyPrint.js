import {
  TRAFFIC_DUTY_COLS,
  getTrafficDutyColWidths,
  sumTrafficDutyCols
} from "../hooks/useTrafficDutyColWidths";
import {
  collectPreviewSheets,
  landscapePageShellCss,
  printViaIframe,
  excelThinTableCss
} from "./printViaIframe";

export function buildTrafficDutyPrintCss(margins, widths) {
  const w = widths || getTrafficDutyColWidths();
  const total = sumTrafficDutyCols(w) || 1;
  const colRules = TRAFFIC_DUTY_COLS.map(
    (col, i) =>
      `.traffic-duty-table colgroup col:nth-child(${i + 1}){width:${((w[col.key] / total) * 100).toFixed(3)}%}`
  ).join("\n");

  return `
${landscapePageShellCss(margins)}
.traffic-duty-title {
  text-align: center;
  font-family: "Times New Roman", Times, serif;
  font-size: 13pt;
  font-weight: 700;
  margin: 2px 0 2px;
}
.traffic-duty-km-range {
  text-align: center;
  margin: 0 0 4px;
  font-family: "Times New Roman", Times, serif;
  font-size: 13pt;
}
.traffic-duty-table {
  width: 100%;
  table-layout: fixed;
  font-family: "Times New Roman", Times, serif;
  font-size: 11pt;
  line-height: 1.25;
}
${colRules}
${excelThinTableCss(".traffic-duty-table")}
.traffic-duty-table th,
.traffic-duty-table td {
  padding: 2px 2px;
  vertical-align: middle;
  text-align: center;
  word-wrap: break-word;
  overflow-wrap: anywhere;
  font-size: 11pt;
}
.traffic-duty-table th { font-weight: 700; font-size: 11pt; }
.traffic-duty-col-damage,
.traffic-duty-col-editable { text-align: left; }
.traffic-duty-pre {
  margin: 0;
  white-space: pre-wrap;
  font-family: inherit;
  font-size: inherit;
  text-align: left;
}
`;
}

export function printTrafficDutyPages(margins, widths) {
  const sheetsHtml = collectPreviewSheets(
    ".traffic-duty-print-stack--preview",
    ".traffic-duty-print-page",
    ".traffic-duty-print-inner"
  );
  if (!sheetsHtml) {
    window.alert("Chưa có tờ xem trước để in. Bấm «In sổ trực ĐBGT» để mở xem trước trước.");
    return;
  }
  printViaIframe({
    title: "Sổ trực ĐBGT",
    css: buildTrafficDutyPrintCss(margins, widths || getTrafficDutyColWidths()),
    sheetsHtml
  });
}
