import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/firebase/firebase'
import type { IncidentRecord, IncidentUpdate } from '@/types/incident'
import {
  buildIncidentCode,
  buildUpdateEntry,
  initialUpdate,
  isCoreLocked,
  progressUpdateNote,
  resolveCompletedDate,
  statusFromProgress,
} from '@/lib/incidentDispatch'

function mapDoc(snap: QueryDocumentSnapshot): IncidentRecord | null {
  const data = snap.data()
  if (data.deleted === 1) return null
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
    note: data.note as string | undefined,
    uuid: data.uuid as string | undefined,
    beforeImages: (data.beforeImages as string[] | undefined) ?? [],
    afterImages: (data.afterImages as string[] | undefined) ?? [],
    status: data.status as IncidentRecord['status'],
    progress: data.progress as number | undefined,
    locked: data.locked as boolean | undefined,
    createdAt: data.createdAt as IncidentRecord['createdAt'],
    updatedAt: data.updatedAt as IncidentRecord['updatedAt'],
    createdByName: data.createdByName as string | undefined,
    companyId: data.companyId as string | undefined,
    priority: data.priority as string | undefined,
    updates: (data.updates as IncidentUpdate[] | undefined) ?? [],
  }
}

function mapIncidentDocs(docs: QueryDocumentSnapshot[]): IncidentRecord[] {
  return docs.map(mapDoc).filter((d): d is IncidentRecord => d != null)
}

export async function fetchIncidentsByOwner(uid: string): Promise<IncidentRecord[]> {
  const snap = await getDocs(collection(db, 'users', uid, 'incidents'))
  return mapIncidentDocs(snap.docs)
}

/** Realtime — app/web ghi Firestore thì danh sách tự cập nhật. */
export function subscribeIncidentsByOwner(
  uid: string,
  onData: (items: IncidentRecord[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, 'users', uid, 'incidents'),
    (snap) => {
      const list = mapIncidentDocs(snap.docs)
      list.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
      onData(list)
    },
    (err) => onError(err instanceof Error ? err : new Error(String(err))),
  )
}

export function subscribeIncidentById(
  uid: string,
  docId: string,
  onData: (item: IncidentRecord | null) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'users', uid, 'incidents', docId),
    (snap) => {
      if (!snap.exists()) {
        onData(null)
        return
      }
      onData(mapDoc(snap as QueryDocumentSnapshot))
    },
    (err) => onError(err instanceof Error ? err : new Error(String(err))),
  )
}

export async function fetchIncidentById(
  uid: string,
  docId: string,
): Promise<IncidentRecord | null> {
  const snap = await getDoc(doc(db, 'users', uid, 'incidents', docId))
  if (!snap.exists()) return null
  return mapDoc(snap as QueryDocumentSnapshot)
}

export type CreateIncidentInput = {
  road: string
  groupName: string
  type: string
  date: string
  km: string
  position: string
  dai: number
  rong: number
  cao: number
  unit: string
  note: string
  progress?: number
  companyId?: string
  createdByName: string
}

export async function createIncident(
  uid: string,
  input: CreateIncidentInput,
  beforeImageUrls: string[] = [],
): Promise<{ docId: string; incident: IncidentRecord }> {
  const docRef = doc(collection(db, 'users', uid, 'incidents'))
  const docId = docRef.id
  const uuid = crypto.randomUUID()
  const code = buildIncidentCode(input.date, input.road, input.type, input.km, input.position)
  const progress = input.progress ?? 0
  const status = statusFromProgress(progress)
  const completedDate = resolveCompletedDate(progress, '')
  const update0 = initialUpdate(input.note, beforeImageUrls, input.createdByName, input.date)

  const payload = {
    incidentId: docId,
    uuid,
    code,
    road: input.road,
    groupName: input.groupName,
    type: input.type,
    date: input.date,
    km: input.km,
    position: input.position,
    dai: input.dai,
    rong: input.rong,
    cao: input.cao,
    unit: input.unit,
    note: input.note,
    deleted: 0,
    beforeImages: beforeImageUrls,
    afterImages: [] as string[],
    status,
    progress,
    locked: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdByName: input.createdByName,
    companyId: input.companyId ?? '',
    priority: 'NORMAL',
    completedDate,
    updates: [update0],
  }

  await setDoc(docRef, payload, { merge: true })

  return {
    docId,
    incident: {
      id: docId,
      ownerUid: uid,
      incidentId: docId,
      uuid,
      ...input,
      beforeImages: beforeImageUrls,
      afterImages: [],
      status,
      progress,
      locked: false,
      companyId: input.companyId ?? '',
      priority: 'NORMAL',
      completedDate,
      updates: [update0],
    },
  }
}

export async function appendBeforeImages(
  uid: string,
  docId: string,
  urls: string[],
): Promise<void> {
  if (!urls.length) return
  await updateDoc(doc(db, 'users', uid, 'incidents', docId), {
    beforeImages: arrayUnion(...urls),
    updatedAt: serverTimestamp(),
  })
}

export async function updateIncidentProgress(
  uid: string,
  docId: string,
  incident: IncidentRecord,
  progress: number,
  note: string,
  afterImageUrls: string[],
  createdBy: string,
): Promise<void> {
  const p = Math.min(100, Math.max(0, Math.round(progress)))
  const status = statusFromProgress(p)
  const completedDate = resolveCompletedDate(p, incident.completedDate)
  const entry = buildUpdateEntry(
    p,
    progressUpdateNote(p, note),
    afterImageUrls,
    createdBy,
  )

  const patch: Record<string, unknown> = {
    progress: p,
    status,
    updatedAt: serverTimestamp(),
    updates: arrayUnion(entry),
  }
  if (completedDate) patch.completedDate = completedDate
  if (afterImageUrls.length) {
    patch.afterImages = arrayUnion(...afterImageUrls)
  }

  await updateDoc(doc(db, 'users', uid, 'incidents', docId), patch)
}

export type IncidentCorePatch = Partial<
  Pick<
    CreateIncidentInput,
    'road' | 'groupName' | 'type' | 'date' | 'km' | 'position' | 'dai' | 'rong' | 'cao' | 'unit' | 'note'
  >
>

export async function updateIncidentCore(
  uid: string,
  docId: string,
  incident: IncidentRecord,
  patch: IncidentCorePatch,
): Promise<void> {
  if (isCoreLocked(incident)) {
    if (patch.note !== undefined) {
      await updateDoc(doc(db, 'users', uid, 'incidents', docId), {
        note: patch.note,
        updatedAt: serverTimestamp(),
      })
    }
    return
  }
  await updateDoc(doc(db, 'users', uid, 'incidents', docId), {
    ...patch,
    updatedAt: serverTimestamp(),
  })
}
