/**
 * In qua iframe ẩn — cùng kiểu sổ mặt đường (không mở about:blank).
 */
export function printViaIframe({
  title,
  css,
  sheetsHtml,
  pageWMm = 297,
  pageHMm = 210
}) {
  if (!sheetsHtml) {
    window.alert("Chưa có tờ xem trước để in.");
    return;
  }

  const htmlDoc = `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"/>
<title>${title}</title>
<style>${css}</style>
</head><body>${sheetsHtml}</body></html>`;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", title);
  iframe.style.cssText = `position:fixed;left:-10000px;top:0;width:${pageWMm}mm;height:${pageHMm}mm;border:0;opacity:0;pointer-events:none;`;
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

/** Gom HTML các tờ preview → sheet in A4 ngang. */
export function collectPreviewSheets(stackSelector, pageSelector, innerSelector) {
  const pages = Array.from(
    document.querySelectorAll(`${stackSelector} ${pageSelector}`)
  );
  if (!pages.length) return "";
  return pages
    .map((page) => {
      const inner = page.querySelector(innerSelector);
      const html = inner ? inner.innerHTML : page.innerHTML;
      return `<div class="sheet"><div class="sheet-inner">${html}</div></div>`;
    })
    .join("\n");
}

/** CSS khung A4 ngang dùng chung (tiêu đề + bảng tùy sổ). */
export function landscapePageShellCss(margins) {
  const top = Number(margins?.top) || 0;
  const right = Number(margins?.right) || 0;
  const bottom = Number(margins?.bottom) || 0;
  const left = Number(margins?.left) || 0;
  return `
@page landscapePrintPage {
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
  font-family: "Times New Roman", Times, serif;
  font-size: 12pt;
}
.sheet {
  page: landscapePrintPage;
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
.no-print { display: none !important; }
.col-resize-handle { display: none !important; }
`;
}

/** Viền bảng kiểu Excel — nét mảnh (top+left; mép phải trên table để tránh đúp rowspan). */
export function excelThinTableCss(tableSelector, color = "#000") {
  const c = color || "#000";
  return `
${tableSelector} {
  border-collapse: separate !important;
  border-spacing: 0 !important;
  border: none !important;
  border-right: 0.5pt solid ${c} !important;
}
${tableSelector} th,
${tableSelector} td {
  border-top: 0.5pt solid ${c} !important;
  border-left: 0.5pt solid ${c} !important;
  border-right: none !important;
  border-bottom: none !important;
  background: #fff !important;
}
${tableSelector} th:last-child,
${tableSelector} td:last-child {
  border-right: none !important;
}
${tableSelector} thead th {
  border-bottom: none !important;
}
${tableSelector} tbody tr:last-child td {
  border-bottom: 0.5pt solid ${c} !important;
}
`;
}


