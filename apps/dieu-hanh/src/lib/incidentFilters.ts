import type { IncidentRecord } from '@/types/incident'

export function parseViDate(s: string): Date | null {
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s.trim())
  if (dmy) {
    const [, d, m, y] = dmy
    return new Date(Number(y), Number(m) - 1, Number(d))
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim())
  if (iso) {
    const [, y, m, d] = iso
    return new Date(Number(y), Number(m) - 1, Number(d))
  }
  return null
}

function matchesDateRangeForField(
  dateStr: string | undefined,
  from: string,
  to: string,
  /** true: không có ngày hợp lệ → loại (dùng cho ngày hoàn thành). */
  requireDateWhenFiltering: boolean,
): boolean {
  if (!from && !to) return true
  const d = dateStr?.trim() ? parseViDate(dateStr) : null
  if (!d) return !requireDateWhenFiltering
  if (from) {
    const fromD = parseViDate(from)
    if (fromD && d < fromD) return false
  }
  if (to) {
    const toD = parseViDate(to)
    if (toD) {
      const end = new Date(toD)
      end.setHours(23, 59, 59, 999)
      if (d > end) return false
    }
  }
  return true
}

/** Lọc theo ngày xảy ra sự cố (Từ ngày / Đến ngày). */
export function matchesDateRange(
  inc: IncidentRecord,
  from: string,
  to: string,
): boolean {
  return matchesDateRangeForField(inc.date, from, to, false)
}

/** Lọc hoàn thành: khoảng ngày áp vào cột ngày hoàn thành. */
export function matchesCompletedDateRange(
  inc: IncidentRecord,
  from: string,
  to: string,
): boolean {
  return matchesDateRangeForField(inc.completedDate, from, to, true)
}
