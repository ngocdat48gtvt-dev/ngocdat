import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  PageBreak,
  PageOrientation,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx'

import { reportImageSlotsForExport } from "../utils/incidentUtils";
import { formatKmDisplay } from "@quanlysuco/shared";

const FONT = 'Times New Roman'

const IMG_WIDTH_PX = 457
const IMG_MAX_HEIGHT_REPORT_ROW_PX = Math.round((400 * 96) / 72)
const IMG_MAX_HEIGHT_FULL_ROW_PX = Math.round((500 * 96) / 72)
const RESIZE_MAX_SIDE = 1200
const JPEG_QUALITY = 0.82

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image load failed'))
    img.src = src
  })
}

function isLocalHost() {
  if (typeof window === 'undefined') return false
  const h = window.location.hostname
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]'
}

async function fetchImageBlob(url) {
  const candidates = [];
  if (!isLocalHost() && typeof window !== 'undefined') {
    candidates.push(`${window.location.origin}/api/img-proxy?url=${encodeURIComponent(url)}`)
  }
  candidates.push(url)

  for (const candidate of candidates) {
    try {
      const resp = await fetch(candidate, { mode: 'cors' })
      if (!resp.ok) continue
      const blob = await resp.blob()
      if (blob.size > 0) return blob
    } catch {
      /* thử ứng viên tiếp theo */
    }
  }
  return null
}

async function prepareImage(url) {
  let objectUrl = null;
  try {
    const blob = await fetchImageBlob(url)
    if (!blob) return null
    objectUrl = URL.createObjectURL(blob)
    const img = await loadImage(objectUrl)

    const natW = img.naturalWidth || img.width
    const natH = img.naturalHeight || img.height
    if (natW <= 0 || natH <= 0) return null

    const scale = Math.min(1, RESIZE_MAX_SIDE / Math.max(natW, natH))
    const outW = Math.max(1, Math.round(natW * scale))
    const outH = Math.max(1, Math.round(natH * scale))

    const canvas = document.createElement('canvas')
    canvas.width = outW
    canvas.height = outH
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, outW, outH)
    ctx.drawImage(img, 0, 0, outW, outH)

    const jpegBlob = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', JPEG_QUALITY),
    )
    if (!jpegBlob) return null
    const buf = await jpegBlob.arrayBuffer()
    return { data: new Uint8Array(buf), width: outW, height: outH }
  } catch {
    return null
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl)
  }
}

function displaySize(img, maxHeightPx) {
  const ratio = img.height / img.width
  let width = IMG_WIDTH_PX
  let height = Math.round(width * ratio)
  if (height > maxHeightPx) {
    height = maxHeightPx
    width = Math.round(height / ratio)
  }
  return { width, height }
}

function rowMaxHeightPx(rowIndex, isFirstReportPage) {
  if (rowIndex === 0) {
    return isFirstReportPage
      ? Math.round((320 * 96) / 72)
      : IMG_MAX_HEIGHT_REPORT_ROW_PX
  }
  return IMG_MAX_HEIGHT_FULL_ROW_PX
}

function incidentHeadingRow(text) {
  return new TableRow({
    cantSplit: true,
    children: [
      new TableCell({
        columnSpan: 2,
        verticalAlign: VerticalAlign.TOP,
        children: [
          new Paragraph({
            spacing: { before: 40, after: 40 },
            children: [new TextRun({ text, bold: true, font: FONT, size: 26 })],
          }),
        ],
      }),
    ],
  })
}

function headingParagraph(text) {
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    children: [new TextRun({ text, bold: true, font: FONT, size: 26 })],
  })
}

const CELL_BORDER = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }

const LABEL_BEFORE = 'Ảnh hiện trạng'
const LABEL_AFTER = 'Ảnh sau xử lý'

function makeImageTable(rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    alignment: AlignmentType.CENTER,
    borders: {
      top: NO_BORDER,
      bottom: NO_BORDER,
      left: NO_BORDER,
      right: NO_BORDER,
      insideHorizontal: NO_BORDER,
      insideVertical: NO_BORDER,
    },
    rows,
  })
}

function labelParagraph(slot) {
  const label = slot.kind === 'before' ? LABEL_BEFORE : LABEL_AFTER
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 20, after: 40 },
    children: [new TextRun({ text: label, bold: true, font: FONT, size: 24 })],
  })
}

function borderedImageTable(img, maxHeightPx) {
  const { width, height } = displaySize(img, maxHeightPx)
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    alignment: AlignmentType.CENTER,
    borders: {
      top: CELL_BORDER,
      bottom: CELL_BORDER,
      left: CELL_BORDER,
      right: CELL_BORDER,
      insideHorizontal: NO_BORDER,
      insideVertical: NO_BORDER,
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 0 },
                children: [
                  new ImageRun({
                    type: 'jpg',
                    data: img.data,
                    transformation: { width, height },
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  })
}

function labeledSlotCell(slot, maxHeightPx) {
  if (!slot) {
    return new TableCell({
      width: { size: 50, type: WidthType.PERCENTAGE },
      borders: {
        top: NO_BORDER,
        bottom: NO_BORDER,
        left: NO_BORDER,
        right: NO_BORDER,
      },
      children: [new Paragraph({ children: [] })],
    })
  }
  const children = [labelParagraph(slot)]
  if (slot.image) {
    children.push(borderedImageTable(slot.image, maxHeightPx))
  }
  return new TableCell({
    width: { size: 50, type: WidthType.PERCENTAGE },
    verticalAlign: VerticalAlign.TOP,
    borders: {
      top: NO_BORDER,
      bottom: NO_BORDER,
      left: NO_BORDER,
      right: NO_BORDER,
    },
    children,
  })
}

function imagePairRows(left, right, maxHeightPx) {
  const hasImage = Boolean(left?.image || right?.image)
  return [
    new TableRow({
      cantSplit: hasImage,
      children: [
        labeledSlotCell(left, maxHeightPx),
        labeledSlotCell(right, maxHeightPx),
      ],
    }),
  ]
}

function packPairs(slots) {
  const rows = []
  for (let i = 0; i < slots.length; i += 2) {
    rows.push([slots[i] ?? null, slots[i + 1] ?? null])
  }
  return rows
}

function buildSlotRowsFromOrdered(slots) {
  if (slots.length === 0) return []
  return packPairs(slots)
}

function imageTableBlocks(orderedSlots, isFirstReportPage, incidentHeading) {
  const rows = buildSlotRowsFromOrdered(orderedSlots)
  const breakFromRow = orderedSlots.length >= 3 ? 1 : null
  if (rows.length === 0) {
    const h = rowMaxHeightPx(0, isFirstReportPage)
    const tableRows = []
    if (incidentHeading?.trim()) {
      tableRows.push(incidentHeadingRow(incidentHeading.trim()))
    }
    tableRows.push(...imagePairRows(null, null, h))
    return [makeImageTable(tableRows)]
  }

  const blocks = []
  let tableRows = []
  let headingPending = incidentHeading?.trim() ?? ''

  const flushTable = () => {
    if (tableRows.length === 0 && !headingPending) return
    const out = []
    if (headingPending) {
      out.push(incidentHeadingRow(headingPending))
      headingPending = ''
    }
    out.push(...tableRows)
    blocks.push(makeImageTable(out))
    tableRows = []
  }

  for (let i = 0; i < rows.length; i++) {
    if (breakFromRow !== null && i >= breakFromRow && tableRows.length > 0) {
      flushTable()
      blocks.push(new Paragraph({ children: [new PageBreak()] }))
    }
    const rowHeight = rowMaxHeightPx(i, isFirstReportPage)
    const [left, right] = rows[i]
    tableRows.push(...imagePairRows(left, right, rowHeight))
  }
  flushTable()
  return blocks
}

function titleBlock(options) {
  const out = [];
  if (options.title1.trim()) {
    out.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        children: [
          new TextRun({ text: options.title1.trim().toUpperCase(), bold: true, font: FONT, size: 32 }),
        ],
      }),
    )
  }
  if (options.title2.trim()) {
    out.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [
          new TextRun({ text: options.title2.trim(), italics: true, font: FONT, size: 26 }),
        ],
      }),
    )
  }
  return out
}

/**
 * Dựng file Word: xếp theo thứ tự ghép tùy biến (2 ảnh/hàng trái→phải);
 * khổ ngang A4, mỗi sự cố một trang, STT tuỳ chọn.
 */
export async function buildIncidentWordReport(items, options, onProgress) {
  const children = [...titleBlock(options)];
  let index = Math.max(1, Math.floor(options.startStt) || 1)
  let failedImages = 0
  const total = items.length

  for (let i = 0; i < items.length; i++) {
    const inc = items[i]
    const isFirstPage = i === 0
    const slots = reportImageSlotsForExport(inc)
    const prepared = await Promise.all(slots.map((s) => prepareImage(s.url)))
    const orderedSlots = slots.map((s, j) => ({
      kind: s.kind,
      image: prepared[j] ?? null,
    }))
    for (let j = 0; j < slots.length; j++) {
      if (slots[j].url && !prepared[j]) failedImages++
    }

    const stt = options.showStt ? `${index}. ` : ''
    const kmText = formatKmDisplay(inc.km) || (inc.km ?? '')
    if (slots.length === 0) {
      children.push(
        headingParagraph(`${stt}Hoàn thiện tại ${kmText} (chưa có ảnh)`),
      )
    } else {
      const kmHeading = `${stt}Ảnh hoàn thiện tại ${kmText}`
      children.push(...imageTableBlocks(orderedSlots, isFirstPage, kmHeading))
    }
    index++

    if (i < items.length - 1) {
      children.push(new Paragraph({ children: [new PageBreak()] }))
    }
    onProgress?.(i + 1, total)
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: PageOrientation.LANDSCAPE,
              width: 11906,
              height: 16838,
            },
            margin: { top: 1134, right: 850, bottom: 850, left: 1417 },
          },
        },
        children,
      },
    ],
  })

  const blob = await Packer.toBlob(doc)
  return { blob, failedImages }
}
