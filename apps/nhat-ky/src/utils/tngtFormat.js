import { formatDisplayDate, formatLyTrinh, kmToMeters } from "./nhatKyFormat";

export const TNGT_SECTION = "Tai nạn giao thông";

export const TNGT_AUTO_OPTIONS = [
  { value: "Xe tải", label: "Xe tải" },
  { value: "Xe khách", label: "Xe khách" },
  { value: "Xe con", label: "Xe con" }
];

export const TNGT_SIDE_OPTIONS = [
  { value: "P", label: "P — Phải" },
  { value: "T", label: "T — Trái" },
  { value: "G", label: "G — Giữa" }
];

export const TNGT_CAUSE_OPTIONS = [
  { value: "duong", label: "Do đường", field: "tngtCauseDuong" },
  { value: "nguoi", label: "Do người", field: "tngtCauseNguoi" },
  { value: "phuong_tien", label: "Do phương tiện", field: "tngtCausePhuongTien" }
];

/** Chuẩn hóa phía theo mẫu sổ: P / T / G */
export function formatTngtSide(side) {
  if (!side) return "";
  const s = String(side).toUpperCase();
  if (s === "M" || s === "C" || s === "G") return "G";
  if (s === "P" || s === "T") return s;
  return s.slice(0, 1);
}

/** Cột (2): Vị trí, lý trình — VD: Km372+400 (P) */
export function formatTngtLocationCell(entry) {
  const km = formatKmCell(entry?.kmFrom);
  if (!km) return "";
  const side = formatTngtSide(entry?.side);
  return side ? `${km} (${side})` : km;
}

function migrateVehicleAuto(entry) {
  const raw = entry.vehicleAutoType ?? entry.vehicleAuto ?? "";
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return "";
}

function migrateVehicleInvolved(entry, field, legacyNumField) {
  if (entry[field] === true || entry[field] === false) return entry[field];
  const n = Number(entry[legacyNumField]);
  return n > 0;
}

function migrateCauseFlags(entry) {
  const cat = entry.tngtCauseCategory;
  return {
    tngtCauseDuong:
      entry.tngtCauseDuong === true ||
      (entry.tngtCauseDuong !== false && cat === "duong"),
    tngtCauseNguoi:
      entry.tngtCauseNguoi === true ||
      (entry.tngtCauseNguoi !== false && cat === "nguoi"),
    tngtCausePhuongTien:
      entry.tngtCausePhuongTien === true ||
      (entry.tngtCausePhuongTien !== false && cat === "phuong_tien")
  };
}

/** Bổ sung / migrate các trường TNGT theo mẫu sổ 14 cột. */
export function migrateTngtFields(entry) {
  const causes = migrateCauseFlags(entry);
  return {
    vehicleAutoType: migrateVehicleAuto(entry),
    vehicleMotoInvolved: migrateVehicleInvolved(entry, "vehicleMotoInvolved", "vehicleMoto"),
    vehicleBikeInvolved: migrateVehicleInvolved(entry, "vehicleBikeInvolved", "vehicleBike"),
    ...causes,
    side: entry.side || "P"
  };
}

export function defaultExportTngt() {
  return true;
}

export function shouldExportTngt(entry) {
  const section = entry?.section;
  if (section !== TNGT_SECTION && section !== "An toàn giao thông") return false;
  if (entry.exportTngt === false) return false;
  return entry.exportTngt !== false;
}

export function entryInMonth(entry, yearMonth) {
  if (!yearMonth) return false;
  const occur = entry?.tngtOccurDate || entry?.date;
  return String(occur || "").startsWith(yearMonth);
}

export function filterTngtEntries(entries, yearMonth) {
  return (entries || [])
    .filter((e) => shouldExportTngt(e) && entryInMonth(e, yearMonth))
    .sort((a, b) => {
      const da = a.tngtOccurDate || a.date;
      const db = b.tngtOccurDate || b.date;
      if (da !== db) return da.localeCompare(db);
      return kmToMeters(a.kmFrom) - kmToMeters(b.kmFrom);
    });
}

export function formatKmCell(value) {
  if (!value && value !== 0) return "";
  return `Km${formatLyTrinh(value)}`;
}

function formatHumanDamage(entry) {
  if (entry?.casualtyHumanNote?.trim()) return entry.casualtyHumanNote.trim();

  const dead = Number(entry?.casualtyDead) || 0;
  const injured = Number(entry?.casualtyInjured) || 0;
  if (!dead && !injured) return "không";

  const parts = [];
  if (dead) parts.push(`${dead} người chết`);
  if (injured) parts.push(`${injured} người bị thương`);
  return parts.join(", ");
}

function formatRoadDamage(entry) {
  const v = Number(entry?.damageRoadMillion);
  if (v > 0) return `${v} triệu đồng`;
  if (entry?.damageRoadNote?.trim()) return entry.damageRoadNote.trim();
  return "Không";
}

function formatVehicleDamage(entry) {
  if (entry?.damageVehicleNote?.trim()) return entry.damageVehicleNote.trim();
  const v = Number(entry?.damageVehicleMillion);
  if (v > 0) return `Khoảng ${v} triệu đồng`;
  return "Không";
}

/** Nội dung cột 3 sổ tuần đường — lý trình ở cột 2, ngày theo ngày nhật ký. */
export function formatTngtDiaryContent(entry) {
  const cause = entry?.tngtCauseDetail?.trim() || entry?.content?.trim() || entry?.type || "";
  const lines = [];
  if (cause) lines.push(cause);
  lines.push(`- Thiệt hại về người: ${formatHumanDamage(entry)}`);
  lines.push(`- Thiệt hại về KCHTGT: ${formatRoadDamage(entry)}`);
  lines.push(`- Thiệt hại về phương tiện: ${formatVehicleDamage(entry)}`);
  if (entry?.tngtWitnessStatement?.trim()) {
    lines.push(`- Lời khai người chứng kiến: ${entry.tngtWitnessStatement.trim()}`);
  }
  if (entry?.tngtNote?.trim()) lines.push(`- Ghi chú: ${entry.tngtNote.trim()}`);
  return lines.join("\n");
}

export function formatMonthTitle(yearMonth) {
  const [y, m] = yearMonth.split("-").map(Number);
  if (!y || !m) return yearMonth;
  return `THÁNG ${String(m).padStart(2, "0")}/${y}`;
}

export function formatTngtKmLine(reportMeta) {
  const range = String(reportMeta?.kmRange || "")
    .replace(/\bkm/gi, "Km")
    .replace(/\s*-\s*/g, " Đến ")
    .trim();
  const road = String(reportMeta?.roadName || "").trim();
  if (!range && !road) return "";
  if (!road) return `Đoạn ${range}`;
  return `Đoạn ${range}/${road}`;
}

function formatNum(value) {
  const n = Number(value);
  if (!n && n !== 0) return "";
  return Number.isInteger(n) ? String(n) : String(n);
}

function causeMark(flag) {
  return flag ? "X" : "";
}

/** Một dòng sổ TNGT — 14 cột theo TCVN 14182:2024. */
export function entryToTngtRow(entry, index) {
  const t = migrateTngtFields(entry);
  const noteParts = [entry?.tngtNote].filter((s) => s?.trim());

  return {
    tt: index + 1,
    location: formatTngtLocationCell(entry),
    occurDate: formatDisplayDate(entry?.tngtOccurDate || entry?.date),
    vehicleAuto: t.vehicleAutoType,
    vehicleMoto: causeMark(t.vehicleMotoInvolved),
    vehicleBike: causeMark(t.vehicleBikeInvolved),
    causeDuong: causeMark(t.tngtCauseDuong),
    causeNguoi: causeMark(t.tngtCauseNguoi),
    causePhuongTien: causeMark(t.tngtCausePhuongTien),
    dead: formatNum(entry?.casualtyDead),
    injured: formatNum(entry?.casualtyInjured),
    damageRoad: formatDamageMillion(entry?.damageRoadMillion, entry?.damageRoadNote),
    damageVehicle: formatDamageMillion(entry?.damageVehicleMillion, entry?.damageVehicleNote),
    note: noteParts.join(". ")
  };
}

function formatDamageMillion(value, note) {
  if (value !== "" && value != null && !Number.isNaN(Number(value))) {
    const n = Number(value);
    if (n === 0) return "";
    return Number.isInteger(n) ? String(n) : String(n);
  }
  if (note?.trim()) return note.trim();
  return "";
}
