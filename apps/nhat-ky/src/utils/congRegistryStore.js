/**
 * Hồ sơ quản lý cống (theo hồ sơ quản lý đường) — biểu thống kê cống các loại.
 * Lưu localStorage theo uid+roadId (+ routeId) và đồng bộ Firestore
 * users/{uid}/master_data/cong_registry.
 *
 * App tuần đường / form nhập nhanh dùng: { km, type, length }.
 * Các field chi tiết (khẩu độ, kết cấu, chiều dài theo loại…) được giữ thêm;
 * type + length luôn được suy ra khi normalize để tương thích ngược.
 */

import { normalizeKmInput } from "./nhatKyFormat";
import { formatBookDecimal } from "./bookNumberFormat";
import { filterAssetsForRoute, assetMatchesRoute } from "./roadsCatalog";

const LEGACY_KEY = "cong-registry-v1";
export const CONG_REGISTRY_EVENT = "cong-registry-changed";

export const CONG_GROUP_HIEN_TRANG = "hien_trang";
export const CONG_GROUP_HU_HONG = "hu_hong";

/** Cột chiều dài theo loại (một dòng chỉ điền 1 cột). */
export const CONG_LEN_FIELDS = [
  { key: "lenTron", label: "Tròn", typeLabel: "Cống tròn", summary: "Cống tròn" },
  { key: "lenHop", label: "Hộp", typeLabel: "Cống hộp", summary: "Cống hộp" },
  { key: "lenBan", label: "Bản", typeLabel: "Cống bản", summary: "Cống bản" },
  { key: "lenVom", label: "Vòm", typeLabel: "Cống vòm", summary: "Cống vòm" },
  { key: "lenDaKhan", label: "Đ. Khan", typeLabel: "Cống Đ. khan", summary: "Cống Đ. khan" },
  { key: "lenKhac", label: "Khác", typeLabel: "Cống khác", summary: "Cống khác" }
];

let ridSeq = 0;
function nextId() {
  ridSeq += 1;
  return `cong_${Date.now().toString(36)}_${ridSeq}`;
}

function str(v) {
  return String(v ?? "").trim();
}

function storageKeyFor(scope) {
  const s = String(scope || "").trim();
  return s ? `cong-registry-v2-${s}` : LEGACY_KEY;
}

/** Scope đã từng được ghi vào localStorage (kể cả mảng rỗng sau «Xoá hết»). */
export function hasCongRegistryStored(scope) {
  const key = storageKeyFor(scope);
  try {
    return localStorage.getItem(key) != null;
  } catch {
    return false;
  }
}

export function congScope(uid, roadId, routeId = "") {
  const u = String(uid || "").trim();
  const r = String(roadId || "").trim();
  const rt = String(routeId || "").trim();
  if (!u || !r) return "";
  return rt ? `${u}__${r}__rt_${rt}` : `${u}__${r}`;
}

export function resolveCongScope(uid, roadId, routeId, routes = []) {
  const list = Array.isArray(routes) ? routes : [];
  const multi = list.length > 1;
  const rid = String(routeId || list[0]?.id || "").trim();
  if (multi && rid) return congScope(uid, roadId, rid);
  return congScope(uid, roadId);
}

/** Sổ cũ (1 list chung) → tách theo km vào từng nhánh; không còn nhét hết vào nhánh đầu. */
export function migrateBookCongToFirstRoute(uid, roadId, routes = []) {
  const list = Array.isArray(routes) ? routes : [];
  if (!uid || !roadId || list.length <= 1) return;
  const bookScope = congScope(uid, roadId);
  const bookList = loadCongRegistry(bookScope);
  if (!bookList.length) return;

  for (const route of list) {
    const rid = String(route?.id || "").trim();
    if (!rid) continue;
    const routeScope = congScope(uid, roadId, rid);
    // Đã có key nhánh (kể cả đã xoá hết) → không migrate đè lại
    if (hasCongRegistryStored(routeScope)) continue;
    if (loadCongRegistry(routeScope).length) continue;
    const filtered = filterAssetsForRoute(bookList, route, list).map((e) => ({
      ...e,
      routeId: rid
    }));
    if (filtered.length) setCongRegistry(routeScope, filtered);
  }
  setCongRegistry(bookScope, []);
}

/**
 * Lọc danh sách cống theo nhánh đang chọn (routeId hoặc lý trình trong đoạn km).
 * Nếu scope nhánh đã từng ghi (kể cả []) → dùng làm nguồn đúng, không gộp lại từ sổ cũ.
 * Chỉ gộp pool khi nhánh chưa có dữ liệu lưu (lần đầu tách từ sổ chung).
 */
export function loadCongRegistryForRoute(uid, roadId, route, routes = []) {
  const list = Array.isArray(routes) ? routes : [];
  const multi = list.length > 1;
  const rid = String(route?.id || "").trim();
  const scope = resolveCongScope(uid, roadId, rid, list);
  let items = loadCongRegistry(scope);
  if (!multi || !route) return items;
  // Đã lưu riêng nhánh (xoá hết / lưu hồ sơ) → không merge lại từ book/nhánh khác
  if (hasCongRegistryStored(scope)) return items;

  const pool = [];
  const seen = new Set();
  const pushAll = (arr) => {
    for (const e of arr || []) {
      const id = String(e?.id || "").trim();
      const key = id || `${e?.km || ""}|${e?.type || ""}|${e?.aperture || ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pool.push(e);
    }
  };
  pushAll(items);
  pushAll(loadCongRegistry(congScope(uid, roadId)));
  for (const r of list) {
    const id = String(r?.id || "").trim();
    if (!id) continue;
    pushAll(loadCongRegistry(congScope(uid, roadId, id)));
  }
  return filterAssetsForRoute(pool, route, list);
}

/**
 * Ghi danh sách cống cho nhánh đang chọn và gỡ bản trùng khỏi sổ cũ / nhánh khác
 * (tránh xoá rồi lại hiện vì merge hoặc migrate).
 */
export function replaceCongRegistryForRoute(uid, roadId, route, routes = [], list = []) {
  const routeList = Array.isArray(routes) ? routes : [];
  const scope = writeCongScope(uid, roadId, route?.id || "", routeList);
  const clean = saveCongRegistry(scope, list);
  if (routeList.length > 1 && route) {
    purgeCongAssetsMatchingRoute(uid, roadId, route, routeList, {
      exceptScope: scope
    });
  }
  return clean;
}

/** Xoá khỏi sổ cũ + nhánh khác mọi cống thuộc nhánh đang chọn. */
export function purgeCongAssetsMatchingRoute(
  uid,
  roadId,
  route,
  routes = [],
  { exceptScope = "" } = {}
) {
  const routeList = Array.isArray(routes) ? routes : [];
  if (!uid || !roadId || !route || routeList.length <= 1) return;

  const skip = String(exceptScope || "").trim();
  const targets = [congScope(uid, roadId)];
  for (const r of routeList) {
    const id = String(r?.id || "").trim();
    if (!id) continue;
    targets.push(congScope(uid, roadId, id));
  }

  for (const scope of targets) {
    if (!scope || scope === skip) continue;
    if (!hasCongRegistryStored(scope) && !loadCongRegistry(scope).length) continue;
    const cur = loadCongRegistry(scope);
    const next = cur.filter((e) => !assetMatchesRoute(e, route, routeList));
    if (next.length !== cur.length) setCongRegistry(scope, next);
  }
}

export function writeCongScope(uid, roadId, routeId, routes = []) {
  const list = Array.isArray(routes) ? routes : [];
  const multi = list.length > 1;
  const rid = String(routeId || list[0]?.id || "").trim();
  if (multi && rid) return congScope(uid, roadId, rid);
  return congScope(uid, roadId);
}

const cacheByKey = new Map();

function guessLenKeyFromType(type) {
  const t = str(type)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (!t) return "lenKhac";
  if (/tron/.test(t)) return "lenTron";
  if (/hop/.test(t)) return "lenHop";
  if (/ban/.test(t)) return "lenBan";
  if (/vom/.test(t)) return "lenVom";
  if (/khan/.test(t)) return "lenDaKhan";
  // Khẩu độ dạng D100 / φ100 thường là cống tròn
  if (/^(d|phi|ø|o)\s*\d+/.test(t) || /^d\d+/.test(t)) return "lenTron";
  return "lenKhac";
}

/** Cột nhập trên lưới (thứ tự giống Excel, không gồm STT). */
export const CONG_GRID_FIELDS = [
  "km",
  "aperture",
  "body",
  "headUp",
  "headDown",
  "lenTron",
  "lenHop",
  "lenBan",
  "lenVom",
  "lenDaKhan",
  "lenKhac",
  "load",
  "yearBuilt",
  "condition"
];

export const CONG_CONDITION_OPTIONS = [
  "Tốt",
  "Trung bình",
  "Kém",
  "Hư hỏng",
  "Đã sửa chữa",
  "Cần bổ sung",
  "Mới bổ sung"
];

function looksLikeKm(value) {
  const s = str(value);
  if (!s) return false;
  if (/^km\s*\d/i.test(s)) return true;
  if (/^\d{1,4}\s*\+\s*\d{1,4}$/.test(s)) return true;
  if (/^\d{5,7}$/.test(s)) return true;
  return false;
}

function isCongHeaderOrSectionRow(cells) {
  const joined = cells.map(str).join(" ").toLowerCase();
  if (!joined.trim()) return true;
  if (/stt/.test(joined) && /ly\s*trinh|lý\s*trình/.test(joined)) return true;
  if (/khau\s*do|khẩu\s*độ/.test(joined) && /ket\s*cau|kết\s*cấu/.test(joined)) return true;
  if (/chieu\s*dai|chiều\s*dài/.test(joined) && /tron|tròn|hop|hộp/.test(joined)) return true;
  const first = str(cells[0]).toLowerCase();
  const second = str(cells[1]).toLowerCase();
  const probe = `${first} ${second}`;
  if (/^(i|ii|iii)[\s.\-–—]*$/.test(first)) return true;
  if (/hien\s*trang|hiện\s*trạng|hu\s*hong|hư\s*hỏng|bo\s*sung|bổ\s*sung|tong|tổng/.test(probe)) {
    // Dòng nhãn mục (vd cột B = "Hiện trạng") — không phải lý trình
    if (!looksLikeKm(cells[0]) && !looksLikeKm(cells[1])) return true;
  }
  return false;
}

function detectSectionGroup(cells) {
  const joined = cells.map(str).join(" ").toLowerCase();
  if (/hu\s*hong|hư\s*hỏng|bo\s*sung|bổ\s*sung/.test(joined)) return CONG_GROUP_HU_HONG;
  if (/hien\s*trang|hiện\s*trạng/.test(joined)) return CONG_GROUP_HIEN_TRANG;
  return null;
}

/** Bỏ cột STT nếu có; trả về mảng field theo CONG_GRID_FIELDS. */
export function normalizeCongExcelCells(cells) {
  let cols = (Array.isArray(cells) ? cells : []).map((c) => str(c));
  if (!cols.length) return [];
  // STT số ở cột đầu + lý trình ở cột 2
  if (/^\d+\.?$/.test(cols[0]) && looksLikeKm(cols[1])) {
    cols = cols.slice(1);
  }
  // Đôi khi copy cả cột trống cuối
  while (cols.length > CONG_GRID_FIELDS.length) {
    const last = cols[cols.length - 1];
    if (!last) cols.pop();
    else break;
  }
  return cols;
}

function rowFromGridCells(cols, { group = CONG_GROUP_HIEN_TRANG, id } = {}) {
  const values = {};
  CONG_GRID_FIELDS.forEach((field, i) => {
    values[field] = cols[i] ?? "";
  });
  if (!values.group) values.group = group;
  return normalizeCongEntry({ ...values, id: id || nextId() });
}

/** Lấy cột chiều dài đang có giá trị (ưu tiên cột mới → length cũ). */
export function pickCongLengthField(entry) {
  for (const { key, typeLabel, label } of CONG_LEN_FIELDS) {
    const v = str(entry?.[key]);
    if (v) return { key, value: v, typeLabel, label };
  }
  const legacyLen = str(entry?.length);
  if (legacyLen) {
    const key = guessLenKeyFromType(entry?.type);
    const meta = CONG_LEN_FIELDS.find((f) => f.key === key) || CONG_LEN_FIELDS[5];
    return { key: meta.key, value: legacyLen, typeLabel: meta.typeLabel, label: meta.label };
  }
  return null;
}

/** Nhãn loại cống cho UI / app tuần đường. */
export function formatCongTypeLabel(entry) {
  const picked = pickCongLengthField(entry);
  const aperture = str(entry?.aperture);
  const legacyType = str(entry?.type);
  if (picked) {
    const base = picked.typeLabel;
    if (aperture) return `${base} ${aperture}`.trim();
    // Giữ type cũ nếu đã có mô tả chi tiết hơn (vd Cống tròn D100)
    if (legacyType && legacyType.toLowerCase().includes(picked.label.toLowerCase())) {
      return legacyType;
    }
    return base;
  }
  if (legacyType) return aperture ? `${legacyType} ${aperture}`.trim() : legacyType;
  return aperture ? `Cống ${aperture}` : "";
}

export function resolveCongLength(entry) {
  return pickCongLengthField(entry)?.value || str(entry?.length);
}

function emptyLenFields() {
  const o = {};
  for (const { key } of CONG_LEN_FIELDS) o[key] = "";
  return o;
}

function migrateLensFromLegacy(entry) {
  const lens = emptyLenFields();
  let hasAny = false;
  for (const { key } of CONG_LEN_FIELDS) {
    const v = str(entry?.[key]);
    if (v) {
      lens[key] = v;
      hasAny = true;
    }
  }
  if (!hasAny) {
    const legacyLen = str(entry?.length);
    if (legacyLen) {
      const key = guessLenKeyFromType(entry?.type || entry?.aperture);
      lens[key] = legacyLen;
    }
  }
  // Dữ liệu cũ: khẩu độ D100 mà chiều dài nằm nhầm cột Khác → đưa về Tròn
  const onlyKhac =
    lens.lenKhac &&
    !lens.lenTron &&
    !lens.lenHop &&
    !lens.lenBan &&
    !lens.lenVom &&
    !lens.lenDaKhan;
  if (onlyKhac) {
    const tip = str(entry?.aperture || entry?.type);
    if (/^(d|phi|ø|o)\s*\d+/i.test(tip) || /\btron\b/i.test(tip.toLowerCase())) {
      lens.lenTron = lens.lenKhac;
      lens.lenKhac = "";
    }
  }
  return lens;
}

function normalizeGroup(g) {
  const s = str(g);
  if (s === CONG_GROUP_HU_HONG || /hu\s*hong|hư\s*hỏng|bo\s*sung/i.test(s)) {
    return CONG_GROUP_HU_HONG;
  }
  return CONG_GROUP_HIEN_TRANG;
}

export function normalizeCongEntry(entry) {
  const lens = migrateLensFromLegacy(entry);
  const base = {
    id: entry?.id || nextId(),
    km: str(entry?.km),
    aperture: str(entry?.aperture ?? entry?.khauDo),
    body: str(entry?.body ?? entry?.thanCong),
    headUp: str(entry?.headUp ?? entry?.dauThuongLuu),
    headDown: str(entry?.headDown ?? entry?.dauHaLuu),
    ...lens,
    load: str(entry?.load ?? entry?.taiTrong),
    yearBuilt: str(entry?.yearBuilt ?? entry?.namXayDung),
    condition: str(entry?.condition ?? entry?.tinhTrang),
    /* Trạng thái xuất từ sổ tuần đường (hu_hong | sua_chua | bo_sung) */
    opStatus: str(entry?.opStatus),
    opStatusAt: str(entry?.opStatusAt),
    opStatusDetail: str(entry?.opStatusDetail),
    opStatusQuantity: str(entry?.opStatusQuantity),
    group: normalizeGroup(entry?.group)
  };
  const type = formatCongTypeLabel({ ...base, type: entry?.type });
  const length = resolveCongLength(base);
  return { ...base, type, length };
}

function normalize(entry) {
  return normalizeCongEntry(entry);
}

function entryHasData(e) {
  if (!e) return false;
  if (e.km || e.type || e.length || e.aperture || e.body || e.headUp || e.headDown) return true;
  if (e.load || e.yearBuilt || e.condition) return true;
  return CONG_LEN_FIELDS.some(({ key }) => str(e[key]));
}

function readKey(key) {
  try {
    const raw = JSON.parse(localStorage.getItem(key));
    if (Array.isArray(raw)) return raw.map(normalize);
  } catch {
    /* ignore */
  }
  return [];
}

function emitChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CONG_REGISTRY_EVENT));
  }
}

export function loadCongRegistry(scope) {
  const key = storageKeyFor(scope);
  if (cacheByKey.has(key)) return cacheByKey.get(key);
  const list = readKey(key);
  cacheByKey.set(key, list);
  return list;
}

export function loadLegacyCongRegistry() {
  return readKey(LEGACY_KEY);
}

export function saveCongRegistry(scope, list) {
  const key = storageKeyFor(scope);
  const clean = (Array.isArray(list) ? list : []).map(normalize).filter(entryHasData);
  localStorage.setItem(key, JSON.stringify(clean));
  cacheByKey.set(key, clean);
  emitChanged();
  return clean;
}

export function clearCongRegistry(scope) {
  const key = storageKeyFor(scope);
  localStorage.removeItem(key);
  cacheByKey.delete(key);
  emitChanged();
}

export function setCongRegistry(scope, list) {
  const key = storageKeyFor(scope);
  const clean = (Array.isArray(list) ? list : []).map(normalize);
  localStorage.setItem(key, JSON.stringify(clean));
  cacheByKey.set(key, clean);
  emitChanged();
  return clean;
}

/**
 * Ghi trạng thái xuất (Hư hỏng / Sửa chữa / Bổ sung) từ sổ tuần đường vào hồ sơ cống.
 * Kèm ngày, chi tiết loại việc, khối lượng — khớp theo congId hoặc lý trình.
 */
export function applyCongExportStatusesToRegistry(scope, entries) {
  const list = loadCongRegistry(scope);
  if (!list.length || !Array.isArray(entries) || !entries.length) return list;

  const byKm = new Map();
  list.forEach((c) => {
    const km = normalizeKmInput(c.km);
    if (km) byKm.set(km, c);
  });

  let changed = false;
  const next = list.map((c) => ({ ...c }));
  const idIndex = new Map(next.map((c, i) => [str(c.id), i]));

  entries.forEach((raw) => {
    const st = str(raw?.exportCongStatus);
    if (st !== "hu_hong" && st !== "sua_chua" && st !== "bo_sung") return;
    const congId = str(raw?.congId || (raw?.assetType === "culvert" ? raw?.assetId : ""));
    const km = normalizeKmInput(raw?.kmFrom || raw?.kmTo);
    let idx = -1;
    if (congId && idIndex.has(congId)) idx = idIndex.get(congId);
    else if (km) {
      const hit = byKm.get(km);
      if (hit?.id && idIndex.has(str(hit.id))) idx = idIndex.get(str(hit.id));
    }
    if (idx < 0) return;
    const prev = next[idx];
    const at = str(raw?.date);
    // Giữ bản ghi mới hơn nếu đã có opStatusAt
    if (prev.opStatusAt && at && at < prev.opStatusAt) return;

    const unit = str(raw?.unit);
    const qFmt = formatBookDecimal(raw?.quantity);
    let quantityLabel = "";
    if (qFmt) {
      const u = unit === "m2" ? "m²" : unit === "m3" ? "m³" : unit;
      quantityLabel = u ? `${qFmt} ${u}` : qFmt;
    }

    next[idx] = normalizeCongEntry({
      ...prev,
      opStatus: st,
      opStatusAt: at || prev.opStatusAt || "",
      opStatusDetail: str(raw?.type) || prev.opStatusDetail || "",
      opStatusQuantity: quantityLabel || prev.opStatusQuantity || ""
    });
    changed = true;
  });

  if (!changed) return list;
  return setCongRegistry(scope, next);
}

export function makeEmptyCongRows(count = 1) {
  return Array.from({ length: count }, () =>
    normalizeCongEntry({
      id: nextId(),
      group: CONG_GROUP_HIEN_TRANG
    })
  );
}

/**
 * Gán chiều dài vào đúng cột loại; xoá các cột dài khác (1 cống = 1 loại) khi nhập tay 1 ô.
 * Đồng bộ type/length cho app tuần đường.
 */
export function applyCongLengthByType(entry, lenKey, value) {
  const next = { ...entry, ...emptyLenFields() };
  const key = CONG_LEN_FIELDS.some((f) => f.key === lenKey) ? lenKey : "lenKhac";
  next[key] = str(value);
  return normalizeCongEntry(next);
}

/**
 * Parse clipboard Excel → ma trận 2D.
 * Không trim cả dòng trước khi split (giữ tab đầu).
 * Chỉ bỏ dòng trống cuối; trim từng cell, giữ ô trống giữa.
 */
export function parseExcelClipboard(text) {
  const normalized = String(text || "")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
  if (!normalized.trim()) return [];
  const lines = normalized.split("\n");
  while (lines.length && !String(lines[lines.length - 1] ?? "").trim()) {
    lines.pop();
  }
  return lines.map((line) =>
    String(line)
      .split("\t")
      .map((c) => String(c ?? "").trim())
  );
}

/** Chuẩn hoá giá trị clipboard theo field hiện tại (không đổi kiểu lưu). */
export function normalizeCongClipboardValue(field, value) {
  const raw = String(value ?? "").trim();
  if (!raw) return { value: "", ok: true };
  const isLen = CONG_LEN_FIELDS.some((f) => f.key === field);
  if (isLen) {
    const compact = raw.replace(/\s/g, "");
    const n = Number(compact.replace(",", "."));
    if (!Number.isFinite(n)) return { value: raw, ok: false };
    return { value: compact, ok: true };
  }
  return { value: raw, ok: true };
}

function isSttPlusKmRow(row) {
  const c0 = str(row?.[0]);
  const c1 = str(row?.[1]);
  return /^\d+\.?$/.test(c0) && looksLikeKm(c1);
}

/**
 * Phát hiện cột đầu clipboard là STT — quyết định MỘT LẦN cho cả ma trận.
 * Không xử lý lệch từng dòng trong vòng lặp apply.
 */
export function shouldIgnoreExcelSTT(matrix, { startCol = 0, skipStt = true } = {}) {
  if (!skipStt || startCol !== 0) return false;
  const dataRows = (matrix || []).filter((row) => {
    const cols = (row || []).map((c) => str(c));
    if (!cols.some(Boolean)) return false;
    if (isCongHeaderOrSectionRow(cols)) return false;
    return true;
  });
  if (!dataRows.length) return false;

  const sttKmRows = dataRows.filter(isSttPlusKmRow);
  if (dataRows.length === 1) return isSttPlusKmRow(dataRows[0]);
  if (sttKmRows.length >= 2) return true;
  // Dòng đầu có thể lệch/ô trống cột STT; các dòng còn lại rõ ràng STT + lý trình
  if (sttKmRows.length >= 1 && sttKmRows.length >= dataRows.length - 1) return true;

  // Cột 0 gần liên tục là số + cột 1 có lý trình
  const intVals = [];
  let kmAtCol1 = 0;
  for (const row of dataRows) {
    const c0 = str(row[0]);
    if (/^\d+\.?$/.test(c0)) intVals.push(parseInt(c0, 10));
    if (looksLikeKm(row[1])) kmAtCol1 += 1;
  }
  if (kmAtCol1 >= 2 && intVals.length >= 2) {
    let sequential = 0;
    for (let i = 1; i < intVals.length; i += 1) {
      const d = intVals[i] - intVals[i - 1];
      if (d >= 1 && d <= 2) sequential += 1;
    }
    if (sequential >= intVals.length - 1) return true;
  }
  return false;
}

/**
 * Lọc header + (tuỳ chọn) bỏ cột STT đồng nhất mọi dòng trước khi apply.
 */
export function normalizeCongPasteMatrix(matrix, options = {}) {
  const startCol = Math.max(0, Number(options.startCol) || 0);
  const skipStt = options.skipStt !== false;

  const dataRows = (matrix || [])
    .map((row) => (row || []).map((c) => String(c ?? "")))
    .filter((row) => row.some((c) => str(c)))
    .filter((row) => !isCongHeaderOrSectionRow(row.map(str)));

  if (!shouldIgnoreExcelSTT(dataRows, { startCol, skipStt })) {
    return dataRows;
  }
  return dataRows.map((row) => row.slice(1));
}

/**
 * Dán lưới Excel từ ô (startRow, startFieldIndex) theo CONG_GRID_FIELDS.
 * - Chỉ ghi vào cùng Mục I/II với dòng bắt đầu; tự thêm dòng đúng group nếu thiếu.
 * - Không ghi đè header / đổi section từ nhãn Excel.
 * - STT được normalize một lần trên cả matrix (không xử lý lệch từng dòng).
 * options: { skipStt?: boolean, defaultGroup?: string }
 */
export function applyCongGridPaste(list, startRow, startFieldIndex, grid, options = {}) {
  const skipStt = options.skipStt !== false;
  const defaultGroup =
    typeof options === "string"
      ? options
      : options.defaultGroup || CONG_GROUP_HIEN_TRANG;

  const rows = [...(Array.isArray(list) ? list : [])];
  const startCol = Math.max(0, Math.min(CONG_GRID_FIELDS.length - 1, Number(startFieldIndex) || 0));
  const anchor = rows[startRow];
  const targetGroup = normalizeGroup(anchor?.group || defaultGroup);

  const groupIndices = [];
  rows.forEach((r, i) => {
    if (normalizeGroup(r.group) === targetGroup) groupIndices.push(i);
  });

  let startPosInGroup = groupIndices.indexOf(startRow);
  if (startPosInGroup < 0) {
    rows.splice(startRow, 0, normalizeCongEntry({ id: nextId(), group: targetGroup }));
    groupIndices.length = 0;
    rows.forEach((r, i) => {
      if (normalizeGroup(r.group) === targetGroup) groupIndices.push(i);
    });
    startPosInGroup = groupIndices.indexOf(startRow);
    if (startPosInGroup < 0) startPosInGroup = groupIndices.length ? groupIndices.length - 1 : 0;
  }

  // Normalize STT / header TRƯỚC vòng apply — mọi dòng cùng mapping
  const pasteRows = normalizeCongPasteMatrix(grid, { startCol, skipStt });

  let writeOffset = 0;
  let applied = 0;
  let cellCount = 0;
  let invalidCount = 0;
  let maxCols = 0;
  const highlights = [];

  pasteRows.forEach((rawCols) => {
    const cols = (rawCols || []).map((c) => str(c));
    if (!cols.some(Boolean)) return;

    maxCols = Math.max(maxCols, cols.length);

    const posInGroup = startPosInGroup + writeOffset;
    writeOffset += 1;

    let rowIndex;
    if (posInGroup < groupIndices.length) {
      rowIndex = groupIndices[posInGroup];
    } else {
      rows.push(normalizeCongEntry({ id: nextId(), group: targetGroup }));
      rowIndex = rows.length - 1;
      groupIndices.push(rowIndex);
    }

    const prev = rows[rowIndex] || normalizeCongEntry({ id: nextId(), group: targetGroup });
    const patch = { ...prev };
    const lenPatch = {};
    let touchedLen = false;

    cols.forEach((val, colOffset) => {
      const fieldIndex = startCol + colOffset;
      if (fieldIndex < 0 || fieldIndex >= CONG_GRID_FIELDS.length) return;
      const field = CONG_GRID_FIELDS[fieldIndex];
      const { value, ok } = normalizeCongClipboardValue(field, val);
      if (!ok) invalidCount += 1;
      cellCount += 1;
      highlights.push({ rowIndex, field, rowId: prev.id });

      if (CONG_LEN_FIELDS.some((f) => f.key === field)) {
        lenPatch[field] = value;
        touchedLen = true;
        return;
      }
      patch[field] = value;
    });

    if (touchedLen) {
      const pastedLenKeys = Object.keys(lenPatch);
      const multiLen = pastedLenKeys.length > 1 || cols.length > 1;
      if (multiLen) {
        Object.assign(patch, emptyLenFields(), lenPatch);
      } else {
        Object.assign(patch, emptyLenFields(), {
          [pastedLenKeys[0]]: lenPatch[pastedLenKeys[0]]
        });
      }
    }

    patch.group = targetGroup;
    rows[rowIndex] = normalizeCongEntry(patch);
    applied += 1;
  });

  return {
    rows,
    applied,
    cellCount,
    invalidCount,
    rowCount: applied,
    colCount: maxCols,
    highlights,
    group: targetGroup
  };
}

/** Tổng theo loại: { count, meters } cho từng key + tổng cộng. */
export function summarizeCongByType(list) {
  const byKey = {};
  for (const { key } of CONG_LEN_FIELDS) {
    byKey[key] = { count: 0, meters: 0 };
  }
  let totalCount = 0;
  let totalMeters = 0;
  for (const e of list || []) {
    const picked = pickCongLengthField(e);
    if (!picked) continue;
    const n = Number(String(picked.value).replace(",", "."));
    const meters = Number.isFinite(n) ? n : 0;
    byKey[picked.key].count += 1;
    byKey[picked.key].meters += meters;
    totalCount += 1;
    totalMeters += meters;
  }
  return { byKey, totalCount, totalMeters };
}

/**
 * Dán Excel (sidebar hoặc Ctrl+V cả khối):
 * - Dòng Excel đủ cột (có/không STT)
 * - Cũ 3 cột: Lý trình ⇥ Loại/khẩu độ ⇥ Chiều dài
 * Bỏ dòng tiêu đề / «Hiện trạng» / tổng.
 */
export function parseCongPaste(text, defaultGroup = CONG_GROUP_HIEN_TRANG) {
  const rows = [];
  let currentGroup = defaultGroup;
  const lines = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

  lines.forEach((line) => {
    if (!line.trim()) return;
    const cells = line.split("\t").map((c) => c.trim());
    // Fallback tách ; hoặc ≥2 space khi không có tab
    const cols = cells.length > 1 ? cells : line.split(/\t|;|\s{2,}/).map((c) => c.trim());

    if (isCongHeaderOrSectionRow(cols)) {
      const g = detectSectionGroup(cols);
      if (g) currentGroup = g;
      return;
    }

    // 3 cột cũ
    const normalized = normalizeCongExcelCells(cols);
    if (normalized.length <= 3) {
      const [km = "", typeOrAperture = "", length = ""] = normalized.length
        ? normalized
        : cols;
      if (!km && !typeOrAperture && !length) return;
      if (!looksLikeKm(km) && !/^\d/.test(km) && normalized.length <= 3) {
        // Không phải dòng dữ liệu
        if (!length) return;
      }
      const tip = typeOrAperture;
      const asAperture = /^(d|phi|ø|o)?\s*\d+([.,]\d+)?$/i.test(tip);
      rows.push(
        normalizeCongEntry({
          id: nextId(),
          km,
          aperture: asAperture ? tip : "",
          type: asAperture ? "" : tip,
          length,
          group: currentGroup
        })
      );
      return;
    }

    rows.push(rowFromGridCells(normalized, { group: currentGroup }));
  });

  return rows;
}
