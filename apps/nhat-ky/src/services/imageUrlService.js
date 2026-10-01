import { getDownloadURL, ref } from "firebase/storage";
import { storage } from "../firebase/firebase";

/** Đường dẫn chỉ có trên app (file local), web không mở được trực tiếp. */
export function isLocalOnlyImageRef(raw) {
  const s = String(raw || "").trim();
  if (!s || s.startsWith("http")) return false;
  if (s.startsWith("images/")) return false;
  if (s.startsWith("token:")) return false;
  return true;
}

export function storagePathFromFirebaseUrl(url) {
  const match = /\/o\/([^?]+)/.exec(String(url || ""));
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

const CACHE_TTL_MS = 45 * 60 * 1000;
const urlCache = new Map();
const inflight = new Map();

function cacheGet(key) {
  const hit = urlCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    urlCache.delete(key);
    return null;
  }
  return { url: hit.url, errorKind: hit.errorKind };
}

function cacheSet(key, result) {
  urlCache.set(key, { ...result, at: Date.now() });
}

async function fetchFreshDownloadUrl(storagePath, fallbackHttp) {
  try {
    const url = await getDownloadURL(ref(storage, storagePath));
    return { url, errorKind: null };
  } catch {
    if (fallbackHttp?.startsWith("http")) {
      return { url: fallbackHttp, errorKind: null };
    }
    return { url: null, errorKind: "auth" };
  }
}

/**
 * URL hiển thị trên web.
 * - http(s) sẵn: dùng ngay (nhanh), không gọi Storage SDK mỗi lần.
 * - path `images/...`: lấy download URL qua SDK (cache + gộp request trùng).
 * - forceRefresh: làm mới token khi ảnh lỗi tải (token hết hạn).
 * @returns {Promise<{ url: string|null, errorKind: 'local'|'auth'|'failed'|null }>}
 */
export async function resolveDisplayImageUrl(raw, opts) {
  const s = String(raw || "").trim();
  if (!s) return { url: null, errorKind: "failed" };
  if (isLocalOnlyImageRef(s)) {
    return { url: null, errorKind: "local" };
  }

  const forceRefresh = !!opts?.forceRefresh;
  if (!forceRefresh) {
    const cached = cacheGet(s);
    if (cached) return cached;
  }

  const existing = !forceRefresh ? inflight.get(s) : undefined;
  if (existing) return existing;

  const promise = (async () => {
    // URL đầy đủ: hiển thị ngay — tránh N lần getDownloadURL khi mở gallery.
    if (s.startsWith("http") && !forceRefresh) {
      const result = { url: s, errorKind: null };
      cacheSet(s, result);
      return result;
    }

    const storagePath = s.startsWith("images/") ? s : storagePathFromFirebaseUrl(s);
    if (storagePath) {
      const result = await fetchFreshDownloadUrl(
        storagePath,
        s.startsWith("http") ? s : undefined
      );
      cacheSet(s, result);
      if (result.url && result.url !== s) cacheSet(result.url, result);
      return result;
    }

    if (s.startsWith("http")) {
      const result = { url: s, errorKind: null };
      cacheSet(s, result);
      return result;
    }
    return { url: null, errorKind: "local" };
  })();

  if (!forceRefresh) inflight.set(s, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(s);
  }
}
