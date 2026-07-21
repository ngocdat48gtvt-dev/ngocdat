import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { MapPin, RefreshCw, Save, UserRound } from 'lucide-react'
import { Badge, Button, Card, Label } from '@/components/ui/primitives'
import { fetchUserRoads, saveUserRoads } from '@/services/userRoadsCatalogService'
import { fetchCompanyOfficeUsers } from '@/services/usersService'
import type { CompanyUserEntry } from '@/services/usersService'

interface UserRoadsCatalogCardProps {
  companyId: string
  /** Danh mục tuyến chung (bảng bên trái) — tick chọn để gán cho USER. */
  companyRoads: string[]
}

export function UserRoadsCatalogCard({ companyId, companyRoads }: UserRoadsCatalogCardProps) {
  const [users, setUsers] = useState<CompanyUserEntry[]>([])
  const [selectedUid, setSelectedUid] = useState('')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [loadingRoads, setLoadingRoads] = useState(false)
  const [saving, setSaving] = useState(false)

  const selectedUser = users.find((u) => u.uid === selectedUid)
  const pickedCount = picked.size

  const companySet = useMemo(() => new Set(companyRoads), [companyRoads])

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
      setPicked(new Set())
      return
    }
    setLoadingRoads(true)
    try {
      const saved = await fetchUserRoads(selectedUid)
      setPicked(new Set(saved))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không tải tuyến của USER')
      setPicked(new Set())
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

  function toggleRoad(road: string, checked: boolean) {
    setPicked((prev) => {
      const next = new Set(prev)
      if (checked) next.add(road)
      else next.delete(road)
      return next
    })
  }

  function selectAll() {
    setPicked(new Set(companyRoads))
  }

  function clearAll() {
    setPicked(new Set())
  }

  async function handleSave() {
    if (!selectedUid) {
      toast.error('Chọn nhân viên (USER)')
      return
    }
    setSaving(true)
    try {
      const ordered = companyRoads.filter((r) => picked.has(r))
      const extra = [...picked].filter((r) => !companySet.has(r))
      const next = [...ordered, ...extra]
      await saveUserRoads(selectedUid, next)
      setPicked(new Set(next))
      toast.success(`Đã gán ${next.length} tuyến cho ${selectedUser?.displayName || 'USER'}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lưu thất bại')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <MapPin className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold">Gán tuyến cho USER (app hiện trường)</h2>
            <p className="text-xs text-muted-foreground">
              Tick chọn từ danh mục chung bên trái — không nhập lại tên tuyến
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="muted" className="gap-1.5 px-3 py-1">
            <UserRound className="h-3.5 w-3.5" />
            {users.length} USER
          </Badge>
          <Badge variant="default" className="gap-1.5 px-3 py-1">
            {pickedCount}/{companyRoads.length} tuyến
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
          <Button type="button" size="sm" disabled={!selectedUid || saving} onClick={() => void handleSave()}>
            <Save className="h-4 w-4" />
            {saving ? 'Đang lưu…' : 'Lưu gán tuyến'}
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
      </div>

      {loadingUsers || loadingRoads ? (
        <p className="text-sm text-muted-foreground">Đang tải…</p>
      ) : !selectedUid ? (
        <p className="text-sm text-muted-foreground">Chưa có USER hoạt động trong công ty.</p>
      ) : companyRoads.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Chưa có tuyến trong danh mục chung — thêm tuyến ở bảng <strong>Tuyến đường</strong> bên trái, bấm{' '}
          <strong>Lưu danh mục</strong>, rồi quay lại gán cho USER.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={selectAll}>
              Chọn tất cả
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={clearAll}>
              Bỏ chọn hết
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {companyRoads.map((road, i) => {
              const checked = picked.has(road)
              return (
                <label
                  key={`${road}-${i}`}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    checked ? 'border-primary/40 bg-primary/5' : 'border-border hover:bg-muted/40'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0 accent-primary"
                    checked={checked}
                    onChange={(e) => toggleRoad(road, e.target.checked)}
                  />
                  <span className="font-medium">{road}</span>
                </label>
              )
            })}
          </div>
          {[...picked].some((r) => !companySet.has(r)) ? (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              USER còn tuyến cũ không còn trong danh mục chung — bấm Lưu để giữ, hoặc bỏ tick rồi Lưu để xóa.
            </p>
          ) : null}
        </>
      )}

      <p className="text-xs text-muted-foreground">
        App mobile chỉ hiện tuyến đã tick. Chưa gán (0 tuyến) → app tạm dùng cả danh mục chung. Thứ tự trên app
        theo STT bảng bên trái.
      </p>
    </Card>
  )
}
