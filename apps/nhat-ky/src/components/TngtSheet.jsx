import {
  formatMonthTitle,
  formatTngtKmLine,
  entryToTngtRow
} from "../utils/tngtFormat";
import { TNGT_COLS, useTngtColWidths } from "../hooks/useTngtColWidths";
import TngtTableHead from "./TngtTableHead";

const MIN_ROWS = 10;

function emptyRows(count) {
  return Array.from({ length: count }, (_, i) => (
    <tr key={`empty-${i}`} className="tngt-data-row tngt-data-row--empty">
      {TNGT_COLS.map((col) => (
        <td key={col.key} />
      ))}
    </tr>
  ));
}

/** Tổng hợp TNGT tháng — 14 cột (TCVN 14182:2024). */
export default function TngtSheet({ yearMonth, reportMeta, entries }) {
  const { widths, startColumnResize } = useTngtColWidths();
  const kmLine = formatTngtKmLine(reportMeta);

  const rows = entries.map((entry, idx) => {
    const r = entryToTngtRow(entry, idx);
    return (
      <tr key={`${entry.date}-${entry.kmFrom}-${idx}`} className="tngt-data-row">
        <td className="tngt-col-tt">{r.tt}</td>
        <td>{r.location}</td>
        <td className="tngt-col-date">{r.occurDate}</td>
        <td>{r.vehicleAuto}</td>
        <td className="tngt-col-mark">{r.vehicleMoto}</td>
        <td className="tngt-col-mark">{r.vehicleBike}</td>
        <td className="tngt-col-mark">{r.causeDuong}</td>
        <td className="tngt-col-mark">{r.causeNguoi}</td>
        <td className="tngt-col-mark">{r.causePhuongTien}</td>
        <td>{r.dead}</td>
        <td>{r.injured}</td>
        <td>{r.damageRoad}</td>
        <td>{r.damageVehicle}</td>
        <td className="tngt-col-note">{r.note}</td>
      </tr>
    );
  });

  const padCount = Math.max(0, MIN_ROWS - rows.length);

  return (
    <div className="tngt-sheet-wrap">
      <div className="tngt-sheet tngt-sheet--a4-landscape">
        <h1 className="tngt-title tngt-title--report">
          TỔNG HỢP TAI NẠN GIAO THÔNG ĐƯỜNG BỘ {formatMonthTitle(yearMonth)}
        </h1>
        {kmLine && <p className="tngt-km-range">{kmLine}</p>}

        <table className="tngt-table">
          <colgroup>
            {TNGT_COLS.map((col) => (
              <col key={col.key} style={{ width: `${widths[col.key]}px` }} />
            ))}
          </colgroup>
          <thead>
            <TngtTableHead resizable onResizeStart={startColumnResize} />
          </thead>
          <tbody>
            {rows}
            {emptyRows(padCount)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
