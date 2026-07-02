import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage'
import { arrayUnion, doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db, storage } from '@/firebase/firebase'

export type PhotoKind = 'before' | 'after'

function loadImageEl(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image load failed'))
    img.src = src
  })
}

/** Resize ảnh (cạnh dài ≤ maxSide) + nén JPEG trước khi upload để tiết kiệm dung lượng. */
async function resizeToJpegBlob(file: File, maxSide = 1600, quality = 0.85): Promise<Blob> {
  const objectUrl = URL.createObjectURL(file)
  try {
    const img = await loadImageEl(objectUrl)
    const natW = img.naturalWidth || img.width
    const natH = img.naturalHeight || img.height
    if (natW <= 0 || natH <= 0) return file

    const scale = Math.min(1, maxSide / Math.max(natW, natH))
    const w = Math.max(1, Math.round(natW * scale))
    const h = Math.max(1, Math.round(natH * scale))

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(img, 0, 0, w, h)

    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob((b) => res(b), 'image/jpeg', quality),
    )
    return blob ?? file
  } catch {
    return file
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function sanitizeName(name: string): string {
  const base = name.replace(/\.[^.]+$/, '')
  const clean = base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return clean || 'anh'
}

/**
 * Admin bổ sung ảnh từ máy tính: resize → upload lên Storage (thư mục của chính
 * uploader theo storage.rules) → lấy download URL → append vào mảng
 * beforeImages/afterImages của sự cố trên Firestore (app + web đều dùng chung).
 * Trả về danh sách URL vừa thêm.
 */
export async function uploadAndAttachPhotos(opts: {
  uploaderUid: string
  ownerUid: string
  docId: string
  incidentId: string
  kind: PhotoKind
  files: File[]
  onProgress?: (done: number, total: number) => void
}): Promise<string[]> {
  const { uploaderUid, ownerUid, docId, incidentId, kind, files, onProgress } = opts
  if (!uploaderUid || !ownerUid || !docId) {
    throw new Error('Thiếu thông tin sự cố')
  }
  const field = kind === 'before' ? 'beforeImages' : 'afterImages'
  const folder = sanitizeName(incidentId || docId)
  const urls: string[] = []

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const blob = await resizeToJpegBlob(file)
    const path = `images/${uploaderUid}/${folder}/${kind}/${Date.now()}_${sanitizeName(file.name)}.jpg`
    const ref = storageRef(storage, path)
    await uploadBytes(ref, blob, { contentType: 'image/jpeg' })
    const url = await getDownloadURL(ref)
    urls.push(url)
    onProgress?.(i + 1, files.length)
  }

  if (urls.length > 0) {
    await updateDoc(doc(db, 'users', ownerUid, 'incidents', docId), {
      [field]: arrayUnion(...urls),
      updatedAt: serverTimestamp(),
    })
  }
  return urls
}
