import type { MasterDataBundle } from '@/types/incident'

export function linesFromText(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function mergeUniqueLines(existing: string[], added: string[]): string[] {
  const out = [...existing]
  for (const line of added) {
    const t = line.trim()
    if (!t) continue
    if (!out.some((x) => x.localeCompare(t, 'vi', { sensitivity: 'accent' }) === 0)) {
      out.push(t)
    }
  }
  return out
}

export function syncTypesByGroups(
  groups: string[],
  typesByGroup: Record<string, string[]>,
): Record<string, string[]> {
  const next: Record<string, string[]> = {}
  for (const g of groups) {
    next[g] = typesByGroup[g] ?? []
  }
  return next
}

export function countTypes(typesByGroup: Record<string, string[]>): number {
  return Object.values(typesByGroup).reduce((n, list) => n + list.length, 0)
}

/** Mẫu thường dùng — khớp app Android MasterDataLocal. */
export const CATALOG_PRESETS: { label: string; bundle: Partial<MasterDataBundle> }[] = [
  {
    label: 'Bão lũ (7 loại)',
    bundle: {
      groups: ['Bão lũ'],
      typesByGroup: {
        'Bão lũ': [
          'Sụt dương',
          'Sa bồi rãnh xây',
          'Sa bồi rãnh đất',
          'Sa bồi lề mặt đường',
          'Sụt âm',
          'Sa bồi cống',
          'Sa bồi hố thu nước',
        ],
      },
    },
  },
  {
    label: 'ATGT (5 loại)',
    bundle: {
      groups: ['ATGT'],
      typesByGroup: {
        ATGT: ['Biển báo', 'Cột tiêu', 'Cột H', 'Cột Km', 'Hộ lan'],
      },
    },
  },
  {
    label: 'Hư hỏng mặt đường',
    bundle: {
      groups: ['Hư hỏng mặt đường'],
      typesByGroup: {
        'Hư hỏng mặt đường': [
          'Ổ gà',
          'Hư hỏng lớp móng mặt đường',
          'Hư hỏng mặt đường',
        ],
      },
    },
  },
]

export function applyPreset(
  current: MasterDataBundle,
  preset: Partial<MasterDataBundle>,
): MasterDataBundle {
  const roads = current.roads
  const groups = mergeUniqueLines(current.groups, preset.groups ?? [])
  let typesByGroup = { ...current.typesByGroup }
  for (const [g, types] of Object.entries(preset.typesByGroup ?? {})) {
    typesByGroup[g] = mergeUniqueLines(typesByGroup[g] ?? [], types)
  }
  typesByGroup = syncTypesByGroups(groups, typesByGroup)
  return { roads, groups, typesByGroup }
}
