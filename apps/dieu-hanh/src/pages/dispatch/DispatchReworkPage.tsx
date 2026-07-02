import { useMemo, useState } from 'react'
import { Filter, RefreshCw, X } from 'lucide-react'
import { useDispatch } from '@/context/DispatchContext'
import { useAuth } from '@/hooks'
import { PageHeader } from '@/components/common/PageParts'
import { ReworkApprovalDialog } from '@/components/dispatch/ReworkApprovalDialog'
import { IncidentDetailDrawer } from '@/components/dispatch/IncidentDetailDrawer'
import { Button, Card, Label, Skeleton } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'
import {
  filterReworkApproved,
  filterReworkAssigned,
  filterReworkPendingApproval,
  getIncidentRework,
  reworkStatusLabel,
} from '@/lib/reworkUtils'
import type { IncidentRecord } from '@/types/incident'

type TabId = 'assigned' | 'pending' | 'approved'

const TABS: { id: TabId; label: string }[] = [
  { id: 'assigned', label: 'Chưa thực hiện' },
  { id: 'pending', label: 'Chờ duyệt' },
  { id: 'approved', label: 'Hoàn thành' },
]

function ReworkRow({
  inc,
  creatorLabel,
  onOpen,
  onApprove,
  showApprove,
}: {
  inc: IncidentRecord
  creatorLabel: (uid: string, name?: string) => string
  onOpen: () => void
  onApprove?: () => void
  showApprove?: boolean
}) {
  const rw = getIncidentRework(inc)
  return (
    <Card className="flex flex-wrap items-start justify-between gap-3 p-4">
      <div className="min-w-0 flex-1 space-y-1 text-sm">
        <p className="font-semibold">
          {inc.road ?? '—'} · {inc.km ?? '—'}
        </p>
        <p className="text-muted-foreground">{inc.type ?? '—'}</p>
        <p>
          <span className="text-muted-foreground">User:</span>{' '}
          {creatorLabel(inc.ownerUid, inc.createdByName)}
        </p>
        {rw.reason ? (
          <p>
            <span className="text-muted-foreground">Lý do:</span> {rw.reason}
          </p>
        ) : null}
        {rw.assignedAt ? (
          <p className="text-xs text-muted-foreground">Giao: {rw.assignedAt}</p>
        ) : null}
        <p className="text-xs font-medium text-primary">{reworkStatusLabel(rw.status)}</p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onOpen}>
          Chi tiết
        </Button>
        {showApprove && onApprove ? (
          <Button type="button" size="sm" onClick={onApprove}>
            Duyệt
          </Button>
        ) : null}
      </div>
    </Card>
  )
}

function applyReworkListFilters(
  list: IncidentRecord[],
  road: string,
  ownerUid: string,
): IncidentRecord[] {
  return list.filter((inc) => {
    if (road && inc.road !== road) return false
    if (ownerUid && inc.ownerUid !== ownerUid) return false
    return true
  })
}

export function DispatchReworkPage() {
  const { items, loading, reload, creatorLabel, filterUserOptions } = useDispatch()
  const { user, profile } = useAuth()
  const [tab, setTab] = useState<TabId>('assigned')
  const [detail, setDetail] = useState<IncidentRecord | null>(null)
  const [approveTarget, setApproveTarget] = useState<IncidentRecord | null>(null)
  const [roadFilter, setRoadFilter] = useState('')
  const [ownerUidFilter, setOwnerUidFilter] = useState('')

  const assigned = useMemo(() => filterReworkAssigned(items), [items])
  const pending = useMemo(() => filterReworkPendingApproval(items), [items])
  const approved = useMemo(() => filterReworkApproved(items), [items])

  const roads = useMemo(() => {
    const all = [...assigned, ...pending, ...approved]
    return [...new Set(all.map((i) => i.road).filter(Boolean))].sort() as string[]
  }, [assigned, pending, approved])

  const filteredAssigned = useMemo(
    () => applyReworkListFilters(assigned, roadFilter, ownerUidFilter),
    [assigned, roadFilter, ownerUidFilter],
  )
  const filteredPending = useMemo(
    () => applyReworkListFilters(pending, roadFilter, ownerUidFilter),
    [pending, roadFilter, ownerUidFilter],
  )
  const filteredApproved = useMemo(
    () => applyReworkListFilters(approved, roadFilter, ownerUidFilter),
    [approved, roadFilter, ownerUidFilter],
  )

  const counts = {
    assigned: filteredAssigned.length,
    pending: filteredPending.length,
    approved: filteredApproved.length,
  }

  const list =
    tab === 'assigned'
      ? filteredAssigned
      : tab === 'pending'
        ? filteredPending
        : filteredApproved

  const activeFilterCount = [roadFilter, ownerUidFilter].filter(Boolean).length
  const selectClass =
    'flex h-9 w-full rounded-md border border-border bg-background px-2 text-sm outline-none ring-primary focus:ring-2'

  const approvedBy =
    profile?.displayName?.trim() || user?.email?.trim() || 'Admin'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Yêu cầu bổ sung"
        description="Giao việc bổ sung minh chứng hiện trường — không đổi tiến độ hay khối lượng"
        action={
          <Button type="button" variant="outline" size="sm" onClick={() => reload()}>
            <RefreshCw className="mr-1 h-4 w-4" />
            Tải lại
          </Button>
        }
      />

      <Card className="overflow-visible p-0 shadow-none">
        <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-3">
          <Filter className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Bộ lọc</span>
          {activeFilterCount > 0 ? (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {activeFilterCount} đang áp dụng
            </span>
          ) : null}
        </div>
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Tuyến đường</Label>
            <select
              className={selectClass}
              value={roadFilter}
              onChange={(e) => setRoadFilter(e.target.value)}
              aria-label="Tuyến đường"
            >
              <option value="">Tất cả tuyến</option>
              {roads.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">User</Label>
            <div className="flex h-9 items-center gap-2">
              <select
                className={cn(selectClass, 'min-w-0 flex-1')}
                value={ownerUidFilter}
                onChange={(e) => setOwnerUidFilter(e.target.value)}
                aria-label="User"
              >
                <option value="">Tất cả user</option>
                {filterUserOptions.map((u) => (
                  <option key={u.uid} value={u.uid}>
                    {u.displayName}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="outline"
                className="h-9 shrink-0 gap-1 px-3"
                onClick={() => {
                  setRoadFilter('')
                  setOwnerUidFilter('')
                }}
                disabled={activeFilterCount === 0}
              >
                <X className="h-4 w-4" />
                Xóa lọc
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Button
            key={t.id}
            type="button"
            size="sm"
            variant={tab === t.id ? 'default' : 'outline'}
            onClick={() => setTab(t.id)}
          >
            {t.label} ({counts[t.id]})
          </Button>
        ))}
      </div>

      {loading ? (
        <Skeleton className="h-32 w-full" />
      ) : list.length === 0 ? (
        <p className="text-sm text-muted-foreground">Không có yêu cầu trong mục này.</p>
      ) : (
        <div className="space-y-3">
          {list.map((inc) => (
            <ReworkRow
              key={`${inc.ownerUid}-${inc.id}`}
              inc={inc}
              creatorLabel={creatorLabel}
              onOpen={() => setDetail(inc)}
              showApprove={tab === 'pending'}
              onApprove={tab === 'pending' ? () => setApproveTarget(inc) : undefined}
            />
          ))}
        </div>
      )}

      <IncidentDetailDrawer
        incident={detail}
        open={detail != null}
        onClose={() => setDetail(null)}
        creatorFieldLabel="User"
      />

      <ReworkApprovalDialog
        incident={approveTarget}
        open={approveTarget != null}
        onClose={() => setApproveTarget(null)}
        approvedBy={approvedBy}
        onApproved={() => reload()}
      />
    </div>
  )
}
