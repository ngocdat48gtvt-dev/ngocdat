import { deleteObject, ref } from "firebase/storage";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db, storage } from "../firebase/firebase";
import { computeRemoveIncidentImagePatch } from "../utils/incidentUtils";

function firebaseObjectKey(url) {
  const match = /\/o\/([^?]+)/.exec(String(url || ""));
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

async function deleteStorageUrl(url) {
  if (!String(url).startsWith("http")) return;
  const key = firebaseObjectKey(url);
  if (!key) return;
  try {
    await deleteObject(ref(storage, key));
  } catch {
    /* bỏ qua nếu không xóa được Storage */
  }
}

/** Xóa một ảnh khỏi sự cố (Firestore + Storage nếu là URL). */
export async function removeIncidentImage(uid, docId, incident, kind, url) {
  const patch = computeRemoveIncidentImagePatch(incident, kind, url);
  await updateDoc(doc(db, "users", uid, "incidents", docId), {
    beforeImages: patch.beforeImages,
    afterImages: patch.afterImages,
    reportImageOrder: patch.reportImageOrder,
    selectedBefore: patch.selectedBefore,
    selectedAfter: patch.selectedAfter,
    updatedAt: serverTimestamp()
  });
  if (String(patch.removedUrl).startsWith("http")) {
    await deleteStorageUrl(patch.removedUrl);
  }
  return patch;
}
