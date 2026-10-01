/** Tải blob xuống máy — ổn định trên iOS Safari / PWA (download attribute thường bị bỏ qua). */
export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  const safeName = String(filename || 'download').replace(/[\\/:*?"<>|]+/g, '_')
  const file = new File([blob], safeName, {
    type: blob.type || 'application/octet-stream',
  })

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const isAppleMobile =
    /iPad|iPhone|iPod/.test(ua) &&
    !(window as unknown as { MSStream?: unknown }).MSStream
  const isAndroid = /Android/i.test(ua)
  const isTouchMac =
    typeof navigator !== 'undefined' &&
    navigator.maxTouchPoints > 1 &&
    /Macintosh/i.test(ua)

  const canShareFiles =
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    typeof navigator.share === 'function' &&
    navigator.canShare({ files: [file] })

  // Chỉ dùng Share trên điện thoại — desktop giữ tải file im lặng.
  if (canShareFiles && (isAppleMobile || isAndroid || isTouchMac)) {
    try {
      await navigator.share({ files: [file], title: safeName })
      return
    } catch (err) {
      const name = err instanceof Error ? err.name : ''
      if (name === 'AbortError') return
      /* Share bị chặn / lỗi → fallback anchor */
    }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = safeName
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()

  // iOS đôi khi bỏ qua download — mở tab để «Chia sẻ → Lưu vào Files»
  if (isAppleMobile) {
    window.setTimeout(() => {
      try {
        window.open(url, '_blank', 'noopener,noreferrer')
      } catch {
        /* ignore */
      }
    }, 250)
  }

  window.setTimeout(() => {
    a.remove()
    URL.revokeObjectURL(url)
  }, isAppleMobile ? 60_000 : 2_000)
}
