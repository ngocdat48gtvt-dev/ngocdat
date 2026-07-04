import { getDownloadURL, ref } from 'firebase/storage'
import { storage } from '@/firebase/firebase'

/** Đường dẫn chỉ có trên app (file local), web không mở được trực tiếp. */
export function isLocalOnlyImageRef(raw: string): boolean {
  const s = (raw ?? '').trim()
  if (!s || s.startsWith('http')) return false
  if (s.startsWith('images/')) return false
  if (s.startsWith('token:')) return false
  return true
}

export function storagePathFromFirebaseUrl(url: string): string | null {
  const match = /\/o\/([^?]+)/.exec(String(url || ''))
  if (!match) return null
  try {
    return decodeURIComponent(match[1])
  } catch {
    return match[1]
  }
}

export type ImageResolveError = 'local' | 'auth' | 'failed' | null

/** URL hiển thị — làm mới token qua Storage SDK (cần đăng nhập Firebase). */
export async function resolveDisplayImageUrl(
  raw: string,
): Promise<{ url: string | null; errorKind: ImageResolveError }> {
  const s = (raw ?? '').trim()
  if (!s) return { url: null, errorKind: 'failed' }
  if (isLocalOnlyImageRef(s)) {
    return { url: null, errorKind: 'local' }
  }

  const storagePath = s.startsWith('images/') ? s : storagePathFromFirebaseUrl(s)
  if (storagePath) {
    try {
      const url = await getDownloadURL(ref(storage, storagePath))
      return { url, errorKind: null }
    } catch {
      if (s.startsWith('http')) {
        return { url: s, errorKind: null }
      }
      return { url: null, errorKind: 'auth' }
    }
  }

  if (s.startsWith('http')) return { url: s, errorKind: null }
  return { url: null, errorKind: 'local' }
}
