import { computeSummaryByDirection, columnGrandTotals } from "../utils/demXeCompute";
import { formatDisplayDate } from "../utils/nhatKyFormat";

export default function DemXeSummarySheet({ days }) {
  const { dates, rows } = computeSummaryByDirection(days || {});
  const grand = columnGrandTotals(dates, rows);

  if (!dates.length) {
    return (
      <div className="demxe-sheet demxe-sheet--summary demxe-print-section" data-print-section="summary">
        <h2 className="demxe-summary-title">Bảng tổng hợp lưu lượng xe</h2>
        <p className="demxe-empty-form">Chưa có dữ liệu đếm xe để tổng hợp.</p>
      </div>
    );
  }

  return (
    <div className="demxe-sheet demxe-sheet--summary demxe-print-section" data-print-section="summary">
      <h2 className="demxe-summary-title">BẢNG TỔNG HỢP LƯU LƯỢNG XE QUA LẠI / NGÀY</h2>
      <div className="demxe-summary-scroll">
        <table className="demxe-official-table demxe-summary-table">
          <thead>
            <tr>
              <th>TT</th>
              <th>Hướng xe chạy</th>
              <th>Chủng loại xe</th>
              {dates.map((d) => (
                <th key={d}>{formatDisplayDate(d)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={`${row.vehicleKey}-${row.directionLabel}`}>
                <td>{idx + 1}</td>
                <td>{row.directionLabel}</td>
                <td>{row.vehicleLabel}</td>
                {dates.map((d) => (
                  <td key={d} className="demxe-num">{row.byDate[d] || ""}</td>
                ))}
              </tr>
            ))}
            <tr className="demxe-summary-grand">
              <td colSpan={3}><strong>Tổng cộng</strong></td>
              {dates.map((d) => (
                <td key={d} className="demxe-num"><strong>{grand[d] || ""}</strong></td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="demxe-summary-note">Bảng tự động tính từ dữ liệu nhập — không chỉnh sửa trực tiếp.</p>
    </div>
  );
}
