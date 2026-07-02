import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/firebase/firebase'
import type { UserRole } from '@/types/incident'

export interface CompanyUserProfile {
  role: UserRole
  companyId: string
  companyName: string
  displayName: string
  active: boolean
  /** ADMIN phụ: trỏ về UID admin chính (danh mục chung). */
  catalogOwnerUid: string
}

export async function loadCompanyProfile(
  uid: string,
): Promise<CompanyUserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid))
  if (!snap.exists()) return null

  const data = snap.data()
  if (data.active !== true) return null

  const companyId = String(data.companyId ?? '').trim()
  if (!companyId) return null

  const roleRaw = String(data.role ?? 'USER').toUpperCase()
  const role: UserRole = roleRaw === 'ADMIN' ? 'ADMIN' : 'USER'

  return {
    role,
    companyId,
    companyName: String(data.companyName ?? data.company ?? companyId),
    displayName: String(data.name ?? data.email ?? ''),
    active: true,
    catalogOwnerUid: String(data.catalogOwnerUid ?? '').trim(),
  }
}
