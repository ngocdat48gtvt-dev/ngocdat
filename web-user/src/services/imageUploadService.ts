import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from '@/firebase/firebase'
import { removeVietnamese } from '@/lib/vietnamese'

/** Khớp FirebaseSync.uploadImages — path Storage hiện tại. */
export async function uploadIncidentImage(
  uid: string,
  incidentId: string,
  file: File,
  type: 'before' | 'after',
): Promise<string> {
  const safeIncidentId = removeVietnamese(incidentId)
  const safeType = removeVietnamese(type)
  const safeName = removeVietnamese(file.name || 'photo.jpg')
  const path = `images/${uid}/${safeIncidentId}/${safeType}/${Date.now()}_${safeName}`
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, file, { contentType: file.type || 'image/jpeg' })
  return getDownloadURL(storageRef)
}

export async function uploadIncidentImages(
  uid: string,
  incidentId: string,
  files: File[],
  type: 'before' | 'after',
  onProgress?: (done: number, total: number) => void,
): Promise<string[]> {
  const urls: string[] = []
  for (let i = 0; i < files.length; i++) {
    const url = await uploadIncidentImage(uid, incidentId, files[i], type)
    urls.push(url)
    onProgress?.(i + 1, files.length)
  }
  return urls
}
