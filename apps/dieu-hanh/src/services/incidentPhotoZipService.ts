import JSZip from 'jszip'
import { formatKmDisplay } from '@quanlysuco/shared'
import {
  afterConstructionImages,
  beforeConstructionImages,
} from '@/lib/incidentUtils'
import { resolveDisplayImageUrl } from '@/services/imageUrlService'
import type { IncidentRecord } from '@/types/incident'

function isLocalHost(): boolean {
  if (typeof window === 'undefined') return true
  const h = window.location.hostname
  return h === 'localhost' || h === '127.0.0.1'
}

function sanitizeFilePart(raw: string): string {
  const s = (raw || '')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, '_')
    .trim()
  return s.slice(0, 80) || 'sc'
}

function incidentFolderName(inc: IncidentRecord, index: number): string {
  const road = sanitizeFilePart(inc.road || 'Tuyen')
  const km = sanitizeFilePart(formatKmDisplay(inc.km) || 'Km')
  const type = sanitizeFilePart(inc.type || 'SuCo')
  return `${String(index + 1).padStart(2, '0')}_${road}_${km}_${type}`
}

function extFromUrlOrBlob(url: string, blob: Blob): string {
  const m = /\.([a-zA-Z0-9]{2,5})(?:\?|$)/.exec(url)
  if (m) return m[1].toLowerCase()
  const t = blob.type || ''
  if (t.includes('png')) return 'png'
  if (t.includes('webp')) return 'webp'
  if (t.includes('gif')) return 'gif'
  return 'jpg'
}

async function fetchImageBlob(url: string): Promise<Blob | null> {
  const candidates: string[] = []
  if (!isLocalHost() && typeof window !== 'undefined') {
    candidates.push(
      `${window.location.origin}/api/img-proxy?url=${encodeURIComponent(url)}`,
    )
  }
  candidates.push(url)

  for (const candidate of candidates) {
    try {
      const resp = await fetch(candidate, { mode: 'cors' })
      if (!resp.ok) continue
      const blob = await resp.blob()
      if (blob.size > 0) return blob
    } catch {
      /* thử URL tiếp */
    }
  }
  return null
}

function triggerDownload(blob: Blob, filename: string) {
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(href), 30_000)
}

export type PhotoZipKind = 'before' | 'after' | 'both'

/**
 * Xuất ZIP ảnh sự cố đã chọn.
 * Cấu trúc: Anh_hien_trang/… và/hoặc Anh_xu_ly/… — mỗi sự cố một thư mục con.
 */
export async function exportIncidentPhotosZip(
  items: IncidentRecord[],
  kind: PhotoZipKind = 'both',
): Promise<{ fileCount: number; skipped: number }> {
  if (items.length === 0) {
    throw new Error('Chưa chọn sự cố nào')
  }

  const zip = new JSZip()
  const includeBefore = kind === 'before' || kind === 'both'
  const includeAfter = kind === 'after' || kind === 'both'
  let fileCount = 0
  let skipped = 0

  for (let i = 0; i < items.length; i++) {
    const inc = items[i]
    const folder = incidentFolderName(inc, i)

    const jobs: { folder: string; refs: string[] }[] = []
    if (includeBefore) {
      jobs.push({ folder: `Anh_hien_trang/${folder}`, refs: beforeConstructionImages(inc) })
    }
    if (includeAfter) {
      jobs.push({ folder: `Anh_xu_ly/${folder}`, refs: afterConstructionImages(inc) })
    }

    for (const job of jobs) {
      let imgIdx = 0
      for (const raw of job.refs) {
        const { url } = await resolveDisplayImageUrl(raw)
        if (!url) {
          skipped++
          continue
        }
        const blob = await fetchImageBlob(url)
        if (!blob) {
          skipped++
          continue
        }
        imgIdx++
        const ext = extFromUrlOrBlob(url, blob)
        zip.file(`${job.folder}/${String(imgIdx).padStart(2, '0')}.${ext}`, blob)
        fileCount++
      }
    }
  }

  if (fileCount === 0) {
    throw new Error('Không tải được ảnh nào (thiếu ảnh hoặc lỗi mạng/CORS)')
  }

  const stamp = new Date().toISOString().slice(0, 10)
  const kindLabel =
    kind === 'before' ? 'hien-trang' : kind === 'after' ? 'xu-ly' : 'anh-su-co'
  const out = await zip.generateAsync({ type: 'blob' })
  triggerDownload(out, `${kindLabel}_${items.length}diem_${stamp}.zip`)
  return { fileCount, skipped }
}
