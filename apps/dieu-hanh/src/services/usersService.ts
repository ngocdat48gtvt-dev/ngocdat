import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/firebase/firebase'

export interface CompanyUserEntry {
  uid: string
  displayName: string
}

/** Lấy tên từ document users (field `name` trong license-admin). */
export function nameFromUserDoc(data: Record<string, unknown>): string {
  const name = String(data.name ?? '').trim()
  if (name) return name
  return ''
}

export async function fetchUserDocName(uid: string): Promise<string> {
  if (!uid) return ''
  const snap = await getDoc(doc(db, 'users', uid))
  if (!snap.exists()) return ''
  return nameFromUserDoc(snap.data() as Record<string, unknown>)
}

/** Đọc từng users/{uid} — dùng khi query theo companyId bị chặn hoặc thiếu index. */
export async function fetchUserNamesByUids(
  uids: string[],
): Promise<Record<string, string>> {
  const unique = [...new Set(uids.filter(Boolean))]
  const map: Record<string, string> = {}
  await Promise.all(
    unique.map(async (uid) => {
      try {
        const name = await fetchUserDocName(uid)
        map[uid] = name || 'Chưa đặt tên'
      } catch {
        map[uid] = 'Chưa đặt tên'
      }
    }),
  )
  return map
}

export async function fetchCompanyUsers(
  companyId: string,
): Promise<CompanyUserEntry[]> {
  if (!companyId) return []
  const q = query(collection(db, 'users'), where('companyId', '==', companyId))
  const snap = await getDocs(q)
  const list: CompanyUserEntry[] = []
  for (const d of snap.docs) {
    const data = d.data() as Record<string, unknown>
    if (data.active !== true) continue
    const displayName = nameFromUserDoc(data) || 'Chưa đặt tên'
    list.push({ uid: d.id, displayName })
  }
  return list.sort((a, b) =>
    a.displayName.localeCompare(b.displayName, 'vi', { sensitivity: 'base' }),
  )
}

/** Mọi user thuộc công ty (kể cả inactive) — dùng tải sự cố ADMIN. */
export async function fetchCompanyMemberUids(companyId: string): Promise<string[]> {
  if (!companyId) return []
  const q = query(collection(db, 'users'), where('companyId', '==', companyId))
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.id)
}

export function buildUserNameMap(users: CompanyUserEntry[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const u of users) {
    map[u.uid] = u.displayName
  }
  return map
}

/** Gộp nhiều nguồn — ưu tiên tên thật (không phải placeholder). */
export function mergeUserNameMaps(
  ...sources: Record<string, string>[]
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const src of sources) {
    for (const [uid, raw] of Object.entries(src)) {
      const name = raw.trim()
      const existing = out[uid]?.trim() ?? ''
      const nameOk = name && name !== 'Chưa đặt tên'
      const existingOk = existing && existing !== 'Chưa đặt tên'
      if (nameOk) out[uid] = name
      else if (!existingOk) out[uid] = name || existing || 'Chưa đặt tên'
    }
  }
  return out
}

export function directoryFromNameMap(
  map: Record<string, string>,
): CompanyUserEntry[] {
  return Object.entries(map)
    .map(([uid, displayName]) => ({ uid, displayName }))
    .sort((a, b) =>
      a.displayName.localeCompare(b.displayName, 'vi', { sensitivity: 'base' }),
    )
}

/** Nhãn người tạo: tên từ users/{uid}.name, không dùng Gmail. */
export function resolveCreatorDisplayName(
  ownerUid: string,
  userNameByUid: Record<string, string>,
  _createdByName?: string,
): string {
  const fromProfile = userNameByUid[ownerUid]?.trim()
  if (fromProfile && fromProfile !== 'Chưa đặt tên') return fromProfile
  return fromProfile || 'Chưa đặt tên'
}

export function mergeFilterUserOptions(
  directory: CompanyUserEntry[],
  incidents: { ownerUid: string }[],
  userNameByUid: Record<string, string>,
): CompanyUserEntry[] {
  const map = new Map(directory.map((u) => [u.uid, u.displayName]))
  for (const inc of incidents) {
    if (!map.has(inc.ownerUid)) {
      map.set(
        inc.ownerUid,
        userNameByUid[inc.ownerUid]?.trim() || 'Chưa đặt tên',
      )
    }
  }
  return [...map.entries()]
    .map(([uid, displayName]) => ({ uid, displayName }))
    .sort((a, b) =>
      a.displayName.localeCompare(b.displayName, 'vi', { sensitivity: 'base' }),
    )
}
