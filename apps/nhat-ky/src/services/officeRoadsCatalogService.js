import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { normalizeRoad } from "../utils/roadsCatalog";
import { EMPTY_REPORT_META } from "../utils/nhatKyFormat";
import { fetchOfficeBookMeta, pushOfficeBookMeta } from "./officeBooksService";

const DOC_ID = "office_roads_catalog";

function normalizeCatalog(data) {
  const roads = Array.isArray(data?.roads) ? data.roads.map(normalizeRoad) : [];
  return {
    activeRoadId: String(data?.activeRoadId ?? "").trim(),
    roads
  };
}

/** Đồng bộ tên công ty / hạt / đường từ danh mục → meta sổ trên cloud. */
async function syncRoadMetaToOfficeBook(ownerUid, road) {
  if (!ownerUid || !road?.id) return;
  try {
    const existing = (await fetchOfficeBookMeta(ownerUid, road.id)) || {};
    await pushOfficeBookMeta(ownerUid, road.id, {
      ...EMPTY_REPORT_META,
      ...existing,
      company: road.company || existing.company || EMPTY_REPORT_META.company,
      hat: road.hat || existing.hat || "",
      roadName: road.roadName || road.label || existing.roadName || "",
      kmRange: road.kmRange || existing.kmRange || ""
    });
  } catch (err) {
    console.warn("Không đồng bộ meta sổ (tên công ty) lên office_books.", err);
  }
}

/** Danh sách hạt/sổ của USER — SSOT trên cloud, ADMIN quản lý. */
export async function fetchOfficeRoadsCatalog(ownerUid) {
  if (!ownerUid) return { activeRoadId: "", roads: [] };
  const snap = await getDoc(doc(db, "users", ownerUid, "master_data", DOC_ID));
  if (!snap.exists()) return { activeRoadId: "", roads: [] };
  return normalizeCatalog(snap.data());
}

export async function pushOfficeRoadsCatalog(ownerUid, catalog) {
  if (!ownerUid) return;
  const payload = normalizeCatalog(catalog);
  await setDoc(
    doc(db, "users", ownerUid, "master_data", DOC_ID),
    {
      ...payload,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
  return payload;
}

async function mutateCatalog(ownerUid, mutator) {
  const current = await fetchOfficeRoadsCatalog(ownerUid);
  const next = mutator(current);
  await pushOfficeRoadsCatalog(ownerUid, next);
  return next;
}

/** ADMIN — thêm hạt/sổ cho USER. */
export async function adminAddRoadToCatalog(ownerUid, partial) {
  const road = normalizeRoad(partial);
  const next = await mutateCatalog(ownerUid, (cat) => ({
    ...cat,
    roads: [...cat.roads, road]
  }));
  const saved = next.roads.find((r) => r.id === road.id) || road;
  await syncRoadMetaToOfficeBook(ownerUid, saved);
  return saved;
}

/** ADMIN — sửa metadata hạt/sổ. */
export async function adminUpdateRoadInCatalog(ownerUid, roadId, patch) {
  const next = await mutateCatalog(ownerUid, (cat) => ({
    ...cat,
    roads: cat.roads.map((r) =>
      r.id === roadId ? normalizeRoad({ ...r, ...patch, id: roadId }) : r
    )
  }));
  const saved = next.roads.find((r) => r.id === roadId) || null;
  if (saved) await syncRoadMetaToOfficeBook(ownerUid, saved);
  return saved;
}

/** ADMIN — xóa hạt/sổ khỏi danh mục (không xóa dữ liệu nhập trên máy USER). */
export async function adminRemoveRoadFromCatalog(ownerUid, roadId) {
  return mutateCatalog(ownerUid, (cat) => ({
    activeRoadId: cat.activeRoadId === roadId ? "" : cat.activeRoadId,
    roads: cat.roads.filter((r) => r.id !== roadId)
  }));
}
