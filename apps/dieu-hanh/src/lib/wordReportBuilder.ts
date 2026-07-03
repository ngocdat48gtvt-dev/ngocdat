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
import type { IncidentRecord } from '@/types/incident'
import { reportAfterImages, reportBeforeImages } from '@/lib/incidentUtils'
import { formatKmDisplay } from '@quanlysuco/shared'

const FONT = 'Times New Roman'

// KÃ­ch thÆ°á»›c áº£nh (px @96dpi) â€” khá»›p WordExporter.kt: bá» ngang ~342.9pt, cao tá»‘i Ä‘a 380/440pt.
const IMG_WIDTH_PX = 457
const IMG_MAX_HEIGHT_FIRST_PX = 507
const IMG_MAX_HEIGHT_PX = 587
const RESIZE_MAX_SIDE = 1200
const JPEG_QUALITY = 0.82

export interface WordExportOptions {
  title1: string
  title2: string
  showStt: boolean
  startStt: number
}

export interface WordBuildResult {
  blob: Blob
  failedImages: number
}

type PreparedImage = {
  data: Uint8Array
  width: number
  height: number
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image load failed'))
    img.src = src
  })
}

function isLocalHost(): boolean {
  if (typeof window === 'undefined') return false
  const h = window.location.hostname
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]'
}

/**
 * Láº¥y blob áº£nh. Æ¯u tiÃªn proxy cÃ¹ng origin (/api/img-proxy) Ä‘á»ƒ trÃ¡nh CORS cá»§a
 * Firebase Storage; náº¿u lá»—i (vd. cháº¡y local dev khÃ´ng cÃ³ serverless) thÃ¬ thá»­
 * fetch trá»±c tiáº¿p.
 */
async function fetchImageBlob(url: string): Promise<Blob | null> {
  const candidates: string[] = []
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
      /* thá»­ á»©ng viÃªn tiáº¿p theo */
    }
  }
  return null
}

/**
 * Táº£i áº£nh tá»« URL Firebase Storage, resize (cáº¡nh dÃ i â‰¤ 1200) vÃ  nÃ©n JPEG q82.
 * fetch â†’ blob (object URL same-origin nÃªn canvas khÃ´ng bá»‹ taint).
 * Tráº£ vá» null náº¿u lá»—i máº¡ng/CORS â€” Ã´ Word Ä‘á»ƒ trá»‘ng.
 */
async function prepareImage(url: string): Promise<PreparedImage | null> {
  let objectUrl: string | null = null
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

    const jpegBlob = await new Promise<Blob | null>((resolve) =>
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

function displaySize(img: PreparedImage, isFirstPage: boolean): { width: number; height: number } {
  const maxHeight = isFirstPage ? IMG_MAX_HEIGHT_FIRST_PX : IMG_MAX_HEIGHT_PX
  const ratio = img.height / img.width
  let width = IMG_WIDTH_PX
  let height = Math.round(width * ratio)
  if (height > maxHeight) {
    height = maxHeight
    width = Math.round(height / ratio)
  }
  return { width, height }
}

function headingParagraph(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    children: [new TextRun({ text, bold: true, font: FONT, size: 26 })],
  })
}

const CELL_BORDER = { style: BorderStyle.SINGLE, size: 4, color: '000000' }

const LABEL_BEFORE = '\u1EA2nh hi\u1EC7n tr\u1EA1ng'
const LABEL_AFTER = '\u1EA2nh sau x\u1EED l\u00FD'

function makeImageTable(rows: TableRow[]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    alignment: AlignmentType.CENTER,
    borders: {
      top: CELL_BORDER,
      bottom: CELL_BORDER,
      left: CELL_BORDER,
      right: CELL_BORDER,
      insideHorizontal: CELL_BORDER,
      insideVertical: CELL_BORDER,
    },
    rows,
  })
}

function labeledImageCell(
  slot: { kind: 'before' | 'after'; image: PreparedImage | null } | null,
  isFirstPage: boolean,
): TableCell {
  if (!slot) {
    return new TableCell({
      width: { size: 50, type: WidthType.PERCENTAGE },
      verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({ children: [] })],
    })
  }
  const label = slot.kind === 'before' ? LABEL_BEFORE : LABEL_AFTER
  const paragraphs: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 40, after: 40 },
      children: [new TextRun({ text: label, bold: true, font: FONT, size: 24 })],
    }),
  ]
  if (slot.image) {
    const { width, height } = displaySize(slot.image, isFirstPage)
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0 },
        children: [
          new ImageRun({
            type: 'jpg',
            data: slot.image.data,
            transformation: { width, height },
          }),
        ],
      }),
    )
  } else {
    paragraphs.push(new Paragraph({ children: [] }))
  }
  return new TableCell({
    width: { size: 50, type: WidthType.PERCENTAGE },
    verticalAlign: VerticalAlign.CENTER,
    children: paragraphs,
  })
}

type LabeledSlot = { kind: 'before' | 'after'; image: PreparedImage | null }

function buildSlotRows(
  beforeList: (PreparedImage | null)[],
  afterList: (PreparedImage | null)[],
): { rows: [LabeledSlot | null, LabeledSlot | null][]; breakBeforeRow: number | null } {
  const before: LabeledSlot[] = beforeList.map((image) => ({ kind: 'before', image }))
  const after: LabeledSlot[] = afterList.map((image) => ({ kind: 'after', image }))

  if (before.length === 0 && after.length === 0) {
    return { rows: [], breakBeforeRow: null }
  }

  // 2 HT + 1 XL: trang 1 đủ 2 ảnh trước, ảnh sau sang trang mới
  if (before.length === 2 && after.length === 1) {
    return {
      rows: [
        [before[0], before[1]],
        [after[0], null],
      ],
      breakBeforeRow: 1,
    }
  }

  const stream = [...before, ...after]
  const rows: [LabeledSlot | null, LabeledSlot | null][] = []
  for (let i = 0; i < stream.length; i += 2) {
    rows.push([stream[i] ?? null, stream[i + 1] ?? null])
  }
  return { rows, breakBeforeRow: null }
}

function imageTableBlocks(
  beforeList: (PreparedImage | null)[],
  afterList: (PreparedImage | null)[],
  isFirstPage: boolean,
): (Paragraph | Table)[] {
  const { rows, breakBeforeRow } = buildSlotRows(beforeList, afterList)
  if (rows.length === 0) {
    return [
      makeImageTable([
        new TableRow({
          children: [labeledImageCell(null, isFirstPage), labeledImageCell(null, isFirstPage)],
        }),
      ]),
    ]
  }

  const blocks: (Paragraph | Table)[] = []
  let tableRows: TableRow[] = []

  for (let i = 0; i < rows.length; i++) {
    if (breakBeforeRow === i && tableRows.length > 0) {
      blocks.push(makeImageTable(tableRows))
      blocks.push(new Paragraph({ children: [new PageBreak()] }))
      tableRows = []
    }
    const [left, right] = rows[i]
    tableRows.push(
      new TableRow({
        children: [
          labeledImageCell(left, isFirstPage),
          labeledImageCell(right, isFirstPage),
        ],
      }),
    )
  }
  if (tableRows.length > 0) {
    blocks.push(makeImageTable(tableRows))
  }
  return blocks
}

function titleBlock(options: WordExportOptions): Paragraph[] {
  const out: Paragraph[] = []
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
 * Dá»±ng file Word: háº¿t áº£nh hiá»‡n tráº¡ng (2 áº£nh/hÃ ng) rá»“i má»›i sau xá»­ lÃ½; khÃ´ng trá»™n HT+XL cÃ¹ng hÃ ng.
 * khá»• ngang A4, má»—i sá»± cá»‘ má»™t trang, STT tuá»³ chá»n.
 */
export async function buildIncidentWordReport(
  items: IncidentRecord[],
  options: WordExportOptions,
  onProgress?: (done: number, total: number) => void,
): Promise<WordBuildResult> {
  const children: (Paragraph | Table)[] = [...titleBlock(options)]
  let index = Math.max(1, Math.floor(options.startStt) || 1)
  let failedImages = 0
  const total = items.length

  for (let i = 0; i < items.length; i++) {
    const inc = items[i]
    const isFirstPage = i === 0
    const beforeUrls = reportBeforeImages(inc)
    const afterUrls = reportAfterImages(inc)

    const [beforePrepared, afterPrepared] = await Promise.all([
      Promise.all(beforeUrls.map((url) => prepareImage(url))),
      Promise.all(afterUrls.map((url) => prepareImage(url))),
    ])
    for (let j = 0; j < beforeUrls.length; j++) {
      if (beforeUrls[j] && !beforePrepared[j]) failedImages++
    }
    for (let j = 0; j < afterUrls.length; j++) {
      if (afterUrls[j] && !afterPrepared[j]) failedImages++
    }

    const stt = options.showStt ? `${index}. ` : ''
    const kmText = formatKmDisplay(inc.km) || (inc.km ?? '')
    if (beforeUrls.length === 0 && afterUrls.length === 0) {
      children.push(
        headingParagraph(`${stt}Ho\u00E0n thi\u1EC7n t\u1EA1i ${kmText} (ch\u01B0a c\u00F3 \u1EA3nh)`),
      )
    } else {
      children.push(headingParagraph(`${stt}\u1EA2nh ho\u00E0n thi\u1EC7n t\u1EA1i ${kmText}`))
      children.push(...imageTableBlocks(beforePrepared, afterPrepared, isFirstPage))
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
            // docx tá»± hoÃ¡n Ä‘á»•i width/height khi LANDSCAPE â†’ truyá»n theo khá»• dá»c A4.
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
