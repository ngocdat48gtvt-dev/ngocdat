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

// Kích thước ảnh (px @96dpi) — khớp WordExporter.kt: bề ngang ~342.9pt, cao tối đa 380/440pt.
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
 * Lấy blob ảnh. Ưu tiên proxy cùng origin (/api/img-proxy) để tránh CORS của
 * Firebase Storage; nếu lỗi (vd. chạy local dev không có serverless) thì thử
 * fetch trực tiếp.
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
      /* thử ứng viên tiếp theo */
    }
  }
  return null
}

/**
 * Tải ảnh từ URL Firebase Storage, resize (cạnh dài ≤ 1200) và nén JPEG q82.
 * fetch → blob (object URL same-origin nên canvas không bị taint).
 * Trả về null nếu lỗi mạng/CORS để cell hiển thị "[Không tải được ảnh]".
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

function imageCell(img: PreparedImage | null, isFirstPage: boolean): TableCell {
  let content: Paragraph
  if (img) {
    const { width, height } = displaySize(img, isFirstPage)
    content = new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 0 },
      children: [
        new ImageRun({
          type: 'jpg',
          data: img.data,
          transformation: { width, height },
        }),
      ],
    })
  } else {
    content = new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: '[Không tải được ảnh]', italics: true, font: FONT, size: 24 }),
      ],
    })
  }
  return new TableCell({
    width: { size: 50, type: WidthType.PERCENTAGE },
    verticalAlign: VerticalAlign.CENTER,
    children: [content],
  })
}

function headingParagraph(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    children: [new TextRun({ text, bold: true, font: FONT, size: 26 })],
  })
}

const CELL_BORDER = { style: BorderStyle.SINGLE, size: 4, color: '000000' }

function labelCell(text: string): TableCell {
  return new TableCell({
    width: { size: 50, type: WidthType.PERCENTAGE },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 40, after: 40 },
        children: [
          new TextRun({ text, bold: true, font: FONT, size: 24 }),
        ],
      }),
    ],
  })
}

function pairRows(list: (PreparedImage | null)[]): [PreparedImage | null, PreparedImage | null][] {
  if (list.length === 0) return []
  const rows: [PreparedImage | null, PreparedImage | null][] = []
  for (let i = 0; i < list.length; i += 2) {
    rows.push([list[i] ?? null, list[i + 1] ?? null])
  }
  return rows
}

function imageTable(
  beforeList: (PreparedImage | null)[],
  afterList: (PreparedImage | null)[],
  isFirstPage: boolean,
): Table {
  /** Hết HT (2 ảnh/hàng) rồi mới XL (2 ảnh/hàng) — không trộn HT và XL cùng hàng. */
  const beforeRows = pairRows(beforeList)
  const afterRows = pairRows(afterList)
  const rows: TableRow[] = [
    new TableRow({
      children: [labelCell('Ảnh hiện trạng'), labelCell('Ảnh sau xử lý')],
    }),
  ]
  if (beforeRows.length === 0 && afterRows.length === 0) {
    rows.push(
      new TableRow({
        children: [imageCell(null, isFirstPage), imageCell(null, isFirstPage)],
      }),
    )
  } else {
    for (const [left, right] of beforeRows) {
      rows.push(
        new TableRow({
          children: [imageCell(left, isFirstPage), imageCell(right, isFirstPage)],
        }),
      )
    }
    for (const [left, right] of afterRows) {
      rows.push(
        new TableRow({
          children: [imageCell(left, isFirstPage), imageCell(right, isFirstPage)],
        }),
      )
    }
  }
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
 * Dựng file Word: hết ảnh hiện trạng (2 ảnh/hàng) rồi mới sau xử lý; không trộn HT+XL cùng hàng.
 * khổ ngang A4, mỗi sự cố một trang, STT tuỳ chọn.
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
      children.push(headingParagraph(`${stt}Hoàn thiện tại ${kmText} (chưa có ảnh)`))
    } else {
      children.push(headingParagraph(`${stt}Ảnh hoàn thiện tại ${kmText}`))
      children.push(imageTable(beforePrepared, afterPrepared, isFirstPage))
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
            // docx tự hoán đổi width/height khi LANDSCAPE → truyền theo khổ dọc A4.
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
