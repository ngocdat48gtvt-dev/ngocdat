import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useIncidents } from '@/hooks/useIncidents'
import { applyDispatchFilters } from '@/lib/incidentStats'
import { emptyDispatchFilters } from '@/types/incident'
import { formatVolumeDisplay, listStatusLabel } from '@/lib/incidentDispatch'
import { progressLabel } from '@/lib/incidentUtils'
import { Badge, Button, Card, Input, Label } from '@/components/ui/primitives'

export function IncidentListPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { items, loading, refresh } = useIncidents(user?.uid)

  const [road, setRoad] = useState('')
  const [groupName, setGroupName] = useState('')
  const [type, setType] = useState('')
  const [status, setStatus] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const roads = useMemo(() => [...new Set(items.map((i) => i.road).filter(Boolean))], [items])
  const groups = useMemo(() => [...new Set(items.map((i) => i.groupName).filter(Boolean))], [items])
  const types = useMemo(() => [...new Set(items.map((i) => i.type).filter(Boolean))], [items])

  const filtered = useMemo(
    () =>
      applyDispatchFilters(items, {
        ...emptyDispatchFilters,
        road,
        groupName,
        type,
        status,
        dateFrom,
        dateTo,
      }),
    [items, road, groupName, type, status, dateFrom, dateTo],
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Danh sách sự cố</h2>
        <Button variant="ghost" size="sm" onClick={() => void refresh(true)}>
          Tải lại
        </Button>
      </div>

      <Card className="grid gap-2 p-3 text-sm">
        <div>
          <Label>Tuyến</Label>
          <select className="mt-1 h-10 w-full rounded-lg border px-2" value={road} onChange={(e) => setRoad(e.target.value)}>
            <option value="">Tất cả</option>
            {roads.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Từ ngày</Label>
            <Input className="mt-1 h-10" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <Label>Đến ngày</Label>
            <Input className="mt-1 h-10" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>
        <div>
          <Label>Nhóm</Label>
          <select className="mt-1 h-10 w-full rounded-lg border px-2" value={groupName} onChange={(e) => setGroupName(e.target.value)}>
            <option value="">Tất cả</option>
            {groups.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div>
          <Label>Loại</Label>
          <select className="mt-1 h-10 w-full rounded-lg border px-2" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Tất cả</option>
            {types.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <Label>Tiến độ</Label>
          <select className="mt-1 h-10 w-full rounded-lg border px-2" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tất cả</option>
            <option value="NEW">Chưa xử lý</option>
            <option value="PARTIAL">Đang xử lý</option>
            <option value="DONE">Hoàn thành</option>
          </select>
        </div>
      </Card>

      {loading ? <p className="text-sm text-muted-foreground">Đang tải...</p> : null}
      {!loading && filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">Không có sự cố phù hợp.</p>
      ) : null}

      <div className="space-y-2">
        {filtered.map((inc) => (
          <button
            key={inc.id}
            type="button"
            className="w-full rounded-xl border border-border bg-card p-4 text-left shadow-sm transition hover:border-primary/40"
            onClick={() => navigate(`/incidents/${inc.id}`)}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{inc.road} · {inc.km}</p>
                <p className="text-sm text-muted-foreground">{inc.type}</p>
              </div>
              <Badge variant={inc.progress && inc.progress >= 100 ? 'success' : inc.progress ? 'warning' : 'muted'}>
                {listStatusLabel(inc.progress, inc.status)}
              </Badge>
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span>KL: {formatVolumeDisplay(inc)}</span>
              <span>{progressLabel(inc.progress)}</span>
              <span>{inc.date}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
