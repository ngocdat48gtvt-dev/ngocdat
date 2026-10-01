/**
 * Tải blob xuống máy — gắn thẻ vào DOM, trì hoãn revoke (tránh Chrome hủy tải).
 * Điện thoại: ưu tiên Web Share nếu hỗ trợ.
 */
export async function downloadBlob(blob, filename) {
  const safeName = String(filename || "download").replace(/[\\/:*?"<>|]+/g, "_");
  const file = new File([blob], safeName, {
    type: blob.type || "application/octet-stream"
  });

  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isAppleMobile =
    /iPad|iPhone|iPod/.test(ua) &&
    !(/** @type {{ MSStream?: unknown }} */ (window).MSStream);
  const isAndroid = /Android/i.test(ua);
  const isTouchMac =
    typeof navigator !== "undefined" &&
    navigator.maxTouchPoints > 1 &&
    /Macintosh/i.test(ua);

  const canShareFiles =
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    typeof navigator.share === "function" &&
    navigator.canShare({ files: [file] });

  if (canShareFiles && (isAppleMobile || isAndroid || isTouchMac)) {
    try {
      await navigator.share({ files: [file], title: safeName });
      return;
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      if (name === "AbortError") return;
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = safeName;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();

  window.setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 4000);
}
