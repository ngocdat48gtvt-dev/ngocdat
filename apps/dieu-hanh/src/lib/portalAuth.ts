export type PortalId = 'dieu-hanh' | 'web-user' | 'nhat-ky'
const SESSION_PORTAL_KEY = 'qlsc_active_portal'
const EMAIL_PREFIX = 'qlsc_portal_email_'

export const DIEU_HANH_PORTAL: PortalId = 'dieu-hanh'

let initPromise: Promise<void> | null = null

/** Ghi nhận cổng hiện tại; Firebase Auth được dùng chung trên toàn bộ website. */
export function initPortalAuth(portalId: PortalId): Promise<void> {
  if (!initPromise) {
    initPromise = Promise.resolve().then(() => {
      sessionStorage.setItem(SESSION_PORTAL_KEY, portalId)
    })
  }
  return initPromise
}

export function markPortalLogin(portalId: PortalId, email?: string): void {
  sessionStorage.setItem(SESSION_PORTAL_KEY, portalId)
  if (email) {
    try {
      localStorage.setItem(`${EMAIL_PREFIX}${portalId}`, email.trim())
    } catch {
      /* ignore */
    }
  }
}

export function clearPortalSession(portalId: PortalId): void {
  if (sessionStorage.getItem(SESSION_PORTAL_KEY) === portalId) {
    sessionStorage.removeItem(SESSION_PORTAL_KEY)
  }
}

export function getPortalRememberedEmail(portalId: PortalId): string {
  try {
    return localStorage.getItem(`${EMAIL_PREFIX}${portalId}`) || ''
  } catch {
    return ''
  }
}
