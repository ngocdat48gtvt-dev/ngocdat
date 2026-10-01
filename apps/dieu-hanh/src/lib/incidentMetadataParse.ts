import { formatKmDisplay } from '@quanlysuco/shared'
import type { IncidentRecord } from '@/types/incident'

/** Metadata suy ra từ mã sự cố — khớp app: `{ddMMyyyy}_{road}_{type}_{Km}+{position}`. */
export interface RecoverableIncidentMetadata {
  km: string
  road?: string
  type?: string
  date?: string
  position?: string
  source: string
}

const POSITION_CODES = ['TTHL', 'TIM', 'TI', 'TL', 'HL', 'LC', 'HT', 'T', 'P', 'M'] as const

function storageFolderFromPhotoUrl(url: string): string | null {
  if (!url.startsWith('http')) return null
  try {
    const match = /\/o\/([^?]+)/.exec(url)
    if (!match) return null
    const path = decodeURIComponent(match[1])
    const parts = path.split('/')
    if (parts.length >= 4 && parts[0] === 'images') return parts[2] || null
  } catch {
    /* bỏ qua */
  }
  return null
}

export function metadataKeyCandidates(inc: IncidentRecord): string[] {
  const out: string[] = []
  const add = (value?: string) => {
    const t = value?.trim()
    if (t && !out.includes(t)) out.push(t)
  }
  add(inc.incidentId)
  add(inc.id)
  for (const url of [...(inc.beforeImages ?? []), ...(inc.afterImages ?? [])]) {
    const folder = storageFolderFromPhotoUrl(url)
    if (folder) add(folder)
  }
  return out
}

/**
 * Suy lý trình (và tuyến/loại/ngày/phía nếu có) từ mã sự cố hoặc thư mục Storage.
 * Hỗ trợ cả `Km365+250` và `Km365_250` (sau sanitize không dấu).
 */
export function parseIncidentKeyMetadata(key: string): RecoverableIncidentMetadata | null {
  const raw = key.trim()
  if (!raw) return null

  const kmMatch = raw.match(/Km(\d+)[+_](\d{1,3})/i)
  if (!kmMatch) return null

  const km = formatKmDisplay(`Km${kmMatch[1]}+${kmMatch[2]}`)
  if (!km) return null

  let date: string | undefined
  const dateMatch = raw.match(/^(\d{8})_/)
  if (dateMatch) {
    const d = dateMatch[1]
    date = `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4, 8)}`
  }

  let position: string | undefined
  for (const code of POSITION_CODES) {
    if (new RegExp(`_${code}$`, 'i').test(raw)) {
      position = code.toUpperCase()
      break
    }
  }

  let road: string | undefined
  let type: string | undefined
  const anchor = raw.match(/_Km(\d+)[+_](\d{1,3})(?:_|$)/i)
  if (anchor && anchor.index != null) {
    const middle = raw
      .slice(dateMatch ? 9 : 0, anchor.index)
      .replace(/^_|_$/g, '')
    if (middle) {
      const parts = middle.split('_').filter(Boolean)
      if (parts.length >= 1) {
        road = parts[0]
        if (parts.length > 1) type = parts.slice(1).join(' ')
      }
    }
  }

  return { km, road, type, date, position, source: raw }
}

export function parseRecoverableMetadata(
  inc: IncidentRecord,
): RecoverableIncidentMetadata | null {
  for (const key of metadataKeyCandidates(inc)) {
    const parsed = parseIncidentKeyMetadata(key)
    if (parsed) return parsed
  }
  return null
}

export function incidentMissingKm(inc: IncidentRecord): boolean {
  return !(inc.km ?? '').trim()
}

export function incidentNeedsMetadataRecovery(inc: IncidentRecord): boolean {
  if (!incidentMissingKm(inc)) return false
  return parseRecoverableMetadata(inc) != null
}
