import { parseViDate } from '@/lib/incidentFilters'
import type {
  IncidentRecord,
  IncidentRework,
  ReworkHistoryEntry,
  ReworkStatus,
} from '@/types/incident'

export const REWORK_REASON_OPTIONS = [
  'Ảnh sau xử lý chưa rõ',
  'Thiếu ảnh toàn cảnh',
  'Thiếu ảnh hiện trạng',
  'Thiếu ảnh sau xử lý',
  'Ảnh không đúng vị trí',
  'Thiếu thông tin hiện trường',
  'Khác',
] as const

export function emptyIncidentRework(): IncidentRework {
  return {
    required: false,
    status: 'NONE',
    reason: '',
    note: '',
    assignedAt: null,
    assignedBy: '',
    completedAt: null,
    approvedAt: null,
    submissionNote: '',
    submissionImages: [],
  }
}

export function parseIncidentRework(raw: unknown): IncidentRework {
  if (!raw || typeof raw !== 'object') return emptyIncidentRework()
  const r = raw as Record<string, unknown>
  const status = String(r.status ?? 'NONE') as ReworkStatus
  const images = Array.isArray(r.submissionImages)
    ? r.submissionImages.map((u) => String(u)).filter(Boolean)
    : []
  return {
    required: r.required === true,
    status: ['NONE', 'ASSIGNED', 'PENDING_APPROVAL', 'APPROVED'].includes(status)
      ? status
      : 'NONE',
    reason: String(r.reason ?? ''),
    note: String(r.note ?? ''),
    assignedAt: r.assignedAt ? String(r.assignedAt) : null,
    assignedBy: String(r.assignedBy ?? ''),
    completedAt: r.completedAt ? String(r.completedAt) : null,
    approvedAt: r.approvedAt ? String(r.approvedAt) : null,
    submissionNote: String(r.submissionNote ?? ''),
    submissionImages: images,
  }
}

export function parseReworkHistory(raw: unknown): ReworkHistoryEntry[] {
  if (!Array.isArray(raw)) return []
  const out: ReworkHistoryEntry[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const e = item as Record<string, unknown>
    const type = e.type
    if (
      type !== 'ASSIGNED' &&
      type !== 'SUBMITTED' &&
      type !== 'APPROVED' &&
      type !== 'REVISION_REQUESTED'
    ) {
      continue
    }
    const images = Array.isArray(e.submissionImages)
      ? e.submissionImages.map((u) => String(u)).filter(Boolean)
      : undefined
    const entry: ReworkHistoryEntry = {
      type,
      at: String(e.at ?? ''),
      by: String(e.by ?? ''),
    }
    if (e.reason) entry.reason = String(e.reason)
    if (e.note) entry.note = String(e.note)
    if (e.submissionNote) entry.submissionNote = String(e.submissionNote)
    if (images?.length) entry.submissionImages = images
    if (typeof e.mergedImageCount === 'number') entry.mergedImageCount = e.mergedImageCount
    out.push(entry)
  }
  return out
}

export function getIncidentRework(inc: IncidentRecord): IncidentRework {
  return inc.rework ?? emptyIncidentRework()
}

export function canAssignRework(inc: IncidentRecord): boolean {
  const rw = getIncidentRework(inc)
  if (rw.status === 'APPROVED') return false
  if (rw.required && (rw.status === 'ASSIGNED' || rw.status === 'PENDING_APPROVAL')) {
    return false
  }
  return true
}

export function reworkStatusLabel(status: ReworkStatus): string {
  switch (status) {
    case 'ASSIGNED':
      return 'Chưa thực hiện'
    case 'PENDING_APPROVAL':
      return 'Chờ duyệt'
    case 'APPROVED':
      return 'Đã duyệt'
    default:
      return '—'
  }
}

/** Nhãn ngắn trên bảng điều hành (khớp tab Yêu cầu bổ sung). */
export function reworkDispatchTableLabel(status: ReworkStatus): string {
  switch (status) {
    case 'ASSIGNED':
      return 'Chưa thực hiện'
    case 'PENDING_APPROVAL':
      return 'Chờ duyệt'
    case 'APPROVED':
      return 'Hoàn thành'
    default:
      return ''
  }
}

export function hasReworkRequest(inc: IncidentRecord): boolean {
  const rw = getIncidentRework(inc)
  return rw.required && rw.status !== 'NONE'
}

export function reworkBadgeVariant(
  status: ReworkStatus,
): 'default' | 'success' | 'warning' | 'destructive' | 'muted' {
  switch (status) {
    case 'ASSIGNED':
      return 'warning'
    case 'PENDING_APPROVAL':
      return 'default'
    case 'APPROVED':
      return 'success'
    default:
      return 'muted'
  }
}

/** Màu chữ trên cột Giao việc — tương phản cao, không dùng vàng. */
export function reworkDispatchTableTextClass(status: ReworkStatus): string {
  switch (status) {
    case 'ASSIGNED':
      return 'font-semibold text-orange-800 dark:text-orange-200'
    case 'PENDING_APPROVAL':
      return 'font-semibold text-blue-700 dark:text-blue-300'
    case 'APPROVED':
      return 'font-semibold text-emerald-700 dark:text-emerald-300'
    default:
      return 'text-muted-foreground'
  }
}

export function filterReworkAssigned(items: IncidentRecord[]): IncidentRecord[] {
  return items.filter((inc) => {
    const rw = getIncidentRework(inc)
    return rw.required && rw.status === 'ASSIGNED'
  })
}

export function filterReworkPendingApproval(items: IncidentRecord[]): IncidentRecord[] {
  return items.filter((inc) => {
    const rw = getIncidentRework(inc)
    return rw.required && rw.status === 'PENDING_APPROVAL'
  })
}

export function filterReworkApproved(items: IncidentRecord[]): IncidentRecord[] {
  return items.filter((inc) => getIncidentRework(inc).status === 'APPROVED')
}

function parseTimelineDate(s: string): number {
  const d = parseViDate(s)
  return d ? d.getTime() : 0
}

export type TimelineEvent = {
  key: string
  at: string
  sortKey: number
  title: string
  lines: string[]
  by?: string
}

export function buildIncidentTimelineEvents(inc: IncidentRecord): TimelineEvent[] {
  const events: TimelineEvent[] = []

  if (inc.date?.trim()) {
    events.push({
      key: 'created',
      at: inc.date.trim(),
      sortKey: parseTimelineDate(inc.date),
      title: 'Tạo sự cố',
      lines: [],
    })
  }

  for (const u of inc.updates ?? []) {
    if (!u.date?.trim()) continue
    const note = u.note?.trim() || `${u.progress ?? 0}%`
    events.push({
      key: `update-${u.date}-${note}`,
      at: u.date.trim(),
      sortKey: parseTimelineDate(u.date),
      title: note,
      lines: u.progress != null ? [`Tiến độ: ${u.progress}%`] : [],
      by: u.createdBy || undefined,
    })
  }

  if (inc.completedDate?.trim()) {
    events.push({
      key: 'completed',
      at: inc.completedDate.trim(),
      sortKey: parseTimelineDate(inc.completedDate),
      title: 'Hoàn thành 100%',
      lines: [],
    })
  }

  for (const h of inc.reworkHistory ?? []) {
    if (!h.at?.trim()) continue
    let title = ''
    const lines: string[] = []
    switch (h.type) {
      case 'ASSIGNED':
        title = 'Admin yêu cầu bổ sung'
        if (h.reason) lines.push(`Lý do: ${h.reason}`)
        if (h.note) lines.push(h.note)
        break
      case 'SUBMITTED':
        title = 'User bổ sung ảnh'
        if (h.submissionNote) lines.push(h.submissionNote)
        break
      case 'APPROVED':
        title = 'Admin duyệt'
        if (h.mergedImageCount != null && h.mergedImageCount > 0) {
          lines.push(`Đã gộp ${h.mergedImageCount} ảnh vào sau thi công`)
        }
        break
      case 'REVISION_REQUESTED':
        title = 'Admin yêu cầu sửa tiếp'
        if (h.reason) lines.push(`Lý do: ${h.reason}`)
        if (h.note) lines.push(h.note)
        break
    }
    events.push({
      key: `rework-${h.type}-${h.at}`,
      at: h.at.trim(),
      sortKey: parseTimelineDate(h.at),
      title,
      lines,
      by: h.by || undefined,
    })
  }

  return events.sort((a, b) => b.sortKey - a.sortKey)
}
