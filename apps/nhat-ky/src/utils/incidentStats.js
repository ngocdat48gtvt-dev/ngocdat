import {
  computeKhoiLuong,
  dispatchFilterStatus,
  isCompletedToday,
  resolveIncidentUnit
} from "./incidentUtils.js";
import { matchesCompletedDateRange, matchesDateRange } from "./incidentFilters.js";
import { matchesChainageSearch } from "@quanlysuco/shared";

export function formatVolumeValue(value) {
  if (value <= 0) return "0";
  return value.toLocaleString("vi-VN", { maximumFractionDigits: 1 });
}

const UNIT_SORT_ORDER = { "m³": 0, "m²": 1, m: 2 };

export function sortedVolumeEntries(totals) {
  return Object.entries(totals)
    .filter(([, v]) => v > 0)
    .sort((a, b) => {
      const oa = UNIT_SORT_ORDER[a[0]] ?? 99;
      const ob = UNIT_SORT_ORDER[b[0]] ?? 99;
      if (oa !== ob) return oa - ob;
      return a[0].localeCompare(b[0], "vi");
    });
}

export function addIncidentVolume(totals, inc) {
  const vol = computeKhoiLuong(inc);
  if (vol <= 0) return;
  const unit = resolveIncidentUnit(inc);
  if (!unit) return;
  totals[unit] = (totals[unit] ?? 0) + vol;
}

export function applyDispatchFilters(items, filters) {
  return items.filter((inc) => {
    if (filters.road && inc.road !== filters.road) return false;
    if (filters.groupName && inc.groupName !== filters.groupName) return false;
    if (filters.type && inc.type !== filters.type) return false;
    if (!matchesChainageSearch(inc.km, filters.chainageQuery || "")) return false;

    if (filters.status) {
      if (dispatchFilterStatus(inc) !== filters.status) return false;
      if (filters.status === "DONE") {
        return matchesCompletedDateRange(inc, filters.dateFrom, filters.dateTo);
      }
    }

    return matchesDateRange(inc, filters.dateFrom, filters.dateTo);
  });
}

export function computeDispatchSummary(items) {
  const volumeByUnit = {};
  let newCount = 0;
  let partialCount = 0;
  let doneCount = 0;
  for (const inc of items) {
    addIncidentVolume(volumeByUnit, inc);
    const s = dispatchFilterStatus(inc);
    if (s === "DONE") doneCount++;
    else if (s === "PARTIAL") partialCount++;
    else newCount++;
  }
  return {
    total: items.length,
    volumeByUnit,
    newCount,
    partialCount,
    doneCount,
    completedTodayCount: items.filter(isCompletedToday).length
  };
}
