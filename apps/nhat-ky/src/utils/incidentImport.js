import { formatDisplayDate, formatLyTrinh, loadStorage, migrateEntry, reconcileImportMap, sortEntriesOnDate, SECTIONS, parseKmParts, formatKmParts, addMetersToKm } from "./nhatKyFormat";
import { computeVolume } from "./incidentUtils";
import {
  loadImportMap as loadImportMapRemote,
  persistImportMap
} from "../services/nhatKyImportService";

export const NHAT_KY_SECTION_TITLES = new Set(SECTIONS.map((s) => s.title));

export function getImportSectionOptions() {
  const manual = SECTIONS.map((s) => ({
    value: s.title,
    label: `${s.title} (${s.part}.${s.num})`,
    part: s.part
  }));
  return [{ value: "auto", label: "Tự động theo nhóm app", part: "" }, ...manual];
}

export function getImportSectionOptionGroups() {
  const options = getImportSectionOptions();
  const auto = options.filter((o) => o.value === "auto");
  const byPart = {};
  for (const opt of options) {
    if (opt.value === "auto") continue;
    if (!byPart[opt.part]) byPart[opt.part] = [];
    byPart[opt.part].push(opt);
  }
  return { auto, parts: byPart };
}

export function normalizeGroupKey(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const BAO_LU_GROUPS = new Set(["bão lũ", "bao lu"].map(normalizeGroupKey));
const MAT_DUONG_GROUP_KEYS = ["mặt đường", "mat duong", "hư hỏng mặt đường", "hu hong mat duong"].map(
  normalizeGroupKey
);
const ATGT_GROUP_KEYS = ["atgt", "an toan giao thong", "he thong atgt"].map(normalizeGroupKey);

/** Loại app → loại ghi trong nhật ký (Nền đường) */
const NEN_DUONG_TYPE_MAP = Object.fromEntries(
  Object.entries({
    "sạt đường": "Sạt taluy",
    "sụt dương": "Sụt lún",
    "sụt âm": "Sụt lún",
    "sa bồi lề mặt đường": "Sụt lún",
    "sa bồi rãnh đất": "Sụt lún",
    "sa bồi rãnh xây": "Sụt lún",
    "sa bồi cống": "Sụt lún",
    "sa bồi hố thu nước": "Sụt lún"
  }).map(([k, v]) => [normalizeGroupKey(k), v])
);

/** Loại app → loại ghi trong nhật ký (Mặt đường) */
const MAT_DUONG_TYPE_MAP = {
  "hư hỏng mặt đường": "Ổ gà",
  "hư hỏng lớp móng mặt đường": "Lún vệt bánh xe"
};

/** Loại app → loại ghi trong nhật ký (ATGT) */
const ATGT_TYPE_MAP = {
  "biển báo": "Mất biển báo",
  "cột tiêu": "Hỏng cọc tiêu",
  "cột h": "Hỏng cọc tiêu",
  "cột km": "Mất cột Km",
  "hộ lan": "Hỏng hộ lan"
};

export function resolveNhatKySection(incident) {
  const g = normalizeGroupKey(incident.groupName);
  if (BAO_LU_GROUPS.has(g)) return "Nền đường";
  if (MAT_DUONG_GROUP_KEYS.some((key) => g.includes(key))) return "Mặt đường";
  if (ATGT_GROUP_KEYS.some((key) => g.includes(key))) return "Công trình an toàn giao thông";
  return null;
}

export function mapIncidentType(incident, section) {
  const raw = String(incident.type || "").trim();
  const key = normalizeGroupKey(raw);
  if (section === "Nền đường") {
    return NEN_DUONG_TYPE_MAP[key] || raw;
  }
  if (section === "Mặt đường") {
    return MAT_DUONG_TYPE_MAP[key] || raw;
  }
  if (section === "Công trình an toàn giao thông") {
    return ATGT_TYPE_MAP[key] || raw;
  }
  return raw;
}

function shouldUseKmRange(incident, section) {
  if (!Number(incident.dai)) return false;
  if (section === "Nền đường") return true;
  return BAO_LU_GROUPS.has(normalizeGroupKey(incident.groupName));
}

function normalizeSide(position) {
  const p = String(position || "").trim().toUpperCase();
  if (p === "P" || p === "T" || p === "M") return p;
  if (/phải/i.test(position)) return "P";
  if (/trái/i.test(position)) return "T";
  if (/giữa/i.test(position)) return "M";
  return "P";
}

function normalizeUnit(unit, dimensions = {}) {
  const h = Number(dimensions.height || 0);
  const w = Number(dimensions.width || 0);
  const l = Number(dimensions.length || 0);
  const u = String(unit || "").trim().toLowerCase();
  if ((u === "m3" || u === "m³") && h <= 0) {
    if (w > 0 && l > 0) return "m2";
    if (l > 0) return "m";
  }
  if (u === "m3" || u === "m³") return "m3";
  if (u === "m2" || u === "m²") return "m2";
  if (u === "m") return "m";
  if (h > 0) return "m3";
  if (w > 0) return "m2";
  if (l > 0) return "m";
  return "m3";
}

export function incidentToNhatKyEntry(incident, nhatKyDateIso, sectionOverride = null) {
  const section = sectionOverride || resolveNhatKySection(incident);
  if (!section || !NHAT_KY_SECTION_TITLES.has(section)) return null;

  const kmFrom = parseKmParts(incident.km);
  const kmFromStr = formatKmParts(kmFrom.km, kmFrom.m);
  const kmToStr =
    shouldUseKmRange(incident, section)
      ? addMetersToKm(incident.km, incident.dai)
      : kmFromStr;

  const length = incident.dai ?? "";
  const width = incident.rong ?? "";
  const height = incident.cao ?? "";
  const unit = normalizeUnit(incident.unit, { length, width, height });
  const quantity = computeVolume({ dai: length, rong: width, cao: height, unit });

  const progress = Number(incident.progress || 0);
  const resolvedStatus = progress >= 90 || incident.completedDate ? "co" : "chua";

  const entry = {
    section,
    type: mapIncidentType(incident, section),
    date: nhatKyDateIso,
    kmFrom: kmFromStr,
    kmTo: kmToStr,
    side: normalizeSide(incident.position),
    length: length === "" ? "" : String(length),
    width: width === "" ? "" : String(width),
    height: height === "" ? "" : String(height),
    unit,
    quantity,
    content: incident.note || "",
    resolved: "",
    resolvedStatus,
    sourceIncidentId: incident.id,
    sourceIncidentDate: incident.date || "",
    sourceGroupName: incident.groupName || ""
  };

  if (section === "Mặt đường") {
    entry.exportMatDuong = true;
    entry.plannedRepairDate = "";
  }

  if (
    section === "Nền đường" &&
    BAO_LU_GROUPS.has(normalizeGroupKey(incident.groupName))
  ) {
    entry.exportTrafficDuty = true;
    entry.sourceIncidentType = incident.type || "";
    entry.dutyPerson = incident.createdByName || "";
    entry.sourceIncidentCompletedDate = incident.completedDate || "";
    if (progress >= 90 && incident.completedDate) {
      entry.trafficRestoredAt = incident.completedDate;
    }
  }

  return migrateEntry(entry);
}

/** Các trường lấy từ app hiện trường khi đồng bộ lại (admin sửa khối lượng, km…). */
const SYNC_FROM_INCIDENT_KEYS = [
  "type",
  "kmFrom",
  "kmTo",
  "side",
  "length",
  "width",
  "height",
  "unit",
  "quantity",
  "resolvedStatus",
  "sourceIncidentType",
  "sourceIncidentDate",
  "sourceGroupName",
  "sourceIncidentCompletedDate",
  "trafficRestoredAt"
];

function mergeImportedEntry(existing, fresh) {
  const merged = { ...existing };
  for (const key of SYNC_FROM_INCIDENT_KEYS) {
    if (fresh[key] !== undefined) merged[key] = fresh[key];
  }
  if (!String(existing.content || "").trim() && fresh.content) {
    merged.content = fresh.content;
  }
  return migrateEntry(merged);
}

function entrySyncDiffers(existing, merged) {
  return SYNC_FROM_INCIDENT_KEYS.some(
    (key) => String(existing[key] ?? "") !== String(merged[key] ?? "")
  );
}

/**
 * Cập nhật các dòng NK đã import (sourceIncidentId) từ dữ liệu app/Firestore mới nhất.
 * Giữ nguyên: ngày NK, nhận xét TKV, ý kiến chỉ đạo, xử lý tại chỗ, ghi chú sổ trực…
 */
export async function syncImportedIncidentsToNhatKy(incidents, storageKey, uid) {
  const incidentById = Object.fromEntries(incidents.map((inc) => [inc.id, inc]));
  const parsed = loadStorage(storageKey);
  let entries = (parsed.entries || []).map(migrateEntry);
  const importMap = { ...(parsed.importMap || {}) };
  let updated = 0;
  const touchedDates = new Set();

  for (let i = 0; i < entries.length; i++) {
    const existing = entries[i];
    const incidentId = existing.sourceIncidentId;
    if (!incidentId || !importMap[incidentId]) continue;

    const incident = incidentById[incidentId];
    if (!incident) continue;

    const record = importMap[incidentId];
    const section = record.section || existing.section;
    const fresh = incidentToNhatKyEntry(incident, existing.date, section);
    if (!fresh) continue;

    const merged = mergeImportedEntry(existing, fresh);
    if (!entrySyncDiffers(existing, merged)) continue;

    entries[i] = merged;
    updated += 1;
    touchedDates.add(existing.date);
    importMap[incidentId] = {
      ...record,
      km: incident.km || merged.kmFrom,
      type: merged.type,
      groupName: incident.groupName || record.groupName || "",
      syncedAt: new Date().toISOString()
    };
  }

  if (updated === 0) return { updated: 0, entries };

  for (const dateIso of touchedDates) {
    entries = sortEntriesOnDate(entries, dateIso);
  }

  const finalMap = reconcileImportMap(entries, importMap);
  localStorage.setItem(
    storageKey,
    JSON.stringify({
      ...parsed,
      entries,
      importMap: finalMap
    })
  );
  await persistImportMap(uid, storageKey, finalMap);

  return { updated, entries };
}

export function loadImportMap(storageKey) {
  return loadStorage(storageKey).importMap || {};
}

export function getImportRecord(importMap, incidentId) {
  return importMap[incidentId] || null;
}

export function formatImportNote(record) {
  if (!record) return "";
  return `Đã vào NK ${formatDisplayDate(record.nhatKyDate)} · ${record.section} · ${record.km} · ${record.type}`;
}

/**
 * @param {string} sectionMode - "auto" hoặc tên mục trong SECTIONS
 * @param {string} uid - Firebase uid (đồng bộ importMap)
 * @returns {Promise<{ added: number, skipped: Array, importMap: object }>}
 */
export async function importIncidentsToNhatKy(
  incidents,
  selectedIds,
  nhatKyDateIso,
  storageKey,
  uid,
  sectionMode = "auto"
) {
  const idSet = new Set(selectedIds);
  const sectionOverride = sectionMode === "auto" ? null : sectionMode;
  const importMap = { ...(await loadImportMapRemote(uid, storageKey)) };
  const raw = localStorage.getItem(storageKey);
  const parsed = raw
    ? JSON.parse(raw)
    : { entries: [], dayMeta: {}, reportMeta: {} };
  const entries = Array.isArray(parsed.entries) ? parsed.entries.map(migrateEntry) : [];
  const skipped = [];
  let added = 0;

  for (const inc of incidents) {
    if (!idSet.has(inc.id)) continue;
    if (importMap[inc.id]) {
      skipped.push({
        id: inc.id,
        reason: `Đã đưa vào NK ${formatDisplayDate(importMap[inc.id].nhatKyDate)}`
      });
      continue;
    }
    const autoSection = resolveNhatKySection(inc);
    const section = sectionOverride || autoSection;
    if (!section) {
      skipped.push({ id: inc.id, reason: "Nhóm chưa hỗ trợ đưa sang nhật ký" });
      continue;
    }
    const entry = incidentToNhatKyEntry(inc, nhatKyDateIso, section);
    if (!entry) {
      skipped.push({ id: inc.id, reason: "Không chuyển được dữ liệu" });
      continue;
    }
    entries.push(entry);
    importMap[inc.id] = {
      nhatKyDate: nhatKyDateIso,
      section,
      km: inc.km || entry.kmFrom,
      type: entry.type,
      groupName: inc.groupName || "",
      importedAt: new Date().toISOString()
    };
    added += 1;
  }

  const sortedEntries = sortEntriesOnDate(entries, nhatKyDateIso);
  const finalMap = reconcileImportMap(sortedEntries, importMap);

  localStorage.setItem(
    storageKey,
    JSON.stringify({
      ...parsed,
      entries: sortedEntries,
      importMap: finalMap
    })
  );

  await persistImportMap(uid, storageKey, finalMap);

  return { added, skipped, importMap: finalMap };
}

export function isImportableIncident(incident, importMap = {}) {
  if (importMap[incident.id]) return false;
  return true;
}

export function suggestNhatKySection(incident) {
  return resolveNhatKySection(incident);
}
