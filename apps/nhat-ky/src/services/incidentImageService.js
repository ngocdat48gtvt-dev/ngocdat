import { arrayUnion, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "../firebase/firebase";

function sanitizeName(name) {
  return String(name || "anh")
    .replace(/[^\w.-]+/g, "_")
    .slice(0, 60);
}

/** Nén ảnh về JPEG, cạnh dài tối đa 1600px để upload nhẹ. */
function resizeToJpegBlob(file, maxEdge = 1600, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      const scale = Math.min(1, maxEdge / Math.max(width, height));
      width = Math.round(width * scale);
      height = Math.round(height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Không tạo được canvas nén ảnh."));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Không nén được ảnh."));
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Không đọc được ảnh."));
    };
    img.src = url;
  });
}

/**
 * Upload ảnh lên Storage và gắn URL vào sự cố.
 * @param {string} uid  chủ sự cố (đồng thời là người upload).
 * @param {string} docId  id document sự cố.
 * @param {string} incidentId  folder ảnh (thường = docId).
 * @param {File[]} files  danh sách file ảnh.
 * @param {"before"|"after"} kind  loại ảnh.
 */
export async function uploadAndAttachPhotos(uid, docId, incidentId, files, kind) {
  const list = Array.from(files || []).filter(Boolean);
  if (!uid || !docId || list.length === 0) return [];

  const folder = sanitizeName(incidentId || docId);
  const urls = [];
  for (const file of list) {
    const blob = await resizeToJpegBlob(file);
    const path = `images/${uid}/${folder}/${kind}/${Date.now()}_${sanitizeName(file.name)}.jpg`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, blob, { contentType: "image/jpeg" });
    urls.push(await getDownloadURL(storageRef));
  }

  if (urls.length > 0) {
    const field = kind === "after" ? "afterImages" : "beforeImages";
    await updateDoc(doc(db, "users", uid, "incidents", docId), {
      [field]: arrayUnion(...urls),
      updatedAt: serverTimestamp()
    });
  }
  return urls;
}
