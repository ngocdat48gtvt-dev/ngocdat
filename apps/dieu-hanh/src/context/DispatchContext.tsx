import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useAuth, useIncidents } from '@/hooks'
import {
  buildUserNameMap,
  directoryFromNameMap,
  fetchCompanyUsers,
  fetchUserNamesByUids,
  mergeFilterUserOptions,
  mergeUserNameMaps,
  resolveCreatorDisplayName,
  type CompanyUserEntry,
} from '@/services/usersService'
import {
  applyDispatchFilters,
  computeDispatchSummary,
  computeRoadSummaries,
} from '@/lib/incidentStats'
import { sortIncidentsByKm } from '@quanlysuco/shared'
import {
  emptyDispatchFilters,
  type DispatchFilters,
  type IncidentRecord,
} from '@/types/incident'
import type { DispatchSummary, RoadSummary } from '@/lib/incidentStats'

interface DispatchContextValue {
  items: IncidentRecord[]
  filtered: IncidentRecord[]
  sorted: IncidentRecord[]
  summary: DispatchSummary
  roadSummaries: RoadSummary[]
  filters: DispatchFilters
  setFilters: React.Dispatch<React.SetStateAction<DispatchFilters>>
  loading: boolean
  error: string | null
  reload: () => void
  isCompanyAdmin: boolean
  companyName: string
  companyId: string
  filterUserOptions: CompanyUserEntry[]
  userNameByUid: Record<string, string>
  creatorLabel: (ownerUid: string, createdByName?: string) => string
  usersLoading: boolean
}

const DispatchContext = createContext<DispatchContextValue | null>(null)

export function DispatchProvider({ children }: { children: ReactNode }) {
  const { user, profile, isCompanyAdmin } = useAuth()
  const { items, loading, error, reload: reloadIncidents } = useIncidents(
    profile,
    user?.uid,
  )
  const [filters, setFilters] = useState<DispatchFilters>(emptyDispatchFilters)
  const [userNameByUid, setUserNameByUid] = useState<Record<string, string>>({})
  const [usersLoading, setUsersLoading] = useState(false)

  const companyId = profile?.companyId ?? ''

  const loadUserNames = useCallback(async () => {
    if (!companyId || !isCompanyAdmin) {
      setUserNameByUid({})
      return
    }
    setUsersLoading(true)
    try {
      const ownerUids = [...new Set(items.map((i) => i.ownerUid).filter(Boolean))]

      const [companyUsers, fromOwners] = await Promise.all([
        fetchCompanyUsers(companyId).catch(() => [] as CompanyUserEntry[]),
        fetchUserNamesByUids(ownerUids),
      ])

      const merged = mergeUserNameMaps(
        buildUserNameMap(companyUsers),
        fromOwners,
      )
      setUserNameByUid(merged)
    } catch {
      setUserNameByUid({})
    } finally {
      setUsersLoading(false)
    }
  }, [companyId, isCompanyAdmin, items])

  useEffect(() => {
    void loadUserNames()
  }, [loadUserNames])

  const reload = useCallback(() => {
    reloadIncidents()
    void loadUserNames()
  }, [reloadIncidents, loadUserNames])

  const companyUsers = useMemo(
    () => directoryFromNameMap(userNameByUid),
    [userNameByUid],
  )

  const creatorLabel = useMemo(
    () => (ownerUid: string, createdByName?: string) =>
      resolveCreatorDisplayName(ownerUid, userNameByUid, createdByName),
    [userNameByUid],
  )

  const filterUserOptions = useMemo(
    () => mergeFilterUserOptions(companyUsers, items, userNameByUid),
    [companyUsers, items, userNameByUid],
  )

  const filtered = useMemo(
    () => applyDispatchFilters(items, filters),
    [items, filters],
  )
  const sorted = useMemo(() => sortIncidentsByKm(filtered), [filtered])
  const summary = useMemo(() => computeDispatchSummary(filtered), [filtered])
  const roadSummaries = useMemo(() => computeRoadSummaries(filtered), [filtered])

  const value: DispatchContextValue = {
    items,
    filtered,
    sorted,
    summary,
    roadSummaries,
    filters,
    setFilters,
    loading,
    error,
    reload,
    isCompanyAdmin,
    companyName: profile?.companyName ?? '',
    companyId,
    filterUserOptions,
    userNameByUid,
    creatorLabel,
    usersLoading,
  }

  return (
    <DispatchContext.Provider value={value}>{children}</DispatchContext.Provider>
  )
}

export function useDispatch() {
  const ctx = useContext(DispatchContext)
  if (!ctx) throw new Error('useDispatch must be used within DispatchProvider')
  return ctx
}
