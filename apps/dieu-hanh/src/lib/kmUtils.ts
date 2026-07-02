/**
 * Chuyển lý trình dạng Km12+300 → 12300 để sắp xếp đúng thứ tự trên tuyến.
 * Không ghi vào Firestore — chỉ tính trên Web.
 */
export function parseKmToSortValue(km?: string): number {
  if (!km?.trim()) return Number.MAX_SAFE_INTEGER

  const clean = km
    .replace(/Km/gi, '')
    .replace(/\s/g, '')
    .trim()

  if (clean.includes('+')) {
    const [kmPart, mPart] = clean.split('+', 2)
    const kmNum = parseInt(kmPart, 10) || 0
    const mNum = Math.min(999, Math.max(0, parseInt(mPart, 10) || 0))
    return kmNum * 1000 + mNum
  }

  const digits = clean.replace(/\D/g, '')
  if (!digits) return Number.MAX_SAFE_INTEGER
  const n = parseInt(digits, 10)
  if (n >= 1000) {
    return Math.floor(n / 1000) * 1000 + (n % 1000)
  }
  return n * 1000
}

/**
 * Chuẩn hoá lý trình về dạng "Km{k}+{mmm}" như app.
 * Nhận "365850", "365+850", "Km365+850", "365" … → "Km365+850".
 * Chuỗi không có số → trả nguyên gốc (đã trim).
 */
export function formatKmDisplay(km?: string): string {
  const raw = (km ?? '').trim()
  if (!raw) return ''
  const clean = raw.replace(/Km/gi, '').replace(/\s/g, '')

  let kmNum: number
  let mNum: number
  if (clean.includes('+')) {
    const [kmPart, mPart] = clean.split('+', 2)
    kmNum = parseInt(kmPart.replace(/\D/g, ''), 10) || 0
    mNum = parseInt((mPart ?? '').replace(/\D/g, ''), 10) || 0
  } else {
    const digits = clean.replace(/\D/g, '')
    if (!digits) return raw
    const n = parseInt(digits, 10)
    if (n >= 1000) {
      kmNum = Math.floor(n / 1000)
      mNum = n % 1000
    } else {
      kmNum = n
      mNum = 0
    }
  }
  mNum = Math.min(999, Math.max(0, mNum))
  return `Km${kmNum}+${String(mNum).padStart(3, '0')}`
}

export function compareByKm(a?: string, b?: string): number {
  return parseKmToSortValue(a) - parseKmToSortValue(b)
}

export function sortIncidentsByKm<T extends { km?: string; road?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const roadCmp = (a.road ?? '').localeCompare(b.road ?? '', 'vi')
    if (roadCmp !== 0) return roadCmp
    return compareByKm(a.km, b.km)
  })
}

/** Khóa tuyến + lý trình chuẩn hóa — dùng phát hiện trùng sau lọc. */
export function chainageDedupeKey(inc: { road?: string; km?: string }): string | null {
  const kmVal = parseKmToSortValue(inc.km)
  if (kmVal === Number.MAX_SAFE_INTEGER) return null
  const road = (inc.road ?? '').trim() || '—'
  return `${road}\0${kmVal}`
}

/** Các khóa xuất hiện ≥ 2 lần trong danh sách đã lọc. */
export function buildDuplicateChainageKeySet(
  items: { road?: string; km?: string }[],
): Set<string> {
  const counts = new Map<string, number>()
  for (const inc of items) {
    const key = chainageDedupeKey(inc)
    if (!key) continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const dupes = new Set<string>()
  for (const [key, count] of counts) {
    if (count > 1) dupes.add(key)
  }
  return dupes
}

/** Lọc theo lý trình — nhập 8+995, Km8+995, 4638 hoặc chuỗi con. */
export function matchesChainageSearch(km: string | undefined, query: string): boolean {
  const q = query.trim()
  if (!q) return true

  const kmStr = (km ?? '').trim()
  if (!kmStr) return false

  const qLower = q.toLowerCase()
  if (kmStr.toLowerCase().includes(qLower)) return true

  const qNorm = q.replace(/km/gi, '').replace(/\s/g, '').toLowerCase()
  const kmNorm = kmStr.replace(/km/gi, '').replace(/\s/g, '').toLowerCase()
  if (qNorm && kmNorm.includes(qNorm)) return true

  const qVal = parseKmToSortValue(q)
  const kmVal = parseKmToSortValue(km)
  if (qVal !== Number.MAX_SAFE_INTEGER && kmVal !== Number.MAX_SAFE_INTEGER) {
    return kmVal === qVal
  }

  return false
}
