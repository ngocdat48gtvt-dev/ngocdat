/**
 * Danh sách cầu theo từng đường (hạt) của user.
 * localStorage scope = uid__roadId; đồng bộ cloud master_data/cau_registry.
 * Mỗi cầu: { id, name, km }.
 */

const LEGACY_KEY = "cau-registry-v1";
export const CAU_REGISTRY_EVENT = "cau-registry-changed";
export const CAU_SECTION = "Công trình cầu";

let ridSeq = 0;
function nextId() {
  ridSeq += 1;
  return `cau_${Date.now().toString(36)}_${ridSeq}`;
}

function storageKeyFor(scope) {
  const s = String(scope || "").trim();
  return s ? `cau-registry-v1-${s}` : LEGACY_KEY;
}

export function cauScope(uid, roadId) {
  const u = String(uid || "").trim();
  const r = String(roadId || "").trim();
  if (!u || !r) return "";
  return `${u}__${r}`;
}

const cacheByKey = new Map();

function normalize(entry) {
  return {
    id: entry?.id || nextId(),
    name: String(entry?.name || "").trim(),
    km: String(entry?.km || "").trim()
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

export function loadCauRegistry(scope) {
  const key = storageKeyFor(scope);
  if (cacheByKey.has(key)) return cacheByKey.get(key);
  const list = readKey(key);
  cacheByKey.set(key, list);
  return list;
}

export function saveCauRegistry(scope, list) {
  const key = storageKeyFor(scope);
  const clean = (Array.isArray(list) ? list : [])
    .map(normalize)
    .filter((e) => e.name || e.km);
  localStorage.setItem(key, JSON.stringify(clean));
  cacheByKey.set(key, clean);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CAU_REGISTRY_EVENT));
  }
  return clean;
}

export function setCauRegistry(scope, list) {
  const key = storageKeyFor(scope);
  const clean = (Array.isArray(list) ? list : []).map(normalize);
  localStorage.setItem(key, JSON.stringify(clean));
  cacheByKey.set(key, clean);
  return clean;
}

export function makeEmptyCauRows(count = 1) {
  return Array.from({ length: count }, () => ({
    id: nextId(),
    name: "",
    km: ""
  }));
}

export function parseCauPaste(text) {
  const rows = [];
  String(text || "")
    .split(/\r?\n/)
    .forEach((line) => {
      if (!line.trim()) return;
      const cells = line.split(/\t|;|\s{2,}/).map((c) => c.trim());
      if (!cells.length) return;
      if (/^(stt|tên|ten|cầu|cau|lý trình|ly trinh)/i.test(cells[0])) return;
      if (cells.length >= 2) {
        rows.push({ id: nextId(), name: cells[0], km: cells[1] });
      } else {
        rows.push({ id: nextId(), name: cells[0], km: "" });
      }
    });
  return rows;
}

/** Tìm cầu theo id hoặc lý trình. */
export function findCauByKmOrId(list, { bridgeId, km } = {}) {
  const items = Array.isArray(list) ? list : [];
  if (bridgeId) {
    const byId = items.find((c) => c.id === bridgeId);
    if (byId) return byId;
  }
  const target = String(km || "")
    .trim()
    .replace(/^km\s*/i, "")
    .replace(/\s+/g, "");
  if (!target) return null;
  return (
    items.find((c) => {
      const k = String(c.km || "")
        .trim()
        .replace(/^km\s*/i, "")
        .replace(/\s+/g, "");
      return k && k === target;
    }) || null
  );
}
