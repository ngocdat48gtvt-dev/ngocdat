import {
  AlignmentType,
  BorderStyle,
  Document,
  HeightRule,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType
} from "docx";
import {
  buildNghiemThuDiaDiem,
  buildNghiemThuDoiTuong,
  formatNghiemThuPlaceDate,
  formatNghiemThuDanhXung,
  listNghiemThuCanCu
} from "../utils/nghiemThuFormat";
import { NT_DEFAULT_MARGINS, NT_PAGE, resolveNtMargins } from "../utils/nghiemThuPrint";

const FONT = "Times New Roman";
/** 1 mm ≈ 56.7 twips */
const MM = 56.7;

const THIN = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
const BORDERS = { top: THIN, bottom: THIN, left: THIN, right: THIN };
const NO_BORDER = {
  style: BorderStyle.NONE,
  size: 0,
  color: "FFFFFF"
};
const NO_BORDERS = {
  top: NO_BORDER,
  bottom: NO_BORDER,
  left: NO_BORDER,
  right: NO_BORDER
};

function tw(mm) {
  return Math.round(Number(mm) * MM);
}

function run(text, opts = {}) {
  return new TextRun({
    text: String(text ?? ""),
    font: FONT,
    size: opts.size ?? 25, // 12.5pt
    bold: !!opts.bold,
    italics: !!opts.italics,
    underline: opts.underline ? {} : undefined
  });
}

function p(text, opts = {}) {
  return new Paragraph({
    alignment: opts.center
      ? AlignmentType.CENTER
      : opts.right
        ? AlignmentType.RIGHT
        : opts.justify
          ? AlignmentType.BOTH
          : AlignmentType.LEFT,
    spacing: {
      after: opts.after ?? 40,
      before: opts.before ?? 0,
      line: opts.line ?? 240
    },
    children: Array.isArray(text)
      ? text
      : [run(text, { size: opts.size, bold: opts.bold, italics: opts.italics, underline: opts.underline })]
  });
}

function richP(parts, opts = {}) {
  return new Paragraph({
    alignment: opts.center
      ? AlignmentType.CENTER
      : opts.right
        ? AlignmentType.RIGHT
        : opts.justify
          ? AlignmentType.BOTH
          : AlignmentType.LEFT,
    spacing: { after: opts.after ?? 40, before: opts.before ?? 0, line: opts.line ?? 240 },
    keepNext: !!opts.keepNext,
    children: parts.map((part) =>
      typeof part === "string"
        ? run(part)
        : run(part.text, {
            bold: part.bold,
            italics: part.italics,
            size: part.size ?? 24,
            underline: part.underline
          })
    )
  });
}

function cell(text, opts = {}) {
  const widthPct = opts.widthPct;
  const lines = String(text ?? "").split(/\n/);
  return new TableCell({
    borders: opts.noBorder ? NO_BORDERS : BORDERS,
    width: widthPct
      ? { size: widthPct, type: WidthType.PERCENTAGE }
      : undefined,
    columnSpan: opts.colSpan,
    verticalAlign: opts.noBorder ? VerticalAlign.TOP : VerticalAlign.CENTER,
    shading: opts.shading ? { fill: opts.shading } : undefined,
    children: lines.map(
      (line, i) =>
        new Paragraph({
          alignment: opts.center
            ? AlignmentType.CENTER
            : opts.justify
              ? AlignmentType.BOTH
              : AlignmentType.LEFT,
          spacing: { after: i === lines.length - 1 ? 0 : 0, line: opts.line ?? 200 },
          children: [
            run(line, {
              size: opts.size ?? 25,
              bold: !!opts.bold
            })
          ]
        })
    )
  });
}

function personLine(nameLabel, roleLabel) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [5400, 4000],
    rows: [
      new TableRow({
        children: [
          cell(nameLabel, { widthPct: 55, noBorder: true, size: 25 }),
          cell(roleLabel, { widthPct: 45, noBorder: true, size: 25 })
        ]
      })
    ]
  });
}

function qlTable(rows) {
  const head = new TableRow({
    tableHeader: true,
    children: [
      cell("STT", { widthPct: 8, center: true, bold: true, shading: "F3F4F6", size: 25 }),
      cell("Hạng mục", { widthPct: 22, center: true, bold: true, shading: "F3F4F6", size: 25 }),
      cell("Nội dung kiểm tra nghiệm thu", {
        widthPct: 30,
        center: true,
        bold: true,
        shading: "F3F4F6",
        size: 25
      }),
      cell("Mức độ đáp ứng", {
        widthPct: 40,
        center: true,
        bold: true,
        shading: "F3F4F6",
        size: 25
      })
    ]
  });
  const body = (rows || []).map(
    (r) =>
      new TableRow({
        cantSplit: true,
        children: [
          cell("-", { widthPct: 8, center: true, size: 25, line: 238 }),
          cell(r.hangMuc || "", { widthPct: 22, size: 25, line: 238 }),
          cell(r.noiDung || "", { widthPct: 30, size: 25, line: 238 }),
          cell(r.mucDo || "", { widthPct: 40, size: 25, line: 238 })
        ]
      })
  );
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    margins: { top: 60, bottom: 60, left: 40, right: 40 },
    rows: [head, ...body]
  });
}

function volTable(sections) {
  if (!sections?.length) {
    return p("Chưa có khối lượng BDTX trong ngày để nghiệm thu (mục 6.2).", {
      italics: true,
      after: 120
    });
  }
  const head = new TableRow({
    tableHeader: true,
    children: [
      cell("STT", { widthPct: 6, center: true, bold: true, shading: "F3F4F6", size: 25 }),
      cell("Hạng mục", { widthPct: 21, center: true, bold: true, shading: "F3F4F6", size: 25 }),
      cell("Lý trình nghiệm thu", {
        widthPct: 19,
        center: true,
        bold: true,
        shading: "F3F4F6",
        size: 25
      }),
      cell("Khối lượng nghiệm thu", {
        widthPct: 14,
        center: true,
        bold: true,
        shading: "F3F4F6",
        size: 25
      }),
      cell("Mức độ đáp ứng", {
        widthPct: 40,
        center: true,
        bold: true,
        shading: "F3F4F6",
        size: 25
      })
    ]
  });
  const body = [];
  for (const sec of sections) {
    body.push(
      new TableRow({
        children: [
          cell(String(sec.key || ""), {
            widthPct: 6,
            center: true,
            bold: true,
            shading: "F8FAFC",
            size: 25
          }),
          cell(sec.title || "", {
            widthPct: 94,
            colSpan: 4,
            bold: true,
            shading: "F8FAFC",
            size: 25
          })
        ]
      })
    );
    for (const r of sec.rows || []) {
      body.push(
        new TableRow({
          cantSplit: true,
          children: [
            cell(String(r.stt ?? ""), { widthPct: 6, center: true, size: 25 }),
            cell(r.hangMuc || "", { widthPct: 21, size: 25 }),
            cell(r.lyTrinh || "", { widthPct: 19, size: 25 }),
            cell(r.khoiLuong || "", { widthPct: 14, size: 25 }),
            cell(r.mucDo || "", { widthPct: 40, size: 25 })
          ]
        })
      );
    }
  }
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [600, 2100, 1900, 1400, 4000],
    rows: [head, ...body]
  });
}

function pageProps(margins) {
  const m = resolveNtMargins(margins || NT_DEFAULT_MARGINS);
  return {
    size: {
      width: tw(NT_PAGE.wMm),
      height: tw(NT_PAGE.hMm)
    },
    margin: {
      top: tw(m.top),
      right: tw(m.right),
      bottom: tw(m.bottom),
      left: tw(m.left)
    }
  };
}

function signBlock(meta) {
  const leftName = meta.signNhaThau || meta.nhaThauTen || "";
  const rightName = meta.signBanQlbt || meta.banQlbtTen || "";
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [4700, 4700],
    rows: [
      new TableRow({
        children: [
          cell("NHÀ THẦU QL, BDTX", {
            widthPct: 50,
            center: true,
            bold: true,
            noBorder: true,
            size: 25
          }),
          cell("BAN QLBT ĐƯỜNG BỘ", {
            widthPct: 50,
            center: true,
            bold: true,
            noBorder: true,
            size: 25
          })
        ]
      }),
      new TableRow({
        height: { value: tw(25.92), rule: HeightRule.ATLEAST },
        children: [
          cell("", { widthPct: 50, center: true, noBorder: true, size: 25 }),
          cell("", { widthPct: 50, center: true, noBorder: true, size: 25 })
        ]
      }),
      new TableRow({
        children: [
          cell(leftName, { widthPct: 50, center: true, bold: true, noBorder: true, size: 25 }),
          cell(rightName, { widthPct: 50, center: true, bold: true, noBorder: true, size: 25 })
        ]
      })
    ]
  });
}

/**
 * Một biên bản NT (1 ngày) — layout khớp bản in PDF/A4.
 * @returns {Array<Paragraph|Table>}
 */
export function buildNghiemThuDayChildren(report) {
  const { date, road, meta, qlRows, volumeSections } = report;
  const placeDate = formatNghiemThuPlaceDate(date);
  const m = {
    ...meta,
    doiTuong: meta.doiTuong || buildNghiemThuDoiTuong(road),
    diaDiem: meta.diaDiem || buildNghiemThuDiaDiem(road)
  };
  const canCuItems = listNghiemThuCanCu(meta, road);

  return [
    p("CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM", { center: true, bold: true, after: 34 }),
    p("Độc lập - Tự do - Hạnh phúc", {
      center: true,
      bold: true,
      underline: true,
      after: 85
    }),
    p(placeDate, { right: true, italics: true, after: 119 }),
    p("BIÊN BẢN NGHIỆM THU", { center: true, bold: true, size: 25, after: 34 }),
    p("CÔNG VIỆC THỰC HIỆN QL, BDTX THEO TIÊU CHÍ CHẤT LƯỢNG", {
      center: true,
      bold: true,
      after: 119
    }),
    richP(
      [{ text: "Gói thầu: ", bold: true }, { text: m.goiThau || "…" }],
      { justify: true, after: 68 }
    ),
    richP(
      [
        { text: "1. Đối tượng nghiệm thu: ", bold: true },
        { text: m.doiTuong || "…" }
      ],
      { justify: true, after: 51 }
    ),
    richP([{ text: "2. Thành phần trực tiếp nghiệm thu:", bold: true }], {
      after: 34
    }),
    p("2.1 Ban Quản lý bảo trì đường bộ", { after: 27 }),
    personLine(
      `+ ${formatNghiemThuDanhXung(m.banQlbtDanhXung)}: ${m.banQlbtTen || "…"}`,
      `Chức vụ: ${m.banQlbtChucVu || "…"}`
    ),
    p(`2.2 Nhà thầu thực hiện QL, BDTX: ${m.nhaThauDonVi || "…"}`, {
      after: 27,
      before: 27
    }),
    personLine(
      `+ ${formatNghiemThuDanhXung(m.nhaThauDanhXung)}: ${m.nhaThauTen || "…"}`,
      `Chức vụ: ${m.nhaThauChucVu || "…"}`
    ),
    richP(
      [
        { text: "3. Thời gian nghiệm thu: ", bold: true },
        { text: m.thoiGian || "…" }
      ],
      { after: 48, before: 34 }
    ),
    richP(
      [
        { text: "4. Địa điểm nghiệm thu: ", bold: true },
        { text: m.diaDiem || "…" }
      ],
      { justify: true, after: 48 }
    ),
    richP([{ text: "5. Căn cứ nghiệm thu:", bold: true }], {
      justify: true,
      after: 20
    }),
    ...canCuItems.map((line, i) =>
      p(`- ${line}`, {
        justify: true,
        after: i === canCuItems.length - 1 ? 68 : 24
      })
    ),
    richP([{ text: "6. Về khối lượng, chất lượng thực hiện:", bold: true }], {
      after: 31
    }),
    richP([{ text: "6.1. Công tác quản lý", bold: true }], { after: 41 }),
    qlTable(qlRows),
    richP([{ text: "6.2. Công tác khác", bold: true }], { after: 60, before: 120 }),
    volTable(volumeSections),
    richP(
      [
        { text: "7. Các ý kiến khác: ", bold: true },
        { text: m.yKienKhac || "Không" }
      ],
      { after: 60, before: 120, keepNext: true }
    ),
    richP(
      [
        { text: "8. Kết luận: ", bold: true },
        {
          text:
            m.ketLuan ||
            "Đồng ý nghiệm thu khối lượng thực hiện hoàn thành nêu trên."
        }
      ],
      { justify: true, after: 240, keepNext: true }
    ),
    signBlock(m)
  ];
}

/**
 * Mỗi biên bản = 1 section Word.
 * @param {Array<{ date, road, meta, qlRows, volumeSections }>} reports
 */
export async function buildNghiemThuWordDocument(reports, margins) {
  const list = reports?.length ? reports : [];
  const page = pageProps(margins);
  const sections = list.map((report) => ({
    properties: {
      page
    },
    children: buildNghiemThuDayChildren(report)
  }));

  return new Document({
    sections: sections.length
      ? sections
      : [
          {
            properties: { page },
            children: [p("Không có biên bản nghiệm thu để xuất.", { italics: true })]
          }
        ]
  });
}

export async function downloadNghiemThuWord(reports, filename, margins) {
  const doc = await buildNghiemThuWordDocument(reports, margins);
  const blob = await Packer.toBlob(doc);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename.endsWith(".docx") ? filename : `${filename}.docx`;
  a.click();
  URL.revokeObjectURL(a.href);
}
