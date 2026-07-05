import { signOut } from 'firebase/auth'
import { auth } from '@/firebase/firebase'

export type PortalId = 'dieu-hanh' | 'web-user' | 'nhat-ky'
export type PortalFamily = 'admin' | 'field'

const PORTAL_FAMILY: Record<PortalId, PortalFamily> = {
  'dieu-hanh': 'admin',
  'web-user': 'field',
  'nhat-ky': 'field',
}

const SESSION_FAMILY_KEY = 'qlsc_portal_family'
const SESSION_PORTAL_KEY = 'qlsc_active_portal'
const EMAIL_PREFIX = 'qlsc_portal_email_'

export const WEB_USER_PORTAL: PortalId = 'web-user'

function getPortalFamily(portalId: PortalId): PortalFamily {
  return PORTAL_FAMILY[portalId]
}

let initPromise: Promise<void> | null = null

export function initPortalAuth(portalId: PortalId): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const family = getPortalFamily(portalId)
      const activeFamily = sessionStorage.getItem(SESSION_FAMILY_KEY)
      if (activeFamily && activeFamily !== family && auth.currentUser) {
        await signOut(auth)
      }
      sessionStorage.setItem(SESSION_FAMILY_KEY, family)
      sessionStorage.setItem(SESSION_PORTAL_KEY, portalId)
    })()
  }
  return initPromise
}

export function markPortalLogin(portalId: PortalId, email?: string): void {
  const family = getPortalFamily(portalId)
  sessionStorage.setItem(SESSION_FAMILY_KEY, family)
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
  const family = getPortalFamily(portalId)
  if (sessionStorage.getItem(SESSION_FAMILY_KEY) === family) {
    sessionStorage.removeItem(SESSION_FAMILY_KEY)
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
