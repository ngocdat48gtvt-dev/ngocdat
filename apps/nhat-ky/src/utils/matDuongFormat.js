import {
  formatDisplayDate,
  formatLyTrinh,
  migrateEntry,
  EMPTY_REPORT_META,
  normalizeKmInput,
  addMetersToKm
} from "./nhatKyFormat";

export { EMPTY_REPORT_META };

export const MAT_DUONG_SECTION = "Mặt đường";

export const MAT_DUONG_SKIP_TYPES = new Set(["Nước đọng", "Mặt đường bẩn"]);

export function defaultExportMatDuong(type) {
  if (!type) return true;
  return !MAT_DUONG_SKIP_TYPES.has(type);
}

export function shouldExportMatDuong(entry) {
  if (entry.section !== MAT_DUONG_SECTION) return false;
  if (entry.exportMatDuong === true) return true;
  if (entry.exportMatDuong === false) return false;
  return defaultExportMatDuong(entry.type);
}

export function formatMonthLabel(yearMonth) {
  if (!yearMonth) return "";
  const [y, m] = yearMonth.split("-");
  return `THÁNG ${m}/${y}`;
}

export function formatMatDuongMonthTitle(yearMonth) {
  const [y, m] = String(yearMonth || "").split("-").map(Number);
  if (!y || !m) return yearMonth || "";
  return `THÁNG ${String(m).padStart(2, "0")}/${y}`;
}

export function formatMatDuongKmLine(reportMeta) {
  const range = String(reportMeta?.kmRange || "")
    .replace(/\bkm/gi, "Km")
    .replace(/\s*-\s*/g, " đến ")
    .trim();
  const road = String(reportMeta?.roadName || "").replace(/\./g, "").trim();
  if (!range && !road) return "";
  return `Lý trình: ${range}/${road}`;
}

/** Hằng số bố cục trang A4 ngang. */
export const MAT_DUONG_SHEET_LAYOUT = {
  sheetHeightMm: 210,
  paddingVerticalMm: 22,
  topBlockMm: 52,
  theadMm: 22,
  emptyRowMm: 6.5,
  minEmptyRows: 8
};

function estimateMatDuongDataRowMm(entry) {
  const damage = formatDamageLevel(entry);
  const lines = Math.max(1, damage ? 1 : 0);
  const note = entry?.inspectorNote?.trim() || "";
  const noteLines = note ? note.split("\n").length : 1;
  return Math.max(6.5, 4 + Math.max(lines, noteLines) * 4);
}

export function computeMatDuongPadRows(entries) {
  const L = MAT_DUONG_SHEET_LAYOUT;
  const budgetMm =
    L.sheetHeightMm - L.paddingVerticalMm - L.topBlockMm - L.theadMm;
  const dataMm = (entries || []).reduce((sum, e) => sum + estimateMatDuongDataRowMm(e), 0);
  const remainMm = Math.max(0, budgetMm - dataMm);
  const count = Math.max(L.minEmptyRows, Math.round(remainMm / L.emptyRowMm));
  return {
    count,
    rowHeightMm: Math.max(L.emptyRowMm * 0.9, remainMm / count)
  };
}

export function entryInMonth(entry, yearMonth) {
  if (!entry.date || !yearMonth) return false;
  return entry.date.startsWith(yearMonth);
}

export function filterMatDuongEntries(entries, yearMonth) {
  return entries
    .map(migrateEntry)
    .map(withMatDuongKmTo)
    .filter(
      (e) =>
        shouldExportMatDuong(e) && entryInMonth(e, yearMonth)
    )
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return String(a.kmFrom).localeCompare(String(b.kmFrom));
    });
}

export function formatKmCell(value) {
  if (!value && value !== 0) return "";
  const norm = normalizeKmInput(value);
  if (!norm) return "";
  return `Km${norm}`;
}

export function calcAreaM2(entry) {
  const l = Number(entry.length || 0);
  const w = Number(entry.width || 0);
  if (entry.unit === "m2" && entry.quantity) return Number(entry.quantity);
  if (l && w) return Math.round(l * w * 100) / 100;
  return "";
}

export function inferResolvedStatus(entry) {
  if (entry.resolvedStatus === "co" || entry.resolvedStatus === "chua") {
    return entry.resolvedStatus;
  }
  if (entry.resolved?.trim()) return "co";
  return "chua";
}

export function formatDamageLevel(entry) {
  if (entry.type?.trim()) return entry.type.trim();
  if (entry.damageLevel) return entry.damageLevel;
  return "";
}

function parseLengthMeters(value) {
  if (value === "" || value == null) return 0;
  const n = Number(String(value).trim().replace(/\s/g, "").replace(",", "."));
  return Number.isNaN(n) ? 0 : n;
}

/** Điểm cuối = điểm đầu + chiều dài (m). Không dùng kmTo lưu sai. */
export function resolveEntryKmTo(entry) {
  const kmFrom = normalizeKmInput(entry?.kmFrom);
  if (!kmFrom) return normalizeKmInput(entry?.kmTo);
  const lengthM = parseLengthMeters(entry?.length);
  if (lengthM > 0) return addMetersToKm(kmFrom, lengthM);
  return kmFrom;
}

export function withMatDuongKmTo(entry) {
  if (entry?.section !== MAT_DUONG_SECTION) return entry;
  const kmFrom = normalizeKmInput(entry.kmFrom);
  const normalized = { ...entry, kmFrom };
  return { ...normalized, kmTo: resolveEntryKmTo(normalized) };
}

export function entryToMatDuongRow(entry) {
  const status = inferResolvedStatus(entry);
  const damageCell = formatDamageLevel(entry);
  const kmTo = resolveEntryKmTo(entry);

  return {
    date: formatDisplayDate(entry.date),
    kmFrom: formatKmCell(entry.kmFrom),
    kmTo: formatKmCell(kmTo),
    side: entry.side || "",
    length: entry.length || "",
    width: entry.width || "",
    area: calcAreaM2(entry),
    damageLevel: damageCell,
    resolvedCo: status === "co" ? "X" : "",
    resolvedChua: status === "chua" ? "X" : "",
    inspectorSign: entry.inspectorSign || "",
    inspectorNote: entry.inspectorNote || ""
  };
}
