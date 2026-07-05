import {
  AlignmentType,
  Document,
  ImageRun,
  Packer,
  PageBreak,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlignTable,
  WidthType,
} from 'docx'
import type { IncidentRecord } from '@/types/incident'
import type { WordPhotoSelection } from '@/lib/wordPhotoSelection'
import {
  buildPhotoMaps,
  buildWordFilename,
  imageDisplaySize,
  prepareImageForWord,
  resolvePhotoList,
  sortForWordExport,
} from '@/lib/wordReportUtils'

export type WordExportProgress = (current: number, total: number, message: string) => void

const CELL_WIDTH_PT = 381
const MAX_HEIGHT_FIRST_PT = 380
const MAX_HEIGHT_OTHER_PT = 440

async function loadImageRun(
  url: string,
  maxHeightPt: number,
): Promise<ImageRun | TextRun> {
  if (!url.trim()) {
    return new TextRun({ text: '' })
  }
  const prepared = await prepareImageForWord(url)
  if (!prepared) {
    return new TextRun({ text: '[Không chèn được ảnh]' })
  }
  const size = imageDisplaySize(prepared.width, prepared.height, CELL_WIDTH_PT, maxHeightPt)
  return new ImageRun({
    data: prepared.data,
    type: 'jpg',
    transformation: {
      width: Math.round(size.width),
      height: Math.round(size.height),
    },
  })
}

function countImages(
  list: IncidentRecord[],
  beforeMap: Record<string, string>,
  afterMap: Record<string, string>,
): number {
  let count = 0
  for (const inc of list) {
    const beforeList = resolvePhotoList(
      inc.beforeImages ?? [],
      beforeMap[inc.id],
    )
    const afterList = resolvePhotoList(inc.afterImages ?? [], afterMap[inc.id])
    const max = Math.max(beforeList.length, afterList.length)
    for (let j = 0; j < max; j++) {
      if (j < beforeList.length && beforeList[j]) count++
      if (j < afterList.length && afterList[j]) count++
    }
  }
  return Math.max(count, 1)
}

/**
 * Xuất Word DOCX — khớp WordExporter.kt (landscape, 2 cột trước/sau, tiêu đề, ảnh chọn).
 */
export async function exportIncidentsWord(
  items: IncidentRecord[],
  title1: string,
  title2: string,
  selections: Record<string, WordPhotoSelection>,
  onProgress?: WordExportProgress,
): Promise<void> {
  const sorted = sortForWordExport(items)
  const { beforeMap, afterMap } = buildPhotoMaps(sorted, selections)
  const total = countImages(sorted, beforeMap, afterMap) + 1
  let step = 0
  const report = (msg: string) => {
    step = Math.min(step + 1, total)
    onProgress?.(step, total, msg)
  }

  onProgress?.(0, total, 'Đang tạo tài liệu...')

  const children: (Paragraph | Table)[] = []

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: title1.toUpperCase(), bold: true, size: 32 }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: title2, italics: true, size: 26 }),
      ],
    }),
  )

  let pageIndex = 1
  let index = 1
  const imageCache = new Map<string, ImageRun | TextRun>()

  async function getCachedRun(url: string, maxH: number, label: string) {
    const key = `${url}|${maxH}`
    if (!imageCache.has(key)) {
      imageCache.set(key, await loadImageRun(url, maxH))
      report(label)
    }
    return imageCache.get(key)!
  }

  for (let iIndex = 0; iIndex < sorted.length; iIndex++) {
    const inc = sorted[iIndex]
    const beforeList = resolvePhotoList(inc.beforeImages ?? [], beforeMap[inc.id])
    const afterList = resolvePhotoList(inc.afterImages ?? [], afterMap[inc.id])
    const max = Math.max(beforeList.length, afterList.length)

    if (max === 0) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${index}. Hoàn thiện tại ${inc.km ?? ''} (chưa có ảnh)`,
              bold: true,
              size: 26,
            }),
          ],
        }),
      )
      index++
      if (iIndex !== sorted.length - 1) {
        children.push(new Paragraph({ children: [new PageBreak()] }))
        pageIndex++
      }
      continue
    }

    for (let j = 0; j < max; j++) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${index}. Ảnh hoàn thiện tại ${inc.km ?? ''}`,
              bold: true,
              size: 26,
            }),
          ],
        }),
      )

      const maxHeight = pageIndex === 1 ? MAX_HEIGHT_FIRST_PT : MAX_HEIGHT_OTHER_PT
      const cells: TableCell[] = []

      if (j < beforeList.length && beforeList[j]) {
        const run = await getCachedRun(
          beforeList[j],
          maxHeight,
          `Ảnh trước #${index}`,
        )
        cells.push(
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlignTable.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [run],
              }),
            ],
          }),
        )
      } else {
        cells.push(new TableCell({ children: [new Paragraph('')] }))
      }

      if (j < afterList.length && afterList[j]) {
        const run = await getCachedRun(
          afterList[j],
          maxHeight,
          `Ảnh sau #${index}`,
        )
        cells.push(
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlignTable.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [run],
              }),
            ],
          }),
        )
      } else {
        cells.push(new TableCell({ children: [new Paragraph('')] }))
      }

      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [new TableRow({ children: cells })],
        }),
      )

      index++
    }

    if (iIndex !== sorted.length - 1) {
      children.push(new Paragraph({ children: [new PageBreak()] }))
      pageIndex++
    }
  }

  report('Đang lưu file Word...')

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 16840,
              height: 11900,
              orientation: 'landscape',
            },
            margin: {
              top: 1134,
              right: 850,
              bottom: 850,
              left: 1417,
            },
          },
        },
        children,
      },
    ],
  })

  const blob = await Packer.toBlob(doc)
  const filename = buildWordFilename(sorted)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
