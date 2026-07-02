import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Dialog } from '@/components/ui/dialog'
import { Button, Input, Label, Textarea } from '@/components/ui/primitives'
import { useDispatch } from '@/context/DispatchContext'
import { useAuth } from '@/hooks/useAuth'
import {
  fetchMasterData,
} from '@/services/masterDataService'
import { updateIncidentRecord } from '@/services/incidentsService'
import { uploadAndAttachPhotos, type PhotoKind } from '@/services/incidentImageService'
import {
  clampProgress,
  resolveCompletedDate,
  statusFromProgress,
} from '@/lib/incidentUtils'
import { formatKmDisplay } from '@quanlysuco/shared'
import type { IncidentRecord } from '@/types/incident'

type Props = {
  incident: IncidentRecord | null
  open: boolean
  onClose: () => void
  onSaved: () => void
}

export function IncidentEditDialog({ incident, open, onClose, onSaved }: Props) {
  const { user, profile, isCompanyAdmin, catalogOwnerUid } = useAuth()
  const { creatorLabel } = useDispatch()
  const [saving, setSaving] = useState(false)
  const [roads, setRoads] = useState<string[]>([])
  const [groups, setGroups] = useState<string[]>([])
  const [types, setTypes] = useState<string[]>([])

  const [road, setRoad] = useState('')
  const [groupName, setGroupName] = useState('')
  const [type, setType] = useState('')
  const [km, setKm] = useState('')
  const [position, setPosition] = useState('')
  const [date, setDate] = useState('')
  const [completedDate, setCompletedDate] = useState('')
  const [dai, setDai] = useState('')
  const [rong, setRong] = useState('')
  const [cao, setCao] = useState('')
  const [unit, setUnit] = useState('m3')
  const [progress, setProgress] = useState(0)
  const [note, setNote] = useState('')
  const [addedBefore, setAddedBefore] = useState<string[]>([])
  const [addedAfter, setAddedAfter] = useState<string[]>([])
  const [uploadingKind, setUploadingKind] = useState<PhotoKind | null>(null)
  const [uploadInfo, setUploadInfo] = useState<{ done: number; total: number } | null>(null)

  useEffect(() => {
    if (!open || !incident) return
    setRoad(incident.road ?? '')
    setGroupName(incident.groupName ?? '')
    setType(incident.type ?? '')
    setKm(incident.km ?? '')
    setPosition(incident.position ?? '')
    setDate(incident.date ?? '')
    setCompletedDate(incident.completedDate ?? '')
    setDai(String(incident.dai ?? ''))
    setRong(String(incident.rong ?? ''))
    setCao(String(incident.cao ?? ''))
    setUnit(incident.unit ?? 'm3')
    setProgress(clampProgress(incident.progress))
    setNote(incident.note ?? '')
    setAddedBefore([])
    setAddedAfter([])
  }, [open, incident])

  async function handlePickFiles(kind: PhotoKind, fileList: FileList | null) {
    const inc = incident
    if (!inc || !user?.uid || !fileList) return
    const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'))
    if (files.length === 0) return
    setUploadingKind(kind)
    setUploadInfo({ done: 0, total: files.length })
    try {
      const urls = await uploadAndAttachPhotos({
        uploaderUid: user.uid,
        ownerUid: inc.ownerUid,
        docId: inc.id,
        incidentId: inc.incidentId || inc.id,
        kind,
        files,
        onProgress: (done, total) => setUploadInfo({ done, total }),
      })
      if (kind === 'before') setAddedBefore((p) => [...p, ...urls])
      else setAddedAfter((p) => [...p, ...urls])
      toast.success(`Đã tải lên ${urls.length} ảnh`)
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Tải ảnh thất bại')
    } finally {
      setUploadingKind(null)
      setUploadInfo(null)
    }
  }

  function renderUploader(
    kind: PhotoKind,
    label: string,
    currentCount: number,
    added: string[],
  ) {
    const busy = uploadingKind === kind
    const total = currentCount + added.length
    return (
      <div className="rounded-lg border border-dashed border-border p-3">
        <p className="text-sm font-medium">
          {label}
          <span className="ml-1 font-normal text-muted-foreground">
            ({total} ảnh{added.length > 0 ? `, +${added.length} mới` : ''})
          </span>
        </p>
        <label
          className={`mt-2 inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border border-border px-3 text-sm font-medium transition hover:bg-muted ${
            uploadingKind ? 'pointer-events-none opacity-50' : ''
          }`}
        >
          {busy && uploadInfo
            ? `Đang tải ${uploadInfo.done}/${uploadInfo.total}…`
            : 'Chọn ảnh từ máy tính'}
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={!!uploadingKind}
            onChange={(e) => {
              void handlePickFiles(kind, e.target.files)
              e.target.value = ''
            }}
          />
        </label>
        {added.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {added.map((url) => (
              <img
                key={url}
                src={url}
                alt=""
                className="h-14 w-14 rounded-md border border-border object-cover"
              />
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  useEffect(() => {
    if (!open || !catalogOwnerUid) return
    ;(async () => {
      try {
        const md = await fetchMasterData(catalogOwnerUid)
        setRoads(md.roads)
        setGroups(md.groups)
      } catch {
        /* danh mục tùy chọn */
      }
    })()
  }, [open, catalogOwnerUid])

  useEffect(() => {
    if (!groupName || !catalogOwnerUid) {
      setTypes([])
      return
    }
    fetchMasterData(catalogOwnerUid)
      .then((md) => setTypes(md.typesByGroup[groupName] ?? []))
      .catch(() => setTypes([]))
  }, [groupName, catalogOwnerUid])

  if (!incident) return null

  if (!isCompanyAdmin) {
    return (
      <Dialog open={open} onClose={onClose} title="Sửa sự cố" className="sm:max-w-xl">
        <p className="text-sm text-muted-foreground">
          Chỉ tài khoản <strong>ADMIN</strong> (lãnh đạo) mới được sửa sự cố trên web.
        </p>
        <Button type="button" className="mt-4 w-full" variant="outline" onClick={onClose}>
          Đóng
        </Button>
      </Dialog>
    )
  }

  async function handleSave() {
    const inc = incident
    if (!inc) return
    if (!road.trim() || !type.trim() || !km.trim()) {
      toast.error('Nhập tuyến, lý trình và loại sự cố')
      return
    }
    const p = clampProgress(Number(progress))
    const finalCompletedDate = resolveCompletedDate(p, completedDate)
    setSaving(true)
    try {
      const patch = {
        road: road.trim(),
        groupName: groupName.trim(),
        type: type.trim(),
        km: formatKmDisplay(km),
        position: position.trim(),
        date: date.trim(),
        completedDate: finalCompletedDate,
        dai: Number(dai) || 0,
        rong: Number(rong) || 0,
        cao: Number(cao) || 0,
        unit: unit.trim() || 'm3',
        progress: p,
        status: statusFromProgress(p),
        note: note.trim(),
      }
      await updateIncidentRecord(inc.ownerUid, inc.id, patch, {
        companyId:
          inc.companyId?.trim() ||
          profile?.companyId?.trim() ||
          undefined,
      })
      toast.success('Đã cập nhật sự cố')
      onSaved()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lưu thất bại')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Sửa sự cố"
      className="sm:max-w-xl"
    >
      <div className="space-y-4 text-sm">
        <p className="text-muted-foreground">
          Người tạo:{' '}
          <strong>{creatorLabel(incident.ownerUid, incident.createdByName)}</strong>
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Tuyến</Label>
            {roads.length > 0 ? (
              <select
                className="mt-1 flex h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                value={road}
                onChange={(e) => setRoad(e.target.value)}
              >
                <option value="">—</option>
                {roads.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            ) : (
              <Input className="mt-1" value={road} onChange={(e) => setRoad(e.target.value)} />
            )}
          </div>
          <div>
            <Label>Lý trình</Label>
            <Input className="mt-1 font-mono" value={km} onChange={(e) => setKm(e.target.value)} />
          </div>
          <div>
            <Label>Nhóm</Label>
            {groups.length > 0 ? (
              <select
                className="mt-1 flex h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                value={groupName}
                onChange={(e) => {
                  setGroupName(e.target.value)
                  setType('')
                }}
              >
                <option value="">—</option>
                {groups.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            ) : (
              <Input className="mt-1" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
            )}
          </div>
          <div>
            <Label>Loại sự cố</Label>
            {types.length > 0 ? (
              <select
                className="mt-1 flex h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="">—</option>
                {types.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
                {type && !types.includes(type) ? (
                  <option value={type}>{type} (đã lưu)</option>
                ) : null}
              </select>
            ) : (
              <Input className="mt-1" value={type} onChange={(e) => setType(e.target.value)} />
            )}
          </div>
          <div>
            <Label>Phía</Label>
            <Input className="mt-1" value={position} onChange={(e) => setPosition(e.target.value)} />
          </div>
          <div>
            <Label>Ngày xảy ra sự cố</Label>
            <Input className="mt-1" value={date} onChange={(e) => setDate(e.target.value)} placeholder="dd/MM/yyyy" />
          </div>
          <div>
            <Label>Ngày hoàn thành</Label>
            <Input
              className="mt-1"
              value={completedDate}
              onChange={(e) => setCompletedDate(e.target.value)}
              placeholder="dd/MM/yyyy (tự điền khi tiến độ ≥ 90%)"
            />
          </div>
          <div>
            <Label>Dài</Label>
            <Input className="mt-1" type="number" value={dai} onChange={(e) => setDai(e.target.value)} />
          </div>
          <div>
            <Label>Rộng</Label>
            <Input className="mt-1" type="number" value={rong} onChange={(e) => setRong(e.target.value)} />
          </div>
          <div>
            <Label>Cao</Label>
            <Input className="mt-1" type="number" value={cao} onChange={(e) => setCao(e.target.value)} />
          </div>
          <div>
            <Label>Đơn vị</Label>
            <Input className="mt-1" value={unit} onChange={(e) => setUnit(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label>Tiến độ (%)</Label>
            <Input
              className="mt-1"
              type="number"
              min={0}
              max={100}
              value={progress}
              onChange={(e) => {
                const p = clampProgress(Number(e.target.value))
                setProgress(p)
                setCompletedDate((prev) => resolveCompletedDate(p, prev))
              }}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Ghi chú</Label>
            <Textarea className="mt-1 min-h-[72px]" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-border p-3">
          <p className="text-sm font-semibold">Ảnh bổ sung (tải từ máy tính)</p>
          <p className="text-xs text-muted-foreground">
            Ảnh tải lên được lưu ngay vào sự cố (đồng bộ với app và dùng cho xuất Word/Excel).
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {renderUploader('before', 'Ảnh hiện trạng', incident.beforeImages?.length ?? 0, addedBefore)}
            {renderUploader('after', 'Ảnh sau xử lý', incident.afterImages?.length ?? 0, addedAfter)}
          </div>
        </div>

        <div className="flex gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Hủy
          </Button>
          <Button type="button" className="flex-1" disabled={saving} onClick={() => void handleSave()}>
            {saving ? 'Đang lưu…' : 'Lưu thay đổi'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
