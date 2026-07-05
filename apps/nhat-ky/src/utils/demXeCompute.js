import { VEHICLE_TYPES } from "./demXeConstants";

export function parseCount(value) {
  const n = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function sumCounts(counts = {}) {
  return VEHICLE_TYPES.reduce((s, v) => s + parseCount(counts[v.key]), 0);
}

/** Ngày có ít nhất một hướng có dữ liệu. */
export function listActiveDates(days = {}) {
  return Object.keys(days)
    .filter((date) => {
      const dirs = days[date]?.directions || [];
      return dirs.some((d) => hasDirectionData(d));
    })
    .sort();
}

export function hasDirectionData(dir) {
  if (!dir) return false;
  const textFields = [dir.roadName, dir.lyTrinh, dir.from, dir.to, dir.startTime, dir.endTime];
  if (textFields.some((x) => String(x || "").trim())) return true;
  return VEHICLE_TYPES.some((v) => parseCount(dir.counts?.[v.key]) > 0);
}

/** Tổng theo ngày (cộng mọi chiều). */
export function computeDailyTotals(days = {}) {
  const dates = listActiveDates(days);
  const byDate = {};
  dates.forEach((date) => {
    byDate[date] = {};
    VEHICLE_TYPES.forEach((v) => {
      byDate[date][v.key] = (days[date]?.directions || []).reduce(
        (s, d) => s + parseCount(d.counts?.[v.key]),
        0
      );
    });
  });
  return { dates, byDate };
}

/** Khóa hướng duy nhất from→to. */
export function directionKey(dir) {
  const from = String(dir?.from || "").trim();
  const to = String(dir?.to || "").trim();
  return `${from}→${to}`;
}

/**
 * Bảng tổng hợp theo hướng xe chạy (mỗi hàng = 1 loại xe + 1 hướng).
 * Cột = các ngày có dữ liệu (không sinh cột rỗng).
 */
export function computeSummaryByDirection(days = {}) {
  const dates = listActiveDates(days);
  const rowMap = new Map();

  dates.forEach((date) => {
    (days[date]?.directions || []).forEach((dir) => {
      const key = directionKey(dir);
      if (!key || key === "→") return;
      VEHICLE_TYPES.forEach((v) => {
        const n = parseCount(dir.counts?.[v.key]);
        if (n <= 0) return;
        const rowKey = `${v.key}::${key}`;
        if (!rowMap.has(rowKey)) {
          rowMap.set(rowKey, {
            vehicleKey: v.key,
            vehicleLabel: v.label,
            from: dir.from,
            to: dir.to,
            directionLabel: `${dir.from} → ${dir.to}`,
            byDate: {}
          });
        }
        const row = rowMap.get(rowKey);
        row.byDate[date] = (row.byDate[date] || 0) + n;
      });
    });
  });

  const rows = [...rowMap.values()].sort((a, b) => {
    const ai = VEHICLE_TYPES.findIndex((v) => v.key === a.vehicleKey);
    const bi = VEHICLE_TYPES.findIndex((v) => v.key === b.vehicleKey);
    if (ai !== bi) return ai - bi;
    return a.directionLabel.localeCompare(b.directionLabel, "vi");
  });

  return { dates, rows };
}

/** Tổng cộng mỗi cột ngày (grand total). */
export function columnGrandTotals(dates, rows) {
  const totals = {};
  dates.forEach((date) => {
    totals[date] = rows.reduce((s, r) => s + (r.byDate[date] || 0), 0);
  });
  return totals;
}
