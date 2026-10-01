/** Cổng Báo cáo — ADMIN xem TK KL chung, không vào sổ hạt trưởng. */

const LEGACY_SESSION_KEY = "nhatky_bao_cao";

export function isBaoCaoMode() {
  try {
    const q = new URLSearchParams(window.location.search || "");
    const fromUrl =
      q.get("bao-cao") === "1" ||
      q.get("mode") === "bao-cao" ||
      (window.location.hash || "").toLowerCase().includes("bao-cao");

    // URL là nguồn duy nhất để Báo cáo và Sổ nội nghiệp không bị lẫn chế độ.
    sessionStorage.removeItem(LEGACY_SESSION_KEY);
    return fromUrl;
  } catch {
    return false;
  }
}

export function clearBaoCaoMode() {
  try {
    sessionStorage.removeItem(LEGACY_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function resolvePortalId() {
  return isBaoCaoMode() ? "bao-cao" : "nhat-ky";
}
