import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/firebase/firebase'
import type { MasterDataBundle } from '@/types/incident'

const DEFAULT_ROADS = ['QL37']
const DEFAULT_GROUPS = ['Bão lũ', 'ATGT', 'Hư hỏng mặt đường']
const DEFAULT_TYPES: Record<string, string[]> = {
  'Bão lũ': [
    'Sụt dương',
    'Sa bồi rãnh xây',
    'Sa bồi rãnh đất',
    'Sa bồi lề mặt đường',
    'Sụt âm',
    'Sa bồi cống',
    'Sa bồi hố thu nước',
  ],
  ATGT: ['Biển báo', 'Cột tiêu', 'Cột H', 'Cột Km', 'Hộ lan'],
  'Hư hỏng mặt đường': ['Ổ gà', 'Hư hỏng lớp móng mặt đường', 'Hư hỏng mặt đường'],
}

const EMPTY: MasterDataBundle = { roads: [], groups: [], typesByGroup: {} }

function mergeDefaults(remote: MasterDataBundle): MasterDataBundle {
  const roads = remote.roads.length ? remote.roads : [...DEFAULT_ROADS]
  const groups = remote.groups.length ? remote.groups : [...DEFAULT_GROUPS]
  const typesByGroup = { ...DEFAULT_TYPES, ...remote.typesByGroup }
  for (const g of groups) {
    if (!typesByGroup[g]?.length) {
      typesByGroup[g] = DEFAULT_TYPES[g] ?? ['Khác']
    }
  }
  return { roads, groups, typesByGroup }
}

/** Chỉ đọc danh mục — không ghi (khớp USER công ty trên app). */
export async function fetchMasterData(ownerUid: string): Promise<MasterDataBundle> {
  if (!ownerUid) return mergeDefaults(EMPTY)

  const [roadsSnap, groupsSnap, typesSnap] = await Promise.all([
    getDoc(doc(db, 'users', ownerUid, 'master_data', 'roads')),
    getDoc(doc(db, 'users', ownerUid, 'master_data', 'groups')),
    getDoc(doc(db, 'users', ownerUid, 'master_data', 'types')),
  ])

  return mergeDefaults({
    roads: (roadsSnap.data()?.list as string[] | undefined) ?? [],
    groups: (groupsSnap.data()?.list as string[] | undefined) ?? [],
    typesByGroup: (typesSnap.data()?.map as Record<string, string[]> | undefined) ?? {},
  })
}
