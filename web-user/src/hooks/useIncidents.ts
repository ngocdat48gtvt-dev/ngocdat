import { useCallback, useEffect, useState } from 'react'
import { subscribeIncidentsByOwner } from '@/services/incidentsService'
import type { IncidentRecord } from '@/types/incident'

export function useIncidents(uid: string | undefined) {
  const [items, setItems] = useState<IncidentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const refresh = useCallback((force = false) => {
    if (force) setReloadToken((t) => t + 1)
  }, [])

  useEffect(() => {
    if (!uid) {
      setItems([])
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    const unsubscribe = subscribeIncidentsByOwner(
      uid,
      (data) => {
        setItems(data)
        setLoading(false)
        setError(null)
      },
      (err) => {
        setError(err.message || 'Không tải được danh sách sự cố')
        setItems([])
        setLoading(false)
      },
    )

    return () => unsubscribe()
  }, [uid, reloadToken])

  return { items, loading, error, refresh }
}
