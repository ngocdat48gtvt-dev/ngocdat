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
import { DIRECTION_DI, DIRECTION_VE, VEHICLE_TYPES, formatCoverDateLabel } from "../utils/demXeConstants";
import {
  DEMXE_GUIDE_COUNT_REFS,
  DEMXE_GUIDE_DOSSIER,
  DEMXE_GUIDE_LEGAL_BASES,
  DEMXE_GUIDE_PURPOSE,
  DEMXE_GUIDE_REQUIREMENTS,
  DEMXE_GUIDE_REQUIREMENTS_PAGE2,
  DEMXE_GUIDE_SUMMARY_REFS,
  DEMXE_GUIDE_SUPERVISOR,
  DEMXE_GUIDE_TEAM_LEADER
} from "../utils/demXeGuideContent";
import { parseCount, sumCounts, listActiveDates, listCountBatches, computeDirectionBatchTable, batchMonthYearLabel } from "../utils/demXeCompute";
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

function coverLine(text, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    indent: { left: 2200 },
    spacing: { after: opts.after ?? 120, line: 360 },
    children: [
      new TextRun({
        text: String(text ?? ""),
        size: opts.size ?? 24,
        font: FONT
      })
    ]
  });
}

function buildCover(cover) {
  const donVi = cover.donVi || "……………………";
  const tenHat = cover.tenHat || "……………………";
  const lyTrinh = cover.lyTrinhQuanLy || "……………………";
  const tenDuong = cover.tenDuong || "……………………";
  const ngayBatDau = formatCoverDateLabel(cover.ngayBatDau);
  const ngayKetThuc = formatCoverDateLabel(cover.ngayKetThuc);
  const noiKy = cover.noiKy || "…………";
  const nam = cover.nam || "....";

  return [
    p("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", { center: true }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [
        new TextRun({
          text: "Độc lập - Tự do - Hạnh phúc",
          bold: true,
          underline: {},
          size: 24,
          font: FONT
        })
      ]
    }),
    p("SỔ THEO DÕI ĐẾM XE", { center: true, bold: true, size: 32, after: 360 }),
    coverLine(`Đơn vị quản lý, bảo dưỡng thường xuyên: ${donVi}`),
    coverLine(`Tên Hạt: ${tenHat} Lý trình quản lý: ${lyTrinh}`),
    coverLine(`Tên đường: ${tenDuong}`),
    coverLine(`Bắt đầu ngày: ${ngayBatDau}`),
    coverLine(`Hết quyển ngày: ${ngayKetThuc}`),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 960, after: 0 },
      children: [
        new TextRun({
          text: `${noiKy}, năm ${nam}`,
          italics: true,
          size: 24,
          font: FONT
        })
      ]
    }),
    new Paragraph({ children: [new PageBreak()] })
  ];
}

function buildGuide() {
  const blocks = [
    p("Phụ lục số 03", { align: AlignmentType.RIGHT, after: 120 }),
    p("HƯỚNG DẪN LẬP, GHI CHÉP SỔ ĐẾM XE", { bold: true, center: true, after: 200 })
  ];

  DEMXE_GUIDE_LEGAL_BASES.forEach((item) => {
    blocks.push(p(`- ${item}`, { after: 80 }));
  });

  blocks.push(p("I. MỤC ĐÍCH", { bold: true, after: 80 }));
  blocks.push(p(DEMXE_GUIDE_PURPOSE, { after: 120 }));
  blocks.push(p("II. YÊU CẦU", { bold: true, after: 80 }));

  DEMXE_GUIDE_REQUIREMENTS.forEach((item) => {
    blocks.push(p(`${item.no}. ${item.text}`, { after: 80 }));
    (item.bullets || []).forEach((bullet) => {
      blocks.push(p(`- ${bullet}`, { after: 80 }));
    });
  });

  blocks.push(new Paragraph({ children: [new PageBreak()] }));

  blocks.push(p(`- ${DEMXE_GUIDE_REQUIREMENTS_PAGE2[0]}`, { after: 80 }));
  blocks.push(p(`4. ${DEMXE_GUIDE_REQUIREMENTS_PAGE2[1]}`, { after: 120 }));
  blocks.push(p("III. QUY CÁCH HỒ SƠ", { bold: true, after: 80 }));

  DEMXE_GUIDE_DOSSIER.forEach((item, idx) => {
    blocks.push(p(`${idx + 1}. ${item}`, { after: 80 }));
  });

  blocks.push(p("4.1 Hướng dẫn ghi Bảng tổng hợp lưu lượng xe qua lại/ngày", { bold: true, after: 80 }));
  DEMXE_GUIDE_SUMMARY_REFS.forEach((item) => blocks.push(p(item, { after: 60 })));
  blocks.push(p(DEMXE_GUIDE_SUPERVISOR, { after: 80 }));
  blocks.push(p(DEMXE_GUIDE_TEAM_LEADER, { after: 120 }));
  blocks.push(p("BẢNG TỔNG HỢP LƯU LƯỢNG XE QUA LẠI / NGÀY", { bold: true, center: true, after: 80 }));
  blocks.push(p("Tháng…. năm….", { center: true, after: 160 }));

  blocks.push(new Paragraph({ children: [new PageBreak()] }));

  blocks.push(
    p("4.2 Hướng dẫn ghi Đếm theo phân loại phương tiện (chiều đi, chiều về)", {
      bold: true,
      after: 80
    })
  );
  DEMXE_GUIDE_COUNT_REFS.forEach((item) => blocks.push(p(item, { after: 60 })));
  blocks.push(p("ĐẾM THEO PHÂN LOẠI PHƯƠNG TIỆN", { bold: true, center: true, after: 120 }));
  VEHICLE_TYPES.forEach((v) => blocks.push(p(v.label, { after: 40 })));

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
  const batches = listCountBatches(Object.keys(days || {}));
  if (!batches.length) {
    return [p("BẢNG TỔNG HỢP LƯU LƯỢNG XE QUA LẠI / NGÀY", { bold: true, center: true })];
  }

  const blocks = [];
  batches.forEach((batch) => {
    const start = batch[0];
    blocks.push(p("BẢNG TỔNG HỢP LƯU LƯỢNG XE QUA LẠI / NGÀY", { bold: true, center: true, after: 80 }));
    blocks.push(p(batchMonthYearLabel(start), { center: true, after: 160 }));

    [DIRECTION_DI, DIRECTION_VE].forEach((dirType) => {
      const table = computeDirectionBatchTable(days, start, dirType);
      const header = new TableRow({
        children: [
          cell("TT", { bold: true, center: true }),
          cell("HƯỚNG XE CHẠY", { bold: true }),
          cell("CHỦNG LOẠI XE", { bold: true }),
          cell("Ngày 1", { bold: true, center: true }),
          cell("Ngày 2", { bold: true, center: true }),
          cell("Ngày 3", { bold: true, center: true }),
          cell("GHI CHÚ", { bold: true, center: true })
        ]
      });
      const body = table.rows.map((row, idx) =>
        new TableRow({
          children: [
            cell(String(row.tt), { center: true }),
            cell(idx === 0 ? `Từ: ${table.from || ""}\nĐến: ${table.to || ""}` : "", { center: true }),
            cell(row.vehicleLabel),
            ...row.displayCounts.map((val) => cell(val, { center: true })),
            cell("")
          ]
        })
      );
      body.push(
        new TableRow({
          children: [
            cell("Tổng", { bold: true }),
            cell(""),
            cell(""),
            ...table.colTotalsDisplay.map((val) => cell(val, { bold: true, center: true })),
            cell("")
          ]
        })
      );
      blocks.push(borderedTable([header, ...body]));
      blocks.push(p("", { after: 200 }));
    });

    blocks.push(
      p("Người giám sát                              Tổ trưởng tổ đếm xe", { center: true, after: 200 })
    );
    blocks.push(new Paragraph({ children: [new PageBreak()] }));
  });

  return blocks;
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
