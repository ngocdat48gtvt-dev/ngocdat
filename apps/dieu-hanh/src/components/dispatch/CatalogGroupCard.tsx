import { useMemo, useState } from 'react'
import { Badge, Button, Label, Textarea } from '@/components/ui/primitives'
import { linesFromText, mergeUniqueLines } from '@/lib/catalogHelpers'
import { cn } from '@/lib/utils'
import { Plus, Trash2 } from 'lucide-react'

type Props = {
  group: string
  types: string[]
  onChange: (types: string[]) => void
  onRemoveGroup: () => void
}

export function CatalogGroupCard({ group, types, onChange, onRemoveGroup }: Props) {
  const [quick, setQuick] = useState('')
  const text = types.join('\n')
  const preview = useMemo(() => types.slice(0, 8), [types])

  function commitText(next: string) {
    onChange(linesFromText(next))
  }

  function addQuick() {
    const merged = mergeUniqueLines(types, linesFromText(quick))
    if (merged.length === types.length) {
      setQuick('')
      return
    }
    onChange(merged)
    setQuick('')
  }

  return (
    <article
      className={cn(
        'flex flex-col rounded-xl border border-border bg-background/80',
        'shadow-sm transition hover:border-primary/30',
      )}
    >
      <header className="flex items-start justify-between gap-2 border-b border-border/80 px-4 py-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-foreground">{group}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Mỗi dòng một loại · {types.length} loại
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0 text-destructive hover:bg-destructive/10"
          onClick={onRemoveGroup}
          title="Xóa nhóm khỏi danh mục"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </header>

      <div className="flex flex-1 flex-col gap-3 p-4">
        {preview.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {preview.map((t) => (
              <Badge key={t} variant="muted" className="max-w-full truncate">
                {t}
              </Badge>
            ))}
            {types.length > preview.length && (
              <Badge variant="muted">+{types.length - preview.length}</Badge>
            )}
          </div>
        )}

        <div>
          <Label className="text-xs text-muted-foreground">Danh sách loại</Label>
          <Textarea
            className="mt-1.5 min-h-[140px] font-mono text-[13px] leading-relaxed"
            value={text}
            placeholder={'Sụt dương\nSa bồi rãnh xây\n…'}
            onChange={(e) => commitText(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <input
            className="flex h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none ring-primary focus:ring-2"
            placeholder="Thêm nhanh một loại…"
            value={quick}
            onChange={(e) => setQuick(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addQuick()
              }
            }}
          />
          <Button type="button" variant="secondary" size="sm" onClick={addQuick}>
            <Plus className="h-4 w-4" />
            Thêm
          </Button>
        </div>
      </div>
    </article>
  )
}
