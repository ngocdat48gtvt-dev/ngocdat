import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";

/** Web Nhật ký tuần đường — metadata import, tách khỏi incidents & admin. */
const META_COLLECTION = "nhat_ky_meta";
const META_DOC_ID = "main";

function metaDocRef(uid) {
  return doc(db, "users", uid, META_COLLECTION, META_DOC_ID);
}

export async function fetchImportMapFromFirestore(uid) {
  if (!uid) return null;
  const snap = await getDoc(metaDocRef(uid));
  if (!snap.exists()) return {};
  const data = snap.data();
  if (!data.importMap || typeof data.importMap !== "object") return {};
  return data.importMap;
}

export async function saveImportMapToFirestore(uid, importMap) {
  if (!uid) return;
  await setDoc(
    metaDocRef(uid),
    {
      importMap: importMap || {},
      updatedAt: serverTimestamp(),
      schemaVersion: 1
    },
    { merge: true }
  );
}
