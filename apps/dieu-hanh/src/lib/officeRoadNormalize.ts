import type { OfficeRoad } from '@/types/officeRoad'

function newRoadId(): string {
  return `road_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

function stripKmPrefix(value: string): string {
  return String(value ?? '')
    .trim()
    .replace(/^km\s*/i, '')
}

function formatKmInput(value: string): string {
  const raw = stripKmPrefix(value)
  if (!raw) return ''
  return raw.includes('+') ? `Km${raw}` : raw
}

export function buildKmRange(kmFrom: string, kmTo: string): string {
  const from = formatKmInput(kmFrom)
  const to = formatKmInput(kmTo)
  if (from && to) return `${from}-${to}`
  return from || to || ''
}

function parseKmRangeString(kmRange: string): { kmFrom: string; kmTo: string } {
  const text = String(kmRange ?? '').trim()
  if (!text) return { kmFrom: '', kmTo: '' }
  const parts = text.split(/\s*[-–—]\s*/)
  if (parts.length >= 2) {
    return {
      kmFrom: stripKmPrefix(parts[0] ?? ''),
      kmTo: stripKmPrefix(parts[1] ?? ''),
    }
  }
  return { kmFrom: '', kmTo: '' }
}

export function normalizeOfficeRoad(road: Partial<OfficeRoad>): OfficeRoad {
  const roadName = String(road.roadName || road.label || '').trim()
  const hat = String(road.hat || '').trim()
  let kmFrom = String(road.kmFrom || '').trim()
  let kmTo = String(road.kmTo || '').trim()
  let kmRange = String(road.kmRange || '').trim()

  if (!kmFrom && !kmTo && kmRange) {
    const parsed = parseKmRangeString(kmRange)
    kmFrom = parsed.kmFrom
    kmTo = parsed.kmTo
  }
  if (kmFrom || kmTo) {
    kmRange = buildKmRange(kmFrom, kmTo)
  }

  const autoLabel =
    roadName && hat ? `${roadName} — Hạt ${hat}` : roadName || hat || 'Đoạn mới'

  return {
    id: road.id || newRoadId(),
    label: String(road.label || autoLabel).trim(),
    roadName,
    hat,
    kmFrom,
    kmTo,
    kmRange,
    company: String(road.company || '').trim(),
    createdAt: road.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

export function groupOfficeRoadsByName(roads: OfficeRoad[]): { roadName: string; segments: OfficeRoad[] }[] {
  const map = new Map<string, OfficeRoad[]>()
  for (const road of roads) {
    const key = road.roadName || road.label || 'Khác'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(road)
  }
  return [...map.entries()].map(([roadName, segments]) => ({
    roadName,
    segments: segments.sort((a, b) =>
      (a.kmFrom || '').localeCompare(b.kmFrom || '', undefined, { numeric: true }),
    ),
  }))
}

export function formatKmDisplay(value: string): string {
  return formatKmInput(value)
}
