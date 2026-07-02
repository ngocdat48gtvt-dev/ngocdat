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

/** Firestore là nguồn chính; localStorage là cache offline. */
export async function loadImportMap(uid, storageKey) {
  const localMap = loadStorage(storageKey).importMap || {};

  if (!uid) return localMap;

  try {
    const remoteMap = await fetchImportMapFromFirestore(uid);
    if (remoteMap !== null) {
      if (Object.keys(remoteMap).length > 0 || Object.keys(localMap).length === 0) {
        cacheImportMapLocally(storageKey, remoteMap);
        return remoteMap;
      }
    }
  } catch (err) {
    console.warn("Không đọc được importMap từ Firestore, dùng bản local.", err);
  }

  if (Object.keys(localMap).length > 0) {
    try {
      await saveImportMapToFirestore(uid, localMap);
    } catch (err) {
      console.warn("Không đẩy importMap local lên Firestore.", err);
    }
  }

  return localMap;
}

export async function persistImportMap(uid, storageKey, importMap) {
  const map = importMap && typeof importMap === "object" ? importMap : {};
  cacheImportMapLocally(storageKey, map);
  if (uid) {
    await saveImportMapToFirestore(uid, map);
  }
  return map;
}

export async function persistImportMapFromEntries(uid, storageKey, entries) {
  const current = loadStorage(storageKey);
  const reconciled = reconcileImportMap(entries, current.importMap);
  return persistImportMap(uid, storageKey, reconciled);
}

export function loadImportMapLocal(storageKey) {
  return loadStorage(storageKey).importMap || {};
}
