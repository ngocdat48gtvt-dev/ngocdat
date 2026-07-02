import { cn } from '@/lib/utils'
import { TH } from '@/components/ui/table'

type ResizableThProps = {
  colId: string
  width: number
  onResizeStart: (colId: string, clientX: number) => void
  children: React.ReactNode
  className?: string
  resizable?: boolean
}

export function ResizableTh({
  colId,
  width,
  onResizeStart,
  children,
  className,
  resizable = true,
}: ResizableThProps) {
  return (
    <TH
      className={cn(
        'sticky top-0 z-10 border-r border-border bg-muted px-2 py-2 text-center text-[11px] shadow-[inset_0_-1px_0_0_hsl(var(--border))] last:border-r-0',
        className,
      )}
      style={{ width, minWidth: width, maxWidth: width }}
    >
      <span className="block truncate px-1 text-center">{children}</span>
      {resizable ? (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Đổi bề rộng cột"
          className="absolute -right-px top-0 z-30 h-full w-[5px] cursor-col-resize touch-none select-none hover:bg-primary/25 active:bg-primary/40"
          onMouseDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onResizeStart(colId, e.clientX)
          }}
        />
      ) : null}
    </TH>
  )
}
