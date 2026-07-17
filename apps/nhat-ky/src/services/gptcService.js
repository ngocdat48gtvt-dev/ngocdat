import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { normalizeLedger } from "../utils/gptcStore";

/**
 * Sổ cấp phép thi công:
 * users/{uid}/office_books/{roadId}/modules/gptc
 *
 * Legacy (đọc để migrate):
 * users/{uid}/master_data/construction_permit_ledger.byRoad[roadName]
 */

const SCHEMA_VERSION = 1;

function gptcModuleRef(uid, roadId) {
  return doc(db, "users", uid, "office_books", roadId, "modules", "gptc");
}

function legacyLedgerRef(uid) {
  return doc(db, "users", uid, "master_data", "construction_permit_ledger");
}

function sanitize(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

async function fetchLegacyGptc(uid, roadName) {
  const road = String(roadName || "").trim();
  if (!uid || !road) return null;
  try {
    const snap = await getDoc(legacyLedgerRef(uid));
    const data = snap.data()?.byRoad?.[road];
    return data ? normalizeLedger(data) : null;
  } catch (err) {
    console.warn("Không đọc được GPTC legacy.", err);
    return null;
  }
}

/** @returns {Promise<object|null>} */
export async function fetchGptcForRoad(uid, roadId, roadName = "") {
  if (!uid || !roadId) return null;
  try {
    const snap = await getDoc(gptcModuleRef(uid, roadId));
    if (snap.exists()) {
      const data = snap.data();
      const ledger = data.ledger && typeof data.ledger === "object" ? data.ledger : data;
      return normalizeLedger(ledger);
    }
  } catch (err) {
    console.warn("Không đọc được sổ cấp phép thi công từ office_books.", err);
  }
  return fetchLegacyGptc(uid, roadName);
}

export async function pushGptcForRoad(uid, roadId, ledger) {
  if (!uid || !roadId) throw new Error("Thiếu user hoặc roadId để lưu sổ cấp phép thi công.");
  await setDoc(
    gptcModuleRef(uid, roadId),
    sanitize({
      ledger: normalizeLedger(ledger),
      updatedAt: serverTimestamp(),
      schemaVersion: SCHEMA_VERSION
    }),
    { merge: true }
  );
}
