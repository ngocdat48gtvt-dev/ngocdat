import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase/firebase'
import { normalizeOfficeRoad } from '@/lib/officeRoadNormalize'
import type { OfficeRoad, OfficeRoadsCatalog, OfficeRoadDraft } from '@/types/officeRoad'

const DOC_ID = 'office_roads_catalog'

function normalizeCatalog(data: Record<string, unknown> | undefined): OfficeRoadsCatalog {
  const roads = Array.isArray(data?.roads)
    ? (data.roads as Partial<OfficeRoad>[]).map(normalizeOfficeRoad)
    : []
  return {
    activeRoadId: String(data?.activeRoadId ?? '').trim(),
    roads,
  }
}

export async function fetchOfficeRoadsCatalog(ownerUid: string): Promise<OfficeRoadsCatalog> {
  if (!ownerUid) return { activeRoadId: '', roads: [] }
  const snap = await getDoc(doc(db, 'users', ownerUid, 'master_data', DOC_ID))
  if (!snap.exists()) return { activeRoadId: '', roads: [] }
  return normalizeCatalog(snap.data() as Record<string, unknown>)
}

export async function pushOfficeRoadsCatalog(
  ownerUid: string,
  catalog: OfficeRoadsCatalog,
): Promise<OfficeRoadsCatalog> {
  const payload = normalizeCatalog(catalog as unknown as Record<string, unknown>)
  await setDoc(
    doc(db, 'users', ownerUid, 'master_data', DOC_ID),
    { ...payload, updatedAt: serverTimestamp() },
    { merge: true },
  )
  return payload
}

async function mutateCatalog(
  ownerUid: string,
  mutator: (cat: OfficeRoadsCatalog) => OfficeRoadsCatalog,
): Promise<OfficeRoadsCatalog> {
  const current = await fetchOfficeRoadsCatalog(ownerUid)
  const next = mutator(current)
  await pushOfficeRoadsCatalog(ownerUid, next)
  return next
}

export async function adminAddRoadToCatalog(
  ownerUid: string,
  partial: OfficeRoadDraft,
): Promise<OfficeRoad> {
  const road = normalizeOfficeRoad(partial)
  const next = await mutateCatalog(ownerUid, (cat) => ({
    ...cat,
    roads: [...cat.roads, road],
  }))
  return next.roads.find((r) => r.id === road.id) || road
}

export async function adminUpdateRoadInCatalog(
  ownerUid: string,
  roadId: string,
  patch: OfficeRoadDraft,
): Promise<OfficeRoad | null> {
  const next = await mutateCatalog(ownerUid, (cat) => ({
    ...cat,
    roads: cat.roads.map((r) =>
      r.id === roadId ? normalizeOfficeRoad({ ...r, ...patch, id: roadId }) : r,
    ),
  }))
  return next.roads.find((r) => r.id === roadId) || null
}

export async function adminRemoveRoadFromCatalog(
  ownerUid: string,
  roadId: string,
): Promise<OfficeRoadsCatalog> {
  return mutateCatalog(ownerUid, (cat) => ({
    activeRoadId: cat.activeRoadId === roadId ? '' : cat.activeRoadId,
    roads: cat.roads.filter((r) => r.id !== roadId),
  }))
}
