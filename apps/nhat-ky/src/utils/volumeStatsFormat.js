import {
  entryIncidentType,
  formatDisplayDate,
  formatLyTrinh,
  migrateEntry
} from "./nhatKyFormat";
import { formatUnitLabel, formatSideLabel, shouldExportBaoDuong, formatWorkNameFromEntry } from "./baoDuongFormat";
import { expandEntriesForVolumeBooks } from "./mergeDiaryEntries";
import {
  BAO_DUONG_GROUPS,
  getGroupForMaintenanceWork,
  getGroupForType
} from "./baoDuongQualityStore";
import {
  ATGT_SECTION,
  inferEntryUnit,
  resolveEntryQuantity
} from "./incidentUtils";
import { formatBookDecimal } from "./bookNumberFormat";
import { diaryBusinessFingerprint } from "./officeBooksConflictMerge";

export function normalizeStatsUnit(unit) {
  const u = String(unit || "")
    .trim()
    .toLowerCase();
  if (u === "m2" || u === "m²") return "m2";
  if (u === "m3" || u === "m³") return "m3";
  if (u === "m") return "m";
  // Giữ nguyên đơn vị đếm từ master data (cái, cột, cây…)
  if (u) return String(unit).trim();
  return "m3";
}

const SECTION_ORDER = Object.fromEntries(BAO_DUONG_GROUPS.map((g, i) => [g, i]));

export function normalizeWorkType(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Suy hạng mục từ tên đầu việc BDTX / loại tuần đường. */
export function inferSectionForWorkType(workType) {
  const wt = String(workType || "").trim();
  if (!wt) return "";
  return getGroupForMaintenanceWork(wt) || getGroupForType(wt) || "";
}

function enrichContract(contract) {
  const workType = String(contract.workType || "").trim();
  const section = contract.section || inferSectionForWorkType(workType);
  return { ...contract, workType, section };
}

export function entryWorkKey(entry) {
  const type = normalizeWorkType(formatWorkNameFromEntry(entry));
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
  const formatted = formatBookDecimal(value, { allowZero: true });
  if (formatted) return formatted;
  return "0,00";
}

/** Ngày local dạng YYYY-MM-DD — không dùng toISOString() (lệch UTC → lùi 1 ngày ở VN). */
export function toLocalIsoDate(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function defaultDateRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    dateFrom: toLocalIsoDate(from),
    dateTo: toLocalIsoDate(now)
  };
}

/** Quý hiện tại: từ ngày 1 tháng đầu quý → hôm nay. */
export function thisQuarterDateRange() {
  const now = new Date();
  const qStartMonth = Math.floor(now.getMonth() / 3) * 3;
  const from = new Date(now.getFullYear(), qStartMonth, 1);
  return {
    dateFrom: toLocalIsoDate(from),
    dateTo: toLocalIsoDate(now)
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

function volumeDetailItemKey(item) {
  return [
    String(item?.date || "").trim(),
    String(item?.kmFrom || "").trim(),
    String(item?.kmTo || "").trim(),
    String(item?.side || "").trim().toUpperCase(),
    String(item?.length || "").trim(),
    String(item?.width || "").trim(),
    String(item?.height || "").trim(),
    String(item?.quantity ?? "").trim(),
    String(item?.unit || "").trim().toLowerCase(),
    String(item?.workType || "").trim().toLowerCase(),
    String(item?.section || "").trim().toLowerCase()
  ].join("|");
}

/** Bỏ dòng chi tiết trùng (cùng ngày/lý trình/kích thước/KL). */
export function dedupeVolumeDetailItems(items) {
  const seen = new Map();
  for (const item of items || []) {
    const key = volumeDetailItemKey(item);
    if (!seen.has(key)) seen.set(key, item);
  }
  return [...seen.values()];
}

/**
 * Khử trùng entry trước khi thống kê KL (bỏ qua khác biệt ghi chú/recordId).
 */
export function dedupeEntriesForVolume(entries) {
  const seen = new Map();
  for (const entry of entries || []) {
    if (entry?.deletedAt) continue;
    const fp = diaryBusinessFingerprint(entry);
    const prev = seen.get(fp);
    if (!prev) {
      seen.set(fp, entry);
      continue;
    }
    const score = (e) =>
      (String(e?.recordId || "").trim() ? 1 : 0) +
      (String(e?.plannedRepairDate || "").trim() ? 1 : 0) +
      (String(e?.resolved || "").trim() ? 0.5 : 0);
    if (score(entry) >= score(prev)) seen.set(fp, entry);
  }
  return [...seen.values()];
}

/**
 * Tổng hợp khối lượng thực hiện theo sổ bảo dưỡng (BDTX):
 * chỉ dòng đủ điều kiện xuất sổ, lọc theo ngày thực hiện (plannedRepairDate).
 */
export function buildVolumeStats(entries, contractVolumes, options = {}) {
  const { dateFrom = "", dateTo = "", sectionFilter = "" } = options;
  const bdtxEntries = dedupeEntriesForVolume(
    expandEntriesForVolumeBooks(entries || []).map(migrateEntry)
  ).filter((e) => shouldExportBaoDuong(e));
  const enrichedContracts = (contractVolumes || []).map(enrichContract);
  const contractMap = Object.fromEntries(
    enrichedContracts
      .filter((c) => c.section && c.workType)
      .map((c) => [contractWorkKey(c), c])
  );

  const groups = new Map();

  for (const entry of bdtxEntries) {
    const execDate = String(entry.plannedRepairDate || "").trim();
    if (!inDateRange(execDate, dateFrom, dateTo)) continue;
    if (sectionFilter && entry.section !== sectionFilter) continue;

    const unit = inferEntryUnit(entry);
    const qty = resolveEntryQuantity({ ...entry, unit });
    if (qty <= 0) continue;

    const key = entryWorkKey({ ...entry, unit, quantity: qty });
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        section: entry.section || "",
        workType: formatWorkNameFromEntry(entry),
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
    row.items.push(
      toVolumeDetailItem(entry, {
        date: execDate,
        unit,
        quantity: qty,
        workType: row.workType,
        section: row.section
      })
    );
  }

  // Phòng trường hợp expand/gộp vẫn tạo item trùng.
  for (const row of groups.values()) {
    const unique = dedupeVolumeDetailItems(row.items);
    if (unique.length !== row.items.length) {
      row.items = unique;
      row.entryCount = unique.length;
      row.totalDone = unique.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
    }
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

function formatDim(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "";
  if (Math.abs(n - Math.round(n)) < 0.001) return String(Math.round(n));
  return String(Math.round(n * 100) / 100);
}

/** Chi tiết một dòng KL để xuất bảng kê. */
export function toVolumeDetailItem(entry, extras = {}) {
  const unit = extras.unit || inferEntryUnit(entry);
  const qty =
    extras.quantity != null
      ? extras.quantity
      : resolveEntryQuantity({ ...entry, unit });
  const normUnit = normalizeStatsUnit(unit);
  const sideRaw = String(entry.side || "").trim().toUpperCase();
  return {
    date: extras.date || entry.plannedRepairDate || entry.date || "",
    dateLabel: formatDisplayDate(
      extras.date || entry.plannedRepairDate || entry.date || ""
    ),
    kmFrom: entry.kmFrom || "",
    kmTo: entry.kmTo || "",
    kmFromLabel: entry.kmFrom ? `Km${formatLyTrinh(entry.kmFrom)}` : "",
    kmToLabel: entry.kmTo ? `Km${formatLyTrinh(entry.kmTo)}` : "",
    kmLabel: formatKmRange(entry.kmFrom, entry.kmTo),
    side: sideRaw,
    sideLabel: formatSideLabel(sideRaw) || sideRaw,
    unit: normUnit,
    unitLabel: formatUnitLabel(normUnit) || normUnit,
    length: formatDim(entry.length ?? entry.dai),
    width: formatDim(entry.width ?? entry.rong),
    height: formatDim(entry.height ?? entry.cao),
    quantity: qty,
    quantityLabel: formatStatsNumber(qty),
    workType:
      extras.workType ||
      formatWorkNameFromEntry(entry) ||
      "",
    section: extras.section || entry.section || "",
    note: String(entry.note || entry.content || "").trim(),
    resolvedStatus: entry.resolvedStatus || ""
  };
}

function formatKmRange(kmFrom, kmTo) {
  const from = kmFrom ? `Km${formatLyTrinh(kmFrom)}` : "";
  const to = kmTo ? `Km${formatLyTrinh(kmTo)}` : "";
  if (from && to && from !== to) return `${from} – ${to}`;
  return from || to || "";
}

/**
 * Gom các dòng chi tiết từ các đầu việc đã chọn (theo row.key).
 */
export function collectSelectedVolumeDetails(rows, selectedKeys) {
  const keySet = new Set(selectedKeys || []);
  const out = [];
  for (const row of rows || []) {
    if (!keySet.has(row.key)) continue;
    for (const item of row.items || []) {
      out.push({
        ...item,
        workType: item.workType || row.workType,
        section: item.section || row.section,
        unit: item.unit || row.unit,
        unitLabel: item.unitLabel || row.unitLabel
      });
    }
  }
  const unique = dedupeVolumeDetailItems(out);
  unique.sort((a, b) => {
    const sa = SECTION_ORDER[a.section] ?? 999;
    const sb = SECTION_ORDER[b.section] ?? 999;
    if (sa !== sb) return sa - sb;
    if (a.workType !== b.workType) {
      return String(a.workType).localeCompare(String(b.workType), "vi");
    }
    if (a.unit !== b.unit) return String(a.unit).localeCompare(String(b.unit));
    if (a.date !== b.date) return String(a.date).localeCompare(String(b.date));
    return String(a.kmFrom).localeCompare(String(b.kmFrom));
  });
  return unique;
}

/**
 * Chia bảng kê theo hạng mục (mục lớn) → đầu việc (+ ĐVT), có tổng từng nhóm.
 * @returns {{ sections: Array<{ section, workGroups: Array<{ workType, unit, unitLabel, rows, totalQty }> }> }}
 */
export function groupVolumeDetailRows(rows) {
  const sectionMap = new Map();

  for (const item of rows || []) {
    const section = String(item.section || "").trim() || "Khác";
    const workType = String(item.workType || "").trim() || "—";
    const unit = String(item.unit || "").trim();
    const unitLabel = item.unitLabel || formatUnitLabel(unit) || unit;
    const workKey = `${workType}|${unit}`;

    if (!sectionMap.has(section)) {
      sectionMap.set(section, { section, workMap: new Map() });
    }
    const sec = sectionMap.get(section);
    if (!sec.workMap.has(workKey)) {
      sec.workMap.set(workKey, {
        workType,
        unit,
        unitLabel,
        rows: [],
        totalQty: 0
      });
    }
    const group = sec.workMap.get(workKey);
    group.rows.push(item);
    group.totalQty += Number(item.quantity) || 0;
  }

  const sections = [...sectionMap.values()]
    .map((sec) => ({
      section: sec.section,
      workGroups: [...sec.workMap.values()].map((g) => ({
        ...g,
        totalQty: Math.round(g.totalQty * 100) / 100
      }))
    }))
    .sort((a, b) => {
      const sa = SECTION_ORDER[a.section] ?? 999;
      const sb = SECTION_ORDER[b.section] ?? 999;
      if (sa !== sb) return sa - sb;
      return a.section.localeCompare(b.section, "vi");
    });

  for (const sec of sections) {
    sec.workGroups.sort((a, b) => {
      const t = a.workType.localeCompare(b.workType, "vi");
      if (t !== 0) return t;
      return a.unit.localeCompare(b.unit);
    });
  }

  return { sections };
}

/**
 * Phân loại phát hiện ATGT trên sổ nhật ký: mất / hư hỏng (còn lại).
 * «Mất …» → mất; «Hỏng / nghiêng / mờ / che khuất…» → hư hỏng.
 */
export function classifyAtgtDamageKind(workType) {
  const t = normalizeWorkType(workType);
  if (t.startsWith("mat ")) return "mat";
  return "hu_hong";
}

export function atgtDamageKindLabel(kind) {
  return kind === "mat" ? "Mất" : "Hư hỏng";
}

/**
 * Thống kê KL mục Công trình ATGT theo sổ nhật ký (ngày phát hiện).
 * Theo dõi khối lượng mất / hư hỏng — không lọc BDTX, không so HĐ.
 */
export function buildAtgtDiaryVolumeStats(entries, options = {}) {
  const { dateFrom = "", dateTo = "", kindFilter = "" } = options;
  const groups = new Map();

  for (const entry of dedupeEntriesForVolume((entries || []).map(migrateEntry))) {
    if (entry.section !== ATGT_SECTION) continue;
    if (!inDateRange(entry.date, dateFrom, dateTo)) continue;

    const workType = String(entryIncidentType(entry) || "").trim();
    if (!workType) continue;

    const kind = classifyAtgtDamageKind(workType);
    if (kindFilter && kind !== kindFilter) continue;

    const unit = inferEntryUnit(entry);
    const qty = resolveEntryQuantity({ ...entry, unit });
    if (qty <= 0) continue;

    const normUnit = normalizeStatsUnit(unit);
    const key = `${kind}|${normalizeWorkType(workType)}|${normUnit}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        section: ATGT_SECTION,
        kind,
        kindLabel: atgtDamageKindLabel(kind),
        workType,
        unit: normUnit,
        unitLabel: formatUnitLabel(normUnit) || normUnit,
        entryCount: 0,
        totalDone: 0,
        items: []
      });
    }
    const row = groups.get(key);
    row.entryCount += 1;
    row.totalDone += qty;
    row.items.push(
      toVolumeDetailItem(entry, {
        date: entry.date,
        unit,
        quantity: qty,
        workType,
        section: ATGT_SECTION
      })
    );
  }

  for (const row of groups.values()) {
    const unique = dedupeVolumeDetailItems(row.items);
    if (unique.length !== row.items.length) {
      row.items = unique;
      row.entryCount = unique.length;
      row.totalDone = unique.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
    }
  }

  const rows = [...groups.values()].map((row) => ({
    ...row,
    items: row.items.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return String(a.kmFrom).localeCompare(String(b.kmFrom));
    })
  }));

  rows.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "mat" ? -1 : 1;
    const typeCmp = a.workType.localeCompare(b.workType, "vi");
    if (typeCmp !== 0) return typeCmp;
    return a.unit.localeCompare(b.unit);
  });

  const matRows = rows.filter((r) => r.kind === "mat");
  const huHongRows = rows.filter((r) => r.kind === "hu_hong");
  const entryCount = rows.reduce((sum, r) => sum + r.entryCount, 0);
  const matQty = matRows.reduce((sum, r) => sum + r.totalDone, 0);
  const huHongQty = huHongRows.reduce((sum, r) => sum + r.totalDone, 0);
  const matCount = matRows.reduce((sum, r) => sum + r.entryCount, 0);
  const huHongCount = huHongRows.reduce((sum, r) => sum + r.entryCount, 0);

  return {
    rows,
    entryCount,
    matCount,
    huHongCount,
    matQty,
    huHongQty,
    typeCount: rows.length
  };
}

/** Gợi ý đầu việc từ dòng đã vào sổ bảo dưỡng — map sang tên công việc BDTX. */
export function suggestWorkTypesFromEntries(entries) {
  const seen = new Set();
  const list = [];
  for (const entry of expandEntriesForVolumeBooks(entries || [])
    .map(migrateEntry)
    .filter(shouldExportBaoDuong)) {
    const type = formatWorkNameFromEntry(entry);
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
