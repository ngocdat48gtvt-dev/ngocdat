const DB_NAME = "nhatky-office-sync";
const DB_VERSION = 1;
const STORE_NAME = "pending-books";

function openDb() {
  if (!globalThis.indexedDB) return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "storageKey" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

function runTransaction(mode, action) {
  return openDb().then(
    (db) =>
      new Promise((resolve) => {
        if (!db) {
          resolve(null);
          return;
        }
        let settled = false;
        const finish = (value) => {
          if (settled) return;
          settled = true;
          try {
            db.close();
          } catch {
            /* ignore */
          }
          resolve(value);
        };
        try {
          const tx = db.transaction(STORE_NAME, mode);
          const store = tx.objectStore(STORE_NAME);
          const request = action(store);
          let result = true;
          request.onsuccess = () => {
            result = request.result ?? true;
          };
          request.onerror = () => finish(null);
          tx.oncomplete = () => finish(result);
          tx.onerror = () => finish(null);
          tx.onabort = () => finish(null);
        } catch {
          finish(null);
        }
      })
  );
}

/** Lưu toàn bộ snapshot chưa xác nhận cloud vào IndexedDB. */
export function savePendingOfficeBook(storageKey, snapshot) {
  if (!storageKey || !snapshot) return Promise.resolve(false);
  return runTransaction("readwrite", (store) =>
    store.put({
      storageKey,
      snapshot,
      updatedAt: Date.now()
    })
  ).then(Boolean);
}

/** Đọc snapshot pending sau F5/mất mạng/đầy localStorage. */
export function loadPendingOfficeBook(storageKey) {
  if (!storageKey) return Promise.resolve(null);
  return runTransaction("readonly", (store) => store.get(storageKey)).then(
    (record) => record?.snapshot || null
  );
}

/** Chỉ xóa pending sau khi toàn bộ snapshot hiện tại đã được cloud xác nhận. */
export function clearPendingOfficeBook(storageKey) {
  if (!storageKey) return Promise.resolve(false);
  return runTransaction("readwrite", (store) => store.delete(storageKey)).then(Boolean);
}
