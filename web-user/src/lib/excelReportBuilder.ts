import ExcelJS from 'exceljs'
import type { IncidentRecord } from '@/types/incident'

/** Khớp ExcelExporter.kt — nhóm Bão lũ: 10 cột + lý trình cuối (công thức). */
export const BAO_LU_GROUP = 'Bão lũ'

const KM_NUM_FMT = '"Km"0"+"000'

const ROMAN = [
  '',
  'I',
  'II',
  'III',
  'IV',
  'V',
  'VI',
  'VII',
  'VIII',
  'IX',
  'X',
  'XI',
  'XII',
  'XIII',
  'XIV',
  'XV',
]

const BAO_LU_COL_WIDTHS = [8, 14, 14, 10, 10, 10, 10, 10, 12, 28]
const STANDARD_COL_WIDTHS = [8, 16, 10, 10, 10, 10, 10, 12, 28]

export function toRoman(num: number): string {
  return ROMAN[num] ?? String(num)
}

export function parseKmMetersParts(km?: string): { km: number; m: number } {
  if (!km?.trim()) return { km: 0, m: 0 }

  const clean = km.replace(/Km/gi, '').replace(/\s/g, '').trim()

  if (clean.includes('+')) {
    const [kmPart, mPart] = clean.split('+', 2)
    const kmNum = parseInt(kmPart, 10) || 0
    const mNum = Math.min(999, Math.max(0, parseInt(mPart, 10) || 0))
    return { km: kmNum, m: mNum }
  }

  const digits = clean.replace(/\D/g, '')
  if (!digits) return { km: 0, m: 0 }
  const n = parseInt(digits, 10)
  if (n >= 1000) {
    return { km: Math.floor(n / 1000), m: n % 1000 }
  }
  return { km: n, m: 0 }
}

export function chainageExcelValue(km?: string): number {
  const { km: k, m } = parseKmMetersParts(km)
  return k * 1000 + m
}

export function isBaoLuExport(groupFilter: string | undefined, items: IncidentRecord[]): boolean {
  const g = groupFilter?.trim() ?? ''
  if (g.localeCompare(BAO_LU_GROUP, 'vi', { sensitivity: 'accent' }) === 0) return true
  if (!g) {
    return (
      items.length > 0 &&
      items.every(
        (i) =>
          (i.groupName?.trim() ?? '').localeCompare(BAO_LU_GROUP, 'vi', {
            sensitivity: 'accent',
          }) === 0,
      )
    )
  }
  return false
}

export function sortIncidentsForExport(items: IncidentRecord[]): IncidentRecord[] {
  return [...items].sort((a, b) => {
    const typeCmp = (a.type ?? '').localeCompare(b.type ?? '')
    if (typeCmp !== 0) return typeCmp
    return chainageExcelValue(a.km) - chainageExcelValue(b.km)
  })
}

function volumeFormula(excelRow1: number, daiCol: string, rongCol: string, caoCol: string): string {
  return (
    `IF(${daiCol}${excelRow1}<>"",${daiCol}${excelRow1},1)*` +
    `IF(${rongCol}${excelRow1}<>"",${rongCol}${excelRow1},1)*` +
    `IF(${caoCol}${excelRow1}<>"",${caoCol}${excelRow1},1)`
  )
}

function dimValue(value?: number): number | null {
  const v = value ?? 0
  return v > 0 ? v : null
}

type SectionState = {
  headerRow: number
  dataStartRow: number
  dataEndRowExclusive: number
}

function thinBorder(): Partial<ExcelJS.Borders> {
  const edge = { style: 'thin' as const }
  return { top: edge, left: edge, bottom: edge, right: edge }
}

type SheetStyles = {
  title: Partial<ExcelJS.Style>
  header: Partial<ExcelJS.Style>
  roman: Partial<ExcelJS.Style>
  typeName: Partial<ExcelJS.Style>
  total: Partial<ExcelJS.Style>
  center: Partial<ExcelJS.Style>
  km: Partial<ExcelJS.Style>
  number: Partial<ExcelJS.Style>
  note: Partial<ExcelJS.Style>
  plain: Partial<ExcelJS.Style>
}

const FONT = { name: 'Arial', size: 13 } as const

function createSheetStyles(): SheetStyles {
  const border = thinBorder()
  const font13 = { ...FONT }
  const font13Bold = { ...FONT, bold: true as const }

  return {
    title: {
      font: font13Bold,
      alignment: { horizontal: 'center', vertical: 'middle' },
      border,
    },
    header: {
      font: font13Bold,
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      border,
    },
    roman: {
      font: font13Bold,
      alignment: { horizontal: 'center', vertical: 'middle' },
      border,
    },
    typeName: {
      font: font13Bold,
      alignment: { horizontal: 'left', vertical: 'middle' },
      border,
    },
    total: {
      font: font13Bold,
      alignment: { horizontal: 'center', vertical: 'middle' },
      numFmt: '0.00',
      border,
    },
    center: {
      font: font13,
      alignment: { horizontal: 'center', vertical: 'middle' },
      border,
    },
    km: {
      font: font13,
      alignment: { horizontal: 'center', vertical: 'middle' },
      numFmt: KM_NUM_FMT,
      border,
    },
    number: {
      font: font13,
      alignment: { horizontal: 'center', vertical: 'middle' },
      numFmt: '0.00',
      border,
    },
    note: {
      font: font13,
      alignment: { horizontal: 'left', vertical: 'top', wrapText: true },
      border,
    },
    plain: { font: font13, border },
  }
}

/** Gán style đầy đủ (tránh spread làm mất bold trong ExcelJS). */
function setCellStyle(cell: ExcelJS.Cell, style: Partial<ExcelJS.Style>) {
  cell.style = {
    font: { ...FONT, ...(style.font as ExcelJS.Font | undefined) },
    alignment: style.alignment ?? { vertical: 'middle' },
    border: (style.border as ExcelJS.Borders) ?? thinBorder(),
    ...(style.numFmt ? { numFmt: style.numFmt } : {}),
  }
}

function paintRow(row: ExcelJS.Row, colCount: number, style: Partial<ExcelJS.Style>) {
  for (let c = 1; c <= colCount; c++) {
    setCellStyle(row.getCell(c), style)
  }
}

/** Dòng loại: I/II đậm, tên loại đậm, tổng KL đậm; ô khác thường. */
function paintSectionHeaderRow(
  row: ExcelJS.Row,
  colCount: number,
  volCol: number,
  styles: SheetStyles,
) {
  for (let c = 1; c <= colCount; c++) {
    if (c === 1) setCellStyle(row.getCell(c), styles.roman)
    else if (c === 2) setCellStyle(row.getCell(c), styles.typeName)
    else if (c === volCol + 1) setCellStyle(row.getCell(c), styles.total)
    else setCellStyle(row.getCell(c), styles.plain)
  }
}

function paintDataRow(
  row: ExcelJS.Row,
  colCount: number,
  volCol: number,
  daiIdx: number,
  rongIdx: number,
  caoIdx: number,
  noteIdx: number,
  baoLuMode: boolean,
  styles: SheetStyles,
) {
  for (let c = 1; c <= colCount; c++) {
    setCellStyle(row.getCell(c), styles.plain)
  }
  setCellStyle(row.getCell(1), styles.center)
  setCellStyle(row.getCell(2), styles.km)
  if (baoLuMode) {
    setCellStyle(row.getCell(3), styles.km)
    setCellStyle(row.getCell(4), styles.center)
    setCellStyle(row.getCell(5), styles.center)
  } else {
    setCellStyle(row.getCell(3), styles.center)
    setCellStyle(row.getCell(4), styles.center)
  }
  setCellStyle(row.getCell(daiIdx + 1), styles.number)
  setCellStyle(row.getCell(rongIdx + 1), styles.number)
  setCellStyle(row.getCell(caoIdx + 1), styles.number)
  setCellStyle(row.getCell(volCol + 1), styles.number)
  setCellStyle(row.getCell(noteIdx + 1), styles.note)
}

function colLetter(zeroBased: number): string {
  return String.fromCharCode('A'.charCodeAt(0) + zeroBased)
}

export async function buildIncidentExportWorkbook(
  items: IncidentRecord[],
  baoLuMode: boolean,
): Promise<ExcelJS.Workbook> {
  const lastCol = baoLuMode ? 9 : 8
  const colCount = lastCol + 1
  const headers = baoLuMode
    ? [
        'STT',
        'Lý trình đầu',
        'Lý trình cuối',
        'Phía',
        'Đơn vị',
        'Dài',
        'Rộng',
        'Cao',
        'Khối lượng',
        'Ghi chú',
      ]
    : ['STT', 'Lý trình', 'Phía', 'Đơn vị', 'Dài', 'Rộng', 'Cao', 'Khối lượng', 'Ghi chú']

  const daiCol = baoLuMode ? 'F' : 'E'
  const rongCol = baoLuMode ? 'G' : 'F'
  const caoCol = baoLuMode ? 'H' : 'G'
  const volCol = baoLuMode ? 8 : 7
  const daiIdx = baoLuMode ? 5 : 4
  const rongIdx = daiIdx + 1
  const caoIdx = daiIdx + 2
  const noteIdx = lastCol

  const styles = createSheetStyles()
  const wb = new ExcelJS.Workbook()
  const sheet = wb.addWorksheet('BaoCao', {
    views: [{ state: 'frozen', ySplit: 2, activeCell: 'A3' }],
  })

  const widths = baoLuMode ? BAO_LU_COL_WIDTHS : STANDARD_COL_WIDTHS
  widths.forEach((wch, i) => {
    sheet.getColumn(i + 1).width = wch
  })

  const titleRow = sheet.addRow(['BÁO CÁO THỐNG KÊ SỰ CỐ'])
  sheet.mergeCells(1, 1, 1, colCount)
  paintRow(titleRow, colCount, styles.title)
  titleRow.height = 22

  const headerRow = sheet.addRow(headers)
  paintRow(headerRow, colCount, styles.header)
  headerRow.height = 20

  const sorted = sortIncidentsForExport(items)
  let currentType = ''
  let typeIndex = 0
  let itemIndex = 0
  let section: SectionState | null = null
  const sections: SectionState[] = []

  const closeSection = () => {
    if (!section) return
    section.dataEndRowExclusive = (sheet.lastRow?.number ?? section.dataStartRow) + 1
    sections.push(section)
    section = null
  }

  const openSection = (typeName: string) => {
    typeIndex += 1
    itemIndex = 0
    const row = sheet.addRow([toRoman(typeIndex), typeName])
    const headerRowNum = row.number
    if (baoLuMode && lastCol >= 2) {
      sheet.mergeCells(headerRowNum, 2, headerRowNum, 3)
    }

    paintSectionHeaderRow(row, colCount, volCol, styles)

    section = {
      headerRow: headerRowNum,
      dataStartRow: sheet.rowCount + 1,
      dataEndRowExclusive: sheet.rowCount + 1,
    }
  }

  for (const inc of sorted) {
    const type = inc.type?.trim() || 'Không rõ'
    if (type !== currentType) {
      closeSection()
      currentType = type
      openSection(type)
    }

    itemIndex += 1
    const row = sheet.addRow(new Array(colCount).fill(null))
    const excelRow1 = row.number

    paintDataRow(
      row,
      colCount,
      volCol,
      daiIdx,
      rongIdx,
      caoIdx,
      noteIdx,
      baoLuMode,
      styles,
    )

    row.getCell(1).value = itemIndex

    const kmVal = chainageExcelValue(inc.km)
    row.getCell(2).value = kmVal

    if (baoLuMode) {
      row.getCell(3).value = { formula: `B${excelRow1}+F${excelRow1}` }
    }

    row.getCell(4).value = inc.position?.trim() ?? ''
    row.getCell(5).value = inc.unit?.trim() ?? ''

    const dai = dimValue(inc.dai)
    if (dai != null) row.getCell(daiIdx + 1).value = dai

    const rong = dimValue(inc.rong)
    if (rong != null) row.getCell(rongIdx + 1).value = rong

    const cao = dimValue(inc.cao)
    if (cao != null) row.getCell(caoIdx + 1).value = cao

    row.getCell(volCol + 1).value = {
      formula: volumeFormula(excelRow1, daiCol, rongCol, caoCol),
    }

    row.getCell(noteIdx + 1).value = inc.note?.trim() ?? ''
  }

  closeSection()

  const volLetter = colLetter(volCol)
  for (const sec of sections) {
    if (sec.dataEndRowExclusive <= sec.dataStartRow) continue
    const header = sheet.getRow(sec.headerRow)
    const lastDataRow = sec.dataEndRowExclusive - 1
    if (lastDataRow >= sec.dataStartRow) {
      const totalCell = header.getCell(volCol + 1)
      totalCell.value = {
        formula: `SUM(${volLetter}${sec.dataStartRow}:${volLetter}${lastDataRow})`,
      }
      setCellStyle(totalCell, styles.total)
    }
    setCellStyle(header.getCell(1), styles.roman)
    setCellStyle(header.getCell(2), styles.typeName)
  }

  return wb
}
