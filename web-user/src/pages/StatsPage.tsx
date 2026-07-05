import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { useIncidents } from '@/hooks/useIncidents'
import { applyDispatchFilters, computeDispatchSummary, formatVolumeM3Display } from '@/lib/incidentStats'
import { emptyDispatchFilters } from '@/types/incident'
import { buildBaoCaoSuCoFilename, exportIncidentsExcel } from '@/services/incidentExportService'
import { exportIncidentsZip } from '@/services/zipExportService'
import { WordExportDialog } from '@/components/export/WordExportDialog'
import { Button, Card, Input, Label } from '@/components/ui/primitives'

export function StatsPage() {
  const { user } = useAuth()
  const { items } = useIncidents(user?.uid)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [groupFilter, setGroupFilter] = useState('')
  const [exporting, setExporting] = useState(false)
  const [wordOpen, setWordOpen] = useState(false)

  const groups = useMemo(() => [...new Set(items.map((i) => i.groupName).filter(Boolean))], [items])

  const filtered = useMemo(
    () =>
      applyDispatchFilters(items, {
        ...emptyDispatchFilters,
        groupName: groupFilter,
        dateFrom,
        dateTo,
      }),
    [items, groupFilter, dateFrom, dateTo],
  )

  const summary = computeDispatchSummary(filtered)

  async function runExport(kind: 'excel' | 'zip') {
    if (!filtered.length) {
      toast.error('Không có dữ liệu để xuất')
      return
    }
    setExporting(true)
    try {
      if (kind === 'excel') {
        const name = buildBaoCaoSuCoFilename(filtered, { dateFrom, dateTo })
        await exportIncidentsExcel(filtered, name, { groupFilter })
        toast.success('Đã xuất Excel')
      } else {
        await exportIncidentsZip(filtered, 'anh_su_co.zip')
        toast.success('Đã xuất ZIP ảnh')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Xuất thất bại')
    } finally {
      setExporting(false)
    }
  }

  function openWordExport() {
    if (!filtered.length) {
      toast.error('Không có dữ liệu để xuất')
      return
    }
    setWordOpen(true)
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Thống kê</h2>

      <Card className="grid gap-2 p-4 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Từ ngày</Label>
            <Input className="mt-1 h-10" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <Label>Đến ngày</Label>
            <Input className="mt-1 h-10" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>
        <div>
          <Label>Nhóm (Excel Bão lũ)</Label>
          <select
            className="mt-1 h-10 w-full rounded-lg border px-2"
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
          >
            <option value="">Tất cả</option>
            {groups.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
      </Card>

      <Card className="grid grid-cols-2 gap-3 p-4 text-sm">
        <div>
          <p className="text-2xl font-bold">{summary.total}</p>
          <p className="text-muted-foreground">Sự cố</p>
        </div>
        <div>
          <p className="text-2xl font-bold">{formatVolumeM3Display(summary.volumeM3)}</p>
          <p className="text-muted-foreground">Tổng m³</p>
        </div>
        <div><p className="font-semibold">{summary.newCount}</p><p className="text-muted-foreground">Chưa xử lý</p></div>
        <div><p className="font-semibold">{summary.partialCount}</p><p className="text-muted-foreground">Đang xử lý</p></div>
        <div><p className="font-semibold text-green-700">{summary.doneCount}</p><p className="text-muted-foreground">Hoàn thành</p></div>
      </Card>

      <div className="grid gap-2">
        <Button className="h-12" disabled={exporting} onClick={() => void runExport('excel')}>
          Xuất Excel
        </Button>
        <Button variant="outline" className="h-12" disabled={exporting} onClick={openWordExport}>
          Xuất Word (ghép ảnh)
        </Button>
        <Button variant="outline" className="h-12" disabled={exporting} onClick={() => void runExport('zip')}>
          ZIP ảnh
        </Button>
      </div>

      {user ? (
        <WordExportDialog
          open={wordOpen}
          onClose={() => setWordOpen(false)}
          uid={user.uid}
          items={filtered}
        />
      ) : null}
    </div>
  )
}
