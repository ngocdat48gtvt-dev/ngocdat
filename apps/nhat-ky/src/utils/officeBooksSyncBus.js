/**
 * Bus nhẹ — saveStorage báo có thay đổi để hook sync đẩy lên Firestore.
 * Tránh circular import giữa nhatKyFormat và hook React.
 */
const listeners = new Set();

export function subscribeOfficeBooksLocalChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notifyOfficeBooksLocalChange(storageKey) {
  listeners.forEach((fn) => {
    try {
      fn(storageKey);
    } catch (err) {
      console.warn("officeBooks local change listener lỗi.", err);
    }
  });
}
