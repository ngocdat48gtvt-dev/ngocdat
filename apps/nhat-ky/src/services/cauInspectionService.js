import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/firebase";

/**
 * Phiếu kiểm tra cầu:
 * users/{uid}/office_books/{roadId}/modules/cau_inspections
 *
 * { sheets: { "<bridgeId>__<yyyy-mm>": sheetData } }
 */

const SCHEMA_VERSION = 1;

export function cauInspectionSheetId(bridgeId, yearMonth) {
  return `${bridgeId}__${yearMonth}`;
}

function moduleRef(uid, roadId) {
  return doc(db, "users", uid, "office_books", roadId, "modules", "cau_inspections");
}

function sanitize(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

/** @returns {Promise<Record<string, object>>} */
export async function fetchCauInspections(uid, roadId) {
  if (!uid || !roadId) return {};
  try {
    const snap = await getDoc(moduleRef(uid, roadId));
    if (!snap.exists()) return {};
    const sheets = snap.data()?.sheets;
    return sheets && typeof sheets === "object" ? sheets : {};
  } catch (err) {
    console.warn("Không đọc được phiếu KT cầu từ cloud.", err);
    return {};
  }
}

export async function pushCauInspections(uid, roadId, sheets) {
  if (!uid || !roadId) throw new Error("Thiếu user hoặc roadId để lưu phiếu KT cầu.");
  await setDoc(
    moduleRef(uid, roadId),
    sanitize({
      sheets: sheets || {},
      updatedAt: serverTimestamp(),
      schemaVersion: SCHEMA_VERSION
    }),
    { merge: true }
  );
}

/** Đẩy / ghi đè 1 tờ phiếu (merge vào sheets map). */
export async function pushOneCauInspection(uid, roadId, bridgeId, yearMonth, sheet) {
  if (!uid || !roadId || !bridgeId || !yearMonth) return;
  const id = cauInspectionSheetId(bridgeId, yearMonth);
  let sheets = {};
  try {
    const snap = await getDoc(moduleRef(uid, roadId));
    sheets = { ...(snap.data()?.sheets || {}) };
  } catch {
    sheets = {};
  }
  sheets[id] = sheet;
  await pushCauInspections(uid, roadId, sheets);
}
