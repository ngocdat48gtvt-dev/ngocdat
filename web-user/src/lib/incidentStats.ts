import type { IncidentRecord } from '@/types/incident'
import {
  computeVolumeM3,
  dispatchFilterStatus,
  isCompletedToday,
} from '@/lib/incidentUtils'
import { matchesCompletedDateRange, matchesDateRange } from '@/lib/incidentFilters'
import type { DispatchFilters } from '@/types/incident'

export function formatVolumeM3Display(value: number): string {
  if (value <= 0) return '0'
  return value.toLocaleString('vi-VN', { maximumFractionDigits: 1 })
}

export interface DispatchSummary {
  total: number
  volumeM3: number
  newCount: number
  partialCount: number
  doneCount: number
  completedTodayCount: number
  completedTodayVolumeM3: number
}

export interface RoadSummary {
  road: string
  total: number
  volumeM3: number
  newCount: number
  partialCount: number
  doneCount: number
}

export function applyDispatchFilters(
  items: IncidentRecord[],
  filters: DispatchFilters,
): IncidentRecord[] {
  return items.filter((inc) => {
    if (filters.road && inc.road !== filters.road) return false
    if (filters.groupName && inc.groupName !== filters.groupName) return false
    if (filters.type && inc.type !== filters.type) return false
    if (filters.ownerUid && inc.ownerUid !== filters.ownerUid) return false

    if (filters.status) {
      if (dispatchFilterStatus(inc) !== filters.status) return false
      if (filters.status === 'DONE') {
        return matchesCompletedDateRange(inc, filters.dateFrom, filters.dateTo)
      }
    }

    return matchesDateRange(inc, filters.dateFrom, filters.dateTo)
  })
}

export function computeDispatchSummary(items: IncidentRecord[]): DispatchSummary {
  let volumeM3 = 0
  let newCount = 0
  let partialCount = 0
  let doneCount = 0
  let completedTodayCount = 0
  let completedTodayVolumeM3 = 0
  for (const inc of items) {
    const vol = computeVolumeM3(inc)
    volumeM3 += vol
    const s = dispatchFilterStatus(inc)
    if (s === 'DONE') doneCount++
    else if (s === 'PARTIAL') partialCount++
    else newCount++
    if (isCompletedToday(inc)) {
      completedTodayCount++
      completedTodayVolumeM3 += vol
    }
  }
  return {
    total: items.length,
    volumeM3,
    newCount,
    partialCount,
    doneCount,
    completedTodayCount,
    completedTodayVolumeM3,
  }
}

export function computeRoadSummaries(items: IncidentRecord[]): RoadSummary[] {
  const map = new Map<string, RoadSummary>()
  for (const inc of items) {
    const road = inc.road?.trim() || '—'
    const row = map.get(road) ?? {
      road,
      total: 0,
      volumeM3: 0,
      newCount: 0,
      partialCount: 0,
      doneCount: 0,
    }
    row.total++
    row.volumeM3 += computeVolumeM3(inc)
    const s = dispatchFilterStatus(inc)
    if (s === 'DONE') row.doneCount++
    else if (s === 'PARTIAL') row.partialCount++
    else row.newCount++
    map.set(road, row)
  }
  return [...map.values()].sort((a, b) => a.road.localeCompare(b.road, 'vi'))
}
