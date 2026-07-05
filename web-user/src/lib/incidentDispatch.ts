import type { IncidentRecord, IncidentStatus, IncidentUpdate } from '@/types/incident'
import { parseViDate } from '@/lib/incidentFilters'
import { clampProgress, todayViDateString } from '@/lib/incidentUtils'

export const LOCK_MS = 24 * 60 * 60 * 1000
export const COMPLETION_PROGRESS_THRESHOLD = 90

export function todayIso(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function statusFromProgress(progress?: number): IncidentStatus {
  const p = clampProgress(progress)
  if (p >= 100) return 'DONE'
  if (p > 0) return 'PARTIAL'
  return 'NEW'
}

export function listStatusLabel(progress?: number, status?: IncidentStatus): string {
  const p = clampProgress(progress)
  const s = status ?? statusFromProgress(p)
  if (s === 'DONE' || p >= 100) return 'Hoàn thành'
  if (p === 0) return 'Chưa xử lý'
  if (p >= 50) return 'Đã xử lý'
  return 'Đang xử lý'
}

export function computeVolume(dai: number, rong: number, cao: number): number {
  if (cao > 0) return dai * rong * cao
  if (rong > 0) return dai * rong
  return dai
}

export function formatVolumeDisplay(inc: IncidentRecord): string {
  const v = computeVolume(inc.dai ?? 0, inc.rong ?? 0, inc.cao ?? 0)
  if (!v) return '—'
  const u = inc.unit?.trim() || ''
  return `${v.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}${u ? ` ${u}` : ''}`
}

export function isCoreLocked(_inc: IncidentRecord, _nowMs = Date.now()): boolean {
  return false
}

export function resolveCompletedDate(progress: number, existing?: string): string {
  if (clampProgress(progress) < COMPLETION_PROGRESS_THRESHOLD) {
    return existing?.trim() || ''
  }
  const cur = existing?.trim()
  return cur || todayViDateString()
}

export function buildUpdateEntry(
  progress: number,
  note: string,
  images: string[],
  createdBy: string,
  date = todayIso(),
): IncidentUpdate {
  return {
    date,
    progress: clampProgress(progress),
    note,
    images,
    createdBy,
  }
}

export function initialUpdate(
  note: string,
  beforeImageUrls: string[],
  createdBy: string,
  incidentDate?: string,
): IncidentUpdate {
  const date =
    incidentDate && /^\d{4}-\d{2}-\d{2}$/.test(incidentDate)
      ? incidentDate
      : todayIso()
  return buildUpdateEntry(
    0,
    note.trim() || 'Phát hiện sự cố',
    beforeImageUrls,
    createdBy,
    date,
  )
}

export function progressUpdateNote(progress: number, customNote?: string): string {
  const p = clampProgress(progress)
  const base = `Cập nhật tiến độ ${p}%`
  return customNote?.trim() ? `${base} — ${customNote.trim()}` : base
}

export function buildKmString(kmPart: string, mPart: string): string {
  const km = kmPart.trim() || '0'
  const m = mPart.trim().padStart(3, '0') || '000'
  return `Km${km}+${m}`
}

export function buildIncidentCode(
  date: string,
  road: string,
  type: string,
  km: string,
  position: string,
): string {
  const dateCompact = date.replace(/\//g, '')
  const safeType = removeVietnameseForCode(type)
  const safeKm = km.replace(/[^a-zA-Z0-9+]/g, '')
  return `${dateCompact}_${road}_${safeType}_${safeKm}_${position}`
}

function removeVietnameseForCode(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .replace(/[^a-zA-Z0-9]+/g, '_')
}
