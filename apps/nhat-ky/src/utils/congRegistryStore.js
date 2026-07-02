/**
 * Hồ sơ quản lý cống (theo hồ sơ quản lý đường).
 * Lưu cục bộ ở localStorage THEO TỪNG ĐƯỜNG (scope = uid + roadId) và đồng bộ
 * lên Firestore của user (users/{uid}/master_data/cong_registry).
 * Mỗi cống: { id, km (lý trình), type (loại cống), length (chiều dài, m) }.
 */

const LEGACY_KEY = "cong-registry-v1";
export const CONG_REGISTRY_EVENT = "cong-registry-changed";

let ridSeq = 0;
function nextId() {
  ridSeq += 1;
  return `cong_${Date.now().toString(36)}_${ridSeq}`;
}

/** Khoá localStorage cho 1 đường. scope rỗng → khoá legacy (toàn cục). */
function storageKeyFor(scope) {
  const s = String(scope || "").trim();
  return s ? `cong-registry-v2-${s}` : LEGACY_KEY;
}

/** scope chuẩn từ uid + roadId. */
export function congScope(uid, roadId) {
  const u = String(uid || "").trim();
  const r = String(roadId || "").trim();
  if (!u || !r) return "";
  return `${u}__${r}`;
}

const cacheByKey = new Map();

function normalize(entry) {
  return {
    id: entry?.id || nextId(),
    km: String(entry?.km || "").trim(),
    type: String(entry?.type || "").trim(),
    length: String(entry?.length ?? "").trim()
  };
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

/** Danh sách cống đã lưu của 1 đường. */
export function loadCongRegistry(scope) {
  const key = storageKeyFor(scope);
  if (cacheByKey.has(key)) return cacheByKey.get(key);

  let list = readKey(key);
  // Di trú: nếu đường này chưa có dữ liệu nhưng có dữ liệu cũ toàn cục → kế thừa.
  if (list.length === 0 && key !== LEGACY_KEY) {
    const legacy = readKey(LEGACY_KEY);
    if (legacy.length) {
      list = legacy;
      localStorage.setItem(key, JSON.stringify(list));
    }
  }
  cacheByKey.set(key, list);
  return list;
}

export function saveCongRegistry(scope, list) {
  const key = storageKeyFor(scope);
  const clean = (Array.isArray(list) ? list : [])
    .map(normalize)
    .filter((e) => e.km || e.type || e.length);
  localStorage.setItem(key, JSON.stringify(clean));
  cacheByKey.set(key, clean);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CONG_REGISTRY_EVENT));
  }
  return clean;
}

export function clearCongRegistry(scope) {
  const key = storageKeyFor(scope);
  localStorage.removeItem(key);
  cacheByKey.delete(key);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CONG_REGISTRY_EVENT));
  }
}

/** Ghi đè dữ liệu của 1 đường (vd nạp từ cloud) vào localStorage + cache. */
export function setCongRegistry(scope, list) {
  const key = storageKeyFor(scope);
  const clean = (Array.isArray(list) ? list : []).map(normalize);
  localStorage.setItem(key, JSON.stringify(clean));
  cacheByKey.set(key, clean);
  return clean;
}

export function makeEmptyCongRows(count = 1) {
  return Array.from({ length: count }, () => ({
    id: nextId(),
    km: "",
    type: "",
    length: ""
  }));
}

/**
 * Tách dữ liệu dán từ Excel (TSV/nhiều khoảng trắng) thành các dòng cống.
 * Mỗi dòng: Lý trình [tab] Loại cống [tab] Chiều dài.
 */
export function parseCongPaste(text) {
  const rows = [];
  String(text || "")
    .split(/\r?\n/)
    .forEach((line) => {
      if (!line.trim()) return;
      const cells = line.split(/\t|;|\s{2,}/).map((c) => c.trim());
      const [km = "", type = "", length = ""] = cells;
      if (!km && !type && !length) return;
      rows.push({ id: nextId(), km, type, length });
    });
  return rows;
}
