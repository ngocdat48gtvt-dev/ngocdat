import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'

const MIN_DEFAULT = 36

function loadStored(
  storageKey: string,
  columnIds: readonly string[],
  defaults: Record<string, number>,
  mins: Record<string, number>,
): Record<string, number> {
  const merged = { ...defaults }
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return merged
    const parsed = JSON.parse(raw) as Record<string, unknown>
    for (const id of columnIds) {
      const n = Number(parsed[id])
      if (Number.isFinite(n) && n >= (mins[id] ?? MIN_DEFAULT)) {
        merged[id] = Math.round(n)
      }
    }
  } catch {
    /* ignore */
  }
  return merged
}

export function useResizableTableColumns(
  columnIds: readonly string[],
  defaults: Record<string, number>,
  storageKey: string,
  mins: Partial<Record<string, number>> = {},
) {
  const minsMap = mins as Record<string, number>
  const columnKey = columnIds.join('|')

  const [widths, setWidths] = useState<Record<string, number>>(() =>
    loadStored(storageKey, columnIds, defaults, minsMap),
  )

  const widthsRef = useRef(widths)
  widthsRef.current = widths

  useEffect(() => {
    setWidths(loadStored(storageKey, columnIds, defaults, minsMap))
  }, [storageKey, columnKey])

  const persist = useCallback(
    (snapshot: Record<string, number>) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(snapshot))
      } catch {
        /* ignore */
      }
    },
    [storageKey],
  )

  const startResize = useCallback(
    (colId: string, clientX: number) => {
      const startWidth = widthsRef.current[colId] ?? defaults[colId] ?? 80
      const minW = minsMap[colId] ?? MIN_DEFAULT
      let lastX = clientX

      const onMove = (e: MouseEvent) => {
        const delta = e.clientX - lastX
        lastX = e.clientX
        setWidths((prev) => {
          const next = {
            ...prev,
            [colId]: Math.max(minW, Math.round((prev[colId] ?? startWidth) + delta)),
          }
          widthsRef.current = next
          return next
        })
      }

      const onUp = () => {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        persist(widthsRef.current)
      }

      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [defaults, minsMap, persist],
  )

  const totalWidth = columnIds.reduce(
    (sum, id) => sum + (widths[id] ?? defaults[id] ?? 0),
    0,
  )

  const colStyle = useCallback(
    (id: string): CSSProperties => {
      const w = widths[id] ?? defaults[id] ?? 80
      return { width: w, minWidth: w, maxWidth: w }
    },
    [widths, defaults],
  )

  return { widths, colStyle, totalWidth, startResize }
}
