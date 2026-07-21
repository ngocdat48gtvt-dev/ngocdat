import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/firebase";

/** users/{adminUid}/master_data/bao_cao_contract_volumes */
const DOC_ID = "bao_cao_contract_volumes";

function ref(adminUid) {
  return doc(db, "users", adminUid, "master_data", DOC_ID);
}

/** @returns {Promise<Record<string, string|number>>} */
export async function fetchBaoCaoContracts(adminUid) {
  if (!adminUid) return {};
  try {
    const snap = await getDoc(ref(adminUid));
    if (!snap.exists()) return {};
    const byKey = snap.data()?.byKey;
    return byKey && typeof byKey === "object" ? { ...byKey } : {};
  } catch (err) {
    console.warn("Không đọc được KL HĐ báo cáo.", err);
    return {};
  }
}

/** @param {Record<string, string|number>} byKey */
export async function pushBaoCaoContracts(adminUid, byKey) {
  if (!adminUid) return;
  await setDoc(
    ref(adminUid),
    {
      byKey: byKey || {},
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}
