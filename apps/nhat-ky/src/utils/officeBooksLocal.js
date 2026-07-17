import { loadStorage, migrateEntry, saveStorage } from "./nhatKyFormat";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Tách blob local thành các ngày để đẩy lên office_books/.../days/{date}. */
export function splitStorageByDay(stored) {
  const entries = (stored?.entries || []).map(migrateEntry);
  const dayMetaMap = stored?.dayMeta || {};
  const byDate = {};

  entries.forEach((entry) => {
    const date = String(entry.date || "").trim();
    if (!DATE_RE.test(date)) return;
    if (!byDate[date]) byDate[date] = { date, entries: [], dayMeta: {} };
    byDate[date].entries.push(entry);
  });

  Object.keys(dayMetaMap).forEach((date) => {
    if (!DATE_RE.test(date)) return;
    if (!byDate[date]) byDate[date] = { date, entries: [], dayMeta: {} };
    byDate[date].dayMeta = { ...(dayMetaMap[date] || {}) };
  });

  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
}

/** Gộp days từ cloud thành payload localStorage. */
export function mergeRemoteIntoLocalStorage(storageKey, remote, { replace = false } = {}) {
  const local = loadStorage(storageKey);
  const remoteEntries = (remote?.entries || []).map(migrateEntry);
  const remoteDayMeta = remote?.dayMeta || {};
  const remoteMeta = remote?.reportMeta || {};

  if (replace || !(local.entries || []).length) {
    saveStorage(
      remoteEntries,
      remoteDayMeta,
      replace ? { ...remoteMeta } : { ...remoteMeta, ...local.reportMeta },
      storageKey,
      { silent: true }
    );
    return loadStorage(storageKey);
  }

  // Merge: remote bổ sung ngày local chưa có; ngày đã có giữ local (user đang làm việc).
  const localDates = new Set(
    (local.entries || []).map((e) => e.date).filter((d) => DATE_RE.test(d))
  );
  const mergedEntries = [...(local.entries || []).map(migrateEntry)];
  const mergedDayMeta = { ...(local.dayMeta || {}) };

  remoteEntries.forEach((e) => {
    if (!localDates.has(e.date)) mergedEntries.push(e);
  });
  Object.keys(remoteDayMeta).forEach((date) => {
    if (!mergedDayMeta[date]) mergedDayMeta[date] = remoteDayMeta[date];
  });

  // Merge reportMeta: local thắng field-by-field, nhưng mảng rỗng không đè remote có dữ liệu.
  const localCv = Array.isArray(local.reportMeta?.contractVolumes)
    ? local.reportMeta.contractVolumes
    : [];
  const remoteCv = Array.isArray(remoteMeta.contractVolumes) ? remoteMeta.contractVolumes : [];
  const reportMeta = {
    ...remoteMeta,
    ...local.reportMeta,
    contractVolumes: localCv.length ? localCv : remoteCv
  };

  saveStorage(mergedEntries, mergedDayMeta, reportMeta, storageKey, { silent: true });
  return loadStorage(storageKey);
}
