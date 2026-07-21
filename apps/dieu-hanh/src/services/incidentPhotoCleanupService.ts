import { deleteObject, ref } from 'firebase/storage'
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db, storage } from '@/firebase/firebase'
import {
  dedupeCloudUrls,
  hasDuplicateCloudUrls,
  isSamePhotoUrl,
  legacyRefsFromReportSlots,
  reportImageSlots,
  encodeReportImageOrder,
} from '@/lib/incidentUtils'
import type { IncidentRecord } from '@/types/incident'

function firebaseObjectKey(url: string): string | null {
  const match = /\/o\/([^?]+)/.exec(String(url || ''))
  if (!match) return null
  try {
    return decodeURIComponent(match[1])
  } catch {
    return match[1]
  }
}

async function deleteStorageUrl(url: string): Promise<void> {
  if (!url.startsWith('http')) return
  const key = firebaseObjectKey(url)
  if (!key) return
  try {
    await deleteObject(ref(storage, key))
  } catch {
    /* bỏ qua */
  }
}

function removedDuplicateUrls(original: string[], kept: string[]): string[] {
  const removed: string[] = []
  for (const url of original) {
    const t = url.trim()
    if (!t.startsWith('http')) continue
    if (kept.some((k) => k === t)) continue
    if (kept.some((k) => isSamePhotoUrl(k, t))) removed.push(t)
  }
  return removed
}

/**
 * Ghi đè beforeImages/afterImages trên Firestore — chỉ giữ bản gốc, xóa file Storage thừa.
 * Khớp cleanupDuplicatePhotosOnCloud trên app Flutter.
 */
export async function cleanupDuplicatePhotosOnCloud(
  ownerUid: string,
  docId: string,
  incident: IncidentRecord,
): Promise<{ beforeImages: string[]; afterImages: string[]; removed: number } | null> {
  const beforeRaw = (incident.beforeImages ?? []).filter((u) => u.startsWith('http'))
  const afterRaw = (incident.afterImages ?? []).filter((u) => u.startsWith('http'))

  if (!hasDuplicateCloudUrls(beforeRaw) && !hasDuplicateCloudUrls(afterRaw)) {
    return null
  }

  const beforeKept = dedupeCloudUrls(beforeRaw)
  const afterKept = dedupeCloudUrls(afterRaw)
  const beforeRemoved = removedDuplicateUrls(beforeRaw, beforeKept)
  const afterRemoved = removedDuplicateUrls(afterRaw, afterKept)

  const slots = reportImageSlots({
    ...incident,
    beforeImages: beforeKept,
    afterImages: afterKept,
  })
  const { selectedBefore, selectedAfter } = legacyRefsFromReportSlots(slots)

  await updateDoc(doc(db, 'users', ownerUid, 'incidents', docId), {
    beforeImages: beforeKept,
    afterImages: afterKept,
    reportImageOrder: encodeReportImageOrder(slots),
    selectedBefore,
    selectedAfter,
    updatedAt: serverTimestamp(),
  })

  for (const url of [...beforeRemoved, ...afterRemoved]) {
    await deleteStorageUrl(url)
  }

  return {
    beforeImages: beforeKept,
    afterImages: afterKept,
    removed: beforeRemoved.length + afterRemoved.length,
  }
}

export function incidentNeedsPhotoCleanup(inc: IncidentRecord): boolean {
  return (
    hasDuplicateCloudUrls(inc.beforeImages ?? []) ||
    hasDuplicateCloudUrls(inc.afterImages ?? [])
  )
}

/** Dọn trùng cloud hàng loạt — giữ ảnh gốc (timestamp upload sớm nhất). */
export async function cleanupAllDuplicatePhotosOnCloud(
  incidents: IncidentRecord[],
  options?: {
    maxIncidents?: number
    ownerUid?: string
    isCompanyAdmin?: boolean
  },
): Promise<{ cleaned: number; removed: number }> {
  const max = options?.maxIncidents ?? 40
  const uid = options?.ownerUid ?? ''
  const isAdmin = options?.isCompanyAdmin ?? false

  const candidates = incidents.filter(
    (inc) =>
      incidentNeedsPhotoCleanup(inc) &&
      (isAdmin || !uid || inc.ownerUid === uid),
  )

  let cleaned = 0
  let removed = 0
  const limit = Math.min(candidates.length, max)

  for (let i = 0; i < limit; i++) {
    const inc = candidates[i]
    const result = await cleanupDuplicatePhotosOnCloud(inc.ownerUid, inc.id, inc)
    if (result) {
      cleaned++
      removed += result.removed
      inc.beforeImages = result.beforeImages
      inc.afterImages = result.afterImages
    }
    if (i % 4 === 3) {
      await new Promise((r) => setTimeout(r, 0))
    }
  }

  return { cleaned, removed }
}

const CLEANUP_COOLDOWN_MS = 90_000
const CLEANUP_SESSION_KEY = 'dieu-hanh-photo-cleanup-ts'

export function photoCleanupCooldownActive(): boolean {
  const last = Number(sessionStorage.getItem(CLEANUP_SESSION_KEY) || 0)
  return Date.now() - last < CLEANUP_COOLDOWN_MS
}

export function markPhotoCleanupRan(): void {
  sessionStorage.setItem(CLEANUP_SESSION_KEY, String(Date.now()))
}

export function countIncidentsNeedingPhotoCleanup(
  incidents: IncidentRecord[],
  options?: {
    ownerUid?: string
    isCompanyAdmin?: boolean
  },
): number {
  const uid = options?.ownerUid ?? ''
  const isAdmin = options?.isCompanyAdmin ?? false
  return incidents.filter(
    (inc) =>
      incidentNeedsPhotoCleanup(inc) &&
      (isAdmin || !uid || inc.ownerUid === uid),
  ).length
}

/** Dọn hết ảnh trùng (nhiều batch) — dùng cho nút chủ động, bỏ qua cooldown. */
export async function runPhotoCleanupUntilDone(
  incidents: IncidentRecord[],
  options?: {
    maxIncidentsPerBatch?: number
    ownerUid?: string
    isCompanyAdmin?: boolean
    onBatch?: (progress: {
      batchCleaned: number
      batchRemoved: number
      totalCleaned: number
      totalRemoved: number
    }) => void
  },
): Promise<{ cleaned: number; removed: number }> {
  const max = options?.maxIncidentsPerBatch ?? 50
  let totalCleaned = 0
  let totalRemoved = 0

  for (let round = 0; round < 100; round++) {
    const { cleaned, removed } = await cleanupAllDuplicatePhotosOnCloud(incidents, {
      maxIncidents: max,
      ownerUid: options?.ownerUid,
      isCompanyAdmin: options?.isCompanyAdmin,
    })
    if (cleaned === 0) break
    totalCleaned += cleaned
    totalRemoved += removed
    options?.onBatch?.({
      batchCleaned: cleaned,
      batchRemoved: removed,
      totalCleaned,
      totalRemoved,
    })
    if (cleaned < max) break
  }

  return { cleaned: totalCleaned, removed: totalRemoved }
}
