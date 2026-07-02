export const TRASH_RETENTION_MS = 7 * 24 * 60 * 60 * 1000

export function deletedAtToMs(value: unknown): number | null {
  if (value == null) return null
  if (typeof value === 'number') return value
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    const seconds = (value as { seconds: number }).seconds
    if (typeof seconds === 'number') return seconds * 1000
  }
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const toDate = (value as { toDate: () => Date }).toDate
    if (typeof toDate === 'function') return toDate.call(value).getTime()
  }
  return null
}

export function isTrashExpired(deletedAtMs: number, now = Date.now()): boolean {
  return now - deletedAtMs >= TRASH_RETENTION_MS
}

export function trashDaysRemaining(deletedAtMs: number, now = Date.now()): number {
  const remaining = TRASH_RETENTION_MS - (now - deletedAtMs)
  if (remaining <= 0) return 0
  const dayMs = 24 * 60 * 60 * 1000
  return Math.ceil(remaining / dayMs)
}

export function formatTrashDeletedAt(deletedAtMs: number): string {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(deletedAtMs))
}
