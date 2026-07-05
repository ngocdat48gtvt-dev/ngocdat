/** Lưu ảnh chọn ghép Word trên web (khớp selectedBefore/selectedAfter SQLite app). */

export type WordPhotoSelection = {
  before?: string
  after?: string
}

const KEY_PREFIX = 'word_photo_sel_'

function storageKey(uid: string): string {
  return `${KEY_PREFIX}${uid}`
}

export function loadAllWordPhotoSelections(uid: string): Record<string, WordPhotoSelection> {
  try {
    const raw = localStorage.getItem(storageKey(uid))
    if (!raw) return {}
    return JSON.parse(raw) as Record<string, WordPhotoSelection>
  } catch {
    return {}
  }
}

export function getWordPhotoSelection(
  uid: string,
  incidentId: string,
): WordPhotoSelection {
  return loadAllWordPhotoSelections(uid)[incidentId] ?? {}
}

export function setWordPhotoSelection(
  uid: string,
  incidentId: string,
  side: 'before' | 'after',
  url: string,
): void {
  const all = loadAllWordPhotoSelections(uid)
  const cur = all[incidentId] ?? {}
  all[incidentId] = { ...cur, [side]: url }
  localStorage.setItem(storageKey(uid), JSON.stringify(all))
}

export function clearWordPhotoSelection(uid: string, incidentId: string): void {
  const all = loadAllWordPhotoSelections(uid)
  delete all[incidentId]
  localStorage.setItem(storageKey(uid), JSON.stringify(all))
}
