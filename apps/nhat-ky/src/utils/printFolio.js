/** Số trang bắt đầu khi in. Trống / không hợp lệ = không đánh số. */
export function parsePrintPageStart(raw) {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || raw < 1 || raw > 99999) return null;
    return Math.floor(raw);
  }
  const s = String(raw).trim();
  if (!s) return null;
  const n = Number.parseInt(s, 10);
  if (!Number.isFinite(n) || n < 1 || n > 99999) return null;
  return n;
}

export function printFolioMarkup(pageStart) {
  return parsePrintPageStart(pageStart) != null
    ? `<div class="nk-print-folio" aria-hidden="true"></div>`
    : "";
}

/** CSS số trang trong iframe in. Để trống pageStart thì ẩn. */
export function printFolioCss(pageStart) {
  const start = parsePrintPageStart(pageStart);
  if (start == null) {
    return `.nk-print-folio{display:none!important}`;
  }
  return `
body { counter-reset: nk-folio ${start - 1}; }
.sheet { counter-increment: nk-folio; position: relative; }
.nk-print-folio {
  display: block;
  position: absolute;
  left: 0;
  right: 0;
  bottom: 4mm;
  margin: 0;
  text-align: center;
  font-family: "Times New Roman", Times, serif;
  font-size: 11pt;
  line-height: 1;
  color: #000;
  pointer-events: none;
}
.nk-print-folio::after { content: counter(nk-folio); }
`;
}
