import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from './primitives'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  className?: string
  /** Cho phép kéo hộp thoại bằng chuột qua thanh tiêu đề. */
  draggable?: boolean
  /** Style bổ sung cho khung hộp thoại (vd width theo nội dung). */
  style?: React.CSSProperties
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  className,
  draggable = false,
  style,
}: DialogProps) {
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const drag = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null)

  useEffect(() => {
    if (open) setOffset({ x: 0, y: 0 })
  }, [open])

  if (!open) return null

  function onPointerDown(e: React.PointerEvent) {
    if (!draggable) return
    if ((e.target as HTMLElement).closest('button')) return
    drag.current = { startX: e.clientX, startY: e.clientY, baseX: offset.x, baseY: offset.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return
    setOffset({
      x: drag.current.baseX + (e.clientX - drag.current.startX),
      y: drag.current.baseY + (e.clientY - drag.current.startY),
    })
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!drag.current) return
    drag.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
      <div
        className={cn(
          'flex max-h-[92vh] w-full flex-col rounded-t-2xl border border-border bg-card shadow-xl sm:max-h-[90vh] sm:max-w-lg sm:rounded-xl',
          className,
        )}
        style={{
          ...style,
          ...(draggable ? { transform: `translate(${offset.x}px, ${offset.y}px)` } : {}),
        }}
      >
        <div
          className={cn(
            'flex shrink-0 items-center justify-between border-b border-border px-4 py-3',
            draggable && 'cursor-move select-none',
          )}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <h2 className="text-base font-semibold sm:text-lg">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} type="button" aria-label="Đóng">
            ✕
          </Button>
        </div>
        <div className="overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  )
}
