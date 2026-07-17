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

/** Hằng số bố cục trang A4 ngang — dùng chung preview + in. */
export const MAT_DUONG_SHEET_LAYOUT = {
  sheetWidthMm: 297,
  sheetHeightMm: 210,
  paddingVerticalMm: 22,
  topBlockMm: 34,
  theadMm: 24,
  /** Chiều cao hàng dữ liệu tối thiểu (mm) */
  dataRowMinMm: 8.6,
  emptyRowMm: 7.2,
  minEmptyRows: 4,
  /**
   * Chừa đáy đủ lớn để hàng cuối luôn nguyên viền dưới
   * (tránh ngắt giữa hàng → mất border như trang 1).
   */
  safetyMm: 14
};

export function matDuongBodyBudgetMm(margins) {
  const L = MAT_DUONG_SHEET_LAYOUT;
  const padV =
    margins != null
      ? (Number(margins.top) || 0) + (Number(margins.bottom) || 0)
      : L.paddingVerticalMm;
  return Math.max(
    40,
    L.sheetHeightMm - padV - L.topBlockMm - L.theadMm - L.safetyMm
  );
}

export function estimateMatDuongDataRowMm(entry) {
  const L = MAT_DUONG_SHEET_LAYOUT;
  const damage = formatDamageLevel(entry);
  const note = entry?.inspectorNote?.trim() || "";

  function countLines(text, charsPerLine) {
    if (!text) return 0;
    let n = 0;
    String(text)
      .split("\n")
      .forEach((line) => {
        n += Math.max(1, Math.ceil(line.length / charsPerLine));
      });
    return n;
  }

  const lines = Math.max(1, countLines(damage, 26), countLines(note, 20));
  // +0.4mm viền/border-collapse để không cắt cạnh dưới hàng
  return Math.max(L.dataRowMinMm, 5.5 + (lines - 1) * 3.8) + 0.4;
}

/**
 * Đệm hàng trống — chia đều phần còn lại sau dữ liệu (cùng công thức preview/in).
 */
export function computeMatDuongPadRows(entries, margins) {
  const L = MAT_DUONG_SHEET_LAYOUT;
  const budgetMm = matDuongBodyBudgetMm(margins);
  const dataMm = (entries || []).reduce(
    (sum, e) => sum + estimateMatDuongDataRowMm(e),
    0
  );
  const remainMm = Math.max(0, budgetMm - dataMm);

  if (remainMm < 3) {
    return { count: 0, rowHeightMm: L.emptyRowMm, remainMm: 0 };
  }

  const count = Math.max(
    entries?.length ? 1 : L.minEmptyRows,
    Math.floor(remainMm / L.emptyRowMm)
  );
  return {
    count,
    rowHeightMm: remainMm / count,
    remainMm
  };
}

/** Chia dòng dữ liệu thành nhiều tờ A4 ngang — không cắt giữa hàng. */
export function packMatDuongPages(entries, margins) {
  const budgetMm = matDuongBodyBudgetMm(margins);
  const list = entries || [];
  if (!list.length) return [[]];

  const pages = [];
  let bucket = [];
  let used = 0;
  list.forEach((entry) => {
    const h = estimateMatDuongDataRowMm(entry);
    // Ngắt sang tờ mới TRƯỚC khi thêm hàng không còn đủ chỗ (kể cả viền)
    if (bucket.length > 0 && used + h > budgetMm) {
      pages.push(bucket);
      bucket = [];
      used = 0;
    }
    if (bucket.length === 0 && h > budgetMm) {
      pages.push([entry]);
      return;
    }
    bucket.push(entry);
    used += h;
  });
  if (bucket.length) pages.push(bucket);
  return pages.length ? pages : [[]];
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
