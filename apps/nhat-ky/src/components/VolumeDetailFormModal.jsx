import ExcelJS from "exceljs";
import {
  formatStatsNumber,
  groupVolumeDetailRows
} from "../utils/volumeStatsFormat";
import {
  setExcelDecimalCell,
  setExcelKmCell
} from "../utils/excelCellFormat";
import { printViaIframe, excelThinTableCss } from "../utils/printViaIframe";
import { toRomanUpper } from "../utils/roadsCatalog";

/** STT · Ngày · LT đầu · LT cuối · Phía · ĐVT · Dài · Rộng · Cao · KL */
const COL_COUNT = 10;
const LABEL_COLS = 9;

function cell(value) {
  return String(value ?? "").trim();
}

function qtyLabel(row) {
  return row.quantityLabel || formatStatsNumber(row.quantity);
}

function groupTotalLabel(group) {
  const unit = cell(group.unitLabel || group.unit);
  return `${formatStatsNumber(group.totalQty)}${unit ? ` ${unit}` : ""}`;
}

function periodLabel(dateFrom, dateTo) {
  if (!dateFrom || !dateTo) return "";
  return `Từ ${dateFrom.split("-").reverse().join("/")} đến ${dateTo
    .split("-")
    .reverse()
    .join("/")}`;
}

/** Duyệt theo hạng mục (I. II. …) → đầu việc → dòng chi tiết. */
function walkGroupedRows(sections, handlers) {
  let stt = 0;
  sections.forEach((sec, secIndex) => {
    const roman = toRomanUpper(secIndex + 1);
    handlers.onSectionHeader?.(sec, roman, secIndex);
    for (const group of sec.workGroups) {
      handlers.onWorkHeader?.(group, sec, roman);
      let localStt = 0;
      for (const row of group.rows) {
        stt += 1;
        localStt += 1;
        handlers.onRow?.(row, localStt, group, sec, stt);
      }
    }
  });
}

const HEADERS = [
  "STT",
  "Ngày",
  "Lý trình đầu",
  "Lý trình cuối",
  "Phía",
  "Đơn vị",
  "Dài",
  "Rộng",
  "Cao",
  "Khối lượng"
];

function buildDetailTableHtml(sections) {
  const parts = [];
  walkGroupedRows(sections, {
    onSectionHeader(sec, roman) {
      parts.push(`<tr class="sec-group">
        <td colspan="${COL_COUNT}"><strong>${roman}. ${cell(sec.section)}</strong></td>
      </tr>`);
    },
    onWorkHeader(group) {
      parts.push(`<tr class="sec">
        <td colspan="${LABEL_COLS}"><strong>${cell(group.workType)}</strong></td>
        <td class="num"><strong>${groupTotalLabel(group)}</strong></td>
      </tr>`);
    },
    onRow(row, stt) {
      parts.push(`<tr>
        <td class="num">${stt}</td>
        <td>${cell(row.dateLabel)}</td>
        <td>${cell(row.kmFromLabel)}</td>
        <td>${cell(row.kmToLabel)}</td>
        <td>${cell(row.side || row.sideLabel)}</td>
        <td>${cell(row.unitLabel || row.unit)}</td>
        <td class="num">${cell(row.length)}</td>
        <td class="num">${cell(row.width)}</td>
        <td class="num">${cell(row.height)}</td>
        <td class="num">${cell(qtyLabel(row))}</td>
      </tr>`);
    }
  });

  return `<table class="kl-detail-table">
    <thead>
      <tr>${HEADERS.map((h) => `<th>${h}</th>`).join("")}</tr>
    </thead>
    <tbody>${parts.join("")}</tbody>
  </table>`;
}

const PRINT_CSS = `
  @page { size: A4 landscape; margin: 12mm; }
  body {
    font-family: "Times New Roman", Times, serif;
    font-size: 12pt;
    color: #000;
    margin: 0;
  }
  h1 {
    font-size: 14pt;
    text-align: center;
    margin: 0 0 4px;
    text-transform: uppercase;
  }
  .meta {
    text-align: center;
    margin: 0 0 12px;
    font-size: 11pt;
  }
  ${excelThinTableCss(".kl-detail-table")}
  .kl-detail-table { width: 100%; border-collapse: collapse; }
  .kl-detail-table th,
  .kl-detail-table td {
    padding: 3px 5px;
    vertical-align: middle;
  }
  .kl-detail-table th { font-weight: bold; text-align: center; }
  .kl-detail-table .num { text-align: right; }
  .kl-detail-table tr.sec td { background: #f1f5f9; font-weight: bold; }
  .kl-detail-table tr.sec-group td { background: #cbd5e1; font-weight: bold; }
`;

function thinBorder(color = "000000") {
  const side = { style: "thin", color: { argb: `FF${color}` } };
  return { top: side, left: side, bottom: side, right: side };
}

async function exportVolumeDetailExcel(sections, { period, filename }) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Khối lượng chi tiết", {
    views: [{ state: "frozen", ySplit: 3 }]
  });

  ws.columns = [
    { width: 6 },
    { width: 12 },
    { width: 14 },
    { width: 14 },
    { width: 8 },
    { width: 10 },
    { width: 8 },
    { width: 8 },
    { width: 8 },
    { width: 12 }
  ];

  const title = ws.addRow(["BẢNG KÊ KHỐI LƯỢNG CHI TIẾT"]);
  ws.mergeCells(1, 1, 1, COL_COUNT);
  title.getCell(1).font = { name: "Times New Roman", size: 14, bold: true };
  title.getCell(1).alignment = { horizontal: "center", vertical: "middle" };

  const meta = ws.addRow([period || ""]);
  ws.mergeCells(2, 1, 2, COL_COUNT);
  meta.getCell(1).font = { name: "Times New Roman", size: 11 };
  meta.getCell(1).alignment = { horizontal: "center" };

  const head = ws.addRow(HEADERS);
  head.eachCell((c) => {
    c.font = { name: "Times New Roman", size: 11, bold: true };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border = thinBorder();
    c.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF1F5F9" }
    };
  });

  walkGroupedRows(sections, {
    onSectionHeader(sec, roman) {
      const row = ws.addRow([`${roman}. ${sec.section || ""}`]);
      ws.mergeCells(row.number, 1, row.number, COL_COUNT);
      row.getCell(1).font = { name: "Times New Roman", size: 12, bold: true };
      row.getCell(1).alignment = { horizontal: "left", vertical: "middle" };
      for (let i = 1; i <= COL_COUNT; i += 1) {
        row.getCell(i).border = thinBorder();
        row.getCell(i).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFCBD5E1" }
        };
      }
    },
    onWorkHeader(group) {
      const row = ws.addRow([
        group.workType || "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        group.totalQty
      ]);
      ws.mergeCells(row.number, 1, row.number, LABEL_COLS);
      row.getCell(1).font = { name: "Times New Roman", size: 11, bold: true };
      row.getCell(1).alignment = { horizontal: "left", vertical: "middle" };
      row.getCell(10).font = { name: "Times New Roman", size: 11, bold: true };
      row.getCell(10).alignment = { horizontal: "right", vertical: "middle" };
      row.getCell(10).value = groupTotalLabel(group);
      for (let i = 1; i <= COL_COUNT; i += 1) {
        row.getCell(i).border = thinBorder();
        row.getCell(i).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE2E8F0" }
        };
      }
    },
    onRow(item, stt) {
      const row = ws.addRow([
        stt,
        item.dateLabel || "",
        null,
        null,
        item.side || item.sideLabel || "",
        item.unitLabel || item.unit || "",
        null,
        null,
        null,
        null
      ]);
      setExcelKmCell(row.getCell(3), item.kmFrom);
      setExcelKmCell(row.getCell(4), item.kmTo);
      setExcelDecimalCell(row.getCell(7), item.length, { forceDecimals: true });
      setExcelDecimalCell(row.getCell(8), item.width, { forceDecimals: true });
      setExcelDecimalCell(row.getCell(9), item.height, { forceDecimals: true });
      setExcelDecimalCell(row.getCell(10), item.quantity, { forceDecimals: true });

      row.eachCell((c, col) => {
        c.font = { name: "Times New Roman", size: 11 };
        c.border = thinBorder();
        c.alignment = {
          vertical: "middle",
          horizontal: col === 1 || (col >= 7 && col <= 10) ? "right" : col === 3 || col === 4 ? "center" : "left"
        };
      });
    }
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Form xem / in / Excel bảng kê khối lượng chi tiết — nhóm theo đầu việc, tổng trên hàng tiêu đề.
 */
export default function VolumeDetailFormModal({
  open,
  rows,
  dateFrom,
  dateTo,
  onClose
}) {
  if (!open) return null;

  const period = periodLabel(dateFrom, dateTo);
  const { sections } = groupVolumeDetailRows(rows);
  const workCount = sections.reduce((n, s) => n + s.workGroups.length, 0);

  function handlePrint() {
    const sheetsHtml = `<div class="sheet"><div class="sheet-inner">
      <h1>Bảng kê khối lượng chi tiết</h1>
      ${period ? `<p class="meta">${period}</p>` : ""}
      ${buildDetailTableHtml(sections)}
    </div></div>`;
    printViaIframe({
      title: "Khối lượng chi tiết",
      css: PRINT_CSS,
      sheetsHtml,
      pageWMm: 297,
      pageHMm: 210
    });
  }

  async function handleExcel() {
    const from = dateFrom || "start";
    const to = dateTo || "end";
    await exportVolumeDetailExcel(sections, {
      period,
      filename: `Khoi_luong_chi_tiet_${from}_${to}.xlsx`
    });
  }

  const bodyNodes = [];
  if (rows.length > 0) {
    walkGroupedRows(sections, {
      onSectionHeader(sec, roman) {
        bodyNodes.push(
          <tr key={`sec-${sec.section}`} className="stats-kl-group-row">
            <td colSpan={COL_COUNT}>
              <strong>
                {roman}. {sec.section}
              </strong>
            </td>
          </tr>
        );
      },
      onWorkHeader(group, sec) {
        bodyNodes.push(
          <tr
            key={`work-${sec.section}-${group.workType}-${group.unit}`}
            className="stats-kl-sec-row"
          >
            <td colSpan={LABEL_COLS}>
              <strong>{group.workType}</strong>
            </td>
            <td className="stats-num">
              <strong>{groupTotalLabel(group)}</strong>
            </td>
          </tr>
        );
      },
      onRow(row, stt, group) {
        bodyNodes.push(
          <tr key={`${group.workType}_${group.unit}_${stt}_${row.date}_${row.kmFrom}`}>
            <td className="stats-num">{stt}</td>
            <td>{cell(row.dateLabel)}</td>
            <td>{cell(row.kmFromLabel)}</td>
            <td>{cell(row.kmToLabel)}</td>
            <td>{cell(row.side || row.sideLabel)}</td>
            <td>{cell(row.unitLabel || row.unit)}</td>
            <td className="stats-num">{cell(row.length)}</td>
            <td className="stats-num">{cell(row.width)}</td>
            <td className="stats-num">{cell(row.height)}</td>
            <td className="stats-num">{cell(qtyLabel(row))}</td>
          </tr>
        );
      }
    });
  }

  return (
    <div
      className="stats-detail-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Khối lượng chi tiết"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="stats-detail-modal">
        <div className="stats-detail-modal-head">
          <div>
            <h2 className="stats-detail-modal-title">Khối lượng chi tiết</h2>
            <p className="stats-detail-modal-sub">
              {rows.length} dòng · {workCount} đầu việc · {sections.length} hạng mục
              {period ? ` · ${period}` : ""}
            </p>
          </div>
          <div className="stats-detail-modal-actions">
            <button
              type="button"
              className="btn-primary btn-primary--compact"
              onClick={handleExcel}
              disabled={rows.length === 0}
            >
              Xuất Excel
            </button>
            <button type="button" className="stats-toolbar-btn" onClick={handlePrint}>
              In bảng kê
            </button>
            <button type="button" className="stats-toolbar-btn" onClick={onClose}>
              Đóng
            </button>
          </div>
        </div>

        <div className="stats-detail-modal-body">
          <table className="stats-kl-detail-table">
            <thead>
              <tr>
                {HEADERS.map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={COL_COUNT} className="stats-empty-hint">
                    Chưa có dòng chi tiết.
                  </td>
                </tr>
              ) : (
                bodyNodes
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
