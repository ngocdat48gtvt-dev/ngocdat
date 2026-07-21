import { CAU_SECTION } from "./cauRegistryStore";
import { formatContentCol, formatDisplayDate } from "./nhatKyFormat";

/**
 * Phiếu kiểm tra thường xuyên cầu — 1 cầu × 1 tháng = 1 tờ A4 dọc.
 * Số dòng = số ngày trong tháng (vd. tháng 6 → 30).
 * Key: cau-inspection-v2-{uid}__{roadId}__{bridgeId}__{yyyy-mm}
 *
 * Đơn vị nhận quản lý… lưu chung theo sổ (hạt/đường) — mọi cầu, mọi tháng.
 */

export const CAU_INSPECTION_EVENT = "cau-inspection-changed";
export const NO_DAMAGE_TEXT = "Không phát sinh hư hỏng";

const LEGACY_PREFIX = "cau-inspection-v1-";
const PREFIX = "cau-inspection-v2-";
const ROAD_META_PREFIX = "cau-inspection-road-meta-v1-";

function sheetKey(uid, roadId, bridgeId, yearMonth) {
  return `${PREFIX}${uid}__${roadId}__${bridgeId}__${yearMonth}`;
}

function legacyKey(uid, roadId, bridgeId, yearMonth) {
  return `${LEGACY_PREFIX}${uid}__${roadId}__${bridgeId}__${yearMonth}`;
}

function roadMetaKey(uid, roadId) {
  return `${ROAD_META_PREFIX}${uid}__${roadId}`;
}

export function daysInMonth(yearMonth) {
  const [y, m] = String(yearMonth || "").split("-").map(Number);
  if (!y || !m) return 31;
  return new Date(y, m, 0).getDate();
}

export function isoDateForDay(yearMonth, day) {
  const [y, m] = String(yearMonth || "").split("-");
  if (!y || !m) return "";
  return `${y}-${m}-${String(day).padStart(2, "0")}`;
}

function todayIsoLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function emptyRow(date = "") {
  return {
    date,
    tuanDuongName: "",
    damageStatus: "",
    proposal: "",
    tuanKiemName: "",
    tuanKiemProposal: "",
    note: "",
    autoNoDamage: false
  };
}

function normalizeRow(row, fallbackDate = "") {
  return {
    date: String(row?.date || fallbackDate || "").trim(),
    tuanDuongName: String(row?.tuanDuongName || "").trim(),
    damageStatus: String(row?.damageStatus || "").trim(),
    proposal: String(row?.proposal || "").trim(),
    tuanKiemName: String(row?.tuanKiemName || "").trim(),
    tuanKiemProposal: String(row?.tuanKiemProposal || "").trim(),
    note: String(row?.note || "").trim(),
    autoNoDamage: Boolean(row?.autoNoDamage)
  };
}

/** Dựng đủ số dòng theo ngày trong tháng; giữ dữ liệu cũ theo date. */
export function buildMonthRows(yearMonth, existingRows = []) {
  const n = daysInMonth(yearMonth);
  const byDate = new Map();
  (existingRows || []).forEach((r) => {
    const d = String(r?.date || "").trim();
    if (d) byDate.set(d, normalizeRow(r, d));
  });
  const rows = [];
  for (let day = 1; day <= n; day += 1) {
    const iso = isoDateForDay(yearMonth, day);
    rows.push(byDate.get(iso) || emptyRow(iso));
  }
  return rows;
}

function normalizeSheet(raw, meta = {}) {
  const yearMonth = meta.yearMonth || raw?.yearMonth || "";
  const rows = buildMonthRows(yearMonth, raw?.rows || []);
  return {
    bridgeId: meta.bridgeId || raw?.bridgeId || "",
    bridgeName: meta.bridgeName || raw?.bridgeName || "",
    km: meta.km || raw?.km || "",
    yearMonth,
    unitName: String(raw?.unitName || meta.unitName || "").trim(),
    sheetNo: String(raw?.sheetNo || "").trim(),
    tuanDuongDefault: String(raw?.tuanDuongDefault || meta.tuanDuongDefault || "").trim(),
    tuanKiemDefault: String(raw?.tuanKiemDefault || meta.tuanKiemDefault || "").trim(),
    rows
  };
}

export function yearMonthFromDate(isoDate) {
  const d = String(isoDate || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return "";
  return d.slice(0, 7);
}

/** Meta chung của sổ KT cầu (theo hạt) — đơn vị QL duy tu. */
export function loadCauRoadMeta(uid, roadId) {
  if (!uid || !roadId) return { unitName: "" };
  try {
    const raw = JSON.parse(localStorage.getItem(roadMetaKey(uid, roadId)) || "null");
    return {
      unitName: String(raw?.unitName || "").trim()
    };
  } catch {
    return { unitName: "" };
  }
}

export function saveCauRoadMeta(uid, roadId, meta, { silent = false } = {}) {
  if (!uid || !roadId) return loadCauRoadMeta(uid, roadId);
  const next = {
    unitName: String(meta?.unitName ?? "").trim()
  };
  localStorage.setItem(roadMetaKey(uid, roadId), JSON.stringify(next));
  if (!silent && typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(CAU_INSPECTION_EVENT, { detail: { roadMeta: true, roadId } })
    );
  }
  return next;
}

/** Liệt kê mọi tờ phiếu local của 1 sổ (hạt). */
export function listCauInspectionLocalKeys(uid, roadId) {
  if (!uid || !roadId || typeof localStorage === "undefined") return [];
  const needle = `${PREFIX}${uid}__${roadId}__`;
  const out = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(needle)) continue;
    const rest = key.slice(needle.length);
    const sep = rest.lastIndexOf("__");
    if (sep <= 0) continue;
    const bridgeId = rest.slice(0, sep);
    const yearMonth = rest.slice(sep + 2);
    if (bridgeId && /^\d{4}-\d{2}$/.test(yearMonth)) {
      out.push({ key, bridgeId, yearMonth });
    }
  }
  return out;
}

/**
 * Ghi đơn vị QL vào meta sổ + lan sang mọi cầu / mọi tháng đã có local.
 * Firebase đồng bộ qua useCauInspectionSync.
 */
export function persistCauRoadUnitName(uid, roadId, unitName) {
  if (!uid || !roadId) return "";
  const name = String(unitName || "").trim();
  saveCauRoadMeta(uid, roadId, { unitName: name }, { silent: true });

  listCauInspectionLocalKeys(uid, roadId).forEach(({ key, bridgeId, yearMonth }) => {
    try {
      const raw = JSON.parse(localStorage.getItem(key) || "null") || {};
      const next = normalizeSheet(
        { ...raw, unitName: name },
        { bridgeId, yearMonth, unitName: name }
      );
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  });

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(CAU_INSPECTION_EVENT, {
        detail: { roadMeta: true, unitName: name, roadId }
      })
    );
  }
  return name;
}

export function loadCauInspectionSheet(uid, roadId, bridgeId, yearMonth) {
  if (!uid || !roadId || !bridgeId || !yearMonth) {
    return normalizeSheet({}, { bridgeId, yearMonth });
  }
  try {
    let raw = null;
    const v2 = localStorage.getItem(sheetKey(uid, roadId, bridgeId, yearMonth));
    if (v2) {
      raw = JSON.parse(v2);
    } else {
      const v1 = localStorage.getItem(legacyKey(uid, roadId, bridgeId, yearMonth));
      if (v1) raw = JSON.parse(v1);
    }
    let roadMeta = loadCauRoadMeta(uid, roadId);
    // Migrate: tờ cũ đã có unitName → nâng lên meta sổ
    if (!roadMeta.unitName && raw?.unitName) {
      roadMeta = saveCauRoadMeta(uid, roadId, { unitName: raw.unitName }, { silent: true });
    }
    const sheet = normalizeSheet(raw || {}, {
      bridgeId,
      yearMonth,
      unitName: roadMeta.unitName || raw?.unitName
    });
    if (roadMeta.unitName) sheet.unitName = roadMeta.unitName;
    return sheet;
  } catch {
    return normalizeSheet({}, { bridgeId, yearMonth });
  }
}

export function saveCauInspectionSheet(uid, roadId, bridgeId, yearMonth, sheet) {
  if (!uid || !roadId || !bridgeId || !yearMonth) return sheet;
  const unitFromSheet = String(sheet?.unitName || "").trim();
  if (unitFromSheet) {
    persistCauRoadUnitName(uid, roadId, unitFromSheet);
  }
  const roadMeta = loadCauRoadMeta(uid, roadId);
  const next = normalizeSheet(sheet, {
    bridgeId,
    bridgeName: sheet?.bridgeName,
    km: sheet?.km,
    yearMonth,
    unitName: roadMeta.unitName || unitFromSheet,
    tuanDuongDefault: sheet?.tuanDuongDefault,
    tuanKiemDefault: sheet?.tuanKiemDefault
  });
  localStorage.setItem(sheetKey(uid, roadId, bridgeId, yearMonth), JSON.stringify(next));
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(CAU_INSPECTION_EVENT, { detail: { bridgeId, yearMonth } })
    );
  }
  return next;
}

/**
 * Ngày đã qua: điền họ tên tuần đường / tuần kiểm từ form trái;
 * nếu chưa có hư hỏng từ nhật ký → «Không phát sinh hư hỏng».
 */
export function applyPassedDaysDefaults(sheet, { todayIso = todayIsoLocal() } = {}) {
  if (!sheet?.rows?.length) return sheet;
  const tuanDuong = String(sheet.tuanDuongDefault || "").trim();
  const tuanKiem = String(sheet.tuanKiemDefault || "").trim();
  const rows = sheet.rows.map((row) => {
    const date = row.date;
    if (!date || date >= todayIso) return row;
    const next = { ...row };
    if (tuanDuong) next.tuanDuongName = tuanDuong;
    if (tuanKiem) next.tuanKiemName = tuanKiem;
    const hasRealDamage =
      next.damageStatus &&
      !next.autoNoDamage &&
      next.damageStatus.trim() !== NO_DAMAGE_TEXT;
    if (!hasRealDamage) {
      next.damageStatus = NO_DAMAGE_TEXT;
      next.autoNoDamage = true;
    }
    return next;
  });
  return { ...sheet, rows };
}

export function upsertDamageOnCauSheet(uid, roadId, bridge, entry, inspectorName = "") {
  if (!uid || !roadId || !bridge?.id || !entry?.date) return null;
  const ym = yearMonthFromDate(entry.date);
  if (!ym) return null;

  let sheet = loadCauInspectionSheet(uid, roadId, bridge.id, ym);
  sheet.bridgeName = bridge.name || sheet.bridgeName;
  sheet.km = bridge.km || sheet.km;

  const damage =
    formatContentCol(entry, "") ||
    [entry.type, entry.content].filter(Boolean).join(" — ");
  if (!damage) return sheet;

  const dateIso = entry.date;
  const idx = sheet.rows.findIndex((r) => r.date === dateIso);
  if (idx < 0) return sheet;

  const prev = sheet.rows[idx];
  const base =
    prev.autoNoDamage || prev.damageStatus === NO_DAMAGE_TEXT ? "" : prev.damageStatus;
  const mergedDamage = base
    ? base.includes(damage)
      ? base
      : `${base}; ${damage}`
    : damage;

  sheet.rows[idx] = {
    ...prev,
    date: dateIso,
    tuanDuongName:
      prev.tuanDuongName || sheet.tuanDuongDefault || inspectorName || "",
    tuanKiemName: prev.tuanKiemName || sheet.tuanKiemDefault || "",
    damageStatus: mergedDamage,
    autoNoDamage: false
  };

  sheet = applyPassedDaysDefaults(sheet);
  return saveCauInspectionSheet(uid, roadId, bridge.id, ym, sheet);
}

export function syncCauInspectionsFromEntries(uid, roadId, bridges, entries, inspectorName = "") {
  const list = Array.isArray(bridges) ? bridges : [];
  const cauEntries = (entries || []).filter(
    (e) => e.section === CAU_SECTION && e.exportPhieuCau !== false
  );
  cauEntries.forEach((entry) => {
    let bridge =
      list.find((b) => b.id && b.id === entry.bridgeId) ||
      list.find((b) => {
        const bk = String(b.km || "")
          .replace(/^km\s*/i, "")
          .replace(/\s+/g, "");
        const ek = String(entry.kmFrom || "")
          .replace(/^km\s*/i, "")
          .replace(/\s+/g, "");
        return bk && ek && bk === ek;
      });
    if (!bridge && entry.bridgeName) {
      bridge = list.find((b) => b.name === entry.bridgeName);
    }
    if (!bridge) return;
    upsertDamageOnCauSheet(uid, roadId, bridge, entry, inspectorName);
  });
}

/** Áp dụng mặc định ngày đã qua cho 1 tờ (gọi khi mở phiếu / đổi tháng). */
export function refreshCauSheetPassedDays(uid, roadId, bridgeId, yearMonth, patch = {}) {
  let sheet = loadCauInspectionSheet(uid, roadId, bridgeId, yearMonth);
  sheet = { ...sheet, ...patch };
  sheet = applyPassedDaysDefaults(sheet);
  return saveCauInspectionSheet(uid, roadId, bridgeId, yearMonth, sheet);
}

export function monthLabelVi(yearMonth) {
  const [y, m] = String(yearMonth || "").split("-");
  if (!y || !m) return yearMonth || "";
  return `Tháng ${Number(m)}/${y}`;
}

export function formatInspectionDate(iso) {
  return formatDisplayDate(iso) || iso || "";
}

/** @deprecated dùng daysInMonth */
export const CAU_INSPECTION_ROWS = 31;
