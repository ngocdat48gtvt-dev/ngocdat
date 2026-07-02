import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/primitives'
import { useAuth } from '@/hooks/useAuth'
import { fetchMasterData } from '@/services/masterDataService'
import { createIncidentRecord } from '@/services/incidentsService'
import { uploadAndAttachPhotos, type PhotoKind } from '@/services/incidentImageService'
import {
  clampProgress,
  isBaoLuGroup,
  resolveCompletedDate,
  todayViDateString,
} from '@/lib/incidentUtils'
import { formatKmDisplay } from '@/lib/kmUtils'

type RowPhoto = { file: File; url: string }

type Row = {
  id: string
  road: string
  km: string
  groupName: string
  type: string
  position: string
  date: string
  dai: string
  rong: string
  cao: string
  unit: string
  /** % đất (0..100); '' = chưa nhập. Đá = 100 - đất. Chỉ dùng cho nhóm Bão lũ. */
  soil: string
  progress: number
  completedDate: string
  note: string
  before: RowPhoto[]
  after: RowPhoto[]
}

/** Khối lượng theo kích thước — khớp computeKhoiLuong (dài×rộng×cao → dài×rộng → dài). */
function rowVolume(r: Row): number {
  const d = Number(r.dai) || 0
  const w = Number(r.rong) || 0
  const h = Number(r.cao) || 0
  if (d > 0 && w > 0 && h > 0) return d * w * h
  if (d > 0 && w > 0) return d * w
  if (d > 0) return d
  return 0
}

function fmtNum(n: number): string {
  if (!n) return ''
  return Number(n.toFixed(2)).toString()
}

function clampPercent(v: number): number {
  if (Number.isNaN(v)) return 0
  return Math.max(0, Math.min(100, Math.round(v)))
}

type Props = {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

const DEFAULT_ROW_COUNT = 5

type ColKey =
  | 'idx'
  | 'road'
  | 'km'
  | 'group'
  | 'type'
  | 'pos'
  | 'date'
  | 'dai'
  | 'rong'
  | 'cao'
  | 'unit'
  | 'vol'
  | 'soil'
  | 'rock'
  | 'prog'
  | 'done'
  | 'note'
  | 'before'
  | 'after'
  | 'del'

type ColMeta = {
  key: ColKey
  label: string
  def: number
  min: number
  fixed?: boolean
  select?: boolean
  photo?: boolean
}

/** Metadata cột — bảng cố định, cuộn ngang khi vượt khung; bề rộng chỉnh + lưu được. */
const COLS: ColMeta[] = [
  { key: 'idx', label: '#', def: 30, min: 28, fixed: true },
  { key: 'road', label: 'Tuyến', def: 92, min: 60, select: true },
  { key: 'km', label: 'Lý trình', def: 82, min: 60 },
  { key: 'group', label: 'Nhóm', def: 104, min: 70, select: true },
  { key: 'type', label: 'Loại sự cố', def: 132, min: 80, select: true },
  { key: 'pos', label: 'Phía', def: 42, min: 36 },
  { key: 'date', label: 'Ngày xảy ra', def: 90, min: 78 },
  { key: 'dai', label: 'Dài', def: 46, min: 40 },
  { key: 'rong', label: 'Rộng', def: 46, min: 40 },
  { key: 'cao', label: 'Cao', def: 46, min: 40 },
  { key: 'unit', label: 'ĐV', def: 44, min: 38 },
  { key: 'vol', label: 'Khối lượng', def: 68, min: 56 },
  { key: 'soil', label: '% Đất', def: 50, min: 44 },
  { key: 'rock', label: '% Đá', def: 50, min: 44 },
  { key: 'prog', label: 'TĐ %', def: 44, min: 40 },
  { key: 'done', label: 'Ngày HT', def: 90, min: 78 },
  { key: 'note', label: 'Ghi chú', def: 130, min: 80 },
  { key: 'before', label: 'Ảnh hiện trạng', def: 108, min: 80, photo: true },
  { key: 'after', label: 'Ảnh xử lý', def: 108, min: 80, photo: true },
  { key: 'del', label: '', def: 34, min: 30, fixed: true },
]

const COLW_STORAGE_KEY = 'dieuhanh.incidentCreate.colW.v1'
const DEFAULT_COL_W = COLS.map((c) => c.def)

function loadColW(): number[] {
  try {
    const raw = localStorage.getItem(COLW_STORAGE_KEY)
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr) && arr.length === COLS.length) {
        return arr.map((n, i) => Math.max(COLS[i].min, Number(n) || COLS[i].def))
      }
    }
  } catch {
    /* bỏ qua */
  }
  return [...DEFAULT_COL_W]
}

function saveColW(w: number[]) {
  try {
    localStorage.setItem(COLW_STORAGE_KEY, JSON.stringify(w))
  } catch {
    /* bỏ qua */
  }
}

/** Ô nhập kiểu Excel: không viền riêng, lấp đầy ô, chỉ hiện khung khi focus. */
const cellCls =
  'block h-8 w-full border-0 bg-transparent px-1.5 text-xs outline-none focus:bg-background focus:ring-2 focus:ring-inset focus:ring-primary disabled:cursor-not-allowed disabled:bg-muted/40'

function makeRow(): Row {
  return {
    id: crypto.randomUUID(),
    road: '',
    km: '',
    groupName: '',
    type: '',
    position: '',
    date: todayViDateString(),
    dai: '',
    rong: '',
    cao: '',
    unit: 'm3',
    soil: '',
    progress: 0,
    completedDate: '',
    note: '',
    before: [],
    after: [],
  }
}

function makeRows(n: number): Row[] {
  return Array.from({ length: n }, () => makeRow())
}

function revokeRow(row: Row) {
  row.before.forEach((p) => URL.revokeObjectURL(p.url))
  row.after.forEach((p) => URL.revokeObjectURL(p.url))
}

function isRowFilled(r: Row): boolean {
  return Boolean(r.road.trim() && r.type.trim() && r.km.trim())
}

export function IncidentCreateDialog({ open, onClose, onCreated }: Props) {
  const { user, profile, isCompanyAdmin, catalogOwnerUid } = useAuth()
  const [saving, setSaving] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [roads, setRoads] = useState<string[]>([])
  const [groups, setGroups] = useState<string[]>([])
  const [typesByGroup, setTypesByGroup] = useState<Record<string, string[]>>({})
  const [rows, setRows] = useState<Row[]>(() => makeRows(DEFAULT_ROW_COUNT))
  const [colW, setColW] = useState<number[]>(() => loadColW())
  const resizing = useRef<{ i: number; startX: number; startW: number } | null>(null)

  const tableW = colW.reduce((a, b) => a + b, 0)

  useEffect(() => {
    saveColW(colW)
  }, [colW])

  useEffect(() => {
    if (!open) return
    setRows((prev) => {
      prev.forEach(revokeRow)
      return makeRows(DEFAULT_ROW_COUNT)
    })
    setStatusMsg('')
  }, [open])

  function startResize(e: React.PointerEvent, i: number) {
    e.preventDefault()
    e.stopPropagation()
    resizing.current = { i, startX: e.clientX, startW: colW[i] }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function moveResize(e: React.PointerEvent) {
    const st = resizing.current
    if (!st) return
    const next = colW.slice()
    next[st.i] = Math.max(COLS[st.i].min, Math.round(st.startW + (e.clientX - st.startX)))
    setColW(next)
  }

  function endResize(e: React.PointerEvent) {
    if (!resizing.current) return
    resizing.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
  }

  function cellText(key: ColKey, r: Row): string {
    switch (key) {
      case 'road':
        return r.road
      case 'km':
        return r.km
      case 'group':
        return r.groupName
      case 'type':
        return r.type
      case 'pos':
        return r.position
      case 'date':
        return r.date
      case 'dai':
        return r.dai
      case 'rong':
        return r.rong
      case 'cao':
        return r.cao
      case 'unit':
        return r.unit
      case 'vol':
        return fmtNum(rowVolume(r))
      case 'soil':
        return r.soil
      case 'rock':
        return r.soil.trim() === '' ? '' : String(100 - Number(r.soil))
      case 'prog':
        return String(r.progress)
      case 'done':
        return r.completedDate
      case 'note':
        return r.note
      default:
        return ''
    }
  }

  function autofitColumns() {
    const ctx = document.createElement('canvas').getContext('2d')
    if (!ctx) return
    ctx.font = '12px ui-sans-serif, system-ui, -apple-system, sans-serif'
    const measure = (s: string) => ctx.measureText(s || '').width
    const next = COLS.map((c) => {
      if (c.fixed) return c.def
      if (c.photo) {
        const maxImgs = rows.reduce(
          (m, r) => Math.max(m, c.key === 'before' ? r.before.length : r.after.length),
          0,
        )
        return Math.max(c.def, Math.min(260, 52 + Math.min(maxImgs, 4) * 46))
      }
      let max = measure(c.label)
      for (const r of rows) {
        const w = measure(cellText(c.key, r))
        if (w > max) max = w
      }
      const extra = c.select ? 32 : 18
      const cap = c.key === 'note' ? 340 : 240
      return Math.round(Math.max(c.min, Math.min(cap, max + extra)))
    })
    setColW(next)
  }

  function resetColumns() {
    setColW([...DEFAULT_COL_W])
  }

  useEffect(() => {
    if (!open || !catalogOwnerUid) return
    ;(async () => {
      try {
        const md = await fetchMasterData(catalogOwnerUid)
        setRoads(md.roads)
        setGroups(md.groups)
        setTypesByGroup(md.typesByGroup ?? {})
      } catch {
        /* danh mục tùy chọn */
      }
    })()
  }, [open, catalogOwnerUid])

  function updateRow(id: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  function setSoilPct(id: string, value: string) {
    if (value.trim() === '') {
      updateRow(id, { soil: '' })
      return
    }
    updateRow(id, { soil: String(clampPercent(Number(value))) })
  }

  function setRockPct(id: string, value: string) {
    if (value.trim() === '') {
      updateRow(id, { soil: '' })
      return
    }
    updateRow(id, { soil: String(100 - clampPercent(Number(value))) })
  }

  function addRows(n: number) {
    setRows((prev) => [...prev, ...makeRows(n)])
  }

  function removeRow(id: string) {
    setRows((prev) => {
      const target = prev.find((r) => r.id === id)
      if (target) revokeRow(target)
      const next = prev.filter((r) => r.id !== id)
      return next.length > 0 ? next : makeRows(1)
    })
  }

  function addPhotos(id: string, kind: PhotoKind, list: FileList | null) {
    if (!list) return
    const items = Array.from(list)
      .filter((f) => f.type.startsWith('image/'))
      .map((file) => ({ file, url: URL.createObjectURL(file) }))
    if (items.length === 0) return
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r
        return kind === 'before'
          ? { ...r, before: [...r.before, ...items] }
          : { ...r, after: [...r.after, ...items] }
      }),
    )
  }

  function removePhoto(id: string, kind: PhotoKind, index: number) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r
        const arr = kind === 'before' ? r.before : r.after
        const target = arr[index]
        if (target) URL.revokeObjectURL(target.url)
        const next = arr.filter((_, i) => i !== index)
        return kind === 'before' ? { ...r, before: next } : { ...r, after: next }
      }),
    )
  }

  if (!isCompanyAdmin) {
    return (
      <Dialog open={open} onClose={onClose} title="Thêm sự cố" className="sm:max-w-xl">
        <p className="text-sm text-muted-foreground">
          Chỉ tài khoản <strong>ADMIN</strong> (lãnh đạo) mới được thêm sự cố trên web.
        </p>
        <Button type="button" className="mt-4 w-full" variant="outline" onClick={onClose}>
          Đóng
        </Button>
      </Dialog>
    )
  }

  async function handleCreate() {
    if (!user?.uid) {
      toast.error('Chưa đăng nhập')
      return
    }
    const valid = rows.filter(isRowFilled)
    if (valid.length === 0) {
      toast.error('Cần ít nhất 1 dòng có Tuyến, Lý trình và Loại sự cố')
      return
    }
    const uid = user.uid
    const createdByName = profile?.displayName?.trim() || user.email?.trim() || 'Admin'
    const companyId = profile?.companyId?.trim() || ''
    setSaving(true)
    try {
      for (let i = 0; i < valid.length; i++) {
        const r = valid[i]
        setStatusMsg(`Đang lưu sự cố ${i + 1}/${valid.length}…`)
        const p = clampProgress(Number(r.progress))
        const soilPercent =
          isBaoLuGroup(r.groupName) && r.soil.trim() !== ''
            ? clampPercent(Number(r.soil))
            : -1
        const newId = await createIncidentRecord(uid, {
          road: r.road,
          groupName: r.groupName,
          type: r.type,
          km: formatKmDisplay(r.km),
          position: r.position,
          date: r.date,
          completedDate: resolveCompletedDate(p, r.completedDate),
          dai: Number(r.dai) || 0,
          rong: Number(r.rong) || 0,
          cao: Number(r.cao) || 0,
          unit: r.unit,
          soilPercent,
          progress: p,
          note: r.note,
          createdByName,
          companyId,
        })

        const uploadKind = async (kind: PhotoKind, items: RowPhoto[]) => {
          if (items.length === 0) return
          setStatusMsg(
            `Đang tải ảnh sự cố ${i + 1}/${valid.length} (${
              kind === 'before' ? 'hiện trạng' : 'xử lý'
            })…`,
          )
          await uploadAndAttachPhotos({
            uploaderUid: uid,
            ownerUid: uid,
            docId: newId,
            incidentId: newId,
            kind,
            files: items.map((it) => it.file),
          })
        }
        await uploadKind('before', r.before)
        await uploadKind('after', r.after)
      }

      toast.success(`Đã thêm ${valid.length} sự cố mới`)
      onCreated()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Thêm sự cố thất bại')
    } finally {
      setSaving(false)
      setStatusMsg('')
    }
  }

  function renderPhotoCell(r: Row, kind: PhotoKind) {
    const items = kind === 'before' ? r.before : r.after
    return (
      <div className="flex flex-wrap items-center gap-1">
        {items.map((it, idx) => (
          <div key={it.url} className="relative">
            <img
              src={it.url}
              alt=""
              className="h-10 w-10 rounded border border-border object-cover"
            />
            {!saving ? (
              <button
                type="button"
                onClick={() => removePhoto(r.id, kind, idx)}
                className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] leading-none text-white shadow"
                aria-label="Xoá ảnh"
              >
                ✕
              </button>
            ) : null}
          </div>
        ))}
        <label
          className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded border border-dashed border-border text-base text-muted-foreground transition hover:bg-muted ${
            saving ? 'pointer-events-none opacity-50' : ''
          }`}
          title="Thêm ảnh"
        >
          +
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={saving}
            onChange={(e) => {
              addPhotos(r.id, kind, e.target.files)
              e.target.value = ''
            }}
          />
        </label>
      </div>
    )
  }

  const filledCount = rows.filter(isRowFilled).length

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Thêm sự cố mới"
      className="w-auto sm:max-w-[96vw]"
      draggable
      style={{ width: tableW + 42, maxWidth: '96vw' }}
    >
      <div className="space-y-3 text-sm">
        <p className="text-xs text-muted-foreground">
          Nhập nhiều sự cố cùng lúc — mỗi dòng là một sự cố. Cần điền tối thiểu Tuyến, Lý
          trình và Loại sự cố. Khối lượng tự tính theo Dài×Rộng×Cao. Cột % Đất/Đá chỉ áp
          dụng nhóm <strong>Bão lũ</strong> (nhập 1 ô, ô còn lại tự bù cho đủ 100). Mỗi ô
          ảnh chứa được nhiều ảnh.
        </p>

        <div className="max-h-[62vh] overflow-auto rounded-lg border-2 border-primary/70">
          <table
            className="table-fixed border-separate border-spacing-0 text-xs [&_td]:border-b [&_td]:border-r [&_td]:border-border [&_th]:border-b [&_th]:border-r [&_th]:border-primary/40"
            style={{ width: tableW }}
          >
            <colgroup>
              {colW.map((w, i) => (
                <col key={i} style={{ width: w }} />
              ))}
            </colgroup>
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#e8eefc] text-center text-[11px] leading-tight text-slate-700">
                {COLS.map((c, i) => (
                  <th key={c.key} className="relative px-1 py-1.5 font-semibold">
                    <span className="block truncate">{c.label}</span>
                    {!c.fixed ? (
                      <span
                        onPointerDown={(e) => startResize(e, i)}
                        onPointerMove={moveResize}
                        onPointerUp={endResize}
                        className="absolute -right-px top-0 z-10 h-full w-2 cursor-col-resize touch-none hover:bg-primary/40"
                        title="Kéo để chỉnh bề rộng cột"
                      />
                    ) : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => {
                const rowTypes = typesByGroup[r.groupName] ?? []
                const baoLu = isBaoLuGroup(r.groupName)
                const vol = rowVolume(r)
                const rockText = r.soil.trim() === '' ? '' : String(100 - Number(r.soil))
                return (
                  <tr key={r.id} className="align-top odd:bg-background even:bg-muted/20">
                    <td className="px-1 py-1 text-center text-muted-foreground">{idx + 1}</td>
                    <td className="w-24 p-0">
                      {roads.length > 0 ? (
                        <select
                          className={cellCls}
                          value={r.road}
                          disabled={saving}
                          onChange={(e) => updateRow(r.id, { road: e.target.value })}
                        >
                          <option value="">—</option>
                          {roads.map((x) => (
                            <option key={x} value={x}>
                              {x}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          className={cellCls}
                          value={r.road}
                          disabled={saving}
                          onChange={(e) => updateRow(r.id, { road: e.target.value })}
                        />
                      )}
                    </td>
                    <td className="w-24 p-0">
                      <input
                        className={`${cellCls} font-mono`}
                        value={r.km}
                        placeholder="8+995"
                        disabled={saving}
                        onChange={(e) => updateRow(r.id, { km: e.target.value })}
                        onBlur={(e) => {
                          const formatted = formatKmDisplay(e.target.value)
                          if (formatted && formatted !== r.km) {
                            updateRow(r.id, { km: formatted })
                          }
                        }}
                      />
                    </td>
                    <td className="min-w-[120px] p-0">
                      {groups.length > 0 ? (
                        <select
                          className={cellCls}
                          value={r.groupName}
                          disabled={saving}
                          onChange={(e) =>
                            updateRow(r.id, { groupName: e.target.value, type: '' })
                          }
                        >
                          <option value="">—</option>
                          {groups.map((x) => (
                            <option key={x} value={x}>
                              {x}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          className={cellCls}
                          value={r.groupName}
                          disabled={saving}
                          onChange={(e) => updateRow(r.id, { groupName: e.target.value })}
                        />
                      )}
                    </td>
                    <td className="min-w-[150px] p-0">
                      {rowTypes.length > 0 ? (
                        <select
                          className={cellCls}
                          value={r.type}
                          disabled={saving}
                          onChange={(e) => updateRow(r.id, { type: e.target.value })}
                        >
                          <option value="">—</option>
                          {rowTypes.map((x) => (
                            <option key={x} value={x}>
                              {x}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          className={cellCls}
                          value={r.type}
                          disabled={saving}
                          onChange={(e) => updateRow(r.id, { type: e.target.value })}
                        />
                      )}
                    </td>
                    <td className="w-14 p-0">
                      <input
                        className={cellCls}
                        value={r.position}
                        disabled={saving}
                        onChange={(e) => updateRow(r.id, { position: e.target.value })}
                      />
                    </td>
                    <td className="w-24 p-0">
                      <input
                        className={cellCls}
                        value={r.date}
                        placeholder="dd/MM/yyyy"
                        disabled={saving}
                        onChange={(e) => updateRow(r.id, { date: e.target.value })}
                      />
                    </td>
                    <td className="w-16 p-0">
                      <input
                        className={`${cellCls} text-right`}
                        type="number"
                        value={r.dai}
                        disabled={saving}
                        onChange={(e) => updateRow(r.id, { dai: e.target.value })}
                      />
                    </td>
                    <td className="w-16 p-0">
                      <input
                        className={`${cellCls} text-right`}
                        type="number"
                        value={r.rong}
                        disabled={saving}
                        onChange={(e) => updateRow(r.id, { rong: e.target.value })}
                      />
                    </td>
                    <td className="w-16 p-0">
                      <input
                        className={`${cellCls} text-right`}
                        type="number"
                        value={r.cao}
                        disabled={saving}
                        onChange={(e) => updateRow(r.id, { cao: e.target.value })}
                      />
                    </td>
                    <td className="w-16 p-0">
                      <input
                        className={cellCls}
                        value={r.unit}
                        disabled={saving}
                        onChange={(e) => updateRow(r.id, { unit: e.target.value })}
                      />
                    </td>
                    <td className="w-20 bg-slate-50 px-2 py-1 text-right font-medium tabular-nums text-slate-700">
                      {fmtNum(vol)}
                    </td>
                    <td className="w-16 p-0">
                      <input
                        className={`${cellCls} text-right ${baoLu ? '' : 'opacity-50'}`}
                        type="number"
                        min={0}
                        max={100}
                        value={r.soil}
                        placeholder={baoLu ? '0' : ''}
                        disabled={saving || !baoLu}
                        title={baoLu ? '% đất (đá tự bù = 100 - đất)' : 'Chỉ áp dụng nhóm Bão lũ'}
                        onChange={(e) => setSoilPct(r.id, e.target.value)}
                      />
                    </td>
                    <td className="w-16 p-0">
                      <input
                        className={`${cellCls} text-right ${baoLu ? '' : 'opacity-50'}`}
                        type="number"
                        min={0}
                        max={100}
                        value={rockText}
                        placeholder={baoLu ? '0' : ''}
                        disabled={saving || !baoLu}
                        title={baoLu ? '% đá (đất tự bù = 100 - đá)' : 'Chỉ áp dụng nhóm Bão lũ'}
                        onChange={(e) => setRockPct(r.id, e.target.value)}
                      />
                    </td>
                    <td className="w-16 p-0">
                      <input
                        className={`${cellCls} text-right`}
                        type="number"
                        min={0}
                        max={100}
                        value={r.progress}
                        disabled={saving}
                        onChange={(e) => {
                          const p = clampProgress(Number(e.target.value))
                          updateRow(r.id, {
                            progress: p,
                            completedDate: resolveCompletedDate(p, r.completedDate),
                          })
                        }}
                      />
                    </td>
                    <td className="w-24 p-0">
                      <input
                        className={cellCls}
                        value={r.completedDate}
                        placeholder="dd/MM/yyyy"
                        disabled={saving}
                        onChange={(e) => updateRow(r.id, { completedDate: e.target.value })}
                      />
                    </td>
                    <td className="min-w-[150px] p-0">
                      <input
                        className={cellCls}
                        value={r.note}
                        disabled={saving}
                        onChange={(e) => updateRow(r.id, { note: e.target.value })}
                      />
                    </td>
                    <td className="min-w-[160px] px-1 py-1">
                      {renderPhotoCell(r, 'before')}
                    </td>
                    <td className="min-w-[160px] px-1 py-1">
                      {renderPhotoCell(r, 'after')}
                    </td>
                    <td className="px-1 py-1 text-center">
                      <button
                        type="button"
                        onClick={() => removeRow(r.id)}
                        disabled={saving}
                        className="flex h-7 w-7 items-center justify-center rounded text-destructive transition hover:bg-destructive/10 disabled:opacity-40"
                        aria-label="Xoá dòng"
                        title="Xoá dòng"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => addRows(1)}>
            + Thêm dòng
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => addRows(5)}>
            + 5 dòng
          </Button>
          <span className="mx-1 h-5 w-px bg-border" />
          <Button type="button" variant="outline" size="sm" disabled={saving} onClick={autofitColumns}>
            Tự động giãn cột
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={resetColumns}>
            Khôi phục cột
          </Button>
          <span className="text-xs text-muted-foreground">
            {filledCount > 0 ? `${filledCount} dòng hợp lệ` : 'Chưa có dòng hợp lệ'}
          </span>
          {statusMsg ? <span className="text-xs text-primary">{statusMsg}</span> : null}
        </div>

        <div className="flex gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" className="flex-1" disabled={saving} onClick={onClose}>
            Hủy
          </Button>
          <Button
            type="button"
            className="flex-1"
            disabled={saving}
            onClick={() => void handleCreate()}
          >
            {saving ? 'Đang lưu…' : `Thêm ${filledCount > 0 ? filledCount : ''} sự cố`.trim()}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
