import { chainageExcelValue } from "../lib/excelReportBuilder";

/** Format Excel: số mét → hiển thị Km451+860 */
export const KM_EXCEL_NUM_FMT = '"Km"0"+"000';

/** Ô thập phân Việt (chuỗi "0,70"). */
export const DEC_EXCEL_NUM_FMT = "@";

/** Parse lý trình (chuỗi Km… / số) → số mét để ghi Excel + numFmt Km. */
export function excelKmNumber(value) {
  if (value == null || value === "") return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const n = chainageExcelValue(raw.replace(/^Km\s*/i, ""));
  return Number.isFinite(n) ? n : null;
}

/** Parse số (chấp nhận "0,70" hoặc "0.70") → Number hoặc null. */
export function excelDecimalNumber(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const s = String(value).trim().replace(/\s/g, "").replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Gán ô lý trình: value = số mét, hiển thị Km a+b.
 */
export function setExcelKmCell(cell, value) {
  const n = excelKmNumber(value);
  if (n == null) {
    cell.value = "";
    return false;
  }
  cell.value = n;
  cell.numFmt = KM_EXCEL_NUM_FMT;
  return true;
}

/**
 * Gán ô thập phân: số lẻ → chuỗi dấu phẩy "0,70"; số nguyên → Number.
 */
export function setExcelDecimalCell(cell, value, { forceDecimals = false } = {}) {
  const n = excelDecimalNumber(value);
  if (n == null) {
    cell.value = "";
    return false;
  }
  if (!forceDecimals && Number.isInteger(n)) {
    cell.value = n;
    cell.numFmt = "0";
    return true;
  }
  cell.value = n.toFixed(2).replace(".", ",");
  cell.numFmt = "@";
  return true;
}
