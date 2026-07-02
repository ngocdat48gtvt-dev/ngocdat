import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateLicenseUid(length = 20): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  let result = ''
  const array = new Uint32Array(length)
  crypto.getRandomValues(array)
  for (let i = 0; i < length; i++) {
    result += chars[array[i]! % chars.length]
  }
  return result
}

export function parseMaxDevices(value: unknown): number {
  if (typeof value === 'number') return Math.max(1, value)
  if (typeof value === 'string') return Math.max(1, parseInt(value, 10) || 1)
  return 1
}

export function parseExpireDate(dateStr: string): Date | null {
  if (!dateStr?.trim()) return null
  const s = dateStr.trim()

  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (iso) {
    const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 23, 59, 59, 999)
    return Number.isNaN(date.getTime()) ? null : date
  }

  const vn = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if (vn) {
    const date = new Date(Number(vn[3]), Number(vn[2]) - 1, Number(vn[1]), 23, 59, 59, 999)
    return Number.isNaN(date.getTime()) ? null : date
  }

  const fallback = new Date(s)
  return Number.isNaN(fallback.getTime()) ? null : fallback
}

export function isExpired(expireDate: string): boolean {
  const end = parseExpireDate(expireDate)
  if (!end) return true
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)
  return end.getTime() < todayEnd.getTime()
}

export function isExpiringWithinDays(expireDate: string, days: number): boolean {
  const remaining = daysUntilExpire(expireDate)
  if (remaining === null) return false
  return remaining >= 0 && remaining <= days
}

export function needsRenewalContact(expireDate: string, days: number): boolean {
  const remaining = daysUntilExpire(expireDate)
  if (remaining === null) return false
  return remaining <= days
}

export function addDaysToDate(dateStr: string, days: number): string {
  const d = dateStr ? new Date(dateStr) : new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function formatTimestamp(
  value: TimestampLike | null | undefined,
): string {
  if (!value) return '—'
  let date: Date
  if (typeof value === 'string') {
    date = new Date(value)
  } else if ('toDate' in value && typeof value.toDate === 'function') {
    date = value.toDate()
  } else if ('seconds' in value) {
    date = new Date(value.seconds * 1000)
  } else {
    return '—'
  }
  return date.toLocaleString('vi-VN')
}

type TimestampLike =
  | { toDate: () => Date }
  | { seconds: number; nanoseconds?: number }
  | string

export function formatDate(dateStr: string): string {
  const date = parseExpireDate(dateStr)
  if (!date) return '—'
  return date.toLocaleDateString('vi-VN')
}

export function toIsoDateString(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function formatMonthVi(monthKey: string): string {
  const match = monthKey.match(/^(\d{4})-(\d{1,2})$/)
  if (!match) return monthKey
  return `Tháng ${Number(match[2])}/${match[1]}`
}

export function daysUntilExpire(expireDate: string): number | null {
  const end = parseExpireDate(expireDate)
  if (!end) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const endDay = new Date(end)
  endDay.setHours(0, 0, 0, 0)
  return Math.round((endDay.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
}

export function normalizePhone(value: string): string {
  return value.replace(/\D/g, '')
}

export function zaloChatUrl(zalo: string): string | null {
  const digits = normalizePhone(zalo)
  if (digits.length >= 9) return `https://zalo.me/${digits}`
  return null
}
