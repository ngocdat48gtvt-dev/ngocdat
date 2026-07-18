import { useState } from 'react'
import { cn } from '@/lib/utils'
import { TH } from '@/components/ui/table'

type ResizableThProps = {
  colId: string
  width: number
  onResizeStart: (colId: string, clientX: number) => void
  children: React.ReactNode
  className?: string
  resizable?: boolean
  /** Cho phép kéo thả đổi thứ tự cột */
  reorderable?: boolean
  onReorder?: (fromId: string, toId: string) => void
}

export function ResizableTh({
  colId,
  width,
  onResizeStart,
  children,
  className,
  resizable = true,
  reorderable = false,
  onReorder,
}: ResizableThProps) {
  const [dragOver, setDragOver] = useState(false)

  return (
    <TH
      className={cn(
        'sticky top-0 z-10 border-r border-border bg-muted px-2 py-2 text-center text-[11px] shadow-[inset_0_-1px_0_0_hsl(var(--border))] last:border-r-0',
        dragOver && 'bg-primary/15 ring-2 ring-inset ring-primary/40',
        className,
      )}
      style={{ width, minWidth: width, maxWidth: width }}
      onDragOver={
        reorderable
          ? (e) => {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
              setDragOver(true)
            }
          : undefined
      }
      onDragLeave={
        reorderable
          ? () => {
              setDragOver(false)
            }
          : undefined
      }
      onDrop={
        reorderable
          ? (e) => {
              e.preventDefault()
              setDragOver(false)
              const fromId = e.dataTransfer.getData('text/col-id')
              if (fromId && onReorder) onReorder(fromId, colId)
            }
          : undefined
      }
    >
      <span
        className={cn(
          'block truncate px-1 text-center',
          reorderable && 'cursor-grab active:cursor-grabbing',
        )}
        title={reorderable ? 'Kéo để đổi thứ tự cột' : undefined}
        draggable={reorderable}
        onDragStart={
          reorderable
            ? (e) => {
                e.dataTransfer.setData('text/col-id', colId)
                e.dataTransfer.effectAllowed = 'move'
              }
            : undefined
        }
        onDragEnd={
          reorderable
            ? () => {
                setDragOver(false)
              }
            : undefined
        }
      >
        {children}
      </span>
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
