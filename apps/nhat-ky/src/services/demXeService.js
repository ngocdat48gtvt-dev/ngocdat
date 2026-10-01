import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { normalizeLedger } from "../utils/demXeStore";

/**
 * Sổ đếm xe:
 * users/{uid}/office_books/{roadId}/modules/dem_xe
 *   - ledger: sổ 1 nhánh / legacy
 *   - byRoute[routeId]: sổ từng nhánh khi ≥2 đường
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

function ledgerHasContent(ledger) {
  if (!ledger || typeof ledger !== "object") return false;
  if (Object.keys(ledger.days || {}).length > 0) return true;
  return Object.values(ledger.cover || {}).some((v) => String(v || "").trim());
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

/**
 * @param {{ routeId?: string, isFirstRoute?: boolean }} [opts]
 * @returns {Promise<object|null>}
 */
export async function fetchDemXeForRoad(uid, roadId, roadName = "", opts = {}) {
  const routeId = String(opts.routeId || "").trim();
  const isFirstRoute = Boolean(opts.isFirstRoute);

  if (!uid || !roadId) {
    return fetchLegacyDemXe(uid, roadName);
  }
  try {
    const snap = await getDoc(demXeModuleRef(uid, roadId));
    if (snap.exists()) {
      const data = snap.data();
      if (routeId) {
        const byRoute = data.byRoute && typeof data.byRoute === "object" ? data.byRoute : {};
        if (byRoute[routeId]) return normalizeLedger(byRoute[routeId]);
        // Nhánh đầu: fallback ledger legacy trên cùng module
        if (isFirstRoute) {
          const ledger =
            data.ledger && typeof data.ledger === "object" ? data.ledger : data;
          if (ledgerHasContent(ledger) && !byRoute[routeId]) {
            return normalizeLedger(ledger);
          }
        }
        return null;
      }
      const ledger = data.ledger && typeof data.ledger === "object" ? data.ledger : data;
      return normalizeLedger(ledger);
    }
  } catch (err) {
    console.warn("Không đọc được sổ đếm xe từ office_books.", err);
  }
  return routeId && !isFirstRoute ? null : fetchLegacyDemXe(uid, roadName);
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

/**
 * @param {{ routeId?: string }} [opts]
 */
export async function pushDemXeForRoad(uid, roadId, ledger, roadName = "", opts = {}) {
  const routeId = String(opts.routeId || "").trim();
  const clean = normalizeLedger(ledger);

  if (!uid || !roadId) {
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
    byRoad[road] = clean;
    await setDoc(ref, { byRoad, updatedAt: serverTimestamp() }, { merge: true });
    return;
  }

  const ref = demXeModuleRef(uid, roadId);
  if (routeId) {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        byRoute: { [routeId]: sanitize(clean) },
        updatedAt: serverTimestamp(),
        schemaVersion: SCHEMA_VERSION
      });
      return;
    }
    await updateDoc(ref, {
      [`byRoute.${routeId}`]: sanitize(clean),
      updatedAt: serverTimestamp(),
      schemaVersion: SCHEMA_VERSION
    });
    return;
  }

  await setDoc(
    ref,
    {
      ledger: sanitize(clean),
      updatedAt: serverTimestamp(),
      schemaVersion: SCHEMA_VERSION
    },
    { merge: true }
  );
}
