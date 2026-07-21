import { formatDisplayDate, formatLocationCol, HANH_LANG_SECTION } from "./nhatKyFormat";

export { HANH_LANG_SECTION };

export function defaultExportHanhLang() {
  return true;
}

export function shouldExportHanhLang(entry) {
  if (entry?.section !== HANH_LANG_SECTION) return false;
  if (entry.exportHanhLang === false) return false;
  return entry.exportHanhLang !== false;
}

export function entryInMonth(entry, yearMonth) {
  if (!yearMonth) return false;
  const d = entry?.hlRecordDate || entry?.date;
  return String(d || "").startsWith(yearMonth);
}

export function filterHanhLangEntries(entries, yearMonth) {
  return (entries || [])
    .filter((e) => shouldExportHanhLang(e) && entryInMonth(e, yearMonth))
    .sort((a, b) => {
      const da = a.hlRecordDate || a.date;
      const db = b.hlRecordDate || b.date;
      if (da !== db) return da.localeCompare(db);
      return String(a.kmFrom || "").localeCompare(String(b.kmFrom || ""));
    });
}

export function formatHanhLangKmLine(reportMeta) {
  const range = String(reportMeta?.kmRange || "")
    .replace(/\bkm/gi, "Km")
    .replace(/\s*-\s*/g, " Đến ")
    .trim();
  const road = String(reportMeta?.roadName || "").trim();
  if (!range && !road) return "";
  if (!road) return `Lý trình: ${range}`;
  return `Lý trình: ${range}/tuyến ${road}`;
}

/** Tiêu đề tháng trong dòng «THÁNG …/20…». */
export function formatHanhLangMonthTitle(yearMonth) {
  const [y, m] = yearMonth.split("-").map(Number);
  if (!y || !m) return yearMonth;
  return `THÁNG ${String(m).padStart(2, "0")}/${y}`;
}

function formatViolationContent(entry) {
  const content = entry?.content?.trim();
  if (content) return content;
  return entry?.type?.trim() || "";
}

function formatAreaCell(entry) {
  const l = entry?.length;
  const w = entry?.width;
  if (l && w) return `${l}*${w}`;
  const q = entry?.quantity;
  if (q && entry?.unit) {
    const unit = String(entry.unit).replace(/m²|m2/gi, "").trim();
    return unit ? `${q} ${unit}` : String(q);
  }
  if (q) return String(q);
  return "";
}

/** Hằng số bố cục trang A4 ngang — dùng chung preview + in. */
export const HANH_LANG_SHEET_LAYOUT = {
  sheetWidthMm: 297,
  sheetHeightMm: 210,
  paddingVerticalMm: 22,
  topBlockMm: 48,
  theadMm: 18,
  footerMm: 8,
  dataRowMinMm: 7,
  emptyRowMm: 7,
  minEmptyRows: 4,
  safetyMm: 10
};

export function hanhLangBodyBudgetMm(margins) {
  const L = HANH_LANG_SHEET_LAYOUT;
  const padV =
    margins != null
      ? (Number(margins.top) || 0) + (Number(margins.bottom) || 0)
      : L.paddingVerticalMm;
  return Math.max(
    40,
    L.sheetHeightMm - padV - L.topBlockMm - L.theadMm - L.footerMm - L.safetyMm
  );
}

export function estimateHanhLangDataRowMm(entry) {
  const L = HANH_LANG_SHEET_LAYOUT;
  const content = entry?.content?.trim() || entry?.type?.trim() || "";
  const contentLines = content ? content.split("\n").length : 1;
  const process = (entry?.hlProcessNote || entry?.resolved || "").trim();
  const processLines = process ? process.split("\n").length : 1;
  const maxLines = Math.max(contentLines, processLines);
  return Math.max(L.dataRowMinMm, 4 + maxLines * 4.5) + 0.4;
}

/** Số dòng trống và chiều cao mỗi dòng để lấp đầy phần thân bảng. */
export function computeHanhLangPadRows(entries, margins) {
  const L = HANH_LANG_SHEET_LAYOUT;
  const budgetMm = hanhLangBodyBudgetMm(margins);
  const dataMm = (entries || []).reduce((sum, e) => sum + estimateHanhLangDataRowMm(e), 0);
  const remainMm = Math.max(0, budgetMm - dataMm);

  if (remainMm < 3) {
    return { count: 0, rowHeightMm: L.emptyRowMm };
  }

  const count = Math.max(
    entries?.length ? 1 : L.minEmptyRows,
    Math.floor(remainMm / L.emptyRowMm)
  );
  return {
    count,
    rowHeightMm: remainMm / count
  };
}

/** Chia dòng dữ liệu thành nhiều tờ A4 ngang. */
export function packHanhLangPages(entries, margins) {
  const budgetMm = hanhLangBodyBudgetMm(margins);
  const list = entries || [];
  if (!list.length) return [[]];

  const pages = [];
  let bucket = [];
  let used = 0;
  list.forEach((entry) => {
    const h = estimateHanhLangDataRowMm(entry);
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

/** Một dòng sổ hành lang — 10 cột Phụ lục 05 QL37. */
export function entryToHanhLangRow(entry, index) {
  const noteParts = [entry?.hlNote, entry?.inspectorNote].filter((s) => s?.trim());

  return {
    tt: index + 1,
    recorder: entry?.hlRecorder?.trim() || entry?.dutyPerson?.trim() || "",
    violator: entry?.hlViolator?.trim() || "",
    address: entry?.hlAddress?.trim() || entry?.locationNote?.trim() || "",
    location: formatLocationCol(entry),
    recordDate: formatDisplayDate(entry?.hlRecordDate || entry?.date),
    content: formatViolationContent(entry),
    area: formatAreaCell(entry),
    process: entry?.hlProcessNote?.trim() || entry?.resolved?.trim() || "",
    note: noteParts.join(". ")
  };
}

export const EMPTY_HANH_LANG_QUICK_ROW = {
  time: "",
  kmFrom: "",
  kmTo: "",
  side: "",
  hlRecorder: "",
  hlViolator: "",
  hlAddress: "",
  content: "",
  length: "",
  width: "",
  resolved: "",
  hlNote: "",
  exportHanhLang: true
};

export function makeEmptyHanhLangRows(count = 6) {
  return Array.from({ length: count }, () => ({ ...EMPTY_HANH_LANG_QUICK_ROW }));
}

function toNum(v) {
  return Number(String(v ?? "").replace(",", ".")) || 0;
}

/** Dựng các dòng hành lang từ bảng nhập nhanh → ghi nhật ký + sổ theo dõi. */
export function buildHanhLangEntriesFromRows(rows, date) {
  const errors = [];
  const entries = [];

  (rows || []).forEach((row, i) => {
    const hasData = [
      row?.kmFrom,
      row?.content,
      row?.hlViolator,
      row?.hlRecorder,
      row?.hlAddress,
      row?.length
    ].some((v) => String(v ?? "").trim());
    if (!hasData) return;
    if (!String(row?.kmFrom ?? "").trim() && !String(row?.content ?? "").trim()) {
      errors.push(`Dòng ${i + 1}: cần lý trình hoặc nội dung vi phạm.`);
      return;
    }

    const l = toNum(row?.length);
    const w = toNum(row?.width);
    const resolved = String(row?.resolved ?? "").trim();
    const entry = {
      section: HANH_LANG_SECTION,
      date,
      time: String(row?.time ?? "").trim(),
      kmFrom: String(row?.kmFrom ?? "").trim(),
      kmTo: String(row?.kmTo ?? "").trim(),
      side: row?.side || "P",
      hlRecorder: String(row?.hlRecorder ?? "").trim(),
      hlViolator: String(row?.hlViolator ?? "").trim(),
      hlAddress: String(row?.hlAddress ?? "").trim(),
      content: String(row?.content ?? "").trim(),
      length: row?.length ?? "",
      width: row?.width ?? "",
      unit: "m2",
      quantity: l && w ? Math.round(l * w * 100) / 100 : 0,
      resolved,
      hlProcessNote: resolved,
      hlNote: String(row?.hlNote ?? "").trim(),
      exportHanhLang: row?.exportHanhLang !== false,
      hlRecordDate: date
    };
    if (Number.isInteger(row?._editIndex)) entry._editIndex = row._editIndex;
    entries.push(entry);
  });

  if (!entries.length) {
    return {
      entries: [],
      errors: errors.length ? errors : ["Không có dòng hợp lệ (cần lý trình hoặc nội dung)."]
    };
  }
  return { entries, errors };
}

export function migrateHanhLangFields(entry) {
  const isHanhLang = entry?.section === HANH_LANG_SECTION;
  return {
    exportHanhLang: entry.exportHanhLang ?? (isHanhLang ? defaultExportHanhLang() : false),
    hlRecorder: entry.hlRecorder ?? "",
    hlViolator: entry.hlViolator ?? "",
    hlAddress: entry.hlAddress ?? "",
    hlRecordDate: entry.hlRecordDate || entry.date || "",
    hlProcessNote: entry.hlProcessNote ?? entry.resolved ?? "",
    hlNote: entry.hlNote ?? entry.inspectorNote ?? ""
  };
}
