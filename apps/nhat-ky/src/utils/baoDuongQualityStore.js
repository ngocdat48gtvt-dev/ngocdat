/**
 * Danh mục biện pháp & nhận xét kết quả BDTX theo từng loại công việc.
 * Mặc định kèm sẵn; người dùng chỉnh trong tab "Dữ liệu BDTX" và lưu ở localStorage
 * để đồng nhất, tự sinh khi công việc đó xuất hiện trong sổ BDTX.
 */

const STORAGE_KEY = "baoduong-quality-catalog-v1";
export const BAO_DUONG_QUALITY_EVENT = "baoduong-quality-changed";

/** Nhóm công việc — khớp các mục nhập liệu (hạng mục sổ tuần đường). */
export const BAO_DUONG_GROUPS = [
  "Mặt đường",
  "Nền đường",
  "Lề đường",
  "Cống, rãnh thoát nước",
  "Ngầm, tràn (lũ, ngập)",
  "Cột mốc GP mặt bằng, lộ giới",
  "Công trình an toàn giao thông",
  "Công tác phát cây",
  "Công trình cầu"
];

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
    ["Ngập nền đường", "Khơi thông thoát nước nền đường", "m"]
  ],
  "Lề đường": [
    ["Lề cao", "Hạ lề đường", "m3"],
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
  "Công tác phát cây": [
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
    group: String(value?.group || "").trim(),
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
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!raw || typeof raw !== "object") return {};
    const out = {};
    for (const [key, val] of Object.entries(raw)) {
      const k = String(key || "").trim();
      if (!k) continue;
      out[k] = normalizeEntry(val);
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
      group: val.group || prev.group || "",
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

export function saveQualityCatalog(catalog) {
  const clean = {};
  for (const [key, val] of Object.entries(catalog || {})) {
    const k = String(key || "").trim();
    if (!k) continue;
    const entry = normalizeEntry(val);
    if (!entryHasData(entry)) continue;
    clean[k] = entry;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
  cache = null;
  loadQualityCatalog();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(BAO_DUONG_QUALITY_EVENT));
  }
}

export function resetQualityCatalog() {
  localStorage.removeItem(STORAGE_KEY);
  cache = null;
  loadQualityCatalog();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(BAO_DUONG_QUALITY_EVENT));
  }
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
  return loadQualityCatalog()[key]?.group || "";
}

/** Đơn vị tính của một loại công việc (theo danh mục, fallback mặc định). */
export function getUnitForType(type) {
  const key = String(type || "").trim();
  if (!key) return "";
  return loadQualityCatalog()[key]?.unit || DEFAULT_TYPE_UNIT[key] || "";
}

/** Tên công việc bảo dưỡng (BDTX) tương ứng công việc tuần đường. */
export function getMaintenanceNameForType(type) {
  const key = String(type || "").trim();
  if (!key) return "";
  return loadQualityCatalog()[key]?.maintenanceName || DEFAULT_TYPE_MAINTENANCE[key] || "";
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
  for (const [type, val] of Object.entries(loadQualityCatalog())) {
    const g = val.group || "";
    if (!g) continue;
    if (!out[g]) out[g] = [];
    out[g].push(type);
  }
  for (const g of Object.keys(out)) {
    out[g].sort((a, b) => a.localeCompare(b, "vi"));
  }
  return out;
}

/** Danh sách loại công việc (đang dùng) thuộc một nhóm — để đổ vào form nhập liệu. */
export function listTypesForGroup(group) {
  const g = String(group || "").trim();
  if (!g) return [];
  return Object.entries(loadQualityCatalog())
    .filter(([, val]) => val.group === g && val.isActive !== false)
    .sort((a, b) => {
      const sa = a[1].sortOrder ?? 0;
      const sb = b[1].sortOrder ?? 0;
      if (sa !== sb) return sa - sb;
      return a[0].localeCompare(b[0], "vi");
    })
    .map(([type]) => type);
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  cache = null;
  loadQualityCatalog();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(BAO_DUONG_QUALITY_EVENT));
  }
}
