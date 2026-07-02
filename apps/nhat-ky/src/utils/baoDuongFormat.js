import {
  formatDisplayDate,
  formatLyTrinh,
  migrateEntry,
  parseDayWeather
} from "./nhatKyFormat";
import {
  MAT_DUONG_SECTION,
  shouldExportMatDuong,
  resolveEntryKmTo,
  calcAreaM2
} from "./matDuongFormat";
import {
  getQualityForType,
  getMaintenanceNameForType,
  getDeadlineDaysForType,
  needMaintenanceForType
} from "./baoDuongQualityStore";

export const BAO_DUONG_MAX_DAYS = 3;

/** Hạng mục sổ tuần đường được đưa sang sổ BDTX (có ngày dự kiến sửa chữa). */
export const BAO_DUONG_SECTIONS = new Set([
  "Mặt đường",
  "Nền đường",
  "Lề đường",
  "Cống, rãnh thoát nước",
  "Ngầm, tràn (lũ, ngập)",
  "Cột mốc GP mặt bằng, lộ giới",
  "Công trình an toàn giao thông",
  "Công tác phát cây",
  "Công trình cầu"
]);

export function isBaoDuongSection(section) {
  return BAO_DUONG_SECTIONS.has(String(section || "").trim());
}

const WORK_NAMES = {
  "Ổ gà": "Sửa chữa ổ gà",
  "Lún vệt bánh xe": "Sửa chữa lún vệt bánh xe",
  "Cao su": "Xử lý cao su",
  "Sình lún": "Xử lý sình lún",
  // Nền đường
  "Sụt lún": "Xử lý sụt lún nền đường",
  "Sạt taluy": "Hót sạt, xử lý taluy",
  "Nứt nền": "Xử lý nứt nền đường",
  "Sụt nhỏ": "Xử lý sụt nhỏ nền đường",
  "Cung trượt": "Xử lý cung trượt nền đường",
  // Lề đường
  "Lề cao": "Hạ lề đường",
  "Lề thấp": "Đắp phụ lề đường",
  "Đọng nước": "Khơi thông thoát nước",
  "Vật cản lề": "Dọn vật cản trên lề",
  "Cỏ mọc": "Phát cỏ, vệ sinh",
  "Nứt lề": "Sửa chữa nứt lề đường",
  "Xói lở lề": "Sửa chữa xói lở lề đường",
  // Cống, rãnh thoát nước
  "Tắc rãnh": "Nạo vét, khơi thông rãnh",
  "Tắc cống": "Thông tắc cống",
  "Đọng bùn": "Nạo vét bùn đất",
  "Hư thoát nước": "Sửa chữa công trình thoát nước",
  // Công trình ATGT
  "Mất biển báo": "Bổ sung, thay thế biển báo",
  "Hỏng cọc tiêu": "Sửa chữa, thay thế cọc tiêu",
  "Hỏng hộ lan": "Sửa chữa hộ lan tôn sóng",
  "Mờ sơn": "Sơn lại vạch kẻ đường",
  "Mất cột Km": "Bổ sung, thay thế cột Km",
  // Phát cây
  "Che cột Km": "Phát cây thông thoáng cột Km",
  "Che cọc tiêu": "Phát cây thông thoáng cọc tiêu",
  "Che đầu cầu/cống": "Phát cây thông thoáng đầu cầu/cống",
  "Cây cỏ ven đường": "Phát cây, cắt cỏ ven đường",
  // Cầu
  "Nứt dầm": "Theo dõi, xử lý nứt dầm cầu",
  "Hỏng khe co giãn": "Sửa chữa khe co giãn",
  "Xói mố": "Xử lý xói lở mố cầu",
  "Võng dầm": "Theo dõi võng dầm cầu",
  "Nứt mới phát sinh": "Theo dõi, xử lý vết nứt mới",
  "Sạt bờ kè": "Sửa chữa, gia cố bờ kè"
};

/**
 * Nhận xét / biện pháp tự động theo từng hạng mục hư hỏng (cột 4 & 5 sổ BDTX).
 * Lấy từ danh mục chất lượng (tab "Dữ liệu BDTX"); dùng khi người dùng chưa nhập tay.
 */
export function autoQualityForType(type) {
  return getQualityForType(type);
}

const SIDE_LABELS = {
  T: "Làn trái",
  P: "Làn phải",
  G: "Giữa tuyến",
  M: "Cả mặt đường"
};

export function formatSideLabel(side) {
  const key = String(side || "").trim().toUpperCase();
  return SIDE_LABELS[key] || "";
}

export function addDays(isoDate, days) {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export function defaultPlannedRepairDate(incidentDate) {
  return addDays(incidentDate, 1);
}

export function maxPlannedRepairDate(incidentDate) {
  return addDays(incidentDate, BAO_DUONG_MAX_DAYS);
}

/** Số ngày deadline hợp lệ của loại công việc (>=0). */
function deadlineDaysForType(type) {
  const days = Number(getDeadlineDaysForType(type));
  if (!Number.isFinite(days) || days < 0) return BAO_DUONG_MAX_DAYS;
  return days;
}

/** Ngày dự kiến sửa = ngày phát hiện + deadlineDays của loại công việc. */
export function plannedRepairDateForType(incidentDate, type) {
  return addDays(incidentDate, deadlineDaysForType(type));
}

/** Hạn cuối cho phép chọn ngày dự kiến sửa theo deadline của loại công việc. */
export function maxPlannedRepairDateForType(incidentDate, type) {
  const days = deadlineDaysForType(type);
  return addDays(incidentDate, days > 0 ? days : BAO_DUONG_MAX_DAYS);
}

export function validatePlannedRepairDate(incidentDate, plannedDate) {
  if (!plannedDate) return { ok: true };
  if (plannedDate < incidentDate) {
    return { ok: false, msg: "Ngày dự kiến sửa chữa không được trước ngày phát hiện." };
  }
  if (plannedDate > maxPlannedRepairDate(incidentDate)) {
    return {
      ok: false,
      msg: `Phải xử lý trong vòng ${BAO_DUONG_MAX_DAYS} ngày kể từ ngày phát hiện.`
    };
  }
  return { ok: true };
}

export function shouldExportBaoDuong(entry) {
  if (!BAO_DUONG_SECTIONS.has(entry.section)) return false;
  if (!entry.plannedRepairDate) return false;
  // Loại công việc khai báo "không sinh BDTX" thì không đưa sang sổ.
  if (!needMaintenanceForType(entry.type)) return false;
  // Riêng mặt đường: tôn trọng cờ xuất sổ và loại trừ loại không sửa chữa.
  if (entry.section === MAT_DUONG_SECTION && !shouldExportMatDuong(entry)) {
    return false;
  }
  return true;
}

/** Các loại công việc (type) đang xuất hiện trong sổ BDTX, không trùng. */
export function collectBaoDuongWorkTypes(entries) {
  const seen = new Set();
  const out = [];
  (entries || [])
    .map(migrateEntry)
    .filter((e) => shouldExportBaoDuong(e))
    .forEach((e) => {
      const t = String(e.type || "").trim();
      if (t && !seen.has(t)) {
        seen.add(t);
        out.push(t);
      }
    });
  return out;
}

export function filterBaoDuongEntries(entries, execDate) {
  return entries
    .map(migrateEntry)
    .filter((e) => shouldExportBaoDuong(e) && e.plannedRepairDate === execDate)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return String(a.kmFrom).localeCompare(String(b.kmFrom));
    });
}

export function formatKmCell(value) {
  if (!value && value !== 0) return "";
  return `Km${formatLyTrinh(value)}`;
}

export function formatWorkName(type) {
  if (!type) return "";
  const maintenance = getMaintenanceNameForType(type);
  if (maintenance) return maintenance;
  return WORK_NAMES[type] || `Xử lý ${type}`;
}

export function formatUnitLabel(unit) {
  if (unit === "m2") return "m²";
  if (unit === "m3") return "m³";
  return unit || "";
}

/** Dòng "Khối lượng thực hiện" theo mẫu sổ BDTX. */
export function formatQuantityLine(entry) {
  const q = entry.quantity;
  if (q) {
    return `- Khối lượng thực hiện: ${q} ${formatUnitLabel(entry.unit)}`;
  }
  const area = calcAreaM2(entry);
  const l = entry.length;
  const w = entry.width;
  if (area && l && w) {
    return `- Khối lượng thực hiện: dài ${l} × rộng ${w} = ${area} m²`;
  }
  return "- Khối lượng thực hiện: dài × rộng = … m²";
}

export function formatMainResult(entry) {
  if (entry.mainResult?.trim()) return entry.mainResult.trim();
  const parts = [formatQuantityLine(entry)];
  if (entry.resolved?.trim()) {
    parts.push(`- ${entry.resolved.trim()}`);
  } else {
    parts.push(`- ${autoQualityForType(entry.type).result}`);
  }
  return parts.join("\n");
}

/** Cột (3) mẫu sổ: "Ghi lý trình, vị trí công việc được thực hiện". */
export function formatViTri(entry) {
  const kmFrom = formatKmCell(entry.kmFrom);
  const kmTo = formatKmCell(resolveEntryKmTo(entry));
  let range = "";
  if (kmFrom && kmTo && kmFrom !== kmTo) range = `${kmFrom} – ${kmTo}`;
  else range = kmFrom || kmTo;

  const sideLabel = formatSideLabel(entry.side);
  const parts = [];
  if (sideLabel) parts.push(sideLabel);
  if (range) parts.push(range);
  const base = parts.join(", ");

  const extra = entry.viTriNote?.trim() || entry.location?.trim() || "";
  if (extra && !base) return extra;
  if (extra) return `${base} (${extra})`;
  return base;
}

export function formatMethodSummary(entry) {
  if (entry.measureSummary?.trim()) return entry.measureSummary.trim();
  return autoQualityForType(entry.type).method;
}

export function entryToBaoDuongRow(entry, index) {
  return {
    stt: index + 1,
    work: formatWorkName(entry.type),
    viTri: formatViTri(entry),
    measureSummary: formatMethodSummary(entry),
    mainResult: formatMainResult(entry),
    incidentDate: formatDisplayDate(entry.date)
  };
}

export function formatBaoDuongWeather(dayMeta) {
  const { weather } = parseDayWeather(dayMeta?.weather || "");
  return weather || "";
}
