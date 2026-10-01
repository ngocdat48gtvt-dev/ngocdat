import { loadStorage, migrateEntry, saveStorage } from "./nhatKyFormat";
import {
  activeDiaryEntries,
  mergeOfficeBookDayWithoutBase,
  mergeReportMeta
} from "./officeBooksConflictMerge";

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

/**
 * Gộp các ngày cloud vào danh sách đang có — chỉ trong bộ nhớ, không ghi localStorage.
 * Ngày cloud không có thì giữ nguyên dòng local.
 */
export function overlayRemoteDaysInMemory(localEntries, localDayMeta, remote) {
  const remoteDays = remote?.remoteDays || [];
  if (!remoteDays.length) {
    return {
      entries: activeDiaryEntries(localEntries || []),
      dayMeta: { ...(localDayMeta || {}) }
    };
  }
  const dates = new Set(remoteDays.map((day) => day.date));
  const kept = (localEntries || []).filter((entry) => !dates.has(String(entry?.date || "")));
  const dayMeta = { ...(localDayMeta || {}) };
  const localByDate = new Map();
  (localEntries || []).forEach((entry) => {
    const date = String(entry?.date || "");
    if (!dates.has(date)) return;
    if (!localByDate.has(date)) localByDate.set(date, []);
    localByDate.get(date).push(entry);
  });
  const merged = [];
  remoteDays.forEach((rem) => {
    const date = rem.date;
    const day = mergeOfficeBookDayWithoutBase(
      { entries: localByDate.get(date) || [], dayMeta: dayMeta[date] || {} },
      rem
    );
    (day.entries || []).forEach((entry) => merged.push(entry));
    if (day.dayMeta && Object.keys(day.dayMeta).length) dayMeta[date] = day.dayMeta;
  });
  return { entries: activeDiaryEntries([...kept, ...merged]), dayMeta };
}

function groupEntriesByDate(entries) {
  const map = new Map();
  (entries || []).forEach((entry) => {
    const date = String(entry.date || "").trim();
    if (!DATE_RE.test(date)) return;
    if (!map.has(date)) map.set(date, []);
    map.get(date).push(entry);
  });
  return map;
}

/**
 * Gộp days từ cloud thành payload localStorage.
 * preferRemote: ưu tiên cloud (ghi đè khi cloud ≥ local; từng ngày lấy phía nhiều dòng hơn).
 */
export function mergeRemoteIntoLocalStorage(storageKey, remote, { replace = false, preferRemote = false } = {}) {
  const local = loadStorage(storageKey, { includeDeleted: true });
  const remoteEntries = (remote?.entries || []).map(migrateEntry);
  const remoteDayMeta = remote?.dayMeta || {};
  const remoteMeta = remote?.reportMeta || {};
  const localEntries = (local.entries || []).map(migrateEntry);

  const preserveNtPerson = (base) => {
    const loc = local.reportMeta || {};
    const out = { ...base };
    const keys = [
      "ntGoiThau",
      "ntBanQlbtTen",
      "ntBanQlbtChucVu",
      "ntNhaThauTen",
      "ntNhaThauChucVu",
      "ntNhaThauDonVi",
      "ntPersonnelSaved",
      "nghiemThuDefaults"
    ];
    keys.forEach((k) => {
      if (out[k] == null && loc[k] != null) out[k] = loc[k];
    });
    return out;
  };

  if (replace || !localEntries.length) {
    saveStorage(
      remoteEntries,
      remoteDayMeta,
      preserveNtPerson(
        replace || preferRemote
          ? { ...remoteMeta }
          : { ...remoteMeta, ...local.reportMeta }
      ),
      storageKey,
      { silent: true }
    );
    return loadStorage(storageKey);
  }

  const localByDate = groupEntriesByDate(localEntries);
  const remoteByDate = groupEntriesByDate(remoteEntries);
  const dates = new Set([...localByDate.keys(), ...remoteByDate.keys()]);
  const mergedEntries = [];
  const mergedDayMeta = {};

  dates.forEach((date) => {
    const loc = localByDate.get(date) || [];
    const rem = remoteByDate.get(date) || [];
    const useRemote =
      (!loc.length && rem.length > 0) ||
      (loc.length > 0 && rem.length > 0 && preferRemote && rem.length >= loc.length);

    (useRemote ? rem : loc).forEach((e) => mergedEntries.push(e));

    const localMeta = local.dayMeta?.[date];
    const remMeta = remoteDayMeta[date];
    if (useRemote) {
      if (remMeta) mergedDayMeta[date] = remMeta;
      else if (localMeta) mergedDayMeta[date] = localMeta;
    } else if (localMeta) {
      mergedDayMeta[date] = localMeta;
    } else if (remMeta) {
      mergedDayMeta[date] = remMeta;
    }
  });

  mergedEntries.sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const localCv = Array.isArray(local.reportMeta?.contractVolumes)
    ? local.reportMeta.contractVolumes
    : [];
  const remoteCv = Array.isArray(remoteMeta.contractVolumes) ? remoteMeta.contractVolumes : [];
  const reportMeta = preferRemote
    ? preserveNtPerson({
        ...local.reportMeta,
        ...remoteMeta,
        contractVolumes: remoteCv.length >= localCv.length ? remoteCv : localCv
      })
    : {
        ...remoteMeta,
        ...local.reportMeta,
        contractVolumes: localCv.length ? localCv : remoteCv
      };

  saveStorage(mergedEntries, mergedDayMeta, reportMeta, storageKey, { silent: true });
  return loadStorage(storageKey);
}

/**
 * Hydrate an toàn khi không biết common ancestor: union theo recordId, không so `.length`
 * và không suy record vắng mặt là delete. Tombstone cloud/local vẫn thắng snapshot sống.
 */
export function mergeRemoteSafelyIntoLocalStorage(storageKey, remote) {
  const local = loadStorage(storageKey, { includeDeleted: true });
  const localLive = activeDiaryEntries(local.entries || []);
  const localHasTombs = (local.entries || []).some((e) => e?.deletedAt);
  // Máy trống hoàn toàn: ghi thẳng cloud, không merge (tránh lệch id / prune phụ).
  if (!localLive.length && !localHasTombs) {
    const entries = [];
    const dayMeta = {};
    (remote?.remoteDays || []).forEach((day) => {
      activeDiaryEntries(day.entries || []).forEach((entry) => entries.push(entry));
      if (day.dayMeta && Object.keys(day.dayMeta).length) {
        dayMeta[day.date] = day.dayMeta;
      }
    });
    const remoteMeta =
      remote?.reportMeta && typeof remote.reportMeta === "object" ? remote.reportMeta : {};
    saveStorage(entries, dayMeta, { ...remoteMeta }, storageKey, {
      silent: true,
      replaceAll: true
    });
    const written = loadStorage(storageKey, { includeDeleted: true });
    if (!activeDiaryEntries(written.entries || []).length && entries.length) {
      throw new Error("Không ghi được sổ tuần đường vào trình duyệt (bộ nhớ đầy).");
    }
    return written;
  }

  const localDays = new Map(splitStorageByDay(local).map((day) => [day.date, day]));
  const remoteDays = new Map(
    (remote?.remoteDays || []).map((day) => [day.date, day])
  );
  const dates = new Set([...localDays.keys(), ...remoteDays.keys()]);
  const entries = [];
  const dayMeta = {};

  dates.forEach((date) => {
    const loc = localDays.get(date) || { entries: [], dayMeta: {} };
    const rem = remoteDays.get(date) || { entries: [], dayMeta: {} };
    const merged = mergeOfficeBookDayWithoutBase(loc, rem);
    (merged.entries || []).forEach((entry) => entries.push(entry));
    if (Object.keys(merged.dayMeta || {}).length) dayMeta[date] = merged.dayMeta;
  });

  const meta = mergeReportMeta({}, local.reportMeta || {}, remote?.reportMeta || {});
  const ok = saveStorage(entries, dayMeta, meta.value, storageKey, { silent: true, replaceAll: true });
  if (!ok) {
    throw new Error("Không ghi được sổ tuần đường vào trình duyệt (bộ nhớ đầy).");
  }
  return loadStorage(storageKey);
}

/** Apply canonical transaction results locally without scheduling another push. */
export function applySyncedDayResults(storageKey, results) {
  const list = (results || []).filter(Boolean);
  if (!list.length) return loadStorage(storageKey);
  const current = loadStorage(storageKey, { includeDeleted: true });
  const dates = new Set(list.map((result) => result.date));
  const entries = (current.entries || []).filter(
    (entry) => !dates.has(String(entry.date || ""))
  );
  const dayMeta = { ...(current.dayMeta || {}) };
  list.forEach((result) => {
    const dayEntries = result.rawEntries || result.entries || [];
    dayEntries.forEach((entry) => entries.push(entry));
    if (result.dayMeta && Object.keys(result.dayMeta).length) {
      dayMeta[result.date] = result.dayMeta;
    } else {
      delete dayMeta[result.date];
    }
  });
  saveStorage(entries, dayMeta, current.reportMeta, storageKey, {
    silent: true,
    replaceAll: true
  });
  return loadStorage(storageKey, { includeDeleted: true });
}

export function applySyncedReportMeta(storageKey, reportMeta) {
  const current = loadStorage(storageKey, { includeDeleted: true });
  saveStorage(
    current.entries || [],
    current.dayMeta || {},
    reportMeta || {},
    storageKey,
    { silent: true }
  );
  return loadStorage(storageKey);
}
