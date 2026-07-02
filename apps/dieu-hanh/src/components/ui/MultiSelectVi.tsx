import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/primitives'

type Props = {
  id?: string
  options: string[]
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  allLabel?: string
  compact?: boolean
  className?: string
  ariaLabel?: string
  /** Hiển thị nhãn khác giá trị lưu (vd. uid → tên nhân sự). */
  getOptionLabel?: (value: string) => string
}

function summarizeSelection(
  selected: string[],
  placeholder: string,
  allLabel: string,
  options: string[],
  getOptionLabel?: (value: string) => string,
): string {
  const labelOf = (value: string) => getOptionLabel?.(value) ?? value
  if (selected.length === 0) return placeholder
  if (selected.length === options.length && options.length > 0) return allLabel
  if (selected.length === 1) return labelOf(selected[0]!)
  return `${selected.length} mục đã chọn`
}

export function MultiSelectVi({
  id,
  options,
  value,
  onChange,
  placeholder = 'Chọn…',
  allLabel = 'Tất cả',
  compact = false,
  className,
  ariaLabel,
  getOptionLabel,
}: Props) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0, width: 240 })

  const updatePopupPosition = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const width = Math.max(rect.width, Math.min(280, window.innerWidth - 16))
    let left = rect.left
    if (left + width > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - width - 8)
    }
    let top = rect.bottom + 4
    const estimatedHeight = Math.min(320, 56 + options.length * 36)
    if (top + estimatedHeight > window.innerHeight - 8) {
      top = Math.max(8, rect.top - estimatedHeight - 4)
    }
    setPopupPos({ top, left, width })
  }, [options.length])

  useEffect(() => {
    if (!open) return
    updatePopupPosition()
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node
      if (triggerRef.current?.contains(target)) return
      if (popupRef.current?.contains(target)) return
      setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    function onReposition() {
      updatePopupPosition()
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [open, updatePopupPosition])

  function toggleOpen() {
    setOpen((prev) => {
      const next = !prev
      if (next) requestAnimationFrame(() => updatePopupPosition())
      return next
    })
  }

  function toggleOption(option: string) {
    if (value.includes(option)) {
      onChange(value.filter((v) => v !== option))
    } else {
      onChange([...value, option])
    }
  }

  function selectAll() {
    onChange([...options])
  }

  function clearAll() {
    onChange([])
  }

  const label = summarizeSelection(value, placeholder, allLabel, options, getOptionLabel)
  const labelOf = (option: string) => getOptionLabel?.(option) ?? option

  const popup = open ? (
    <div
      ref={popupRef}
      role="listbox"
      aria-multiselectable
      aria-label={ariaLabel}
      style={{
        position: 'fixed',
        top: popupPos.top,
        left: popupPos.left,
        width: popupPos.width,
        zIndex: 9999,
      }}
      className="max-h-72 overflow-y-auto rounded-lg border border-border bg-card p-2 text-card-foreground shadow-lg"
    >
      <div className="mb-1 flex gap-1 border-b border-border pb-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 flex-1 px-2 text-xs"
          onClick={selectAll}
        >
          Chọn tất cả
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 flex-1 px-2 text-xs text-muted-foreground"
          onClick={clearAll}
        >
          Bỏ chọn
        </Button>
      </div>
      {options.length === 0 ? (
        <p className="px-2 py-3 text-xs text-muted-foreground">Không có lựa chọn</p>
      ) : (
        options.map((option) => {
          const checked = value.includes(option)
          return (
            <button
              key={option}
              type="button"
              role="option"
              aria-selected={checked}
              onClick={() => toggleOption(option)}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition hover:bg-muted/60',
                checked && 'bg-primary/5',
              )}
            >
              <span
                className={cn(
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded border border-border',
                  checked && 'border-primary bg-primary text-primary-foreground',
                )}
              >
                {checked ? <Check className="h-3 w-3" /> : null}
              </span>
              <span className="min-w-0 flex-1 leading-snug">{labelOf(option)}</span>
            </button>
          )
        })
      )}
    </div>
  ) : null

  return (
    <div className={cn('relative', className)}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        onClick={toggleOpen}
        className={cn(
          'flex w-full items-center gap-2 rounded-md border border-border bg-background px-2 text-left text-sm outline-none ring-primary transition hover:bg-muted/40 focus:ring-2',
          compact ? 'h-9' : 'h-10 rounded-lg px-3',
          value.length === 0 && 'text-muted-foreground',
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel ?? label}
      >
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-muted-foreground transition', open && 'rotate-180')}
        />
      </button>
      {popup ? createPortal(popup, document.body) : null}
    </div>
  )
}
