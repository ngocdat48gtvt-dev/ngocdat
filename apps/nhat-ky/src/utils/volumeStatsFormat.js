import {
  SECTIONS,
  entryIncidentType,
  formatDisplayDate,
  formatLyTrinh,
  migrateEntry
} from "./nhatKyFormat";
import { formatUnitLabel } from "./baoDuongFormat";
import { inferEntryUnit, resolveEntryQuantity } from "./incidentUtils";

export function normalizeStatsUnit(unit) {
  const u = String(unit || "")
    .trim()
    .toLowerCase();
  if (u === "m2" || u === "m²") return "m2";
  if (u === "m3" || u === "m³") return "m3";
  if (u === "m") return "m";
  return u || "m3";
}

const SECTION_ORDER = Object.fromEntries(SECTIONS.map((s, i) => [s.title, i]));

export function normalizeWorkType(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Suy hạng mục từ tên đầu việc — vd. «Ổ gà» → «Mặt đường». */
export function inferSectionForWorkType(workType) {
  const wt = normalizeWorkType(workType);
  if (!wt) return "";
  const matches = SECTIONS.filter((s) =>
    s.types.some((t) => normalizeWorkType(t) === wt)
  );
  return matches.length === 1 ? matches[0].title : "";
}

function enrichContract(contract) {
  const workType = String(contract.workType || "").trim();
  const section = contract.section || inferSectionForWorkType(workType);
  return { ...contract, workType, section };
}

export function entryWorkKey(entry) {
  const type = normalizeWorkType(entryIncidentType(entry));
  const unit = normalizeStatsUnit(inferEntryUnit(entry));
  return `${entry.section || ""}|${type}|${unit}`;
}

export function contractWorkKey(contract) {
  const enriched = enrichContract(contract);
  return `${enriched.section || ""}|${normalizeWorkType(enriched.workType)}|${normalizeStatsUnit(enriched.unit)}`;
}

export function parseQuantity(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function formatStatsNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  if (Math.abs(n - Math.round(n)) < 0.001) return String(Math.round(n));
  return n.toLocaleString("vi-VN", { maximumFractionDigits: 2 });
}

export function defaultDateRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    dateFrom: from.toISOString().split("T")[0],
    dateTo: now.toISOString().split("T")[0]
  };
}

export function newContractVolume(partial = {}) {
  return {
    id: `cv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    section: partial.section || "",
    workType: partial.workType || "",
    unit: partial.unit || "m3",
    contractQty: partial.contractQty ?? ""
  };
}

function inDateRange(date, dateFrom, dateTo) {
  if (!date) return false;
  if (dateFrom && date < dateFrom) return false;
  if (dateTo && date > dateTo) return false;
  return true;
}

/**
 * Tổng hợp khối lượng theo hạng mục + đầu việc + đơn vị trong khoảng ngày.
 */
export function buildVolumeStats(entries, contractVolumes, options = {}) {
  const { dateFrom = "", dateTo = "", sectionFilter = "" } = options;
  const normalized = (entries || []).map(migrateEntry);
  const enrichedContracts = (contractVolumes || []).map(enrichContract);
  const contractMap = Object.fromEntries(
    enrichedContracts
      .filter((c) => c.section && c.workType)
      .map((c) => [contractWorkKey(c), c])
  );

  const groups = new Map();

  for (const entry of normalized) {
    if (!inDateRange(entry.date, dateFrom, dateTo)) continue;
    if (sectionFilter && entry.section !== sectionFilter) continue;

    const unit = inferEntryUnit(entry);
    const qty = resolveEntryQuantity({ ...entry, unit });
    if (qty <= 0) continue;

    const key = entryWorkKey({ ...entry, unit, quantity: qty });
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        section: entry.section || "",
        workType: entryIncidentType(entry),
        unit: normalizeStatsUnit(unit),
        unitLabel: formatUnitLabel(normalizeStatsUnit(unit)),
        entryCount: 0,
        totalDone: 0,
        items: []
      });
    }
    const row = groups.get(key);
    row.entryCount += 1;
    row.totalDone += qty;
    row.items.push({
      date: entry.date,
      dateLabel: formatDisplayDate(entry.date),
      kmFrom: entry.kmFrom,
      kmTo: entry.kmTo,
      kmLabel: formatKmRange(entry.kmFrom, entry.kmTo),
      quantity: qty,
      resolvedStatus: entry.resolvedStatus || ""
    });
  }

  for (const contract of enrichedContracts) {
    if (!contract.section || !contract.workType) continue;
    if (sectionFilter && contract.section !== sectionFilter) continue;
    const key = contractWorkKey(contract);
    if (groups.has(key)) continue;
    groups.set(key, {
      key,
      section: contract.section,
      workType: contract.workType,
      unit: normalizeStatsUnit(contract.unit),
      unitLabel: formatUnitLabel(normalizeStatsUnit(contract.unit)),
      entryCount: 0,
      totalDone: 0,
      items: []
    });
  }

  const rows = [...groups.values()].map((row) => {
    const contract = contractMap[row.key];
    const contractQty = contract ? parseQuantity(contract.contractQty) : null;
    const hasContract = contractQty != null && contractQty > 0;
    const remaining = hasContract ? contractQty - row.totalDone : null;
    const percent = hasContract ? (row.totalDone / contractQty) * 100 : null;

    let status = "no_contract";
    if (hasContract) {
      status = remaining <= 0 ? "ok" : "short";
    } else if (row.totalDone > 0) {
      status = "no_contract";
    } else {
      status = "pending";
    }

    return {
      ...row,
      contractQty: hasContract ? contractQty : null,
      remaining,
      percent,
      status,
      items: row.items.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return String(a.kmFrom).localeCompare(String(b.kmFrom));
      })
    };
  });

  rows.sort((a, b) => {
    const sa = SECTION_ORDER[a.section] ?? 999;
    const sb = SECTION_ORDER[b.section] ?? 999;
    if (sa !== sb) return sa - sb;
    const typeCmp = a.workType.localeCompare(b.workType, "vi");
    if (typeCmp !== 0) return typeCmp;
    return a.unit.localeCompare(b.unit);
  });

  const shortCount = rows.filter((r) => r.status === "short").length;
  const okCount = rows.filter((r) => r.status === "ok").length;
  const entryCount = rows.reduce((sum, r) => sum + r.entryCount, 0);

  return { rows, shortCount, okCount, entryCount };
}

function formatKmRange(kmFrom, kmTo) {
  const from = kmFrom ? `Km${formatLyTrinh(kmFrom)}` : "";
  const to = kmTo ? `Km${formatLyTrinh(kmTo)}` : "";
  if (from && to && from !== to) return `${from} – ${to}`;
  return from || to || "";
}

/** Gợi ý đầu việc từ dữ liệu NK (để nhập HĐ nhanh). */
export function suggestWorkTypesFromEntries(entries) {
  const seen = new Set();
  const list = [];
  for (const entry of (entries || []).map(migrateEntry)) {
    const type = entryIncidentType(entry);
    if (!type || !entry.section) continue;
    const key = `${entry.section}|${type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    list.push({
      section: entry.section,
      workType: type,
      unit: normalizeStatsUnit(entry.unit)
    });
  }
  return list.sort((a, b) => {
    const sa = SECTION_ORDER[a.section] ?? 999;
    const sb = SECTION_ORDER[b.section] ?? 999;
    if (sa !== sb) return sa - sb;
    return a.workType.localeCompare(b.workType, "vi");
  });
}
