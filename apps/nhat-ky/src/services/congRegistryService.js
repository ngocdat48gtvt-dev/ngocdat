import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/firebase";
import {
  congScope,
  loadCongRegistry,
  loadLegacyCongRegistry,
  setCongRegistry
} from "../utils/congRegistryStore";

/**
 * Hồ sơ cống đồng bộ lên Firestore của TỪNG user, gom theo TÊN ĐƯỜNG:
 *   users/{uid}/master_data/cong_registry = { byRoad: { "<roadName>": [ {km,type,length} ] } }
 */
function registryRef(uid) {
  return doc(db, "users", uid, "master_data", "cong_registry");
}

function cleanList(list) {
  return (Array.isArray(list) ? list : [])
    .map((e) => ({
      km: String(e?.km || "").trim(),
      type: String(e?.type || "").trim(),
      length: String(e?.length ?? "").trim()
    }))
    .filter((e) => e.km || e.type || e.length);
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
  return [road.roadName, road.label, road.hat]
    .map((s) => String(s || "").trim())
    .filter(Boolean);
}

/**
 * Ghép list cloud theo tên đường.
 * Cloud thực tế thường có key "QL.37" — khớp exact / fuzzy / mã QL / 1 đường duy nhất.
 */
export function pickCongListForRoad(cloudByRoad, road, { alone = false } = {}) {
  if (!cloudByRoad || !road) return [];
  const keys = Object.keys(cloudByRoad).filter((k) => Array.isArray(cloudByRoad[k]) && cloudByRoad[k].length);
  if (!keys.length) return [];

  const candidates = roadCandidates(road);

  for (const c of candidates) {
    if (cloudByRoad[c]?.length) return cloudByRoad[c];
  }

  for (const c of candidates) {
    const nc = normalizeRoadKey(c);
    if (!nc) continue;
    const hit = keys.find((k) => normalizeRoadKey(k) === nc);
    if (hit) return cloudByRoad[hit];
  }

  for (const c of candidates) {
    const code = extractQlCode(c);
    if (!code) continue;
    const hit = keys.find((k) => extractQlCode(k) === code || normalizeRoadKey(k) === code);
    if (hit) return cloudByRoad[hit];
  }

  for (const c of candidates) {
    const nc = normalizeRoadKey(c);
    if (nc.length < 3) continue;
    const hit = keys.find((k) => {
      const nk = normalizeRoadKey(k);
      return nk.includes(nc) || nc.includes(nk);
    });
    if (hit) return cloudByRoad[hit];
  }

  // Một hạt đang làm + cloud chỉ có 1 tuyến → lấy luôn
  if (alone && keys.length === 1) return cloudByRoad[keys[0]];

  return [];
}

/** Đọc toàn bộ hồ sơ cống (mọi đường) của user từ cloud → { "<đường>": [items] }. */
export async function fetchAllCong(uid) {
  if (!uid) return {};
  try {
    const snap = await getDoc(registryRef(uid));
    if (!snap.exists()) return {};
    const byRoad = snap.data()?.byRoad ?? {};
    const out = {};
    Object.keys(byRoad).forEach((k) => {
      out[k] = cleanList(byRoad[k]);
    });
    return out;
  } catch (err) {
    console.warn("Không đọc được hồ sơ cống từ cloud.", err);
    return {};
  }
}

/**
 * Nạp hồ sơ cống từ cloud vào localStorage theo từng hạt/đường của user.
 * Ưu tiên cloud khi máy trống hoặc cloud nhiều hơn máy.
 */
export async function hydrateCongRegistriesFromCloud(uid, roads, { force = false } = {}) {
  if (!uid || !Array.isArray(roads) || !roads.length) {
    return { loadedRoads: 0, total: 0, cloudKeys: [] };
  }

  const cloud = await fetchAllCong(uid);
  const cloudKeys = Object.keys(cloud).filter((k) => cloud[k]?.length);
  const legacy = loadLegacyCongRegistry();
  const alone = roads.length === 1;
  let loadedRoads = 0;
  let total = 0;

  for (const road of roads) {
    if (!road?.id) continue;
    const scope = congScope(uid, road.id);
    const local = loadCongRegistry(scope);
    const localFilled = filledCount(local);

    let list = pickCongListForRoad(cloud, road, { alone });
    if (!list.length && alone && legacy.length) list = legacy;

    if (!list.length) continue;

    const cloudFilled = filledCount(list);
    if (!force && localFilled > 0 && localFilled >= cloudFilled) continue;

    setCongRegistry(scope, list);
    loadedRoads += 1;
    total += list.length;
  }

  // Không khớp tên nào nhưng cloud có đúng 1 tuyến + máy có đúng 1 hạt → gán luôn
  if (loadedRoads === 0 && alone && cloudKeys.length === 1) {
    const road = roads[0];
    const scope = congScope(uid, road.id);
    const localFilled = filledCount(loadCongRegistry(scope));
    const list = cloud[cloudKeys[0]];
    if (list?.length && (force || localFilled === 0 || localFilled < list.length)) {
      setCongRegistry(scope, list);
      loadedRoads = 1;
      total = list.length;
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
}
