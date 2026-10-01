import {
  displayDayWeather,
  formatDisplayDate,
  formatLyTrinh,
  getDayMeta,
  migrateEntry,
  parseDayWeather,
  kmToMeters
} from "./nhatKyFormat";
import { normalizeGroupKey } from "./incidentImport";
import { expandEntriesForVolumeBooks } from "./mergeDiaryEntries";
import { formatBookKmTitleLine } from "./roadsCatalog";
import { formatBookDecimal } from "./bookNumberFormat";

export const NEN_DUONG_SECTION = "Nền đường";
export const MAT_DUONG_SECTION = "Mặt đường";
export const LE_DUONG_SECTION = "Lề đường";
export const THOAT_NUOC_SECTION = "Cống, rãnh thoát nước";

/** Hạng mục có cột tick «Bão lũ» → xuất sổ trực ĐBGT. */
export const BAO_LU_TICK_SECTIONS = new Set([
  NEN_DUONG_SECTION,
  MAT_DUONG_SECTION,
  LE_DUONG_SECTION,
  THOAT_NUOC_SECTION
]);

export function isBaoLuTickSection(section) {
  return BAO_LU_TICK_SECTIONS.has(String(section || "").trim());
}

const BAO_LU_KEYS = new Set(["bão lũ", "bao lu"].map(normalizeGroupKey));

/** Loại thiệt hại → nguyên nhân (theo hướng dẫn ghi sổ trực ĐBGT) */
const CAUSE_BY_DAMAGE = {
  "sụt dương": "Do sụt taluy dương",
  "sụt âm": "Do sụt taluy âm",
  "sạt đường": "Do sạt taluy",
  "sa bồi lề mặt đường": "Do sa bồi lề, mặt đường",
  "sa bồi rãnh đất": "Do sa bồi rãnh đất",
  "sa bồi rãnh xây": "Do sa bồi rãnh xây",
  "sa bồi cống": "Do sa bồi cống",
  "sa bồi hố thu nước": "Do sa bồi hố thu nước",
  "sụt lún": "Do sụt lún nền đường",
  "sạt taluy": "Do sạt taluy",
  "tắc đường": "Do sạt, bùn che phủ mặt đường"
};

function isBaoLuSource(entry) {
  return BAO_LU_KEYS.has(normalizeGroupKey(entry.sourceGroupName));
}

export function shouldExportTrafficDuty(entry) {
  const e = migrateEntry(entry);
  if (!isBaoLuTickSection(e.section)) return false;
  if (e.exportTrafficDuty === false) return false;
  if (e.exportTrafficDuty === true) return true;
  // Legacy: nhóm bão lũ app → tự xuất khi thuộc Nền đường.
  return e.section === NEN_DUONG_SECTION && isBaoLuSource(e);
}

export function defaultExportTrafficDuty(entry) {
  return isBaoLuSource(entry);
}

export function filterTrafficDutyEntries(entries, yearMonth) {
  const prefix = `${yearMonth}-`;
  // Gộp chỉ trên sổ tuần đường — sổ bão lũ tách từng vị trí.
  return expandEntriesForVolumeBooks(entries || [])
    .map(migrateEntry)
    .filter((e) => shouldExportTrafficDuty(e) && String(e.date || "").startsWith(prefix))
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      const typeCmp = (a.sourceIncidentType || a.type || "").localeCompare(
        b.sourceIncidentType || b.type || "",
        "vi"
      );
      if (typeCmp !== 0) return typeCmp;
      return kmToMeters(a.kmFrom) - kmToMeters(b.kmFrom);
    });
}

export function formatKmCell(value) {
  if (!value && value !== 0) return "";
  return `Km${formatLyTrinh(value)}`;
}

function formatSideLabel(side) {
  const p = String(side || "").trim().toUpperCase();
  if (p === "P") return "P";
  if (p === "T") return "T";
  if (p === "M") return "M";
  return side || "";
}

function formatNum(value) {
  return formatBookDecimal(value);
}

/** Thời tiết từ nhật ký tuần đường — chỉ hiện tình trạng, không kèm nhiệt độ. */
function weatherFromDayMeta(dayMeta) {
  const raw = dayMeta?.weather || "";
  if (!raw) return "";
  const { weather } = parseDayWeather(raw);
  if (weather) return weather;
  const displayed = displayDayWeather(raw);
  if (!displayed) return raw.trim();
  return displayed
    .replace(/^Thời tiết:\s*/i, "")
    .replace(/,?\s*nhiệt độ:.*$/i, "")
    .trim();
}

/** Thời tiết từ nhật ký tuần đường — dayMeta theo ngày trực. */
export function weatherFromNhatKyDay(dayMetaMap, dateIso) {
  const meta = getDayMeta(dayMetaMap || {}, dateIso);
  return weatherFromDayMeta(meta);
}

export function inferTrafficCause(entry, dayMeta) {
  const e = migrateEntry(entry);
  if (e.trafficCause?.trim()) return e.trafficCause.trim();

  const damageKey = normalizeGroupKey(e.sourceIncidentType || e.type);
  if (CAUSE_BY_DAMAGE[damageKey]) return CAUSE_BY_DAMAGE[damageKey];

  const weather = weatherFromDayMeta(dayMeta);
  if (weather) return weather;
  return "Mưa";
}

function formatReportRecipient(entry, dayMeta, reportMeta) {
  if (dayMeta?.leaderSign?.trim()) return dayMeta.leaderSign.trim();
  if (reportMeta?.trafficDutyLeaderSign?.trim()) {
    return reportMeta.trafficDutyLeaderSign.trim();
  }
  return "";
}

/** Cột 5 sổ chi tiết — nhận xét / chỉ đạo của Hạt trưởng */
function formatDirectives(entry, dayMeta) {
  const e = migrateEntry(entry);
  if (e.leaderNote?.trim()) return e.leaderNote.trim();
  if (dayMeta?.leaderComment?.trim()) return dayMeta.leaderComment.trim();
  return "";
}

function formatRestoredAt(entry) {
  const e = migrateEntry(entry);
  // Chỉ hiện giá trị người dùng nhập tay — không lấy từ app / ngày hoàn thành sự cố
  if (isLegacyAutoRestoredAt(e)) return "";
  if (e.trafficRestoredAt?.trim()) return e.trafficRestoredAt.trim();
  return "";
}

/** Email login từng bị đổ vào cột Người trực — không coi là tên người. */
export function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function normalizeDateToken(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return raw;
}

/** Thời gian thông xe từng tự lấy completedDate từ app hiện trường. */
export function isLegacyAutoRestoredAt(entry) {
  const restored = String(entry?.trafficRestoredAt || "").trim();
  if (!restored) return false;
  const completed = String(entry?.sourceIncidentCompletedDate || "").trim();
  if (completed) {
    if (restored === completed) return true;
    const a = normalizeDateToken(restored);
    const b = normalizeDateToken(completed);
    if (a && b && a === b) return true;
  }
  // Import cũ: chỉ ghi thuần ngày hoàn thành (không có giờ / chữ) — coi là tự điền
  if (
    entry?.sourceIncidentId &&
    /^(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})$/.test(restored)
  ) {
    return true;
  }
  return false;
}

/** Xóa người trực (email) / TG thông xe tự điền cũ — người dùng tự nhập lại. */
export function scrubLegacyTrafficDutyAutoFill(entry) {
  const e = migrateEntry(entry);
  let next = e;
  if (looksLikeEmail(e.dutyPerson)) {
    next = { ...next, dutyPerson: "" };
  }
  if (isLegacyAutoRestoredAt(next)) {
    next = { ...next, trafficRestoredAt: "" };
  }
  return next;
}

function formatTrafficNote(entry, dayMeta) {
  const e = migrateEntry(entry);
  if (e.trafficNote?.trim()) return e.trafficNote.trim();

  const parts = [];
  if (e.content?.trim()) parts.push(e.content.trim());
  if (e.inspectorNote?.trim()) parts.push(e.inspectorNote.trim());
  if (dayMeta?.inspectorComment?.trim()) parts.push(dayMeta.inspectorComment.trim());
  return parts.join("\n");
}

/**
 * Một dòng sổ trực ĐBGT — lấy từ dòng Nền đường trên sổ nhật ký chi tiết + meta ngày.
 */
export function entryToTrafficDutyRow(entry, dayMetaMap, reportMeta) {
  const e = migrateEntry(entry);
  const dayMeta = getDayMeta(dayMetaMap || {}, e.date);

  return {
    dutyDate: formatDisplayDate(e.date),
    weather: weatherFromNhatKyDay(dayMetaMap, e.date),
    damageContent: e.sourceIncidentType || e.type || "",
    kmFrom: formatKmCell(e.kmFrom),
    kmTo: formatKmCell(e.kmTo),
    side: formatSideLabel(e.side),
    length: formatNum(e.length),
    width: formatNum(e.width),
    height: formatNum(e.height),
    quantity: formatNum(e.quantity),
    cause: inferTrafficCause(e, dayMeta),
    // Người trực: nhập tay trên dòng, hoặc tên chung từ sidebar (reportMeta)
    dutyPerson: (() => {
      const own = looksLikeEmail(e.dutyPerson) ? "" : e.dutyPerson?.trim() || "";
      if (own) return own;
      return String(reportMeta?.trafficDutyPerson || "").trim();
    })(),
    reportRecipient: formatReportRecipient(e, dayMeta, reportMeta),
    directives: formatDirectives(e, dayMeta),
    restoredAt: formatRestoredAt(e),
    note: formatTrafficNote(e, dayMeta)
  };
}

export function formatMonthTitle(yearMonth) {
  const [y, m] = yearMonth.split("-").map(Number);
  if (!y || !m) return yearMonth;
  return `THÁNG ${String(m).padStart(2, "0")}/${y}`;
}

/** Dòng lý trình tiêu đề sổ bão lũ. */
export function formatTrafficDutyKmLine(reportMeta) {
  return formatBookKmTitleLine(reportMeta);
}

const CELL_FIELD_MAP = {
  dutyPerson: "dutyPerson",
  cause: "trafficCause",
  directives: "leaderNote",
  restoredAt: "trafficRestoredAt",
  note: "trafficNote"
};

/** Giá trị raw để nhập trực tiếp trên bảng. */
export function getTrafficDutyCellValue(entry, field, dayMetaMap, reportMeta) {
  const e = migrateEntry(entry);
  const dayMeta = getDayMeta(dayMetaMap || {}, e.date);

  switch (field) {
    case "dutyPerson": {
      const own = looksLikeEmail(e.dutyPerson) ? "" : e.dutyPerson;
      if (typeof own === "string" && own.length) return own;
      return reportMeta?.trafficDutyPerson || "";
    }
    case "reportRecipient": {
      // Không .trim() khi đang nhập — nếu trim sẽ mất dấu cách giữa các từ
      const day = dayMeta?.leaderSign;
      if (typeof day === "string") return day;
      return reportMeta?.trafficDutyLeaderSign || "";
    }
    case "cause":
      return e.trafficCause || "";
    case "directives":
      return e.leaderNote || "";
    case "restoredAt":
      if (isLegacyAutoRestoredAt(e)) return "";
      return e.trafficRestoredAt || "";
    case "note":
      return e.trafficNote || "";
    default:
      return "";
  }
}

export function trafficDutyEntryField(field) {
  if (field === "reportRecipient") return null;
  return CELL_FIELD_MAP[field] || field;
}

/** Hằng số bố cục trang A4 ngang — preview + in. */
export const TRAFFIC_DUTY_SHEET_LAYOUT = {
  sheetWidthMm: 297,
  sheetHeightMm: 210,
  paddingVerticalMm: 20,
  topBlockMm: 26,
  theadMm: 22,
  dataRowMinMm: 8.2,
  emptyRowMm: 7,
  minEmptyRows: 4,
  safetyMm: 10
};

export function trafficDutyBodyBudgetMm(margins) {
  const L = TRAFFIC_DUTY_SHEET_LAYOUT;
  const padV =
    margins != null
      ? (Number(margins.top) || 0) + (Number(margins.bottom) || 0)
      : L.paddingVerticalMm;
  return Math.max(
    40,
    L.sheetHeightMm - padV - L.topBlockMm - L.theadMm - L.safetyMm
  );
}

export function estimateTrafficDutyDataRowMm(entry, dayMetaMap, reportMeta) {
  const L = TRAFFIC_DUTY_SHEET_LAYOUT;
  const r = entryToTrafficDutyRow(entry, dayMetaMap, reportMeta);
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
  const lines = Math.max(
    1,
    countLines(r.damageContent, 16),
    countLines(r.directives, 14),
    countLines(r.note, 12),
    countLines(r.cause, 12)
  );
  return Math.max(L.dataRowMinMm, 5.5 + (lines - 1) * 3.5) + 0.4;
}

export function computeTrafficDutyPadRows(entries, margins, dayMetaMap, reportMeta) {
  const L = TRAFFIC_DUTY_SHEET_LAYOUT;
  const budgetMm = trafficDutyBodyBudgetMm(margins);
  const dataMm = (entries || []).reduce(
    (sum, e) => sum + estimateTrafficDutyDataRowMm(e, dayMetaMap, reportMeta),
    0
  );
  const remainMm = Math.max(0, budgetMm - dataMm);
  if (remainMm < 3) return { count: 0, rowHeightMm: L.emptyRowMm };
  const count = Math.max(
    entries?.length ? 1 : L.minEmptyRows,
    Math.floor(remainMm / L.emptyRowMm)
  );
  return { count, rowHeightMm: remainMm / count };
}

export function packTrafficDutyPages(entries, margins, dayMetaMap, reportMeta) {
  const budgetMm = trafficDutyBodyBudgetMm(margins);
  const list = entries || [];
  if (!list.length) return [[]];
  const pages = [];
  let bucket = [];
  let used = 0;
  list.forEach((entry) => {
    const h = estimateTrafficDutyDataRowMm(entry, dayMetaMap, reportMeta);
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
