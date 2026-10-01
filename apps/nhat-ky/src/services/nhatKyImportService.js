import {
  fetchImportMapFromFirestore,
  saveImportMapToFirestore
} from "./nhatKyMetaService";
import { loadStorage, reconcileImportMap } from "../utils/nhatKyFormat";

function cacheImportMapLocally(storageKey, importMap) {
  const current = loadStorage(storageKey);
  localStorage.setItem(
    storageKey,
    JSON.stringify({
      ...current,
      importMap: importMap || {}
    })
  );
}

function mapsEqual(a, b) {
  const ak = Object.keys(a || {});
  const bk = Object.keys(b || {});
  if (ak.length !== bk.length) return false;
  return ak.every((k) => JSON.stringify(a[k]) === JSON.stringify(b[k]));
}

/**
 * Firestore là nguồn chính; khi local đã gỡ id (xoá dòng NK) thì không để remote đè lại.
 * Đồng thời reconcile theo entries của sổ đang mở.
 */
export async function loadImportMap(uid, storageKey) {
  const stored = loadStorage(storageKey);
  const localMap = stored.importMap || {};
  const entries = stored.entries || [];

  if (!uid) {
    return reconcileImportMap(entries, localMap, storageKey);
  }

  try {
    const remoteMap = (await fetchImportMapFromFirestore(uid)) || {};
    const merged = { ...remoteMap, ...localMap };
    const reconciled = reconcileImportMap(entries, merged, storageKey);

    cacheImportMapLocally(storageKey, reconciled);

    // Local/entries đã bỏ id mà remote vẫn còn → đẩy lại cloud (tránh tick bị khóa)
    if (!mapsEqual(reconciled, remoteMap)) {
      try {
        await saveImportMapToFirestore(uid, reconciled);
      } catch (err) {
        console.warn("Không đồng bộ importMap đã reconcile lên Firestore.", err);
      }
    }

    return reconciled;
  } catch (err) {
    console.warn("Không đọc được importMap từ Firestore, dùng bản local.", err);
    return reconcileImportMap(entries, localMap, storageKey);
  }
}

export async function persistImportMap(uid, storageKey, importMap) {
  const map = importMap && typeof importMap === "object" ? importMap : {};
  cacheImportMapLocally(storageKey, map);
  if (uid) {
    await saveImportMapToFirestore(uid, map);
  }
  return map;
}

/**
 * Sau khi lưu/xoá NK: gộp map remote + local, gỡ id không còn trên sổ này, ghi Firestore.
 */
export async function persistImportMapFromEntries(uid, storageKey, entries) {
  const current = loadStorage(storageKey);
  let base = { ...(current.importMap || {}) };

  if (uid) {
    try {
      const remoteMap = (await fetchImportMapFromFirestore(uid)) || {};
      base = { ...remoteMap, ...base };
    } catch (err) {
      console.warn("Không đọc importMap remote trước khi persist.", err);
    }
  }

  const reconciled = reconcileImportMap(entries, base, storageKey);
  return persistImportMap(uid, storageKey, reconciled);
}

export function loadImportMapLocal(storageKey) {
  return loadStorage(storageKey).importMap || {};
}
