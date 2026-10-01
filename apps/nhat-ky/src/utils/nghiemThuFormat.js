import {
  formatDisplayDate,
  loadStorage,
  saveStorage,
  migrateEntry,
  kmToMeters,
  isCulvertDiaryEntry
} from "./nhatKyFormat";
import {
  filterBaoDuongEntries,
  filterBaoDuongEntriesInRange,
  shouldExportBaoDuong,
  formatUnitLabel,
  autoQualityForType,
  formatKmCell
} from "./baoDuongFormat";
import {
  resolveMaintenanceWorkLabel,
  getGroupForType,
  isCountUnit,
  normalizeUnitValue
} from "./baoDuongQualityStore";
import { calcAreaM2 } from "./matDuongFormat";
import { formatBookDecimal } from "./bookNumberFormat";
import { inferEntryUnit } from "./incidentUtils";
import { shouldExportHanhLang } from "./hanhLangFormat";
import { shouldExportTrafficDuty } from "./trafficDutyFormat";
import { shouldExportTngt } from "./tngtFormat";
import { expandEntriesForVolumeBooks } from "./mergeDiaryEntries";
import { isQuarterCountDate } from "./demXeQuarters";
import { eachIsoDateInclusive } from "./nhatKyPrintRows";

/** Mức độ hoàn thành mục Đếm xe khi ngày thuộc đợt đếm quý (5–6–7 tháng cuối quý). */
export const DEMXE_NT_MUC_DO =
  "Công tác đếm xe đảm bảo theo quy định: Phiếu đếm xe thể hiện đầy đủ, chính xác kết quả đếm xe được phân loại theo yêu cầu của hợp đồng hoặc tiêu chuẩn kỹ thuật, thời gian đếm xe; tổng hợp, báo cáo, ghi chép đầy đủ vào sổ đếm xe đảm bảo theo quy định";

/** Nhóm mục 6.2 theo mẫu biên bản NT. */
export const NT_VOLUME_SECTIONS = [
  {
    key: "I",
    title: "Bảo dưỡng mặt đường",
    groups: ["Mặt đường"]
  },
  {
    key: "II",
    title: "Hệ thống an toàn giao thông",
    groups: ["Công trình an toàn giao thông"]
  },
  {
    key: "III",
    title: "Nền đường, thoát nước",
    groups: [
      "Nền đường",
      "Lề đường",
      "Cống, rãnh thoát nước",
      "Ngầm, tràn (lũ, ngập)",
      "Cột mốc GP mặt bằng, lộ giới"
    ]
  },
  {
    key: "IV",
    title: "Bảo dưỡng thường xuyên cầu",
    groups: ["Công trình cầu"]
  }
];

/** Checklist 6.1 Công tác quản lý (mẫu cố định). */
export const NT_QL_CHECKLIST = [
  {
    key: "hoso",
    hangMuc: "Lập, quản lý hồ sơ và cập nhật hồ sơ tài liệu",
    noiDung:
      "Việc cập nhật các nội dung phát sinh trong ngày vào hồ sơ quản lý",
    defaultMucDo:
      "Cập nhật đầy đủ theo quy định các nội dung phát sinh trong ngày vào hồ sơ quản lý"
  },
  {
    key: "ghichep",
    hangMuc: "Công tác ghi chép kết quả bảo dưỡng",
    noiDung:
      "Việc ghi chép kết quả thực hiện hoàn thành các công tác bảo dưỡng vào hồ sơ thực hiện BDTX",
    defaultMucDo:
      "Hồ sơ thực hiện BDTX được ghi chép kết quả thực hiện theo quy định"
  },
  {
    key: "tuanduong",
    hangMuc: "Công tác Tuần đường",
    noiDung:
      "Việc thực hiện công tác quản lý, kiểm tra, bảo vệ, xử lý hư hỏng kết cấu hạ tầng đường bộ; công tác bảo đảm ATGT",
    defaultMucDo:
      "Công tác Tuần đường đảm bảo theo quy định: Bố trí đủ lực lượng, phương tiện, thiết bị và trang phục phục vụ nhiệm vụ tuần đường, xử lý kịp thời các kiến nghị trong quá trình tuần đường, cập nhật kết quả tổ chức khắc phục hư hỏng, xuống cấp của công trình, bộ phận, hạng mục công trình, tham gia xử lý tai nạn, khắc phục bão lũ, bảo vệ công trình và hành lang an toàn đường bộ, báo cáo theo quy định. Sổ nhật ký tuần đường thể hiện đầy đủ kết quả hoạt động tuần đường, nhận xét, ý kiến xử lý của nhà thầu"
  },
  {
    key: "demxe",
    hangMuc: "Đếm xe (Nếu có)",
    noiDung:
      "Việc thực hiện công tác điều tra giao thông; cập nhật, lưu trữ số liệu trong hệ thống quản lý của đơn vị",
    defaultMucDo: "Không phát sinh trong ngày",
    hideWhenEmpty: true
  },
  {
    key: "hanhlang",
    hangMuc: "Công tác quản lý, bảo vệ kết cấu hạ tầng đường bộ (Nếu có)",
    noiDung:
      "Việc thực hiện công tác quản lý, bảo vệ hành lang an toàn đường bộ, đất của đường bộ, công trình đường bộ và kết cấu hạ tầng đường bộ",
    defaultMucDo: "Không phát sinh trong ngày",
    hideWhenEmpty: true
  },
  {
    key: "atgt",
    hangMuc: "Công tác bảo đảm an toàn giao thông (Nếu có)",
    noiDung: "Việc theo dõi tình hình tai nạn giao thông, tham gia xử lý và báo cáo",
    defaultMucDo: "Không phát sinh trong ngày",
    hideWhenEmpty: true
  },
  {
    key: "baolu",
    hangMuc: "Trực đảm bảo giao thông, xử lý khi có bão, lũ lụt, mưa sạt lở (Nếu có)",
    noiDung: "Việc trực đảm bảo giao thông khi có bão lụt, tổ chức đảm bảo giao thông",
    defaultMucDo: "Không phát sinh trong ngày",
    hideWhenEmpty: true
  }
];

const META_PREFIX = "nghiemthu_meta_";
const DAY_PREFIX = "nghiemthu_day_";
const DEFAULTS_PREFIX = "nghiemthu_defaults_";

/** Trường dùng chung mọi ngày (lưu trong reportMeta sổ) — nhân sự + gói thầu + hợp đồng. */
const PERSIST_META_FIELDS = [
  "goiThau",
  "canCuHopDong",
  "banQlbtDanhXung",
  "banQlbtTen",
  "banQlbtChucVu",
  "nhaThauDanhXung",
  "nhaThauTen",
  "nhaThauChucVu",
  "nhaThauDonVi"
];

/** Ánh xạ meta biên bản ↔ reportMeta (cùng kiểu trafficDutyPerson). */
const REPORT_META_PERSON_KEYS = {
  goiThau: "ntGoiThau",
  canCuHopDong: "ntCanCuHopDong",
  banQlbtDanhXung: "ntBanQlbtDanhXung",
  banQlbtTen: "ntBanQlbtTen",
  banQlbtChucVu: "ntBanQlbtChucVu",
  nhaThauDanhXung: "ntNhaThauDanhXung",
  nhaThauTen: "ntNhaThauTen",
  nhaThauChucVu: "ntNhaThauChucVu",
  nhaThauDonVi: "ntNhaThauDonVi"
};

function dayStorageKey(storageKey, date) {
  return `${DAY_PREFIX}${storageKey}__${String(date || "").trim()}`;
}

function defaultsStorageKey(storageKey) {
  return `${DEFAULTS_PREFIX}${String(storageKey || "").trim()}`;
}

function pickPersistMeta(meta) {
  const out = {};
  if (!meta || typeof meta !== "object") return out;
  PERSIST_META_FIELDS.forEach((k) => {
    if (meta[k] != null) out[k] = meta[k];
  });
  return out;
}

function stripPersistMeta(meta) {
  if (!meta || typeof meta !== "object") return {};
  const out = { ...meta };
  PERSIST_META_FIELDS.forEach((k) => {
    delete out[k];
  });
  delete out._defaultsSaved;
  return out;
}

function hasPersistContent(pick) {
  return PERSIST_META_FIELDS.some((k) => String(pick?.[k] ?? "").trim() !== "");
}

function metaFromNghiemThuPayload(nt) {
  if (!nt || typeof nt !== "object") return null;
  if (nt.meta && typeof nt.meta === "object") return nt.meta;
  return nt;
}

function personFromReportMeta(reportMeta) {
  if (!reportMeta || typeof reportMeta !== "object") return null;
  const nested = reportMeta.nghiemThuDefaults;
  if (nested && typeof nested === "object") {
    if (nested._defaultsSaved || hasPersistContent(nested)) {
      return pickPersistMeta(nested);
    }
  }
  if (reportMeta.ntPersonnelSaved) {
    const out = {};
    Object.entries(REPORT_META_PERSON_KEYS).forEach(([metaKey, rmKey]) => {
      out[metaKey] = reportMeta[rmKey] ?? "";
    });
    return out;
  }
  const out = {};
  let any = false;
  Object.entries(REPORT_META_PERSON_KEYS).forEach(([metaKey, rmKey]) => {
    if (reportMeta[rmKey] == null) return;
    out[metaKey] = reportMeta[rmKey];
    if (String(reportMeta[rmKey]).trim()) any = true;
  });
  return any ? out : null;
}

function persistPersonToReportMeta(storageKey, pick, { silent = false } = {}) {
  if (!storageKey) return;
  const clean = pickPersistMeta(pick);
  const flagged = { ...clean, _defaultsSaved: true };
  try {
    localStorage.setItem(defaultsStorageKey(storageKey), JSON.stringify(flagged));
  } catch {
    /* ignore */
  }
  try {
    const stored = loadStorage(storageKey);
    const nextRm = {
      ...(stored.reportMeta || {}),
      nghiemThuDefaults: flagged,
      ntPersonnelSaved: true
    };
    Object.entries(REPORT_META_PERSON_KEYS).forEach(([metaKey, rmKey]) => {
      nextRm[rmKey] = clean[metaKey] ?? "";
    });
    saveStorage(stored.entries || [], stored.dayMeta, nextRm, storageKey, {
      silent
    });
  } catch (err) {
    console.warn("Lưu nhân sự NT vào reportMeta thất bại.", err);
  }
}

function bootstrapPersonFromDayMeta(stored) {
  let best = null;
  let bestAt = "";
  Object.entries(stored?.dayMeta || {}).forEach(([d, day]) => {
    const nt = day?.nghiemThu;
    const pick = pickPersistMeta(metaFromNghiemThuPayload(nt));
    if (!hasPersistContent(pick)) return;
    const at = String(nt?.savedAt || d);
    if (at >= bestAt) {
      bestAt = at;
      best = pick;
    }
  });
  return best;
}

/**
 * Nhân sự dùng chung mọi ngày — đọc từ reportMeta / local defaults / biên bản gần nhất.
 */
let bookDefaultsMemoKey = "";
let bookDefaultsMemoVal = null;

function invalidateBookDefaultsMemo() {
  bookDefaultsMemoKey = "";
  bookDefaultsMemoVal = null;
}

export function loadNghiemThuBookDefaults(storageKey) {
  if (!storageKey) return {};
  if (bookDefaultsMemoKey === storageKey && bookDefaultsMemoVal) {
    return bookDefaultsMemoVal;
  }

  let localPick = null;
  let localFlagged = false;
  try {
    const local = JSON.parse(localStorage.getItem(defaultsStorageKey(storageKey)) || "null");
    if (local && typeof local === "object") {
      localPick = pickPersistMeta(local);
      localFlagged = !!local._defaultsSaved;
      if (localFlagged && hasPersistContent(localPick)) {
        bookDefaultsMemoKey = storageKey;
        bookDefaultsMemoVal = localPick;
        return localPick;
      }
      if (!localFlagged && hasPersistContent(localPick)) {
        bookDefaultsMemoKey = storageKey;
        bookDefaultsMemoVal = localPick;
        return localPick;
      }
    }
  } catch {
    /* ignore */
  }

  try {
    const stored = loadStorage(storageKey);
    const fromRm = personFromReportMeta(stored?.reportMeta);
    if (fromRm && hasPersistContent(fromRm)) {
      bookDefaultsMemoKey = storageKey;
      bookDefaultsMemoVal = fromRm;
      return fromRm;
    }

    const boot = bootstrapPersonFromDayMeta(stored);
    if (boot) {
      persistPersonToReportMeta(storageKey, boot, { silent: true });
      bookDefaultsMemoKey = storageKey;
      bookDefaultsMemoVal = boot;
      return boot;
    }

    // Đã Lưu bản trống cố ý (không có tên ở bất kỳ ngày nào).
    if (localFlagged) {
      const empty = localPick || {};
      bookDefaultsMemoKey = storageKey;
      bookDefaultsMemoVal = empty;
      return empty;
    }
    if (stored?.reportMeta?.ntPersonnelSaved) {
      const saved = fromRm || {};
      bookDefaultsMemoKey = storageKey;
      bookDefaultsMemoVal = saved;
      return saved;
    }
  } catch {
    /* ignore */
  }

  const fallback = localPick || {};
  bookDefaultsMemoKey = storageKey;
  bookDefaultsMemoVal = fallback;
  return fallback;
}

export function saveNghiemThuBookDefaults(storageKey, meta) {
  invalidateBookDefaultsMemo();
  persistPersonToReportMeta(storageKey, meta, { silent: false });
}

export function defaultNghiemThuMeta(road, date, storageKey = "") {
  const display = formatDisplayDate(date);
  const thoiGianDefault = display ? `Ngày ${display}` : "";
  return {
    goiThau:
      "Gói số 03: Quản lý, BDTX đường và cầu trên các ĐT, thuộc Dịch vụ sự nghiệp công quản lý, bảo dưỡng thường xuyên hệ thống đường tỉnh.",
    banQlbtDanhXung: "Ông",
    banQlbtTen: "",
    banQlbtChucVu: "Giám sát hiện trường",
    nhaThauDanhXung: "Ông",
    nhaThauTen: "",
    nhaThauChucVu: "Cán bộ kỹ thuật",
    nhaThauDonVi: "Công ty CP QLSC và XDCT Giao thông II Sơn La",
    thoiGian: thoiGianDefault,
    yKienKhac: "Không",
    ketLuan: "Đồng ý nghiệm thu khối lượng thực hiện hoàn thành nêu trên.",
    signNhaThau: "",
    signBanQlbt: "",
    ...loadNghiemThuBookDefaults(storageKey)
  };
}

/** Danh xưng dòng thành phần nghiệm thu. Trống hoặc giá trị lạ → Ông. */
export function formatNghiemThuDanhXung(value) {
  const s = String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return s === "ba" ? "Bà" : "Ông";
}

/** Đối tượng NT — luôn theo đường đang xem trên sổ. */
export function buildNghiemThuDoiTuong(road) {
  const roadName = road?.roadName || road?.label || "";
  return `Công việc thực hiện Quản lý, BDTX đường và cầu trên ${roadName || "…"}`;
}

/** Ưu tiên bản người dùng sửa; trống thì lấy tên đường theo logic cũ. */
export function resolveNghiemThuDoiTuong(meta, road) {
  const custom = String(meta?.doiTuong ?? "").trim();
  return custom || buildNghiemThuDoiTuong(road);
}

/** Địa điểm NT — luôn theo đường đang xem trên sổ. */
export function buildNghiemThuDiaDiem(road) {
  const roadName = road?.roadName || road?.label || "";
  return roadName
    ? `Tại hiện trường tuyến đường ${roadName}.`
    : "Tại hiện trường tuyến đường.";
}

/** Ưu tiên bản người dùng sửa; trống thì lấy địa điểm theo logic cũ. */
export function resolveNghiemThuDiaDiem(meta, road) {
  const custom = String(meta?.diaDiem ?? "").trim();
  return custom || buildNghiemThuDiaDiem(road);
}

/** Căn cứ NT — 2 dòng mẫu cố định. */
export const NGHIEM_THU_CAN_CU_FIXED = [
  "Thông tư số 41/2024/TT-BGTVT ngày 15/11/2024 của Bộ Giao thông vận tải (nay là Bộ Xây dựng) quy định về quản lý, vận hành, khai thác và bảo trì kết cấu hạ tầng đường bộ và được sửa đổi, bổ sung tại Thông tư số 72/2025/TT-BXD ngày 31/12/2025 của Bộ Xây dựng;",
  "TCVN 14182:2024 Tiêu chuẩn quốc gia bảo dưỡng thường xuyên đường bộ;"
];

export function buildNghiemThuCanCuHopDong() {
  return "Hợp đồng số HD2500223486_2512230933 ngày 26/12/2025 giữa Ban Quản lý bảo trì đường bộ với liên danh Công ty cổ phần QLSC & XDCT Giao thông II Sơn La và Công ty TNHH Ánh Trang Sơn La về việc thực hiện Gói số 03: Quản lý, BDTX đường và cầu trên các ĐT (ĐT.110, ĐT.112, ĐT.111 (Km0-Km47+200), ĐT.114, ĐT.118), thuộc Dịch vụ sự nghiệp công quản lý, bảo dưỡng thường xuyên hệ thống đường tỉnh năm 2026";
}

export function buildNghiemThuCanCuHoSo(road) {
  const roadName = road?.roadName || road?.label || "";
  return `Hồ sơ quản lý, vận hành khai thác và bảo trì tuyến đường ${roadName || "…"}.`;
}

export function resolveNghiemThuCanCuHopDong(meta) {
  const custom = String(meta?.canCuHopDong ?? "").trim();
  return custom || buildNghiemThuCanCuHopDong();
}

export function resolveNghiemThuCanCuHoSo(meta, road) {
  const custom = String(meta?.canCuHoSo ?? "").trim();
  return custom || buildNghiemThuCanCuHoSo(road);
}

export function resolveNghiemThuCanCuFixed(meta) {
  return [
    String(meta?.canCuFixed1 ?? "").trim() || NGHIEM_THU_CAN_CU_FIXED[0],
    String(meta?.canCuFixed2 ?? "").trim() || NGHIEM_THU_CAN_CU_FIXED[1]
  ];
}

/** 4 gạch đầu dòng mục 5. */
export function listNghiemThuCanCu(meta, road) {
  return [
    ...resolveNghiemThuCanCuFixed(meta),
    resolveNghiemThuCanCuHopDong(meta),
    resolveNghiemThuCanCuHoSo(meta, road)
  ];
}

/** Căn cứ NT — luôn theo đường đang xem trên sổ. */
export function buildNghiemThuCanCu(road) {
  return listNghiemThuCanCu({}, road).map((s) => `- ${s}`).join("\n");
}

/** Ưu tiên bản người dùng sửa; trống thì lấy căn cứ theo logic cũ. */
export function resolveNghiemThuCanCu(meta, road) {
  return listNghiemThuCanCu(meta, road).map((s) => `- ${s}`).join("\n");
}

function stripAutoFields(meta) {
  if (!meta || typeof meta !== "object") return {};
  const rest = { ...meta };
  delete rest._defaultsSaved;
  const daySaved = !!rest._daySaved;
  // Chưa từng Lưu: ô auto trống → lần sau lấy mẫu theo đường.
  // Đã Lưu (_daySaved): giữ nguyên mọi field đã materialize.
  // canCuHopDong thuộc book defaults — luôn giữ nếu có (kể cả chuỗi rỗng có chủ đích).
  if (!daySaved) {
    ["doiTuong", "diaDiem", "canCu", "canCuHoSo", "thoiGian"].forEach((k) => {
      if (!String(rest[k] ?? "").trim()) delete rest[k];
    });
    ["canCuFixed1", "canCuFixed2"].forEach((k) => {
      if (!String(rest[k] ?? "").trim()) delete rest[k];
    });
  }
  return rest;
}

/** Gắn giá trị đang hiện trên biên bản vào meta trước khi lưu (tránh mất khi đổi ngày). */
export function materializeNghiemThuMeta(meta, road, date) {
  const display = formatDisplayDate(date);
  const thoiDefault = display ? `Ngày ${display}` : "";
  const fixed = resolveNghiemThuCanCuFixed(meta);
  return {
    ...(meta || {}),
    thoiGian: String(meta?.thoiGian || "").trim() || thoiDefault,
    doiTuong: resolveNghiemThuDoiTuong(meta, road),
    diaDiem: resolveNghiemThuDiaDiem(meta, road),
    canCuHopDong: resolveNghiemThuCanCuHopDong(meta),
    canCuHoSo: resolveNghiemThuCanCuHoSo(meta, road),
    canCuFixed1: fixed[0],
    canCuFixed2: fixed[1],
    yKienKhac:
      meta?.yKienKhac != null && String(meta.yKienKhac).trim() !== ""
        ? meta.yKienKhac
        : "Không",
    ketLuan:
      meta?.ketLuan != null && String(meta.ketLuan).trim() !== ""
        ? meta.ketLuan
        : "Đồng ý nghiệm thu khối lượng thực hiện hoàn thành nêu trên.",
    _daySaved: true
  };
}

function normalizeDayPayload(raw, road, date, storageKey = "") {
  const book = loadNghiemThuBookDefaults(storageKey);
  const defaults = defaultNghiemThuMeta(road, date, storageKey);
  if (!raw || typeof raw !== "object") {
    return { meta: defaults, qlOverrides: {}, volOverrides: {} };
  }
  const metaSrc =
    raw.meta && typeof raw.meta === "object" ? raw.meta : stripAutoFields(raw);
  const daySaved = !!metaSrc._daySaved || !!raw.savedAt;
  // Nhân sự không theo ngày: bỏ bản cũ trong day payload, luôn lấy mặc định sổ.
  const dayMeta = stripPersistMeta(stripAutoFields(metaSrc));
  const thoiGianSaved = String(dayMeta.thoiGian || "").trim();
  const display = formatDisplayDate(date);
  const thoiDefault = display ? `Ngày ${display}` : "";
  return {
    meta: {
      ...defaults,
      ...dayMeta,
      ...book,
      thoiGian: thoiGianSaved || thoiDefault,
      _daySaved: daySaved || undefined
    },
    qlOverrides:
      raw.qlOverrides && typeof raw.qlOverrides === "object" ? raw.qlOverrides : {},
    volOverrides:
      raw.volOverrides && typeof raw.volOverrides === "object" ? raw.volOverrides : {}
  };
}

/** Đọc biên bản NT theo ngày (local day key → dayMeta.nghiemThu → meta cũ). */
export function loadNghiemThuDayState(storageKey, date, road) {
  const defaults = {
    meta: defaultNghiemThuMeta(road, date, storageKey),
    qlOverrides: {},
    volOverrides: {}
  };
  if (!storageKey || !date) return defaults;
  try {
    const fromDayKey = JSON.parse(
      localStorage.getItem(dayStorageKey(storageKey, date)) || "null"
    );
    if (fromDayKey) return normalizeDayPayload(fromDayKey, road, date, storageKey);

    const stored = loadStorage(storageKey);
    const fromDayMeta = stored?.dayMeta?.[date]?.nghiemThu;
    if (fromDayMeta) return normalizeDayPayload(fromDayMeta, road, date, storageKey);

    const legacy = JSON.parse(localStorage.getItem(`${META_PREFIX}${storageKey}`) || "null");
    if (legacy) return normalizeDayPayload({ meta: legacy }, road, date, storageKey);

    return defaults;
  } catch {
    return defaults;
  }
}

/**
 * Lưu biên bản NT theo ngày:
 * - localStorage day key + dayMeta[date].nghiemThu
 * - nhân sự ghi vào reportMeta (dùng chung mọi ngày)
 */
export function saveNghiemThuDayState(storageKey, date, state) {
  invalidateBookDefaultsMemo();
  if (!storageKey || !date) return { ok: false, msg: "Thiếu sổ hoặc ngày." };
  const road = state?.road;
  const metaIn = state?.meta || {};
  const materialized = road
    ? materializeNghiemThuMeta(metaIn, road, date)
    : { ...metaIn, _daySaved: true };
  const payload = {
    meta: stripAutoFields(materialized),
    qlOverrides: state?.qlOverrides || {},
    volOverrides: state?.volOverrides || {},
    savedAt: new Date().toISOString()
  };
  try {
    localStorage.setItem(dayStorageKey(storageKey, date), JSON.stringify(payload));
  } catch {
    return { ok: false, msg: "Không ghi được localStorage." };
  }
  try {
    // Nhân sự dùng chung — ghi trước rồi gắn dayMeta trong cùng saveStorage.
    const clean = pickPersistMeta(materialized);
    const flagged = { ...clean, _defaultsSaved: true };
    localStorage.setItem(defaultsStorageKey(storageKey), JSON.stringify(flagged));

    const stored = loadStorage(storageKey);
    const prevDay = stored.dayMeta?.[date] || {};
    const nextDayMeta = {
      ...(stored.dayMeta || {}),
      [date]: {
        ...prevDay,
        nghiemThu: payload
      }
    };
    const nextRm = {
      ...(stored.reportMeta || {}),
      nghiemThuDefaults: flagged,
      ntPersonnelSaved: true
    };
    Object.entries(REPORT_META_PERSON_KEYS).forEach(([metaKey, rmKey]) => {
      nextRm[rmKey] = clean[metaKey] ?? "";
    });
    saveStorage(stored.entries || [], nextDayMeta, nextRm, storageKey);
  } catch (err) {
    console.warn("Lưu nghiemThu vào dayMeta thất bại.", err);
    return { ok: false, msg: "Đã lưu máy, chưa đẩy được vào sổ đồng bộ." };
  }
  return { ok: true, meta: materialized };
}

/** @deprecated — dùng loadNghiemThuDayState */
export function loadNghiemThuMeta(storageKey, road, date) {
  return loadNghiemThuDayState(storageKey, date, road).meta;
}

/** @deprecated — dùng saveNghiemThuDayState */
export function saveNghiemThuMeta(storageKey, meta) {
  try {
    localStorage.setItem(`${META_PREFIX}${storageKey}`, JSON.stringify(stripAutoFields(meta)));
  } catch {
    /* ignore */
  }
}

export function formatNghiemThuQuantity(entry) {
  const e = migrateEntry(entry);
  const q = formatBookDecimal(e.quantity);
  if (q) {
    return `${q} ${formatUnitLabel(e.unit)}`.trim();
  }
  const area = formatBookDecimal(calcAreaM2(e));
  if (area && e.length && e.width) return `${area} m²`;
  const len = formatBookDecimal(e.length);
  if (len && !String(e.width || "").trim()) return `${len} m`;
  return "";
}

/** @deprecated Mục 6.2 không gộp lý trình. Giữ cho tương thích; hàng NT dùng formatNghiemThuLyTrinhOne. */
export function formatNghiemThuLyTrinhMerged(entries) {
  const sorted = [...(entries || [])]
    .map(migrateEntry)
    .sort((a, b) => kmToMeters(a.kmFrom) - kmToMeters(b.kmFrom));

  const labels = [];
  const seen = new Set();
  sorted.forEach((e) => {
    const label = String(formatKmCell(e.kmFrom) || "").trim();
    if (!label || seen.has(label)) return;
    seen.add(label);
    labels.push(label);
  });
  return labels.join("; ");
}

function quantityParts(entry) {
  const e = migrateEntry(entry);
  if (e.quantity !== "" && e.quantity != null && String(e.quantity).trim() !== "") {
    const n = Number(String(e.quantity).replace(",", "."));
    const unit = formatUnitLabel(e.unit) || "";
    if (Number.isFinite(n)) return { n, unit };
  }
  const area = calcAreaM2(e);
  if (area && e.length && e.width) {
    const n = Number(String(area).replace(",", "."));
    if (Number.isFinite(n)) return { n, unit: "m²" };
  }
  if (e.length && !e.width) {
    const n = Number(String(e.length).replace(",", "."));
    if (Number.isFinite(n)) return { n, unit: "m" };
  }
  return null;
}

/** Cộng khối lượng cùng đơn vị; khác đơn vị thì liệt kê. */
export function formatNghiemThuQuantityMerged(entries) {
  const byUnit = new Map();
  (entries || []).forEach((e) => {
    const p = quantityParts(e);
    if (!p) return;
    const key = p.unit || "";
    byUnit.set(key, (byUnit.get(key) || 0) + p.n);
  });
  if (!byUnit.size) return formatNghiemThuQuantity(entries?.[0]) || "";
  return Array.from(byUnit.entries())
    .map(([unit, n]) => `${formatBookDecimal(n)} ${unit}`.trim())
    .join("; ");
}

/** Hạng mục 6.2 = tên Công việc BDTX trên danh mục / sổ; không bịa «Sửa chữa…» / «Xử lý…». */
function workNameOf(entry) {
  const e = migrateEntry(entry || {});
  const type = String(e.type || "").trim();
  const source = String(e.sourceIncidentType || "").trim();
  const candidates = [];
  if (e.section === "Nền đường" && type === "Sụt lún" && /^sa\s*bồi/i.test(source)) {
    candidates.push(source, type);
  } else {
    if (type) candidates.push(type);
    if (source && source !== type) candidates.push(source);
  }
  for (const candidate of candidates) {
    const label = resolveMaintenanceWorkLabel(candidate);
    if (label) return label;
  }
  return candidates[0] || "—";
}

const NT_POINT_SECTIONS = new Set([
  "Công trình cầu",
  "Công trình an toàn giao thông",
  "Cột mốc GP mặt bằng, lộ giới"
]);

/** Cầu, cống, biển, cột, đơn vị đếm: một lý trình. Không suy km cuối từ chiều dài. */
function isPointChainageEntry(entry) {
  if (isCulvertDiaryEntry(entry)) return true;
  const section = String(entry?.section || "").trim();
  if (NT_POINT_SECTIONS.has(section)) return true;
  const type = `${entry?.type || ""} ${entry?.sourceIncidentType || ""}`;
  if (/biển|cột|cọc|hộ lan|lan can/i.test(type) && !/rãnh/i.test(type)) return true;
  const unit = normalizeUnitValue(
    String(entry?.unit || "").trim() || inferEntryUnit(entry)
  ).toLowerCase();
  return !!unit && isCountUnit(unit);
}

/** (P) (T) (G) (M) (T+P) — cùng mã sổ tuần đường, không «Làn phải». */
function formatNghiemThuSideCode(side) {
  const raw = String(side || "").trim();
  if (!raw) return "";
  const upper = raw.toUpperCase().replace(/\s+/g, "");
  if (upper === "T+P" || upper === "P+T" || upper === "TP" || upper === "PT") return "T+P";
  if (upper === "P" || upper === "T" || upper === "G" || upper === "M") return upper;
  if (upper === "C") return "M";
  const folded = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (/trai\s*\+\s*phai|phai\s*\+\s*trai|hai\s*ben/.test(folded)) return "T+P";
  if (folded === "phai" || /lan\s*phai|ben\s*phai/.test(folded)) return "P";
  if (folded === "trai" || /lan\s*trai|ben\s*trai/.test(folded)) return "T";
  if (/giua/.test(folded)) return "G";
  if (/ca\s*mat/.test(folded)) return "M";
  return "";
}

/** Một sự cố: đoạn khi km đầu ≠ km cuối đã nhập; điểm thì một lý trình. */
export function formatNghiemThuLyTrinhOne(entry) {
  const e = migrateEntry(entry);
  const from = String(formatKmCell(e.kmFrom) || "").trim();
  let label = from;
  if (!isPointChainageEntry(e)) {
    const toRaw = String(e.kmTo || "").trim();
    if (toRaw) {
      const to = String(formatKmCell(e.kmTo) || "").trim();
      if (to && to !== from) label = from ? `${from} - ${to}` : to;
    }
  }
  if (!label) label = String(formatKmCell(e.kmTo) || "").trim();
  const side = formatNghiemThuSideCode(e.side);
  if (side && label) return `${label} (${side})`;
  if (side) return `(${side})`;
  return label;
}

/**
 * Mục 6.2: mỗi sự cố một hàng, STT riêng, sắp theo lý trình.
 * Không gộp cùng hạng mục; không cộng khối lượng nhiều điểm.
 */
export function mergeNghiemThuRowsByWork(entries) {
  const sorted = [...(entries || [])].map(migrateEntry).sort((a, b) => {
    const byFrom = kmToMeters(a.kmFrom) - kmToMeters(b.kmFrom);
    if (byFrom) return byFrom;
    const byTo = kmToMeters(a.kmTo) - kmToMeters(b.kmTo);
    if (byTo) return byTo;
    return workNameOf(a).localeCompare(workNameOf(b), "vi");
  });

  return sorted.map((e, idx) => ({
    stt: idx + 1,
    hangMuc: workNameOf(e),
    lyTrinh: formatNghiemThuLyTrinhOne(e),
    khoiLuong: formatNghiemThuQuantity(e),
    mucDo: formatNghiemThuMucDo(e),
    entry: e,
    entries: [e]
  }));
}

export function resolveNtGroupKey(entry) {
  const group =
    getGroupForType(entry?.type) ||
    String(entry?.section || "").trim() ||
    "";
  for (const sec of NT_VOLUME_SECTIONS) {
    if (sec.groups.includes(group)) return sec.key;
  }
  // fallback theo section title nhật ký
  const s = String(entry?.section || "");
  if (/mặt đường/i.test(s)) return "I";
  if (/an toàn|cọc|biển/i.test(s)) return "II";
  if (/cầu/i.test(s)) return "IV";
  if (/nền|lề|cống|rãnh|phát cây|ngầm|tràn/i.test(s)) return "III";
  return "III";
}

export function formatNghiemThuMucDo(entry) {
  if (entry?.mainResult?.trim()) return entry.mainResult.trim();
  return autoQualityForType(entry?.type).result || "Đảm bảo yêu cầu";
}

const HANH_LANG_NT_SUFFIX =
  "đảm bảo theo quy định; Phát hiện, phối hợp xử lý theo quy định, ngăn chặn kịp thời các vi phạm hành lang và kết cấu hạ tầng đường bộ; cập nhật đầy đủ, kịp thời vào hồ sơ quản lý hành lang an toàn đường bộ; tổng hợp, báo cáo kết quả xử lý vi phạm đầy đủ, đúng quy định";

/** Phần sau «đảm bảo theo quy định:» — mẫu biên bản NT mục ATGT / sổ TNGT. */
const ATGT_NT_BODY =
  "Phát hiện, phối hợp kịp thời với lực lượng chức năng xử lý ùn tắc giao thông, tham gia hướng dẫn giao thông (nếu cần), tham gia cứu nạn cứu hộ, bảo vệ hiện trường lập biên bản xác nhận thiệt hại đối với các vụ tai nạn giao thông gây hư hỏng công trình đường bộ. Cập nhật đầy đủ vào sổ theo dõi tai nạn giao thông";

function lowerFirstVi(text) {
  const s = String(text || "").trim();
  if (!s) return "";
  return s.charAt(0).toLocaleLowerCase("vi") + s.slice(1);
}

function formatNghiemThuKmSpan(entry) {
  const e = migrateEntry(entry);
  const from = String(formatKmCell(e.kmFrom) || "").trim();
  const to = String(formatKmCell(e.kmTo) || "").trim();
  if (from && to && from !== to) return `${from} - ${to}`;
  return from || to || "";
}

/** Một cụm «tại Km… (ông … đang …)» từ dòng sổ hành lang. */
function formatHanhLangNtPhrase(entry) {
  const e = migrateEntry(entry);
  const km = formatNghiemThuKmSpan(e);
  const name = String(e.hlViolator || "").trim();
  const content = lowerFirstVi(e.content);
  const who = name ? `ông ${name}` : "ông (bà)";
  const action = content ? ` đang ${content}` : "";
  const paren = `(${who}${action})`;
  return km ? `tại ${km} ${paren}` : paren;
}

/**
 * Lọc dòng hành lang theo ngày NT (ưu tiên hlRecordDate).
 */
export function filterHanhLangEntriesForNghiemThu(entries, date, filterByRouteView) {
  const day = String(date || "").trim();
  let list = expandEntriesForVolumeBooks(entries || [])
    .map(migrateEntry)
    .filter(
      (e) =>
        shouldExportHanhLang(e) &&
        String(e.hlRecordDate || e.date || "").trim() === day
    );
  if (typeof filterByRouteView === "function") {
    list = filterByRouteView(list);
  }
  return list.sort((a, b) => kmToMeters(a.kmFrom) - kmToMeters(b.kmFrom));
}

/**
 * Mức độ hoàn thành mục hành lang — theo sổ vi phạm hành lang trong ngày.
 * Có vi phạm: «… tại Km… (ông … đang …): đảm bảo theo quy định; …»
 * Không có: «Không phát sinh trong ngày»
 */
export function buildNghiemThuHanhLangMucDo(entries, date, filterByRouteView) {
  const list = filterHanhLangEntriesForNghiemThu(entries, date, filterByRouteView);
  if (!list.length) return "Không phát sinh trong ngày";
  const phrases = list.map(formatHanhLangNtPhrase).filter(Boolean);
  return `Công tác quản lý, bảo vệ kết cấu hạ tầng đường bộ ${phrases.join("; ")}: ${HANH_LANG_NT_SUFFIX}`;
}

/**
 * Lọc dòng TNGT theo ngày NT (ưu tiên tngtOccurDate).
 */
export function filterTngtEntriesForNghiemThu(entries, date, filterByRouteView) {
  const day = String(date || "").trim();
  let list = expandEntriesForVolumeBooks(entries || [])
    .map(migrateEntry)
    .filter(
      (e) =>
        shouldExportTngt(e) &&
        String(e.tngtOccurDate || e.date || "").trim() === day
    );
  if (typeof filterByRouteView === "function") {
    list = filterByRouteView(list);
  }
  return list.sort((a, b) => kmToMeters(a.kmFrom) - kmToMeters(b.kmFrom));
}

/**
 * Mức độ hoàn thành mục ATGT — theo sổ theo dõi tai nạn giao thông.
 * Có TNGT: «… tại Km… đảm bảo theo quy định: Phát hiện, phối hợp… Cập nhật đầy đủ vào sổ…»
 * Không có: «Không phát sinh trong ngày»
 */
export function buildNghiemThuAtgtMucDo(entries, date, filterByRouteView) {
  const list = filterTngtEntriesForNghiemThu(entries, date, filterByRouteView);
  if (!list.length) return "Không phát sinh trong ngày";
  const kms = [
    ...new Set(list.map((e) => formatNghiemThuKmSpan(e)).filter(Boolean))
  ];
  const tai = kms.length ? ` tại ${kms.join(", ")}` : "";
  return `Công tác bảo đảm an toàn giao thông${tai} đảm bảo theo quy định: ${ATGT_NT_BODY}`;
}

/** Mức độ hoàn thành mục bão lũ khi ngày có sự cố trên sổ trực ĐBGT. */
const BAO_LU_NT_MUC_DO =
  "Thực hiện trực đảm bảo giao thông đảm bảo theo quy định: Báo cáo, tham gia xử lý sự cố, ghi chép đầy đủ diễn biến thời tiết, các hư hỏng công trình vào sổ trực bão lũ, ĐBGT";

/**
 * Lọc dòng sổ trực bão lũ theo ngày NT.
 */
export function filterBaoLuEntriesForNghiemThu(entries, date, filterByRouteView) {
  const day = String(date || "").trim();
  let list = expandEntriesForVolumeBooks(entries || [])
    .map(migrateEntry)
    .filter((e) => shouldExportTrafficDuty(e) && String(e.date || "").trim() === day);
  if (typeof filterByRouteView === "function") {
    list = filterByRouteView(list);
  }
  return list;
}

/**
 * Mức độ hoàn thành mục bão lũ — theo sổ trực bão lũ / ĐBGT.
 * Có sự cố trong ngày → mẫu đảm bảo theo quy định; không có → «Không phát sinh trong ngày».
 */
export function buildNghiemThuBaoLuMucDo(entries, date, filterByRouteView) {
  const list = filterBaoLuEntriesForNghiemThu(entries, date, filterByRouteView);
  if (!list.length) return "Không phát sinh trong ngày";
  return BAO_LU_NT_MUC_DO;
}

/**
 * Mức độ hoàn thành mục Đếm xe — lịch cố định sổ đếm xe:
 * ngày 5–6–7 tháng cuối quý (III/VI/IX/XII).
 */
export function buildNghiemThuDemXeMucDo(_demXeLedger, date) {
  const day = String(date || "").trim();
  if (!isQuarterCountDate(day)) return "Không phát sinh trong ngày";
  return DEMXE_NT_MUC_DO;
}

/**
 * Giá trị tự điền cột «Mức độ hoàn thành» mục 6.1 theo nhật ký ngày / sổ đếm xe.
 */
export function buildNghiemThuQlAutoByKey(entries, date, filterByRouteView, demXeLedger = null) {
  return {
    demxe: buildNghiemThuDemXeMucDo(demXeLedger, date),
    hanhlang: buildNghiemThuHanhLangMucDo(entries, date, filterByRouteView),
    atgt: buildNghiemThuAtgtMucDo(entries, date, filterByRouteView),
    baolu: buildNghiemThuBaoLuMucDo(entries, date, filterByRouteView)
  };
}

/**
 * Khối lượng BDTX theo ngày nghiệm thu (ngày thực hiện / plannedRepairDate).
 * Trong mỗi nhóm I–IV: mỗi sự cố một hàng, sắp theo lý trình.
 */
export function buildNghiemThuVolumeSectionsFromDayEntries(dayEntries) {
  const list = dayEntries || [];
  const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

  return NT_VOLUME_SECTIONS.map((sec) => {
    const secEntries = list.filter((e) => resolveNtGroupKey(e) === sec.key);
    const rows = mergeNghiemThuRowsByWork(secEntries);
    return { ...sec, rows };
  })
    .filter((sec) => sec.rows.length > 0)
    .map((sec, i) => ({
      ...sec,
      groupKey: sec.key,
      key: ROMAN[i] || String(i + 1)
    }));
}

export function buildNghiemThuVolumeSections(entries, date, filterByRouteView) {
  const dayEntries = filterByRouteView
    ? filterByRouteView(filterBaoDuongEntries(entries, date))
    : filterBaoDuongEntries(entries, date);
  return buildNghiemThuVolumeSectionsFromDayEntries(dayEntries);
}

export function buildNghiemThuQlRows(overrides = {}, autoByKey = {}) {
  const rows = NT_QL_CHECKLIST.map((item, i) => {
    const hasOv = Object.prototype.hasOwnProperty.call(overrides || {}, item.key);
    const ov = overrides?.[item.key];
    const auto = autoByKey[item.key];
    const def = item.defaultMucDo || "";
    // Đã lưu override (kể cả trùng mặc định) → giữ nguyên đến lần sửa tiếp.
    let mucDo = def;
    if (auto != null && String(auto).trim() !== "") mucDo = String(auto).trim();
    if (hasOv) mucDo = ov == null ? "" : String(ov);
    return {
      stt: i + 1,
      key: item.key,
      hangMuc: item.hideWhenEmpty
        ? String(item.hangMuc || "").replace(/\s*\(Nếu có\)\s*$/i, "").trim()
        : item.hangMuc,
      noiDung: item.noiDung,
      mucDo,
      hideWhenEmpty: !!item.hideWhenEmpty,
      emptyMucDo: def
    };
  }).filter((row) => {
    if (!row.hideWhenEmpty) return true;
    // Đã sửa tay → luôn hiện; chưa sửa thì ẩn khi = «Không phát sinh…»
    if (Object.prototype.hasOwnProperty.call(overrides || {}, row.key)) return true;
    const empty = String(row.emptyMucDo || "Không phát sinh trong ngày").trim();
    return String(row.mucDo || "").trim() !== empty;
  });

  return rows.map(({ hideWhenEmpty, emptyMucDo, ...row }, i) => ({
    ...row,
    stt: i + 1
  }));
}

export function countNghiemThuJobs(entries, date, filterByRouteView) {
  const dayEntries = filterByRouteView
    ? filterByRouteView(filterBaoDuongEntries(entries, date))
    : filterBaoDuongEntries(entries, date);
  return dayEntries.length;
}

/**
 * Tập ngày có KL BDTX (plannedRepairDate) — quét sổ 1 lần, dùng cho khoảng dài.
 */
export function indexNghiemThuJobDates(entries, filterByRouteView) {
  let list = expandEntriesForVolumeBooks(entries || [])
    .map(migrateEntry)
    .filter((e) => shouldExportBaoDuong(e));
  if (typeof filterByRouteView === "function") list = filterByRouteView(list);
  const dates = new Set();
  for (const e of list) {
    const d = String(e.plannedRepairDate || "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) dates.add(d);
  }
  return dates;
}

/** Ngày có KL BDTX trong khoảng from→to (đã sắp). */
export function listNghiemThuJobDatesInRange(
  entries,
  dateFrom,
  dateTo,
  filterByRouteView
) {
  const from = String(dateFrom || "").trim();
  const to = String(dateTo || "").trim();
  if (!from || !to || from > to) return [];
  let list = filterBaoDuongEntriesInRange(entries, from, to);
  if (typeof filterByRouteView === "function") list = filterByRouteView(list);
  const dates = new Set();
  for (const e of list) {
    const d = String(e.plannedRepairDate || "").trim();
    if (d) dates.add(d);
  }
  return [...dates].sort();
}

/**
 * Dựng payload 1 ngày biên bản NT (meta đã lưu + QL + khối lượng).
 */
export function buildNghiemThuDayReport({
  storageKey,
  date,
  road,
  entries,
  filterByRouteView,
  demXeLedger = null
}) {
  const loaded = loadNghiemThuDayState(storageKey, date, road);
  const volumeSectionsBase = buildNghiemThuVolumeSections(
    entries,
    date,
    filterByRouteView
  );
  const volumeSections = !Object.keys(loaded.volOverrides || {}).length
    ? volumeSectionsBase
    : volumeSectionsBase.map((sec) => ({
        ...sec,
        rows: sec.rows.map((r) => {
          const k = `${sec.groupKey || sec.key}-${r.stt}`;
          return Object.prototype.hasOwnProperty.call(loaded.volOverrides, k)
            ? { ...r, mucDo: loaded.volOverrides[k] }
            : r;
        })
      }));

  const qlAutoByKey = buildNghiemThuQlAutoByKey(
    entries,
    date,
    filterByRouteView,
    demXeLedger
  );
  const qlRows = buildNghiemThuQlRows(loaded.qlOverrides, qlAutoByKey);
  const meta = {
    ...loaded.meta,
    thoiGian:
      String(loaded.meta?.thoiGian || "").trim() ||
      (formatDisplayDate(date) ? `Ngày ${formatDisplayDate(date)}` : ""),
    doiTuong: resolveNghiemThuDoiTuong(loaded.meta, road),
    diaDiem: resolveNghiemThuDiaDiem(loaded.meta, road),
    canCu: resolveNghiemThuCanCu(loaded.meta, road)
  };

  return {
    date,
    road,
    meta,
    qlRows,
    volumeSections,
    jobCount: countNghiemThuJobs(entries, date, filterByRouteView)
  };
}

/**
 * Danh sách biên bản NT từ ngày A→B.
 * Mặc định chỉ ngày có khối lượng BDTX; includeEmptyDays = true thì lấy mọi ngày.
 */
function pushDateMap(map, date, item) {
  const d = String(date || "").trim();
  if (!d) return;
  const arr = map.get(d);
  if (arr) arr.push(item);
  else map.set(d, [item]);
}

function mucDoHanhLangFromList(list) {
  if (!list?.length) return "Không phát sinh trong ngày";
  const phrases = list.map(formatHanhLangNtPhrase).filter(Boolean);
  return `Công tác quản lý, bảo vệ kết cấu hạ tầng đường bộ ${phrases.join("; ")}: ${HANH_LANG_NT_SUFFIX}`;
}

function mucDoAtgtFromList(list) {
  if (!list?.length) return "Không phát sinh trong ngày";
  const kms = [
    ...new Set(list.map((e) => formatNghiemThuKmSpan(e)).filter(Boolean))
  ];
  const tai = kms.length ? ` tại ${kms.join(", ")}` : "";
  return `Công tác bảo đảm an toàn giao thông${tai} đảm bảo theo quy định: ${ATGT_NT_BODY}`;
}

function prepareNghiemThuRangeContext({
  storageKey,
  dateFrom,
  dateTo,
  road,
  entries,
  filterByRouteView,
  demXeLedger = null,
  includeEmptyDays = false
}) {
  const from = String(dateFrom || "").trim();
  const to = String(dateTo || "").trim();
  if (!from || !to) return null;

  let scoped = expandEntriesForVolumeBooks(entries || []).map(migrateEntry);
  if (typeof filterByRouteView === "function") scoped = filterByRouteView(scoped);

  const bdtxByDate = new Map();
  const hlByDate = new Map();
  const tngtByDate = new Map();
  const baoluByDate = new Map();
  for (const e of scoped) {
    if (shouldExportBaoDuong(e)) {
      const d = String(e.plannedRepairDate || "").trim();
      if (d >= from && d <= to) pushDateMap(bdtxByDate, d, e);
    }
    if (shouldExportHanhLang(e)) {
      const d = String(e.hlRecordDate || e.date || "").trim();
      if (d >= from && d <= to) pushDateMap(hlByDate, d, e);
    }
    if (shouldExportTngt(e)) {
      const d = String(e.tngtOccurDate || e.date || "").trim();
      if (d >= from && d <= to) pushDateMap(tngtByDate, d, e);
    }
    if (shouldExportTrafficDuty(e)) {
      const d = String(e.date || "").trim();
      if (d >= from && d <= to) pushDateMap(baoluByDate, d, e);
    }
  }

  const dates = includeEmptyDays
    ? eachIsoDateInclusive(from, to)
    : [...bdtxByDate.keys()].sort();

  return {
    storageKey,
    road,
    demXeLedger,
    includeEmptyDays,
    bdtxByDate,
    hlByDate,
    tngtByDate,
    baoluByDate,
    dates,
    doiTuong: buildNghiemThuDoiTuong(road),
    diaDiem: buildNghiemThuDiaDiem(road)
  };
}

function assembleNghiemThuReportFromCtx(ctx, date) {
  const dayBdtx = ctx.bdtxByDate.get(date) || [];
  if (!ctx.includeEmptyDays && !dayBdtx.length) return null;

  const loaded = loadNghiemThuDayState(ctx.storageKey, date, ctx.road);
  let volumeSections = buildNghiemThuVolumeSectionsFromDayEntries(dayBdtx);
  if (Object.keys(loaded.volOverrides || {}).length) {
    volumeSections = volumeSections.map((sec) => ({
      ...sec,
      rows: sec.rows.map((r) => {
        const k = `${sec.groupKey || sec.key}-${r.stt}`;
        return Object.prototype.hasOwnProperty.call(loaded.volOverrides, k)
          ? { ...r, mucDo: loaded.volOverrides[k] }
          : r;
      })
    }));
  }

  const qlAutoByKey = {
    demxe: buildNghiemThuDemXeMucDo(ctx.demXeLedger, date),
    hanhlang: mucDoHanhLangFromList(ctx.hlByDate.get(date) || []),
    atgt: mucDoAtgtFromList(ctx.tngtByDate.get(date) || []),
    baolu: (ctx.baoluByDate.get(date) || []).length
      ? BAO_LU_NT_MUC_DO
      : "Không phát sinh trong ngày"
  };

  return {
    date,
    road: ctx.road,
    meta: {
      ...loaded.meta,
      thoiGian:
        String(loaded.meta?.thoiGian || "").trim() ||
        (formatDisplayDate(date) ? `Ngày ${formatDisplayDate(date)}` : ""),
      doiTuong: resolveNghiemThuDoiTuong(loaded.meta, ctx.road),
      diaDiem: resolveNghiemThuDiaDiem(loaded.meta, ctx.road),
      canCu: resolveNghiemThuCanCu(loaded.meta, ctx.road)
    },
    qlRows: buildNghiemThuQlRows(loaded.qlOverrides, qlAutoByKey),
    volumeSections,
    jobCount: dayBdtx.length
  };
}

export function buildNghiemThuReportsInRange(opts) {
  const ctx = prepareNghiemThuRangeContext(opts);
  if (!ctx) return [];
  const reports = [];
  for (const date of ctx.dates) {
    const report = assembleNghiemThuReportFromCtx(ctx, date);
    if (report) reports.push(report);
  }
  return reports;
}

export async function buildNghiemThuReportsInRangeAsync(opts = {}) {
  const ctx = prepareNghiemThuRangeContext(opts);
  if (!ctx) return [];
  const yieldEvery = Math.max(1, Number(opts.yieldEvery) || 5);
  const reports = [];
  for (let i = 0; i < ctx.dates.length; i++) {
    const report = assembleNghiemThuReportFromCtx(ctx, ctx.dates[i]);
    if (report) reports.push(report);
    if ((i + 1) % yieldEvery === 0) {
      opts.onProgress?.({ done: i + 1, total: ctx.dates.length });
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  return reports;
}

export function loadEntriesForNghiemThu(storageKey) {
  return loadStorage(storageKey).entries || [];
}

/** Chuỗi ngày kiểu «Sơn La, ngày … tháng … năm …». */
export function formatNghiemThuPlaceDate(dateIso, place = "Sơn La") {
  const iso = String(dateIso || "").trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return `${place}, ngày … tháng … năm …`;
  return `${place}, ngày ${Number(m[3])} tháng ${Number(m[2])} năm ${m[1]}`;
}
