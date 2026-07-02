import { buildIncidentTimelineEvents } from '@/lib/reworkUtils'
import type { IncidentRecord } from '@/types/incident'

function formatDisplayDate(isoOrDmy: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoOrDmy)) {
    const [y, m, d] = isoOrDmy.split('-')
    return `${d}/${m}/${y}`
  }
  return isoOrDmy
}

export function IncidentFullTimeline({ incident }: { incident: IncidentRecord }) {
  const events = buildIncidentTimelineEvents(incident)
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">Chưa có lịch sử.</p>
  }

  return (
    <ol className="relative space-y-4 border-l-2 border-primary/30 pl-6">
      {events.map((ev) => (
        <li key={ev.key} className="relative">
          <span className="absolute -left-[1.65rem] top-1.5 h-3 w-3 rounded-full bg-primary" />
          <p className="text-sm font-semibold">{formatDisplayDate(ev.at)}</p>
          <p className="text-sm">{ev.title}</p>
          {ev.lines.map((line) => (
            <p key={line} className="text-sm text-muted-foreground">
              {line}
            </p>
          ))}
          {ev.by ? <p className="text-xs text-muted-foreground">{ev.by}</p> : null}
        </li>
      ))}
    </ol>
  )
}
