import { CAU_SECTION } from "./cauRegistryStore";
import { formatContentCol, formatDisplayDate } from "./nhatKyFormat";

/**
 * Phiếu kiểm tra thường xuyên cầu — 1 cầu × 1 tháng = 1 tờ A4 dọc.
 * Số dòng = số ngày trong tháng (vd. tháng 6 → 30).
 * Key: cau-inspection-v2-{uid}__{roadId}__{bridgeId}__{yyyy-mm}
 */

export const CAU_INSPECTION_EVENT = "cau-inspection-changed";
export const NO_DAMAGE_TEXT = "Không phát sinh hư hỏng";

const LEGACY_PREFIX = "cau-inspection-v1-";
const PREFIX = "cau-inspection-v2-";

function sheetKey(uid, roadId, bridgeId, yearMonth) {
  return `${PREFIX}${uid}__${roadId}__${bridgeId}__${yearMonth}`;
}

function legacyKey(uid, roadId, bridgeId, yearMonth) {
  return `${LEGACY_PREFIX}${uid}__${roadId}__${bridgeId}__${yearMonth}`;
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
    return normalizeSheet(raw || {}, { bridgeId, yearMonth });
  } catch {
    return normalizeSheet({}, { bridgeId, yearMonth });
  }
}

export function saveCauInspectionSheet(uid, roadId, bridgeId, yearMonth, sheet) {
  if (!uid || !roadId || !bridgeId || !yearMonth) return sheet;
  const next = normalizeSheet(sheet, {
    bridgeId,
    bridgeName: sheet?.bridgeName,
    km: sheet?.km,
    yearMonth,
    unitName: sheet?.unitName,
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
    // Form trái luôn đồng bộ sang cột họ tên ngày đã qua
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
