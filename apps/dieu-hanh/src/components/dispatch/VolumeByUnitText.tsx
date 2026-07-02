import {
  formatVolumeValue,
  sortedVolumeEntries,
  type VolumeByUnit,
} from '@/lib/incidentStats'

export function VolumeByUnitText({
  totals,
  empty = '0',
  className,
}: {
  totals: VolumeByUnit
  empty?: string
  className?: string
}) {
  const entries = sortedVolumeEntries(totals)
  if (entries.length === 0) {
    return <span className={className}>{empty}</span>
  }
  return (
    <span className={className}>
      {entries.map(([unit, val], i) => (
        <span key={unit}>
          {i > 0 ? ' · ' : null}
          <span className="tabular-nums font-semibold">{formatVolumeValue(val)}</span> {unit}
        </span>
      ))}
    </span>
  )
}
