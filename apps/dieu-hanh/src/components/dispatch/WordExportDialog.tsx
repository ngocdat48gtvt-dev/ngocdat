import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Button, Input, Label } from '@/components/ui/primitives'
import { toast } from 'sonner'
import type { DispatchFilters, IncidentRecord } from '@/types/incident'
import { parseViDate } from '@/lib/incidentFilters'
import {
  buildBaoCaoAnhFilename,
  exportIncidentsWord,
  matchesWordVolumeFilter,
} from '@/services/incidentExportService'

function formatViDate(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return `${day}/${month}/${d.getFullYear()}`
}

function incidentDateRange(items: IncidentRecord[]): { start: string; end: string } {
  let min: Date | null = null
  let max: Date | null = null
  for (const inc of items) {
    const d = inc.date ? parseViDate(inc.date) : null
    if (!d) continue
    if (!min || d < min) min = d
    if (!max || d > max) max = d
  }
  return {
    start: min ? formatViDate(min) : '',
    end: max ? formatViDate(max) : '',
  }
}

export function WordExportDialog({
  open,
  onClose,
  items,
  filters,
}: {
  open: boolean
  onClose: () => void
  items: IncidentRecord[]
  filters: DispatchFilters
}) {
  const defaults = useMemo(() => {
    const first = items[0]
    const road = first?.road ?? ''
    const type = first?.type ?? ''
    const { start, end } = incidentDateRange(items)
    return {
      title1: `ẢNH ${type.toUpperCase()} TRÊN ${road}`.trim(),
      title2:
        start && end
          ? `(Do ảnh hưởng của các đợt mưa, lũ từ ngày ${start} đến ngày ${end})`
          : '',
    }
  }, [items])

  const [title1, setTitle1] = useState(defaults.title1)
  const [title2, setTitle2] = useState(defaults.title2)
  const [under100, setUnder100] = useState(true)
  const [over100, setOver100] = useState(true)
  const [showStt, setShowStt] = useState(true)
  const [startStt, setStartStt] = useState('1')
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  useEffect(() => {
    if (open) {
      setTitle1(defaults.title1)
      setTitle2(defaults.title2)
      setUnder100(true)
      setOver100(true)
      setShowStt(true)
      setStartStt('1')
      setProgress(null)
    }
  }, [open, defaults])

  const finalList = useMemo(
    () => items.filter((inc) => matchesWordVolumeFilter(inc, under100, over100)),
    [items, under100, over100],
  )

  async function handleExport() {
    if (finalList.length === 0) {
      toast.error('Không có sự cố nào khớp bộ lọc khối lượng')
      return
    }
    setExporting(true)
    setProgress({ done: 0, total: finalList.length })
    try {
      const filterSuffix =
        under100 && !over100
          ? ' (dưới 100m3)'
          : !under100 && over100
            ? ' (trên 100m3)'
            : ''
      const failed = await exportIncidentsWord(
        finalList,
        buildBaoCaoAnhFilename(finalList, filters),
        {
          title1: title1 + filterSuffix,
          title2,
          showStt,
          startStt: Number(startStt) || 1,
        },
        (done, total) => setProgress({ done, total }),
      )
      if (failed > 0) {
        toast.warning(`Đã xuất Word, nhưng ${failed} ảnh không tải được (kiểm tra mạng/quyền ảnh)`)
      } else {
        toast.success('Đã xuất file Word')
      }
      onClose()
    } catch {
      toast.error('Không xuất được file Word')
    } finally {
      setExporting(false)
      setProgress(null)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Ghép báo cáo Word">
      <div className="space-y-4 text-sm">
        <div className="space-y-1.5">
          <Label>Tiêu đề dòng 1</Label>
          <Input value={title1} onChange={(e) => setTitle1(e.target.value)} disabled={exporting} />
        </div>
        <div className="space-y-1.5">
          <Label>Tiêu đề dòng 2</Label>
          <Input value={title2} onChange={(e) => setTitle2(e.target.value)} disabled={exporting} />
        </div>

        <div className="space-y-2 rounded-lg border border-border p-3">
          <p className="font-medium">Lọc theo khối lượng (chỉ áp cho m³)</p>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={under100}
              onChange={(e) => setUnder100(e.target.checked)}
              disabled={exporting}
            />
            Dưới (≤) 100 m³
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={over100}
              onChange={(e) => setOver100(e.target.checked)}
              disabled={exporting}
            />
            Trên (&gt;) 100 m³
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showStt}
              onChange={(e) => setShowStt(e.target.checked)}
              disabled={exporting}
            />
            Đánh số thứ tự
          </label>
          <div className="flex items-center gap-2">
            <Label className="m-0">STT bắt đầu</Label>
            <Input
              type="number"
              min={1}
              value={startStt}
              onChange={(e) => setStartStt(e.target.value)}
              disabled={exporting || !showStt}
              className="w-20"
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          {finalList.length} sự cố sẽ được ghép · mỗi sự cố 1 trang (ảnh hiện trạng | sau xử lý).
          Ảnh ưu tiên ảnh đã chọn, nếu chưa chọn dùng ảnh đầu tiên.
        </p>

        {progress ? (
          <p className="flex items-center gap-2 text-xs text-primary">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Đang xử lý ảnh {progress.done}/{progress.total}…
          </p>
        ) : null}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose} disabled={exporting}>
            Huỷ
          </Button>
          <Button type="button" onClick={handleExport} disabled={exporting}>
            {exporting ? 'Đang xuất…' : 'Ghép báo cáo'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
