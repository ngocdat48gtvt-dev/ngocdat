import type { ReactNode } from 'react'
import { Card } from '@/components/ui/primitives'
import {
  formatVolumeValue,
  sortedVolumeEntries,
  type DispatchSummary,
} from '@/lib/incidentStats'
import { VolumeByUnitText } from './VolumeByUnitText'

export function DispatchStatsCards({ summary }: { summary: DispatchSummary }) {
  const volumeCards = sortedVolumeEntries(summary.volumeByUnit).map(([unit, val]) => ({
    key: `vol-${unit}`,
    label: `Tổng KL (${unit})`,
    value: formatVolumeValue(val),
  }))

  const todayVolumeEntries = sortedVolumeEntries(summary.completedTodayVolumeByUnit)

  const cards: { key: string; label: string; value: ReactNode }[] = [
    { key: 'total', label: 'Tổng sự cố', value: String(summary.total) },
    ...volumeCards,
    { key: 'new', label: 'Chưa xử lý', value: String(summary.newCount) },
    { key: 'partial', label: 'Đang xử lý', value: String(summary.partialCount) },
    { key: 'done', label: 'Hoàn thành', value: String(summary.doneCount) },
    {
      key: 'done-today',
      label: 'Hoàn thành hôm nay (vị trí)',
      value: String(summary.completedTodayCount),
    },
    {
      key: 'vol-done-today',
      label: 'KL hoàn thành hôm nay',
      value:
        todayVolumeEntries.length > 0 ? (
          <VolumeByUnitText totals={summary.completedTodayVolumeByUnit} />
        ) : (
          '0'
        ),
    },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.key} className="p-4">
          <p className="text-xs text-muted-foreground">{c.label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{c.value}</p>
        </Card>
      ))}
    </div>
  )
}
