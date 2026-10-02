import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocFromServer,
  getDocs,
  getDocsFromServer,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  startAfter,
  Timestamp,
  where
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import {
  activeDiaryEntries,
  ensureDiaryRecordIds,
  mergeOfficeBookDay,
  mergeReportMeta
} from "../utils/officeBooksConflictMerge";

/**
 * Sổ nội nghiệp trên Firestore — KHÔNG đụng users/{uid}/incidents.
 *
 * users/{uid}/office_books/{roadId}              ← reportMeta (meta)
 * users/{uid}/office_books/{roadId}/days/{date}  ← entries[] + dayMeta
 */

const SCHEMA_VERSION = 2;

function bookRef(uid, roadId) {
  return doc(db, "users", uid, "office_books", roadId);
}

function dayRef(uid, roadId, date) {
  return doc(db, "users", uid, "office_books", roadId, "days", date);
}

function daysCol(uid, roadId) {
  return collection(db, "users", uid, "office_books", roadId, "days");
}

/** Field meta trên document ngày — không phải nội dung nhật ký. */
const DAY_DOC_META_KEYS = new Set([
  "entries",
  "dayMeta",
  "revision",
  "schemaVersion",
  "updatedAt",
  "syncConflictSummary",
  "_syncConflicts",
  "metaRevision",
  "reportMeta"
]);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isDiaryEntryShape(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
  return (
    obj.type != null ||
    obj.section != null ||
    obj.workType != null ||
    obj.unit != null ||
    obj.content != null ||
    obj.tngtNote != null ||
    obj.location != null ||
    obj.kmFrom != null ||
    obj.quantity != null
  );
}

function stampEntryDate(entry, dateId) {
  if (!entry || typeof entry !== "object") return entry;
  const own = String(entry.date || "").trim();
  if (DATE_RE.test(own)) return entry;
  if (DATE_RE.test(dateId)) return { ...entry, date: dateId };
  return entry;
}

function coerceEntryList(raw) {
  if (Array.isArray(raw)) {
    return raw.filter((e) => e && typeof e === "object" && !Array.isArray(e));
  }
  if (isDiaryEntryShape(raw)) return [raw];
  if (raw && typeof raw === "object") {
    return Object.keys(raw)
      .sort((a, b) => Number(a) - Number(b) || String(a).localeCompare(String(b)))
      .map((k) => raw[k])
      .filter((e) => e && typeof e === "object" && !Array.isArray(e));
  }
  return [];
}

/**
 * Đọc entries từ document ngày.
 * Bản mới: { entries: [...] }.
 * Bản cũ: 1 dòng nằm thẳng trên document; thiếu field date thì lấy id ngày.
 */
function entriesFromDayData(data, dateId = "") {
  if (!data || typeof data !== "object") return [];
  let listed = coerceEntryList(data.entries);
  if (!listed.length && isDiaryEntryShape(data)) {
    const entry = {};
    for (const [key, value] of Object.entries(data)) {
      if (DAY_DOC_META_KEYS.has(key)) continue;
      entry[key] = value;
    }
    if (Object.keys(entry).length) listed = [entry];
  }
  return listed.map((e) => stampEntryDate(e, dateId));
}

/** Firestore không chấp nhận undefined. */
export function sanitizeForFirestore(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export async function fetchOfficeBookMeta(uid, roadId) {
  if (!uid || !roadId) return null;
  try {
    const snap = await getDoc(bookRef(uid, roadId));
    if (!snap.exists()) return null;
    const data = snap.data();
    return data.reportMeta && typeof data.reportMeta === "object" ? data.reportMeta : null;
  } catch (err) {
    console.warn("Không đọc được office_books meta.", err);
    return null;
  }
}

export async function fetchOfficeBookMetaState(uid, roadId) {
  if (!uid || !roadId) return { reportMeta: {}, revision: 0 };
  // Lỗi mạng phải throw. Trả {} giả khiến lần hydrate sau ghi đè meta đang có.
  const snap = await withFirestoreRetry(() => getDocFromServer(bookRef(uid, roadId)));
  if (!snap.exists()) return { reportMeta: {}, revision: 0 };
  const data = snap.data() || {};
  return {
    reportMeta:
      data.reportMeta && typeof data.reportMeta === "object" ? data.reportMeta : {},
    revision: Number(data.metaRevision) || 0
  };
}

/** Merge ba chiều theo field; không còn ghi đè nguyên reportMeta từ snapshot cũ. */
export async function pushOfficeBookMeta(
  uid,
  roadId,
  reportMeta,
  { baseMeta = null, baseRevision = null } = {}
) {
  if (!uid || !roadId) return;
  return runTransaction(db, async (transaction) => {
    const ref = bookRef(uid, roadId);
    const snap = await transaction.get(ref);
    const data = snap.exists() ? snap.data() : {};
    const remoteMeta =
      data.reportMeta && typeof data.reportMeta === "object" ? data.reportMeta : {};
    const remoteRevision = Number(data.metaRevision) || 0;
    const baseline = baseMeta && typeof baseMeta === "object" ? baseMeta : remoteMeta;
    const merged = mergeReportMeta(baseline, reportMeta || {}, remoteMeta);
    const nextRevision = remoteRevision + 1;
    transaction.set(
      ref,
      {
        ...sanitizeForFirestore({
          reportMeta: merged.value,
          metaRevision: nextRevision,
          schemaVersion: SCHEMA_VERSION,
          ...(merged.conflicts.length
            ? {
                syncConflicts: {
                  reportMeta: merged.conflicts,
                  expectedRevision: Number(baseRevision) || 0,
                  remoteRevision
                }
              }
            : {})
        }),
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
    return {
      reportMeta: merged.value,
      revision: nextRevision,
      conflicts: merged.conflicts
    };
  });
}

export async function fetchOfficeBookDay(uid, roadId, date) {
  if (!uid || !roadId || !date) return null;
  try {
    const snap = await getDoc(dayRef(uid, roadId, date));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      date,
      entries: entriesFromDayData(data, date),
      dayMeta: data.dayMeta && typeof data.dayMeta === "object" ? data.dayMeta : {},
      updatedAtMs: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : 0,
      revision: Number(data.revision) || 0
    };
  } catch (err) {
    console.warn("Không đọc được office_books day.", err);
    return null;
  }
}

function isTransientFirestoreError(err) {
  const code = String(err?.code || "").toLowerCase();
  return (
    code.includes("unavailable") ||
    code.includes("deadline-exceeded") ||
    code.includes("aborted") ||
    code.includes("cancelled") ||
    code.includes("resource-exhausted") ||
    code.includes("internal")
  );
}

async function withFirestoreRetry(run, tries = 3) {
  let lastErr;
  for (let i = 0; i < tries; i += 1) {
    try {
      return await run();
    } catch (err) {
      lastErr = err;
      if (!isTransientFirestoreError(err) || i === tries - 1) throw err;
      await new Promise((resolve) => setTimeout(resolve, 400 * (i + 1)));
    }
  }
  throw lastErr;
}

function dayFromDoc(d) {
  const data = d.data() || {};
  return {
    date: d.id,
    entries: entriesFromDayData(data, d.id),
    dayMeta: data.dayMeta && typeof data.dayMeta === "object" ? data.dayMeta : {},
    updatedAtMs: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : 0,
    revision: Number(data.revision) || 0
  };
}

/**
 * Đọc ngày từ server, chia trang. Một lần getDocs cả sổ dễ timeout
 * rồi trả như sổ trống — đọc lại từng trang, lỗi mạng thì thử lại.
 */
async function fetchDayDocsFallback(uid, roadId, { dateFrom = "", dateTo = "" } = {}) {
  const constraints = [];
  if (dateFrom) constraints.push(where(documentId(), ">=", dateFrom));
  if (dateTo) constraints.push(where(documentId(), "<=", dateTo));
  const snap = await withFirestoreRetry(() =>
    constraints.length
      ? getDocs(query(daysCol(uid, roadId), ...constraints))
      : getDocs(daysCol(uid, roadId))
  );
  return snap.docs.map(dayFromDoc);
}

async function fetchDayDocsPaged(uid, roadId, { dateFrom = "", dateTo = "", onPartial } = {}) {
  const pageSize = 20;
  const days = [];
  let cursor = null;
  try {
    for (;;) {
      const constraints = [orderBy(documentId()), limit(pageSize)];
      if (dateFrom) constraints.push(where(documentId(), ">=", dateFrom));
      if (dateTo) constraints.push(where(documentId(), "<=", dateTo));
      if (cursor) constraints.push(startAfter(cursor));
      const snap = await withFirestoreRetry(() =>
        getDocsFromServer(query(daysCol(uid, roadId), ...constraints))
      );
      const page = snap.docs.map(dayFromDoc);
      page.forEach((day) => days.push(day));
      if (page.length) onPartial?.(page);
      if (snap.docs.length < pageSize) break;
      cursor = snap.docs[snap.docs.length - 1];
    }
    return days;
  } catch (err) {
    console.warn("Đọc sổ theo trang thất bại, đọc nguyên collection.", err);
    const all = await fetchDayDocsFallback(uid, roadId, { dateFrom, dateTo });
    if (all.length) onPartial?.(all);
    return all;
  }
}

/** Đọc toàn bộ ngày của một sổ (roadId). Lỗi mạng/quyền → throw (không trả [] giả). */
export async function fetchAllOfficeBookDays(uid, roadId, opts = {}) {
  if (!uid || !roadId) return [];
  return fetchDayDocsPaged(uid, roadId, opts);
}

/**
 * Đồng bộ tăng dần: chỉ đọc các ngày đã thay đổi sau lần hydrate thành công gần nhất.
 * Document legacy không có updatedAt vẫn được lấy trong lần đồng bộ đầy đủ đầu tiên.
 * Nếu Firestore thiếu index / lỗi query → trả null để caller fallback full sync.
 */
export async function fetchOfficeBookDaysSince(uid, roadId, sinceMs) {
  if (!uid || !roadId || !Number.isFinite(sinceMs) || sinceMs <= 0) return [];
  try {
    const snap = await getDocs(
      query(daysCol(uid, roadId), where("updatedAt", ">", Timestamp.fromMillis(sinceMs)))
    );
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        date: d.id,
        entries: entriesFromDayData(data, d.id),
        dayMeta: data.dayMeta && typeof data.dayMeta === "object" ? data.dayMeta : {},
        updatedAtMs: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : 0,
        revision: Number(data.revision) || 0
      };
    });
  } catch (err) {
    console.warn("Đồng bộ tăng dần office_books thất bại — sẽ tải đầy đủ.", err);
    return null;
  }
}

/** Đọc đúng khoảng ngày cho báo cáo, thay vì quét toàn bộ lịch sử của sổ. */
export async function fetchOfficeBookDaysInRange(uid, roadId, dateFrom, dateTo) {
  if (!uid || !roadId) return [];
  if (!dateFrom && !dateTo) return fetchAllOfficeBookDays(uid, roadId);
  return fetchDayDocsPaged(uid, roadId, { dateFrom, dateTo });
}

export async function pushOfficeBookDay(uid, roadId, date, payload) {
  if (!uid || !roadId || !date) return;
  return pushOfficeBookDaySafely(uid, roadId, date, payload);
}

/**
 * Transaction + merge ba chiều ở cấp record. Path cũ và entries[] cũ vẫn được giữ.
 * Tombstone chỉ là field optional nên client/record legacy vẫn đọc được.
 */
export async function pushOfficeBookDaySafely(
  uid,
  roadId,
  date,
  payload,
  { baseDay = null, baseRevision = null } = {}
) {
  if (!uid || !roadId || !date) return null;
  return runTransaction(db, async (transaction) => {
    const ref = dayRef(uid, roadId, date);
    const snap = await transaction.get(ref);
    const data = snap.exists() ? snap.data() : {};
    const remoteDay = {
      entries: entriesFromDayData(data, date),
      dayMeta: data.dayMeta && typeof data.dayMeta === "object" ? data.dayMeta : {}
    };
    const remoteRevision = Number(data.revision) || 0;
    const baseline = baseDay && typeof baseDay === "object" ? baseDay : remoteDay;
    const localDay = {
      entries: ensureDiaryRecordIds(payload?.entries || []),
      dayMeta: payload?.dayMeta || {}
    };
    const merged = mergeOfficeBookDay(baseline, localDay, remoteDay);
    const nextRevision = remoteRevision + 1;
    transaction.set(
      ref,
      {
        ...sanitizeForFirestore({
          entries: merged.entries,
          dayMeta: merged.dayMeta,
          revision: nextRevision,
          schemaVersion: SCHEMA_VERSION,
          ...(merged.conflicts.length
            ? {
                syncConflictSummary: {
                  count: merged.conflicts.length,
                  expectedRevision: Number(baseRevision) || 0,
                  remoteRevision,
                  detectedAt: new Date().toISOString()
                }
              }
            : {})
        }),
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
    return {
      date,
      entries: activeDiaryEntries(merged.entries),
      rawEntries: merged.entries,
      dayMeta: merged.dayMeta,
      revision: nextRevision,
      conflicts: merged.conflicts
    };
  });
}

/**
 * Đẩy nhiều ngày (batch tối đa ~400/ops).
 * @param {Array<{ date: string, entries: any[], dayMeta: object }>} days
 */
export async function pushOfficeBookDays(uid, roadId, days, { baseDays = null } = {}) {
  if (!uid || !roadId || !days?.length) return;
  const results = [];
  for (const day of days) {
    const base = baseDays?.get?.(day.date) || baseDays?.[day.date] || null;
    results.push(
      await pushOfficeBookDaySafely(uid, roadId, day.date, day, {
        baseDay: base,
        baseRevision: base?.revision
      })
    );
  }
  return results;
}

function storageFromDayDocs(dayDocs, metaState, flags = {}) {
  const entries = [];
  const dayMeta = {};
  (dayDocs || []).forEach((d) => {
    activeDiaryEntries(d.entries || []).forEach((e) => {
      entries.push(stampEntryDate(e, d.date));
    });
    if (d.dayMeta && Object.keys(d.dayMeta).length) {
      dayMeta[d.date] = d.dayMeta;
    }
  });
  return {
    entries,
    dayMeta,
    reportMeta: metaState?.reportMeta || {},
    metaRevision: metaState?.revision || 0,
    remoteDayCount: (dayDocs || []).length,
    remoteDays: dayDocs || [],
    incremental: !!flags.incremental,
    ranged: !!flags.ranged
  };
}

/** Hydrate: meta + days → object storage local. */
export async function fetchOfficeBookAsStorage(
  uid,
  roadId,
  { sinceMs = 0, dateFrom = "", dateTo = "", onPartial } = {}
) {
  const wantIncremental = Number.isFinite(sinceMs) && sinceMs > 0;
  const ranged = Boolean(dateFrom || dateTo);
  let metaState = { reportMeta: {}, revision: 0 };
  try {
    metaState = await fetchOfficeBookMetaState(uid, roadId);
  } catch (err) {
    // Meta lỗi không được chặn phần nhật ký — trước đây cả sổ thành trang trống.
    console.warn("Không đọc được meta sổ, vẫn tải các ngày.", err);
  }

  let dayDocs;
  let incremental = false;

  const reportPartial = (days) => {
    if (typeof onPartial !== "function" || !days?.length) return;
    onPartial(storageFromDayDocs(days, metaState, { incremental: false, ranged }));
  };

  if (ranged) {
    dayDocs = await fetchDayDocsPaged(uid, roadId, { dateFrom, dateTo, onPartial: reportPartial });
  } else if (wantIncremental) {
    const sinceDocs = await fetchOfficeBookDaysSince(uid, roadId, sinceMs);
    if (sinceDocs == null) {
      // Query tăng dần lỗi (index / quyền) → tải đủ để không bỏ trống sổ.
      dayDocs = await fetchAllOfficeBookDays(uid, roadId, { onPartial: reportPartial });
      incremental = false;
    } else {
      dayDocs = sinceDocs;
      incremental = true;
    }
  } else {
    dayDocs = await fetchAllOfficeBookDays(uid, roadId, { onPartial: reportPartial });
  }

  return storageFromDayDocs(dayDocs, metaState, { incremental, ranged });
}
