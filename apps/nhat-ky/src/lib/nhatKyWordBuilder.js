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
import { OFFICIAL_HEADERS, formatDisplayDate } from "../utils/nhatKyFormat";
import {
  buildNhatKyPrintRows,
  entriesForDate,
  dayMetaForDate
} from "../utils/nhatKyPrintRows";
import { packRowsForA4 } from "../components/NhatKyPrintDay";
import { getNhatKyColWidths } from "../hooks/useColumnWidths";

const FONT = "Times New Roman";
const MM = 56.7;
const THIN = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
const BORDERS = { top: THIN, bottom: THIN, left: THIN, right: THIN };

const LEFT_META = [
  { key: "c1", header: OFFICIAL_HEADERS.col1, num: "(1)" },
  { key: "c2", header: OFFICIAL_HEADERS.col2, num: "(2)" },
  { key: "c3", header: OFFICIAL_HEADERS.col3, num: "(3)" }
];

const RIGHT_META = [
  { key: "c4", header: OFFICIAL_HEADERS.col4, num: "(4)" },
  { key: "c5", header: OFFICIAL_HEADERS.col5, num: "(5)" },
  { key: "c6", header: OFFICIAL_HEADERS.col6, num: "(6)" }
];

const MM_TO_PX = 96 / 25.4;
const A4_H_MM = 297;
const THEAD_PX = 92;

function tw(mm) {
  return Math.round(Number(mm) * MM);
}

function bodyMaxPx(margins) {
  const pad = (Number(margins?.top) || 0) + (Number(margins?.bottom) || 0);
  return Math.max(320, Math.floor((A4_H_MM - pad) * MM_TO_PX - THEAD_PX));
}

function run(text, opts = {}) {
  return new TextRun({
    text: String(text ?? ""),
    font: FONT,
    size: opts.size ?? 22,
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
    spacing: { after: opts.after ?? 60, before: opts.before ?? 0, line: 240 },
    children: [run(text, { size: opts.size, bold: opts.bold, italics: opts.italics })]
  });
}

function pctWidths(keys, widths) {
  const total =
    keys.reduce((s, k) => s + (Number(widths?.[k]) || 0), 0) || keys.length;
  return keys.map((k) => {
    const raw = ((Number(widths?.[k]) || 0) / total) * 100;
    return Math.max(8, Math.round(raw * 10) / 10);
  });
}

function cell(text, opts = {}) {
  const lines = String(text ?? "").split(/\n/);
  const paras =
    lines.length === 0
      ? [new Paragraph({ children: [run("")] })]
      : lines.map(
          (line, i) =>
            new Paragraph({
              alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
              spacing: { after: i === lines.length - 1 ? 0 : 20, line: 220 },
              children: [
                run(line, {
                  size: opts.size ?? 22,
                  bold: !!opts.bold
                })
              ]
            })
        );
  return new TableCell({
    borders: BORDERS,
    width: { size: opts.widthPct || 33, type: WidthType.PERCENTAGE },
    columnSpan: opts.colSpan,
    verticalAlign: opts.vAlign || VerticalAlign.CENTER,
    shading: opts.shading ? { fill: opts.shading } : undefined,
    children: paras
  });
}

/** Ô ký: chức danh + khoảng trống (×0.8 ×0.85 ×0.8) + tên. */
function signCell(role, name, widthPct) {
  const display = String(name || "").trim();
  const gapLine = 130; // 240 × 0.8 × 0.85 × 0.8
  return new TableCell({
    borders: BORDERS,
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    verticalAlign: VerticalAlign.TOP,
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 0, line: 240 },
        children: [run(role || "", { size: 25, bold: true })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 0, before: 0, line: gapLine },
        children: [run("")]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 0, before: 0, line: gapLine },
        children: [run("")]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 0, before: 0, line: gapLine },
        children: [run("")]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 170, before: 0, line: 240 },
        children: [run(display, { size: 25, bold: true })]
      })
    ]
  });
}

function emptyCell(widthPct) {
  return cell("", { widthPct });
}

function headRows(meta, colPct) {
  return [
    new TableRow({
      tableHeader: true,
      children: meta.map((m, i) =>
        cell(m.header, {
          widthPct: colPct[i],
          center: true,
          bold: true,
          size: 25,
          shading: "FFFFFF"
        })
      )
    }),
    new TableRow({
      tableHeader: true,
      children: meta.map((m, i) =>
        cell(m.num, {
          widthPct: colPct[i],
          center: true,
          bold: true,
          size: 25,
          shading: "FFFFFF"
        })
      )
    })
  ];
}

function halfBodyRow(side, row, colPct, signTuanDuong, signHatTruong, signHatRole) {
  const kind = row?.kind || "";
  const keys = side === "left" ? ["c1", "c2", "c3"] : ["c4", "c5", "c6"];

  if (kind === "filler" || kind === "sign-gap") {
    return new TableRow({
      children: keys.map((_, i) => emptyCell(colPct[i]))
    });
  }

  if (kind === "sign-pair" || kind === "sign-hat" || kind === "sign-tuan") {
    if (side === "left") {
      return new TableRow({
        children: [
          emptyCell(colPct[0]),
          emptyCell(colPct[1]),
          signCell("Tuần đường", signTuanDuong, colPct[2])
        ]
      });
    }
    return new TableRow({
      children: [
        emptyCell(colPct[0]),
        signCell(signHatRole || "Hạt trưởng", signHatTruong, colPct[1]),
        emptyCell(colPct[2])
      ]
    });
  }

  const bold = kind === "weather" || kind === "section" || kind === "part";
  const shading = kind === "section" || kind === "part" ? "F8FAFC" : undefined;
  return new TableRow({
    children: keys.map((key, i) => {
      let text = row?.[key] || "";
      if (key === "c3" && kind === "empty" && !text) text = "Không phát sinh";
      return cell(text, {
        widthPct: colPct[i],
        bold: bold || (kind === "weather" && key === "c3"),
        center: kind === "weather" && key === "c1",
        shading,
        size: 25
      });
    })
  });
}

/**
 * Một tờ A4 dọc = nửa sổ (cột 1–3 hoặc 4–6), giống bản in PDF.
 */
function buildHalfPageChildren({
  side,
  rows,
  widths,
  signTuanDuong,
  signHatTruong,
  signHatRole
}) {
  const meta = side === "left" ? LEFT_META : RIGHT_META;
  const keys = meta.map((m) => m.key);
  const colPct = pctWidths(keys, widths);
  const contentRows = (rows || []).filter((r) => r);
  const tableRows = [
    ...headRows(meta, colPct),
    ...contentRows.map((row) =>
      halfBodyRow(side, row, colPct, signTuanDuong, signHatTruong, signHatRole)
    )
  ];

  return [
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: undefined,
      rows: tableRows
    })
  ];
}

/**
 * Xuất sổ nhật ký ra Word — A4 dọc; mỗi nửa (1–3 / 4–6) = 1 trang như PDF.
 */
export async function buildNhatKyWordDocument({
  dates = [],
  entries = [],
  dayMeta = {},
  filterByRouteView,
  locationCtx = null,
  margins = { top: 20, right: 15, bottom: 15, left: 20 },
  signTuanDuong = "",
  signHatTruong = "",
  signHatRole = "Hạt trưởng",
  rowHeightScale = 1
} = {}) {
  const list = (dates || []).filter(Boolean);
  const children = [];
  const widths = getNhatKyColWidths();
  const maxBody = bodyMaxPx(margins);
  let pageCount = 0;

  const pushPage = (pageChildren) => {
    if (pageCount > 0) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }
    children.push(...pageChildren);
    pageCount += 1;
  };

  list.forEach((date) => {
    let dayEntries = entriesForDate(entries, date);
    if (typeof filterByRouteView === "function") {
      dayEntries = filterByRouteView(dayEntries);
    }
    const rows = buildNhatKyPrintRows(
      date,
      dayEntries,
      dayMetaForDate(dayMeta, date),
      locationCtx
    );
    const chunks = packRowsForA4(rows, maxBody, 0, widths, null, rowHeightScale);

    chunks.forEach((chunk) => {
      pushPage(
        buildHalfPageChildren({
          side: "left",
          rows: chunk,
          widths,
          signTuanDuong,
          signHatTruong,
          signHatRole
        })
      );
      pushPage(
        buildHalfPageChildren({
          side: "right",
          rows: chunk,
          widths,
          signTuanDuong,
          signHatTruong,
          signHatRole
        })
      );
    });
  });

  if (!children.length) {
    children.push(p("Không có dữ liệu sổ nhật ký để xuất.", { italics: true }));
  }

  return new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              // A4 dọc (khớp in PDF)
              width: tw(210),
              height: tw(297)
            },
            margin: {
              top: tw(Number(margins.top) || 20),
              right: tw(Number(margins.right) || 15),
              bottom: tw(Number(margins.bottom) || 15),
              left: tw(Number(margins.left) || 20)
            }
          }
        },
        children
      }
    ]
  });
}

export async function exportNhatKyWord(options = {}) {
  const doc = await buildNhatKyWordDocument(options);
  const blob = await Packer.toBlob(doc);
  const list = (options.dates || []).filter(Boolean);
  const from = list[0];
  const to = list[list.length - 1] || from;
  const filename =
    from && to && from !== to
      ? `So_nhat_ky_${formatDisplayDate(from) || from}_den_${formatDisplayDate(to) || to}.docx`.replace(
          /\//g,
          "-"
        )
      : `So_nhat_ky_${formatDisplayDate(from) || from || "xuat"}.docx`.replace(
          /\//g,
          "-"
        );

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
  return { filename };
}
