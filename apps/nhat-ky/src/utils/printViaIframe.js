/**
 * In qua iframe ẩn — cùng kiểu sổ mặt đường (không mở about:blank).
 *
 * Lưu ý: header/footer của Chrome/Edge (tiêu đề, URL, ngày, số trang) do hộp thoại
 * in quyết định — web không tắt được hẳn. Ta để <title> trống để giảm chữ đầu trang.
 */
export function printViaIframe({
  title = "",
  css,
  sheetsHtml,
  pageWMm = 297,
  pageHMm = 210,
  /** Để trống title trong PDF (mặc định true — tránh header trình duyệt hiện tên sổ). */
  blankDocumentTitle = true,
  /** Chờ trước khi mở hộp thoại in (ms). Khoảng dài nên lớn hơn. */
  printDelayMs = 280
}) {
  if (!sheetsHtml) {
    window.alert("Chưa có tờ xem trước để in.");
    return;
  }

  const delay = Math.max(80, Number(printDelayMs) || 280);
  const docTitle = blankDocumentTitle ? "" : String(title || "");
  const htmlDoc = `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"/>
<title>${docTitle}</title>
<style>${css}</style>
</head><body>${sheetsHtml}</body></html>`;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", title || "In");
  /** opacity:0 khiến Chrome chụp PDF trống khi HTML dài (khoảng nhiều ngày). */
  iframe.style.cssText = `position:fixed;left:-12000px;top:0;width:${pageWMm}mm;height:${pageHMm}mm;border:0;opacity:1;pointer-events:none;background:#fff;`;
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  if (!win) {
    iframe.remove();
    window.alert("Không tạo được bản in. Thử lại.");
    return;
  }

  const prevTitle = document.title;
  let printed = false;
  let cleaned = false;
  let blobUrl = "";
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    try {
      document.title = prevTitle;
    } catch {
      /* ignore */
    }
    try {
      iframe.remove();
    } catch {
      /* ignore */
    }
    if (blobUrl) {
      try {
        URL.revokeObjectURL(blobUrl);
      } catch {
        /* ignore */
      }
      blobUrl = "";
    }
  };

  const doPrint = () => {
    if (printed) return;
    printed = true;
    const printWin = iframe.contentWindow || win;
    try {
      printWin.addEventListener("afterprint", cleanup);
    } catch {
      /* ignore */
    }
    try {
      if (blankDocumentTitle) document.title = "";
      void printWin.document?.body?.offsetHeight;
      printWin.focus();
      printWin.print();
    } finally {
      /** Khoảng dài: Chrome còn dựng PDF sau khi print() trả về — giữ iframe. */
      setTimeout(cleanup, 180000);
    }
  };

  const kick = () => setTimeout(doPrint, delay);

  /** HTML lớn: blob URL tránh khóa tab khi doc.write hàng trăm tờ.
   * Không thu hồi URL trước print() — Chrome Save as PDF sẽ ra trang trắng. */
  if (htmlDoc.length > 250000) {
    const blob = new Blob([htmlDoc], { type: "text/html;charset=utf-8" });
    blobUrl = URL.createObjectURL(blob);
    iframe.onload = () => kick();
    iframe.src = blobUrl;
    setTimeout(() => {
      if (!printed) kick();
    }, delay + 900);
    return;
  }

  const doc = iframe.contentDocument || win.document;
  if (!doc) {
    iframe.remove();
    window.alert("Không tạo được bản in. Thử lại.");
    return;
  }

  doc.open();
  doc.write(htmlDoc);
  doc.close();

  if (doc.readyState === "complete") {
    kick();
  } else {
    iframe.onload = kick;
    setTimeout(doPrint, delay + 420);
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
/* Đáy khối thead: ô rowspan + hàng phụ cuối (tránh mất nét dưới tiêu đề). */
${tableSelector} thead th[rowspan],
${tableSelector} thead tr:last-child:not(.tngt-header-num) th,
${tableSelector} thead tr.tngt-header-sub th {
  border-bottom: 0.5pt solid ${c} !important;
}
${tableSelector} thead tr.tngt-header-num th {
  border-top: none !important;
  border-bottom: 0.5pt solid ${c} !important;
}
/* Mỗi hàng thân có nét đáy — không chỉ :last-child. */
${tableSelector} tbody td {
  border-top: none !important;
  border-bottom: 0.5pt solid ${c} !important;
}
`;
}
