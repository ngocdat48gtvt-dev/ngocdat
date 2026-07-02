import { useEffect, useState } from 'react'
import { RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks'
import { PageHeader } from '@/components/common/PageParts'
import { Button, Card, Skeleton } from '@/components/ui/primitives'
import {
  permanentlyDeleteIncident,
  purgeExpiredTrashForViewer,
  restoreIncident,
  subscribeTrashIncidentsForViewer,
} from '@/services/incidentsService'
import {
  formatTrashDeletedAt,
  trashDaysRemaining,
} from '@/lib/trashUtils'
import type { TrashIncidentRecord } from '@/types/incident'

export function DispatchTrashPage() {
  const { profile, user } = useAuth()
  const [items, setItems] = useState<TrashIncidentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  useEffect(() => {
    const companyId = profile?.companyId
    if (!user || !companyId) return

    setLoading(true)
    purgeExpiredTrashForViewer('ADMIN', user.uid, companyId).catch(() => {})

    const unsub = subscribeTrashIncidentsForViewer(
      'ADMIN',
      user.uid,
      companyId,
      (list) => {
        setItems(list)
        setLoading(false)
      },
      (err) => {
        toast.error(err.message)
        setLoading(false)
      },
    )

    return () => unsub()
  }, [user, profile?.companyId])

  async function handleRestore(item: TrashIncidentRecord) {
    const label = `${item.road ?? '—'} · ${item.km ?? '—'}`
    if (!window.confirm(`Khôi phục sự cố?\n\n${label}`)) return
    const key = `${item.ownerUid}-${item.id}-restore`
    setBusyKey(key)
    try {
      await restoreIncident(item.ownerUid, item.id)
      toast.success('Đã khôi phục sự cố')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Khôi phục thất bại')
    } finally {
      setBusyKey(null)
    }
  }

  async function handlePermanentDelete(item: TrashIncidentRecord) {
    const label = `${item.road ?? '—'} · ${item.km ?? '—'}`
    if (
      !window.confirm(
        `Xóa vĩnh viễn?\n\n${label}\n\nKhông thể hoàn tác.`,
      )
    ) {
      return
    }
    const key = `${item.ownerUid}-${item.id}-delete`
    setBusyKey(key)
    try {
      await permanentlyDeleteIncident(item.ownerUid, item.id)
      toast.success('Đã xóa vĩnh viễn')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Xóa thất bại')
    } finally {
      setBusyKey(null)
    }
  }

  async function refresh() {
    if (!user || !profile?.companyId) return
    setLoading(true)
    try {
      await purgeExpiredTrashForViewer('ADMIN', user.uid, profile.companyId)
      toast.success('Đã làm mới thùng rác')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Làm mới thất bại')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <PageHeader
        title="Thùng rác"
        description="Sự cố xóa được giữ 7 ngày trước khi tự xóa vĩnh viễn. Có thể khôi phục hoặc xóa ngay."
        action={
          <Button type="button" variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="h-4 w-4" />
            Làm mới
          </Button>
        }
      />

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : items.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-10 text-center text-muted-foreground">
          <Trash2 className="h-10 w-10 opacity-40" />
          <p>Thùng rác trống</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const key = `${item.ownerUid}-${item.id}`
            const busy = busyKey?.startsWith(key) ?? false
            const days = trashDaysRemaining(item.deletedAtMs)
            return (
              <Card key={key} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1 text-sm">
                    <p className="font-semibold">
                      {item.road ?? '—'} · {item.km ?? '—'} · {item.type ?? '—'}
                    </p>
                    <p className="text-muted-foreground">
                      Ngày SC: {item.date ?? '—'} · {item.groupName ?? '—'}
                    </p>
                    <p className="text-xs font-medium text-orange-600 dark:text-orange-400">
                      Còn {days} ngày · xóa lúc {formatTrashDeletedAt(item.deletedAtMs)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => handleRestore(item)}
                    >
                      Khôi phục
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={busy}
                      onClick={() => handlePermanentDelete(item)}
                    >
                      Xóa vĩnh viễn
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
