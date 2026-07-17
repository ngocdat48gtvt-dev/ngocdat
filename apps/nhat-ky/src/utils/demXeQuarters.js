import { COUNT_BATCH_DAYS } from "./demXeConstants";
import { formatDemXeTime } from "./demXeFormFormat";
import { ensureDayDirections } from "./demXeStore";

/** Tháng cuối mỗi quý: III, VI, IX, XII. */
export const QUARTER_LAST_MONTHS = [3, 6, 9, 12];
export const QUARTER_ROMAN = ["I", "II", "III", "IV"];
export const QUARTER_COUNT_DAYS = [5, 6, 7];

export function ledgerYear(cover = {}) {
  const y = parseInt(String(cover?.nam || "").trim(), 10);
  return Number.isFinite(y) && y > 1900 ? y : new Date().getFullYear();
}

export function isoDate(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Giờ đếm theo TCVN 14182 — trạm chính ngày 5, 6 (16/24h) và ngày 7 (24/24h). */
export function countingHoursForDate(dateIso) {
  const day = parseInt(String(dateIso || "").split("-")[2], 10);
  if (day === 5 || day === 6) {
    return {
      startTime: "05:00",
      endTime: "21:00",
      hoursLabel: `${formatDemXeTime("05:00")} – ${formatDemXeTime("21:00")}`
    };
  }
  if (day === 7) {
    return {
      startTime: "00:00",
      endTime: "23:59",
      hoursLabel: `${formatDemXeTime("00:00")} – ${formatDemXeTime("23:59")}`
    };
  }
  return { startTime: "", endTime: "", hoursLabel: "" };
}

export function buildYearQuarters(year) {
  const y = parseInt(String(year), 10) || new Date().getFullYear();
  return QUARTER_LAST_MONTHS.map((month, idx) => {
    const dates = QUARTER_COUNT_DAYS.map((d) => isoDate(y, month, d));
    return {
      key: `${y}-Q${idx + 1}`,
      quarter: idx + 1,
      roman: QUARTER_ROMAN[idx],
      label: `Quý ${QUARTER_ROMAN[idx]}`,
      month,
      year: y,
      startDate: dates[0],
      endDate: dates[dates.length - 1],
      dates,
      schedule: dates.map((date) => ({
        date,
        ...countingHoursForDate(date)
      }))
    };
  });
}

export function currentQuarterIndex(date = new Date()) {
  const m = date.getMonth() + 1;
  if (m <= 3) return 0;
  if (m <= 6) return 1;
  if (m <= 9) return 2;
  return 3;
}

export function materializeQuarterDays(days, quarter, seed = {}) {
  const next = { ...days };
  quarter.dates.forEach((date) => {
    const hours = countingHoursForDate(date);
    const daySeed = {
      ...seed,
      startTime: hours.startTime,
      endTime: hours.endTime
    };
    const existing = next[date];
    if (!existing) {
      next[date] = ensureDayDirections({ directions: [] }, daySeed);
      return;
    }
    const ensured = ensureDayDirections(existing, daySeed);
    ensured.directions = ensured.directions.map((d) => ({
      ...d,
      startTime: d.startTime || hours.startTime,
      endTime: d.endTime || hours.endTime
    }));
    next[date] = ensured;
  });
  return next;
}

/** Bổ sung đủ 4 quý của năm (không xóa dữ liệu đã nhập). */
export function ensureYearQuartersInLedger(ledger, year) {
  const y = parseInt(String(year), 10) || ledgerYear(ledger?.cover);
  const quarters = buildYearQuarters(y);
  const seed = {
    roadName: ledger?.cover?.tenDuong || "",
    lyTrinh: "",
    from: "",
    to: ""
  };
  let days = { ...(ledger?.days || {}) };
  quarters.forEach((q) => {
    days = materializeQuarterDays(days, q, seed);
  });

  const cover = { ...(ledger?.cover || {}) };
  if (!String(cover.nam || "").trim()) cover.nam = String(y);
  if (!cover.ngayBatDau) cover.ngayBatDau = quarters[0].dates[0];
  if (!cover.ngayKetThuc) cover.ngayKetThuc = quarters[3].dates[COUNT_BATCH_DAYS - 1];

  return { ...ledger, cover, days };
}

export function findQuarterByKey(quarters, key) {
  return quarters.find((q) => q.key === key) || null;
}

export function findQuarterByDate(quarters, dateIso) {
  return quarters.find((q) => q.dates.includes(dateIso)) || null;
}

/** Đợt đếm chuẩn = đúng ngày 5–7 tháng cuối quý. */
export function isStandardQuarterBatch(batchStartIso, year) {
  const quarters = buildYearQuarters(year);
  return quarters.some((q) => q.startDate === batchStartIso);
}

export function quarterLabelForBatch(batchStartIso, year) {
  const q = buildYearQuarters(year).find((item) => item.startDate === batchStartIso);
  return q ? q.label : null;
}
