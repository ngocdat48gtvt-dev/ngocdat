import { useMemo, useState } from 'react'
import { Loader2, MapPin } from 'lucide-react'
import { useDispatch } from '@/context/DispatchContext'
import { useAuth } from '@/hooks'
import { isHighVolumeM3 } from '@/lib/incidentUtils'
import { hasReworkRequest } from '@/lib/reworkUtils'
import { buildDuplicateChainageKeySet } from '@quanlysuco/shared'
import { DispatchFiltersBar } from '@/components/dispatch/DispatchFiltersBar'
import { IncidentOperationsTable } from '@/components/dispatch/IncidentOperationsTable'
import { WordExportDialog } from '@/components/dispatch/WordExportDialog'
import { IncidentCreateDialog } from '@/components/dispatch/IncidentCreateDialog'
import { Button } from '@/components/ui/primitives'
import { toast } from 'sonner'
import { sortedVolumeEntries, formatVolumeValue } from '@/lib/incidentStats'
import {
  buildBaoCaoSuCoFilename,
  exportIncidentsExcel,
} from '@/services/incidentExportService'
import {
  countIncidentsNeedingMetadataRecovery,
  recoverAllMissingMetadata,
} from '@/services/incidentMetadataRecoveryService'

export function DispatchOperationsPage() {
  const { items, sorted, filters, summary, isCompanyAdmin, reload } = useDispatch()
  const { user } = useAuth()
  const hasDuplicateChainage = useMemo(
    () => buildDuplicateChainageKeySet(sorted).size > 0,
    [sorted],
  )
  const hasHighVolume = useMemo(() => sorted.some(isHighVolumeM3), [sorted])
  const hasRework = useMemo(() => sorted.some(hasReworkRequest), [sorted])
  const missingKmRecoverCount = useMemo(
    () =>
      countIncidentsNeedingMetadataRecovery(items, {
        ownerUid: user?.uid,
        isCompanyAdmin,
      }),
    [items, user?.uid, isCompanyAdmin],
  )
  const [wordOpen, setWordOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [metadataRecovering, setMetadataRecovering] = useState(false)

  function openWordExport() {
    if (sorted.length === 0) {
      toast.error('Không có dữ liệu để xuất')
      return
    }
    setWordOpen(true)
  }

  async function exportExcel() {
    if (sorted.length === 0) {
      toast.error('Không có dữ liệu để xuất')
      return
    }
    try {
      await exportIncidentsExcel(sorted, buildBaoCaoSuCoFilename(sorted, filters), {
        groupFilter: filters.groupName,
      })
      toast.success('Đã xuất Excel')
    } catch {
      toast.error('Không xuất được file Excel')
    }
  }

  async function handleRecoverMetadata() {
    if (!user?.uid || metadataRecovering) return
    if (missingKmRecoverCount === 0) {
      toast.info('Không có sự cố nào thiếu lý trình mà suy ra được từ mã sự cố/ảnh')
      return
    }

    setMetadataRecovering(true)
    const toastId = toast.loading(
      `Đang khôi phục lý trình (${missingKmRecoverCount} sự cố)…`,
    )
    try {
      let totalRecovered = 0
      for (let round = 0; round < 50; round++) {
        const { recovered } = await recoverAllMissingMetadata(items, {
          ownerUid: user.uid,
          isCompanyAdmin,
          onProgress: ({ recovered: done }) => {
            toast.loading(`Đang khôi phục… ${done} sự cố`, { id: toastId })
          },
        })
        if (recovered === 0) break
        totalRecovered += recovered
        if (recovered < 80) break
      }
      if (totalRecovered > 0) {
        reload()
        toast.success(
          `Đã ghi lý trình (và tuyến/loại nếu trống) cho ${totalRecovered} sự cố — kích thước bạn tự nhập sau`,
          { id: toastId },
        )
      } else {
        toast.info('Không khôi phục được lý trình', { id: toastId })
      }
    } catch {
      toast.error('Khôi phục lý trình thất bại', { id: toastId })
    } finally {
      setMetadataRecovering(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="z-20 shrink-0 space-y-2 border-b border-border bg-background pb-2 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {sortedVolumeEntries(summary.volumeByUnit).length === 0 ? (
                <p className="rounded-lg border border-primary/25 bg-primary/10 px-3 py-1.5 text-sm font-bold tabular-nums text-primary">
                  Tổng KL: 0
                </p>
              ) : (
                sortedVolumeEntries(summary.volumeByUnit).map(([unit, val]) => (
                  <p
                    key={unit}
                    className="rounded-lg border border-primary/25 bg-primary/10 px-3 py-1.5 text-sm font-bold tabular-nums text-primary"
                  >
                    Tổng KL ({unit}): {formatVolumeValue(val)}
                  </p>
                ))
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold tabular-nums text-foreground">
                {sorted.length}
              </span>{' '}
              sự cố sau lọc · Lý trình tăng dần ·{' '}
              <span className="text-foreground/80">Bấm dòng để xem chi tiết</span>
              {' · '}
              <span className="text-foreground/80">
                Kéo tiêu đề cột để đổi thứ tự (lưu máy)
              </span>
              {hasHighVolume ? (
                <>
                  {' '}
                  ·{' '}
                  <span className="rounded bg-red-200 px-1.5 py-0.5 font-medium text-red-950 dark:bg-red-900/50 dark:text-red-100">
                    Đỏ = trên 100 m³ (cột loại sự cố)
                  </span>
                </>
              ) : null}
              {hasDuplicateChainage ? (
                <>
                  {' '}
                  ·{' '}
                  <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-yellow-900 dark:bg-yellow-950/50 dark:text-yellow-200">
                    Vàng = trùng lý trình (cột loại sự cố)
                  </span>
                </>
              ) : null}
              {hasRework ? (
                <>
                  {' '}
                  · Cột giao việc:{' '}
                  <span className="font-semibold text-orange-800 dark:text-orange-200">
                    Chưa thực hiện
                  </span>
                  {' / '}
                  <span className="font-semibold text-blue-700 dark:text-blue-300">
                    Chờ duyệt
                  </span>
                  {' / '}
                  <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                    Hoàn thành
                  </span>
                </>
              ) : null}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={metadataRecovering || missingKmRecoverCount === 0}
              onClick={() => void handleRecoverMetadata()}
              title={
                missingKmRecoverCount > 0
                  ? `${missingKmRecoverCount} sự cố thiếu lý trình — suy từ mã sự cố hoặc thư mục ảnh`
                  : 'Không có sự cố thiếu lý trình khôi phục được'
              }
            >
              {metadataRecovering ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <MapPin className="h-3.5 w-3.5" />
              )}
              Khôi phục lý trình
              {missingKmRecoverCount > 0 ? ` (${missingKmRecoverCount})` : ''}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => reload()}>
              Tải lại
            </Button>
            {isCompanyAdmin ? (
              <>
                <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
                  + Thêm sự cố
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={exportExcel}>
                  Xuất Excel
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={openWordExport}>
                  Xuất Word (ảnh)
                </Button>
              </>
            ) : null}
          </div>
        </div>

        <DispatchFiltersBar compact />
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <IncidentOperationsTable />
      </div>

      <WordExportDialog
        open={wordOpen}
        onClose={() => setWordOpen(false)}
        items={sorted}
        filters={filters}
      />

      <IncidentCreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => reload()}
      />
    </div>
  )
}
