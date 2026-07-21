import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/firebase";

/**
 * Phiếu kiểm tra cầu:
 * users/{uid}/office_books/{roadId}/modules/cau_inspections
 *
 * {
 *   sheets: { "<bridgeId>__<yyyy-mm>": sheetData },
 *   roadMeta: { unitName }  // chung mọi cầu / mọi tháng
 * }
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
  const mod = await fetchCauInspectionsModule(uid, roadId);
  return mod.sheets;
}

/** @returns {Promise<{ sheets: Record<string, object>, roadMeta: { unitName?: string } }>} */
export async function fetchCauInspectionsModule(uid, roadId) {
  if (!uid || !roadId) return { sheets: {}, roadMeta: {} };
  try {
    const snap = await getDoc(moduleRef(uid, roadId));
    if (!snap.exists()) return { sheets: {}, roadMeta: {} };
    const data = snap.data() || {};
    const sheets = data.sheets && typeof data.sheets === "object" ? data.sheets : {};
    const roadMeta =
      data.roadMeta && typeof data.roadMeta === "object" ? data.roadMeta : {};
    return { sheets, roadMeta };
  } catch (err) {
    console.warn("Không đọc được phiếu KT cầu từ cloud.", err);
    return { sheets: {}, roadMeta: {} };
  }
}

export async function pushCauInspections(uid, roadId, sheets, roadMeta = null) {
  if (!uid || !roadId) throw new Error("Thiếu user hoặc roadId để lưu phiếu KT cầu.");
  const payload = {
    sheets: sheets || {},
    updatedAt: serverTimestamp(),
    schemaVersion: SCHEMA_VERSION
  };
  if (roadMeta && typeof roadMeta === "object") {
    payload.roadMeta = {
      unitName: String(roadMeta.unitName || "").trim()
    };
  }
  await setDoc(moduleRef(uid, roadId), sanitize(payload), { merge: true });
}

/** Đẩy / ghi đè 1 tờ phiếu (merge vào sheets map). */
export async function pushOneCauInspection(uid, roadId, bridgeId, yearMonth, sheet) {
  if (!uid || !roadId || !bridgeId || !yearMonth) return;
  const id = cauInspectionSheetId(bridgeId, yearMonth);
  const mod = await fetchCauInspectionsModule(uid, roadId);
  const sheets = { ...mod.sheets, [id]: sheet };
  await pushCauInspections(uid, roadId, sheets, mod.roadMeta);
}
