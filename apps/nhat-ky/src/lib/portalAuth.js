const SESSION_PORTAL_KEY = "qlsc_active_portal";
const EMAIL_PREFIX = "qlsc_portal_email_";

export const NHAT_KY_PORTAL = "nhat-ky";
export const BAO_CAO_PORTAL = "bao-cao";

let initPromise = null;

export function initPortalAuth(portalId) {
  if (!initPromise) {
    initPromise = Promise.resolve().then(() => {
      sessionStorage.setItem(SESSION_PORTAL_KEY, portalId);
    });
  }
  return initPromise;
}

export function markPortalLogin(portalId, email) {
  sessionStorage.setItem(SESSION_PORTAL_KEY, portalId);
  if (email) {
    try {
      localStorage.setItem(`${EMAIL_PREFIX}${portalId}`, email.trim());
    } catch {
      /* ignore */
    }
  }
}

export function clearPortalSession(portalId) {
  if (sessionStorage.getItem(SESSION_PORTAL_KEY) === portalId) {
    sessionStorage.removeItem(SESSION_PORTAL_KEY);
  }
}

export function getPortalRememberedEmail(portalId) {
  try {
    return localStorage.getItem(`${EMAIL_PREFIX}${portalId}`) || "";
  } catch {
    return "";
  }
}
