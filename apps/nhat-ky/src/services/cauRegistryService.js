import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/firebase";

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
