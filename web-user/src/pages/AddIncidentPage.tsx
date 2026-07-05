import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { fetchMasterData } from '@/services/masterDataService'
import {
  appendBeforeImages,
  createIncident,
} from '@/services/incidentsService'
import { uploadIncidentImages } from '@/services/imageUploadService'
import { buildKmString } from '@/lib/incidentDispatch'
import { CameraCaptureInput } from '@/components/incident/CameraCaptureInput'
import { Button, Card, Input, Label, Textarea } from '@/components/ui/primitives'
import type { MasterDataBundle } from '@/types/incident'
import { todayViDateString } from '@/lib/incidentUtils'

const POSITIONS = [
  { code: 'T', label: 'Trái' },
  { code: 'P', label: 'Phải' },
  { code: 'M', label: 'Giữa' },
  { code: 'TIM', label: 'Tim đường' },
  { code: 'TL', label: 'Thượng lưu' },
  { code: 'HL', label: 'Hạ lưu' },
  { code: 'LC', label: 'Lòng cống' },
  { code: 'HT', label: 'Hố tụ' },
  { code: 'TTHL', label: 'Thanh thải hạ lưu' },
]

const UNITS = ['m3', 'm2', 'm', 'cột', 'biển', 'tấm']

export function AddIncidentPage() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [master, setMaster] = useState<MasterDataBundle | null>(null)
  const [saving, setSaving] = useState(false)

  const [road, setRoad] = useState('')
  const [date, setDate] = useState(todayViDateString())
  const [groupName, setGroupName] = useState('Bão lũ')
  const [type, setType] = useState('')
  const [kmPart, setKmPart] = useState('')
  const [mPart, setMPart] = useState('')
  const [position, setPosition] = useState('T')
  const [dai, setDai] = useState('')
  const [rong, setRong] = useState('')
  const [cao, setCao] = useState('')
  const [unit, setUnit] = useState('m3')
  const [note, setNote] = useState('')
  const [beforeFiles, setBeforeFiles] = useState<File[]>([])

  useEffect(() => {
    if (!profile) return
    void fetchMasterData(profile.catalogOwnerUid).then((data) => {
      setMaster(data)
      if (data.roads[0]) setRoad(data.roads[0])
      if (data.groups[0]) setGroupName(data.groups[0])
    })
  }, [profile])

  const types = useMemo(
    () => master?.typesByGroup[groupName] ?? [],
    [master, groupName],
  )

  useEffect(() => {
    if (types.length && !types.includes(type)) setType(types[0])
  }, [types, type])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !profile) return
    if (!road || !type || !kmPart) {
      toast.error('Vui lòng điền tuyến, loại sự cố và km')
      return
    }

    setSaving(true)
    try {
      const km = buildKmString(kmPart, mPart)
      const { docId } = await createIncident(user.uid, {
        road,
        groupName,
        type,
        date,
        km,
        position,
        dai: Number(dai) || 0,
        rong: Number(rong) || 0,
        cao: Number(cao) || 0,
        unit,
        note,
        progress: 0,
        companyId: profile.companyId,
        createdByName: profile.displayName || profile.email || user.email || '',
      })

      if (beforeFiles.length) {
        const urls = await uploadIncidentImages(user.uid, docId, beforeFiles, 'before')
        await appendBeforeImages(user.uid, docId, urls)
      }

      toast.success('Đã lưu sự cố')
      navigate(`/incidents/${docId}`)
    } catch {
      toast.error('Không lưu được sự cố. Kiểm tra mạng và thử lại.')
    } finally {
      setSaving(false)
    }
  }

  if (!master) {
    return <p className="text-sm text-muted-foreground">Đang tải danh mục...</p>
  }

  return (
    <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
      <h2 className="text-lg font-bold">Thêm sự cố</h2>

      <Card className="space-y-3 p-4">
        <div>
          <Label>Tuyến</Label>
          <select
            className="mt-1 flex h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
            value={road}
            onChange={(e) => setRoad(e.target.value)}
          >
            {master.roads.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        <div>
          <Label>Ngày</Label>
          <Input className="mt-1 h-11" value={date} onChange={(e) => setDate(e.target.value)} placeholder="dd/MM/yyyy" />
        </div>

        <div>
          <Label>Nhóm sự cố</Label>
          <select
            className="mt-1 flex h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          >
            {master.groups.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>

        <div>
          <Label>Loại sự cố</Label>
          <select
            className="mt-1 flex h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {types.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Km</Label>
            <Input className="mt-1 h-11" value={kmPart} onChange={(e) => setKmPart(e.target.value)} placeholder="366" />
          </div>
          <div>
            <Label>Mét</Label>
            <Input className="mt-1 h-11" value={mPart} onChange={(e) => setMPart(e.target.value)} placeholder="100" />
          </div>
        </div>

        <div>
          <Label>Phía</Label>
          <select
            className="mt-1 flex h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
          >
            {POSITIONS.map((p) => (
              <option key={p.code} value={p.code}>{p.label}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label>Dài</Label>
            <Input className="mt-1 h-11" inputMode="decimal" value={dai} onChange={(e) => setDai(e.target.value)} />
          </div>
          <div>
            <Label>Rộng</Label>
            <Input className="mt-1 h-11" inputMode="decimal" value={rong} onChange={(e) => setRong(e.target.value)} />
          </div>
          <div>
            <Label>Cao</Label>
            <Input className="mt-1 h-11" inputMode="decimal" value={cao} onChange={(e) => setCao(e.target.value)} />
          </div>
        </div>

        <div>
          <Label>Đơn vị</Label>
          <select
            className="mt-1 flex h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          >
            {UNITS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>

        <div>
          <Label>Ghi chú</Label>
          <Textarea className="mt-1" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        <CameraCaptureInput
          label="Ảnh hiện trường (trước thi công)"
          disabled={saving}
          onFiles={(files) => setBeforeFiles((prev) => [...prev, ...files])}
        />
        {beforeFiles.length > 0 ? (
          <p className="text-sm text-muted-foreground">Đã chọn {beforeFiles.length} ảnh</p>
        ) : null}
      </Card>

      <Button type="submit" className="h-14 w-full text-base" disabled={saving}>
        {saving ? 'Đang lưu...' : 'Lưu sự cố'}
      </Button>
    </form>
  )
}
