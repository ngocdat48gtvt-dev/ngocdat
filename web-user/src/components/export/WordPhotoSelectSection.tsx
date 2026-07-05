import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  getWordPhotoSelection,
  setWordPhotoSelection,
} from '@/lib/wordPhotoSelection'
import { Card } from '@/components/ui/primitives'

type Props = {
  uid: string
  incidentId: string
  beforeUrls: string[]
  afterUrls: string[]
}

function ThumbRow({
  label,
  urls,
  selected,
  onPick,
}: {
  label: string
  urls: string[]
  selected?: string
  onPick: (url: string) => void
}) {
  if (!urls.length) return null
  return (
    <div className="mt-2">
      <p className="text-xs text-muted-foreground">{label} — bấm để chọn ghép Word</p>
      <div className="mt-1 flex gap-2 overflow-x-auto">
        {urls.map((url) => (
          <button
            key={url}
            type="button"
            onClick={() => onPick(url)}
            className={cn(
              'h-16 w-14 shrink-0 overflow-hidden rounded-lg border-2',
              selected === url ? 'border-primary' : 'border-transparent',
            )}
          >
            <img src={url} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  )
}

/** Chọn ảnh ghép Word trên chi tiết sự cố — khớp IncidentDetailActivity. */
export function WordPhotoSelectSection({ uid, incidentId, beforeUrls, afterUrls }: Props) {
  const [sel, setSel] = useState(getWordPhotoSelection(uid, incidentId))

  useEffect(() => {
    setSel(getWordPhotoSelection(uid, incidentId))
  }, [uid, incidentId])

  if (!beforeUrls.length && !afterUrls.length) return null

  return (
    <Card className="mt-2 border-dashed p-3">
      <p className="text-xs font-medium text-primary">Ảnh ghép báo cáo Word</p>
      <ThumbRow
        label="Trước thi công"
        urls={beforeUrls}
        selected={sel.before}
        onPick={(url) => {
          setWordPhotoSelection(uid, incidentId, 'before', url)
          setSel((s) => ({ ...s, before: url }))
        }}
      />
      <ThumbRow
        label="Sau thi công"
        urls={afterUrls}
        selected={sel.after}
        onPick={(url) => {
          setWordPhotoSelection(uid, incidentId, 'after', url)
          setSel((s) => ({ ...s, after: url }))
        }}
      />
    </Card>
  )
}
