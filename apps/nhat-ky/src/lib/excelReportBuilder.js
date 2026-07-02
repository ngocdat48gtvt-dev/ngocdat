import ExcelJS from 'exceljs'

import {
  isSaBoiCungType,
  resolveSoilPercent,
} from "../utils/incidentUtils";

/** Khớp ExcelExporter.kt — nhóm Bão lũ: biểu PHỤ LỤC 11 cột. */
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

const BAO_LU_COL_WIDTHS = [8, 16, 16, 11, 11, 11, 11, 12, 12, 18, 31]
const STANDARD_COL_WIDTHS = [8, 16, 10, 10, 10, 10, 10, 12, 28]

export function toRoman(num) {
  return ROMAN[num] ?? String(num)
}

export function parseKmMetersParts(km) {
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

export function chainageExcelValue(km) {
  const { km: k, m } = parseKmMetersParts(km)
  return k * 1000 + m
}

export function isBaoLuExport(groupFilter, items) {
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

export function sortIncidentsForExport(items) {
  return [...items].sort((a, b) => {
    const typeCmp = (a.type ?? '').localeCompare(b.type ?? '')
    if (typeCmp !== 0) return typeCmp
    return chainageExcelValue(a.km) - chainageExcelValue(b.km)
  })
}

function volumeFormula(excelRow1, daiCol, rongCol, caoCol) {
  return (
    `IF(${daiCol}${excelRow1}<>"",${daiCol}${excelRow1},1)*` +
    `IF(${rongCol}${excelRow1}<>"",${rongCol}${excelRow1},1)*` +
    `IF(${caoCol}${excelRow1}<>"",${caoCol}${excelRow1},1)`
  )
}

function dimValue(value) {
  const v = value ?? 0
  return v > 0 ? v : null
}

function thinBorder() {
  const edge = { style: 'thin' }
  return { top: edge, left: edge, bottom: edge, right: edge }
}

const FONT = { name: 'Arial', size: 13 }

function createSheetStyles() {
  const border = thinBorder()
  const font13 = { ...FONT }
  const font13Bold = { ...FONT, bold: true }

  return {
    title: {
      font: font13Bold,
      alignment: { horizontal: 'center', vertical: 'middle' },
      border,
    },
    subtitle: {
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
function setCellStyle(cell, style) {
  cell.style = {
    font: { ...FONT, ...(style.font || {}) },
    alignment: style.alignment ?? { vertical: "middle" },
    border: style.border ?? thinBorder(),
    ...(style.numFmt ? { numFmt: style.numFmt } : {})
  };
}

function paintRow(row, colCount, style) {
  for (let c = 1; c <= colCount; c++) {
    setCellStyle(row.getCell(c), style)
  }
}

function paintSectionHeaderRow(
  row,
  colCount,
  volCol,
  styles,
) {
  for (let c = 1; c <= colCount; c++) {
    if (c === 1) setCellStyle(row.getCell(c), styles.roman)
    else if (c === 2) setCellStyle(row.getCell(c), styles.typeName)
    else if (c === volCol + 1) setCellStyle(row.getCell(c), styles.total)
    else setCellStyle(row.getCell(c), styles.plain)
  }
}

function paintBaoLuSectionHeaderRow(
  row,
  colCount,
  volSoilCol,
  volRockCol,
  styles,
) {
  for (let c = 1; c <= colCount; c++) {
    if (c === 1) setCellStyle(row.getCell(c), styles.roman)
    else if (c === 2) setCellStyle(row.getCell(c), styles.typeName)
    else if (c === volSoilCol + 1 || c === volRockCol + 1) {
      setCellStyle(row.getCell(c), styles.total)
    } else setCellStyle(row.getCell(c), styles.plain)
  }
}

function paintDataRow(
  row,
  colCount,
  volCol,
  daiIdx,
  rongIdx,
  caoIdx,
  noteIdx,
  baoLuMode,
  styles,
) {
  for (let c = 1; c <= colCount; c++) {
    setCellStyle(row.getCell(c), styles.plain)
  }
  setCellStyle(row.getCell(1), styles.center)
  setCellStyle(row.getCell(2), styles.km)
  if (baoLuMode) {
    setCellStyle(row.getCell(3), styles.km)
    setCellStyle(row.getCell(4), styles.center)
    setCellStyle(row.getCell(5), styles.number)
    setCellStyle(row.getCell(6), styles.number)
    setCellStyle(row.getCell(7), styles.number)
    setCellStyle(row.getCell(8), styles.number)
    setCellStyle(row.getCell(9), styles.number)
    setCellStyle(row.getCell(10), styles.number)
  } else {
    setCellStyle(row.getCell(3), styles.center)
    setCellStyle(row.getCell(4), styles.center)
  }
  setCellStyle(row.getCell(daiIdx + 1), styles.number)
  setCellStyle(row.getCell(rongIdx + 1), styles.number)
  setCellStyle(row.getCell(caoIdx + 1), styles.number)
  if (!baoLuMode) {
    setCellStyle(row.getCell(volCol + 1), styles.number)
  }
  setCellStyle(row.getCell(noteIdx + 1), styles.note)
}

function colLetter(zeroBased) {
  return String.fromCharCode('A'.charCodeAt(0) + zeroBased)
}

function writeBaoLuTitle(
  sheet,
  styles,
  items,
  colCount,
) {
  const dates = items.map((i) => i.date?.trim() ?? '').filter(Boolean)
  const startDate = dates.length ? [...dates].sort()[0] : '......'
  const endDate = dates.length ? [...dates].sort().at(-1) ?? '...........' : '...........'
  const road =
    items.map((i) => i.road?.trim() ?? '').find((r) => r.length > 0) ?? '....'

  const titleRow = sheet.addRow([
    `PHỤ LỤC KHỐI LƯỢNG THIỆT HẠI DO ẢNH HƯỞNG CỦA ĐỢT MƯA (TỪ NGÀY ${startDate} ĐẾN NGÀY ${endDate})`,
  ])
  sheet.mergeCells(1, 1, 1, colCount)
  paintRow(titleRow, colCount, styles.title)
  titleRow.height = 22

  const roadRow = sheet.addRow([road])
  sheet.mergeCells(2, 1, 2, colCount)
  paintRow(roadRow, colCount, styles.subtitle)
  roadRow.height = 20
}

/** Header 2 tầng — hàng 3–4 (1-based), khớp writeBaoLuHeader (Kotlin). */
function writeBaoLuHeader(sheet, styles, colCount) {
  const row1 = sheet.addRow(new Array(colCount).fill(''))
  const row2 = sheet.addRow(new Array(colCount).fill(''))
  const r1 = row1.number
  const r2 = row2.number

  row1.getCell(1).value = 'STT'
  sheet.mergeCells(r1, 1, r2, 1)

  row1.getCell(2).value = 'Lý Trình'
  sheet.mergeCells(r1, 2, r1, 3)
  row2.getCell(2).value = 'Từ Km'
  row2.getCell(3).value = 'Đến Km'

  row1.getCell(4).value = 'Vị trí'
  sheet.mergeCells(r1, 4, r2, 4)

  row1.getCell(5).value = 'Kích thước'
  sheet.mergeCells(r1, 5, r1, 7)
  row2.getCell(5).value = 'Dài'
  row2.getCell(6).value = 'Rộng'
  row2.getCell(7).value = 'Cao'

  row1.getCell(8).value = 'Khối lượng (m3)'
  sheet.mergeCells(r1, 8, r1, 9)
  row2.getCell(8).value = 'Đất'
  row2.getCell(9).value = 'Đá'

  row1.getCell(10).value = 'KL đã thực hiện ĐBGT'
  sheet.mergeCells(r1, 10, r2, 10)

  row1.getCell(11).value = 'Ghi chú'
  sheet.mergeCells(r1, 11, r2, 11)

  paintRow(row1, colCount, styles.header)
  paintRow(row2, colCount, styles.header)
  row1.height = 20
  row2.height = 20
}

async function buildBaoLuWorkbook(items) {
  const lastCol = 10
  const colCount = lastCol + 1
  const volSoilCol = 7
  const volRockCol = 8
  const noteIdx = lastCol
  const daiCol = 'E'
  const rongCol = 'F'
  const caoCol = 'G'

  const styles = createSheetStyles()
  const wb = new Object()
  const sheet = wb.addWorksheet('BaoCao', {
    views: [{ state: 'frozen', ySplit: 4, activeCell: 'A5' }],
  })

  BAO_LU_COL_WIDTHS.forEach((wch, i) => {
    sheet.getColumn(i + 1).width = wch
  })

  writeBaoLuTitle(sheet, styles, items, colCount)
  writeBaoLuHeader(sheet, styles, colCount)

  const sorted = sortIncidentsForExport(items)
  let currentType = ''
  let typeIndex = 0
  let itemIndex = 0
  let section = null;
  const sections = [];

  const closeSection = () => {
    if (!section) return
    section.dataEndRowExclusive = (sheet.lastRow?.number ?? section.dataStartRow) + 1
    sections.push(section)
    section = null
  }

  const openSection = (typeName) => {
    typeIndex += 1
    itemIndex = 0
    const row = sheet.addRow([toRoman(typeIndex), typeName])
    const headerRowNum = row.number
    sheet.mergeCells(headerRowNum, 2, headerRowNum, 3)
    paintBaoLuSectionHeaderRow(row, colCount, volSoilCol, volRockCol, styles)

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

    paintDataRow(row, colCount, volSoilCol, 4, 5, 6, noteIdx, true, styles)

    row.getCell(1).value = itemIndex
    row.getCell(2).value = chainageExcelValue(inc.km)

    if (isSaBoiCungType(inc.type)) {
      row.getCell(3).value = inc.pipeType?.trim() ?? ''
      setCellStyle(row.getCell(3), styles.center)
    } else {
      row.getCell(3).value = { formula: `B${excelRow1}+E${excelRow1}` }
    }

    row.getCell(4).value = inc.position?.trim() ?? ''

    const dai = dimValue(inc.dai)
    if (dai != null) row.getCell(5).value = dai

    const rong = dimValue(inc.rong)
    if (rong != null) row.getCell(6).value = rong

    const cao = dimValue(inc.cao)
    if (cao != null) row.getCell(7).value = cao

    const volFormula = volumeFormula(excelRow1, daiCol, rongCol, caoCol)
    const soilPct = resolveSoilPercent(inc.geologyType, inc.soilPercent)
    const rockPct = 100 - soilPct
    if (soilPct > 0) {
      row.getCell(8).value = { formula: `(${volFormula})*${soilPct}/100` }
    }
    if (rockPct > 0) {
      row.getCell(9).value = { formula: `(${volFormula})*${rockPct}/100` }
    }

    row.getCell(11).value = inc.note?.trim() ?? ''
  }

  closeSection()

  const soilLetter = colLetter(volSoilCol)
  const rockLetter = colLetter(volRockCol)
  for (const sec of sections) {
    if (sec.dataEndRowExclusive <= sec.dataStartRow) continue
    const header = sheet.getRow(sec.headerRow)
    const lastDataRow = sec.dataEndRowExclusive - 1
    if (lastDataRow >= sec.dataStartRow) {
      const soilTotal = header.getCell(volSoilCol + 1)
      soilTotal.value = {
        formula: `SUM(${soilLetter}${sec.dataStartRow}:${soilLetter}${lastDataRow})`,
      }
      setCellStyle(soilTotal, styles.total)

      const rockTotal = header.getCell(volRockCol + 1)
      rockTotal.value = {
        formula: `SUM(${rockLetter}${sec.dataStartRow}:${rockLetter}${lastDataRow})`,
      }
      setCellStyle(rockTotal, styles.total)
    }
    setCellStyle(header.getCell(1), styles.roman)
    setCellStyle(header.getCell(2), styles.typeName)
  }

  return wb
}

async function buildStandardWorkbook(items) {
  const lastCol = 8
  const colCount = lastCol + 1
  const headers = ['STT', 'Lý trình', 'Phía', 'Đơn vị', 'Dài', 'Rộng', 'Cao', 'Khối lượng', 'Ghi chú']

  const daiCol = 'E'
  const rongCol = 'F'
  const caoCol = 'G'
  const volCol = 7
  const daiIdx = 4
  const rongIdx = daiIdx + 1
  const caoIdx = daiIdx + 2
  const noteIdx = lastCol

  const styles = createSheetStyles()
  const wb = new Object()
  const sheet = wb.addWorksheet('BaoCao', {
    views: [{ state: 'frozen', ySplit: 2, activeCell: 'A3' }],
  })

  STANDARD_COL_WIDTHS.forEach((wch, i) => {
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
  let section = null;
  const sections = [];

  const closeSection = () => {
    if (!section) return
    section.dataEndRowExclusive = (sheet.lastRow?.number ?? section.dataStartRow) + 1
    sections.push(section)
    section = null
  }

  const openSection = (typeName) => {
    typeIndex += 1
    itemIndex = 0
    const row = sheet.addRow([toRoman(typeIndex), typeName])
    paintSectionHeaderRow(row, colCount, volCol, styles)

    section = {
      headerRow: row.number,
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
      false,
      styles,
    )

    row.getCell(1).value = itemIndex
    row.getCell(2).value = chainageExcelValue(inc.km)
    row.getCell(3).value = inc.position?.trim() ?? ''
    row.getCell(4).value = inc.unit?.trim() ?? ''

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

export async function buildIncidentExportWorkbook(items, baoLuMode) {
  if (baoLuMode) return buildBaoLuWorkbook(items)
  return buildStandardWorkbook(items)
}
