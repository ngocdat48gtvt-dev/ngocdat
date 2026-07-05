import { cn } from '@/lib/utils'
import { Button } from './primitives'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  className?: string
}

export function Dialog({ open, onClose, title, children, className }: DialogProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
      <div
        className={cn(
          'flex max-h-[92vh] w-full flex-col rounded-t-2xl border border-border bg-card shadow-xl sm:max-h-[90vh] sm:max-w-lg sm:rounded-xl',
          className,
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
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
