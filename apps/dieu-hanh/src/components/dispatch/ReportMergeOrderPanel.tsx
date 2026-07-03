import { cn } from '@/lib/utils'
import type { ReportImageSlot } from '@/lib/incidentUtils'
import { Button } from '@/components/ui/primitives'

export function ReportMergeOrderPanel({
  slots,
  onOrderChange,
  onRemove,
}: {
  slots: ReportImageSlot[]
  onOrderChange: (index: number, order: number) => void
  onRemove: (index: number) => void
}) {
  if (slots.length === 0) return null

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <p className="mb-2 text-xs font-semibold text-foreground">
        Thứ tự ghép Word ({slots.length} ảnh)
      </p>
      <p className="mb-2 text-[11px] text-muted-foreground">
        Tick ảnh rồi điền STT — hoặc sửa số tại đây. HT và XL có thể xen kẽ theo STT.
      </p>
      <ol className="space-y-1.5">
        {slots.map((slot, index) => (
          <li
            key={`${slot.kind}-${slot.url}`}
            className="flex items-center gap-2 rounded-md border border-border/60 bg-background px-2 py-1.5"
          >
            <input
              type="number"
              min={1}
              max={slots.length}
              inputMode="numeric"
              className="h-8 w-12 shrink-0 rounded border border-amber-400 bg-white text-center text-sm font-bold text-amber-700 outline-none focus:ring-2 focus:ring-amber-400 dark:bg-background"
              value={index + 1}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10)
                if (Number.isFinite(n) && n >= 1) onOrderChange(index, n)
              }}
              aria-label={`STT ghép ảnh ${index + 1}`}
            />
            <span
              className={cn(
                'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase',
                slot.kind === 'before'
                  ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200'
                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
              )}
            >
              {slot.kind === 'before' ? 'HT' : 'XL'}
            </span>
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
              {slot.kind === 'before' ? 'Ảnh hiện trạng' : 'Ảnh sau xử lý'}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 shrink-0 px-2 text-xs text-muted-foreground"
              onClick={() => onRemove(index)}
            >
              Bỏ
            </Button>
          </li>
        ))}
      </ol>
    </div>
  )
}
