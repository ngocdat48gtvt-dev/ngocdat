import {
  MAT_DUONG_COLS,
  getMatDuongColWidths,
  sumMatDuongCols
} from "../hooks/useMatDuongColWidths";

/** CSS iframe/cửa sổ in — A4 ngang cố định kích thước mm (tránh Chrome ép dọc). */
export function buildMatDuongPrintCss(margins, widths) {
  const top = Number(margins?.top) || 0;
  const right = Number(margins?.right) || 0;
  const bottom = Number(margins?.bottom) || 0;
  const left = Number(margins?.left) || 0;
  const w = widths || getMatDuongColWidths();
  const total = sumMatDuongCols(w) || 1;

  const colRules = MAT_DUONG_COLS.map(
    (col, i) =>
      `.matduong-table colgroup col:nth-child(${i + 1}){width:${((w[col.key] / total) * 100).toFixed(3)}%}`
  ).join("\n");

  return `
@page matDuongPrintPage {
  size: 297mm 210mm;
  margin: 0;
}
* { box-sizing: border-box; }
html, body {
  margin: 0;
  padding: 0;
  width: 297mm;
  background: #fff;
  color: #111827;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
  font-family: "Times New Roman", "Segoe UI", serif;
}
.sheet {
  page: matDuongPrintPage;
  width: 297mm;
  height: 209.8mm;
  max-height: 209.8mm;
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
.matduong-sheet-top { flex: 0 0 auto; }
.matduong-sheet-head {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
  margin-bottom: 4px;
}
.matduong-head-left,
.matduong-head-right {
  text-align: center;
  font-weight: 700;
  font-size: 14px;
  line-height: 1.45;
}
.matduong-head-line { margin: 0 0 1px; }
.matduong-motto {
  text-decoration: underline;
  text-underline-offset: 5px;
}
.matduong-title {
  text-align: center;
  font-size: 18px;
  font-weight: 700;
  margin: 4px 0 2px;
  letter-spacing: 0.02em;
}
.matduong-km-range {
  text-align: center;
  margin: 0 0 4px;
  font-size: 14px;
}
.matduong-table-area {
  flex: 0 0 auto;
}
.matduong-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 13.5px;
  line-height: 1.35;
  margin-top: 2px;
}
${colRules}
.matduong-table th,
.matduong-table td {
  border: 0.5pt solid #222;
  padding: 3px 5px;
  vertical-align: middle;
  text-align: center;
  word-wrap: break-word;
  overflow-wrap: anywhere;
}
.matduong-table th {
  font-weight: 700;
  background: #fff;
  font-size: 12.5px;
  line-height: 1.3;
}
.matduong-header-num th {
  font-size: 12px;
  padding: 2px 3px;
}
.matduong-header-side {
  display: block;
  font-weight: 600;
  font-size: 11.5px;
}
.matduong-col-damage,
.matduong-col-note {
  text-align: left;
  white-space: pre-wrap;
}
.matduong-col-date,
.matduong-col-side {
  white-space: nowrap;
}
.no-print { display: none !important; }
.col-resize-handle { display: none !important; }
`;
}

/**
 * In qua iframe ẩn — không mở cửa sổ Chrome trắng (about:blank).
 */
export function printMatDuongPages(margins, widths) {
  const pages = Array.from(
    document.querySelectorAll(".matduong-print-stack--preview .matduong-print-page")
  );
  if (!pages.length) {
    window.alert("Chưa có tờ xem trước để in. Bấm «In sổ mặt đường» để mở xem trước trước.");
    return;
  }

  const w = widths || getMatDuongColWidths();
  const sheetsHtml = pages
    .map((page) => {
      const inner = page.querySelector(".matduong-print-inner");
      const html = inner ? inner.innerHTML : page.innerHTML;
      return `<div class="sheet"><div class="sheet-inner">${html}</div></div>`;
    })
    .join("\n");

  const htmlDoc = `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"/>
<title>Sổ mặt đường</title>
<style>${buildMatDuongPrintCss(margins, w)}</style>
</head><body>${sheetsHtml}</body></html>`;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", "In sổ mặt đường");
  iframe.style.cssText =
    "position:fixed;left:-10000px;top:0;width:297mm;height:210mm;border:0;opacity:0;pointer-events:none;";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    window.alert("Không tạo được bản in. Thử lại.");
    return;
  }

  doc.open();
  doc.write(htmlDoc);
  doc.close();

  const win = iframe.contentWindow;
  const cleanup = () => {
    try {
      iframe.remove();
    } catch {
      /* ignore */
    }
  };

  const doPrint = () => {
    try {
      win.focus();
      win.print();
    } finally {
      setTimeout(cleanup, 1200);
    }
  };

  const kick = () => setTimeout(doPrint, 280);
  if (doc.readyState === "complete") {
    kick();
  } else {
    iframe.onload = kick;
    setTimeout(doPrint, 700);
  }
}
