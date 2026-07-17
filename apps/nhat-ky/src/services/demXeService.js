import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { normalizeLedger } from "../utils/demXeStore";

/**
 * Sổ đếm xe:
 * users/{uid}/office_books/{roadId}/modules/dem_xe
 *
 * Legacy (đọc để migrate):
 * users/{uid}/master_data/vehicle_count_ledger.byRoad[roadName]
 */

const SCHEMA_VERSION = 1;

function demXeModuleRef(uid, roadId) {
  return doc(db, "users", uid, "office_books", roadId, "modules", "dem_xe");
}

function legacyLedgerRef(uid) {
  return doc(db, "users", uid, "master_data", "vehicle_count_ledger");
}

function sanitize(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

async function fetchLegacyDemXe(uid, roadName) {
  const road = String(roadName || "").trim();
  if (!uid || !road) return null;
  try {
    const snap = await getDoc(legacyLedgerRef(uid));
    const data = snap.data()?.byRoad?.[road];
    return data ? normalizeLedger(data) : null;
  } catch (err) {
    console.warn("Không đọc được sổ đếm xe legacy.", err);
    return null;
  }
}

/** @returns {Promise<object|null>} */
export async function fetchDemXeForRoad(uid, roadId, roadName = "") {
  if (!uid || !roadId) {
    return fetchLegacyDemXe(uid, roadName);
  }
  try {
    const snap = await getDoc(demXeModuleRef(uid, roadId));
    if (snap.exists()) {
      const data = snap.data();
      const ledger = data.ledger && typeof data.ledger === "object" ? data.ledger : data;
      return normalizeLedger(ledger);
    }
  } catch (err) {
    console.warn("Không đọc được sổ đếm xe từ office_books.", err);
  }
  return fetchLegacyDemXe(uid, roadName);
}

export async function fetchAllDemXe(uid) {
  if (!uid) return {};
  try {
    const snap = await getDoc(legacyLedgerRef(uid));
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

export async function pushDemXeForRoad(uid, roadId, ledger, roadName = "") {
  if (!uid || !roadId) {
    // Fallback legacy nếu thiếu roadId (tương thích cũ)
    const road = String(roadName || "").trim();
    if (!uid || !road) throw new Error("Thiếu user hoặc roadId để lưu sổ đếm xe.");
    const ref = legacyLedgerRef(uid);
    let byRoad = {};
    try {
      const snap = await getDoc(ref);
      byRoad = { ...(snap.data()?.byRoad ?? {}) };
    } catch {
      byRoad = {};
    }
    byRoad[road] = normalizeLedger(ledger);
    await setDoc(ref, { byRoad, updatedAt: serverTimestamp() }, { merge: true });
    return;
  }
  await setDoc(
    demXeModuleRef(uid, roadId),
    sanitize({
      ledger: normalizeLedger(ledger),
      updatedAt: serverTimestamp(),
      schemaVersion: SCHEMA_VERSION
    }),
    { merge: true }
  );
}
