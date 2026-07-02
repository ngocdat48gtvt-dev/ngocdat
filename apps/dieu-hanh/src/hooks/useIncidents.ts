import { useCallback, useEffect, useState } from 'react'
import { subscribeIncidentsForViewer } from '@/services/incidentsService'
import type { IncidentRecord } from '@/types/incident'
import type { CompanyUserProfile } from '@/services/authService'

export function useIncidents(
  profile: CompanyUserProfile | null,
  uid: string | undefined,
) {
  const [items, setItems] = useState<IncidentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const reload = useCallback(() => {
    setReloadToken((t) => t + 1)
  }, [])

  useEffect(() => {
    if (!profile || !uid) {
      setItems([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const unsubscribe = subscribeIncidentsForViewer(
      profile.role,
      uid,
      profile.companyId,
      (data) => {
        setItems(data)
        setLoading(false)
        setError(null)
      },
      (err) => {
        setError(err.message || 'Không tải được dữ liệu')
        setItems([])
        setLoading(false)
      },
    )

    return () => unsubscribe()
  }, [profile?.role, profile?.companyId, uid, reloadToken])

  return { items, loading, error, reload }
}
