import { collection, documentId, getDocsFromServer, limit, orderBy, query, startAfter, where } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { fetchAllOfficeBookDays } from "./officeBooksService";
import { fetchOfficeRoadsCatalog } from "./officeRoadsCatalogService";
import { diaryBusinessFingerprint } from "../utils/officeBooksConflictMerge";

// Read-only audit. No restoration, writes, or changes to the user's local books.
async function readCollection(ref) {
  const docs = [];
  let cursor;
  while (true) {
    const page = await getDocsFromServer(query(ref, orderBy(documentId()), limit(50), ...(cursor ? [startAfter(cursor)] : [])));
    docs.push(...page.docs);
    if (page.size < 50) return docs;
    cursor = page.docs[page.size - 1];
  }
}

export async function auditOfficeBooks(profile, onProgress) {
  const isAdmin = profile?.officeRole === "admin" || profile?.role === "ADMIN";
  let users = [{ uid: profile.uid, name: profile.displayName || profile.email }];
  if (isAdmin) {
    if (!profile.companyId) throw new Error("Tài khoản admin chưa có mã công ty.");
    const snap = await getDocsFromServer(query(collection(db, "users"), where("companyId", "==", profile.companyId), where("role", "==", "USER")));
    users = snap.docs.map((doc) => ({ uid: doc.id, name: doc.data().name || doc.data().displayName || doc.data().email || doc.id }));
  }
  const report = { createdAt: new Date().toISOString(), users: [], days: [], errors: [] };
  for (const user of users) {
    onProgress?.(`Đang đọc ${user.name} (${report.users.length + 1}/${users.length})…`);
    const result = { ...user, books: 0, days: 0, liveRows: 0, deletedRows: 0, affectedDays: 0 };
    try {
      const bookDocs = await readCollection(collection(db, "users", user.uid, "office_books"));
      const books = new Map(bookDocs.map((book) => [book.id, { id: book.id, roadName: book.data().reportMeta?.roadName || book.id }]));
      // Firestore can retain day subcollections even when the parent book document is absent.
      // Include every assigned road as well as existing parent documents.
      try {
        const catalog = await fetchOfficeRoadsCatalog(user.uid);
        for (const road of catalog.roads) {
          if (road.id) books.set(road.id, { id: road.id, roadName: road.roadName || road.label || books.get(road.id)?.roadName || road.id });
        }
      } catch (error) { report.errors.push({ uid: user.uid, message: `Không đọc được danh mục sổ: ${error.message}` }); }
      for (const book of books.values()) {
        result.books++;
        try {
          const days = await fetchAllOfficeBookDays(user.uid, book.id, { strictServer: true });
          for (const day of days) {
            result.days++;
            const entries = day.entries || [];
            const live = entries.filter((entry) => !entry.deletedAt);
            const deleted = entries.filter((entry) => entry.deletedAt);
            result.liveRows += live.length; result.deletedRows += deleted.length;
            if (!deleted.length) continue;
            result.affectedDays++;
            const liveKeys = new Set(live.map(diaryBusinessFingerprint));
            const groups = new Map();
            for (const entry of deleted) {
              const key = diaryBusinessFingerprint(entry);
              if (liveKeys.has(key)) continue;
              if (!groups.has(key)) groups.set(key, []);
              groups.get(key).push(entry);
            }
            const rows = [...groups.values()].map((history) => {
              const newest = history.slice().sort((a, b) => String(b.deletedAt).localeCompare(String(a.deletedAt)))[0];
              return {
                recordId: newest.recordId, section: newest.section, type: newest.type,
                kmFrom: newest.kmFrom, kmTo: newest.kmTo, quantity: newest.quantity, unit: newest.unit,
                deletedAt: newest.deletedAt, deleteReason: newest.deleteReason,
                versions: history.length, deleteBatches: new Set(history.map((entry) => entry.deletedAt)).size,
                hasDeleteConflict: (newest._syncConflicts || []).some((item) => item.field === "$delete"),
                recordIds: history.map((entry) => entry.recordId)
              };
            });
            report.days.push({ uid: user.uid, name: user.name, roadId: book.id,
              roadName: book.roadName,
              date: day.date, liveRows: live.length, deletedRows: deleted.length, rows });
          }
        } catch (error) { report.errors.push({ uid: user.uid, roadId: book.id, message: error.message }); }
      }
    } catch (error) { report.errors.push({ uid: user.uid, message: error.message }); }
    report.users.push(result);
  }
  return report;
}
