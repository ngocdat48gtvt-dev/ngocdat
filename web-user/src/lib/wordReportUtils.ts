import type { IncidentRecord } from '@/types/incident'
import { parseViDate } from '@/lib/incidentFilters'
import { sortIncidentsByKm } from '@/lib/kmUtils'
import { beforeConstructionImages, afterConstructionImages } from '@/lib/incidentUtils'
import type { WordPhotoSelection } from '@/lib/wordPhotoSelection'

const WORD_IMAGE_MAX_SIDE = 1200
const WORD_JPEG_QUALITY = 0.82

export { WORD_IMAGE_MAX_SIDE, WORD_JPEG_QUALITY }

export function splitPhotoUrls(photos: string[] | undefined): string[] {
  return photos?.map((p) => p.trim()).filter(Boolean) ?? []
}

/** Khớp ReportActivity.resolvePhotoPath */
export function resolvePhotoPath(photos: string[], selected?: string): string {
  if (selected?.trim()) return selected.trim()
  return photos.find((p) => p.trim())?.trim() ?? ''
}

/** Khớp WordExporter.resolvePhotoList */
export function resolvePhotoList(photos: string[], selectedPath?: string): string[] {
  if (selectedPath?.trim()) return [selectedPath.trim()]
  return photos.filter((p) => p.trim())
}

export function isCubicMeterUnit(unit?: string): boolean {
  const u = (unit ?? '').trim().toLowerCase()
  return u === 'm3' || u === 'm³'
}

export function cubicMeterVolume(inc: IncidentRecord): number {
  return (inc.dai ?? 0) * (inc.rong ?? 0) * (inc.cao ?? 0)
}

/** Khớp ReportActivity.matchesWordVolumeFilter */
export function matchesWordVolumeFilter(
  inc: IncidentRecord,
  includeUnder100: boolean,
  includeOver100: boolean,
): boolean {
  if (!isCubicMeterUnit(inc.unit)) return true
  const vol = cubicMeterVolume(inc)
  if (includeUnder100 && includeOver100) return true
  if (includeUnder100) return vol < 100
  if (includeOver100) return vol >= 100
  return false
}

export function sortForWordExport(items: IncidentRecord[]): IncidentRecord[] {
  return sortIncidentsByKm(items)
}

/** Khớp ReportActivity.incidentDateRange — min/max ngày xảy ra. */
export function incidentDateRange(items: IncidentRecord[]): { start: string; end: string } {
  const dates = items
    .map((inc) => parseViDate(inc.date ?? ''))
    .filter((d): d is Date => d != null)
    .sort((a, b) => a.getTime() - b.getTime())

  if (!dates.length) return { start: '', end: '' }

  const fmt = (d: Date) => {
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    return `${day}/${month}/${d.getFullYear()}`
  }
  return { start: fmt(dates[0]), end: fmt(dates[dates.length - 1]) }
}

export function buildAutoWordTitles(items: IncidentRecord[]): {
  title1: string
  title2: string
} {
  const sorted = sortForWordExport(items)
  const first = sorted[0]
  const road = first?.road ?? ''
  const type = first?.type ?? ''
  const { start, end } = incidentDateRange(items)
  return {
    title1: `ẢNH ${type.toUpperCase()} TRÊN ${road}`,
    title2: `(Do ảnh hưởng của các đợt mưa, lũ từ ngày ${start} đến ngày ${end})`,
  }
}

export function buildWordFilename(items: IncidentRecord[]): string {
  const sorted = [...items].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const road = first?.road ?? 'duong'
  const type = (first?.type ?? 'suco').toLowerCase().replace(/\s+/g, '_')
  const start = (first?.date ?? '').replace(/\//g, '-')
  const end = (last?.date ?? '').replace(/\//g, '-')
  return `${road}_${type}_ngay_${start}_den_${end}.docx`
}

export function buildPhotoMaps(
  items: IncidentRecord[],
  selections: Record<string, WordPhotoSelection>,
): { beforeMap: Record<string, string>; afterMap: Record<string, string> } {
  const beforeMap: Record<string, string> = {}
  const afterMap: Record<string, string> = {}
  for (const inc of items) {
    const sel = selections[inc.id] ?? {}
    const beforeUrls = beforeConstructionImages(inc)
    const afterUrls = afterConstructionImages(inc)
    beforeMap[inc.id] = resolvePhotoPath(beforeUrls, sel.before)
    afterMap[inc.id] = resolvePhotoPath(afterUrls, sel.after)
  }
  return { beforeMap, afterMap }
}

/** Nén ảnh JPEG khớp WordExporter.prepareImageForWord */
export async function prepareImageForWord(
  url: string,
): Promise<{ data: Uint8Array; width: number; height: number } | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    const bitmap = await createImageBitmap(blob)
    const maxSide = WORD_IMAGE_MAX_SIDE
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close()
    const jpegBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', WORD_JPEG_QUALITY),
    )
    if (!jpegBlob) return null
    const buf = await jpegBlob.arrayBuffer()
    return { data: new Uint8Array(buf), width: w, height: h }
  } catch {
    return null
  }
}

export function imageDisplaySize(
  width: number,
  height: number,
  cellWidthPt: number,
  maxHeightPt: number,
): { width: number; height: number } {
  const displayWidth = cellWidthPt * 0.9
  const ratio = height / width
  const h = Math.min(displayWidth * ratio, maxHeightPt)
  return { width: displayWidth, height: h }
}
