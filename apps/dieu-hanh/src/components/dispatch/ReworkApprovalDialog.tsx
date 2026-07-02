import { useState } from 'react'
import { toast } from 'sonner'
import { Dialog } from '@/components/ui/dialog'
import { Button, Label, Textarea } from '@/components/ui/primitives'
import {
  afterConstructionImages,
  beforeConstructionImages,
} from '@/lib/incidentUtils'
import { getIncidentRework, REWORK_REASON_OPTIONS } from '@/lib/reworkUtils'
import { approveRework, requestReworkRevision } from '@/services/reworkService'
import { IncidentImageGallery } from './IncidentImageGallery'
import type { IncidentRecord } from '@/types/incident'

export function ReworkApprovalDialog({
  incident,
  open,
  onClose,
  approvedBy,
  onApproved,
}: {
  incident: IncidentRecord | null
  open: boolean
  onClose: () => void
  approvedBy: string
  onApproved: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [showRevision, setShowRevision] = useState(false)
  const [revisionReason, setRevisionReason] = useState<string>(REWORK_REASON_OPTIONS[0])
  const [revisionNote, setRevisionNote] = useState('')

  if (!incident) return null

  const rw = getIncidentRework(incident)
  const submissionUrls = rw.submissionImages

  function resetRevisionForm() {
    setShowRevision(false)
    setRevisionReason(rw.reason || REWORK_REASON_OPTIONS[0])
    setRevisionNote('')
  }

  async function handleApprove() {
    const inc = incident
    if (!inc) return
    setBusy(true)
    try {
      await approveRework(inc.ownerUid, inc.id, inc, approvedBy)
      toast.success('Đã duyệt — ảnh đã gộp vào sau thi công')
      onApproved()
      onClose()
      resetRevisionForm()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Duyệt thất bại')
    } finally {
      setBusy(false)
    }
  }

  async function handleRequestRevision() {
    const inc = incident
    if (!inc) return
    if (!revisionNote.trim()) {
      toast.error('Nhập ghi chú hướng dẫn User sửa lại')
      return
    }
    setBusy(true)
    try {
      await requestReworkRevision(inc.ownerUid, inc.id, inc, {
        reason: revisionReason,
        note: revisionNote.trim(),
        assignedBy: approvedBy,
      })
      toast.success('Đã yêu cầu User bổ sung lại')
      onApproved()
      onClose()
      resetRevisionForm()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gửi yêu cầu sửa thất bại')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (busy) return
        onClose()
        resetRevisionForm()
      }}
      title="Duyệt bổ sung hồ sơ"
      className="sm:max-w-3xl"
    >
      <div className="space-y-4 text-sm">
        <div className="grid gap-1 sm:grid-cols-2">
          <p>
            <span className="text-muted-foreground">Tuyến:</span> {incident.road || '—'}
          </p>
          <p>
            <span className="text-muted-foreground">Lý trình:</span> {incident.km || '—'}
          </p>
          <p className="sm:col-span-2">
            <span className="text-muted-foreground">Lý do:</span> {rw.reason || '—'}
          </p>
          {rw.note ? (
            <p className="sm:col-span-2">
              <span className="text-muted-foreground">Ghi chú Admin:</span> {rw.note}
            </p>
          ) : null}
          {rw.submissionNote ? (
            <p className="sm:col-span-2">
              <span className="text-muted-foreground">Ghi chú User:</span> {rw.submissionNote}
            </p>
          ) : null}
        </div>

        <div>
          <p className="mb-2 font-semibold">Ảnh hiện trường (trước / sau — hiện có)</p>
          <IncidentImageGallery
            beforeUrls={beforeConstructionImages(incident)}
            afterUrls={afterConstructionImages(incident)}
          />
        </div>

        {submissionUrls.length > 0 ? (
          <div>
            <p className="mb-2 font-semibold">Ảnh bổ sung (chờ duyệt)</p>
            <IncidentImageGallery
              beforeUrls={[]}
              afterUrls={submissionUrls}
              afterTitle="Ảnh bổ sung"
            />
          </div>
        ) : (
          <p className="text-muted-foreground">User chưa gửi ảnh bổ sung.</p>
        )}

        {showRevision ? (
          <div className="space-y-3 rounded-lg border border-orange-200 bg-orange-50/50 p-3 dark:border-orange-900/50 dark:bg-orange-950/20">
            <p className="font-semibold text-orange-900 dark:text-orange-100">
              Yêu cầu sửa tiếp
            </p>
            <div className="space-y-1.5">
              <Label>Lý do</Label>
              <select
                className="flex h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                value={revisionReason}
                onChange={(e) => setRevisionReason(e.target.value)}
                disabled={busy}
              >
                {REWORK_REASON_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Ghi chú hướng dẫn sửa *</Label>
              <Textarea
                value={revisionNote}
                onChange={(e) => setRevisionNote(e.target.value)}
                placeholder="Mô tả cụ thể ảnh cần chụp lại…"
                rows={3}
                disabled={busy}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={resetRevisionForm}
              >
                Hủy
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-orange-700 hover:bg-orange-800"
                disabled={busy}
                onClick={handleRequestRevision}
              >
                {busy ? 'Đang gửi…' : 'Gửi yêu cầu sửa'}
              </Button>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Đóng
          </Button>
          {!showRevision ? (
            <Button
              type="button"
              variant="outline"
              className="border-orange-300 text-orange-800 hover:bg-orange-50 dark:border-orange-800 dark:text-orange-200 dark:hover:bg-orange-950/40"
              disabled={busy}
              onClick={() => {
                setRevisionReason(rw.reason || REWORK_REASON_OPTIONS[0])
                setShowRevision(true)
              }}
            >
              Yêu cầu sửa tiếp
            </Button>
          ) : null}
          <Button type="button" onClick={handleApprove} disabled={busy}>
            {busy ? 'Đang duyệt…' : '✅ Duyệt'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
