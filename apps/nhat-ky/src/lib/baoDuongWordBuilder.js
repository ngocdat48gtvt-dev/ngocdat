import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  PageBreak,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType
} from "docx";
import { formatDisplayDate } from "../utils/nhatKyFormat";
import {
  entryToBaoDuongRow,
  groupBaoDuongEntriesByExecDay,
  buildBaoDuongDisplayBlocks
} from "../utils/baoDuongFormat";

const FONT = "Times New Roman";
const MM = 56.7;
const THIN = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
const BORDERS = { top: THIN, bottom: THIN, left: THIN, right: THIN };

const TITLE =
  "GHI CHÉP KẾT QUẢ BẢO DƯỠNG THƯỜNG XUYÊN THEO CHẤT LƯỢNG THỰC HIỆN";

const HEADERS = [
  "Số thứ tự",
  "Công việc thực hiện",
  "Ghi lý trình, vị trí công việc được thực hiện",
  "Tóm tắt biện pháp thực hiện",
  "Kết quả chủ yếu"
];

const NUMS = ["(1)", "(2)", "(3)", "(4)", "(5)"];

/** % bề rộng cột — gần tỷ lệ sổ in. */
const COL_PCT = [8, 22, 22, 24, 24];

function tw(mm) {
  return Math.round(Number(mm) * MM);
}

function run(text, opts = {}) {
  return new TextRun({
    text: String(text ?? ""),
    font: FONT,
    size: opts.size ?? 24,
    bold: !!opts.bold,
    italics: !!opts.italics
  });
}

function p(text, opts = {}) {
  return new Paragraph({
    alignment: opts.center
      ? AlignmentType.CENTER
      : opts.right
        ? AlignmentType.RIGHT
        : AlignmentType.LEFT,
    spacing: { after: opts.after ?? 80, before: opts.before ?? 0, line: 276 },
    children: [run(text, { size: opts.size, bold: opts.bold, italics: opts.italics })]
  });
}

function cell(text, opts = {}) {
  const lines = String(text ?? "").split(/\n/);
  return new TableCell({
    borders: BORDERS,
    width: { size: opts.widthPct || 20, type: WidthType.PERCENTAGE },
    columnSpan: opts.colSpan,
    verticalAlign: VerticalAlign.CENTER,
    children: lines.map(
      (line, i) =>
        new Paragraph({
          alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
          spacing: { after: i === lines.length - 1 ? 0 : 40, line: 240 },
          children: [run(line, { size: opts.size ?? 22, bold: !!opts.bold })]
        })
    )
  });
}

function periodLabel(periodFrom, periodTo) {
  if (periodFrom && periodTo && periodFrom !== periodTo) {
    return `${formatDisplayDate(periodFrom)} → ${formatDisplayDate(periodTo)}`;
  }
  return formatDisplayDate(periodFrom || periodTo) || "";
}

function buildDayChildren({
  periodFrom,
  periodTo,
  entries,
  chiefName = "",
  signRole = "Hạt trưởng",
  routeView = null
}) {
  const list = entries || [];
  const blocks = routeView?.road
    ? buildBaoDuongDisplayBlocks(list, routeView.road, routeView)
    : list.map((entry, i) => ({ kind: "entry", entry, stt: i + 1 }));

  const headRow = new TableRow({
    children: HEADERS.map((h, i) =>
      cell(h, { widthPct: COL_PCT[i], center: true, bold: true, size: 20 })
    )
  });
  const numRow = new TableRow({
    children: NUMS.map((h, i) =>
      cell(h, { widthPct: COL_PCT[i], center: true, bold: true, size: 20 })
    )
  });

  const dataRows = [];
  blocks.forEach((block) => {
    if (block.kind === "routeHeader") {
      dataRows.push(
        new TableRow({
          children: [
            cell(block.heading || "", {
              widthPct: 100,
              colSpan: 5,
              bold: true,
              size: 22
            })
          ]
        })
      );
      return;
    }
    const r = entryToBaoDuongRow(block.entry, Math.max(0, (block.stt || 1) - 1));
    r.stt = block.stt;
    dataRows.push(
      new TableRow({
        children: [
          cell(String(r.stt ?? ""), { widthPct: COL_PCT[0], center: true, size: 22 }),
          cell(r.work || "", { widthPct: COL_PCT[1], size: 22 }),
          cell(r.viTri || "", { widthPct: COL_PCT[2], size: 22 }),
          cell(r.measureSummary || "", { widthPct: COL_PCT[3], size: 22 }),
          cell(r.mainResult || "", { widthPct: COL_PCT[4], size: 22 })
        ]
      })
    );
  });

  if (!dataRows.length) {
    dataRows.push(
      new TableRow({
        children: COL_PCT.map((w) => cell("", { widthPct: w, size: 22 }))
      })
    );
  }

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headRow, numRow, ...dataRows]
  });

  return [
    p(TITLE, { center: true, bold: true, size: 26, after: 120 }),
    p(`1. Thời gian thực hiện: ${periodLabel(periodFrom, periodTo)}`, {
      size: 24,
      after: 60
    }),
    p("Các công việc thực hiện trong thời gian trên ghi vào bảng sau:", {
      size: 24,
      after: 100
    }),
    table,
    p("", { after: 200 }),
    p(signRole || "Hạt trưởng", { right: true, bold: true, after: 40 }),
    p("", { after: 280 }),
    p(chiefName || "", { right: true, bold: true, after: 0 })
  ];
}

/**
 * Xuất sổ BDTX ra Word — layout gần bản in/PDF.
 * Khoảng ngày: mỗi ngày thực hiện = 1 section (ngắt trang).
 */
export async function buildBaoDuongWordDocument({
  entries,
  periodFrom,
  periodTo,
  groupByDay = false,
  margins = { top: 12, right: 12, bottom: 12, left: 14 },
  chiefName = "",
  signRole = "Hạt trưởng",
  routeView = null
} = {}) {
  let groups;
  if (groupByDay) {
    const g = groupBaoDuongEntriesByExecDay(entries, periodFrom, periodTo);
    groups = g.length ? g : [{ periodFrom, periodTo, entries: [] }];
  } else {
    groups = [{ periodFrom, periodTo, entries: entries || [] }];
  }

  const children = [];
  groups.forEach((group, i) => {
    if (i > 0) children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(
      ...buildDayChildren({
        periodFrom: group.periodFrom,
        periodTo: group.periodTo,
        entries: group.entries,
        chiefName,
        signRole,
        routeView
      })
    );
  });

  return new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: tw(210), height: tw(297) },
            margin: {
              top: tw(Number(margins.top) || 12),
              right: tw(Number(margins.right) || 12),
              bottom: tw(Number(margins.bottom) || 12),
              left: tw(Number(margins.left) || 14)
            }
          }
        },
        children
      }
    ]
  });
}

export async function exportBaoDuongWord(options = {}) {
  const doc = await buildBaoDuongWordDocument(options);
  const blob = await Packer.toBlob(doc);
  const { periodFrom, periodTo } = options;
  const from = formatDisplayDate(periodFrom) || periodFrom || "";
  const to = formatDisplayDate(periodTo) || periodTo || from;
  const filename =
    periodFrom && periodTo && periodFrom !== periodTo
      ? `So_BDTX_${from}_den_${to}.docx`.replace(/\//g, "-")
      : `So_BDTX_${from || "xuat"}.docx`.replace(/\//g, "-");

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
  return { filename };
}
