/** Mẫu nhật ký tuần đường — Phần II. Nội dung kiểm tra, ghi chép */

import {
  formatEntryVolumeLine,
  formatPhatSinhDiaryContent,
  inferEntryUnit,
  resolveEntryQuantity
} from "./incidentUtils";
import {
  TNGT_SECTION,
  shouldExportTngt,
  formatTngtDiaryContent
} from "./tngtFormat";
import { migrateHanhLangFields } from "./hanhLangFormat";

export { formatEntryVolumeLine };

/** Chuỗi lý trình thuần `X+YYY` (không tiền tố Km). */
export function normalizeKmInput(value) {
  if (value === "" || value == null) return "";
  let text = String(value).trim();
  while (/^km\s*/i.test(text)) {
    text = text.replace(/^km\s*/i, "").trim();
  }
  if (!text) return "";
  if (text.includes("+")) {
    const [rawKm, rawM] = text.split("+", 2);
    const km = Number(String(rawKm).replace(/\D/g, "")) || 0;
    let mDigits = String(rawM ?? "").replace(/\D/g, "");
    if (mDigits.length > 3) mDigits = mDigits.slice(0, 3);
    const m = Number(mDigits) || 0;
    return formatKmParts(km, m);
  }
  const digits = text.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length <= 3) return formatKmParts(0, Number(digits));
  const n = Number(digits);
  if (Number.isNaN(n)) return "";
  return formatKmParts(Math.floor(n / 1000), n % 1000);
}

export function formatLyTrinh(value) {
  if (!value && value !== 0) return "";
  return normalizeKmInput(value);
}

/** Tách lý trình KmX+Y thành km và mét. */
export function parseKmParts(kmStr) {
  const norm = normalizeKmInput(kmStr);
  if (!norm || !norm.includes("+")) return { km: 0, m: 0 };
  const [a, b] = norm.split("+", 2);
  return { km: Number(a) || 0, m: Number(b) || 0 };
}

/** Tổng mét → chuỗi lý trình `X+YYY` (mét làm tròn nguyên). */
export function formatKmParts(km, m) {
  const totalM = Math.round(km * 1000 + m);
  const newKm = Math.floor(totalM / 1000);
  const newM = totalM % 1000;
  return `${newKm}+${String(newM).padStart(3, "0")}`;
}

/** Cộng thêm mét vào lý trình (chiều dài tính bằng mét). */
export function addMetersToKm(kmStr, meters) {
  const { km, m } = parseKmParts(kmStr);
  const add = Number(String(meters ?? "").replace(",", ".")) || 0;
  return formatKmParts(km, m + add);
}

/** Lý trình → mét (để sắp xếp từ nhỏ đến lớn). */
export function kmToMeters(kmValue) {
  const { km, m } = parseKmParts(kmValue);
  return km * 1000 + m;
}

export function entryIncidentType(entry) {
  return entry?.sourceIncidentType?.trim() || entry?.type?.trim() || "";
}

export function compareEntriesByTypeAndKm(a, b) {
  const typeCmp = entryIncidentType(a).localeCompare(entryIncidentType(b), "vi");
  if (typeCmp !== 0) return typeCmp;
  const kmCmp = kmToMeters(a.kmFrom) - kmToMeters(b.kmFrom);
  if (kmCmp !== 0) return kmCmp;
  return kmToMeters(a.kmTo) - kmToMeters(b.kmTo);
}

const SECTION_SORT_ORDER = () =>
  Object.fromEntries(SECTIONS.map((s, i) => [s.title, i]));

/** Sắp xếp các dòng cùng ngày: hạng mục → loại sự cố → lý trình. */
export function sortEntriesOnDate(entries, dateIso) {
  if (!dateIso) return entries;
  const sectionOrder = SECTION_SORT_ORDER();
  const slots = entries
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => entry.date === dateIso);
  if (slots.length <= 1) return entries;

  const sorted = slots
    .map(({ entry }) => entry)
    .sort((a, b) => {
      const sa = sectionOrder[a.section] ?? 999;
      const sb = sectionOrder[b.section] ?? 999;
      if (sa !== sb) return sa - sb;
      return compareEntriesByTypeAndKm(a, b);
    });

  const result = [...entries];
  slots.forEach(({ index }, i) => {
    result[index] = sorted[i];
  });
  return result;
}

export function sortAllEntryDates(entries) {
  const dates = [...new Set(entries.map((e) => e.date).filter(Boolean))];
  let result = entries;
  for (const dateIso of dates) {
    result = sortEntriesOnDate(result, dateIso);
  }
  return result;
}

export function formatDisplayDate(isoDate) {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

export function formatYearMonthVN(yearMonth) {
  if (!yearMonth) return "";
  const [y, m] = yearMonth.split("-").map(Number);
  if (!y || !m) return yearMonth;
  return `Tháng ${m} / ${y}`;
}

export function formatDateTimeCol(isoDate, time) {
  const d = formatDisplayDate(isoDate);
  if (time) return `${time} — ${d}`;
  return d;
}

/** Cột 2: Vị trí, lý trình */
export function formatLocationCol(item) {
  const parts = [];
  if (item.kmFrom || item.kmTo) {
    const from = item.kmFrom ? `Km${formatLyTrinh(item.kmFrom)}` : "";
    const to = item.kmTo ? `Km${formatLyTrinh(item.kmTo)}` : "";
    let kmLine = from && to ? `${from} -:- ${to}` : from || to;
    if (item.side) kmLine += ` (${item.side})`;
    parts.push(kmLine);
  } else if (item.side) {
    parts.push(`(${item.side})`);
  }
  if (item.locationNote) parts.push(item.locationNote);
  return parts.join(" · ") || "";
}

export function formatDayWeather(weather, temp) {
  const parts = [];
  if (weather) parts.push(`Thời tiết: ${String(weather).toLowerCase()}`);
  if (temp) parts.push(`nhiệt độ: ${temp}`);
  return parts.join(", ");
}

export function displayDayWeather(value, weatherDetail = "") {
  const detail = String(weatherDetail || "").trim();
  if (!value && !detail) return detail;
  if (!value) return detail;
  const { weather, temp } = parseDayWeather(value);
  const base = formatDayWeather(weather, temp) || value;
  return detail ? `${base}\n${detail}` : base;
}

export function parseDayWeather(value) {
  if (!value) return { weather: "", temp: "" };

  const weatherMatch = value.match(/thời tiết:\s*([^,]+)/i);
  const tempMatch = value.match(/nhiệt độ:\s*(.+)$/i);
  if (weatherMatch || tempMatch) {
    const rawWeather = weatherMatch?.[1]?.trim() || "";
    const weather =
      WEATHER_OPTIONS.find((w) => w.toLowerCase() === rawWeather.toLowerCase()) ||
      (rawWeather
        ? rawWeather.charAt(0).toUpperCase() + rawWeather.slice(1).toLowerCase()
        : "");
    return { weather, temp: tempMatch?.[1]?.trim() || "" };
  }

  const parts = value.split(",").map((s) => s.trim());
  const weather =
    WEATHER_OPTIONS.find((w) => parts[0]?.toLowerCase().startsWith(w.toLowerCase())) ||
    parts[0] ||
    "";
  const tempPart = parts.slice(1).join(", ").trim();
  return { weather, temp: tempPart || "" };
}

/** Cột 3: Thời tiết + nội dung sự cố */
export function formatContentCol(item, dayWeather) {
  const parts = [];
  if (dayWeather) parts.push(dayWeather);

  const entry = migrateEntry(item);
  if (entry.section === TNGT_SECTION && shouldExportTngt(entry)) {
    parts.push(formatTngtDiaryContent(entry));
    return parts.join("\n") || "";
  }

  if (
    entry.section === "Mặt đường" ||
    entry.section === "Nền đường" ||
    entry.section === "Lề đường"
  ) {
    const line = formatPhatSinhDiaryContent(entry);
    if (line) parts.push(line);
    if (item.content) parts.push(item.content);
    return parts.join("\n") || "";
  }

  const typeLabel = item.sourceIncidentType || item.type;
  if (typeLabel) {
    const volumeLine = formatEntryVolumeLine(item);
    parts.push(volumeLine ? `${typeLabel}\n${volumeLine}` : typeLabel);
  }
  if (item.content) parts.push(item.content);
  return parts.join("\n") || "";
}

export const EMPTY_DAY_META = {
  weather: "",
  weatherDetail: "",
  leaderComment: "",
  leaderSign: "",
  inspectorComment: "",
  dutyPerson: ""
};

/** Gợi ý cột khi nhập từng dòng (TT.41 / QL37 Phụ lục 02) */
export const DIARY_ENTRY_COLUMN_HINT =
  "Cột 1: giờ phát hiện · Cột 4: xử lý tại chỗ · Cột 5: nhận xét Hạt (nếu có) · Cột 6: ghi chú.";

export const WEATHER_OPTIONS = [
  "Nắng",
  "Nhiều mây",
  "Mưa",
  "Mưa rào",
  "Sương mù",
  "Lũ",
  "Bão",
  "Gió mạnh"
];

export const TEMP_OPTIONS = [
  "15°C – 22°C",
  "20°C – 28°C",
  "25°C – 35°C",
  "30°C – 38°C"
];

export const HANH_LANG_SECTION = "Vi phạm hành lang ATGT";

/** Phần II — hạng mục ghi chép chuẩn (thứ tự theo TT.41 / QL37) */
export const SECTIONS = [
  {
    part: "I",
    num: 1,
    key: "hanh_lang",
    title: "Vi phạm hành lang ATGT",
    guide:
      "Ghi cụ thể các vụ vi phạm mới phát sinh (đã lập biên bản xác nhận, chưa lập biên bản kèm lý do như chủ hộ đi vắng, không chịu ký hoặc nguyên nhân khác); tình hình và kết quả từng vụ đã xử lý (tổ chức, cá nhân tự khắc phục, thanh tra lập biên bản xử lý, chính quyền cưỡng chế, giải tỏa và các biện pháp xử lý khác), các vụ đang xử lý và chưa xử lý. Vụ chưa xử lý đã ghi lần trước không đổi thì không ghi lại trừ khi đã xử lý. Vi phạm đấu nối trái phép, san lấp trong phạm vi đất đường bộ/hành lang, đào khoan, xẻ đường, tháo dỡ cống rãnh, công trình kiên cố: ghi vị trí, lý trình, mức độ và chi tiết.",
    types: ["Lấn chiếm", "Họp chợ", "Dựng quán", "Xây dựng trái phép", "Đấu nối trái phép", "San lấp hành lang"]
  },
  {
    part: "I",
    num: 2,
    key: "mat_duong",
    title: "Mặt đường",
    guide:
      "Ghi các đoạn đường hư hỏng, mức độ hư hỏng kết cấu mặt đường (rạn, nứt, ổ gà, hằn lún, hư hỏng sình lún móng mặt đường và các dạng hư hỏng khác theo tiêu chuẩn kỹ thuật).",
    types: ["Ổ gà", "Bong tróc", "Rạn nứt", "Nứt", "Cao su", "Lún vệt bánh xe", "Hư hỏng lớp móng", "Hư hỏng mặt đường", "Sình lún"]
  },
  {
    part: "I",
    num: 3,
    key: "nen_duong",
    title: "Nền đường",
    guide:
      "Ghi sạt lở đất, đá ta luy dương, sụt trượt ta luy âm, lún, nứt nền đường, cung trượt và các hiện tượng hư hỏng khác. Nếu không phát sinh: ghi «nền đường không phát sinh hư hỏng, đảm bảo ổn định».",
    types: ["Sụt lún", "Nứt nền", "Cung trượt", "Sạt taluy dương", "Sạt taluy âm", "Xói nền đường", "Đá rơi", "Đất tràn mặt đường", "Sụt dương", "Sụt âm", "Sa bồi rãnh xây", "Sa bồi rãnh đất", "Sa bồi lề mặt đường", "Sa bồi cống", "Sa bồi hố thu nước", "Sa bồi mặt đường", "Trôi nền đường", "Ngập nền đường"]
  },
  {
    part: "I",
    num: 4,
    key: "le_duong",
    title: "Lề đường",
    guide:
      "Ghi các loại hư hỏng lề đường: bề mặt nứt, vỡ, xói lở, lún, trồi và các loại hư hỏng khác.",
    types: ["Lề cao", "Lề thấp", "Xói lở lề", "Sụt lề", "Cỏ mọc", "Đọng nước", "Bùn đất trên lề"]
  },
  {
    part: "I",
    num: 5,
    key: "thoat_nuoc",
    title: "Cống, rãnh thoát nước",
    guide:
      "Ghi tình trạng thoát nước bình thường hoặc bị tắc (nếu có); các bộ phận hư hỏng, loại hư hỏng, mức độ hư hỏng (nếu có).",
    types: ["Tắc rãnh", "Tắc cống", "Đọng bùn", "Đọng nước", "Cỏ mọc trong rãnh", "Đất đá bồi lấp rãnh", "Đất đá bồi lấp cửa cống", "Rác trong rãnh", "Rác cửa cống", "Hư thành rãnh", "Hư đáy rãnh", "Bong vỡ tấm đan", "Mất tấm đan", "Hỏng nắp hố ga", "Hỏng song chắn rác", "Hư đầu cống", "Hư thân cống", "Hư cửa cống", "Xói đầu cống", "Xói cuối cống", "Thoát nước kém", "Thoát nước bình thường"]
  },
  {
    part: "I",
    num: 6,
    key: "ngam_tran",
    title: "Ngầm, tràn (lũ, ngập)",
    guide:
      "Ghi số giờ, các ngày bị ngập, chiều sâu ngập (cột thủy trí), vận tốc dòng nước (ước tính khi không có thiết bị đo), nguyên nhân ngập (bão, mưa lớn); tình trạng công trình sau khi nước rút, hư hỏng cần khắc phục (nếu có).",
    types: ["Ngập ngầm", "Ngập tràn", "Sa bồi ngầm", "Sa bồi tràn", "Xói đầu ngầm", "Xói cuối ngầm", "Hư mặt ngầm", "Hư tường cánh"]
  },
  {
    part: "I",
    num: 7,
    key: "cot_moc",
    title: "Cột mốc GP mặt bằng, lộ giới",
    guide:
      "Ghi các cột bị mất, gãy đổ và các hư hỏng khác của cột mốc giải phóng mặt bằng, mốc đất đường bộ, cột mốc lộ giới hành lang an toàn (nếu có).",
    types: ["Mất cột mốc", "Hỏng cột mốc", "Nghiêng cột mốc", "Mờ số hiệu", "Che khuất cột mốc"]
  },
  {
    part: "I",
    num: 8,
    key: "he_thong_atgt",
    title: "Công trình an toàn giao thông",
    guide:
      "Ghi biển báo hiệu, cột tiêu, cột Km, cột H, rào chắn, tường hộ lan thép bị gãy, đổ, mất, hỏng; sơn trên mặt đường bị mờ, mài mòn, mất vệt sơn…",
    types: ["Mất biển báo", "Hỏng biển báo", "Biển báo nghiêng", "Biển báo bị che khuất", "Mất cọc tiêu", "Hỏng cọc tiêu", "Mất cột Km", "Hỏng cột Km", "Hỏng hộ lan", "Mất hộ lan", "Mờ sơn", "Hỏng gương cầu lồi", "Hỏng cột H"]
  },
  {
    part: "I",
    num: 9,
    key: "tai_nan",
    title: "Tai nạn giao thông",
    guide:
      "Ghi thời điểm vụ tai nạn, phương tiện gây tai nạn và bị nạn, hậu quả đối với người và phương tiện; thiệt hại kết cấu hạ tầng giao thông; tình hình, kết quả xử lý; ùn tắc (nếu có).",
    types: ["Va chạm", "Lật xe", "Tai nạn nghiêm trọng"]
  },
  {
    part: "I",
    num: 10,
    key: "phat_cay",
    title: "Công tác phát cây",
    guide: "Cây cỏ che khuất cột Km, cọc tiêu, đầu cầu, cống, lòng sông.",
    types: ["Cây cỏ ven đường", "Che biển báo", "Che cọc tiêu", "Che cột Km", "Che đầu cầu", "Che đầu cống", "Che gương cầu lồi", "Che tầm nhìn", "Cây đổ", "Cành cây nguy hiểm"]
  },
  {
    part: "II",
    num: 1,
    key: "cau",
    title: "Công trình cầu",
    guide:
      "Ghi các bộ phận cầu (dầm, dàn, khung, mố, trụ, gối, khe co giãn, lan can tay vịn, mặt cầu, ống thoát nước, dây văng, dây cáp treo, hố neo…): tình trạng hư hỏng, dấu hiệu phát sinh hoặc phát triển (vết nứt mở rộng, dầm võng chưa gãy…) và các trường hợp khác.",
    types: ["Hỏng khe co giãn", "Hỏng mặt cầu", "Hỏng lan can cầu", "Hỏng gờ chắn bánh", "Xói mố", "Xói trụ", "Sạt bờ kè", "Lún võng đầu cầu", "Đọng nước mặt cầu", "Hư ống thoát nước cầu", "Hư gối cầu", "Nứt bản mặt cầu", "Bong bê tông", "Lộ cốt thép", "Hư tường cánh"]
  }
];

export const PART_LABELS = {
  I: "I. Về đường",
  II: "II. Kiểm tra công trình cầu, cống, kè, ngầm, tràn"
};

export const OFFICIAL_HEADERS = {
  col1: "Giờ ngày, tháng kiểm tra",
  col2: "Vị trí, lý trình, xảy ra phát hiện sự cố, vi phạm",
  col3:
    "Tình hình thời tiết (nắng, mưa, mù, lũ, bão…) diễn biến đột xuất, nội dung các sự cố cầu đường hoặc vi phạm mới phát hiện",
  col4: "Đã giải quyết, xử lý tại chỗ và kết quả",
  col5: "Người nhận báo cáo ghi nhận xét, việc cần lưu ý hàng ngày. Ký tên",
  col6: "Ghi chú"
};

export function getStorageKey(uid) {
  return uid ? `nhatky_${uid}` : "nhatky";
}

export function loadStorage(storageKey = "nhatky") {
  const raw = localStorage.getItem(storageKey);
  if (!raw) {
    return {
      entries: [],
      dayMeta: {},
      reportMeta: { ...EMPTY_REPORT_META },
      importMap: {}
    };
  }
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
    return {
      entries: sortAllEntryDates(parsed.map(migrateEntry)),
        dayMeta: {},
        reportMeta: { ...EMPTY_REPORT_META },
        importMap: {}
      };
    }
    return {
      entries: sortAllEntryDates((parsed.entries || []).map(migrateEntry)),
      dayMeta: parsed.dayMeta || {},
      reportMeta: { ...EMPTY_REPORT_META, ...(parsed.reportMeta || {}) },
      importMap: parsed.importMap && typeof parsed.importMap === "object" ? parsed.importMap : {}
    };
  } catch {
    return {
      entries: [],
      dayMeta: {},
      reportMeta: { ...EMPTY_REPORT_META },
      importMap: {}
    };
  }
}

/** Giữ importMap khớp với các dòng NK còn sourceIncidentId (sau khi xoá ghi chép). */
export function reconcileImportMap(entries, importMap) {
  const linked = new Set();
  for (const entry of entries || []) {
    const id = entry?.sourceIncidentId;
    if (id) linked.add(id);
  }
  if (!importMap || typeof importMap !== "object") return {};
  const next = {};
  for (const [id, record] of Object.entries(importMap)) {
    if (linked.has(id)) next[id] = record;
  }
  return next;
}

export function saveStorage(entries, dayMeta, reportMeta, storageKey = "nhatky") {
  const current = loadStorage(storageKey);
  const importMap = reconcileImportMap(entries, current.importMap);
  localStorage.setItem(
    storageKey,
    JSON.stringify({
      entries: sortAllEntryDates(entries.map(migrateEntry)),
      dayMeta,
      reportMeta: reportMeta ?? current.reportMeta,
      importMap
    })
  );
}

export function saveReportMeta(reportMeta, storageKey = "nhatky") {
  const current = loadStorage(storageKey);
  saveStorage(current.entries, current.dayMeta, reportMeta, storageKey);
}

export function getDayMeta(dayMeta, date) {
  return { ...EMPTY_DAY_META, ...(dayMeta[date] || {}) };
}

const SECTION_ALIASES = {
  "Hệ thống ATGT": "Công trình an toàn giao thông",
  "Hệ thống an toàn giao thông": "Công trình an toàn giao thông",
  "Hành lang ATGT": "Vi phạm hành lang ATGT",
  "An toàn giao thông": "Tai nạn giao thông",
  "Cầu - Cống": "Công trình cầu",
  "Cầu, cống, kè, ngầm, tràn": "Công trình cầu",
  "Rãnh dọc": "Cống, rãnh thoát nước",
  "Thiết bị lắp đặt": "Công trình an toàn giao thông",
  "Theo dõi thi công": "Vi phạm hành lang ATGT",
  "Vệ sinh mặt đường": "Mặt đường"
};

const CAU_CONG_TYPE_SECTION = {
  "Tắc cống": "Cống, rãnh thoát nước"
};

function resolveSectionTitle(section, entry) {
  const alias = SECTION_ALIASES[section];
  if (section === "Cầu, cống, kè, ngầm, tràn") {
    const byType = CAU_CONG_TYPE_SECTION[entry?.type?.trim()];
    return byType || alias || "Công trình cầu";
  }
  return alias || section;
}

/** Dòng bão lũ / sổ trực ĐBGT — ý kiến chỉ đạo thuộc cột 5 (leaderNote), không phải cột 4. */
function isTrafficDutyEntry(entry) {
  if (entry.section !== "Nền đường") return false;
  if (entry.exportTrafficDuty === true) return true;
  if (entry.exportTrafficDuty === false) return false;
  const g = String(entry.sourceGroupName || "").trim().toLowerCase();
  return g === "bão lũ" || g === "bao lu";
}

function migrateTrafficDirectiveColumn(entry) {
  if (!isTrafficDutyEntry(entry)) return entry;
  const resolved = String(entry.resolved ?? entry.solution ?? "").trim();
  const leaderNote = String(entry.leaderNote ?? "").trim();
  // Giữ cột 4 nhật ký; chỉ bổ sung leaderNote cho sổ trực ĐBGT khi thiếu.
  if (resolved && !leaderNote) {
    return { ...entry, leaderNote: resolved };
  }
  return entry;
}

export function migrateEntry(entry) {
  const section = resolveSectionTitle(entry.section, entry);
  const base = migrateTrafficDirectiveColumn({
    ...entry,
    section,
    resolved: entry.resolved ?? entry.solution ?? "",
    leaderNote: entry.leaderNote ?? "",
    inspectorNote: entry.inspectorNote ?? "",
    time: entry.time ?? "",
    locationNote: entry.locationNote ?? "",
    damageLevel: entry.damageLevel ?? "",
    resolvedStatus: entry.resolvedStatus ?? "",
    inspectorSign: entry.inspectorSign ?? "",
    exportMatDuong: entry.exportMatDuong,
    plannedRepairDate: entry.plannedRepairDate ?? "",
    measureSummary: entry.measureSummary ?? "",
    mainResult: entry.mainResult ?? "",
    sourceIncidentId: entry.sourceIncidentId ?? "",
    sourceIncidentDate: entry.sourceIncidentDate ?? "",
    sourceGroupName: entry.sourceGroupName ?? "",
    sourceIncidentType: entry.sourceIncidentType ?? "",
    sourceIncidentCompletedDate: entry.sourceIncidentCompletedDate ?? "",
    exportTrafficDuty: entry.exportTrafficDuty,
    dutyPerson: entry.dutyPerson ?? "",
    trafficCause: entry.trafficCause ?? "",
    trafficRestoredAt: entry.trafficRestoredAt ?? "",
    trafficNote: entry.trafficNote ?? "",
    exportTngt: entry.exportTngt,
    tngtOccurDate: entry.tngtOccurDate ?? "",
    tngtOccurTime: entry.tngtOccurTime ?? "",
    tngtCauseDetail: entry.tngtCauseDetail ?? "",
    tngtCauseCategory: entry.tngtCauseCategory ?? "",
    vehicleAutoType: entry.vehicleAutoType ?? "",
    vehicleMotoInvolved: entry.vehicleMotoInvolved ?? false,
    vehicleBikeInvolved: entry.vehicleBikeInvolved ?? false,
    tngtCauseDuong: entry.tngtCauseDuong ?? false,
    tngtCauseNguoi: entry.tngtCauseNguoi ?? false,
    tngtCausePhuongTien: entry.tngtCausePhuongTien ?? false,
    vehicleAuto: entry.vehicleAuto ?? "",
    vehicleMoto: entry.vehicleMoto ?? "",
    vehicleBike: entry.vehicleBike ?? "",
    casualtyDead: entry.casualtyDead ?? "",
    casualtyInjured: entry.casualtyInjured ?? "",
    casualtyHumanNote: entry.casualtyHumanNote ?? "",
    damageRoadMillion: entry.damageRoadMillion ?? "",
    damageRoadNote: entry.damageRoadNote ?? "",
    damageVehicleMillion: entry.damageVehicleMillion ?? "",
    damageVehicleNote: entry.damageVehicleNote ?? "",
    tngtNote: entry.tngtNote ?? "",
    tngtWitnessStatement: entry.tngtWitnessStatement ?? "",
    tngtCauseOfficial: entry.tngtCauseOfficial ?? "",
    tngtRoadClass: entry.tngtRoadClass ?? "",
    exportHanhLang: entry.exportHanhLang,
    hlRecorder: entry.hlRecorder ?? "",
    hlViolator: entry.hlViolator ?? "",
    hlAddress: entry.hlAddress ?? "",
    hlRecordDate: entry.hlRecordDate ?? "",
    hlProcessNote: entry.hlProcessNote ?? "",
    hlNote: entry.hlNote ?? ""
  });
  const unit = inferEntryUnit(base);
  const quantity =
    Number(base.quantity) > 0 ? base.quantity : resolveEntryQuantity({ ...base, unit });
  const vehicleAutoRaw = base.vehicleAutoType ?? base.vehicleAuto ?? "";
  const vehicleAutoType =
    typeof vehicleAutoRaw === "string" && vehicleAutoRaw.trim() ? vehicleAutoRaw.trim() : "";
  const cat = base.tngtCauseCategory;
  return {
    ...base,
    unit,
    quantity,
    vehicleAutoType,
    vehicleMotoInvolved:
      base.vehicleMotoInvolved === true || base.vehicleMotoInvolved === false
        ? base.vehicleMotoInvolved
        : Number(base.vehicleMoto) > 0,
    vehicleBikeInvolved:
      base.vehicleBikeInvolved === true || base.vehicleBikeInvolved === false
        ? base.vehicleBikeInvolved
        : Number(base.vehicleBike) > 0,
    tngtCauseDuong:
      base.tngtCauseDuong === true || (base.tngtCauseDuong !== false && cat === "duong"),
    tngtCauseNguoi:
      base.tngtCauseNguoi === true ||
      (base.tngtCauseNguoi !== false && (cat === "nguoi" || !cat)),
    tngtCausePhuongTien:
      base.tngtCausePhuongTien === true ||
      (base.tngtCausePhuongTien !== false && cat === "phuong_tien"),
    side: base.side || "P",
    ...migrateHanhLangFields(base)
  };
}

export const EMPTY_REPORT_META = {
  company: "CÔNG TY CP QLSC và XDCT GT II SƠN LA",
  hat: "1.37",
  roadName: "QL.37",
  kmRange: "Km356+700-Km404+000",
  trafficDutyPerson: "",
  trafficDutyLeaderSign: "",
  contractVolumes: []
};
