import type { IncidentRecord } from '@/types/incident'

function computeIncidentVolume(inc: IncidentRecord): number {
  const dai = inc.dai ?? 0
  const rong = inc.rong ?? 0
  const cao = inc.cao ?? 0
  if (cao > 0) return dai * rong * cao
  if (rong > 0) return dai * rong
  return dai
}

/** Khớp MainActivity.loadStats — chỉ sự cố có ngày = hôm nay. */
export function buildTodayStatsText(
  items: IncidentRecord[],
  today: string,
): string {
  if (items.length === 0) return 'Chưa có dữ liệu'

  const map = new Map<
    string,
    Map<string, Map<string, { count: number; volume: number; unit: string }>>
  >()

  for (const inc of items) {
    if ((inc.date ?? '').trim() !== today) continue

    const road = (inc.road ?? '').trim()
    const group = (inc.groupName ?? '').trim()
    const type = (inc.type ?? '').trim()
    const unit = inc.unit?.trim() || 'm³'
    const volume = computeIncidentVolume(inc)

    if (!map.has(road)) map.set(road, new Map())
    const groupMap = map.get(road)!
    if (!groupMap.has(group)) groupMap.set(group, new Map())
    const typeMap = groupMap.get(group)!
    const old = typeMap.get(type) ?? { count: 0, volume: 0, unit }
    typeMap.set(type, {
      count: old.count + 1,
      volume: old.volume + volume,
      unit,
    })
  }

  if (map.size === 0) return 'Hôm nay chưa có sự cố'

  const lines: string[] = []
  for (const [road, groupMap] of map) {
    lines.push(`📍 ${road}`)
    for (const [group, typeMap] of groupMap) {
      lines.push(group)
      for (const [type, triple] of typeMap) {
        const vol = triple.volume.toLocaleString('vi-VN', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
        lines.push(`${type} : ${triple.count} vị trí / ${vol} ${triple.unit}`)
      }
    }
  }
  return lines.join('\n')
}
