/**
 * Danh sách cầu theo từng đường (hạt) của user.
 * localStorage scope = uid__roadId; đồng bộ cloud master_data/cau_registry.
 * Mỗi cầu: { id, name, km }.
 */

import { filterAssetsForRoute } from "./roadsCatalog";

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

export function cauScope(uid, roadId, routeId = "") {
  const u = String(uid || "").trim();
  const r = String(roadId || "").trim();
  const rt = String(routeId || "").trim();
  if (!u || !r) return "";
  return rt ? `${u}__${r}__rt_${rt}` : `${u}__${r}`;
}

/**
 * Scope đọc: nhiều nhánh → theo routeId; 1 nhánh → key sổ cũ.
 */
export function resolveCauScope(uid, roadId, routeId, routes = []) {
  const list = Array.isArray(routes) ? routes : [];
  const multi = list.length > 1;
  const rid = String(routeId || list[0]?.id || "").trim();
  if (multi && rid) return cauScope(uid, roadId, rid);
  return cauScope(uid, roadId);
}

/** Sổ cũ (1 list chung) → tách theo km vào từng nhánh. */
export function migrateBookCauToFirstRoute(uid, roadId, routes = []) {
  const list = Array.isArray(routes) ? routes : [];
  if (!uid || !roadId || list.length <= 1) return;
  const bookScope = cauScope(uid, roadId);
  const bookList = loadCauRegistry(bookScope);
  if (!bookList.length) return;

  for (const route of list) {
    const rid = String(route?.id || "").trim();
    if (!rid) continue;
    const routeScope = cauScope(uid, roadId, rid);
    if (loadCauRegistry(routeScope).length) continue;
    const filtered = filterAssetsForRoute(bookList, route, list).map((e) => ({
      ...e,
      routeId: rid
    }));
    if (filtered.length) setCauRegistry(routeScope, filtered);
  }
  setCauRegistry(bookScope, []);
}

/**
 * Lọc cầu theo nhánh đang chọn (routeId hoặc lý trình trong đoạn km).
 * Gộp pool sổ cũ + mọi nhánh rồi lọc.
 */
export function loadCauRegistryForRoute(uid, roadId, route, routes = []) {
  const list = Array.isArray(routes) ? routes : [];
  const multi = list.length > 1;
  const rid = String(route?.id || "").trim();
  const scope = resolveCauScope(uid, roadId, rid, list);
  let items = loadCauRegistry(scope);
  if (!multi || !route) return items;

  const pool = [];
  const seen = new Set();
  const pushAll = (arr) => {
    for (const e of arr || []) {
      const id = String(e?.id || "").trim();
      const key = id || `${e?.km || ""}|${e?.name || ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pool.push(e);
    }
  };
  pushAll(items);
  pushAll(loadCauRegistry(cauScope(uid, roadId)));
  for (const r of list) {
    const id = String(r?.id || "").trim();
    if (!id) continue;
    pushAll(loadCauRegistry(cauScope(uid, roadId, id)));
  }
  return filterAssetsForRoute(pool, route, list);
}

export function writeCauScope(uid, roadId, routeId, routes = []) {
  const list = Array.isArray(routes) ? routes : [];
  const multi = list.length > 1;
  const rid = String(routeId || list[0]?.id || "").trim();
  if (multi && rid) return cauScope(uid, roadId, rid);
  return cauScope(uid, roadId);
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

/**
 * Tách dữ liệu dán từ Excel / văn bản thành các dòng cầu.
 * Mỗi dòng: Tên cầu [tab|;|≥2 space] Lý trình
 * hoặc «Tên cầu … Km316+900» / «Tên cầu … 316+900» (1 khoảng cũng được).
 */
export function parseCauPaste(text) {
  const rows = [];
  const kmAtEnd =
    /(?:^|[\s\t;]+)(?:Km\s*)?(\d{1,4}\s*\+\s*\d{1,4}|\d{5,7})\s*$/i;

  String(text || "")
    .split(/\r?\n/)
    .forEach((rawLine) => {
      const line = String(rawLine || "").trim();
      if (!line) return;

      // Chỉ bỏ hàng tiêu đề thật (không bỏ tên cầu bắt đầu bằng «Cầu …»)
      const cellsProbe = line.split(/\t|;|\s{2,}/).map((c) => c.trim()).filter(Boolean);
      const first = (cellsProbe[0] || "").toLowerCase();
      if (
        /^(stt|tên cầu|ten cau|tên|ten|lý trình|ly trinh|km|ghi chú|ghi chu)$/i.test(first) &&
        cellsProbe.every((c) => !/\d/.test(c))
      ) {
        return;
      }

      let name = "";
      let km = "";

      if (cellsProbe.length >= 2) {
        // Cột cuối thường là lý trình
        const last = cellsProbe[cellsProbe.length - 1];
        if (kmAtEnd.test(last) || /^\d/.test(last) || /\+/.test(last)) {
          km = last.replace(/^Km\s*/i, "").trim();
          name = cellsProbe.slice(0, -1).join(" ").trim();
        } else {
          name = cellsProbe[0];
          km = cellsProbe[1];
        }
      } else {
        // Một cụm: tách lý trình ở cuối («Cầu Sông Cầu 435+200»)
        const m = line.match(kmAtEnd);
        if (m) {
          km = m[1].replace(/\s+/g, "");
          name = line.slice(0, m.index).trim();
        } else {
          name = line;
        }
      }

      if (!name && !km) return;
      rows.push({ id: nextId(), name, km });
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
