import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog } from '@/components/ui/dialog'
import { useDispatch } from '@/context/DispatchContext'
import { useAuth } from '@/hooks'
import type { IncidentRecord } from '@/types/incident'
import {
  afterConstructionImages,
  beforeConstructionImages,
  assignReportSlotOrder,
  clearReportImageSlots,
  computeKhoiLuong,
  countHiddenLocalImages,
  encodeReportImageOrder,
  legacyRefsFromReportSlots,
  progressLabel,
  reportImageSlots,
  reportSlotOrderIndex,
  selectAllReportImageSlots,
  statusLabel,
  statusFromProgress,
  toggleReportImageSlot,
  type ReportImageSlot,
  webDisplayImageUrls,
} from '@/lib/incidentUtils'
import { updateReportImageSelection } from '@/services/incidentsService'
import { removeIncidentImage } from '@/services/incidentPhotoService'
import {
  canAssignRework,
  getIncidentRework,
  reworkStatusLabel,
} from '@/lib/reworkUtils'
import { positionLabel } from '@/lib/positionUtils'
import { Badge, Button } from '@/components/ui/primitives'
import { IncidentImageGallery } from './IncidentImageGallery'
import { IncidentFullTimeline } from './IncidentFullTimeline'
import { ReworkAssignDialog } from './ReworkAssignDialog'

export function IncidentDetailDrawer({
  incident,
  open,
  onClose,
  creatorFieldLabel = 'Người tạo',
}: {
  incident: IncidentRecord | null
  open: boolean
  onClose: () => void
  creatorFieldLabel?: string
}) {
  const { creatorLabel, reload, isCompanyAdmin } = useDispatch()
  const { user, profile } = useAuth()
  const [assignOpen, setAssignOpen] = useState(false)
  const [reportSlots, setReportSlots] = useState<ReportImageSlot[]>([])
  const [localIncident, setLocalIncident] = useState(incident)
  const [deletingUrl, setDeletingUrl] = useState<string | null>(null)

  const beforeAll = localIncident ? beforeConstructionImages(localIncident) : []
  const afterAll = localIncident ? afterConstructionImages(localIncident) : []
  const beforeUrls = webDisplayImageUrls(beforeAll)
  const afterUrls = webDisplayImageUrls(afterAll)
  const hiddenPhotoCount =
    countHiddenLocalImages(beforeAll) + countHiddenLocalImages(afterAll)

  useEffect(() => {
    if (!incident || !open) return
    setLocalIncident(incident)
    setReportSlots(reportImageSlots(incident))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incident?.id, open, incident])

  async function persistReportSlots(nextSlots: ReportImageSlot[]) {
    if (!localIncident) return
    setReportSlots(nextSlots)
    const { selectedBefore, selectedAfter } = legacyRefsFromReportSlots(nextSlots)
    const reportImageOrder = encodeReportImageOrder(nextSlots)
    try {
      await updateReportImageSelection(
        localIncident.ownerUid,
        localIncident.id,
        reportImageOrder,
        selectedBefore,
        selectedAfter,
      )
      toast.success('Đã cập nhật thứ tự ảnh cho báo cáo Word')
    } catch {
      toast.error('Không lưu được lựa chọn ảnh')
      setReportSlots(reportImageSlots(localIncident))
    }
  }

  function handleTogglePhoto(kind: 'before' | 'after', url: string) {
    if (!localIncident) return
    void persistReportSlots(toggleReportImageSlot(reportSlots, kind, url))
  }

  function handleSelectAll(kind: 'before' | 'after') {
    if (!localIncident) return
    const pool = kind === 'before' ? beforeUrls : afterUrls
    void persistReportSlots(selectAllReportImageSlots(reportSlots, kind, pool))
  }

  function handleClearAll(kind: 'before' | 'after') {
    if (!localIncident) return
    void persistReportSlots(clearReportImageSlots(reportSlots, kind))
  }

  function handleOrderChange(kind: 'before' | 'after', url: string, order: number) {
    if (!localIncident) return
    void persistReportSlots(assignReportSlotOrder(reportSlots, kind, url, order))
  }

  async function handleDeletePhoto(kind: 'before' | 'after', url: string) {
    if (!localIncident || !user) return
    if (!window.confirm('Bạn có chắc muốn xóa ảnh này không?')) return
    setDeletingUrl(url)
    try {
      const patch = await removeIncidentImage(
        localIncident.ownerUid,
        localIncident.id,
        localIncident,
        kind,
        url,
      )
      setLocalIncident({
        ...localIncident,
        beforeImages: patch.beforeImages,
        afterImages: patch.afterImages,
        reportImageOrder: patch.reportImageOrder,
        selectedBefore: patch.selectedBefore,
        selectedAfter: patch.selectedAfter,
      })
      setReportSlots(patch.slots)
      toast.success('Đã xóa ảnh')
      reload()
    } catch {
      toast.error('Không xóa được ảnh')
    } finally {
      setDeletingUrl(null)
    }
  }

  if (!localIncident) return null

  const incidentView = localIncident
  const vol = computeKhoiLuong(incidentView)
  const volUnit = incidentView.unit?.trim() || 'm³'
  const creator = creatorLabel(incidentView.ownerUid, incidentView.createdByName)
  const status = incidentView.status ?? statusFromProgress(incidentView.progress)
  const rw = getIncidentRework(incidentView)
  const size =
    incidentView.dai || incidentView.rong || incidentView.cao
      ? `${incidentView.dai ?? 0} × ${incidentView.rong ?? 0} × ${incidentView.cao ?? 0} ${incidentView.unit ?? ''}`
      : '—'

  const assignedBy =
    profile?.displayName?.trim() || user?.email?.trim() || 'Admin'

  const showAssignButton = isCompanyAdmin && canAssignRework(incidentView)
  const submissionUrls = rw.submissionImages

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        title={`${incidentView.road ?? '—'} · ${incidentView.km ?? '—'}`}
        className="sm:max-w-3xl"
      >
        <div className="space-y-5 text-sm">
          {rw.required || rw.status !== 'NONE' ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="warning">Bổ sung hồ sơ: {reworkStatusLabel(rw.status)}</Badge>
              {rw.reason ? (
                <span className="text-xs text-muted-foreground">{rw.reason}</span>
              ) : null}
            </div>
          ) : null}

          {showAssignButton ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setAssignOpen(true)}
            >
              <RefreshCw className="h-4 w-4" />
              Yêu cầu bổ sung
            </Button>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-2">
            <p>
              <span className="text-muted-foreground">Tuyến:</span> {incidentView.road || '—'}
            </p>
            <p>
              <span className="text-muted-foreground">Lý trình:</span> {incidentView.km || '—'}
            </p>
            <p>
              <span className="text-muted-foreground">Phía:</span>{' '}
              {positionLabel(incidentView.position)}
            </p>
            <p>
              <span className="text-muted-foreground">Loại:</span> {incidentView.type || '—'}
            </p>
            <p>
              <span className="text-muted-foreground">Kích thước:</span> {size}
            </p>
            <p>
              <span className="text-muted-foreground">Khối lượng:</span>{' '}
              {vol > 0 ? `${vol.toFixed(2)} ${volUnit}` : '—'}
            </p>
            <p>
              <span className="text-muted-foreground">Tiến độ:</span>{' '}
              {progressLabel(incidentView.progress)}
            </p>
            <p>
              <span className="text-muted-foreground">Trạng thái:</span> {statusLabel(status)}
            </p>
            <p>
              <span className="text-muted-foreground">{creatorFieldLabel}:</span> {creator}
            </p>
            <p>
              <span className="text-muted-foreground">Ngày xảy ra:</span> {incidentView.date || '—'}
            </p>
            <p>
              <span className="text-muted-foreground">Ngày hoàn thành:</span>{' '}
              {incidentView.completedDate?.trim() || '—'}
            </p>
          </div>

          {incidentView.note ? (
            <p>
              <span className="text-muted-foreground">Ghi chú:</span> {incidentView.note}
            </p>
          ) : null}

          {rw.note ? (
            <p>
              <span className="text-muted-foreground">Ghi chú yêu cầu bổ sung:</span> {rw.note}
            </p>
          ) : null}

          <p className="text-xs text-muted-foreground">
            Bấm <span className="font-medium text-foreground">✓</span> chọn ảnh, điền{' '}
            <span className="font-medium text-foreground">STT</span> ở ô dưới mỗi ảnh (HT / XL xen
            kẽ tùy STT). Thùng rác ở góc dưới ảnh để xóa.
          </p>
          {hiddenPhotoCount > 0 ? (
            <p className="text-xs text-muted-foreground">
              {hiddenPhotoCount} ảnh chưa có link cloud (chỉ lưu trên app). Dùng{' '}
              <span className="font-medium text-foreground">Khôi phục ảnh cloud</span> trên Hiện
              trường để bổ sung.
            </p>
          ) : null}
          <IncidentImageGallery
            beforeUrls={beforeUrls}
            afterUrls={afterUrls}
            beforeTitle="Hiện trạng"
            afterTitle="Sau xử lý"
            selection={
              user
                ? {
                    beforeUrls: reportSlots
                      .filter((s) => s.kind === 'before')
                      .map((s) => s.url),
                    afterUrls: reportSlots
                      .filter((s) => s.kind === 'after')
                      .map((s) => s.url),
                    orderIndex: (kind, url) =>
                      reportSlotOrderIndex(reportSlots, kind, url),
                    onOrderChange: handleOrderChange,
                    onToggle: handleTogglePhoto,
                    onSelectAll: handleSelectAll,
                    onClearAll: handleClearAll,
                  }
                : undefined
            }
            onDeletePhoto={user ? handleDeletePhoto : undefined}
            deletingUrl={deletingUrl}
          />

          {submissionUrls.length > 0 ? (
            <div>
              <p className="mb-2 font-semibold">Ảnh bổ sung (chờ duyệt / lịch sử)</p>
              <IncidentImageGallery
                beforeUrls={[]}
                afterUrls={submissionUrls}
                hideBefore
                afterTitle="Ảnh bổ sung"
              />
            </div>
          ) : null}

          <div>
            <p className="mb-3 font-semibold">Lịch sử</p>
            <IncidentFullTimeline incident={incidentView} />
          </div>
        </div>
      </Dialog>

      <ReworkAssignDialog
        incident={incidentView}
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        assignedBy={assignedBy}
        onAssigned={() => reload()}
      />
    </>
  )
}
