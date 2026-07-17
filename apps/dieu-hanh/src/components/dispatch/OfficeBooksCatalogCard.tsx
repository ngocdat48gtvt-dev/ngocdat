import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { BookMarked, Plus, RefreshCw, Trash2, UserRound } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Badge, Button, Card, Label } from '@/components/ui/primitives'
import { formatKmDisplay, groupOfficeRoadsByName } from '@/lib/officeRoadNormalize'
import {
  adminAddRoadToCatalog,
  adminRemoveRoadFromCatalog,
  adminUpdateRoadInCatalog,
  fetchOfficeRoadsCatalog,
} from '@/services/officeRoadsCatalogService'
import { fetchCompanyOfficeUsers } from '@/services/usersService'
import type { CompanyUserEntry } from '@/services/usersService'
import type { OfficeRoad, OfficeRoadDraft } from '@/types/officeRoad'

const EMPTY_DRAFT: OfficeRoadDraft = {
  roadName: '',
  hat: '',
  kmFrom: '',
  kmTo: '',
  company: '',
}

interface OfficeBooksCatalogCardProps {
  companyId: string
}

export function OfficeBooksCatalogCard({ companyId }: OfficeBooksCatalogCardProps) {
  const [users, setUsers] = useState<CompanyUserEntry[]>([])
  const [selectedUid, setSelectedUid] = useState('')
  const [roads, setRoads] = useState<OfficeRoad[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [loadingRoads, setLoadingRoads] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState('')
  const [form, setForm] = useState<OfficeRoadDraft>(EMPTY_DRAFT)

  const selectedUser = users.find((u) => u.uid === selectedUid)
  const grouped = useMemo(() => groupOfficeRoadsByName(roads), [roads])

  const loadUsers = useCallback(async () => {
    if (!companyId) return
    setLoadingUsers(true)
    try {
      const list = await fetchCompanyOfficeUsers(companyId)
      setUsers(list)
      setSelectedUid((prev) => (prev && list.some((u) => u.uid === prev) ? prev : list[0]?.uid || ''))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không tải danh sách USER')
    } finally {
      setLoadingUsers(false)
    }
  }, [companyId])

  const loadRoads = useCallback(async () => {
    if (!selectedUid) {
      setRoads([])
      return
    }
    setLoadingRoads(true)
    try {
      const catalog = await fetchOfficeRoadsCatalog(selectedUid)
      setRoads(catalog.roads)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không tải danh mục sổ')
      setRoads([])
    } finally {
      setLoadingRoads(false)
    }
  }, [selectedUid])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  useEffect(() => {
    void loadRoads()
  }, [loadRoads])

  function openCreate(prefillRoadName = '') {
    setEditingId('')
    setForm({ ...EMPTY_DRAFT, roadName: prefillRoadName })
    setFormOpen(true)
  }

  function openEdit(road: OfficeRoad) {
    setEditingId(road.id)
    setForm({
      roadName: road.roadName || road.label || '',
      hat: road.hat || '',
      kmFrom: road.kmFrom || '',
      kmTo: road.kmTo || '',
      company: road.company || '',
    })
    setFormOpen(true)
  }

  async function handleSubmit() {
    if (!selectedUid) {
      toast.error('Chọn nhân viên (USER)')
      return
    }
    const roadName = form.roadName.trim()
    const hat = form.hat.trim()
    const kmFrom = form.kmFrom.trim()
    const kmTo = form.kmTo.trim()
    if (!roadName || !hat || !kmFrom || !kmTo) {
      toast.error('Nhập đủ tên đường, hạt và lý trình Km đầu/cuối')
      return
    }
    const payload: OfficeRoadDraft = { ...form, roadName, hat, kmFrom, kmTo }
    setSaving(true)
    try {
      if (editingId) {
        await adminUpdateRoadInCatalog(selectedUid, editingId, payload)
        toast.success('Đã cập nhật hạt/sổ')
      } else {
        await adminAddRoadToCatalog(selectedUid, payload)
        toast.success('Đã tạo sổ cho USER')
      }
      setFormOpen(false)
      setEditingId('')
      setForm(EMPTY_DRAFT)
      await loadRoads()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lưu thất bại')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(road: OfficeRoad) {
    if (!selectedUid) return
    const label = [road.roadName, road.hat ? `Hạt ${road.hat}` : ''].filter(Boolean).join(' · ')
    if (!window.confirm(`Xóa sổ «${label}» khỏi danh mục?\n\nDữ liệu nhập trên máy USER không bị xóa tự động.`)) {
      return
    }
    setSaving(true)
    try {
      await adminRemoveRoadFromCatalog(selectedUid, road.id)
      toast.success('Đã xóa khỏi danh mục')
      await loadRoads()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Xóa thất bại')
    } finally {
      setSaving(false)
    }
  }

  const cellInput = 'w-full bg-transparent px-2 py-1.5 text-sm outline-none'
  const cellTd = 'border border-border p-0 align-middle'
  const sttTd = 'border border-border px-2 py-1.5 text-center text-sm text-muted-foreground'
  const iconBtn = 'rounded px-1.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground'

  return (
    <>
      <Card className="space-y-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <BookMarked className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold">Sổ nội nghiệp (hạt / đoạn)</h2>
              <p className="text-xs text-muted-foreground">
                Chỉ ADMIN tạo danh mục sổ cho từng USER — USER chỉ chọn hạt để nhập liệu
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="muted" className="gap-1.5 px-3 py-1">
              <UserRound className="h-3.5 w-3.5" />
              {users.length} USER
            </Badge>
            <Badge variant="default" className="gap-1.5 px-3 py-1">
              {roads.length} hạt
            </Badge>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loadingRoads || !selectedUid}
              onClick={() => void loadRoads()}
            >
              <RefreshCw className="h-4 w-4" />
              Tải lại
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!selectedUid || saving}
              onClick={() => openCreate()}
            >
              <Plus className="h-4 w-4" />
              Thêm hạt
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Label className="shrink-0 text-sm">Nhân viên (USER)</Label>
          <select
            className="h-10 min-w-[220px] flex-1 rounded-lg border border-border bg-background px-3 text-sm sm:max-w-sm"
            value={selectedUid}
            disabled={loadingUsers || users.length === 0}
            onChange={(e) => setSelectedUid(e.target.value)}
          >
            {users.length === 0 && <option value="">Chưa có USER</option>}
            {users.map((u) => (
              <option key={u.uid} value={u.uid}>
                {u.displayName}
              </option>
            ))}
          </select>
          {selectedUser && (
            <span className="text-xs text-muted-foreground">
              Lưu tại{' '}
              <code className="rounded bg-muted px-1 py-0.5">users/{selectedUid}/master_data/office_roads_catalog</code>
            </span>
          )}
        </div>

        {loadingUsers || loadingRoads ? (
          <p className="text-sm text-muted-foreground">Đang tải…</p>
        ) : !selectedUid ? (
          <p className="text-sm text-muted-foreground">Chưa có USER hoạt động trong công ty.</p>
        ) : grouped.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            USER <strong>{selectedUser?.displayName}</strong> chưa có sổ. Bấm <strong>Thêm hạt</strong> để
            tạo (một tuyến có thể 2–3 hạt).
          </p>
        ) : (
          <div className="space-y-4">
            {grouped.map((group) => (
              <div key={group.roadName} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">{group.roadName}</h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={saving}
                    onClick={() => openCreate(group.roadName)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Thêm hạt
                  </Button>
                </div>
                <div className="overflow-auto rounded-lg border border-border">
                  <table className="w-full min-w-[640px] border-collapse">
                    <thead>
                      <tr className="bg-muted/60 text-left text-sm font-semibold">
                        <th className="border border-border px-2 py-2 text-center w-12">STT</th>
                        <th className="border border-border px-2 py-2 w-28">Hạt</th>
                        <th className="border border-border px-2 py-2">Km đầu</th>
                        <th className="border border-border px-2 py-2">Km cuối</th>
                        <th className="border border-border px-2 py-2 w-28 text-center">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.segments.map((road, i) => (
                        <tr key={road.id}>
                          <td className={sttTd}>{i + 1}</td>
                          <td className={cellTd}>
                            <span className={cellInput}>Hạt {road.hat}</span>
                          </td>
                          <td className={cellTd}>
                            <span className={cellInput}>{formatKmDisplay(road.kmFrom) || '—'}</span>
                          </td>
                          <td className={cellTd}>
                            <span className={cellInput}>{formatKmDisplay(road.kmTo) || '—'}</span>
                          </td>
                          <td className={`${cellTd} text-center`}>
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                className={iconBtn}
                                disabled={saving}
                                onClick={() => openEdit(road)}
                              >
                                Sửa
                              </button>
                              <button
                                type="button"
                                className={`${iconBtn} hover:text-destructive`}
                                disabled={saving}
                                onClick={() => void handleDelete(road)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Mỗi hạt = một sổ riêng trên app <strong>Sổ nội nghiệp</strong>. USER đăng nhập sẽ thấy danh mục này
          và chỉ được chọn — không tự thêm/xóa.
        </p>
      </Card>

      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingId ? 'Sửa hạt / sổ' : 'Thêm hạt / sổ cho USER'}
      >
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            USER: <strong>{selectedUser?.displayName || '—'}</strong>
          </p>
          <div>
            <Label>Tên đường *</Label>
            <input
              className="mt-1 flex h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
              value={form.roadName}
              onChange={(e) => setForm((f) => ({ ...f, roadName: e.target.value }))}
              placeholder="VD: QL.37"
            />
          </div>
          <div>
            <Label>Tên hạt *</Label>
            <input
              className="mt-1 flex h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
              value={form.hat}
              onChange={(e) => setForm((f) => ({ ...f, hat: e.target.value }))}
              placeholder="VD: 1.37"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Km đầu *</Label>
              <input
                className="mt-1 flex h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                value={form.kmFrom}
                onChange={(e) => setForm((f) => ({ ...f, kmFrom: e.target.value }))}
                placeholder="356+700"
              />
            </div>
            <div>
              <Label>Km cuối *</Label>
              <input
                className="mt-1 flex h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                value={form.kmTo}
                onChange={(e) => setForm((f) => ({ ...f, kmTo: e.target.value }))}
                placeholder="404+000"
              />
            </div>
          </div>
          <div>
            <Label>Tên công ty (trên sổ)</Label>
            <input
              className="mt-1 flex h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
              value={form.company}
              onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setFormOpen(false)}>
              Hủy
            </Button>
            <Button type="button" className="flex-1" disabled={saving} onClick={() => void handleSubmit()}>
              {saving ? 'Đang lưu…' : editingId ? 'Lưu' : 'Tạo sổ'}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  )
}
