import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore'
import { db } from '@/firebase/firebase'
import type { UserRole } from '@/types/incident'

export interface UserProfile {
  role: UserRole
  companyId: string
  companyName: string
  displayName: string
  email: string
  active: boolean
  expireDate: string
  catalogOwnerUid: string
}

function parseExpireDate(raw: unknown): string {
  return String(raw ?? '').trim()
}

function isLicenseExpired(expireDate: string): boolean {
  if (!expireDate) return false
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(expireDate)
  if (iso) {
    const end = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 23, 59, 59)
    return Date.now() > end.getTime()
  }
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(expireDate)
  if (dmy) {
    const end = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]), 23, 59, 59)
    return Date.now() > end.getTime()
  }
  return false
}

export async function resolveCatalogOwnerUid(
  uid: string,
  companyId: string,
  catalogOwnerUid?: string,
): Promise<string> {
  const cached = catalogOwnerUid?.trim()
  if (cached) return cached
  if (!companyId) return uid

  const q = query(
    collection(db, 'users'),
    where('companyId', '==', companyId),
    where('role', '==', 'ADMIN'),
    limit(1),
  )
  const snap = await getDocs(q)
  const adminUid = snap.docs[0]?.id?.trim()
  return adminUid && adminUid !== uid ? adminUid : uid
}

export async function loadUserProfile(
  uid: string,
  email?: string | null,
): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid))
  if (!snap.exists()) return null

  const data = snap.data()
  if (data.active !== true) return null

  const expireDate = parseExpireDate(data.expireDate)
  if (isLicenseExpired(expireDate)) return null

  const roleRaw = String(data.role ?? 'USER').toUpperCase()
  const role: UserRole = roleRaw === 'ADMIN' ? 'ADMIN' : 'USER'
  const companyId = String(data.companyId ?? '').trim()
  const companyName = String(data.companyName ?? data.company ?? companyId)
  const catalogOwnerUid = await resolveCatalogOwnerUid(
    uid,
    companyId,
    String(data.catalogOwnerUid ?? ''),
  )

  return {
    role,
    companyId,
    companyName,
    displayName: String(data.name ?? email ?? ''),
    email: String(data.email ?? email ?? ''),
    active: true,
    expireDate,
    catalogOwnerUid,
  }
}
