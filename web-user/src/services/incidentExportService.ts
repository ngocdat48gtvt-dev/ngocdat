import type { DispatchFilters, IncidentRecord } from '@/types/incident'
import {
  buildIncidentExportWorkbook,
  isBaoLuExport,
  sortIncidentsForExport,
} from '@/lib/excelReportBuilder'

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
