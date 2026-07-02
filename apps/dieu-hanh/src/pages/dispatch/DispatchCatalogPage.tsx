import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Navigate } from 'react-router-dom'
import {
  BookOpen,
  Layers,
  MapPin,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { PageHeader } from '@/components/common/PageParts'
import { Dialog } from '@/components/ui/dialog'
import { Badge, Button, Card, Label, Textarea } from '@/components/ui/primitives'
import {
  applyPreset,
  CATALOG_PRESETS,
  countTypes,
  linesFromText,
  mergeUniqueLines,
} from '@/lib/catalogHelpers'
import {
  fetchMasterData,
  saveMasterData,
} from '@/services/masterDataService'
import type { MasterDataBundle } from '@/types/incident'
import { useAuth } from '@/hooks/useAuth'

const EMPTY: MasterDataBundle = { roads: [], groups: [], typesByGroup: {}, unitByType: {} }
const UNIT_OPTIONS = ['m', 'm²', 'm³', 'cái', 'cột', 'cây', 'tấm', 'md', 'bộ', 'vị trí']

function toRoman(num: number): string {
  const map: [number, string][] = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ]
  let n = num
  let out = ''
  for (const [v, s] of map) {
    while (n >= v) {
      out += s
      n -= v
    }
  }
  return out || '—'
}

function cleanList(list: string[]): string[] {
  return mergeUniqueLines([], list)
}

function cleanBundle(b: MasterDataBundle): MasterDataBundle {
  const roads = cleanList(b.roads)
  const groups = cleanList(b.groups)
  const typesByGroup: Record<string, string[]> = {}
  const used = new Set<string>()
  for (const g of groups) {
    const types = cleanList(b.typesByGroup[g] ?? [])
    typesByGroup[g] = types
    types.forEach((t) => used.add(t))
  }
  const unitByType: Record<string, string> = {}
  for (const [k, v] of Object.entries(b.unitByType ?? {})) {
    if (used.has(k) && v.trim()) unitByType[k] = v.trim()
  }
  return { roads, groups, typesByGroup, unitByType }
}

export function DispatchCatalogPage() {
  const { isCompanyAdmin, catalogOwnerUid, isCatalogDelegate, loading: authLoading } = useAuth()
  const [bundle, setBundle] = useState<MasterDataBundle>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkGroup, setBulkGroup] = useState('')
  const [bulkText, setBulkText] = useState('')
  const [newGroupName, setNewGroupName] = useState('')
  const [groupFilter, setGroupFilter] = useState('')

  const stats = useMemo(
    () => ({
      roads: bundle.roads.length,
      groups: bundle.groups.length,
      types: countTypes(bundle.typesByGroup),
    }),
    [bundle],
  )

  // Các dòng có thứ tự: tiêu đề nhóm (I, II…) rồi loại (1,2,3…).
  const rows = useMemo(() => {
    type Row =
      | { kind: 'group'; group: string; gi: number }
      | { kind: 'type'; group: string; gi: number; ti: number; type: string; num: number }
    const out: Row[] = []
    bundle.groups.forEach((g, gi) => {
      if (groupFilter && g !== groupFilter) return
      out.push({ kind: 'group', group: g, gi })
      const types = bundle.typesByGroup[g] ?? []
      types.forEach((t, ti) => out.push({ kind: 'type', group: g, gi, ti, type: t, num: ti + 1 }))
    })
    return out
  }, [bundle, groupFilter])

  const loadCatalog = useCallback(async () => {
    if (!catalogOwnerUid) return
    setLoading(true)
    try {
      const data = await fetchMasterData(catalogOwnerUid)
      setBundle(data)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không tải danh mục')
    } finally {
      setLoading(false)
    }
  }, [catalogOwnerUid])

  useEffect(() => {
    if (!isCompanyAdmin || !catalogOwnerUid) return
    void loadCatalog()
  }, [isCompanyAdmin, catalogOwnerUid, loadCatalog])

  if (authLoading) return null
  if (!isCompanyAdmin) return <Navigate to="/" replace />

  // ---- Tuyến đường ----
  function setRoad(i: number, val: string) {
    setBundle((b) => {
      const roads = [...b.roads]
      if (i < roads.length) roads[i] = val
      else roads.push(val)
      return { ...b, roads }
    })
  }

  function removeRoad(i: number) {
    setBundle((b) => {
      const roads = [...b.roads]
      roads.splice(i, 1)
      return { ...b, roads }
    })
  }

  // ---- Nhóm ----
  function addGroup(name: string) {
    const t = name.trim()
    if (!t) return
    setBundle((b) => {
      if (b.groups.some((g) => g.localeCompare(t, 'vi', { sensitivity: 'accent' }) === 0)) {
        return b
      }
      return {
        ...b,
        groups: [...b.groups, t],
        typesByGroup: { ...b.typesByGroup, [t]: b.typesByGroup[t] ?? [] },
      }
    })
    setNewGroupName('')
  }

  function insertGroupAt(index: number) {
    setBundle((b) => {
      const groups = [...b.groups]
      let name = 'Nhóm mới'
      let n = 1
      while (groups.includes(name)) name = `Nhóm mới ${++n}`
      groups.splice(index, 0, name)
      return { ...b, groups, typesByGroup: { ...b.typesByGroup, [name]: [] } }
    })
  }

  function renameGroupAt(gi: number, val: string) {
    const oldG = bundle.groups[gi]
    setBundle((b) => {
      if (b.groups[gi] === val) return b
      const groups = [...b.groups]
      groups[gi] = val
      const typesByGroup: Record<string, string[]> = {}
      b.groups.forEach((g, i) => {
        typesByGroup[i === gi ? val : g] = b.typesByGroup[g] ?? []
      })
      return { ...b, groups, typesByGroup }
    })
    if (groupFilter === oldG) setGroupFilter(val)
  }

  function removeGroup(g: string) {
    if (!window.confirm(`Xóa nhóm "${g}" và toàn bộ loại bên trong?`)) return
    setBundle((b) => {
      const { [g]: _omit, ...rest } = b.typesByGroup
      return { ...b, groups: b.groups.filter((x) => x !== g), typesByGroup: rest }
    })
    setGroupFilter((f) => (f === g ? '' : f))
  }

  // ---- Loại sự cố ----
  function insertTypeAt(group: string, index: number) {
    setBundle((b) => {
      const types = [...(b.typesByGroup[group] ?? [])]
      types.splice(index, 0, '')
      return { ...b, typesByGroup: { ...b.typesByGroup, [group]: types } }
    })
  }

  function setTypeName(group: string, ti: number, val: string) {
    setBundle((b) => {
      const types = [...(b.typesByGroup[group] ?? [])]
      const old = types[ti]
      types[ti] = val
      const unitByType = { ...(b.unitByType ?? {}) }
      if (old && old !== val && unitByType[old] !== undefined) {
        unitByType[val] = unitByType[old]
        delete unitByType[old]
      }
      return { ...b, typesByGroup: { ...b.typesByGroup, [group]: types }, unitByType }
    })
  }

  function setUnit(typeName: string, val: string) {
    if (!typeName) return
    setBundle((b) => ({ ...b, unitByType: { ...(b.unitByType ?? {}), [typeName]: val } }))
  }

  function removeType(group: string, ti: number) {
    const name = bundle.typesByGroup[group]?.[ti] ?? ''
    if (name && !window.confirm(`Xóa loại "${name}"?`)) return
    setBundle((b) => {
      const types = [...(b.typesByGroup[group] ?? [])]
      types.splice(ti, 1)
      return { ...b, typesByGroup: { ...b.typesByGroup, [group]: types } }
    })
  }

  async function handleSave() {
    if (!catalogOwnerUid) {
      toast.error('Chưa xác định admin chính — thử đăng nhập lại')
      return
    }
    setSaving(true)
    try {
      const next = cleanBundle(bundle)
      await saveMasterData(next, catalogOwnerUid)
      setBundle(next)
      toast.success(
        `Đã lưu: ${next.roads.length} tuyến, ${next.groups.length} nhóm, ${countTypes(next.typesByGroup)} loại`,
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lưu thất bại')
    } finally {
      setSaving(false)
    }
  }

  function openBulkAdd() {
    setBulkGroup(groupFilter || bundle.groups[0] || '')
    setBulkText('')
    setBulkOpen(true)
  }

  function commitBulkAdd() {
    const g = bulkGroup.trim()
    if (!g) {
      toast.error('Chọn nhóm sự cố')
      return
    }
    const added = linesFromText(bulkText)
    if (added.length === 0) {
      toast.error('Dán hoặc nhập ít nhất một loại (mỗi dòng một loại)')
      return
    }
    setBundle((b) => {
      const hasGroup = b.groups.includes(g)
      const groups = hasGroup ? b.groups : [...b.groups, g]
      const merged = mergeUniqueLines(b.typesByGroup[g] ?? [], added)
      return { ...b, groups, typesByGroup: { ...b.typesByGroup, [g]: merged } }
    })
    toast.success(`Đã thêm loại vào "${g}"`)
    setBulkOpen(false)
  }

  function applyCatalogPreset(index: number) {
    const preset = CATALOG_PRESETS[index]
    if (!preset) return
    setBundle((b) => applyPreset(b, preset.bundle))
    toast.success(`Đã gộp mẫu: ${preset.label}`)
  }

  const cellInput = 'w-full bg-transparent px-2 py-1.5 text-sm outline-none focus:bg-primary/5'
  const cellTd = 'border border-border p-0 align-middle'
  const sttTd = 'border border-border px-2 py-1.5 text-center text-sm text-muted-foreground'
  const iconBtn = 'rounded px-1.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground'

  return (
    <div className="space-y-6 pb-24 lg:pb-6">
      {isCatalogDelegate ? (
        <p className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-foreground">
          Danh mục chung công ty — lưu tại admin chính. Mọi thay đổi đồng bộ xuống app hạt trưởng.
        </p>
      ) : null}
      <PageHeader
        title="Quản lý danh mục"
        description="Tuyến đường tách riêng; nhóm & loại sự cố dạng bảng phân cấp — đồng bộ xuống app hiện trường sau khi lưu."
        action={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => void loadCatalog()}>
              <RefreshCw className="h-4 w-4" />
              Tải lại
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={loading || bundle.groups.length === 0} onClick={openBulkAdd}>
              <Plus className="h-4 w-4" />
              Thêm nhiều loại
            </Button>
            <Button type="button" disabled={saving || loading} onClick={() => void handleSave()}>
              <Save className="h-4 w-4" />
              {saving ? 'Đang lưu…' : 'Lưu danh mục'}
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="muted" className="gap-1.5 px-3 py-1">
          <MapPin className="h-3.5 w-3.5" />
          {stats.roads} tuyến
        </Badge>
        <Badge variant="muted" className="gap-1.5 px-3 py-1">
          <Layers className="h-3.5 w-3.5" />
          {stats.groups} nhóm
        </Badge>
        <Badge variant="default" className="gap-1.5 px-3 py-1">
          <BookOpen className="h-3.5 w-3.5" />
          {stats.types} loại sự cố
        </Badge>
        <span className="mx-1 hidden h-4 w-px bg-border sm:block" />
        {CATALOG_PRESETS.map((p, i) => (
          <Button key={p.label} type="button" variant="outline" size="sm" onClick={() => applyCatalogPreset(i)}>
            <Sparkles className="h-3.5 w-3.5" />
            {p.label}
          </Button>
        ))}
      </div>

      <datalist id="catalog-units">
        {UNIT_OPTIONS.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>

      {loading ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Đang tải danh mục…</Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(260px,320px)_1fr]">
          {/* ----- Bảng Tuyến đường (riêng) ----- */}
          <Card className="space-y-3 p-4 xl:sticky xl:top-4 xl:self-start">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold">Tuyến đường</h2>
                <p className="text-xs text-muted-foreground">{stats.roads} tuyến · App chỉ chọn, không tự thêm</p>
              </div>
            </div>
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full border-collapse">
                <colgroup>
                  <col style={{ width: '48px' }} />
                  <col />
                  <col style={{ width: '44px' }} />
                </colgroup>
                <thead>
                  <tr className="bg-muted/60 text-left text-sm font-semibold">
                    <th className="border border-border px-2 py-2 text-center">STT</th>
                    <th className="border border-border px-2 py-2">Tuyến đường</th>
                    <th className="border border-border px-1 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {bundle.roads.map((road, i) => (
                    <tr key={i}>
                      <td className={sttTd}>{i + 1}</td>
                      <td className={cellTd}>
                        <input className={cellInput} value={road} onChange={(e) => setRoad(i, e.target.value)} />
                      </td>
                      <td className={cellTd}>
                        <button
                          type="button"
                          className={iconBtn}
                          title="Xóa tuyến"
                          onClick={() => {
                            if (window.confirm(`Xóa tuyến "${road}"?`)) removeRoad(i)
                          }}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td className={sttTd}>+</td>
                    <td className={cellTd} colSpan={2}>
                      <input
                        className={cellInput}
                        value=""
                        placeholder="+ Thêm tuyến…"
                        onChange={(e) => setRoad(bundle.roads.length, e.target.value)}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          {/* ----- Bảng Nhóm & Loại sự cố (phân cấp) ----- */}
          <Card className="space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-semibold">Nhóm & loại sự cố</h2>
                  <p className="text-xs text-muted-foreground">Nhóm đánh số I, II… · loại 1, 2, 3… · chèn dòng bất kỳ</p>
                </div>
              </div>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <select
                  className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                  value={groupFilter}
                  onChange={(e) => setGroupFilter(e.target.value)}
                >
                  <option value="">Tất cả nhóm</option>
                  {bundle.groups.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
                <input
                  className="h-10 w-40 rounded-lg border border-border bg-background px-3 text-sm outline-none ring-primary focus:ring-2"
                  placeholder="Tên nhóm mới…"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addGroup(newGroupName)
                    }
                  }}
                />
                <Button type="button" variant="secondary" size="sm" onClick={() => addGroup(newGroupName)}>
                  <Plus className="h-4 w-4" />
                  Thêm nhóm
                </Button>
              </div>
            </div>

            <div className="overflow-auto rounded-lg border border-border">
              <table className="border-collapse" style={{ width: 'max-content', maxWidth: '100%' }}>
                <colgroup>
                  <col style={{ width: '48px' }} />
                  <col style={{ width: '380px' }} />
                  <col style={{ width: '84px' }} />
                  <col style={{ width: '92px' }} />
                </colgroup>
                <thead>
                  <tr className="bg-muted/60 text-left text-sm font-semibold">
                    <th className="border border-border px-2 py-2 text-center">STT</th>
                    <th className="border border-border px-2 py-2">Loại sự cố</th>
                    <th className="border border-border px-2 py-2">Đơn vị</th>
                    <th className="border border-border px-1 py-2 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) =>
                    r.kind === 'group' ? (
                      <tr key={`g-${r.gi}`} className="bg-muted/40">
                        <td className={`${sttTd} font-bold text-foreground`}>{toRoman(r.gi + 1)}</td>
                        <td className={cellTd} colSpan={2}>
                          <input
                            className={`${cellInput} font-semibold`}
                            value={r.group}
                            onChange={(e) => renameGroupAt(r.gi, e.target.value)}
                          />
                        </td>
                        <td className={`${cellTd} text-center`}>
                          <div className="flex items-center justify-center gap-0.5">
                            <button type="button" className={iconBtn} title="Thêm loại đầu nhóm" onClick={() => insertTypeAt(r.group, 0)}>
                              + loại
                            </button>
                            <button type="button" className={iconBtn} title="Thêm nhóm dưới" onClick={() => insertGroupAt(r.gi + 1)}>
                              + nhóm
                            </button>
                            <button type="button" className={`${iconBtn} hover:text-destructive`} title="Xóa nhóm" onClick={() => removeGroup(r.group)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr key={`t-${r.gi}-${r.ti}`}>
                        <td className={sttTd}>{r.num}</td>
                        <td className={cellTd}>
                          <input
                            className={cellInput}
                            value={r.type}
                            placeholder="Tên loại sự cố…"
                            onChange={(e) => setTypeName(r.group, r.ti, e.target.value)}
                          />
                        </td>
                        <td className={cellTd}>
                          <input
                            className={`${cellInput} text-center`}
                            list="catalog-units"
                            value={bundle.unitByType?.[r.type] ?? ''}
                            placeholder="—"
                            onChange={(e) => setUnit(r.type, e.target.value)}
                          />
                        </td>
                        <td className={`${cellTd} text-center`}>
                          <div className="flex items-center justify-center gap-0.5">
                            <button type="button" className={iconBtn} title="Chèn loại dưới dòng này" onClick={() => insertTypeAt(r.group, r.ti + 1)}>
                              +
                            </button>
                            <button type="button" className={`${iconBtn} hover:text-destructive`} title="Xóa loại" onClick={() => removeType(r.group, r.ti)}>
                              ×
                            </button>
                          </div>
                        </td>
                      </tr>
                    ),
                  )}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={4} className="border border-border px-3 py-6 text-center text-sm text-muted-foreground">
                        {bundle.groups.length === 0
                          ? 'Chưa có nhóm nào. Thêm nhóm ở trên hoặc bấm mẫu để bắt đầu.'
                          : 'Nhóm này chưa có loại. Bấm “+ loại” ở dòng nhóm để thêm.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              Bấm <strong>+ loại</strong> / <strong>+</strong> để chèn dòng loại, <strong>+ nhóm</strong> để chèn nhóm
              ngay dưới — như Excel. Nhấn <strong>Lưu danh mục</strong> để đồng bộ.
            </p>
          </Card>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 p-3 backdrop-blur lg:hidden">
        <Button type="button" className="w-full" disabled={saving || loading} onClick={() => void handleSave()}>
          <Save className="h-4 w-4" />
          {saving ? 'Đang lưu…' : 'Lưu danh mục'}
        </Button>
      </div>

      <p className="hidden text-xs text-muted-foreground lg:block">
        Lưu tại Firestore:{' '}
        <code className="rounded bg-muted px-1.5 py-0.5">
          users/{catalogOwnerUid || '…'}/master_data
        </code>
      </p>

      <Dialog open={bulkOpen} onClose={() => setBulkOpen(false)} title="Thêm nhiều loại cùng lúc">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Dán danh sách từ Excel hoặc Word — <strong>mỗi dòng một loại</strong>. Trùng tên sẽ bỏ qua.
          </p>
          <div>
            <Label>Nhóm áp dụng</Label>
            <select
              className="mt-1 flex h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
              value={bulkGroup}
              onChange={(e) => setBulkGroup(e.target.value)}
            >
              {bundle.groups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Danh sách loại</Label>
            <Textarea
              className="mt-1 min-h-[200px] font-mono text-[13px]"
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={'Sụt dương\nSa bồi rãnh xây\nSa bồi cống\n…'}
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setBulkOpen(false)}>
              Hủy
            </Button>
            <Button type="button" className="flex-1" onClick={commitBulkAdd}>
              Gộp vào nhóm
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
