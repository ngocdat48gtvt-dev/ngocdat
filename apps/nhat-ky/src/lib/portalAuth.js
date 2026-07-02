import { signOut } from "firebase/auth";
import { auth } from "../firebase/firebase";

const PORTAL_FAMILY = {
  "dieu-hanh": "admin",
  "web-user": "field",
  "nhat-ky": "field"
};

const SESSION_FAMILY_KEY = "qlsc_portal_family";
const SESSION_PORTAL_KEY = "qlsc_active_portal";
const EMAIL_PREFIX = "qlsc_portal_email_";

export const NHAT_KY_PORTAL = "nhat-ky";

let initPromise = null;

export function initPortalAuth(portalId) {
  if (!initPromise) {
    initPromise = (async () => {
      const family = PORTAL_FAMILY[portalId];
      const activeFamily = sessionStorage.getItem(SESSION_FAMILY_KEY);
      if (activeFamily && activeFamily !== family && auth.currentUser) {
        await signOut(auth);
      }
      sessionStorage.setItem(SESSION_FAMILY_KEY, family);
      sessionStorage.setItem(SESSION_PORTAL_KEY, portalId);
    })();
  }
  return initPromise;
}

export function markPortalLogin(portalId, email) {
  const family = PORTAL_FAMILY[portalId];
  sessionStorage.setItem(SESSION_FAMILY_KEY, family);
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
  const family = PORTAL_FAMILY[portalId];
  if (sessionStorage.getItem(SESSION_FAMILY_KEY) === family) {
    sessionStorage.removeItem(SESSION_FAMILY_KEY);
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
