import type { IncidentRecord, IncidentStatus } from '@/types/incident'
import { parseViDate } from '@/lib/incidentFilters'

export function statusLabel(status?: IncidentStatus): string {
  switch (status) {
    case 'PARTIAL':
      return 'Đang xử lý'
    case 'DONE':
      return 'Hoàn thành'
    default:
      return 'Chưa xử lý'
  }
}

/** Từ 90% ghi ngày hoàn thành (theo dõi lãnh đạo). */
export const COMPLETION_PROGRESS_THRESHOLD = 90

export function todayViDateString(): string {
  const d = new Date()
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return `${day}/${month}/${d.getFullYear()}`
}

/** Khớp MainActivity.showToday — "Thứ ..., dd/MM/yyyy". */
export function formatViDayDateString(): string {
  const weekday = new Date().toLocaleDateString('vi-VN', { weekday: 'long' })
  return `${weekday}, ${todayViDateString()}`
}

export function resolveCompletedDate(
  progress: number,
  existing?: string,
): string {
  const p = clampProgress(progress)
  if (p < COMPLETION_PROGRESS_THRESHOLD) return existing?.trim() || ''
  const cur = existing?.trim()
  if (cur) return cur
  return todayViDateString()
}

export function isSameCalendarDay(a?: string, b?: string): boolean {
  const sa = a?.trim()
  const sb = b?.trim()
  if (!sa || !sb) return false
  const da = parseViDate(sa)
  const db = parseViDate(sb)
  if (!da || !db) return sa === sb
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  )
}

export function isCompletedToday(inc: IncidentRecord): boolean {
  return isSameCalendarDay(inc.completedDate, todayViDateString())
}

/** Hoàn thành: có ngày hoàn thành hoặc tiến độ ≥ 90% (khớp app). */
export function isIncidentCompleted(inc: IncidentRecord): boolean {
  if (inc.completedDate?.trim()) return true
  if (clampProgress(inc.progress) >= COMPLETION_PROGRESS_THRESHOLD) return true
  const s = inc.status ?? statusFromProgress(inc.progress)
  return s === 'DONE'
}

/** Trạng thái cho bộ lọc Tiến độ (web). */
export function dispatchFilterStatus(inc: IncidentRecord): IncidentStatus {
  if (isIncidentCompleted(inc)) return 'DONE'
  if (clampProgress(inc.progress) > 0) return 'PARTIAL'
  return 'NEW'
}

export function clampProgress(progress?: number): number {
  const p = progress ?? 0
  return Math.min(100, Math.max(0, Math.round(p)))
}

export function progressLabel(progress?: number): string {
  const p = clampProgress(progress)
  if (p === 0) return '0% — Chưa xử lý'
  if (p >= 100) return '100% — Hoàn thành'
  return `${p}%`
}

export function statusFromProgress(progress?: number): IncidentStatus {
  const p = clampProgress(progress)
  if (p >= 100) return 'DONE'
  if (p > 0) return 'PARTIAL'
  return 'NEW'
}

export function formatDimValue(value?: number): string {
  if (value == null || value === 0) return '—'
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

export function computeVolumeM3(inc: IncidentRecord): number {
  const dai = inc.dai ?? 0
  const rong = inc.rong ?? 0
  const cao = inc.cao ?? 0
  const unit = (inc.unit ?? '').toLowerCase()
  if (unit !== 'm3' && unit !== 'm³') return 0
  if (cao > 0) return dai * rong * cao
  if (rong > 0) return dai * rong
  return dai
}

export type PriorityColor = 'red' | 'green' | 'default'

/** Đỏ: KL > 100 m³; xanh nhạt: hoàn thành; còn lại không tô. */
export function priorityColor(inc: IncidentRecord): PriorityColor {
  if (isIncidentCompleted(inc)) return 'green'
  if (computeVolumeM3(inc) > 100) return 'red'
  return 'default'
}

export const priorityRowClass: Record<PriorityColor, string> = {
  red: 'bg-red-50 dark:bg-red-950/35',
  green: 'bg-green-50 dark:bg-green-950/30',
  default: '',
}

export function completionImages(inc: IncidentRecord): string[] {
  const fromUpdates = (inc.updates ?? [])
    .filter((u) => u.progress >= 100)
    .flatMap((u) => u.images ?? [])
  if (fromUpdates.length > 0) return fromUpdates
  if (inc.progress === 100) return inc.afterImages ?? []
  return []
}

export function uniqueImageUrls(urls: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of urls) {
    const url = raw?.trim()
    if (!url || seen.has(url)) continue
    seen.add(url)
    out.push(url)
  }
  return out
}

/** Ảnh trước thi công (hiện trường). */
export function beforeConstructionImages(inc: IncidentRecord): string[] {
  return uniqueImageUrls(inc.beforeImages ?? [])
}

/** Ảnh sau thi công — gộp xử lý + hoàn thành, bỏ trùng URL. */
export function afterConstructionImages(inc: IncidentRecord): string[] {
  return uniqueImageUrls([...(inc.afterImages ?? []), ...completionImages(inc)])
}
