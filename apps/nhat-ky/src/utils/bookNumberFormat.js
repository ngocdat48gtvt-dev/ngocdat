/** Parse số trên sổ (chấp nhận "0,70" hoặc "0.70"). */
export function parseBookNumber(value) {
  if (value == null || value === "") return NaN;
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  const s = String(value).trim().replace(/\s/g, "").replace(",", ".");
  if (!s) return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Hiển thị số trên sổ / biên bản:
 * luôn 2 chữ số thập phân, dấu phẩy (2.5 → 2,50).
 */
export function formatBookDecimal(value, { allowZero = false } = {}) {
  const n = parseBookNumber(value);
  if (!Number.isFinite(n)) return "";
  if (!allowZero && n <= 0) return "";
  return n.toFixed(2).replace(".", ",");
}
