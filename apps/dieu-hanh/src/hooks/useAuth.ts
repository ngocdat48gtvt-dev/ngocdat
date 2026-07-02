import { useEffect, useState } from 'react'
import { onAuthStateChanged, signOut, type User } from 'firebase/auth'
import { auth } from '@/firebase/firebase'
import { DIEU_HANH_PORTAL, initPortalAuth } from '@/lib/portalAuth'
import { loadCompanyProfile, type CompanyUserProfile } from '@/services/authService'
import { resolveCompanyCatalogOwnerUid } from '@/services/masterDataService'

const USER_WEB_DENIED =
  'Web điều hành chỉ dành cho tài khoản ADMIN (lãnh đạo). Hạt trưởng (USER) dùng app Android.'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<CompanyUserProfile | null>(null)
  const [catalogOwnerUid, setCatalogOwnerUid] = useState('')
  const [loading, setLoading] = useState(true)
  const [portalReady, setPortalReady] = useState(false)

  useEffect(() => {
    initPortalAuth(DIEU_HANH_PORTAL).then(() => setPortalReady(true))
  }, [])

  useEffect(() => {
    if (!portalReady) return
    return onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (!u) {
        setProfile(null)
        setCatalogOwnerUid('')
        setLoading(false)
        return
      }
      try {
        const p = await loadCompanyProfile(u.uid)
        if (p && p.role !== 'ADMIN') {
          await signOut(auth)
          setProfile(null)
          setCatalogOwnerUid('')
          setUser(null)
        } else if (p) {
          setProfile(p)
          const owner = await resolveCompanyCatalogOwnerUid({
            uid: u.uid,
            companyId: p.companyId,
            role: p.role,
            catalogOwnerUid: p.catalogOwnerUid,
          })
          setCatalogOwnerUid(owner)
        } else {
          setProfile(null)
          setCatalogOwnerUid('')
        }
      } catch {
        setProfile(null)
        setCatalogOwnerUid('')
      } finally {
        setLoading(false)
      }
    })
  }, [portalReady])

  const isCompanyAdmin = profile?.role === 'ADMIN'
  const canAccess = isCompanyAdmin

  const isCatalogDelegate =
    Boolean(catalogOwnerUid && user?.uid && catalogOwnerUid !== user.uid)

  return { user, profile, catalogOwnerUid, isCatalogDelegate, loading, isCompanyAdmin, canAccess }
}

export { USER_WEB_DENIED }

export function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('theme')
      if (saved === 'dark' || saved === 'light') return saved
    } catch {
      /* ignore */
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    try {
      localStorage.setItem('theme', theme)
    } catch {
      /* ignore */
    }
  }, [theme])

  return { theme, toggle: () => setTheme((t) => (t === 'light' ? 'dark' : 'light')) }
}
