import { useState } from 'react'
import { Button, Textarea } from '@/components/ui/primitives'
import { CameraCaptureInput } from '@/components/incident/CameraCaptureInput'
import type { IncidentRecord } from '@/types/incident'

type Props = {
  incident: IncidentRecord
  saving: boolean
  onSave: (progress: number, note: string, afterFiles: File[]) => Promise<void>
}

const QUICK = [0, 90, 100] as const

export function ProgressPanel({ incident, saving, onSave }: Props) {
  const [progress, setProgress] = useState(incident.progress ?? 0)
  const [note, setNote] = useState('')
  const [afterFiles, setAfterFiles] = useState<File[]>([])

  async function handleSave() {
    await onSave(progress, note, afterFiles)
    setNote('')
    setAfterFiles([])
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <h3 className="font-semibold">Cập nhật tiến độ</h3>

      <div className="grid grid-cols-3 gap-2">
        {QUICK.map((p) => (
          <Button
            key={p}
            type="button"
            variant={progress === p ? 'default' : 'outline'}
            className="h-12"
            disabled={saving}
            onClick={() => setProgress(p)}
          >
            {p}%
          </Button>
        ))}
      </div>

      <div>
        <label className="text-sm font-medium">Tiến độ (%)</label>
        <input
          type="range"
          min={0}
          max={100}
          value={progress}
          className="mt-2 w-full"
          disabled={saving}
          onChange={(e) => setProgress(Number(e.target.value))}
        />
        <p className="text-center text-sm font-medium">{progress}%</p>
      </div>

      <div>
        <label className="text-sm font-medium">Ghi chú</label>
        <Textarea
          className="mt-1"
          rows={3}
          value={note}
          disabled={saving}
          placeholder="Mô tả tiến độ xử lý..."
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <CameraCaptureInput
        label="Ảnh xử lý (sau thi công)"
        disabled={saving}
        onFiles={(files) => setAfterFiles((prev) => [...prev, ...files])}
      />
      {afterFiles.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          Đã chọn {afterFiles.length} ảnh xử lý
        </p>
      ) : null}

      <Button
        type="button"
        className="h-12 w-full text-base"
        disabled={saving}
        onClick={() => void handleSave()}
      >
        {saving ? 'Đang lưu...' : 'Lưu tiến độ'}
      </Button>
    </div>
  )
}
