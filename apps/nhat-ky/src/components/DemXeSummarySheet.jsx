import { DIRECTION_DI, DIRECTION_VE } from "../utils/demXeConstants";
import {
  batchMonthYearLabel,
  computeDirectionBatchTable,
  listCountBatches
} from "../utils/demXeCompute";

function dayColumnLabel(isoDate) {
  if (!isoDate) return "Ngày …";
  const parts = String(isoDate).split("-");
  if (parts.length < 3) return "Ngày …";
  const [, m, d] = parts;
  return `Ngày ${Number(d)}/${Number(m)}`;
}

function SummaryDirectionTable({ table, dayLabels }) {
  const rowCount = table.rows.length;
  const from = table.from || "………";
  const to = table.to || "………";

  return (
    <table className="demxe-official-table demxe-summary-official-table">
      <colgroup>
        <col className="demxe-summary-col-tt" />
        <col className="demxe-summary-col-dir" />
        <col className="demxe-summary-col-type" />
        <col className="demxe-summary-col-qty" />
        <col className="demxe-summary-col-qty" />
        <col className="demxe-summary-col-qty" />
        <col className="demxe-summary-col-note" />
      </colgroup>
      <thead>
        <tr>
          <th rowSpan={2}>TT</th>
          <th rowSpan={2}>HƯỚNG XE CHẠY</th>
          <th rowSpan={2}>CHỦNG LOẠI XE</th>
          <th colSpan={3}>SỐ LƯỢNG</th>
          <th rowSpan={2}>GHI CHÚ</th>
        </tr>
        <tr>
          {dayLabels.map((label, idx) => (
            <th key={idx} className="demxe-summary-day-th">
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {table.rows.map((row, rowIdx) => (
          <tr key={row.vehicleKey}>
            <td className="demxe-num demxe-summary-stt">{row.tt}</td>
            {rowIdx === 0 && (
              <td rowSpan={rowCount} className="demxe-summary-direction-cell">
                <span className="demxe-summary-dir-line">
                  Xe chạy từ: {from} Đến: {to}
                </span>
              </td>
            )}
            <td className="demxe-summary-type-cell">{row.vehicleLabel}</td>
            {row.displayCounts.map((val, colIdx) => (
              <td key={colIdx} className="demxe-num demxe-summary-qty-cell">
                {val}
              </td>
            ))}
            <td className="demxe-summary-note-cell">&nbsp;</td>
          </tr>
        ))}
        <tr className="demxe-summary-total-row">
          <td colSpan={2} className="demxe-summary-total-label">
            <strong>Tổng</strong>
          </td>
          <td>&nbsp;</td>
          {table.colTotalsDisplay.map((val, colIdx) => (
            <td key={colIdx} className="demxe-num">
              <strong>{val}</strong>
            </td>
          ))}
          <td>&nbsp;</td>
        </tr>
      </tbody>
    </table>
  );
}

function SummaryBatchPage({ batchStart, days }) {
  const diTable = computeDirectionBatchTable(days, batchStart, DIRECTION_DI);
  const veTable = computeDirectionBatchTable(days, batchStart, DIRECTION_VE);
  const dayLabels = diTable.columnDates.map((d) => dayColumnLabel(d));

  return (
    <section className="demxe-summary-page demxe-summary-batch">
      <header className="demxe-summary-page__head">
        <h2 className="demxe-summary-title">BẢNG TỔNG HỢP LƯU LƯỢNG XE QUA LẠI / NGÀY</h2>
        <p className="demxe-summary-subtitle">{batchMonthYearLabel(batchStart)}</p>
      </header>

      <SummaryDirectionTable table={diTable} dayLabels={dayLabels} />
      <SummaryDirectionTable table={veTable} dayLabels={dayLabels} />

      <div className="demxe-summary-sign-row">
        <p>
          <strong>Người giám sát</strong>
        </p>
        <p>
          <strong>Tổ trưởng tổ đếm xe</strong>
        </p>
      </div>
    </section>
  );
}

export default function DemXeSummarySheet({ days, batchStarts = null }) {
  const allBatches = listCountBatches(Object.keys(days || {}));
  const batches = batchStarts?.length
    ? allBatches.filter((b) => batchStarts.includes(b[0]))
    : allBatches;

  if (!batches.length) {
    return (
      <div className="demxe-sheet demxe-sheet--summary demxe-print-section" data-print-section="summary">
        <h2 className="demxe-summary-title">BẢNG TỔNG HỢP LƯU LƯỢNG XE QUA LẠI / NGÀY</h2>
        <p className="demxe-empty-form">Chưa có dữ liệu đếm xe — chọn quý ở cột trái.</p>
      </div>
    );
  }

  return (
    <div className="demxe-summary-stack demxe-print-section" data-print-section="summary">
      {batches.map((batch) => (
        <SummaryBatchPage key={batch[0]} batchStart={batch[0]} days={days} />
      ))}
      <p className="demxe-summary-note no-print">
        Bảng tự động tính từ phiếu đếm chiều đi/chiều về — cập nhật khi nhập liệu.
      </p>
    </div>
  );
}
