import { useEffect, useState } from 'react'
import { onAuthStateChanged, signOut, type User } from 'firebase/auth'
import { auth } from '@/firebase/firebase'
import { initPortalAuth, WEB_USER_PORTAL } from '@/lib/portalAuth'
import { loadUserProfile, type UserProfile } from '@/services/authService'

export const ADMIN_WEB_DENIED =
  'Web hiện trường chỉ dành cho tài khoản USER (hạt trưởng). Lãnh đạo dùng cổng điều hành.'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [portalReady, setPortalReady] = useState(false)

  useEffect(() => {
    initPortalAuth(WEB_USER_PORTAL).then(() => setPortalReady(true))
  }, [])

  useEffect(() => {
    if (!portalReady) return
    return onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (!u) {
        setProfile(null)
        setLoading(false)
        return
      }
      try {
        const p = await loadUserProfile(u.uid, u.email)
        if (!p) {
          await signOut(auth)
          setProfile(null)
          setUser(null)
        } else if (p.role === 'ADMIN') {
          await signOut(auth)
          setProfile(null)
          setUser(null)
        } else {
          setProfile(p)
        }
      } catch {
        setProfile(null)
      } finally {
        setLoading(false)
      }
    })
  }, [portalReady])

  const isFieldUser = profile?.role === 'USER'
  const canAccess = isFieldUser && profile?.active === true

  return { user, profile, loading, isFieldUser, canAccess }
}
