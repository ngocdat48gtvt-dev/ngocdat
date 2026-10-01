import ExcelJS from "exceljs";
import { formatDisplayDate } from "./nhatKyFormat";
import {
  buildNghiemThuDiaDiem,
  buildNghiemThuDoiTuong,
  formatNghiemThuPlaceDate,
  formatNghiemThuDanhXung,
  listNghiemThuCanCu
} from "./nghiemThuFormat";

function thinBorder(color = "000000") {
  const side = { style: "thin", color: { argb: `FF${color}` } };
  return { top: side, left: side, bottom: side, right: side };
}

function font(opts = {}) {
  return { name: "Times New Roman", size: 12.5, ...opts };
}

function sheetNameForDate(iso) {
  const d = formatDisplayDate(iso) || String(iso || "NT");
  return d.replace(/[\\/?*[\]:]/g, "-").slice(0, 31);
}

function uniqueSheetName(wb, base) {
  let name = base.slice(0, 31);
  let n = 2;
  while (wb.getWorksheet(name)) {
    name = `${base.slice(0, 28)}_${n++}`;
  }
  return name;
}

function writeMerged(ws, values, opts = {}) {
  const row = ws.addRow(values);
  const cols = opts.cols || 5;
  ws.mergeCells(row.number, 1, row.number, cols);
  const cell = row.getCell(1);
  cell.font = font(opts.font || {});
  cell.alignment = {
    horizontal: opts.align || "left",
    vertical: "middle",
    wrapText: true
  };
  if (opts.height) row.height = opts.height;
  return row;
}

function writeTableHeader(ws, headers, widths) {
  const head = ws.addRow(headers);
  head.eachCell((c, i) => {
    c.font = font({ bold: true, size: 12.5 });
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border = thinBorder();
    c.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF3F4F6" }
    };
    if (widths?.[i - 1]) ws.getColumn(i).width = widths[i - 1];
  });
  head.height = 28;
}

function writeNghiemThuSheet(ws, report) {
  const { date, road, meta, qlRows, volumeSections } = report;
  const m = {
    ...meta,
    doiTuong: meta.doiTuong || buildNghiemThuDoiTuong(road),
    diaDiem: meta.diaDiem || buildNghiemThuDiaDiem(road)
  };
  const canCuItems = listNghiemThuCanCu(meta, road);

  ws.columns = [{ width: 6 }, { width: 28 }, { width: 22 }, { width: 18 }, { width: 36 }];

  writeMerged(ws, ["CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM"], {
    cols: 5,
    font: { bold: true },
    align: "center"
  });
  writeMerged(ws, ["Độc lập - Tự do - Hạnh phúc"], {
    cols: 5,
    font: { bold: true },
    align: "center"
  });
  writeMerged(ws, [formatNghiemThuPlaceDate(date)], {
    cols: 5,
    font: { italic: true },
    align: "right"
  });
  writeMerged(ws, ["BIÊN BẢN NGHIỆM THU"], {
    cols: 5,
    font: { bold: true, size: 12.5 },
    align: "center",
    height: 22
  });
  writeMerged(ws, ["CÔNG VIỆC THỰC HIỆN QL, BDTX THEO TIÊU CHÍ CHẤT LƯỢNG"], {
    cols: 5,
    font: { bold: true },
    align: "center"
  });

  writeMerged(ws, [`Gói thầu: ${m.goiThau || "…"}`], { cols: 5 });
  writeMerged(ws, [`1. Đối tượng nghiệm thu: ${m.doiTuong || "…"}`], { cols: 5 });
  writeMerged(ws, ["2. Thành phần trực tiếp nghiệm thu:"], {
    cols: 5,
    font: { bold: true }
  });
  writeMerged(ws, ["2.1 Ban Quản lý bảo trì đường bộ"], { cols: 5 });
  writeMerged(
    ws,
    [
      `+ ${formatNghiemThuDanhXung(m.banQlbtDanhXung)}: ${m.banQlbtTen || "…"}    Chức vụ: ${m.banQlbtChucVu || "…"}`
    ],
    { cols: 5 }
  );
  writeMerged(ws, [`2.2 Nhà thầu thực hiện QL, BDTX: ${m.nhaThauDonVi || "…"}`], {
    cols: 5
  });
  writeMerged(
    ws,
    [
      `+ ${formatNghiemThuDanhXung(m.nhaThauDanhXung)}: ${m.nhaThauTen || "…"}    Chức vụ: ${m.nhaThauChucVu || "…"}`
    ],
    { cols: 5 }
  );
  writeMerged(ws, [`3. Thời gian nghiệm thu: ${m.thoiGian || "…"}`], { cols: 5 });
  writeMerged(ws, [`4. Địa điểm nghiệm thu: ${m.diaDiem || "…"}`], { cols: 5 });
  writeMerged(ws, ["5. Căn cứ nghiệm thu:"], { cols: 5, font: { bold: true } });
  canCuItems.forEach((line) => {
    writeMerged(ws, [`- ${line}`], { cols: 5 });
  });
  writeMerged(ws, ["6. Về khối lượng, chất lượng thực hiện:"], {
    cols: 5,
    font: { bold: true }
  });
  writeMerged(ws, ["6.1. Công tác quản lý"], { cols: 5, font: { bold: true } });

  writeTableHeader(
    ws,
    ["STT", "Hạng mục", "Nội dung kiểm tra nghiệm thu", "Mức độ đáp ứng", ""],
    [6, 28, 32, 36, 8]
  );
  // Merge last empty col visually — simpler 4-col table:
  // Re-write QL as 4 columns by clearing column 5 usage
  (qlRows || []).forEach((r) => {
    const row = ws.addRow(["-", r.hangMuc, r.noiDung, r.mucDo, ""]);
    ws.mergeCells(row.number, 4, row.number, 5);
    row.eachCell((c, i) => {
      if (i > 5) return;
      c.font = font({ size: 12.5 });
      c.border = thinBorder();
      c.alignment = {
        horizontal: i === 1 ? "center" : "left",
        vertical: "middle",
        wrapText: true
      };
    });
  });

  writeMerged(ws, ["6.2. Công tác khác"], { cols: 5, font: { bold: true } });
  writeTableHeader(
    ws,
    ["STT", "Hạng mục", "Lý trình nghiệm thu", "Khối lượng nghiệm thu", "Mức độ đáp ứng"],
    [6, 23, 23, 16, 32]
  );

  if (!volumeSections?.length) {
    writeMerged(ws, ["Chưa có khối lượng BDTX trong ngày để nghiệm thu (mục 6.2)."], {
      cols: 5,
      font: { italic: true }
    });
  } else {
    volumeSections.forEach((sec) => {
      const secRow = ws.addRow([sec.key, sec.title, "", "", ""]);
      ws.mergeCells(secRow.number, 2, secRow.number, 5);
      secRow.eachCell((c, i) => {
        c.font = font({ bold: true, size: 12.5 });
        c.border = thinBorder();
        c.alignment = {
          horizontal: i === 1 ? "center" : "left",
          vertical: "middle",
          wrapText: true
        };
        c.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF8FAFC" }
        };
      });
      (sec.rows || []).forEach((r) => {
        const row = ws.addRow([
          r.stt,
          r.hangMuc,
          r.lyTrinh,
          r.khoiLuong,
          r.mucDo
        ]);
        row.eachCell((c, i) => {
          c.font = font({ size: 12.5 });
          c.border = thinBorder();
          c.alignment = {
            horizontal: i === 1 ? "center" : "left",
            vertical: "middle",
            wrapText: true
          };
        });
      });
    });
  }

  writeMerged(ws, [`7. Các ý kiến khác: ${m.yKienKhac || "Không"}`], { cols: 5 });
  writeMerged(
    ws,
    [
      `8. Kết luận: ${
        m.ketLuan ||
        "Đồng ý nghiệm thu khối lượng thực hiện hoàn thành nêu trên."
      }`
    ],
    { cols: 5 }
  );

  ws.addRow([]);
  const sign = ws.addRow([
    "NHÀ THẦU QL, BDTX",
    "",
    "",
    "BAN QLBT ĐƯỜNG BỘ",
    ""
  ]);
  ws.mergeCells(sign.number, 1, sign.number, 2);
  ws.mergeCells(sign.number, 4, sign.number, 5);
  sign.getCell(1).font = font({ bold: true });
  sign.getCell(4).font = font({ bold: true });
  sign.getCell(1).alignment = { horizontal: "center" };
  sign.getCell(4).alignment = { horizontal: "center" };

  ws.addRow([]);
  ws.addRow([]);
  ws.addRow([]);
  ws.addRow([]);
  ws.addRow([]);
  const names = ws.addRow([
    m.signNhaThau || m.nhaThauTen || "",
    "",
    "",
    m.signBanQlbt || m.banQlbtTen || "",
    ""
  ]);
  ws.mergeCells(names.number, 1, names.number, 2);
  ws.mergeCells(names.number, 4, names.number, 5);
  names.getCell(1).font = font({ bold: true });
  names.getCell(4).font = font({ bold: true });
  names.getCell(1).alignment = { horizontal: "center" };
  names.getCell(4).alignment = { horizontal: "center" };
}

/**
 * Xuất biên bản NT ra Excel — mỗi ngày 1 sheet khi khoảng A→B.
 */
export async function exportNghiemThuExcel(reports, { dateFrom, dateTo } = {}) {
  const list = reports || [];
  if (!list.length) throw new Error("Không có biên bản để xuất.");

  const wb = new ExcelJS.Workbook();
  wb.creator = "Nhật ký tuần đường";
  wb.created = new Date();

  list.forEach((report) => {
    const base = sheetNameForDate(report.date);
    const ws = wb.addWorksheet(uniqueSheetName(wb, base), {
      pageSetup: {
        paperSize: 9,
        orientation: "portrait",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0
      }
    });
    writeNghiemThuSheet(ws, report);
  });

  const from = formatDisplayDate(dateFrom || list[0]?.date) || "";
  const to = formatDisplayDate(dateTo || list[list.length - 1]?.date) || from;
  const filename =
    dateFrom && dateTo && dateFrom !== dateTo
      ? `Bien_ban_NT_${from}_den_${to}.xlsx`.replace(/\//g, "-")
      : `Bien_ban_NT_${from || "xuat"}.xlsx`.replace(/\//g, "-");

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
  return { filename, sheetCount: list.length };
}
