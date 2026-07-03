import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  deleteField,
  where,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore'
import {
  clampProgress,
  resolveCompletedDate,
  statusFromProgress,
} from '@/lib/incidentUtils'
import { parseIncidentRework, parseReworkHistory } from '@/lib/reworkUtils'
import {
  deletedAtToMs,
  isTrashExpired,
} from '@/lib/trashUtils'
import { db } from '@/firebase/firebase'
import type { IncidentRecord, IncidentUpdate, TrashIncidentRecord } from '@/types/incident'
import { fetchCompanyMemberUids } from '@/services/usersService'

function mapDocCore(snap: QueryDocumentSnapshot): IncidentRecord {
  const data = snap.data()
  const path = snap.ref.path.split('/')
  const ownerUid = path.length >= 2 ? path[1] : ''
  return {
    id: snap.id,
    ownerUid,
    incidentId: data.incidentId as string | undefined,
    road: data.road as string | undefined,
    groupName: data.groupName as string | undefined,
    type: data.type as string | undefined,
    date: data.date as string | undefined,
    completedDate: data.completedDate as string | undefined,
    km: data.km as string | undefined,
    position: data.position as string | undefined,
    dai: data.dai as number | undefined,
    rong: data.rong as number | undefined,
    cao: data.cao as number | undefined,
    unit: data.unit as string | undefined,
    pipeType: data.pipeType as string | undefined,
    geologyType: data.geologyType as string | undefined,
    soilPercent: data.soilPercent as number | undefined,
    note: data.note as string | undefined,
    uuid: data.uuid as string | undefined,
    beforeImages: (data.beforeImages as string[] | undefined) ?? [],
    afterImages: (data.afterImages as string[] | undefined) ?? [],
    selectedBefore: data.selectedBefore as string | undefined,
    selectedAfter: data.selectedAfter as string | undefined,
    reportImageOrder: data.reportImageOrder as string | undefined,
    status: data.status as IncidentRecord['status'],
    progress: data.progress as number | undefined,
    locked: data.locked as boolean | undefined,
    createdByName: data.createdByName as string | undefined,
    companyId: data.companyId as string | undefined,
    priority: data.priority as string | undefined,
    updates: (data.updates as IncidentUpdate[] | undefined) ?? [],
    rework: data.rework != null ? parseIncidentRework(data.rework) : undefined,
    reworkHistory:
      data.reworkHistory != null ? parseReworkHistory(data.reworkHistory) : undefined,
  }
}

function mapDoc(snap: QueryDocumentSnapshot): IncidentRecord | null {
  const data = snap.data()
  if (data.deleted === 1) return null
  return mapDocCore(snap)
}

function incidentKey(inc: { ownerUid: string; id: string }): string {
  return `${inc.ownerUid}/${inc.id}`
}

function mergeIncidentLists(lists: IncidentRecord[][]): IncidentRecord[] {
  const byKey = new Map<string, IncidentRecord>()
  for (const list of lists) {
    for (const inc of list) {
      const key = incidentKey(inc)
      const existing = byKey.get(key)
      if (!existing) {
        byKey.set(key, inc)
        continue
      }
      if (!existing.companyId?.trim() && inc.companyId?.trim()) {
        byKey.set(key, inc)
      }
    }
  }
  return [...byKey.values()]
}

async function fetchIncidentsByCompanyGroup(companyId: string): Promise<IncidentRecord[]> {
  const q = query(
    collectionGroup(db, 'incidents'),
    where('companyId', '==', companyId),
  )
  const snap = await getDocs(q)
  return snap.docs.map(mapDoc).filter((d): d is IncidentRecord => d != null)
}

export async function fetchIncidentsByCompany(
  companyId: string,
): Promise<IncidentRecord[]> {
  const groupItems = await fetchIncidentsByCompanyGroup(companyId)
  try {
    const memberUids = await fetchCompanyMemberUids(companyId)
    if (memberUids.length === 0) return groupItems
    const lists = await Promise.all(memberUids.map((uid) => fetchIncidentsByOwner(uid)))
    return mergeIncidentLists([groupItems, ...lists])
  } catch {
    return groupItems
  }
}

export async function fetchIncidentsByOwner(uid: string): Promise<IncidentRecord[]> {
  const snap = await getDocs(collection(db, 'users', uid, 'incidents'))
  return snap.docs.map(mapDoc).filter((d): d is IncidentRecord => d != null)
}

export async function fetchIncidentsForViewer(
  role: 'ADMIN' | 'USER',
  uid: string,
  companyId: string,
): Promise<IncidentRecord[]> {
  if (role === 'ADMIN') return fetchIncidentsByCompany(companyId)
  return fetchIncidentsByOwner(uid)
}

function mapQueryDocs(docs: QueryDocumentSnapshot[]): IncidentRecord[] {
  return docs.map(mapDoc).filter((d): d is IncidentRecord => d != null)
}

function subscribeIncidentsByCompanyGroup(
  companyId: string,
  onData: (items: IncidentRecord[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collectionGroup(db, 'incidents'),
    where('companyId', '==', companyId),
  )
  return onSnapshot(
    q,
    (snap) => onData(mapQueryDocs(snap.docs)),
    (err) => onError(err),
  )
}

/** ADMIN: collectionGroup (chính) + bổ sung users/{uid}/incidents (sự cố thiếu companyId). */
export function subscribeIncidentsByCompany(
  companyId: string,
  onData: (items: IncidentRecord[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  let disposed = false
  const unsubs: Unsubscribe[] = []
  let groupItems: IncidentRecord[] = []
  const itemsByUid = new Map<string, IncidentRecord[]>()

  function emitAll() {
    onData(mergeIncidentLists([groupItems, ...itemsByUid.values()]))
  }

  unsubs.push(
    subscribeIncidentsByCompanyGroup(
      companyId,
      (items) => {
        groupItems = items
        emitAll()
      },
      onError,
    ),
  )

  void fetchCompanyMemberUids(companyId)
    .then((uids) => {
      if (disposed) return
      for (const uid of uids) {
        const unsub = subscribeIncidentsByOwner(
          uid,
          (items) => {
            itemsByUid.set(uid, items)
            emitAll()
          },
          () => {
            /* bỏ qua uid không đọc được — không chặn cả dashboard */
          },
        )
        unsubs.push(unsub)
      }
    })
    .catch(() => {
      /* collectionGroup vẫn chạy */
    })

  return () => {
    disposed = true
    unsubs.forEach((u) => u())
  }
}

export function subscribeIncidentsByOwner(
  uid: string,
  onData: (items: IncidentRecord[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, 'users', uid, 'incidents'),
    (snap) => onData(mapQueryDocs(snap.docs)),
    (err) => onError(err),
  )
}

/** Lắng nghe Firestore realtime — cập nhật khi app/web ghi dữ liệu. */
export function subscribeIncidentsForViewer(
  role: 'ADMIN' | 'USER',
  uid: string,
  companyId: string,
  onData: (items: IncidentRecord[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  if (role === 'ADMIN') return subscribeIncidentsByCompany(companyId, onData, onError)
  return subscribeIncidentsByOwner(uid, onData, onError)
}

export type IncidentPatch = {
  road?: string
  groupName?: string
  type?: string
  date?: string
  completedDate?: string
  km?: string
  position?: string
  dai?: number
  rong?: number
  cao?: number
  unit?: string
  note?: string
  progress?: number
  status?: IncidentRecord['status']
  locked?: boolean
}

export async function updateIncidentRecord(
  ownerUid: string,
  docId: string,
  patch: IncidentPatch,
  options?: { companyId?: string },
): Promise<void> {
  const ref = doc(db, 'users', ownerUid, 'incidents', docId)
  const payload: Record<string, unknown> = {
    ...patch,
    updatedAt: serverTimestamp(),
  }
  const companyId = options?.companyId?.trim()
  if (companyId) payload.companyId = companyId
  await updateDoc(ref, payload)
}

export type CreateIncidentInput = {
  road: string
  groupName: string
  type: string
  km: string
  position: string
  date: string
  completedDate?: string
  dai: number
  rong: number
  cao: number
  unit: string
  progress: number
  note: string
  createdByName: string
  companyId: string
  /** Bão lũ — tỉ lệ % đất (0..100); -1 = không áp dụng/chưa nhập. */
  soilPercent?: number
}

/**
 * Tạo sự cố mới trên web (admin). Ghi vào users/{ownerUid}/incidents với schema
 * khớp app (status/progress/updates/companyId…). Trả về id document mới.
 */
export async function createIncidentRecord(
  ownerUid: string,
  input: CreateIncidentInput,
): Promise<string> {
  const ref = doc(collection(db, 'users', ownerUid, 'incidents'))
  const id = ref.id
  const progress = clampProgress(input.progress)
  const status = statusFromProgress(progress)
  const completedDate = resolveCompletedDate(progress, input.completedDate)
  const note = input.note.trim()
  const isoToday = new Date().toISOString().slice(0, 10)

  await setDoc(ref, {
    incidentId: id,
    uuid: '',
    code: '',
    note,
    deleted: 0,
    status,
    progress,
    locked: false,
    createdByName: input.createdByName,
    companyId: input.companyId,
    priority: 'NORMAL',
    completedDate,
    road: input.road.trim(),
    groupName: input.groupName.trim(),
    type: input.type.trim(),
    date: input.date.trim(),
    km: input.km.trim(),
    position: input.position.trim(),
    dai: input.dai,
    rong: input.rong,
    cao: input.cao,
    unit: input.unit.trim() || 'm3',
    pipeType: '',
    geologyType: '',
    soilPercent:
      typeof input.soilPercent === 'number' &&
      input.soilPercent >= 0 &&
      input.soilPercent <= 100
        ? input.soilPercent
        : -1,
    beforeImages: [],
    afterImages: [],
    selectedBefore: '',
    selectedAfter: '',
    reportImageOrder: '',
    updates: [
      {
        date: isoToday,
        progress: 0,
        note: note || 'Phát hiện sự cố',
        images: [],
        createdBy: input.createdByName,
      },
    ],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return id
}

/** Lưu thứ tự ảnh ghép báo cáo Word (+ đồng bộ selectedBefore/selectedAfter). */
export async function updateReportImageSelection(
  ownerUid: string,
  docId: string,
  reportImageOrder: string,
  selectedBefore: string,
  selectedAfter: string,
): Promise<void> {
  const ref = doc(db, 'users', ownerUid, 'incidents', docId)
  await updateDoc(ref, {
    reportImageOrder,
    selectedBefore,
    selectedAfter,
    updatedAt: serverTimestamp(),
  })
}

/** @deprecated dùng updateReportImageSelection */
export async function updateSelectedReportPhoto(
  ownerUid: string,
  docId: string,
  field: 'selectedBefore' | 'selectedAfter',
  value: string,
): Promise<void> {
  const ref = doc(db, 'users', ownerUid, 'incidents', docId)
  await updateDoc(ref, {
    [field]: value,
    updatedAt: serverTimestamp(),
  })
}

/** Khớp app Android: đánh dấu deleted = 1, giữ 7 ngày trong thùng rác */
export async function softDeleteIncident(
  ownerUid: string,
  docId: string,
): Promise<void> {
  const ref = doc(db, 'users', ownerUid, 'incidents', docId)
  await updateDoc(ref, {
    deleted: 1,
    deletedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

function mapTrashDoc(snap: QueryDocumentSnapshot): TrashIncidentRecord | null {
  const data = snap.data()
  if (data.deleted !== 1) return null
  const deletedAtMs =
    deletedAtToMs(data.deletedAt) ??
    deletedAtToMs(data.updatedAt) ??
    Date.now()
  return { ...mapDocCore(snap), deletedAtMs }
}

function mapTrashQueryDocs(docs: QueryDocumentSnapshot[]): TrashIncidentRecord[] {
  return docs
    .map(mapTrashDoc)
    .filter((d): d is TrashIncidentRecord => d != null)
    .sort((a, b) => b.deletedAtMs - a.deletedAtMs)
}

export async function fetchTrashIncidentsByCompany(
  companyId: string,
): Promise<TrashIncidentRecord[]> {
  const q = query(
    collectionGroup(db, 'incidents'),
    where('companyId', '==', companyId),
  )
  const groupSnap = await getDocs(q)
  const groupItems = mapTrashQueryDocs(groupSnap.docs)
  try {
    const memberUids = await fetchCompanyMemberUids(companyId)
    if (memberUids.length === 0) return groupItems
    const lists = await Promise.all(
      memberUids.map((uid) => fetchTrashIncidentsByOwner(uid)),
    )
    const byKey = new Map<string, TrashIncidentRecord>()
    for (const list of [groupItems, ...lists]) {
      for (const item of list) byKey.set(incidentKey(item), item)
    }
    return [...byKey.values()].sort((a, b) => b.deletedAtMs - a.deletedAtMs)
  } catch {
    return groupItems
  }
}

export async function fetchTrashIncidentsByOwner(uid: string): Promise<TrashIncidentRecord[]> {
  const snap = await getDocs(collection(db, 'users', uid, 'incidents'))
  return mapTrashQueryDocs(snap.docs)
}

export async function fetchTrashIncidentsForViewer(
  role: 'ADMIN' | 'USER',
  uid: string,
  companyId: string,
): Promise<TrashIncidentRecord[]> {
  if (role === 'ADMIN') return fetchTrashIncidentsByCompany(companyId)
  return fetchTrashIncidentsByOwner(uid)
}

export function subscribeTrashIncidentsForViewer(
  role: 'ADMIN' | 'USER',
  uid: string,
  companyId: string,
  onData: (items: TrashIncidentRecord[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  if (role === 'ADMIN') {
    let disposed = false
    const unsubs: Unsubscribe[] = []
    let groupItems: TrashIncidentRecord[] = []
    const itemsByUid = new Map<string, TrashIncidentRecord[]>()

    function emitAll() {
      const byKey = new Map<string, TrashIncidentRecord>()
      for (const list of [groupItems, ...itemsByUid.values()]) {
        for (const item of list) byKey.set(incidentKey(item), item)
      }
      onData(
        [...byKey.values()].sort((a, b) => b.deletedAtMs - a.deletedAtMs),
      )
    }

    const q = query(
      collectionGroup(db, 'incidents'),
      where('companyId', '==', companyId),
    )
    unsubs.push(
      onSnapshot(
        q,
        (snap) => {
          groupItems = mapTrashQueryDocs(snap.docs)
          emitAll()
        },
        (err) => onError(err),
      ),
    )

    void fetchCompanyMemberUids(companyId)
      .then((uids) => {
        if (disposed) return
        for (const uid of uids) {
          unsubs.push(
            onSnapshot(
              collection(db, 'users', uid, 'incidents'),
              (snap) => {
                itemsByUid.set(uid, mapTrashQueryDocs(snap.docs))
                emitAll()
              },
              () => {
                /* bỏ qua uid không đọc được */
              },
            ),
          )
        }
      })
      .catch(() => {
        /* collectionGroup vẫn chạy */
      })

    return () => {
      disposed = true
      unsubs.forEach((u) => u())
    }
  }
  return onSnapshot(
    collection(db, 'users', uid, 'incidents'),
    (snap) => onData(mapTrashQueryDocs(snap.docs)),
    (err) => onError(err),
  )
}

export async function restoreIncident(
  ownerUid: string,
  docId: string,
): Promise<void> {
  const ref = doc(db, 'users', ownerUid, 'incidents', docId)
  await updateDoc(ref, {
    deleted: 0,
    deletedAt: deleteField(),
    updatedAt: serverTimestamp(),
  })
}

export async function permanentlyDeleteIncident(
  ownerUid: string,
  docId: string,
): Promise<void> {
  const ref = doc(db, 'users', ownerUid, 'incidents', docId)
  await deleteDoc(ref)
}

export async function purgeExpiredTrashForViewer(
  role: 'ADMIN' | 'USER',
  uid: string,
  companyId: string,
): Promise<number> {
  const items = await fetchTrashIncidentsForViewer(role, uid, companyId)
  let purged = 0
  for (const item of items) {
    if (!isTrashExpired(item.deletedAtMs)) continue
    await permanentlyDeleteIncident(item.ownerUid, item.id)
    purged += 1
  }
  return purged
}
