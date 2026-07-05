import { useEffect, useState } from 'react'
import type { IncidentRecord } from '@/types/incident'
import { buildAutoWordTitles, incidentDateRange, matchesWordVolumeFilter, sortForWordExport } from '@/lib/wordReportUtils'
import { loadAllWordPhotoSelections } from '@/lib/wordPhotoSelection'
import { exportIncidentsWord } from '@/services/wordExportService'
import { Dialog } from '@/components/ui/dialog'
import { Button, Input, Label } from '@/components/ui/primitives'
import { WordPhotoPickerDialog } from '@/components/export/WordPhotoPickerDialog'
import { toast } from 'sonner'

type Props = {
  open: boolean
  onClose: () => void
  uid: string
  items: IncidentRecord[]
}

export function WordExportDialog({ open, onClose, uid, items }: Props) {
  const [under100, setUnder100] = useState(true)
  const [over100, setOver100] = useState(true)
  const [title1, setTitle1] = useState('')
  const [title2, setTitle2] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState('')
  const [selectionCount, setSelectionCount] = useState(0)

  useEffect(() => {
    if (!open || !items.length) return
    const { title1: t1, title2: t2 } = buildAutoWordTitles(items)
    setTitle1(t1)
    setTitle2(t2)
    setUnder100(true)
    setOver100(true)
  }, [open, items])

  const finalList = sortForWordExport(items).filter((inc) =>
    matchesWordVolumeFilter(inc, under100, over100),
  )

  const filterSuffix =
    under100 && over100 ? '' : under100 ? ' (dưới 100m3)' : over100 ? ' (trên 100m3)' : ''

  const range = incidentDateRange(finalList)
  const title2Final =
    finalList.length > 0
      ? `(Do ảnh hưởng của các đợt mưa, lũ từ ngày ${range.start} đến ngày ${range.end})`
      : title2

  async function handleExport() {
    if (!finalList.length) {
      toast.error('Không có sự cố phù hợp bộ lọc')
      return
    }
    setExporting(true)
    setProgress('Đang chuẩn bị...')
    try {
      const selections = loadAllWordPhotoSelections(uid)
      await exportIncidentsWord(
        finalList,
        title1 + filterSuffix,
        title2Final,
        selections,
        (_c, _t, msg) => setProgress(msg),
      )
      toast.success('Đã xuất Word')
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi xuất Word')
    } finally {
      setExporting(false)
      setProgress('')
    }
  }

  useEffect(() => {
    if (!open) return
    const sel = loadAllWordPhotoSelections(uid)
    const n = finalList.filter((inc) => sel[inc.id]?.before || sel[inc.id]?.after).length
    setSelectionCount(n)
  }, [open, uid, finalList, under100, over100])

  return (
    <>
      <Dialog open={open} onClose={onClose} title="Xuất Word — ghép ảnh">
        <div className="space-y-3">
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={under100}
                onChange={(e) => setUnder100(e.target.checked)}
              />
              Dưới 100 m³
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={over100}
                onChange={(e) => setOver100(e.target.checked)}
              />
              Trên 100 m³
            </label>
          </div>

          <div>
            <Label>Tiêu đề dòng 1</Label>
            <Input className="mt-1" value={title1} onChange={(e) => setTitle1(e.target.value)} />
          </div>
          <div>
            <Label>Tiêu đề dòng 2</Label>
            <Input className="mt-1" value={title2Final} readOnly />
          </div>

          <p className="text-sm text-muted-foreground">
            {finalList.length} sự cố sau lọc · khổ ngang · 2 cột trước/sau
          </p>

          <Button
            type="button"
            variant="outline"
            className="h-11 w-full"
            onClick={() => setPickerOpen(true)}
          >
            Chọn ảnh ghép ({selectionCount}/{finalList.length} đã chọn)
          </Button>

          {exporting && progress ? (
            <p className="text-center text-sm text-primary">{progress}</p>
          ) : null}

          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Huỷ
            </Button>
            <Button
              type="button"
              className="flex-1"
              disabled={exporting}
              onClick={() => void handleExport()}
            >
              {exporting ? 'Đang xuất...' : 'Xuất Word'}
            </Button>
          </div>
        </div>
      </Dialog>

      <WordPhotoPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        uid={uid}
        items={finalList}
        onChange={() => {
          const sel = loadAllWordPhotoSelections(uid)
          const n = finalList.filter((inc) => sel[inc.id]?.before || sel[inc.id]?.after).length
          setSelectionCount(n)
        }}
      />
    </>
  )
}
