import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore'
import { db } from '@/firebase/firebase'
import type { MasterDataBundle } from '@/types/incident'
import type { UserRole } from '@/types/incident'

const EMPTY: MasterDataBundle = { roads: [], groups: [], typesByGroup: {}, unitByType: {} }

export interface CatalogOwnerContext {
  uid: string
  companyId: string
  role: UserRole
  catalogOwnerUid?: string
}

function createdAtMillis(data: Record<string, unknown>): number {
  const ts = data.createdAt as { toMillis?: () => number } | undefined
  return typeof ts?.toMillis === 'function' ? ts.toMillis() : 0
}

/** Admin chính công ty — danh mục dùng chung web điều hành + app. */
export async function resolveCompanyCatalogOwnerUid(ctx: CatalogOwnerContext): Promise<string> {
  const fromEnv = import.meta.env.VITE_CATALOG_UID?.trim()
  if (fromEnv) return fromEnv

  const pinned = ctx.catalogOwnerUid?.trim()
  if (pinned) return pinned

  if (!ctx.companyId) return ctx.uid

  try {
    const snap = await getDocs(
      query(
        collection(db, 'users'),
        where('companyId', '==', ctx.companyId),
        where('role', '==', 'ADMIN'),
      ),
    )
    if (snap.empty) return ctx.uid

    const admins = snap.docs
      .map((d) => ({ id: d.id, ms: createdAtMillis(d.data() as Record<string, unknown>) }))
      .sort((a, b) => (a.ms !== b.ms ? a.ms - b.ms : a.id.localeCompare(b.id)))

    return admins[0]?.id ?? ctx.uid
  } catch {
    return ctx.uid
  }
}

/** @deprecated Dùng catalogOwnerUid từ useAuth — chỉ fallback đồng bộ khi chưa resolve. */
export function getCatalogOwnerUid(fallbackAdminUid?: string): string {
  const fromEnv = import.meta.env.VITE_CATALOG_UID?.trim()
  if (fromEnv) return fromEnv
  return fallbackAdminUid ?? ''
}

export async function fetchMasterData(ownerUid?: string): Promise<MasterDataBundle> {
  const uid = ownerUid?.trim()
  if (!uid) return EMPTY

  const [roadsSnap, groupsSnap, typesSnap] = await Promise.all([
    getDoc(doc(db, 'users', uid, 'master_data', 'roads')),
    getDoc(doc(db, 'users', uid, 'master_data', 'groups')),
    getDoc(doc(db, 'users', uid, 'master_data', 'types')),
  ])

  return {
    roads: (roadsSnap.data()?.list as string[] | undefined) ?? [],
    groups: (groupsSnap.data()?.list as string[] | undefined) ?? [],
    typesByGroup: (typesSnap.data()?.map as Record<string, string[]> | undefined) ?? {},
    unitByType: (typesSnap.data()?.units as Record<string, string> | undefined) ?? {},
  }
}

export async function saveMasterData(
  data: MasterDataBundle,
  ownerUid?: string,
): Promise<void> {
  const uid = ownerUid?.trim()
  if (!uid) throw new Error('Chưa xác định UID danh mục')

  await Promise.all([
    setDoc(doc(db, 'users', uid, 'master_data', 'roads'), { list: data.roads }, { merge: true }),
    setDoc(doc(db, 'users', uid, 'master_data', 'groups'), { list: data.groups }, { merge: true }),
    setDoc(
      doc(db, 'users', uid, 'master_data', 'types'),
      { map: data.typesByGroup, units: data.unitByType ?? {} },
      { merge: true },
    ),
  ])
}
