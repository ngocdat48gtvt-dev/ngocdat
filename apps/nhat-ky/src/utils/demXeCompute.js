import { COUNT_BATCH_DAYS, DIRECTION_DI, DIRECTION_VE, VEHICLE_TYPES } from "./demXeConstants";
import { addDaysIso } from "./demXeStore";

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

/** Nhóm ngày thành các đợt đếm (tối đa 3 ngày liên tiếp / đợt). */
export function listCountBatches(dayKeys = []) {
  const sorted = [...dayKeys].sort();
  if (!sorted.length) return [];

  const batches = [];
  let batch = [sorted[0]];

  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    const consecutive = addDaysIso(prev, 1) === cur;

    if (consecutive && batch.length < COUNT_BATCH_DAYS) {
      batch.push(cur);
    } else {
      batches.push(batch);
      batch = [cur];
    }
  }
  batches.push(batch);
  return batches;
}

/** 3 cột ngày của một đợt (luôn 3 ngày liên tiếp kể từ ngày đầu đợt). */
export function batchColumnDates(batchStartIso) {
  return Array.from({ length: COUNT_BATCH_DAYS }, (_, i) => addDaysIso(batchStartIso, i));
}

export function getDirectionOnDay(days, date, directionType) {
  if (!date) return null;
  const want = directionType === DIRECTION_VE ? DIRECTION_VE : DIRECTION_DI;
  return (days[date]?.directions || []).find((d) => d.directionType === want) || null;
}

function displayCount(n) {
  return n > 0 ? String(n) : "";
}

/**
 * Bảng tổng hợp 1 chiều trong 1 đợt — tự lấy số từ phiếu đếm (link công thức).
 * Mỗi ô = tổng 1 loại xe / 1 ngày / 1 chiều.
 */
export function computeDirectionBatchTable(days = {}, batchStartIso, directionType) {
  const columnDates = batchColumnDates(batchStartIso);
  let from = "";
  let to = "";

  columnDates.forEach((date) => {
    const dir = getDirectionOnDay(days, date, directionType);
    if (dir?.from && !from) from = dir.from;
    if (dir?.to && !to) to = dir.to;
  });

  const rows = VEHICLE_TYPES.map((v, idx) => {
    const counts = columnDates.map((date) => {
      const dir = getDirectionOnDay(days, date, directionType);
      return parseCount(dir?.counts?.[v.key]);
    });
    return {
      tt: idx + 1,
      vehicleKey: v.key,
      vehicleLabel: v.label,
      counts,
      displayCounts: counts.map(displayCount)
    };
  });

  const colTotals = columnDates.map((_, colIdx) =>
    rows.reduce((sum, row) => sum + row.counts[colIdx], 0)
  );

  return {
    from,
    to,
    columnDates,
    rows,
    colTotals,
    colTotalsDisplay: colTotals.map(displayCount)
  };
}

/** Tổng hợp chiều đi + chiều về theo từng loại xe / từng ngày trong đợt. */
export function computeCombinedBatchTable(days = {}, batchStartIso) {
  const diTable = computeDirectionBatchTable(days, batchStartIso, DIRECTION_DI);
  const veTable = computeDirectionBatchTable(days, batchStartIso, DIRECTION_VE);

  const rows = diTable.rows.map((diRow, idx) => {
    const veRow = veTable.rows[idx];
    const counts = diRow.counts.map((n, colIdx) => n + (veRow?.counts[colIdx] || 0));
    return {
      tt: diRow.tt,
      vehicleKey: diRow.vehicleKey,
      vehicleLabel: diRow.vehicleLabel,
      counts,
      displayCounts: counts.map(displayCount)
    };
  });

  const colTotals = diTable.columnDates.map((_, colIdx) =>
    rows.reduce((sum, row) => sum + row.counts[colIdx], 0)
  );

  return {
    columnDates: diTable.columnDates,
    diFrom: diTable.from,
    diTo: diTable.to,
    veFrom: veTable.from,
    veTo: veTable.to,
    rows,
    colTotals,
    colTotalsDisplay: colTotals.map(displayCount)
  };
}

/** Tổng hợp 1 ngày: cộng số liệu chiều đi + chiều về từng loại xe. */
export function computeCombinedDayForm(days = {}, date) {
  const di = getDirectionOnDay(days, date, DIRECTION_DI);
  const ve = getDirectionOnDay(days, date, DIRECTION_VE);

  const rows = VEHICLE_TYPES.map((v) => {
    const count = parseCount(di?.counts?.[v.key]) + parseCount(ve?.counts?.[v.key]);
    return {
      vehicleKey: v.key,
      vehicleLabel: v.label,
      count,
      display: displayCount(count)
    };
  });

  const total = rows.reduce((sum, row) => sum + row.count, 0);

  return {
    date,
    di,
    ve,
    rows,
    total,
    totalDisplay: displayCount(total),
    roadName: di?.roadName || ve?.roadName || "",
    lyTrinh: di?.lyTrinh || ve?.lyTrinh || "",
    startTime: di?.startTime || ve?.startTime || "",
    endTime: di?.endTime || ve?.endTime || ""
  };
}

export function batchMonthYearLabel(batchStartIso) {
  if (!batchStartIso) return "Tháng…. năm….";
  const [, month, year] = batchStartIso.split("-");
  if (!month || !year) return "Tháng…. năm….";
  return `Tháng ${month} năm ${year}`;
}

/** @deprecated — dùng computeDirectionBatchTable */
export function computeSummaryByDirection(days = {}) {
  const dates = listActiveDates(days);
  const rowMap = new Map();

  dates.forEach((date) => {
    (days[date]?.directions || []).forEach((dir) => {
      const from = String(dir?.from || "").trim();
      const to = String(dir?.to || "").trim();
      const key = `${from}→${to}`;
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

export function columnGrandTotals(dates, rows) {
  const totals = {};
  dates.forEach((date) => {
    totals[date] = rows.reduce((s, r) => s + (r.byDate[date] || 0), 0);
  });
  return totals;
}
