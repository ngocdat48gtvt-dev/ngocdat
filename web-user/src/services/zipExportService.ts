import JSZip from 'jszip'
import type { IncidentRecord } from '@/types/incident'
import { beforeConstructionImages, afterConstructionImages } from '@/lib/incidentUtils'

async function fetchBlob(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return await res.blob()
  } catch {
    return null
  }
}

function safeFolderName(inc: IncidentRecord): string {
  const type = (inc.type ?? 'su_co').replace(/[\\/:*?"<>|]+/g, '_')
  const km = (inc.km ?? inc.id).replace(/[\\/:*?"<>|]+/g, '_')
  return `${type}_${km}_${inc.id.slice(0, 8)}`
}

export async function exportIncidentsZip(
  items: IncidentRecord[],
  filename: string,
): Promise<void> {
  const zip = new JSZip()
  let count = 0

  for (const inc of items) {
    const folder = safeFolderName(inc)
    const before = beforeConstructionImages(inc)
    const after = afterConstructionImages(inc)

    for (let i = 0; i < before.length; i++) {
      const blob = await fetchBlob(before[i])
      if (blob) {
        zip.file(`${folder}/before/before_${i + 1}.jpg`, blob)
        count++
      }
    }
    for (let i = 0; i < after.length; i++) {
      const blob = await fetchBlob(after[i])
      if (blob) {
        zip.file(`${folder}/after/after_${i + 1}.jpg`, blob)
        count++
      }
    }
  }

  if (count === 0) {
    throw new Error('Không có ảnh để nén')
  }

  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.zip') ? filename : `${filename}.zip`
  a.click()
  URL.revokeObjectURL(url)
}
