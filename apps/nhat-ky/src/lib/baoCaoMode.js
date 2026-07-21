/** Cổng Báo cáo — ADMIN xem TK KL chung, không vào sổ hạt trưởng. */

const SESSION_KEY = "nhatky_bao_cao";

export function isBaoCaoMode() {
  try {
    const q = new URLSearchParams(window.location.search || "");
    if (q.get("bao-cao") === "1" || q.get("mode") === "bao-cao") {
      sessionStorage.setItem(SESSION_KEY, "1");
      return true;
    }
    if ((window.location.hash || "").toLowerCase().includes("bao-cao")) {
      sessionStorage.setItem(SESSION_KEY, "1");
      return true;
    }
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function clearBaoCaoMode() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function resolvePortalId() {
  return isBaoCaoMode() ? "bao-cao" : "nhat-ky";
}
