import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ReportImageSlot } from '@/lib/incidentUtils'
import { Button } from '@/components/ui/primitives'

export function ReportMergeOrderPanel({
  slots,
  onMove,
}: {
  slots: ReportImageSlot[]
  onMove: (index: number, delta: -1 | 1) => void
}) {
  if (slots.length === 0) return null

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <p className="mb-2 text-xs font-semibold text-foreground">
        Thứ tự ghép Word ({slots.length} ảnh)
      </p>
      <p className="mb-2 text-[11px] text-muted-foreground">
        STT quyết định thứ tự ảnh trong báo cáo — HT và XL có thể xen kẽ. Dùng mũi tên để đổi
        thứ tự.
      </p>
      <ol className="space-y-1.5">
        {slots.map((slot, index) => (
          <li
            key={`${slot.kind}-${slot.url}`}
            className="flex items-center gap-2 rounded-md border border-border/60 bg-background px-2 py-1.5"
          >
            <span className="w-7 shrink-0 text-center text-sm font-bold text-amber-600">
              {index + 1}
            </span>
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
            <div className="flex shrink-0 gap-0.5">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-7 w-7"
                disabled={index === 0}
                onClick={() => onMove(index, -1)}
                aria-label="Lên trên"
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-7 w-7"
                disabled={index === slots.length - 1}
                onClick={() => onMove(index, 1)}
                aria-label="Xuống dưới"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
