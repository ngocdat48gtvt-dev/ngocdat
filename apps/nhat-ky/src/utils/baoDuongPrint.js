import {
  BAO_DUONG_COLS,
  getBaoDuongColWidths,
  sumBaoDuongCols
} from "../hooks/useBaoDuongColWidths";

/** CSS dự phòng khi in qua iframe — A4 dọc. */
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
@page {
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
  font-family: "Times New Roman", "Segoe UI", serif;
}
.sheet {
  width: 210mm;
  min-height: 296.8mm;
  padding: ${top}mm ${right}mm ${bottom}mm ${left}mm;
  overflow: hidden;
  page-break-after: always;
  break-after: page;
}
.sheet:last-child {
  page-break-after: auto;
  break-after: auto;
}
.sheet-inner {
  width: 100%;
  display: flex;
  flex-direction: column;
}
.baoduong-title {
  text-align: center;
  font-size: 15px;
  font-weight: 700;
  margin: 0 0 8px;
  line-height: 1.35;
  text-transform: uppercase;
}
.baoduong-period { margin: 0 0 4px; font-size: 13px; }
.baoduong-intro { margin: 0 0 8px; font-size: 13px; }
.baoduong-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 12.5px;
  line-height: 1.35;
}
${colRules}
.baoduong-table th,
.baoduong-table td {
  border: 0.5pt solid #222;
  padding: 4px 5px;
  vertical-align: top;
  word-wrap: break-word;
  overflow-wrap: anywhere;
}
.baoduong-table th {
  font-weight: 700;
  text-align: center;
  font-size: 11.5px;
  vertical-align: middle;
}
.baoduong-header-num th { font-size: 11px; padding: 2px 3px; }
.baoduong-col-stt { text-align: center; vertical-align: middle; }
.baoduong-pre {
  margin: 0;
  white-space: pre-wrap;
  font-family: inherit;
  font-size: inherit;
  text-align: left;
}
.baoduong-sign {
  margin-top: 8px;
  display: flex;
  justify-content: flex-end;
  padding-right: 4%;
}
.baoduong-sign-box { width: 45%; text-align: center; font-size: 13px; }
.baoduong-sign-role { font-weight: 700; margin-bottom: 4px; }
.baoduong-sign-hint { font-size: 12px; color: #334155; }
.no-print { display: none !important; }
.col-resize-handle { display: none !important; }
`;
}

/**
 * In sổ BDTX — ưu tiên in trực tiếp từ xem trước (body class),
 * tránh iframe ẩn (Chrome hay in nhầm trang app / khổ ngang phiếu KT).
 */
export function printBaoDuongPages(margins, widths) {
  const pages = Array.from(
    document.querySelectorAll(".baoduong-print-stack--preview .baoduong-print-page")
  );
  if (!pages.length) {
    window.alert("Chưa có tờ xem trước để in. Bấm «In sổ bảo dưỡng» để mở xem trước trước.");
    return;
  }

  // In từ DOM xem trước — ổn định trên Chrome
  document.body.classList.add("baoduong-printing");
  const cleanup = () => {
    document.body.classList.remove("baoduong-printing");
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  // Fallback nếu afterprint không chạy (một số trình duyệt)
  window.setTimeout(cleanup, 60_000);
  window.setTimeout(() => {
    window.print();
  }, 80);
}
