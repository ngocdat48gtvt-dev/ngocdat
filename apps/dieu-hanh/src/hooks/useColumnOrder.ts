import { useCallback, useEffect, useMemo, useState } from 'react'

function loadOrder<T extends string>(
  storageKey: string,
  defaultOrder: readonly T[],
): T[] {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return [...defaultOrder]
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return [...defaultOrder]
    const allowed = new Set<string>(defaultOrder)
    const next: T[] = []
    for (const x of parsed) {
      if (typeof x === 'string' && allowed.has(x) && !next.includes(x as T)) {
        next.push(x as T)
      }
    }
    for (const id of defaultOrder) {
      if (!next.includes(id)) next.push(id)
    }
    return next
  } catch {
    return [...defaultOrder]
  }
}

/**
 * Thứ tự cột có thể kéo thả — lưu localStorage.
 * `pinnedStart` / `pinnedEnd` cố định (vd. checkbox, thao tác).
 */
export function useColumnOrder<T extends string>(
  movableDefaults: readonly T[],
  storageKey: string,
  pinnedStart: readonly T[] = [],
  pinnedEnd: readonly T[] = [],
) {
  const movableKey = movableDefaults.join('|')

  const [movableOrder, setMovableOrder] = useState<T[]>(() =>
    loadOrder(storageKey, movableDefaults),
  )

  useEffect(() => {
    setMovableOrder(loadOrder(storageKey, movableDefaults))
  }, [storageKey, movableKey])

  const persist = useCallback(
    (next: T[]) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(next))
      } catch {
        /* ignore */
      }
    },
    [storageKey],
  )

  const columnIds = useMemo(
    (): T[] => [...pinnedStart, ...movableOrder, ...pinnedEnd],
    [pinnedStart, movableOrder, pinnedEnd],
  )

  const moveColumn = useCallback(
    (fromId: string, toId: string) => {
      if (fromId === toId) return
      if (
        (pinnedStart as readonly string[]).includes(fromId) ||
        (pinnedEnd as readonly string[]).includes(fromId)
      ) {
        return
      }
      if (
        (pinnedStart as readonly string[]).includes(toId) ||
        (pinnedEnd as readonly string[]).includes(toId)
      ) {
        return
      }
      setMovableOrder((prev) => {
        const from = prev.indexOf(fromId as T)
        const to = prev.indexOf(toId as T)
        if (from < 0 || to < 0) return prev
        const next = [...prev]
        const [item] = next.splice(from, 1)
        next.splice(to, 0, item)
        persist(next)
        return next
      })
    },
    [pinnedStart, pinnedEnd, persist],
  )

  return { columnIds, moveColumn }
}
