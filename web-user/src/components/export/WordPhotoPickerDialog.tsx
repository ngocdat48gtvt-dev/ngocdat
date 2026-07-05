import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import type { IncidentRecord } from '@/types/incident'
import {
  getWordPhotoSelection,
  setWordPhotoSelection,
  type WordPhotoSelection,
} from '@/lib/wordPhotoSelection'
import { beforeConstructionImages, afterConstructionImages } from '@/lib/incidentUtils'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/primitives'

type Props = {
  open: boolean
  onClose: () => void
  uid: string
  items: IncidentRecord[]
  onChange?: () => void
}

function PhotoGrid({
  title,
  urls,
  selected,
  onSelect,
}: {
  title: string
  urls: string[]
  selected?: string
  onSelect: (url: string) => void
}) {
  if (!urls.length) {
    return <p className="text-xs text-muted-foreground">{title}: chưa có ảnh</p>
  }
  return (
    <div>
      <p className="mb-1 text-xs font-medium">{title}</p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {urls.map((url) => (
          <button
            key={url}
            type="button"
            onClick={() => onSelect(url)}
            className={cn(
              'relative h-20 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition',
              selected === url ? 'border-primary ring-2 ring-primary/30' : 'border-border',
            )}
          >
            <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
          </button>
        ))}
      </div>
    </div>
  )
}

export function WordPhotoPickerDialog({ open, onClose, uid, items, onChange }: Props) {
  const [selections, setSelections] = useState<Record<string, WordPhotoSelection>>({})

  useEffect(() => {
    if (!open) return
    const next: Record<string, WordPhotoSelection> = {}
    for (const inc of items) {
      next[inc.id] = getWordPhotoSelection(uid, inc.id)
    }
    setSelections(next)
  }, [open, uid, items])

  function pick(incidentId: string, side: 'before' | 'after', url: string) {
    setWordPhotoSelection(uid, incidentId, side, url)
    setSelections((prev) => ({
      ...prev,
      [incidentId]: { ...prev[incidentId], [side]: url },
    }))
    onChange?.()
  }

  return (
    <Dialog open={open} onClose={onClose} title="Chọn ảnh ghép Word" className="sm:max-w-lg">
      <p className="mb-3 text-sm text-muted-foreground">
        Bấm ảnh để chọn ảnh trước / sau thi công cho từng sự cố (giống app Android).
        Nếu không chọn, Word dùng ảnh đầu tiên.
      </p>
      <div className="max-h-[60vh] space-y-4 overflow-y-auto">
        {items.map((inc) => {
          const before = beforeConstructionImages(inc)
          const after = afterConstructionImages(inc)
          const sel = selections[inc.id] ?? {}
          return (
            <div key={inc.id} className="rounded-lg border border-border p-3">
              <p className="text-sm font-semibold">
                {inc.km} · {inc.type}
              </p>
              <div className="mt-2 space-y-2">
                <PhotoGrid
                  title="Trước thi công"
                  urls={before}
                  selected={sel.before}
                  onSelect={(url) => pick(inc.id, 'before', url)}
                />
                <PhotoGrid
                  title="Sau thi công"
                  urls={after}
                  selected={sel.after}
                  onSelect={(url) => pick(inc.id, 'after', url)}
                />
              </div>
            </div>
          )
        })}
      </div>
      <Button type="button" className="mt-4 h-11 w-full" onClick={onClose}>
        Xong
      </Button>
    </Dialog>
  )
}
