import { arrayUnion, doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { todayViDateString } from '@/lib/incidentUtils'
import { getIncidentRework } from '@/lib/reworkUtils'
import { db } from '@/firebase/firebase'
import type { IncidentRecord } from '@/types/incident'

function incidentRef(ownerUid: string, docId: string) {
  return doc(db, 'users', ownerUid, 'incidents', docId)
}

export async function assignRework(
  ownerUid: string,
  docId: string,
  input: { reason: string; note: string; assignedBy: string },
): Promise<void> {
  const at = todayViDateString()
  const reason = input.reason.trim()
  const note = input.note.trim()
  await updateDoc(incidentRef(ownerUid, docId), {
    rework: {
      required: true,
      status: 'ASSIGNED',
      reason,
      note,
      assignedAt: at,
      assignedBy: input.assignedBy.trim(),
      completedAt: null,
      approvedAt: null,
      submissionNote: '',
      submissionImages: [],
    },
    reworkHistory: arrayUnion({
      type: 'ASSIGNED',
      at,
      by: input.assignedBy.trim(),
      reason,
      note,
    }),
    updatedAt: serverTimestamp(),
  })
}

export async function approveRework(
  ownerUid: string,
  docId: string,
  incident: IncidentRecord,
  approvedBy: string,
): Promise<void> {
  const rw = getIncidentRework(incident)
  const images = rw.submissionImages.filter(Boolean)
  const at = todayViDateString()
  const patch: Record<string, unknown> = {
    rework: {
      required: false,
      status: 'APPROVED',
      reason: rw.reason,
      note: rw.note,
      assignedAt: rw.assignedAt,
      assignedBy: rw.assignedBy,
      completedAt: rw.completedAt,
      approvedAt: at,
      submissionNote: rw.submissionNote,
      submissionImages: rw.submissionImages,
    },
    reworkHistory: arrayUnion({
      type: 'APPROVED',
      at,
      by: approvedBy.trim(),
      mergedImageCount: images.length,
    }),
    updatedAt: serverTimestamp(),
  }
  if (images.length > 0) {
    patch.afterImages = arrayUnion(...images)
  }
  await updateDoc(incidentRef(ownerUid, docId), patch)
}

/** Admin từ chối bản gửi — trả về ASSIGNED để User bổ sung lại (trong cùng vòng rework). */
export async function requestReworkRevision(
  ownerUid: string,
  docId: string,
  incident: IncidentRecord,
  input: { reason: string; note: string; assignedBy: string },
): Promise<void> {
  const rw = getIncidentRework(incident)
  const at = todayViDateString()
  const reason = input.reason.trim()
  const note = input.note.trim()
  const previousImages = rw.submissionImages.filter(Boolean)
  const previousNote = rw.submissionNote.trim()

  const historyEntry: Record<string, unknown> = {
    type: 'REVISION_REQUESTED',
    at,
    by: input.assignedBy.trim(),
    reason,
    note,
  }
  if (previousNote) historyEntry.submissionNote = previousNote
  if (previousImages.length > 0) historyEntry.submissionImages = previousImages

  await updateDoc(incidentRef(ownerUid, docId), {
    rework: {
      required: true,
      status: 'ASSIGNED',
      reason,
      note,
      assignedAt: at,
      assignedBy: input.assignedBy.trim(),
      completedAt: null,
      approvedAt: null,
      submissionNote: '',
      submissionImages: [],
    },
    reworkHistory: arrayUnion(historyEntry),
    updatedAt: serverTimestamp(),
  })
}
