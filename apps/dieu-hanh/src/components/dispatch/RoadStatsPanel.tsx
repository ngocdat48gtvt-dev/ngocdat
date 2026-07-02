import { Card } from '@/components/ui/primitives'
import type { RoadSummary } from '@/lib/incidentStats'
import { VolumeByUnitText } from './VolumeByUnitText'

export function RoadStatsPanel({ roads }: { roads: RoadSummary[] }) {
  if (roads.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Chưa có dữ liệu theo tuyến.</p>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {roads.map((r) => (
        <Card key={r.road} className="space-y-1 p-4 text-sm">
            <p className="text-base font-bold">{r.road}</p>
            <p>
              <span className="text-muted-foreground">Tổng sự cố:</span> {r.total}
            </p>
            <p>
              <span className="text-muted-foreground">Tổng khối lượng:</span>{' '}
              <VolumeByUnitText totals={r.volumeByUnit} />
            </p>
            <p>
              <span className="text-muted-foreground">Chưa xử lý:</span> {r.newCount}
              {' · '}
              <span className="text-muted-foreground">Đang xử lý:</span> {r.partialCount}
              {' · '}
              <span className="text-muted-foreground">Hoàn thành:</span> {r.doneCount}
            </p>
        </Card>
      ))}
    </div>
  )
}
