import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/firebase/firebase'

/** Danh sách tuyến đường trên app hiện trường — lưu theo từng USER. */
export async function fetchUserRoads(uid: string): Promise<string[]> {
  const id = uid.trim()
  if (!id) return []
  const snap = await getDoc(doc(db, 'users', id, 'master_data', 'roads'))
  const list = snap.data()?.list
  if (!Array.isArray(list)) return []
  return list.map((item) => String(item ?? '').trim()).filter(Boolean)
}

export async function saveUserRoads(uid: string, roads: string[]): Promise<void> {
  const id = uid.trim()
  if (!id) throw new Error('Chưa chọn USER')
  const list = roads.map((r) => r.trim()).filter(Boolean)
  await setDoc(doc(db, 'users', id, 'master_data', 'roads'), { list }, { merge: true })
}
