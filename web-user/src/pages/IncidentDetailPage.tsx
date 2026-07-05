import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import {
  subscribeIncidentById,
  updateIncidentProgress,
} from '@/services/incidentsService'
import { uploadIncidentImages } from '@/services/imageUploadService'
import type { IncidentRecord } from '@/types/incident'
import { IncidentImageGallery } from '@/components/incident/IncidentImageGallery'
import { IncidentTimeline } from '@/components/incident/IncidentTimeline'
import { ProgressPanel } from '@/components/incident/ProgressPanel'
import { formatVolumeDisplay } from '@/lib/incidentDispatch'
import { positionLabel } from '@/lib/positionUtils'
import { beforeConstructionImages, afterConstructionImages } from '@/lib/incidentUtils'
import { WordPhotoSelectSection } from '@/components/export/WordPhotoSelectSection'
import { Button, Card } from '@/components/ui/primitives'

export function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [incident, setIncident] = useState<IncidentRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user || !id) {
      setIncident(null)
      setLoading(false)
      return
    }

    setLoading(true)
    const unsubscribe = subscribeIncidentById(
      user.uid,
      id,
      (data) => {
        setIncident(data)
        setLoading(false)
      },
      () => {
        setIncident(null)
        setLoading(false)
      },
    )

    return () => unsubscribe()
  }, [user, id])

  async function handleProgressSave(progress: number, note: string, afterFiles: File[]) {
    if (!user || !incident || !id) return
    setSaving(true)
    try {
      let afterUrls: string[] = []
      if (afterFiles.length) {
        afterUrls = await uploadIncidentImages(user.uid, id, afterFiles, 'after')
      }
      await updateIncidentProgress(
        user.uid,
        id,
        incident,
        progress,
        note,
        afterUrls,
        profile?.displayName || profile?.email || user.email || '',
      )
      toast.success('Đã cập nhật tiến độ')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không cập nhật được')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Đang tải...</p>
  if (!incident) {
    return (
      <div className="space-y-3">
        <p>Không tìm thấy sự cố.</p>
        <Button variant="outline" onClick={() => navigate('/list')}>Quay lại</Button>
      </div>
    )
  }

  const before = beforeConstructionImages(incident)
  const after = afterConstructionImages(incident)

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate('/list')}>
        ← Danh sách
      </Button>

      <Card className="space-y-2 p-4 text-sm">
        <h2 className="text-lg font-bold">{incident.type}</h2>
        <p><strong>Tuyến:</strong> {incident.road}</p>
        <p><strong>Lý trình:</strong> {incident.km} · {positionLabel(incident.position)}</p>
        <p><strong>Nhóm:</strong> {incident.groupName}</p>
        <p><strong>Kích thước:</strong> {incident.dai} × {incident.rong} × {incident.cao} {incident.unit}</p>
        <p><strong>Khối lượng:</strong> {formatVolumeDisplay(incident)}</p>
        <p><strong>Ngày:</strong> {incident.date}</p>
        {incident.completedDate ? <p><strong>Hoàn thành:</strong> {incident.completedDate}</p> : null}
        {incident.note ? <p><strong>Ghi chú:</strong> {incident.note}</p> : null}
      </Card>

      <Card className="p-4">
        <IncidentImageGallery beforeUrls={before} afterUrls={after} />
        {user ? (
          <WordPhotoSelectSection
            uid={user.uid}
            incidentId={incident.id}
            beforeUrls={before}
            afterUrls={after}
          />
        ) : null}
      </Card>

      <ProgressPanel incident={incident} saving={saving} onSave={handleProgressSave} />

      <Card className="p-4">
        <h3 className="mb-3 font-semibold">Lịch sử xử lý</h3>
        <IncidentTimeline updates={incident.updates ?? []} />
      </Card>
    </div>
  )
}
