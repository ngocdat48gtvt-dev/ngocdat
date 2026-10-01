/**
 * Danh mục biện pháp & nhận xét kết quả BDTX theo từng loại công việc.
 * Mặc định kèm sẵn; override lưu localStorage + đồng bộ Firestore (data_noi_nghiep).
 */

const STORAGE_KEY = "baoduong-quality-catalog-v1";
export const BAO_DUONG_QUALITY_EVENT = "baoduong-quality-changed";

/** Owner MASTER DATA (ADMIN uid) — tách local theo công ty, tránh USER/ADMIN ghi đè nhau trên cùng máy. */
let activeCatalogOwnerUid = "";

export function setQualityCatalogOwnerUid(uid) {
  const next = String(uid || "").trim();
  if (next === activeCatalogOwnerUid) return false;
  activeCatalogOwnerUid = next;
  cache = null;
  return true;
}

export function resetQualityCatalogOwnerUid() {
  if (!activeCatalogOwnerUid && !cache) return;
  activeCatalogOwnerUid = "";
  cache = null;
}

function storageKeyFor(uid = activeCatalogOwnerUid) {
  const owner = String(uid || "").trim();
  return owner ? `${STORAGE_KEY}__${owner}` : STORAGE_KEY;
}

function metaKeyFor(uid = activeCatalogOwnerUid) {
  return `${storageKeyFor(uid)}__meta`;
}

function getLocalUpdatedAt() {
  try {
    const raw = JSON.parse(localStorage.getItem(metaKeyFor()) || "{}");
    const n = Number(raw?.updatedAt);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

function setLocalUpdatedAt(ms) {
  const n = Number(ms);
  const updatedAt = Number.isFinite(n) && n > 0 ? n : Date.now();
  try {
    localStorage.setItem(metaKeyFor(), JSON.stringify({ updatedAt }));
  } catch {
    /* ignore */
  }
}

/** Timestamp local — dùng khi quyết định đẩy lại cloud nếu máy đang mới hơn. */
export function getQualityCatalogLocalUpdatedAt() {
  return getLocalUpdatedAt();
}

/** Nhóm công việc — khớp các mục nhập liệu (hạng mục sổ tuần đường). */
export const BAO_DUONG_GROUPS = [
  "Mặt đường",
  "Nền đường",
  "Lề đường",
  "Cống, rãnh thoát nước",
  "Ngầm, tràn (lũ, ngập)",
  "Cột mốc GP mặt bằng, lộ giới",
  "Công trình an toàn giao thông",
  "Công trình cầu"
];

/** Nhóm cũ → nhóm hiện tại (MASTER DATA / data_noi_nghiep). */
const GROUP_ALIASES = {
  "Công tác phát cây": "Nền đường",
  "Phát cây": "Nền đường"
};

/** Chuẩn hoá tên nhóm (gộp phát cây → Nền đường). */
export function normalizeBaoDuongGroup(group) {
  const g = String(group || "").trim();
  if (!g) return "";
  return GROUP_ALIASES[g] || g;
}

/** Đơn vị tính cho phép (m, m², m³, đếm cái/cột/cây/tấm/vị trí, %). */
export const BAO_DUONG_UNITS = [
  { value: "m", label: "m" },
  { value: "m2", label: "m²" },
  { value: "m3", label: "m³" },
  { value: "cái", label: "cái" },
  { value: "cột", label: "cột" },
  { value: "cây", label: "cây" },
  { value: "tấm", label: "tấm" },
  { value: "vị trí", label: "vị trí" },
  { value: "%", label: "%" }
];

/** Chuẩn hoá giá trị đơn vị lưu sổ (m²→m2…). */
export function normalizeUnitValue(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  const lower = s.toLowerCase();
  if (s === "m²" || lower === "m2") return "m2";
  if (s === "m³" || lower === "m3") return "m3";
  if (lower === "m") return "m";
  return s;
}

/** Nhãn hiển thị đơn vị (m2→m²). Ô trống → chuỗi rỗng (không hiện gạch —). */
export function formatUnitLabel(unit) {
  const value = normalizeUnitValue(unit);
  if (!value) return "";
  const found = BAO_DUONG_UNITS.find((u) => u.value === value);
  return found?.label || value;
}

/** Mức ưu tiên xử lý. */
export const PRIORITIES = [
  { value: "HIGH", label: "Cao" },
  { value: "MEDIUM", label: "Trung bình" },
  { value: "LOW", label: "Thấp" }
];

/** Số ngày phải xử lý mặc định khi loại công việc chưa khai báo. */
export const DEFAULT_DEADLINE_DAYS = 3;

function priorityFromDeadline(days) {
  const n = Number(days);
  if (!Number.isFinite(n) || n <= 0) return "LOW";
  if (n <= 3) return "HIGH";
  if (n <= 7) return "MEDIUM";
  return "LOW";
}

/** Đơn vị dạng đếm (khối lượng nhập tay, không tính dài × rộng × cao). */
export const COUNT_UNITS = new Set(["cái", "cột", "cây", "tấm", "vị trí", "%"]);

export function isCountUnit(unit) {
  return COUNT_UNITS.has(String(unit || "").trim());
}

/** Đơn vị mặc định theo từng loại công việc (sinh từ GROUP_DEFAULTS bên dưới). */
export const DEFAULT_TYPE_UNIT = {};

/** Tên công việc bảo dưỡng (BDTX) mặc định theo công việc tuần đường. */
export const DEFAULT_TYPE_MAINTENANCE = {};
/** Số ngày phải xử lý mặc định theo loại công việc. */
export const DEFAULT_TYPE_DEADLINE = {};
/** Loại công việc KHÔNG sinh công việc BDTX (mặc định còn lại là có). */
export const DEFAULT_TYPE_NEED = {};

/** Nhóm mặc định cho từng loại công việc (sinh từ GROUP_DEFAULTS bên dưới). */
export const DEFAULT_TYPE_GROUP = {};

export const DEFAULT_QUALITY_FALLBACK = {
  group: "",
  method: "Sửa chữa, khắc phục hư hỏng theo biện pháp phù hợp với hạng mục",
  result:
    "Đã khắc phục hư hỏng; bảo đảm yêu cầu kỹ thuật và an toàn giao thông trên đoạn tuyến"
};

/** Danh mục biện pháp/nhận xét mặc định (sinh từ GROUP_DEFAULTS bên dưới). */
export const DEFAULT_QUALITY_CATALOG = {};

const GENERIC_RESULT =
  "Hoàn thành xử lý đạt yêu cầu kỹ thuật, bảo đảm an toàn giao thông trên tuyến.";

/**
 * Danh mục công việc mặc định theo Thông tư 41/2024/TT-BGTVT.
 * Mỗi dòng: [công việc tuần đường, công việc BDTX, đơn vị, biện pháp?, nhận xét?, isNeedMaintenance?]
 * Nếu một công việc tuần đường trùng tên giữa nhiều nhóm thì nhóm xuất hiện trước được ưu tiên.
 */
const GROUP_DEFAULTS = {
  "Mặt đường": [
    ["Ổ gà", "Vá ổ gà", "m2", "Vệ sinh ổ gà, tưới nhựa dính bám, vá BTN, lu lèn chặt", "Ổ gà được vá kín, mặt đường bằng phẳng, bảo đảm ATGT"],
    ["Bong tróc", "Vá sửa mặt đường", "m2", "Cào bóc lớp bong tróc, vá BTN đúng quy trình", "Mặt đường bằng phẳng, không còn bong tróc"],
    ["Rạn nứt", "Trám vá rạn nứt", "m2", "Làm sạch, tưới nhựa và trám kín vết rạn", "Mặt đường kín nước, không còn rạn nứt"],
    ["Nứt", "Trám khe nứt", "m", "Làm sạch khe nứt, trám kín bằng vật liệu phù hợp", "Khe nứt được xử lý, mặt đường kín nước"],
    ["Cao su", "Xử lý cao su", "m2", "Đào bỏ phần cao su, thay BTN mới", "Không còn hiện tượng cao su"],
    ["Lún vệt bánh xe", "Sửa chữa hằn lún", "m2", "Cào bóc, bù vênh, thảm BTN", "Mặt đường đúng cao độ, êm thuận"],
    ["Hư hỏng lớp móng", "Sửa chữa lớp móng", "m2", "Đào thay lớp móng, lu lèn, hoàn trả mặt đường", "Kết cấu áo đường ổn định"],
    ["Hư hỏng mặt đường", "Sửa chữa mặt đường", "m2", "Sửa chữa theo dạng hư hỏng thực tế", "Mặt đường đạt yêu cầu kỹ thuật"],
    ["Sình lún", "Đào thay kết cấu áo đường", "m3", "Đào thay đất yếu, đắp cấp phối, lu lèn", "Không còn sình lún"]
  ],
  "Nền đường": [
    ["Sụt lún", "Khắc phục sụt lún nền đường", "m3"],
    ["Nứt nền", "Xử lý nứt nền đường", "m"],
    ["Cung trượt", "Gia cố cung trượt", "m3"],
    ["Sạt taluy dương", "Hót dọn, gia cố taluy dương", "m3"],
    ["Sạt taluy âm", "Gia cố taluy âm", "m3"],
    ["Xói nền đường", "Gia cố nền đường", "m3"],
    ["Đá rơi", "Thu dọn đá rơi", "m3"],
    ["Đất tràn mặt đường", "Hót dọn đất đá", "m3"],
    ["Sụt dương", "Khắc phục sụt taluy dương", "m3"],
    ["Sụt âm", "Khắc phục sụt taluy âm", "m3"],
    ["Sa bồi rãnh xây", "Nạo vét rãnh xây", "m3"],
    ["Sa bồi rãnh đất", "Nạo vét rãnh đất", "m3"],
    ["Sa bồi lề mặt đường", "Hót dọn sa bồi lề đường", "m3"],
    ["Sa bồi cống", "Nạo vét cống", "m3"],
    ["Sa bồi hố thu nước", "Nạo vét hố thu nước", "m3"],
    ["Sa bồi mặt đường", "Thu dọn sa bồi mặt đường", "m3"],
    ["Trôi nền đường", "Khôi phục nền đường", "m3"],
    ["Ngập nền đường", "Khơi thông thoát nước nền đường", "m"],
    ["Cây cỏ ven đường", "Phát cây ven đường", "m2"],
    ["Che biển báo", "Phát cây khu vực biển báo", "m2"],
    ["Che cọc tiêu", "Phát cây khu vực cọc tiêu", "m2"],
    ["Che cột Km", "Phát cây khu vực cột Km", "m2"],
    ["Che đầu cầu", "Phát cây khu vực đầu cầu", "m2"],
    ["Che đầu cống", "Phát cây khu vực đầu cống", "m2"],
    ["Che gương cầu lồi", "Phát cây khu vực gương cầu", "m2"],
    ["Che tầm nhìn", "Phát quang bảo đảm tầm nhìn", "m2"],
    ["Cây đổ", "Cưa dọn cây đổ", "cây"],
    ["Cành cây nguy hiểm", "Cắt tỉa cành cây", "cây"]
  ],
  "Lề đường": [
    ["Lề cao", "Hạ lề đường", "m"],
    ["Lề thấp", "Đắp phụ lề", "m3"],
    ["Xói lở lề", "Đắp hoàn trả lề", "m3"],
    ["Sụt lề", "Gia cố lề đường", "m3"],
    ["Cỏ mọc", "Phát cỏ lề đường", "m2"],
    ["Đọng nước", "Khơi thông thoát nước lề", "m"],
    ["Bùn đất trên lề", "Thu dọn bùn đất", "m3"]
  ],
  "Cống, rãnh thoát nước": [
    ["Tắc rãnh", "Thông tắc rãnh", "m"],
    ["Tắc cống", "Thông tắc cống", "cái"],
    ["Đọng bùn", "Nạo vét bùn", "m3"],
    ["Đọng nước", "Khơi thông dòng chảy", "m"],
    ["Cỏ mọc trong rãnh", "Phát cỏ rãnh", "m2"],
    ["Đất đá bồi lấp rãnh", "Nạo vét rãnh", "m3"],
    ["Đất đá bồi lấp cửa cống", "Nạo vét cửa cống", "m3"],
    ["Rác trong rãnh", "Thu gom rác", "m3"],
    ["Rác cửa cống", "Thu gom rác cửa cống", "m3"],
    ["Hư thành rãnh", "Sửa chữa thành rãnh", "m"],
    ["Hư đáy rãnh", "Sửa chữa đáy rãnh", "m"],
    ["Bong vỡ tấm đan", "Thay tấm đan", "tấm"],
    ["Mất tấm đan", "Lắp bổ sung tấm đan", "tấm"],
    ["Hỏng nắp hố ga", "Thay nắp hố ga", "cái"],
    ["Hỏng song chắn rác", "Thay song chắn rác", "cái"],
    ["Hư đầu cống", "Sửa chữa đầu cống", "cái"],
    ["Hư thân cống", "Sửa chữa thân cống", "m"],
    ["Hư cửa cống", "Sửa chữa cửa cống", "cái"],
    ["Xói đầu cống", "Gia cố đầu cống", "m3"],
    ["Xói cuối cống", "Gia cố cuối cống", "m3"],
    ["Thoát nước kém", "Khơi thông hệ thống thoát nước", "m"],
    ["Thoát nước bình thường", "Không phát sinh xử lý", "m", "", "", false]
  ],
  "Ngầm, tràn (lũ, ngập)": [
    ["Ngập ngầm", "Khơi thông ngầm", "m"],
    ["Ngập tràn", "Khơi thông tràn", "m"],
    ["Sa bồi ngầm", "Thu dọn sa bồi", "m3"],
    ["Sa bồi tràn", "Thu dọn sa bồi", "m3"],
    ["Xói đầu ngầm", "Gia cố đầu ngầm", "m3"],
    ["Xói cuối ngầm", "Gia cố cuối ngầm", "m3"],
    ["Hư mặt ngầm", "Sửa chữa mặt ngầm", "m2"],
    ["Hư tường cánh", "Sửa chữa tường cánh", "m3"]
  ],
  "Cột mốc GP mặt bằng, lộ giới": [
    ["Mất cột mốc", "Lắp bổ sung cột mốc", "cột"],
    ["Hỏng cột mốc", "Sửa chữa cột mốc", "cột"],
    ["Nghiêng cột mốc", "Chỉnh sửa cột mốc", "cột"],
    ["Mờ số hiệu", "Sơn lại số hiệu", "cột"],
    ["Che khuất cột mốc", "Phát quang cột mốc", "m2"]
  ],
  "Công trình an toàn giao thông": [
    ["Mất biển báo", "Lắp bổ sung biển báo", "cái"],
    ["Hỏng biển báo", "Sửa chữa biển báo", "cái"],
    ["Biển báo nghiêng", "Chỉnh sửa biển báo", "cái"],
    ["Biển báo bị che khuất", "Phát quang biển báo", "m2"],
    ["Mất cọc tiêu", "Lắp bổ sung cọc tiêu", "cột"],
    ["Hỏng cọc tiêu", "Sửa chữa cọc tiêu", "cột"],
    ["Mất cột Km", "Lắp bổ sung cột Km", "cột"],
    ["Hỏng cột Km", "Sửa chữa cột Km", "cột"],
    ["Hỏng hộ lan", "Sửa chữa hộ lan", "m"],
    ["Mất hộ lan", "Lắp bổ sung hộ lan", "m"],
    ["Mờ sơn", "Sơn lại vạch đường", "m2"],
    ["Hỏng gương cầu lồi", "Thay gương cầu lồi", "cái"],
    ["Hỏng cột H", "Sửa chữa cột H", "cột"]
  ],
  "Công trình cầu": [
    ["Hỏng khe co giãn", "Sửa chữa khe co giãn", "m"],
    ["Hỏng mặt cầu", "Sửa chữa mặt cầu", "m2"],
    ["Hỏng lan can cầu", "Sửa chữa lan can cầu", "m"],
    ["Hỏng gờ chắn bánh", "Sửa chữa gờ chắn bánh", "m"],
    ["Xói mố", "Gia cố mố cầu", "m3"],
    ["Xói trụ", "Gia cố trụ cầu", "m3"],
    ["Sạt bờ kè", "Gia cố bờ kè", "m3"],
    ["Lún võng đầu cầu", "Sửa chữa đầu cầu", "m2"],
    ["Đọng nước mặt cầu", "Khơi thông thoát nước mặt cầu", "m"],
    ["Hư ống thoát nước cầu", "Thay ống thoát nước cầu", "cái"],
    ["Hư gối cầu", "Sửa chữa gối cầu", "cái"],
    ["Nứt bản mặt cầu", "Sửa chữa bản mặt cầu", "m2"],
    ["Bong bê tông", "Sửa chữa bê tông cầu", "m2"],
    ["Lộ cốt thép", "Sửa chữa bê tông bảo vệ cốt thép", "m2"],
    ["Hư tường cánh", "Sửa chữa tường cánh", "m3"]
  ]
};

const seenDefaultType = new Set();
for (const [group, list] of Object.entries(GROUP_DEFAULTS)) {
  for (const [inspection, maintenance, unit, method, result, need] of list) {
    if (seenDefaultType.has(inspection)) continue;
    seenDefaultType.add(inspection);
    DEFAULT_TYPE_GROUP[inspection] = group;
    DEFAULT_TYPE_UNIT[inspection] = unit;
    DEFAULT_TYPE_MAINTENANCE[inspection] = maintenance;
    DEFAULT_TYPE_DEADLINE[inspection] = DEFAULT_DEADLINE_DAYS;
    if (need === false) DEFAULT_TYPE_NEED[inspection] = false;
    DEFAULT_QUALITY_CATALOG[inspection] = {
      method: need === false ? "" : method || maintenance,
      result: need === false ? "" : result || GENERIC_RESULT
    };
  }
}

let cache = null;

function normalizeEntry(value) {
  const entry = {
    group: normalizeBaoDuongGroup(value?.group),
    unit: String(value?.unit || "").trim(),
    maintenanceName: String(value?.maintenanceName || "").trim(),
    method: String(value?.method || "").trim(),
    result: String(value?.result || "").trim(),
    priority: String(value?.priority || "").trim().toUpperCase()
  };
  if (
    value?.deadlineDays !== undefined &&
    value?.deadlineDays !== null &&
    value?.deadlineDays !== ""
  ) {
    const n = Number(value.deadlineDays);
    if (Number.isFinite(n)) entry.deadlineDays = n;
  }
  if (
    value?.sortOrder !== undefined &&
    value?.sortOrder !== null &&
    value?.sortOrder !== ""
  ) {
    const n = Number(value.sortOrder);
    if (Number.isFinite(n)) entry.sortOrder = n;
  }
  if (typeof value?.isNeedMaintenance === "boolean") {
    entry.isNeedMaintenance = value.isNeedMaintenance;
  }
  if (typeof value?.isActive === "boolean") {
    entry.isActive = value.isActive;
  }
  return entry;
}

function readStorage() {
  try {
    const key = storageKeyFor();
    let rawText = localStorage.getItem(key);
    // Migrate key cũ (global) → key theo catalogOwnerUid (một lần).
    if (!rawText && activeCatalogOwnerUid) {
      const legacy = localStorage.getItem(STORAGE_KEY);
      if (legacy) {
        try {
          localStorage.setItem(key, legacy);
          localStorage.removeItem(STORAGE_KEY);
          rawText = legacy;
        } catch {
          rawText = legacy;
        }
      }
    }
    const raw = rawText ? JSON.parse(rawText) : null;
    if (!raw || typeof raw !== "object") return {};
    const out = {};
    let needsPersist = false;
    for (const [keyName, val] of Object.entries(raw)) {
      const k = String(keyName || "").trim();
      if (!k) continue;
      const rawGroup = String(val?.group || "").trim();
      const entry = normalizeEntry(val);
      if (rawGroup && entry.group && rawGroup !== entry.group) needsPersist = true;
      out[k] = entry;
    }
    // Ghi lại local khi còn nhóm cũ «Công tác phát cây» → «Nền đường».
    if (needsPersist) {
      try {
        localStorage.setItem(key, JSON.stringify(out));
      } catch {
        /* ignore quota */
      }
    }
    return out;
  } catch {
    return {};
  }
}

function defaultDeadlineDays(key) {
  if (key in DEFAULT_TYPE_DEADLINE) return DEFAULT_TYPE_DEADLINE[key];
  return DEFAULT_DEADLINE_DAYS;
}

function defaultNeedMaintenance(key) {
  if (key in DEFAULT_TYPE_NEED) return DEFAULT_TYPE_NEED[key];
  return true;
}

/** Danh mục đầy đủ = mặc định + chỉnh sửa của người dùng (ghi đè theo key). */
export function loadQualityCatalog() {
  if (cache) return cache;
  const saved = readStorage();
  const merged = {};
  let order = 0;
  for (const [key, val] of Object.entries(DEFAULT_QUALITY_CATALOG)) {
    if (saved[key]?.isActive === false) continue;
    const deadlineDays = defaultDeadlineDays(key);
    merged[key] = {
      group: DEFAULT_TYPE_GROUP[key] || "",
      unit: DEFAULT_TYPE_UNIT[key] || "",
      maintenanceName: DEFAULT_TYPE_MAINTENANCE[key] || "",
      method: val.method || "",
      result: val.result || "",
      priority: priorityFromDeadline(deadlineDays),
      deadlineDays,
      isNeedMaintenance: defaultNeedMaintenance(key),
      sortOrder: order++,
      isActive: true
    };
  }
  for (const [key, val] of Object.entries(saved)) {
    if (val.isActive === false) {
      delete merged[key];
      continue;
    }
    const prev =
      merged[key] || {
        group: "",
        unit: "",
        maintenanceName: "",
        method: "",
        result: "",
        priority: "",
        deadlineDays: defaultDeadlineDays(key),
        isNeedMaintenance: defaultNeedMaintenance(key),
        sortOrder: order++,
        isActive: true
      };
    const deadlineDays =
      val.deadlineDays ?? prev.deadlineDays ?? defaultDeadlineDays(key);
    merged[key] = {
      group:
        normalizeBaoDuongGroup(val.group) ||
        normalizeBaoDuongGroup(prev.group) ||
        DEFAULT_TYPE_GROUP[key] ||
        "",
      unit: val.unit || prev.unit || DEFAULT_TYPE_UNIT[key] || "",
      maintenanceName:
        val.maintenanceName || prev.maintenanceName || DEFAULT_TYPE_MAINTENANCE[key] || "",
      method: val.method || prev.method || "",
      result: val.result || prev.result || "",
      priority: val.priority || prev.priority || priorityFromDeadline(deadlineDays),
      deadlineDays,
      isNeedMaintenance:
        val.isNeedMaintenance ?? prev.isNeedMaintenance ?? defaultNeedMaintenance(key),
      sortOrder: val.sortOrder ?? prev.sortOrder ?? order++,
      isActive: val.isActive ?? prev.isActive ?? true
    };
  }
  cache = merged;
  return cache;
}

function entryHasData(entry) {
  return Boolean(
    entry.group ||
      entry.unit ||
      entry.maintenanceName ||
      entry.method ||
      entry.result ||
      entry.priority ||
      entry.deadlineDays !== undefined ||
      entry.isNeedMaintenance !== undefined ||
      entry.isActive !== undefined ||
      entry.sortOrder !== undefined
  );
}

function buildCleanCatalog(catalog) {
  const clean = {};
  for (const [key, val] of Object.entries(catalog || {})) {
    const k = String(key || "").trim();
    if (!k) continue;
    const entry = normalizeEntry(val);
    if (!entryHasData(entry)) continue;
    clean[k] = entry;
  }
  return clean;
}

function dispatchQualityChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(BAO_DUONG_QUALITY_EVENT));
  }
}

/** Phần override đang lưu local — dùng khi đẩy lên cloud. */
export function getQualityCatalogOverrides() {
  return readStorage();
}

/**
 * Snapshot danh mục builtin (GROUP_DEFAULTS) — dùng seed khi chưa có mẫu hệ thống.
 * Không gồm tombstone isActive:false.
 */
export function buildBuiltinSeedCatalog() {
  const out = {};
  let order = 0;
  for (const [key, val] of Object.entries(DEFAULT_QUALITY_CATALOG)) {
    const deadlineDays = defaultDeadlineDays(key);
    out[key] = {
      group: DEFAULT_TYPE_GROUP[key] || "",
      unit: DEFAULT_TYPE_UNIT[key] || "",
      maintenanceName: DEFAULT_TYPE_MAINTENANCE[key] || "",
      method: val.method || "",
      result: val.result || "",
      priority: priorityFromDeadline(deadlineDays),
      deadlineDays,
      isNeedMaintenance: defaultNeedMaintenance(key),
      sortOrder: order++,
      isActive: true
    };
  }
  return out;
}

/**
 * Catalog sạch để seed công ty mới: ưu tiên overrides local (đã sync),
 * không thì snapshot builtin.
 */
export function getCatalogSnapshotForSeed() {
  const overrides = buildCleanCatalog(readStorage());
  const active = {};
  for (const [key, val] of Object.entries(overrides)) {
    if (val.isActive === false) continue;
    active[key] = val;
  }
  if (Object.keys(active).length > 0) return active;
  return buildBuiltinSeedCatalog();
}

/**
 * Áp danh mục từ cloud vào localStorage.
 * Cloud là SSOT khi có dữ liệu — không giữ local cũ chặn tên mới (USER cùng máy).
 * Chỉ bỏ qua khi cloud trống mà local đang có dữ liệu.
 */
export function applyRemoteQualityCatalog(catalog, remoteUpdatedAtMs = 0) {
  const clean = buildCleanCatalog(catalog);
  const prev = readStorage();
  const remoteAt = Number(remoteUpdatedAtMs) || 0;
  const cleanEmpty = Object.keys(clean).length === 0;
  const prevEmpty = Object.keys(prev).length === 0;

  if (cleanEmpty && !prevEmpty) {
    return false;
  }

  if (JSON.stringify(prev) === JSON.stringify(clean)) {
    if (remoteAt > 0) setLocalUpdatedAt(Math.max(getLocalUpdatedAt(), remoteAt));
    return false;
  }
  localStorage.setItem(storageKeyFor(), JSON.stringify(clean));
  setLocalUpdatedAt(remoteAt > 0 ? remoteAt : Date.now());
  cache = null;
  loadQualityCatalog();
  dispatchQualityChanged();
  return true;
}

export function saveQualityCatalog(catalog) {
  const clean = buildCleanCatalog(catalog);
  localStorage.setItem(storageKeyFor(), JSON.stringify(clean));
  setLocalUpdatedAt(Date.now());
  cache = null;
  loadQualityCatalog();
  dispatchQualityChanged();
}

/** Gắn cờ ẩn cho loại đã xóa khỏi bảng (tránh merge lại từ danh mục mặc định). */
export function withDeletedCatalogTombstones(catalog, activeTypes) {
  const active = new Set(
    (activeTypes || []).map((t) => String(t || "").trim()).filter(Boolean)
  );
  const out = { ...(catalog || {}) };
  const known = new Set([
    ...Object.keys(DEFAULT_QUALITY_CATALOG),
    ...Object.keys(readStorage())
  ]);
  known.forEach((key) => {
    if (!active.has(key)) out[key] = { isActive: false };
  });
  return out;
}

export function isQualityTypeHidden(type) {
  const key = String(type || "").trim();
  if (!key) return false;
  return readStorage()[key]?.isActive === false;
}

export function resetQualityCatalog() {
  try {
    localStorage.removeItem(storageKeyFor());
    localStorage.removeItem(metaKeyFor());
    // Xóa luôn key legacy nếu còn.
    if (!activeCatalogOwnerUid) localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  setLocalUpdatedAt(Date.now());
  cache = null;
  loadQualityCatalog();
  dispatchQualityChanged();
}

export function getQualityForType(type) {
  const catalog = loadQualityCatalog();
  const key = String(type || "").trim();
  return catalog[key] || DEFAULT_QUALITY_FALLBACK;
}

export function listQualityTypes() {
  return Object.keys(loadQualityCatalog());
}

export function getGroupForType(type) {
  const key = String(type || "").trim();
  return normalizeBaoDuongGroup(loadQualityCatalog()[key]?.group || "");
}

/** Đơn vị tính của một loại công việc (theo danh mục, fallback mặc định). */
export function getUnitForType(type) {
  const key = String(type || "").trim();
  if (!key) return "";
  return loadQualityCatalog()[key]?.unit || DEFAULT_TYPE_UNIT[key] || "";
}

/** Alias loại tuần đường (master data / tên dài) → khóa danh mục. */
const INSPECTION_TYPE_ALIASES = {
  "Hư hỏng lớp móng mặt đường": "Hư hỏng lớp móng",
  "Cỏ lề cao": "Cỏ mọc",
  "Cỏ lề": "Cỏ mọc",
  "Cỏ vai đường": "Cỏ mọc"
};

function normalizeTypeLookupKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function allInspectionTypeKeys() {
  return new Set([
    ...Object.keys(loadQualityCatalog()),
    ...Object.keys(DEFAULT_TYPE_MAINTENANCE),
    ...Object.keys(DEFAULT_QUALITY_CATALOG)
  ]);
}

/** Đọc cột «Công việc BDTX» (maintenanceName) theo khóa loại tuần đường. */
function maintenanceNameOfKey(catalogKey) {
  return (
    String(
      loadQualityCatalog()[catalogKey]?.maintenanceName ||
        DEFAULT_TYPE_MAINTENANCE[catalogKey] ||
        ""
    ).trim() || ""
  );
}

function stripXuLyPrefix(value) {
  return String(value || "")
    .trim()
    .replace(/^xử\s*lý\s+/i, "")
    .trim();
}

function lookupMaintenanceByNormalized(norm) {
  if (!norm) return "";
  for (const k of allInspectionTypeKeys()) {
    if (normalizeTypeLookupKey(k) === norm) {
      const name = maintenanceNameOfKey(k);
      if (name) return name;
    }
    const alias = INSPECTION_TYPE_ALIASES[k];
    if (alias && normalizeTypeLookupKey(alias) === norm) {
      const name = maintenanceNameOfKey(alias);
      if (name) return name;
    }
  }
  for (const [from, to] of Object.entries(INSPECTION_TYPE_ALIASES)) {
    if (normalizeTypeLookupKey(from) === norm) {
      const name = maintenanceNameOfKey(to);
      if (name) return name;
    }
  }
  return "";
}

const TYPE_STOPWORDS = new Set([
  "co",
  "va",
  "cua",
  "trong",
  "tren",
  "la",
  "duoc",
  "chua",
  "dam",
  "bao",
  "voi",
  "cho",
  "mot",
  "cac",
  "nay",
  "khi",
  "bi",
  "ra",
  "vao",
  "tai",
  "den",
  "tu",
  "nen",
  "duong",
  "mat",
  "hang",
  "muc"
]);

function significantTokens(norm) {
  return String(norm || "")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !TYPE_STOPWORDS.has(t));
}

/**
 * Khớp loại tuần đường (tên dài / master data) với hàng danh mục:
 * lấy cột Công việc BDTX của hàng khớp tốt nhất.
 */
function fuzzyCatalogMaintenanceName(norm) {
  if (!norm || norm.length < 4) return "";
  const typeTokens = significantTokens(norm);
  if (!typeTokens.length) return "";
  const typeSet = new Set(typeTokens);

  let bestKey = "";
  let bestScore = 0;
  let bestLen = 0;

  for (const k of allInspectionTypeKeys()) {
    const kn = normalizeTypeLookupKey(k);
    if (kn.length < 4) continue;
    let score = 0;
    if (kn === norm) {
      score = kn.length + 40;
    } else if (norm.includes(kn) || kn.includes(norm)) {
      const keyTokens = significantTokens(kn);
      const extra = typeTokens.filter((t) => !keyTokens.includes(t)).length;
      if (extra > 1 && kn.length < 12) continue;
      score = kn.length + 20;
    } else {
      const keyTokens = significantTokens(kn);
      if (!keyTokens.length) continue;
      const overlap = keyTokens.filter((t) => typeSet.has(t)).length;
      const coverage = overlap / keyTokens.length;
      if (keyTokens.length <= 2 && coverage < 1) continue;
      if (keyTokens.length >= 3 && overlap < keyTokens.length) continue;
      if (overlap < 3 && coverage < 0.85) continue;
      score = overlap * 10 + coverage * 5;
    }
    if (score > bestScore || (score === bestScore && kn.length > bestLen)) {
      bestScore = score;
      bestLen = kn.length;
      bestKey = k;
    }
  }
  return bestKey ? maintenanceNameOfKey(bestKey) : "";
}

/** Tên công việc bảo dưỡng (BDTX) — đúng cột «Công việc BDTX» theo khóa loại tuần đường. */
export function getMaintenanceNameForType(type) {
  const key = String(type || "").trim();
  if (!key) return "";

  const variants = [key, stripXuLyPrefix(key)].filter(
    (v, i, arr) => v && arr.indexOf(v) === i
  );

  for (const variant of variants) {
    const direct = maintenanceNameOfKey(variant);
    if (direct) return direct;

    const alias = INSPECTION_TYPE_ALIASES[variant];
    if (alias) {
      const viaAlias = maintenanceNameOfKey(alias);
      if (viaAlias) return viaAlias;
    }

    const byNorm = lookupMaintenanceByNormalized(normalizeTypeLookupKey(variant));
    if (byNorm) return byNorm;
  }

  // Đã là giá trị cột Công việc BDTX → giữ nguyên (ô HĐ / combobox).
  for (const variant of variants) {
    const lower = normalizeTypeLookupKey(variant);
    for (const k of allInspectionTypeKeys()) {
      const maint = maintenanceNameOfKey(k);
      if (maint && normalizeTypeLookupKey(maint) === lower) return maint;
    }
  }

  for (const variant of variants) {
    const fuzzy = fuzzyCatalogMaintenanceName(normalizeTypeLookupKey(variant));
    if (fuzzy) return fuzzy;
  }

  return "";
}

/** Số ngày phải xử lý của loại công việc (deadline đưa vào sổ BDTX). */
export function getDeadlineDaysForType(type) {
  const key = String(type || "").trim();
  if (!key) return DEFAULT_DEADLINE_DAYS;
  const entry = loadQualityCatalog()[key];
  if (entry && entry.deadlineDays !== undefined && entry.deadlineDays !== null) {
    return entry.deadlineDays;
  }
  return defaultDeadlineDays(key);
}

/** Loại công việc này có sinh công việc BDTX hay không. */
export function needMaintenanceForType(type) {
  const key = String(type || "").trim();
  if (!key) return true;
  const entry = loadQualityCatalog()[key];
  if (entry && typeof entry.isNeedMaintenance === "boolean") {
    return entry.isNeedMaintenance;
  }
  return defaultNeedMaintenance(key);
}

/** { nhóm: [loại công việc] } theo danh mục hiện tại. */
export function getTypesByGroup() {
  const out = {};
  for (const g of BAO_DUONG_GROUPS) {
    out[g] = listTypesForGroup(g);
  }
  return out;
}

/** Nhóm hạng mục dùng danh mục MASTER DATA (BDTX). */
export function isMasterDataSection(section) {
  return BAO_DUONG_GROUPS.includes(normalizeBaoDuongGroup(section));
}

/**
 * Loại công việc cho form nhập liệu — ưu tiên MASTER DATA (thứ tự, ẩn đã xóa).
 * extraTypes: loại cũ trên sổ / Firebase bổ sung cuối danh sách nếu chưa có.
 */
export function listFormTypesForSection(section, extraTypes = []) {
  const g = normalizeBaoDuongGroup(section);
  if (!g) return [];

  if (!isMasterDataSection(g)) {
    const seen = new Set();
    const out = [];
    (extraTypes || []).forEach((t) => {
      const key = String(t || "").trim();
      if (key && !seen.has(key)) {
        seen.add(key);
        out.push(key);
      }
    });
    return out;
  }

  const fromCatalog = listTypesForGroup(g);
  const seen = new Set(fromCatalog);
  const tail = [];
  (extraTypes || []).forEach((t) => {
    const key = String(t || "").trim();
    if (!key || seen.has(key) || isQualityTypeHidden(key)) return;
    seen.add(key);
    tail.push(key);
  });
  return [...fromCatalog, ...tail];
}

/** Danh sách loại công việc (đang dùng) thuộc một nhóm — để đổ vào form nhập liệu. */
export function listTypesForGroup(group) {
  const g = normalizeBaoDuongGroup(group);
  if (!g) return [];
  return Object.entries(loadQualityCatalog())
    .filter(
      ([, val]) => normalizeBaoDuongGroup(val.group) === g && val.isActive !== false
    )
    .sort((a, b) => {
      const sa = a[1].sortOrder ?? 0;
      const sb = b[1].sortOrder ?? 0;
      if (sa !== sb) return sa - sb;
      return a[0].localeCompare(b[0], "vi");
    })
    .map(([type]) => type);
}

/**
 * Đầu việc sổ bảo dưỡng (tên công việc BDTX / maintenanceName) theo hạng mục.
 * Không dùng tên loại tuần đường / sổ nhật ký.
 */
export function listMaintenanceWorksForGroup(group) {
  const g = normalizeBaoDuongGroup(group);
  if (!g) return [];
  const seen = new Set();
  const out = [];
  for (const [type, val] of Object.entries(loadQualityCatalog())) {
    if (normalizeBaoDuongGroup(val.group) !== g || val.isActive === false) continue;
    const name = String(val.maintenanceName || type || "").trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out.sort((a, b) => a.localeCompare(b, "vi"));
}

/** Tất cả đầu việc BDTX theo hạng mục — dùng combobox khi chưa chọn hạng mục. */
export function getMaintenanceWorksByGroup() {
  const out = {};
  for (const g of BAO_DUONG_GROUPS) {
    out[g] = listMaintenanceWorksForGroup(g);
  }
  return out;
}

/** Đơn vị theo tên đầu việc BDTX (hoặc loại tuần đường nếu trùng key). */
export function getUnitForMaintenanceWork(workName) {
  const name = String(workName || "").trim();
  if (!name) return "";
  const catalog = loadQualityCatalog();
  if (catalog[name]?.unit) return catalog[name].unit;
  for (const val of Object.values(catalog)) {
    if (String(val.maintenanceName || "").trim() === name && val.unit) {
      return val.unit;
    }
  }
  return DEFAULT_TYPE_UNIT[name] || "";
}

/** Hạng mục (nhóm) theo tên đầu việc BDTX. */
export function getGroupForMaintenanceWork(workName) {
  const name = String(workName || "").trim();
  if (!name) return "";
  const catalog = loadQualityCatalog();
  if (catalog[name]?.group) return normalizeBaoDuongGroup(catalog[name].group);
  for (const val of Object.values(catalog)) {
    if (String(val.maintenanceName || "").trim() === name && val.group) {
      return normalizeBaoDuongGroup(val.group);
    }
  }
  return DEFAULT_TYPE_GROUP[name] || "";
}

/** Nhãn đầu việc thống kê KL: cột «Công việc BDTX» trên danh mục; không có thì giữ tên tuần đường. */
export function resolveMaintenanceWorkLabel(inspectionOrWork) {
  const key = String(inspectionOrWork || "").trim();
  if (!key) return "";
  return getMaintenanceNameForType(key) || key;
}

/** Loại công việc đã có nhận xét chuẩn (mặc định hoặc tự khai báo) hay chưa. */
export function hasQualityForType(type) {
  const key = String(type || "").trim();
  if (!key) return true;
  const entry = loadQualityCatalog()[key];
  return Boolean(entry && (entry.method || entry.result));
}

/** Thêm/cập nhật một vài loại vào danh mục mà không xoá các loại đã lưu. */
export function upsertQualityTypes(partial) {
  const saved = readStorage();
  let changed = false;
  for (const [key, val] of Object.entries(partial || {})) {
    const k = String(key || "").trim();
    if (!k) continue;
    const entry = normalizeEntry(val);
    if (!entryHasData(entry)) continue;
    saved[k] = entry;
    changed = true;
  }
  if (!changed) return;
  localStorage.setItem(storageKeyFor(), JSON.stringify(saved));
  setLocalUpdatedAt(Date.now());
  cache = null;
  loadQualityCatalog();
  dispatchQualityChanged();
}
