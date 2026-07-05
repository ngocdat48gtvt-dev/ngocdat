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
  WidthType
} from "docx";
import { VEHICLE_TYPES, DEMXE_GUIDE_SECTIONS } from "../utils/demXeConstants";
import { parseCount, sumCounts, listActiveDates, computeSummaryByDirection } from "../utils/demXeCompute";
import { formatDisplayDate } from "../utils/nhatKyFormat";

const FONT = "Times New Roman";

function p(text, opts = {}) {
  return new Paragraph({
    alignment: opts.center ? AlignmentType.CENTER : opts.align,
    spacing: { after: opts.after ?? 120 },
    children: [
      new TextRun({
        text: String(text ?? ""),
        bold: !!opts.bold,
        size: opts.size ?? 24,
        font: FONT
      })
    ]
  });
}

function cell(text, opts = {}) {
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    verticalAlign: "center",
    children: [
      new Paragraph({
        alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
        children: [new TextRun({ text: String(text ?? ""), size: 20, font: FONT, bold: !!opts.bold })]
      })
    ]
  });
}

function borderedTable(rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows
  });
}

function buildCover(cover) {
  return [
    p("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", { center: true, bold: true }),
    p("Độc lập - Tự do - Hạnh phúc", { center: true }),
    p("", { after: 240 }),
    p("SỔ THEO DÕI ĐẾM XE", { center: true, bold: true, size: 32 }),
    p("", { after: 360 }),
    p(`Đơn vị: ${cover.donVi || "……………………"}`, { center: true }),
    p(`Tên Hạt: ${cover.tenHat || "……………………"}`, { center: true }),
    p(`Tên đường: ${cover.tenDuong || "……………………"}`, { center: true }),
    p(`Lý trình quản lý: ${cover.lyTrinhQuanLy || "……………………"}`, { center: true }),
    p(`Bắt đầu ngày: ${cover.ngayBatDau || "..../..../...."}`, { center: true }),
    p(`Hết quyển ngày: ${cover.ngayKetThuc || "..../..../...."}`, { center: true }),
    new Paragraph({ children: [new PageBreak()] })
  ];
}

function buildGuide() {
  const blocks = [p("HƯỚNG DẪN LẬP, GHI CHÉP SỔ ĐẾM XE", { bold: true, center: true, after: 200 })];
  DEMXE_GUIDE_SECTIONS.forEach((s) => {
    blocks.push(p(s.title, { bold: true }));
    blocks.push(p(s.body));
  });
  blocks.push(new Paragraph({ children: [new PageBreak()] }));
  return blocks;
}

function buildCountForm(date, dir) {
  const header = [
    p("ĐẾM THEO PHÂN LOẠI PHƯƠNG TIỆN", { bold: true, center: true }),
    p(`Ngày ${formatDisplayDate(date)}`, { center: true }),
    p(`Đường: ${dir.roadName || "…"} · Lý trình: ${dir.lyTrinh || "…"}`, { center: true }),
    p(`Hướng: ${dir.from || "…"} → ${dir.to || "…"}`, { center: true }),
    p(`Thời gian: ${dir.startTime || "…"} – ${dir.endTime || "…"}`, { center: true, after: 160 })
  ];

  const rows = [
    new TableRow({
      children: [
        cell("CHỦNG LOẠI XE", { bold: true, width: 70 }),
        cell("SỐ LƯỢNG", { bold: true, center: true, width: 20 }),
        cell("CỘNG", { bold: true, center: true, width: 10 })
      ]
    })
  ];

  VEHICLE_TYPES.forEach((v) => {
    const n = parseCount(dir.counts?.[v.key]);
    rows.push(
      new TableRow({
        children: [
          cell(v.label),
          cell(n ? String(n) : "", { center: true }),
          cell(n ? String(n) : "", { center: true })
        ]
      })
    );
  });

  rows.push(
    new TableRow({
      children: [
        cell("TỔNG", { bold: true }),
        cell("", { center: true }),
        cell(String(sumCounts(dir.counts)), { bold: true, center: true })
      ]
    })
  );

  return [...header, borderedTable(rows), new Paragraph({ children: [new PageBreak()] })];
}

function buildSummary(days) {
  const { dates, rows } = computeSummaryByDirection(days);
  if (!dates.length) return [p("BẢNG TỔNG HỢP LƯU LƯỢNG XE QUA LẠI / NGÀY", { bold: true, center: true })];

  const headerCells = [
    cell("TT", { bold: true, center: true, width: 6 }),
    cell("HƯỚNG XE CHẠY", { bold: true, width: 22 }),
    cell("CHỦNG LOẠI XE", { bold: true, width: 28 }),
    ...dates.map((d) => cell(formatDisplayDate(d), { bold: true, center: true, width: Math.floor(44 / dates.length) }))
  ];

  const tableRows = [new TableRow({ children: headerCells })];
  rows.forEach((row, idx) => {
    tableRows.push(
      new TableRow({
        children: [
          cell(String(idx + 1), { center: true }),
          cell(row.directionLabel),
          cell(row.vehicleLabel),
          ...dates.map((d) => cell(row.byDate[d] ? String(row.byDate[d]) : "", { center: true }))
        ]
      })
    );
  });

  return [
    p("BẢNG TỔNG HỢP LƯU LƯỢNG XE QUA LẠI / NGÀY", { bold: true, center: true, after: 200 }),
    borderedTable(tableRows)
  ];
}

export async function buildDemXeWordDocument(ledger) {
  const cover = ledger?.cover || {};
  const days = ledger?.days || {};
  const children = [...buildCover(cover), ...buildGuide()];

  const dates = listActiveDates(days);
  dates.forEach((date) => {
    const dirs = [...(days[date]?.directions || [])].sort((a, b) =>
      (a.directionType === "di" ? 0 : 1) - (b.directionType === "di" ? 0 : 1)
    );
    dirs.forEach((dir) => {
      children.push(...buildCountForm(date, dir));
    });
  });

  children.push(...buildSummary(days));

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBlob(doc);
}

export async function downloadDemXeWord(ledger, filename) {
  const blob = await buildDemXeWordDocument(ledger);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename.endsWith(".docx") ? filename : `${filename}.docx`;
  a.click();
  URL.revokeObjectURL(a.href);
}
