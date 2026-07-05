import { progressLabel } from '@/lib/incidentUtils'
import type { IncidentUpdate } from '@/types/incident'

function formatDisplayDate(isoOrDmy: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoOrDmy)) {
    const [y, m, d] = isoOrDmy.split('-')
    return `${d}/${m}/${y}`
  }
  return isoOrDmy
}

/** Ghi chú từ app đã có % — không thêm (100%) trùng. */
function formatUpdateLine(u: IncidentUpdate): string {
  const text = u.note?.trim() || progressLabel(u.progress)
  if (u.progress == null) return text
  const p = Math.round(u.progress)
  if (text.includes(`${p}%`)) return text
  return `${text} (${p}%)`
}

export function IncidentTimeline({ updates }: { updates: IncidentUpdate[] }) {
  const list = [...(updates ?? [])].reverse()
  if (list.length === 0) {
    return <p className="text-sm text-muted-foreground">Chưa có lịch sử xử lý.</p>
  }

  return (
    <ol className="relative space-y-4 border-l-2 border-primary/30 pl-6">
      {list.map((u, idx) => (
        <li key={`${u.date}-${idx}`} className="relative">
          <span className="absolute -left-[1.65rem] top-1.5 h-3 w-3 rounded-full bg-primary" />
          <p className="text-sm font-semibold">{formatDisplayDate(u.date)}</p>
          <p className="text-sm">{formatUpdateLine(u)}</p>
          {u.createdBy ? (
            <p className="text-xs text-muted-foreground">{u.createdBy}</p>
          ) : null}
        </li>
      ))}
    </ol>
  )
}
