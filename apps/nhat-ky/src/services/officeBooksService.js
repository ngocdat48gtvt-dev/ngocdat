import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  writeBatch
} from "firebase/firestore";
import { db } from "../firebase/firebase";

/**
 * Sổ nội nghiệp trên Firestore — KHÔNG đụng users/{uid}/incidents.
 *
 * users/{uid}/office_books/{roadId}              ← reportMeta (meta)
 * users/{uid}/office_books/{roadId}/days/{date}  ← entries[] + dayMeta
 */

const SCHEMA_VERSION = 1;

function bookRef(uid, roadId) {
  return doc(db, "users", uid, "office_books", roadId);
}

function dayRef(uid, roadId, date) {
  return doc(db, "users", uid, "office_books", roadId, "days", date);
}

function daysCol(uid, roadId) {
  return collection(db, "users", uid, "office_books", roadId, "days");
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

export async function pushOfficeBookMeta(uid, roadId, reportMeta) {
  if (!uid || !roadId) return;
  await setDoc(
    bookRef(uid, roadId),
    sanitizeForFirestore({
      reportMeta: reportMeta || {},
      updatedAt: serverTimestamp(),
      schemaVersion: SCHEMA_VERSION
    }),
    { merge: true }
  );
}

export async function fetchOfficeBookDay(uid, roadId, date) {
  if (!uid || !roadId || !date) return null;
  try {
    const snap = await getDoc(dayRef(uid, roadId, date));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      date,
      entries: Array.isArray(data.entries) ? data.entries : [],
      dayMeta: data.dayMeta && typeof data.dayMeta === "object" ? data.dayMeta : {},
      updatedAtMs: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : 0
    };
  } catch (err) {
    console.warn("Không đọc được office_books day.", err);
    return null;
  }
}

/** Đọc toàn bộ ngày của một sổ (roadId). */
export async function fetchAllOfficeBookDays(uid, roadId) {
  if (!uid || !roadId) return [];
  try {
    const snap = await getDocs(daysCol(uid, roadId));
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        date: d.id,
        entries: Array.isArray(data.entries) ? data.entries : [],
        dayMeta: data.dayMeta && typeof data.dayMeta === "object" ? data.dayMeta : {},
        updatedAtMs: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : 0
      };
    });
  } catch (err) {
    console.warn("Không đọc được danh sách ngày office_books.", err);
    return [];
  }
}

export async function pushOfficeBookDay(uid, roadId, date, payload) {
  if (!uid || !roadId || !date) return;
  await setDoc(
    dayRef(uid, roadId, date),
    sanitizeForFirestore({
      entries: payload?.entries || [],
      dayMeta: payload?.dayMeta || {},
      updatedAt: serverTimestamp(),
      schemaVersion: SCHEMA_VERSION
    }),
    { merge: true }
  );
}

/**
 * Đẩy nhiều ngày (batch tối đa ~400/ops).
 * @param {Array<{ date: string, entries: any[], dayMeta: object }>} days
 */
export async function pushOfficeBookDays(uid, roadId, days) {
  if (!uid || !roadId || !days?.length) return;
  const CHUNK = 400;
  for (let i = 0; i < days.length; i += CHUNK) {
    const slice = days.slice(i, i + CHUNK);
    const batch = writeBatch(db);
    slice.forEach((day) => {
      batch.set(
        dayRef(uid, roadId, day.date),
        sanitizeForFirestore({
          entries: day.entries || [],
          dayMeta: day.dayMeta || {},
          updatedAt: serverTimestamp(),
          schemaVersion: SCHEMA_VERSION
        }),
        { merge: true }
      );
    });
    await batch.commit();
  }
}

/** Hydrate: meta + tất cả days → object storage local. */
export async function fetchOfficeBookAsStorage(uid, roadId) {
  const [reportMeta, dayDocs] = await Promise.all([
    fetchOfficeBookMeta(uid, roadId),
    fetchAllOfficeBookDays(uid, roadId)
  ]);
  const entries = [];
  const dayMeta = {};
  dayDocs.forEach((d) => {
    (d.entries || []).forEach((e) => entries.push(e));
    if (d.dayMeta && Object.keys(d.dayMeta).length) {
      dayMeta[d.date] = d.dayMeta;
    }
  });
  return {
    entries,
    dayMeta,
    reportMeta: reportMeta || {},
    remoteDayCount: dayDocs.length
  };
}
