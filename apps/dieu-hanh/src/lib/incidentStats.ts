import type { IncidentRecord } from '@/types/incident'
import {
  computeKhoiLuong,
  dispatchFilterStatus,
  isCompletedToday,
  resolveIncidentUnit,
} from '@/lib/incidentUtils'
import { matchesCompletedDateRange, matchesDateRange } from '@/lib/incidentFilters'
import { matchesChainageSearch } from '@quanlysuco/shared'
import type { DispatchFilters } from '@/types/incident'

export type VolumeByUnit = Record<string, number>

export function formatVolumeValue(value: number): string {
  if (value <= 0) return '0'
  return value.toLocaleString('vi-VN', { maximumFractionDigits: 1 })
}

/** @deprecated Dùng formatVolumeValue */
export function formatVolumeM3Display(value: number): string {
  return formatVolumeValue(value)
}

const UNIT_SORT_ORDER: Record<string, number> = {
  'm³': 0,
  'm²': 1,
  m: 2,
}

export function sortedVolumeEntries(totals: VolumeByUnit): [string, number][] {
  return Object.entries(totals)
    .filter(([, v]) => v > 0)
    .sort((a, b) => {
      const oa = UNIT_SORT_ORDER[a[0]] ?? 99
      const ob = UNIT_SORT_ORDER[b[0]] ?? 99
      if (oa !== ob) return oa - ob
      return a[0].localeCompare(b[0], 'vi')
    })
}

export function formatVolumeByUnitLines(totals: VolumeByUnit): string {
  const entries = sortedVolumeEntries(totals)
  if (entries.length === 0) return '0'
  return entries.map(([unit, val]) => `${formatVolumeValue(val)} ${unit}`).join(' · ')
}

export function addIncidentVolume(totals: VolumeByUnit, inc: IncidentRecord): void {
  const vol = computeKhoiLuong(inc)
  if (vol <= 0) return
  const unit = resolveIncidentUnit(inc)
  if (!unit) return
  totals[unit] = (totals[unit] ?? 0) + vol
}

export interface DispatchSummary {
  total: number
  volumeByUnit: VolumeByUnit
  newCount: number
  partialCount: number
  doneCount: number
  completedTodayCount: number
  completedTodayVolumeByUnit: VolumeByUnit
}

export interface RoadSummary {
  road: string
  total: number
  volumeByUnit: VolumeByUnit
  newCount: number
  partialCount: number
  doneCount: number
}

export function applyDispatchFilters(
  items: IncidentRecord[],
  filters: DispatchFilters,
): IncidentRecord[] {
  return items.filter((inc) => {
    if (filters.roads.length > 0 && !filters.roads.includes(inc.road ?? '')) return false
    if (filters.groupName && inc.groupName !== filters.groupName) return false
    if (filters.types.length > 0 && !filters.types.includes(inc.type ?? '')) return false
    if (filters.ownerUids.length > 0 && !filters.ownerUids.includes(inc.ownerUid)) return false
    if (!matchesChainageSearch(inc.km, filters.chainageQuery)) return false

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
  const volumeByUnit: VolumeByUnit = {}
  const completedTodayVolumeByUnit: VolumeByUnit = {}
  let newCount = 0
  let partialCount = 0
  let doneCount = 0
  let completedTodayCount = 0
  for (const inc of items) {
    addIncidentVolume(volumeByUnit, inc)
    const s = dispatchFilterStatus(inc)
    if (s === 'DONE') doneCount++
    else if (s === 'PARTIAL') partialCount++
    else newCount++
    if (isCompletedToday(inc)) {
      completedTodayCount++
      addIncidentVolume(completedTodayVolumeByUnit, inc)
    }
  }
  return {
    total: items.length,
    volumeByUnit,
    newCount,
    partialCount,
    doneCount,
    completedTodayCount,
    completedTodayVolumeByUnit,
  }
}

export function computeRoadSummaries(items: IncidentRecord[]): RoadSummary[] {
  const map = new Map<string, RoadSummary>()
  for (const inc of items) {
    const road = inc.road?.trim() || '—'
    const row = map.get(road) ?? {
      road,
      total: 0,
      volumeByUnit: {},
      newCount: 0,
      partialCount: 0,
      doneCount: 0,
    }
    row.total++
    addIncidentVolume(row.volumeByUnit, inc)
    const s = dispatchFilterStatus(inc)
    if (s === 'DONE') row.doneCount++
    else if (s === 'PARTIAL') row.partialCount++
    else row.newCount++
    map.set(road, row)
  }
  return [...map.values()].sort((a, b) => a.road.localeCompare(b.road, 'vi'))
}
