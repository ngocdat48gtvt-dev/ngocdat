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

export const NEN_DUONG_SECTION = "Nền đường";

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
  if (e.section !== NEN_DUONG_SECTION) return false;
  if (e.exportTrafficDuty === false) return false;
  if (e.exportTrafficDuty === true) return true;
  return isBaoLuSource(e);
}

export function defaultExportTrafficDuty(entry) {
  return isBaoLuSource(entry);
}

export function filterTrafficDutyEntries(entries, yearMonth) {
  const prefix = `${yearMonth}-`;
  return entries
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
  const n = Number(value);
  if (!n && n !== 0) return "";
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
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
  if (reportMeta?.trafficDutyLeaderSign?.trim()) {
    return reportMeta.trafficDutyLeaderSign.trim();
  }
  if (dayMeta?.leaderSign?.trim()) return dayMeta.leaderSign.trim();
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
  if (e.trafficRestoredAt?.trim()) return e.trafficRestoredAt.trim();
  if (e.sourceIncidentCompletedDate?.trim()) return e.sourceIncidentCompletedDate.trim();
  return "";
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
    dutyPerson:
      reportMeta?.trafficDutyPerson?.trim() ||
      dayMeta?.dutyPerson?.trim() ||
      e.dutyPerson ||
      "",
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

/** Dòng lý trình tiêu đề — VD: LÝ TRÌNH: KM357 - KM404/QL37 */
export function formatTrafficDutyKmLine(reportMeta) {
  const range = String(reportMeta?.kmRange || "")
    .replace(/\bkm/gi, "KM")
    .replace(/\s*-\s*/g, " - ")
    .trim();
  const road = String(reportMeta?.roadName || "")
    .replace(/\./g, "")
    .trim();
  if (!range && !road) return "LÝ TRÌNH:";
  if (!road) return `LÝ TRÌNH: ${range}`;
  return `LÝ TRÌNH: ${range}/${road}`;
}

const CELL_FIELD_MAP = {
  dutyPerson: "dutyPerson",
  cause: "trafficCause",
  directives: "leaderNote",
  restoredAt: "trafficRestoredAt",
  note: "trafficNote"
};

/** Giá trị raw để nhập trực tiếp trên bảng. */
export function getTrafficDutyCellValue(entry, field, dayMetaMap, reportMeta, applyAll) {
  const e = migrateEntry(entry);
  const dayMeta = getDayMeta(dayMetaMap || {}, e.date);
  const all = applyAll || {};

  switch (field) {
    case "dutyPerson":
      if (all.dutyPerson) return reportMeta?.trafficDutyPerson || "";
      return e.dutyPerson || reportMeta?.trafficDutyPerson || dayMeta?.dutyPerson || "";
    case "reportRecipient":
      if (all.reportRecipient) return reportMeta?.trafficDutyLeaderSign || "";
      return dayMeta?.leaderSign?.trim() || reportMeta?.trafficDutyLeaderSign || "";
    case "cause":
      return e.trafficCause || "";
    case "directives":
      return e.leaderNote || "";
    case "restoredAt":
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
