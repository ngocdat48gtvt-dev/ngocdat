import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/firebase";

/**
 * Hồ sơ cống đồng bộ lên Firestore của TỪNG user, gom theo TÊN ĐƯỜNG:
 *   users/{uid}/master_data/cong_registry = { byRoad: { "<roadName>": [ {km,type,length} ] } }
 * App điện thoại đọc đúng doc này (theo uid đăng nhập) để gợi ý lý trình cống.
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

/** Đọc toàn bộ hồ sơ cống (mọi đường) của user từ cloud → { "<đường>": [items] }. */
export async function fetchAllCong(uid) {
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
    console.warn("Không đọc được hồ sơ cống từ cloud.", err);
    return {};
  }
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
    return cleanList(byRoad[road]);
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
