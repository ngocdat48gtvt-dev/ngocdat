/** CSS tối thiểu cho iframe in — mỗi .sheet = đúng 1 tờ A4. */
export function buildNhatKyPrintCss(margins) {
  const top = Number(margins?.top) || 0;
  const right = Number(margins?.right) || 0;
  const bottom = Number(margins?.bottom) || 0;
  const left = Number(margins?.left) || 0;

  // Quan trọng: @page margin = 0, lề nằm trong .sheet (padding).
  // Nếu vừa height 297mm vừa @page margin > 0 → Chrome tạo trang trống xen kẽ (4 tờ → 8 trang).
  return `
@page {
  size: A4 portrait;
  margin: 0;
}
* { box-sizing: border-box; }
html, body {
  margin: 0;
  padding: 0;
  background: #fff;
  color: #0f172a;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
  font-family: "Times New Roman", Times, serif;
  font-size: 12pt;
}
.sheet {
  width: 210mm;
  /* Hơi thấp hơn 297mm để tránh làm tròn mm/px tạo trang trống */
  height: 296.8mm;
  max-height: 296.8mm;
  padding: ${top}mm ${right}mm ${bottom}mm ${left}mm;
  overflow: hidden;
  page-break-after: always;
  break-after: page;
  page-break-inside: avoid;
  break-inside: avoid;
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
.nhatky-print-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  border: none;
  border-right: 0.5pt solid #000;
  table-layout: fixed;
  font-size: 12pt;
  line-height: 1.35;
  font-family: "Times New Roman", Times, serif;
}
.nhatky-print-table th,
.nhatky-print-table td {
  border-top: 0.5pt solid #000;
  border-left: 0.5pt solid #000;
  border-right: none;
  border-bottom: none;
  vertical-align: top;
  padding: 4px 5px;
  word-wrap: break-word;
  overflow-wrap: anywhere;
  background: #fff;
}
.nhatky-print-table th:last-child,
.nhatky-print-table td:last-child {
  border-right: none;
}
.nhatky-print-table thead th {
  border-bottom: none;
}
.nhatky-print-table tbody tr:last-child td {
  border-bottom: 0.5pt solid #000;
}
.nhatky-print-head-main th {
  background: #e8eefc;
  font-weight: 700;
  font-size: 12pt;
  text-align: center;
  line-height: 1.25;
}
.nhatky-print-head-num th {
  background: #f1f5f9;
  font-weight: 700;
  text-align: center;
  font-size: 12pt;
  padding: 2px 4px;
}
.nhatky-print-pre {
  margin: 0;
  white-space: pre-wrap;
  font-family: inherit;
  font-size: inherit;
}
.nhatky-print-empty {
  color: #111827;
  font-family: "Times New Roman", Times, serif;
  font-size: 12pt;
  font-style: normal;
}
.nhatky-print-row--part .nhatky-print-td--3 {
  font-weight: 800;
  font-size: 12px;
  color: #1e3a8a;
  background: #f8fafc;
}
.nhatky-print-row--section .nhatky-print-td--3 {
  font-weight: 700;
  color: #1e3a8a;
}
.nhatky-print-row--weather .nhatky-print-td--1 {
  font-weight: 600;
  text-align: center;
}
`;
}

/**
 * In qua iframe riêng — mỗi .nhatky-print-page thành 1 tờ A4,
 * tránh bị gộp 1 trang như khi in trong layout flex của app.
 */
export function printNhatKyPages(margins) {
  const pages = Array.from(
    document.querySelectorAll(".nhatky-print-stack--preview .nhatky-print-page")
  );
  if (!pages.length) {
    window.print();
    return;
  }

  const sheetsHtml = pages
    .map((page) => {
      const table = page.querySelector("table");
      const inner = table ? table.outerHTML : page.innerHTML;
      return `<div class="sheet"><div class="sheet-inner">${inner}</div></div>`;
    })
    .join("\n");

  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", "In sổ nhật ký");
  iframe.style.cssText =
    "position:fixed;left:-10000px;top:0;width:210mm;height:297mm;border:0;opacity:0;pointer-events:none;";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    window.print();
    return;
  }

  doc.open();
  doc.write(`<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"/>
<title>Sổ nhật ký</title>
<style>${buildNhatKyPrintCss(margins)}</style>
</head><body>${sheetsHtml}</body></html>`);
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

  // Đợi layout iframe ổn định rồi mở hộp thoại in.
  const kick = () => setTimeout(doPrint, 250);
  if (doc.readyState === "complete") {
    kick();
  } else {
    iframe.onload = kick;
    setTimeout(doPrint, 600);
  }
}
