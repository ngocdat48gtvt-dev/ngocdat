import { eachIsoDateInclusive } from "./nhatKyPrintRows";
import { partsToIso, todayIso } from "./dateLocale";

/**
 * Các ngày đã có ghi chép nhật ký (không tính dòng đã xóa).
 * @returns {Set<string>} ISO yyyy-mm-dd
 */
export function collectDiaryFilledDates(entries) {
  const set = new Set();
  for (const entry of entries || []) {
    if (entry?.deletedAt) continue;
    const d = String(entry?.date || "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) set.add(d);
  }
  return set;
}

/**
 * Ngày chưa nhập liệu từ 01/01 năm hiện tại → hôm nay (không gồm tương lai).
 * @param {Set<string>|Iterable<string>} filledDates
 * @param {{ asOfIso?: string, year?: number }} [options]
 * @returns {string[]} ISO dates thiếu dữ liệu
 */
export function missingDiaryDatesYearToDate(filledDates, options = {}) {
  const asOf = String(options.asOfIso || todayIso()).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) return [];

  const year = options.year || Number(asOf.slice(0, 4));
  const from = `${year}-01-01`;
  let to = asOf;
  if (to < from) return [];
  const yearEnd = `${year}-12-31`;
  if (to > yearEnd) to = yearEnd;

  const filled =
    filledDates instanceof Set ? filledDates : new Set(filledDates || []);
  const missing = [];
  for (const iso of eachIsoDateInclusive(from, to)) {
    if (!filled.has(iso)) missing.push(iso);
  }
  return missing;
}

/** Số ngày thiếu trong tháng đang xem lịch (để hiện chú thích gọn). */
export function countMissingInMonth(missingDates, year, month) {
  const prefix = `${year}-${String(month).padStart(2, "0")}-`;
  let n = 0;
  for (const iso of missingDates || []) {
    if (String(iso).startsWith(prefix)) n += 1;
  }
  return n;
}

export function isoFromCalendarCell(year, month, day) {
  return partsToIso(year, month, day);
}
