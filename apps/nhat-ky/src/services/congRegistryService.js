import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/firebase";
import {
  congScope,
  loadCongRegistry,
  loadLegacyCongRegistry,
  migrateBookCongToFirstRoute,
  setCongRegistry,
  writeCongScope,
  normalizeCongEntry,
  hasCongRegistryStored
} from "../utils/congRegistryStore";
import { filterAssetsForRoute, getRoadRoutes, routeNameLabel, routeRegistryCloudKey } from "../utils/roadsCatalog";

/**
 * Hồ sơ cống đồng bộ lên Firestore của TỪNG user, gom theo TÊN ĐƯỜNG:
 *   users/{uid}/master_data/cong_registry = { byRoad: { "<roadName>": [ {km,type,length,...} ] } }
 * Giữ km/type/length để app tuần đường đọc; thêm field chi tiết biểu thống kê.
 */
function registryRef(uid) {
  return doc(db, "users", uid, "master_data", "cong_registry");
}

function cleanList(list) {
  return (Array.isArray(list) ? list : [])
    .map((e) => normalizeCongEntry(e))
    .filter(
      (e) =>
        e.id ||
        e.km ||
        e.type ||
        e.length ||
        e.aperture ||
        e.body ||
        e.lenTron ||
        e.lenHop ||
        e.lenBan ||
        e.lenVom ||
        e.lenDaKhan ||
        e.lenKhac
    );
}

/**
 * Khi cloud chưa có id (dữ liệu cũ), giữ lại id local cùng lý trình
 * để không đổi id mỗi lần hydrate.
 */
function prepareCloudCongList(cloudList, localList) {
  const locals = Array.isArray(localList) ? localList : [];
  const usedIds = new Set();
  return (Array.isArray(cloudList) ? cloudList : []).map((raw) => {
    const existing = String(raw?.id || "").trim();
    const km = String(raw?.km || "").trim();
    const match = locals.find((l) => {
      const lid = String(l?.id || "").trim();
      if (!lid || usedIds.has(lid)) return false;
      if (existing && lid === existing) return true;
      return km && String(l?.km || "").trim() === km;
    });
    if (match?.id) usedIds.add(String(match.id).trim());
    const id = existing || match?.id;
    // Giữ opStatus (+ chi tiết/KL) local nếu cloud chưa có.
    const opStatus = String(raw?.opStatus || match?.opStatus || "").trim();
    const opStatusAt = String(raw?.opStatusAt || match?.opStatusAt || "").trim();
    const opStatusDetail = String(raw?.opStatusDetail || match?.opStatusDetail || "").trim();
    const opStatusQuantity = String(
      raw?.opStatusQuantity || match?.opStatusQuantity || ""
    ).trim();
    return normalizeCongEntry({
      ...raw,
      ...(id ? { id } : {}),
      ...(opStatus
        ? { opStatus, opStatusAt, opStatusDetail, opStatusQuantity }
        : {})
    });
  });
}

function filledCount(list) {
  return (Array.isArray(list) ? list : []).filter((e) => String(e?.km || "").trim()).length;
}

/** Chuẩn hoá để so khớp QL.37 / QL37 / ql 37 */
export function normalizeRoadKey(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^duong\s+/i, "")
    .replace(/^quoc\s*lo\s+/i, "ql")
    .replace(/\s+/g, "")
    .replace(/[.\-_/]/g, "");
}

/** Lấy mã kiểu ql37 từ chuỗi tên đường. */
function extractQlCode(name) {
  const n = normalizeRoadKey(name);
  const m = n.match(/ql\d+[a-z]?/);
  return m ? m[0] : "";
}

function roadCandidates(road) {
  if (!road) return [];
  const names = [road.roadName, road.label, road.hat];
  if (Array.isArray(road.routes)) {
    for (const r of road.routes) {
      if (r?.roadName) names.push(r.roadName);
    }
  }
  return names.map((s) => String(s || "").trim()).filter(Boolean);
}

/**
 * Ghép list cloud theo tên đường.
 * Cloud thực tế thường có key "QL.37" — khớp exact / fuzzy / mã QL / 1 đường duy nhất.
 * Sổ nhiều nhánh: gộp list từ mọi tên đường/nhánh.
 */
export function pickCongListForRoad(cloudByRoad, road, { alone = false } = {}) {
  if (!cloudByRoad || !road) return [];
  const keys = Object.keys(cloudByRoad).filter(
    (k) => Array.isArray(cloudByRoad[k]) && cloudByRoad[k].length
  );
  if (!keys.length) return [];

  const candidates = roadCandidates(road);
  const collected = [];
  const seen = new Set();

  function pushList(list) {
    for (const item of list || []) {
      const token = `${String(item?.km || "").trim()}|${String(item?.type || "").trim()}|${String(item?.length ?? "").trim()}`;
      if (seen.has(token)) continue;
      seen.add(token);
      collected.push(item);
    }
  }

  for (const c of candidates) {
    if (cloudByRoad[c]?.length) pushList(cloudByRoad[c]);
  }

  for (const c of candidates) {
    const nc = normalizeRoadKey(c);
    if (!nc) continue;
    const hit = keys.find((k) => normalizeRoadKey(k) === nc);
    if (hit) pushList(cloudByRoad[hit]);
  }

  for (const c of candidates) {
    const code = extractQlCode(c);
    if (!code) continue;
    const hit = keys.find((k) => extractQlCode(k) === code || normalizeRoadKey(k) === code);
    if (hit) pushList(cloudByRoad[hit]);
  }

  for (const c of candidates) {
    const nc = normalizeRoadKey(c);
    if (nc.length < 3) continue;
    const hit = keys.find((k) => {
      const nk = normalizeRoadKey(k);
      return nk.includes(nc) || nc.includes(nk);
    });
    if (hit) pushList(cloudByRoad[hit]);
  }

  if (collected.length) return collected;

  // Một hạt đang làm + cloud chỉ có 1 tuyến → lấy luôn
  if (alone && keys.length === 1) return cloudByRoad[keys[0]];

  return [];
}

function cloudListAt(cloudByRoad, key) {
  const k = String(key || "").trim();
  if (!k || !cloudByRoad || !Object.prototype.hasOwnProperty.call(cloudByRoad, k)) {
    return undefined;
  }
  return Array.isArray(cloudByRoad[k]) ? cloudByRoad[k] : undefined;
}

/**
 * Key cloud đúng nhánh/đường (kể cả mảng rỗng sau «Xoá hết»).
 * undefined = chưa có key trên cloud — đừng suy từ tuyến khác.
 */
export function explicitCloudCongList(cloudByRoad, route, siblingRoutes = []) {
  if (!cloudByRoad || !route) return undefined;
  const uniqueKey = routeRegistryCloudKey(route);
  const unique = cloudListAt(cloudByRoad, uniqueKey);
  if (unique !== undefined) return unique;
  const name = routeNameLabel(route);
  if (!name) return undefined;
  const sameName = (Array.isArray(siblingRoutes) ? siblingRoutes : []).filter(
    (r) => routeNameLabel(r) === name
  );
  if (sameName.length > 1) return undefined;
  return cloudListAt(cloudByRoad, name);
}

export function explicitCloudCongListForRoad(cloudByRoad, road) {
  if (!cloudByRoad || !road) return undefined;
  for (const c of roadCandidates(road)) {
    const hit = cloudListAt(cloudByRoad, c);
    if (hit !== undefined) return hit;
  }
  return undefined;
}

/**
 * Ghép list cloud theo đúng 1 nhánh (key tên+km / routeId; legacy: tên nếu không trùng nhánh).
 */
export function pickCongListForRoute(cloudByRoad, route, siblingRoutes = []) {
  const explicit = explicitCloudCongList(cloudByRoad, route, siblingRoutes);
  if (explicit !== undefined) return explicit;
  if (!cloudByRoad || !route) return [];
  const name = routeNameLabel(route);
  if (!name) return [];
  return pickCongListForRoad(
    cloudByRoad,
    { roadName: name, label: name, routes: [route] },
    { alone: false }
  );
}

/** Cache ngắn để mở lại tab DS cống không chờ Firestore mỗi lần. */
const CONG_FETCH_TTL_MS = 60_000;
const congFetchCache = new Map();

/** Đọc toàn bộ hồ sơ cống (mọi đường) của user từ cloud → { "<đường>": [items] }. */
export async function fetchAllCong(uid, { force = false } = {}) {
  if (!uid) return {};
  const cached = congFetchCache.get(uid);
  if (!force && cached && Date.now() - cached.at < CONG_FETCH_TTL_MS) {
    return cached.data;
  }
  try {
    const snap = await getDoc(registryRef(uid));
    if (!snap.exists()) {
      congFetchCache.set(uid, { at: Date.now(), data: {} });
      return {};
    }
    const byRoad = snap.data()?.byRoad ?? {};
    const out = {};
    Object.keys(byRoad).forEach((k) => {
      out[k] = cleanList(byRoad[k]);
    });
    congFetchCache.set(uid, { at: Date.now(), data: out });
    return out;
  } catch (err) {
    console.warn("Không đọc được hồ sơ cống từ cloud.", err);
    return cached?.data || {};
  }
}

/** Xoá cache sau khi push lên cloud để lần hydrate sau lấy bản mới. */
export function invalidateCongFetchCache(uid) {
  if (uid) congFetchCache.delete(uid);
  else congFetchCache.clear();
}

/**
 * Nạp hồ sơ cống từ cloud vào localStorage theo từng hạt/đường (và từng nhánh nếu có).
 * Ưu tiên cloud khi máy trống, cloud ≥ local, hoặc force (browse/readOnly).
 */
export async function hydrateCongRegistriesFromCloud(uid, roads, { force = false } = {}) {
  if (!uid || !Array.isArray(roads) || !roads.length) {
    return { loadedRoads: 0, total: 0, cloudKeys: [] };
  }

  const cloud = await fetchAllCong(uid, { force: true });
  const cloudKeys = Object.keys(cloud).filter((k) => cloud[k]?.length);
  const legacy = loadLegacyCongRegistry();
  const alone = roads.length === 1;
  let loadedRoads = 0;
  let total = 0;

  for (const road of roads) {
    if (!road?.id) continue;
    const routes = getRoadRoutes(road);

    if (routes.length > 1) {
      migrateBookCongToFirstRoute(uid, road.id, routes);
      for (const route of routes) {
        if (!route?.id) continue;
        const scope = writeCongScope(uid, road.id, route.id, routes);
        const local = loadCongRegistry(scope);
        const explicit = explicitCloudCongList(cloud, route, routes);
        if (explicit !== undefined) {
          const list = filterAssetsForRoute(explicit, route, routes);
          setCongRegistry(
            scope,
            list.length ? prepareCloudCongList(list, local) : []
          );
          loadedRoads += 1;
          total += list.length;
          continue;
        }
        // Chưa có key cloud đúng nhánh: máy trống mới suy từ tuyến khác.
        if (!force && hasCongRegistryStored(scope)) continue;
        let list = pickCongListForRoute(cloud, route, routes);
        if (!list.length) continue;
        list = filterAssetsForRoute(list, route, routes);
        if (!list.length) continue;
        if (!force && filledCount(local) > filledCount(list)) continue;
        setCongRegistry(scope, prepareCloudCongList(list, local));
        loadedRoads += 1;
        total += list.length;
      }
      continue;
    }

    const scope = congScope(uid, road.id);
    const local = loadCongRegistry(scope);
    const explicit = explicitCloudCongListForRoad(cloud, road);
    if (explicit !== undefined) {
      setCongRegistry(
        scope,
        explicit.length ? prepareCloudCongList(explicit, local) : []
      );
      loadedRoads += 1;
      total += explicit.length;
      continue;
    }

    let list = pickCongListForRoad(cloud, road, { alone });
    if (!list.length && alone && legacy.length) list = legacy;

    if (!list.length) continue;
    if (!force && hasCongRegistryStored(scope)) continue;
    if (!force && filledCount(local) > filledCount(list)) continue;

    setCongRegistry(scope, prepareCloudCongList(list, local));
    loadedRoads += 1;
    total += list.length;
  }

  if (loadedRoads === 0 && alone && cloudKeys.length === 1) {
    const road = roads[0];
    const routes = getRoadRoutes(road);
    if (routes.length <= 1) {
      const scope = congScope(uid, road.id);
      const local = loadCongRegistry(scope);
      const localFilled = filledCount(local);
      const list = cloud[cloudKeys[0]];
      if (list?.length && (force || localFilled <= list.length)) {
        setCongRegistry(scope, prepareCloudCongList(list, local));
        loadedRoads = 1;
        total = list.length;
      }
    }
  }

  if (cloudKeys.length && loadedRoads === 0) {
    console.warn(
      "[cong] Cloud có cống nhưng không khớp tên đường.",
      { cloudKeys, roads: roads.map((r) => ({ id: r.id, roadName: r.roadName, label: r.label })) }
    );
  }

  return { loadedRoads, total, cloudKeys };
}

/** Cập nhật nhiều đường một lần (giữ nguyên các đường không nằm trong updates). */
export async function pushManyCong(uid, updatesByRoad) {
  if (!uid) throw new Error("Thiếu user để lưu hồ sơ cống lên cloud.");
  const ref = registryRef(uid);
  let byRoad = {};
  try {
    const snap = await getDoc(ref);
    byRoad = { ...(snap.data()?.byRoad ?? {}) };
  } catch {
    byRoad = {};
  }
  Object.keys(updatesByRoad || {}).forEach((road) => {
    const r = String(road || "").trim();
    if (!r) return;
    byRoad[r] = cleanList(updatesByRoad[road]);
  });
  await setDoc(ref, { byRoad, updatedAt: serverTimestamp() }, { merge: true });
  invalidateCongFetchCache(uid);
}

/** Đọc danh sách cống của 1 đường từ cloud. */
export async function fetchCongForRoad(uid, roadName) {
  const road = String(roadName || "").trim();
  if (!uid || !road) return [];
  try {
    const snap = await getDoc(registryRef(uid));
    const byRoad = snap.data()?.byRoad ?? {};
    const exact = cleanList(byRoad[road]);
    if (exact.length) return exact;
    return pickCongListForRoad(byRoad, { roadName: road, label: road }, { alone: true });
  } catch (err) {
    console.warn("Không đọc được hồ sơ cống từ cloud.", err);
    return [];
  }
}

/** Đẩy danh sách cống của 1 đường lên cloud (giữ nguyên các đường khác). */
export async function pushCongForRoad(uid, roadName, list) {
  const road = String(roadName || "").trim();
  if (!uid || !road) {
    throw new Error("Thiếu user hoặc tên đường để lưu hồ sơ cống lên cloud.");
  }
  const ref = registryRef(uid);
  let byRoad = {};
  try {
    const snap = await getDoc(ref);
    byRoad = { ...(snap.data()?.byRoad ?? {}) };
  } catch {
    byRoad = {};
  }
  byRoad[road] = cleanList(list);
  await setDoc(ref, { byRoad, updatedAt: serverTimestamp() }, { merge: true });
  invalidateCongFetchCache(uid);
}
