import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/firebase";

export const DATA_NOI_NGHIEP_DOC_ID = "data_noi_nghiep";

/**
 * Danh mục MASTER DATA (BDTX quality catalog) — đồng bộ cloud:
 *   users/{uid}/master_data/data_noi_nghiep = { catalog: { ... }, updatedAt }
 */
function dataRef(uid) {
  return doc(db, "users", uid, "master_data", DATA_NOI_NGHIEP_DOC_ID);
}

function normalizeCatalog(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw;
}

/** Đăng ký lắng nghe thay đổi danh mục trên cloud. */
export function subscribeDataNoiNghiep(uid, onUpdate, onError) {
  if (!uid) return () => {};

  return onSnapshot(
    dataRef(uid),
    (snap) => {
      onUpdate({
        exists: snap.exists(),
        catalog: normalizeCatalog(snap.data()?.catalog)
      });
    },
    (err) => {
      console.warn("Không đọc được data_noi_nghiep từ cloud.", err);
      onError?.(err);
    }
  );
}

/** Ghi danh mục (chỉ phần override, giống localStorage) lên cloud. */
export async function saveDataNoiNghiep(uid, catalog) {
  if (!uid) throw new Error("Thiếu user để lưu data_noi_nghiep lên cloud.");
  await setDoc(
    dataRef(uid),
    {
      catalog: normalizeCatalog(catalog),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}
