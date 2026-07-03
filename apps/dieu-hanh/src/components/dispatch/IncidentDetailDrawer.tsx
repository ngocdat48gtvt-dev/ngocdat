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
} from '@/lib/incidentUtils'
import { updateReportImageSelection } from '@/services/incidentsService'
import {
  canAssignRework,
  getIncidentRework,
  reworkStatusLabel,
} from '@/lib/reworkUtils'
import { positionLabel } from '@/lib/positionUtils'
import { Badge, Button } from '@/components/ui/primitives'
import { IncidentImageGallery } from './IncidentImageGallery'
import { ReportMergeOrderPanel } from './ReportMergeOrderPanel'
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

  const beforeUrls = incident ? beforeConstructionImages(incident) : []
  const afterUrls = incident ? afterConstructionImages(incident) : []

  useEffect(() => {
    if (!incident || !open) return
    setReportSlots(reportImageSlots(incident))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incident?.id, open])

  async function persistReportSlots(nextSlots: ReportImageSlot[]) {
    if (!incident) return
    setReportSlots(nextSlots)
    const { selectedBefore, selectedAfter } = legacyRefsFromReportSlots(nextSlots)
    const reportImageOrder = encodeReportImageOrder(nextSlots)
    try {
      await updateReportImageSelection(
        incident.ownerUid,
        incident.id,
        reportImageOrder,
        selectedBefore,
        selectedAfter,
      )
      toast.success('Đã cập nhật thứ tự ảnh cho báo cáo Word')
    } catch {
      toast.error('Không lưu được lựa chọn ảnh')
      setReportSlots(reportImageSlots(incident))
    }
  }

  function handleTogglePhoto(kind: 'before' | 'after', url: string) {
    if (!incident) return
    void persistReportSlots(toggleReportImageSlot(reportSlots, kind, url))
  }

  function handleSelectAll(kind: 'before' | 'after') {
    if (!incident) return
    const pool = kind === 'before' ? beforeUrls : afterUrls
    void persistReportSlots(selectAllReportImageSlots(reportSlots, kind, pool))
  }

  function handleClearAll(kind: 'before' | 'after') {
    if (!incident) return
    void persistReportSlots(clearReportImageSlots(reportSlots, kind))
  }

  function handleOrderChange(kind: 'before' | 'after', url: string, order: number) {
    if (!incident) return
    void persistReportSlots(assignReportSlotOrder(reportSlots, kind, url, order))
  }

  function handlePanelOrderChange(index: number, order: number) {
    const slot = reportSlots[index]
    if (!slot || !incident) return
    void persistReportSlots(assignReportSlotOrder(reportSlots, slot.kind, slot.url, order))
  }

  function handleRemoveSlot(index: number) {
    const slot = reportSlots[index]
    if (!slot || !incident) return
    void persistReportSlots(toggleReportImageSlot(reportSlots, slot.kind, slot.url))
  }

  if (!incident) return null

  const vol = computeKhoiLuong(incident)
  const volUnit = incident.unit?.trim() || 'm³'
  const creator = creatorLabel(incident.ownerUid, incident.createdByName)
  const status = incident.status ?? statusFromProgress(incident.progress)
  const rw = getIncidentRework(incident)
  const size =
    incident.dai || incident.rong || incident.cao
      ? `${incident.dai ?? 0} × ${incident.rong ?? 0} × ${incident.cao ?? 0} ${incident.unit ?? ''}`
      : '—'

  const assignedBy =
    profile?.displayName?.trim() || user?.email?.trim() || 'Admin'

  const showAssignButton = isCompanyAdmin && canAssignRework(incident)
  const submissionUrls = rw.submissionImages

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        title={`${incident.road ?? '—'} · ${incident.km ?? '—'}`}
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
              <span className="text-muted-foreground">Tuyến:</span> {incident.road || '—'}
            </p>
            <p>
              <span className="text-muted-foreground">Lý trình:</span> {incident.km || '—'}
            </p>
            <p>
              <span className="text-muted-foreground">Phía:</span>{' '}
              {positionLabel(incident.position)}
            </p>
            <p>
              <span className="text-muted-foreground">Loại:</span> {incident.type || '—'}
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
              {progressLabel(incident.progress)}
            </p>
            <p>
              <span className="text-muted-foreground">Trạng thái:</span> {statusLabel(status)}
            </p>
            <p>
              <span className="text-muted-foreground">{creatorFieldLabel}:</span> {creator}
            </p>
            <p>
              <span className="text-muted-foreground">Ngày xảy ra:</span> {incident.date || '—'}
            </p>
            <p>
              <span className="text-muted-foreground">Ngày hoàn thành:</span>{' '}
              {incident.completedDate?.trim() || '—'}
            </p>
          </div>

          {incident.note ? (
            <p>
              <span className="text-muted-foreground">Ghi chú:</span> {incident.note}
            </p>
          ) : null}

          {rw.note ? (
            <p>
              <span className="text-muted-foreground">Ghi chú yêu cầu bổ sung:</span> {rw.note}
            </p>
          ) : null}

          <p className="text-xs text-muted-foreground">
            Bấm <span className="font-medium text-foreground">✓</span> chọn ảnh, rồi điền{' '}
            <span className="font-medium text-foreground">STT</span> ghép Word (ô dưới ảnh hoặc
            bảng thứ tự). HT / XL xen kẽ tùy STT.
          </p>
          {user && reportSlots.length > 0 ? (
            <ReportMergeOrderPanel
              slots={reportSlots}
              onOrderChange={handlePanelOrderChange}
              onRemove={handleRemoveSlot}
            />
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
            <IncidentFullTimeline incident={incident} />
          </div>
        </div>
      </Dialog>

      <ReworkAssignDialog
        incident={incident}
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        assignedBy={assignedBy}
        onAssigned={() => reload()}
      />
    </>
  )
}
