import { doc, getDoc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
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

function updatedAtMs(data) {
  const ts = data?.updatedAt;
  if (ts && typeof ts.toMillis === "function") return ts.toMillis();
  const n = Number(ts);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Đọc một lần danh mục của ADMIN để dựng báo cáo đúng tên Công việc BDTX. */
export async function fetchDataNoiNghiep(uid) {
  if (!uid) return { exists: false, catalog: {}, updatedAtMs: 0 };
  const snap = await getDoc(dataRef(uid));
  const data = snap.data();
  return {
    exists: snap.exists(),
    catalog: normalizeCatalog(data?.catalog),
    updatedAtMs: updatedAtMs(data)
  };
}

/** Đăng ký lắng nghe thay đổi danh mục trên cloud. */
export function subscribeDataNoiNghiep(uid, onUpdate, onError) {
  if (!uid) return () => {};

  return onSnapshot(
    dataRef(uid),
    (snap) => {
      const data = snap.data();
      onUpdate({
        exists: snap.exists(),
        catalog: normalizeCatalog(data?.catalog),
        updatedAtMs: updatedAtMs(data)
      });
    },
    (err) => {
      console.warn("Không đọc được data_noi_nghiep từ cloud.", err);
      onError?.(err);
    }
  );
}

/**
 * Ghi danh mục lên cloud — thay toàn bộ document (không merge)
 * để đổi/xóa tên loại không bị Firestore giữ key cũ.
 */
export async function saveDataNoiNghiep(uid, catalog) {
  if (!uid) throw new Error("Thiếu user để lưu data_noi_nghiep lên cloud.");
  await setDoc(dataRef(uid), {
    catalog: normalizeCatalog(catalog),
    updatedAt: serverTimestamp()
  });
}
