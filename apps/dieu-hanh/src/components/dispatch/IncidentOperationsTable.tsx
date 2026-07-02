import { useMemo, useState, type ReactNode } from 'react'
import { Eye, Pencil, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useDispatch } from '@/context/DispatchContext'
import { useAuth } from '@/hooks'
import {
  computeKhoiLuong,
  formatDimValue,
  highVolumeVolCellClass,
  isHighVolumeM3,
  splitVolumeByGeology,
  statusLabel,
  statusFromProgress,
} from '@/lib/incidentUtils'
import { buildDuplicateChainageKeySet, chainageDedupeKey, formatKmDisplay } from '@quanlysuco/shared'
import {
  canAssignRework,
  getIncidentRework,
  hasReworkRequest,
  reworkDispatchTableLabel,
  reworkDispatchTableTextClass,
} from '@/lib/reworkUtils'
import { positionLabel } from '@/lib/positionUtils'
import { softDeleteIncident } from '@/services/incidentsService'
import { useResizableTableColumns } from '@/hooks/useResizableTableColumns'
import { IncidentDetailDrawer } from './IncidentDetailDrawer'
import { IncidentEditDialog } from './IncidentEditDialog'
import { ReworkAssignDialog } from './ReworkAssignDialog'
import { ResizableTh } from './ResizableTh'
import { Badge, Button, Skeleton } from '@/components/ui/primitives'
import { Table, THead, TR, TD } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { IncidentRecord } from '@/types/incident'

const STORAGE_KEY = 'qlsc-dispatch-ops-col-widths-v7'

type ColId =
  | 'user'
  | 'road'
  | 'km'
  | 'side'
  | 'type'
  | 'dai'
  | 'rong'
  | 'cao'
  | 'unit'
  | 'vol'
  | 'volDat'
  | 'volDa'
  | 'note'
  | 'rework'
  | 'progress'
  | 'date'
  | 'completedDate'
  | 'actions'

const BASE_COLS: ColId[] = [
  'user',
  'road',
  'km',
  'side',
  'type',
  'dai',
  'rong',
  'cao',
  'unit',
  'volDat',
  'volDa',
  'vol',
  'note',
  'progress',
  'date',
  'completedDate',
  'rework',
]

const DEFAULT_WIDTHS: Record<ColId, number> = {
  user: 128,
  road: 52,
  km: 88,
  side: 60,
  type: 112,
  dai: 44,
  rong: 44,
  cao: 44,
  unit: 36,
  vol: 72,
  volDat: 64,
  volDa: 64,
  note: 132,
  progress: 104,
  date: 76,
  completedDate: 76,
  rework: 118,
  actions: 112,
}

const MIN_WIDTHS: Partial<Record<ColId, number>> = {
  user: 72,
  road: 40,
  km: 64,
  side: 48,
  type: 64,
  note: 56,
  rework: 80,
  progress: 80,
  date: 64,
  completedDate: 64,
  actions: 72,
  dai: 32,
  rong: 32,
  cao: 32,
  unit: 32,
  vol: 48,
  volDat: 44,
  volDa: 44,
}

const HEAD_LABELS: Record<ColId, ReactNode> = {
  user: 'Người tạo',
  road: 'Tuyến',
  km: 'Lý trình',
  side: 'Phía',
  type: 'Loại sự cố',
  dai: 'Dài',
  rong: 'Rộng',
  cao: 'Cao',
  unit: 'ĐVT',
  volDat: 'KL đất',
  volDa: 'KL đá',
  vol: 'Khối lượng tổng',
  note: 'Ghi chú',
  progress: 'Tiến độ',
  date: 'Ngày xảy ra',
  completedDate: 'Hoàn thành',
  rework: 'Giao việc',
  actions: 'Thao tác',
}

const cellBorder = 'border-r border-border px-2 py-2 last:border-r-0 transition-colors'
const cellBg =
  'bg-background group-hover:bg-sky-50 dark:group-hover:bg-sky-950/25'
const duplicateLocationClass =
  'bg-yellow-100 dark:bg-yellow-950/45 group-hover:bg-yellow-200 dark:group-hover:bg-yellow-900/55'
const highVolumeLocationClass =
  'bg-red-200 dark:bg-red-900/50 font-semibold text-red-950 dark:text-red-100 group-hover:bg-red-300 dark:group-hover:bg-red-900/65'

export function IncidentOperationsTable() {
  const { sorted, loading, reload, isCompanyAdmin, creatorLabel } = useDispatch()
  const { user, profile } = useAuth()
  const assignedBy =
    profile?.displayName?.trim() || user?.email?.trim() || 'Admin'
  const duplicateChainageKeys = useMemo(
    () => buildDuplicateChainageKeySet(sorted),
    [sorted],
  )
  const [selected, setSelected] = useState<IncidentRecord | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<IncidentRecord | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [reworkTarget, setReworkTarget] = useState<IncidentRecord | null>(null)
  const [reworkOpen, setReworkOpen] = useState(false)

  const columnIds = useMemo(
    (): ColId[] => (isCompanyAdmin ? [...BASE_COLS, 'actions'] : BASE_COLS),
    [isCompanyAdmin],
  )

  const { widths, colStyle, totalWidth, startResize } = useResizableTableColumns(
    columnIds,
    DEFAULT_WIDTHS,
    STORAGE_KEY,
    MIN_WIDTHS,
  )

  const colSpan = columnIds.length

  function openDetail(inc: IncidentRecord) {
    setSelected(inc)
    setDetailOpen(true)
  }

  function handleRowClick(inc: IncidentRecord, e: React.MouseEvent<HTMLTableRowElement>) {
    const target = e.target as HTMLElement
    if (target.closest('button, a, input, label, textarea, select')) return
    openDetail(inc)
  }

  function openEdit(inc: IncidentRecord) {
    setEditTarget(inc)
    setEditOpen(true)
  }

  function openReworkAssign(inc: IncidentRecord) {
    setReworkTarget(inc)
    setReworkOpen(true)
  }

  async function handleDelete(inc: IncidentRecord) {
    const label = `${inc.road ?? '—'} · ${inc.km ?? '—'} · ${inc.type ?? '—'}`
    if (!window.confirm(`Chuyển vào thùng rác?\n\n${label}\n\nGiữ 7 ngày — có thể khôi phục.`)) {
      return
    }
    const key = `${inc.ownerUid}-${inc.id}`
    setDeletingId(key)
    try {
      await softDeleteIncident(inc.ownerUid, inc.id)
      toast.success('Đã chuyển vào thùng rác')
      reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Xóa thất bại')
    } finally {
      setDeletingId(null)
    }
  }

  function locationHighlightClass(inc: IncidentRecord, col: ColId): string {
    if (col !== 'type') return cellBg
    if (isHighVolumeM3(inc)) return highVolumeLocationClass
    const chainageKey = chainageDedupeKey(inc)
    if (chainageKey != null && duplicateChainageKeys.has(chainageKey)) {
      return duplicateLocationClass
    }
    return cellBg
  }

  function renderCell(col: ColId, inc: IncidentRecord, busy: boolean): ReactNode {
    const totalVol = computeKhoiLuong(inc)
    const { soil, rock } = splitVolumeByGeology(inc)
    const highVol = isHighVolumeM3(inc)
    const status = inc.status ?? statusFromProgress(inc.progress)
    const creator = creatorLabel(inc.ownerUid, inc.createdByName)
    const bg = locationHighlightClass(inc, col)

    switch (col) {
      case 'user':
        return (
          <TD
            key={col}
            className={cn(cellBorder, cellBg, 'truncate text-xs')}
            style={colStyle(col)}
            title={creator}
          >
            {creator}
          </TD>
        )
      case 'road':
        return (
          <TD
            key={col}
            className={cn(cellBorder, cellBg, 'text-xs font-semibold')}
            style={colStyle(col)}
          >
            {inc.road || '—'}
          </TD>
        )
      case 'km':
        return (
          <TD
            key={col}
            className={cn(cellBorder, bg, 'font-mono text-xs')}
            style={colStyle(col)}
          >
            {formatKmDisplay(inc.km) || '—'}
          </TD>
        )
      case 'side':
        return (
          <TD key={col} className={cn(cellBorder, bg, 'text-xs')} style={colStyle(col)}>
            {positionLabel(inc.position)}
          </TD>
        )
      case 'type':
        return (
          <TD
            key={col}
            className={cn(cellBorder, bg, 'truncate text-xs font-medium')}
            style={colStyle(col)}
            title={inc.type}
          >
            {inc.type || '—'}
          </TD>
        )
      case 'dai':
        return (
          <TD
            key={col}
            className={cn(cellBorder, cellBg, 'px-1 text-right tabular-nums text-xs')}
            style={colStyle(col)}
          >
            {formatDimValue(inc.dai)}
          </TD>
        )
      case 'rong':
        return (
          <TD
            key={col}
            className={cn(cellBorder, cellBg, 'px-1 text-right tabular-nums text-xs')}
            style={colStyle(col)}
          >
            {formatDimValue(inc.rong)}
          </TD>
        )
      case 'cao':
        return (
          <TD
            key={col}
            className={cn(cellBorder, cellBg, 'px-1 text-right tabular-nums text-xs')}
            style={colStyle(col)}
          >
            {formatDimValue(inc.cao)}
          </TD>
        )
      case 'unit':
        return (
          <TD
            key={col}
            className={cn(cellBorder, cellBg, 'px-1 text-center text-xs')}
            style={colStyle(col)}
          >
            {inc.unit?.trim() || '—'}
          </TD>
        )
      case 'vol':
        return (
          <TD
            key={col}
            className={cn(
              cellBorder,
              cellBg,
              'px-1 text-right tabular-nums text-xs font-medium',
              highVol && totalVol > 0 && highVolumeVolCellClass,
            )}
            style={colStyle(col)}
          >
            {totalVol > 0 ? totalVol.toFixed(1) : '—'}
          </TD>
        )
      case 'volDat':
        return (
          <TD
            key={col}
            className={cn(
              cellBorder,
              cellBg,
              'px-1 text-right tabular-nums text-xs font-medium',
              highVol && soil != null && highVolumeVolCellClass,
            )}
            style={colStyle(col)}
          >
            {soil != null ? soil.toFixed(1) : '—'}
          </TD>
        )
      case 'volDa':
        return (
          <TD
            key={col}
            className={cn(
              cellBorder,
              cellBg,
              'px-1 text-right tabular-nums text-xs font-medium',
              highVol && rock != null && highVolumeVolCellClass,
            )}
            style={colStyle(col)}
          >
            {rock != null ? rock.toFixed(1) : '—'}
          </TD>
        )
      case 'note':
        return (
          <TD
            key={col}
            className={cn(cellBorder, cellBg, 'truncate text-xs text-muted-foreground')}
            style={colStyle(col)}
            title={inc.note?.trim() || undefined}
          >
            {inc.note?.trim() || '—'}
          </TD>
        )
      case 'progress':
        return (
          <TD key={col} className={cn(cellBorder, cellBg)} style={colStyle(col)}>
            <div className="flex flex-col gap-0.5">
              <Badge
                variant={
                  status === 'DONE'
                    ? 'success'
                    : status === 'PARTIAL'
                      ? 'default'
                      : 'muted'
                }
                className="w-fit text-[10px]"
              >
                {statusLabel(status)}
              </Badge>
              <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
                {inc.progress ?? 0}%
              </span>
            </div>
          </TD>
        )
      case 'date':
        return (
          <TD
            key={col}
            className={cn(cellBorder, cellBg, 'whitespace-nowrap text-xs')}
            style={colStyle(col)}
          >
            {inc.date || '—'}
          </TD>
        )
      case 'completedDate':
        return (
          <TD
            key={col}
            className={cn(cellBorder, cellBg, 'whitespace-nowrap text-xs')}
            style={colStyle(col)}
          >
            {inc.completedDate?.trim() || '—'}
          </TD>
        )
      case 'rework': {
        const rw = getIncidentRework(inc)
        const showRework = hasReworkRequest(inc)
        const reworkLabel = reworkDispatchTableLabel(rw.status)
        return (
          <TD
            key={col}
            className={cn(cellBorder, cellBg)}
            style={colStyle(col)}
          >
            {showRework && reworkLabel ? (
              <span
                className={cn('text-xs leading-snug', reworkDispatchTableTextClass(rw.status))}
                title={
                  rw.reason
                    ? `Lý do: ${rw.reason}${rw.assignedAt ? ` · Giao: ${rw.assignedAt}` : ''}`
                    : rw.assignedAt
                      ? `Giao: ${rw.assignedAt}`
                      : undefined
                }
              >
                {reworkLabel}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </TD>
        )
      }
      case 'actions':
        return (
          <TD
            key={col}
            className={cn(cellBorder, cellBg, 'px-1')}
            style={colStyle(col)}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-center gap-0.5">
              {canAssignRework(inc) ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-amber-700 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-950/50"
                  title="Yêu cầu bổ sung hồ sơ"
                  onClick={(e) => {
                    e.stopPropagation()
                    openReworkAssign(inc)
                  }}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title="Xem chi tiết"
                onClick={(e) => {
                  e.stopPropagation()
                  openDetail(inc)
                }}
              >
                <Eye className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title="Sửa"
                onClick={(e) => {
                  e.stopPropagation()
                  openEdit(inc)
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                title="Xóa"
                disabled={busy}
                onClick={(e) => {
                  e.stopPropagation()
                  void handleDelete(inc)
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </TD>
        )
      default:
        return null
    }
  }

  return (
    <>
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {loading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
            <Table
              className="table-fixed border-collapse border-0"
              style={{ width: totalWidth, minWidth: totalWidth }}
            >
              <colgroup>
                {columnIds.map((id) => (
                  <col key={id} style={colStyle(id)} />
                ))}
              </colgroup>
              <THead>
                <TR className="border-b-2 border-border">
                  {columnIds.map((id) => (
                    <ResizableTh
                      key={id}
                      colId={id}
                      width={widths[id] ?? DEFAULT_WIDTHS[id]}
                      onResizeStart={startResize}
                      resizable
                      className={
                        id === 'vol' || id === 'volDat' || id === 'volDa'
                          ? 'text-[10px] uppercase tracking-wide'
                          : id === 'rework'
                            ? 'bg-slate-100 dark:bg-slate-900/60'
                            : undefined
                      }
                    >
                      {HEAD_LABELS[id]}
                    </ResizableTh>
                  ))}
                </TR>
              </THead>
              <tbody>
                {sorted.length === 0 ? (
                  <TR>
                    <TD
                      colSpan={colSpan}
                      className="border-t border-border py-12 text-center text-muted-foreground"
                    >
                      Không có sự cố phù hợp bộ lọc
                    </TD>
                  </TR>
                ) : (
                  sorted.map((inc) => {
                    const rowKey = `${inc.ownerUid}-${inc.id}`
                    const busy = deletingId === rowKey
                    const chainageKey = chainageDedupeKey(inc)
                    const isDuplicateChainage =
                      chainageKey != null && duplicateChainageKeys.has(chainageKey)
                    const isHighVolume = isHighVolumeM3(inc)

                    return (
                      <TR
                        key={rowKey}
                        title={
                          isHighVolume
                            ? 'Khối lượng trên 100 m³ — cần theo dõi'
                            : isDuplicateChainage
                              ? 'Trùng lý trình với sự cố khác trên cùng tuyến — kiểm tra nhập liệu'
                              : 'Bấm dòng để xem chi tiết sự cố'
                        }
                        onClick={(e) => handleRowClick(inc, e)}
                        className={cn(
                          'group cursor-pointer border-b border-border bg-background transition-colors',
                          detailOpen && selected?.id === inc.id && selected?.ownerUid === inc.ownerUid
                            ? 'bg-primary/5 ring-1 ring-inset ring-primary/25'
                            : undefined,
                        )}
                      >
                        {columnIds.map((col) => renderCell(col, inc, busy))}
                      </TR>
                    )
                  })
                )}
              </tbody>
            </Table>
          </div>
        )}
      </div>

      <IncidentDetailDrawer
        incident={selected}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false)
          setSelected(null)
        }}
      />

      <IncidentEditDialog
        incident={editTarget}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={() => reload()}
      />

      <ReworkAssignDialog
        incident={reworkTarget}
        open={reworkOpen}
        onClose={() => setReworkOpen(false)}
        assignedBy={assignedBy}
        onAssigned={() => reload()}
      />
    </>
  )
}
