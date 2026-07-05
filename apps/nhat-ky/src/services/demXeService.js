import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { normalizeLedger } from "../utils/demXeStore";

/**
 * users/{uid}/master_data/vehicle_count_ledger
 * { byRoad: { "<roadName>": { cover, days } } }
 */
function ledgerRef(uid) {
  return doc(db, "users", uid, "master_data", "vehicle_count_ledger");
}

export async function fetchDemXeForRoad(uid, roadName) {
  const road = String(roadName || "").trim();
  if (!uid || !road) return null;
  try {
    const snap = await getDoc(ledgerRef(uid));
    const data = snap.data()?.byRoad?.[road];
    return data ? normalizeLedger(data) : null;
  } catch (err) {
    console.warn("Không đọc được sổ đếm xe từ cloud.", err);
    return null;
  }
}

export async function fetchAllDemXe(uid) {
  if (!uid) return {};
  try {
    const snap = await getDoc(ledgerRef(uid));
    const byRoad = snap.data()?.byRoad ?? {};
    const out = {};
    Object.keys(byRoad).forEach((k) => {
      out[k] = normalizeLedger(byRoad[k]);
    });
    return out;
  } catch (err) {
    console.warn("Không đọc được sổ đếm xe từ cloud.", err);
    return {};
  }
}

export async function pushDemXeForRoad(uid, roadName, ledger) {
  const road = String(roadName || "").trim();
  if (!uid || !road) throw new Error("Thiếu user hoặc tên đường để lưu sổ đếm xe.");
  const ref = ledgerRef(uid);
  let byRoad = {};
  try {
    const snap = await getDoc(ref);
    byRoad = { ...(snap.data()?.byRoad ?? {}) };
  } catch {
    byRoad = {};
  }
  byRoad[road] = normalizeLedger(ledger);
  await setDoc(ref, { byRoad, updatedAt: serverTimestamp() }, { merge: true });
}
