import type { DispatchFilters, IncidentRecord } from '@/types/incident'
import {
  buildIncidentExportWorkbook,
  isBaoLuExport,
  sortIncidentsForExport,
} from '@/lib/excelReportBuilder'
import { computeKhoiLuong, resolveIncidentUnit } from '@/lib/incidentUtils'
import {
  buildIncidentWordReport,
  type WordExportOptions,
} from '@/lib/wordReportBuilder'

function isoToFileDate(iso?: string): string {
  if (!iso?.trim()) return ''
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return ''
  return `${d}-${m}-${y}`
}

function todayFileDate(): string {
  const d = new Date()
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return `${day}-${month}-${d.getFullYear()}`
}

export function buildBaoCaoSuCoFilename(
  items: IncidentRecord[],
  filters?: Pick<DispatchFilters, 'dateFrom' | 'dateTo'>,
): string {
  const fromFilter = isoToFileDate(filters?.dateFrom)
  const toFilter = isoToFileDate(filters?.dateTo)
  if (fromFilter || toFilter) {
    const from = fromFilter || toFilter || todayFileDate()
    const to = toFilter || fromFilter || from
    return `Bao cao su co tu ngay ${from} den ${to}.xlsx`
  }

  const sorted = sortIncidentsForExport(items)
  const start = sorted[0]?.date?.replace(/\//g, '-') ?? todayFileDate()
  const end = sorted[sorted.length - 1]?.date?.replace(/\//g, '-') ?? start
  return `Bao cao su co tu ngay ${start} den ${end}.xlsx`
}

/** Xuất Excel — viền, căn chữ, công thức khớp app ExcelExporter. */
export async function exportIncidentsExcel(
  items: IncidentRecord[],
  filename: string,
  options?: { groupFilter?: string },
): Promise<void> {
  const baoLuMode = isBaoLuExport(options?.groupFilter, items)
  const wb = await buildIncidentExportWorkbook(items, baoLuMode)
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Lọc theo khối lượng cho báo cáo Word (khớp matchesWordVolumeFilter của app):
 * chỉ áp ngưỡng 100 cho đơn vị m³; đơn vị khác luôn qua nếu có chọn ngưỡng nào.
 */
export function matchesWordVolumeFilter(
  inc: IncidentRecord,
  under100: boolean,
  over100: boolean,
): boolean {
  if (!under100 && !over100) return false
  const unit = resolveIncidentUnit(inc)
  if (unit !== 'm³') return under100 || over100
  const vol = computeKhoiLuong(inc)
  return vol <= 100 ? under100 : over100
}

export function buildBaoCaoAnhFilename(
  items: IncidentRecord[],
  filters?: Pick<DispatchFilters, 'dateFrom' | 'dateTo'>,
): string {
  const fromFilter = isoToFileDate(filters?.dateFrom)
  const toFilter = isoToFileDate(filters?.dateTo)
  if (fromFilter || toFilter) {
    const from = fromFilter || toFilter || todayFileDate()
    const to = toFilter || fromFilter || from
    return `Bao cao anh su co tu ngay ${from} den ngay ${to}.docx`
  }
  const sorted = sortIncidentsForExport(items)
  const start = sorted[0]?.date?.replace(/\//g, '-') ?? todayFileDate()
  const end = sorted[sorted.length - 1]?.date?.replace(/\//g, '-') ?? start
  return `Bao cao anh su co tu ngay ${start} den ngay ${end}.docx`
}

/** Xuất Word ghép ảnh hiện trạng + sau xử lý (logic giống app). Trả về số ảnh tải lỗi. */
export async function exportIncidentsWord(
  items: IncidentRecord[],
  filename: string,
  options: WordExportOptions,
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  const { blob, failedImages } = await buildIncidentWordReport(items, options, onProgress)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.docx') ? filename : `${filename}.docx`
  a.click()
  URL.revokeObjectURL(url)
  return failedImages
}

export function exportIncidentsWordHtml(items: IncidentRecord[], filename: string) {
  const rows = items
    .map((inc) => {
      return `<tr>
        <td>${inc.road ?? ''}</td>
        <td>${inc.km ?? ''}</td>
        <td>${inc.position ?? ''}</td>
        <td>${inc.type ?? ''}</td>
        <td>${inc.progress ?? 0}%</td>
        <td>${inc.date ?? ''}</td>
        <td>${inc.completedDate ?? ''}</td>
      </tr>`
    })
    .join('')

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
    <title>Báo cáo sự cố</title></head><body>
    <h2>Báo cáo điều hành sự cố đường bộ</h2>
    <table border="1" cellpadding="4" cellspacing="0">
    <thead><tr>
      <th>Tuyến</th><th>Lý trình</th><th>Phía</th><th>Loại</th>
      <th>Tiến độ</th><th>Ngày xảy ra</th><th>Ngày hoàn thành</th>
    </tr></thead><tbody>${rows}</tbody></table></body></html>`

  const blob = new Blob(['\ufeff', html], { type: 'application/msword' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.doc') ? filename : `${filename}.doc`
  a.click()
  URL.revokeObjectURL(url)
}
