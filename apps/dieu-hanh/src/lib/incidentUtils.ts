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

export const TYPE_SA_BOI_CUNG = 'Sa bồi cống'
export const BAO_LU_GROUP = 'Bão lũ'
export const GEOLOGY_SOIL = 'DAT'
export const GEOLOGY_ROCK = 'DA'

export function isBaoLuGroup(groupName?: string): boolean {
  return (groupName?.trim() ?? '').localeCompare(BAO_LU_GROUP, 'vi', { sensitivity: 'accent' }) === 0
}

export function isSaBoiCungType(type?: string): boolean {
  return (type?.trim() ?? '').localeCompare(TYPE_SA_BOI_CUNG, 'vi', { sensitivity: 'accent' }) === 0
}

/** Sự cố cũ chưa có địa chất → mặc định Đất (khớp MasterDataLocal.kt). */
export function resolveGeologyType(value?: string): typeof GEOLOGY_SOIL | typeof GEOLOGY_ROCK {
  return value?.trim() === GEOLOGY_ROCK ? GEOLOGY_ROCK : GEOLOGY_SOIL
}

export function isGeologySoil(value?: string): boolean {
  return resolveGeologyType(value) === GEOLOGY_SOIL
}

export function isGeologyRock(value?: string): boolean {
  return resolveGeologyType(value) === GEOLOGY_ROCK
}

/**
 * Tỉ lệ % đất hiệu dụng (0..100) — khớp MasterDataLocal.resolveSoilPercent (Kotlin).
 * Ưu tiên soilPercent đã nhập; nếu chưa nhập (-1/ngoài [0..100]) thì suy từ geologyType:
 * DA → 0% đất (100% đá), còn lại → 100% đất.
 */
export function resolveSoilPercent(geologyType?: string, soilPercent?: number): number {
  if (typeof soilPercent === 'number' && soilPercent >= 0 && soilPercent <= 100) {
    return soilPercent
  }
  return isGeologyRock(geologyType) ? 0 : 100
}

/** KL đất / KL đá — chỉ nhóm Bão lũ; tách theo tỉ lệ % đất/đá (khớp ExcelExporter.kt). */
export function splitVolumeByGeology(inc: IncidentRecord): {
  soil: number | null
  rock: number | null
} {
  if (!isBaoLuGroup(inc.groupName)) return { soil: null, rock: null }
  const vol = computeKhoiLuong(inc)
  if (vol <= 0) return { soil: null, rock: null }
  const soilPct = resolveSoilPercent(inc.geologyType, inc.soilPercent)
  const rockPct = 100 - soilPct
  return {
    soil: soilPct > 0 ? (vol * soilPct) / 100 : null,
    rock: rockPct > 0 ? (vol * rockPct) / 100 : null,
  }
}

/** Khối lượng theo kích thước — khớp IncidentDetailActivity / MainActivity (Kotlin). */
export function computeKhoiLuong(inc: IncidentRecord): number {
  const dai = inc.dai ?? 0
  const rong = inc.rong ?? 0
  const cao = inc.cao ?? 0
  if (dai > 0 && rong > 0 && cao > 0) return dai * rong * cao
  if (dai > 0 && rong > 0) return dai * rong
  if (dai > 0) return dai
  return 0
}

export function normalizeDisplayUnit(unit?: string): string {
  const u = (unit ?? '').trim()
  if (!u) return ''
  const lower = u.toLowerCase()
  if (lower === 'm3' || lower === 'm³') return 'm³'
  if (lower === 'm2' || lower === 'm²') return 'm²'
  if (lower === 'm') return 'm'
  return u
}

/** Đơn vị hiển thị khi gộp thống kê — ưu tiên field unit, không có thì suy từ kích thước. */
export function resolveIncidentUnit(inc: IncidentRecord): string {
  const normalized = normalizeDisplayUnit(inc.unit)
  if (normalized) return normalized
  const dai = inc.dai ?? 0
  const rong = inc.rong ?? 0
  const cao = inc.cao ?? 0
  if (dai > 0 && rong > 0 && cao > 0) return 'm³'
  if (dai > 0 && rong > 0) return 'm²'
  if (dai > 0) return 'm'
  return ''
}

function isM3Unit(unit?: string): boolean {
  const u = normalizeDisplayUnit(unit)
  return u === 'm³'
}

/** Chỉ dùng cho tổng KL m³ (bộ lọc đơn vị m³). */
export function computeVolumeM3(inc: IncidentRecord): number {
  if (!isM3Unit(inc.unit)) return 0
  return computeKhoiLuong(inc)
}

export const HIGH_VOLUME_M3_THRESHOLD = 100

export function isHighVolumeM3(inc: IncidentRecord): boolean {
  return computeVolumeM3(inc) > HIGH_VOLUME_M3_THRESHOLD
}

export type PriorityColor = 'red' | 'green' | 'default'

/** Đỏ: KL > 100 m³; xanh nhạt: hoàn thành; còn lại không tô. */
export function priorityColor(inc: IncidentRecord): PriorityColor {
  if (isHighVolumeM3(inc)) return 'red'
  if (isIncidentCompleted(inc)) return 'green'
  return 'default'
}

export const priorityRowClass: Record<PriorityColor, string> = {
  red: 'bg-red-300/75 hover:bg-red-300 border-l-4 border-l-red-600 dark:bg-red-900/55 dark:hover:bg-red-900/70 dark:border-l-red-500',
  green: 'bg-green-50 dark:bg-green-950/30',
  default: '',
}

export const highVolumeVolCellClass =
  'font-bold text-red-800 dark:text-red-300'

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

/**
 * Chuẩn hoá tên ảnh để đối chiếu (port PhotoPathUtils.photoToken của app):
 * lấy tên file (bỏ query/path), URL-decode, bỏ tiền tố timestamp 13 số,
 * bỏ dấu tiếng Việt, lowercase, bỏ ký tự không phải chữ/số.
 */
export function photoToken(ref: string): string {
  let s = (ref ?? '').trim()
  if (!s) return ''
  s = s.split(/[?#]/)[0]
  const slash = s.lastIndexOf('/')
  if (slash >= 0) s = s.slice(slash + 1)
  try {
    s = decodeURIComponent(s)
  } catch {
    /* giữ nguyên nếu decode lỗi */
  }
  // tên có thể bị mã hoá lần nữa sau khi cắt path
  const slash2 = s.lastIndexOf('/')
  if (slash2 >= 0) s = s.slice(slash2 + 1)
  s = s.replace(/^\d{13}[-_]?/, '')
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
  s = s.toLowerCase().replace(/[^a-z0-9]/g, '')
  return s
}

const SELECTED_TOKEN_PREFIX = 'token:'

/**
 * Đối chiếu ref ảnh đã chọn (URL hoặc "token:<tên>" do app/web ghi) với danh sách URL hiện có.
 * Trả về URL khớp trong pool, hoặc null nếu không tìm thấy.
 */
export function resolveSelectedImageUrl(
  pool: string[],
  ref?: string,
): string | null {
  const trimmed = (ref ?? '').trim()
  if (!trimmed || pool.length === 0) return null

  const matchByToken = (token: string): string | null => {
    if (!token) return null
    return pool.find((url) => photoToken(url) === token) ?? null
  }

  if (trimmed.startsWith('http')) {
    if (pool.includes(trimmed)) return trimmed
    return matchByToken(photoToken(trimmed))
  }
  if (trimmed.startsWith(SELECTED_TOKEN_PREFIX)) {
    return matchByToken(trimmed.slice(SELECTED_TOKEN_PREFIX.length))
  }
  return matchByToken(photoToken(trimmed))
}

export function splitSelectedImageRefs(ref?: string): string[] {
  const trimmed = (ref ?? '').trim()
  if (!trimmed) return []
  return trimmed.split('|').map((s) => s.trim()).filter(Boolean)
}

export function joinSelectedImageRefs(urls: string[]): string {
  return urls.filter((u) => u.trim()).join('|')
}

/** Giải mọi ref đã chọn (URL hoặc token:) thành URL trong pool, giữ thứ tự. */
export function resolveSelectedImageUrls(pool: string[], ref?: string): string[] {
  const out: string[] = []
  for (const part of splitSelectedImageRefs(ref)) {
    const url = resolveSelectedImageUrl(pool, part)
    if (url && !out.includes(url)) out.push(url)
  }
  return out
}

export function isImageSelectedForReport(
  pool: string[],
  ref: string | undefined,
  url: string,
): boolean {
  return resolveSelectedImageUrls(pool, ref).includes(url)
}

export function toggleSelectedImageRef(
  pool: string[],
  ref: string | undefined,
  url: string,
): string {
  const current = resolveSelectedImageUrls(pool, ref)
  const already = isImageSelectedForReport(pool, ref, url)
  const next = already
    ? current.filter((u) => u !== url)
    : [...current, url]
  return joinSelectedImageRefs(next)
}

export function selectAllImageRefs(pool: string[]): string {
  return joinSelectedImageRefs(pool)
}

/** Ảnh hiện trạng cho Word — ưu tiên danh sách đã chọn; không tick thì chỉ ảnh đầu tiên. */
export function reportBeforeImages(inc: IncidentRecord): string[] {
  const pool = beforeConstructionImages(inc)
  if (pool.length === 0) return []
  const picked = resolveSelectedImageUrls(pool, inc.selectedBefore)
  return picked.length > 0 ? picked : pool[0] ? [pool[0]] : []
}

/** Ảnh sau xử lý cho Word — ưu tiên danh sách đã chọn; không tick thì chỉ ảnh đầu tiên. */
export function reportAfterImages(inc: IncidentRecord): string[] {
  const pool = afterConstructionImages(inc)
  if (pool.length === 0) return []
  const picked = resolveSelectedImageUrls(pool, inc.selectedAfter)
  return picked.length > 0 ? picked : pool[0] ? [pool[0]] : []
}

/** Ảnh hiện trạng dùng cho báo cáo Word: ưu tiên ảnh đã chọn, fallback ảnh đầu tiên. */
export function reportBeforeImage(inc: IncidentRecord): string | null {
  return reportBeforeImages(inc)[0] ?? null
}

/** Ảnh sau xử lý dùng cho báo cáo Word: ưu tiên ảnh đã chọn, fallback ảnh đầu tiên. */
export function reportAfterImage(inc: IncidentRecord): string | null {
  return reportAfterImages(inc)[0] ?? null
}
