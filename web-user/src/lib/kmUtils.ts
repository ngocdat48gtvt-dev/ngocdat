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
