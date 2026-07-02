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
  computeKhoiLuong,
  progressLabel,
  resolveSelectedImageUrl,
  statusLabel,
  statusFromProgress,
} from '@/lib/incidentUtils'
import { updateSelectedReportPhoto } from '@/services/incidentsService'
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
  const [selBefore, setSelBefore] = useState<string | null>(null)
  const [selAfter, setSelAfter] = useState<string | null>(null)

  const beforeUrls = incident ? beforeConstructionImages(incident) : []
  const afterUrls = incident ? afterConstructionImages(incident) : []

  useEffect(() => {
    if (!incident) return
    setSelBefore(resolveSelectedImageUrl(beforeUrls, incident.selectedBefore))
    setSelAfter(resolveSelectedImageUrl(afterUrls, incident.selectedAfter))
    // chỉ phụ thuộc id để khởi tạo lại khi mở sự cố khác
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incident?.id, incident?.selectedBefore, incident?.selectedAfter])

  async function handleSelectPhoto(kind: 'before' | 'after', url: string) {
    if (!incident) return
    const field = kind === 'before' ? 'selectedBefore' : 'selectedAfter'
    if (kind === 'before') setSelBefore(url)
    else setSelAfter(url)
    try {
      await updateSelectedReportPhoto(incident.ownerUid, incident.id, field, url)
      toast.success('Đã chọn ảnh cho báo cáo Word')
    } catch {
      toast.error('Không lưu được lựa chọn ảnh')
    }
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

          {isCompanyAdmin ? (
            <p className="text-xs text-muted-foreground">
              Bấm dấu <span className="font-medium text-foreground">✓</span> ở góc ảnh để chọn ảnh ghép báo cáo Word
              (mỗi mục 1 ảnh; mặc định lấy ảnh đầu tiên). Ảnh đã chọn trên app cũng hiện sẵn dấu ✓.
            </p>
          ) : null}
          <IncidentImageGallery
            beforeUrls={beforeUrls}
            afterUrls={afterUrls}
            selection={
              isCompanyAdmin
                ? { beforeUrl: selBefore, afterUrl: selAfter, onSelect: handleSelectPhoto }
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
