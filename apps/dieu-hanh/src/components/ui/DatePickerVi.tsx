import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn, formatDate, parseExpireDate, toIsoDateString } from '@/lib/utils'
import { Button } from '@/components/ui/primitives'

const MONTHS = [
  'Tháng 1',
  'Tháng 2',
  'Tháng 3',
  'Tháng 4',
  'Tháng 5',
  'Tháng 6',
  'Tháng 7',
  'Tháng 8',
  'Tháng 9',
  'Tháng 10',
  'Tháng 11',
  'Tháng 12',
]

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

type Props = {
  id?: string
  value: string
  onChange: (value: string) => void
  className?: string
  minYear?: number
  maxYear?: number
  compact?: boolean
}

function parseValue(value: string) {
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) {
    return {
      year: Number(iso[1]),
      month: Number(iso[2]),
      day: Number(iso[3]),
    }
  }
  const date = parseExpireDate(value)
  if (!date) return null
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  }
}

function isDateInRange(
  year: number,
  month: number,
  day: number,
  minYear: number,
  maxYear: number,
): boolean {
  const date = new Date(year, month - 1, day)
  const min = new Date(minYear, 0, 1)
  const max = new Date(maxYear, 11, 31, 23, 59, 59, 999)
  return date >= min && date <= max
}

function getCalendarDays(year: number, month: number): (number | null)[] {
  const first = new Date(year, month - 1, 1)
  const daysInMonth = new Date(year, month, 0).getDate()
  const startOffset = (first.getDay() + 6) % 7
  const cells: (number | null)[] = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  return cells
}

export function DatePickerVi({
  id,
  value,
  onChange,
  className,
  minYear = new Date().getFullYear() - 1,
  maxYear = new Date().getFullYear() + 10,
  compact = false,
}: Props) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const selected = useMemo(() => parseValue(value), [value])
  const today = useMemo(() => new Date(), [])

  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(selected?.year ?? today.getFullYear())
  const [viewMonth, setViewMonth] = useState(selected?.month ?? today.getMonth() + 1)
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0, width: 288 })

  const updatePopupPosition = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const width = Math.min(288, window.innerWidth - 16)
    let left = rect.left
    if (left + width > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - width - 8)
    }
    let top = rect.bottom + 4
    const estimatedHeight = 320
    if (top + estimatedHeight > window.innerHeight - 8) {
      top = Math.max(8, rect.top - estimatedHeight - 4)
    }
    setPopupPos({ top, left, width })
  }, [])

  useEffect(() => {
    if (selected) {
      setViewYear(selected.year)
      setViewMonth(selected.month)
    }
  }, [selected?.year, selected?.month])

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

  const cells = useMemo(() => getCalendarDays(viewYear, viewMonth), [viewYear, viewMonth])

  function shiftMonth(delta: number) {
    let nextMonth = viewMonth + delta
    let nextYear = viewYear
    if (nextMonth < 1) {
      nextMonth = 12
      nextYear -= 1
    } else if (nextMonth > 12) {
      nextMonth = 1
      nextYear += 1
    }
    if (nextYear < minYear || nextYear > maxYear) return
    setViewYear(nextYear)
    setViewMonth(nextMonth)
  }

  function pickDay(day: number) {
    if (!isDateInRange(viewYear, viewMonth, day, minYear, maxYear)) return
    onChange(toIsoDateString(viewYear, viewMonth, day))
    setOpen(false)
  }

  function setToday() {
    const t = new Date()
    onChange(toIsoDateString(t.getFullYear(), t.getMonth() + 1, t.getDate()))
    setViewYear(t.getFullYear())
    setViewMonth(t.getMonth() + 1)
    setOpen(false)
  }

  function toggleOpen() {
    setOpen((prev) => {
      const next = !prev
      if (next) {
        requestAnimationFrame(() => updatePopupPosition())
      }
      return next
    })
  }

  const display = value ? formatDate(value) : ''
  const canGoPrev = viewYear > minYear || (viewYear === minYear && viewMonth > 1)
  const canGoNext = viewYear < maxYear || (viewYear === maxYear && viewMonth < 12)

  const calendar = open ? (
    <div
      ref={popupRef}
      role="dialog"
      aria-label="Chọn ngày trên lịch"
      style={{
        position: 'fixed',
        top: popupPos.top,
        left: popupPos.left,
        width: popupPos.width,
        zIndex: 9999,
      }}
      className="rounded-lg border border-border bg-card p-3 text-card-foreground shadow-lg"
    >
      <div className="mb-2 flex items-center justify-between gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          disabled={!canGoPrev}
          onClick={() => shiftMonth(-1)}
          aria-label="Tháng trước"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <p className="min-w-0 flex-1 text-center text-sm font-semibold">
          {MONTHS[viewMonth - 1]} {viewYear}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          disabled={!canGoNext}
          onClick={() => shiftMonth(1)}
          aria-label="Tháng sau"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-center">
        {WEEKDAYS.map((label) => (
          <div
            key={label}
            className="py-1 text-[10px] font-semibold uppercase text-muted-foreground"
          >
            {label}
          </div>
        ))}
        {cells.map((day, idx) => {
          if (day == null) {
            return <div key={`empty-${idx}`} />
          }
          const inRange = isDateInRange(viewYear, viewMonth, day, minYear, maxYear)
          const isSelected =
            selected?.year === viewYear &&
            selected?.month === viewMonth &&
            selected?.day === day
          const isToday =
            today.getFullYear() === viewYear &&
            today.getMonth() + 1 === viewMonth &&
            today.getDate() === day

          return (
            <button
              key={`${viewYear}-${viewMonth}-${day}`}
              type="button"
              disabled={!inRange}
              onClick={() => pickDay(day)}
              className={cn(
                'h-8 rounded-md text-sm tabular-nums transition',
                inRange ? 'hover:bg-primary/10' : 'cursor-not-allowed text-muted-foreground/40',
                isSelected &&
                  'bg-primary font-semibold text-primary-foreground hover:bg-primary',
                !isSelected && isToday && 'font-semibold text-primary ring-1 ring-primary/40',
              )}
            >
              {day}
            </button>
          )
        })}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-border pt-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={setToday}
        >
          Hôm nay
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground"
          onClick={() => {
            onChange('')
            setOpen(false)
          }}
        >
          Xóa ngày
        </Button>
      </div>
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
          !display && 'text-muted-foreground',
        )}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={display ? `Ngày đã chọn: ${display}` : 'Chọn ngày'}
      >
        <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">{display || 'Chọn ngày'}</span>
      </button>

      {calendar ? createPortal(calendar, document.body) : null}
    </div>
  )
}
