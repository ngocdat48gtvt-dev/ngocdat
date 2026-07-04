import { arrayUnion, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { getDownloadURL, listAll, ref } from "firebase/storage";
import { db, storage } from "../firebase/firebase";
import { photoToken, uniqueImageUrls } from "../utils/incidentUtils";

function removeVietnamese(str) {
  return String(str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._-]/g, "_");
}

function firebaseObjectKey(url) {
  const match = /\/o\/([^?]+)/.exec(String(url || ""));
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]).trim().toLowerCase();
  } catch {
    return match[1].trim().toLowerCase();
  }
}

function objectKeySet(urls) {
  const set = new Set();
  for (const u of urls || []) {
    if (!String(u).startsWith("http")) continue;
    const key = firebaseObjectKey(u);
    if (key) set.add(key);
  }
  return set;
}

function mergeRemoteUrls(existingUrls, newUrls) {
  const merged = uniqueImageUrls(existingUrls);
  for (const url of uniqueImageUrls(newUrls)) {
    if (!url.startsWith("http")) continue;
    if (merged.includes(url)) continue;
    const token = photoToken(url);
    const urlKey = firebaseObjectKey(url);
    const hasLocal = token && merged.some((u) => photoToken(u) === token);
    const hasSame = urlKey && merged.some((u) => firebaseObjectKey(u) === urlKey);
    if (!hasLocal && !hasSame) merged.push(url);
  }
  return merged;
}

async function listMissingRefs(storagePath, existingKeys) {
  try {
    const res = await listAll(ref(storage, storagePath));
    return res.items.filter((it) => !existingKeys.has(it.fullPath.toLowerCase()));
  } catch {
    return [];
  }
}

async function resolveDownloadUrls(refs, concurrency = 4) {
  if (!refs.length) return [];
  const urls = [];
  let next = 0;
  async function worker() {
    while (next < refs.length) {
      const i = next++;
      try {
        urls.push(await getDownloadURL(refs[i]));
      } catch {
        /* bỏ qua file lỗi */
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, refs.length) }, () => worker()));
  return urls;
}

async function pushPhotoListsUnionToCloud(uid, docId, beforeUrls, afterUrls) {
  const patch = { updatedAt: serverTimestamp() };
  const before = uniqueImageUrls(beforeUrls.filter((u) => u.startsWith("http")));
  const after = uniqueImageUrls(afterUrls.filter((u) => u.startsWith("http")));
  if (before.length) patch.beforeImages = arrayUnion(...before);
  if (after.length) patch.afterImages = arrayUnion(...after);
  if (Object.keys(patch).length === 1) return;
  await updateDoc(doc(db, "users", uid, "incidents", docId), patch);
}

/**
 * Quét Firebase Storage, bổ sung ảnh thiếu vào Firestore (chỉ thêm, không xóa).
 * @returns {Promise<number>} số sự cố được bổ sung ảnh
 */
export async function recoverPhotosFromStorage(uid, incidents, options = {}) {
  const { onProgress, shouldCancel } = options;
  let recovered = 0;
  const list = incidents || [];
  const total = list.length;

  for (let i = 0; i < list.length; i++) {
    if (shouldCancel?.()) break;
    onProgress?.(i + 1, total);

    const inc = list[i];
    const docId = inc.id;
    const incidentId = String(inc.incidentId || inc.id || "").trim();
    if (!docId || !incidentId) continue;

    const safeId = removeVietnamese(incidentId);
    const beforeExisting = objectKeySet(inc.beforeImages);
    const afterExisting = objectKeySet(inc.afterImages);

    const beforeRefs = await listMissingRefs(
      `images/${uid}/${safeId}/before`,
      beforeExisting
    );
    const afterRefs = await listMissingRefs(
      `images/${uid}/${safeId}/after`,
      afterExisting
    );
    if (!beforeRefs.length && !afterRefs.length) continue;

    const beforeUrls = await resolveDownloadUrls(beforeRefs);
    const afterUrls = await resolveDownloadUrls(afterRefs);
    if (!beforeUrls.length && !afterUrls.length) continue;

    const mergedBefore = mergeRemoteUrls(inc.beforeImages, beforeUrls);
    const mergedAfter = mergeRemoteUrls(inc.afterImages, afterUrls);
    const prevBefore = uniqueImageUrls(inc.beforeImages);
    const prevAfter = uniqueImageUrls(inc.afterImages);
    const sameBefore =
      mergedBefore.length === prevBefore.length &&
      mergedBefore.every((u, idx) => u === prevBefore[idx]);
    const sameAfter =
      mergedAfter.length === prevAfter.length &&
      mergedAfter.every((u, idx) => u === prevAfter[idx]);
    if (sameBefore && sameAfter) continue;

    await pushPhotoListsUnionToCloud(uid, docId, mergedBefore, mergedAfter);
    recovered++;
  }

  return recovered;
}
