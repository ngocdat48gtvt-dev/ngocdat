import { useState } from 'react'
import { toast } from 'sonner'
import { Dialog } from '@/components/ui/dialog'
import { Button, Label, Textarea } from '@/components/ui/primitives'
import { REWORK_REASON_OPTIONS } from '@/lib/reworkUtils'
import { assignRework } from '@/services/reworkService'
import type { IncidentRecord } from '@/types/incident'

export function ReworkAssignDialog({
  incident,
  open,
  onClose,
  assignedBy,
  onAssigned,
}: {
  incident: IncidentRecord | null
  open: boolean
  onClose: () => void
  assignedBy: string
  onAssigned: () => void
}) {
  const [reason, setReason] = useState<string>(REWORK_REASON_OPTIONS[0])
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  if (!incident) return null

  async function handleSubmit() {
    const inc = incident
    if (!inc) return
    if (!reason.trim()) {
      toast.error('Chọn lý do yêu cầu bổ sung')
      return
    }
    setBusy(true)
    try {
      await assignRework(inc.ownerUid, inc.id, {
        reason: reason.trim(),
        note: note.trim(),
        assignedBy,
      })
      toast.success('Đã giao việc bổ sung')
      setNote('')
      onAssigned()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Giao việc thất bại')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Yêu cầu bổ sung hồ sơ">
      <div className="space-y-4 text-sm">
        <p className="text-muted-foreground">
          {incident.road ?? '—'} · {incident.km ?? '—'} · {incident.type ?? '—'}
        </p>
        <div>
          <Label htmlFor="rework-reason">Lý do</Label>
          <select
            id="rework-reason"
            className="mt-1 flex h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none ring-primary focus:ring-2"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          >
            {REWORK_REASON_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="rework-note">Ghi chú</Label>
          <Textarea
            id="rework-note"
            className="mt-1 min-h-[88px]"
            placeholder="Mô tả chi tiết yêu cầu bổ sung…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Hủy
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={busy}>
            {busy ? 'Đang giao…' : 'Giao việc'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
