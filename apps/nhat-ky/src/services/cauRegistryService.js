import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { pickCongListForRoad, pickCongListForRoute } from "./congRegistryService";
import {
  cauScope,
  loadCauRegistry,
  migrateBookCauToFirstRoute,
  setCauRegistry,
  writeCauScope
} from "../utils/cauRegistryStore";
import { filterAssetsForRoute, getRoadRoutes } from "../utils/roadsCatalog";

/**
 * users/{uid}/master_data/cau_registry = { byRoad: { "<roadName>": [ {id,name,km} ] } }
 */

function registryRef(uid) {
  return doc(db, "users", uid, "master_data", "cau_registry");
}

function cleanList(list) {
  return (Array.isArray(list) ? list : [])
    .map((e) => ({
      id: String(e?.id || "").trim(),
      name: String(e?.name || "").trim(),
      km: String(e?.km || "").trim()
    }))
    .filter((e) => e.name || e.km)
    .map((e, i) => ({
      ...e,
      id: e.id || `cau_cloud_${i}_${e.km || e.name}`
    }));
}

function filledCount(list) {
  return (Array.isArray(list) ? list : []).filter(
    (e) => String(e?.name || "").trim() || String(e?.km || "").trim()
  ).length;
}

export async function fetchAllCau(uid) {
  if (!uid) return {};
  try {
    const snap = await getDoc(registryRef(uid));
    const byRoad = snap.data()?.byRoad ?? {};
    const out = {};
    Object.keys(byRoad).forEach((k) => {
      out[k] = cleanList(byRoad[k]);
    });
    return out;
  } catch (err) {
    console.warn("Không đọc được danh sách cầu từ cloud.", err);
    return {};
  }
}

/**
 * Nạp danh sách cầu từ cloud → local (theo sổ, và theo từng nhánh nếu có).
 * Ưu tiên cloud khi máy trống, cloud ≥ local, hoặc force (browse/readOnly).
 */
export async function hydrateCauRegistriesFromCloud(uid, roads, { force = false } = {}) {
  if (!uid || !Array.isArray(roads) || !roads.length) {
    return { loadedRoads: 0, total: 0, cloudKeys: [] };
  }

  const cloud = await fetchAllCau(uid);
  const cloudKeys = Object.keys(cloud).filter((k) => cloud[k]?.length);
  const alone = roads.length === 1;
  let loadedRoads = 0;
  let total = 0;

  for (const road of roads) {
    if (!road?.id) continue;
    const routes = getRoadRoutes(road);

    if (routes.length > 1) {
      migrateBookCauToFirstRoute(uid, road.id, routes);
      for (const route of routes) {
        if (!route?.id) continue;
        const scope = writeCauScope(uid, road.id, route.id, routes);
        const localFilled = filledCount(loadCauRegistry(scope));
        let list = pickCongListForRoute(cloud, route, routes);
        if (!list.length) continue;
        list = filterAssetsForRoute(list, route, routes);
        if (!list.length) continue;
        const cloudFilled = filledCount(list);
        if (!force && localFilled > cloudFilled) continue;
        setCauRegistry(scope, list);
        loadedRoads += 1;
        total += list.length;
      }
      continue;
    }

    const scope = cauScope(uid, road.id);
    const localFilled = filledCount(loadCauRegistry(scope));
    const list = pickCongListForRoad(cloud, road, { alone });
    if (!list.length) continue;

    const cloudFilled = filledCount(list);
    if (!force && localFilled > cloudFilled) continue;

    setCauRegistry(scope, list);
    loadedRoads += 1;
    total += list.length;
  }

  if (loadedRoads === 0 && alone && cloudKeys.length === 1) {
    const road = roads[0];
    const routes = getRoadRoutes(road);
    if (routes.length <= 1) {
      const scope = cauScope(uid, road.id);
      const localFilled = filledCount(loadCauRegistry(scope));
      const list = cloud[cloudKeys[0]];
      if (list?.length && (force || localFilled <= list.length)) {
        setCauRegistry(scope, list);
        loadedRoads = 1;
        total = list.length;
      }
    }
  }

  return { loadedRoads, total, cloudKeys };
}

export async function pushManyCau(uid, updatesByRoad) {
  if (!uid) throw new Error("Thiếu user để lưu danh sách cầu lên cloud.");
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
