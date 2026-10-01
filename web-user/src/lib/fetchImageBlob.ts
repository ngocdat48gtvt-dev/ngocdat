function isLocalHost(): boolean {
  if (typeof window === 'undefined') return false
  const h = window.location.hostname
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]'
}

/**
 * Tải ảnh Firebase Storage — ưu tiên /api/img-proxy cùng origin (tránh CORS),
 * local dev không có proxy thì fetch trực tiếp.
 */
export async function fetchImageBlob(url: string): Promise<Blob | null> {
  const src = String(url || '').trim()
  if (!src) return null

  const candidates: string[] = []
  if (!isLocalHost() && typeof window !== 'undefined') {
    candidates.push(
      `${window.location.origin}/api/img-proxy?url=${encodeURIComponent(src)}`,
    )
  }
  candidates.push(src)

  for (const candidate of candidates) {
    try {
      const resp = await fetch(candidate, { mode: 'cors' })
      if (!resp.ok) continue
      const blob = await resp.blob()
      if (blob.size > 0) return blob
    } catch {
      /* thử URL tiếp theo */
    }
  }
  return null
}
