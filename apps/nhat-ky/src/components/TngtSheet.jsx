import { useMemo } from "react";
import {
  formatMonthTitle,
  formatTngtKmLine,
  entryToTngtRow,
  computeTngtPadRows
} from "../utils/tngtFormat";
import { TNGT_COLS, useTngtColWidths } from "../hooks/useTngtColWidths";
import { useRouteDisplayBlocks } from "../hooks/useRouteDisplayBlocks";
import TngtTableHead from "./TngtTableHead";
import RouteHeaderRow from "./RouteHeaderRow";

const SCREEN_MARGINS = { top: 8, right: 10, bottom: 8, left: 10 };

function emptyRows(count, rowHeightMm) {
  if (count <= 0) return null;
  return Array.from({ length: count }, (_, i) => (
    <tr key={`empty-${i}`} className="tngt-data-row tngt-data-row--empty">
      {TNGT_COLS.map((col) => (
        <td
          key={col.key}
          style={
            rowHeightMm
              ? { height: `${rowHeightMm}mm`, minHeight: `${rowHeightMm}mm` }
              : undefined
          }
        />
      ))}
    </tr>
  ));
}

/** Tổng hợp TNGT tháng — 14 cột (TCVN 14182:2024). */
export default function TngtSheet({ yearMonth, reportMeta, entries }) {
  const { widths, startColumnResize } = useTngtColWidths();
  const kmLine = formatTngtKmLine(reportMeta);
  const blocks = useRouteDisplayBlocks(entries, "Tai nạn khác");
  const orderedEntries = useMemo(
    () => blocks.filter((b) => b.kind === "entry").map((b) => b.entry),
    [blocks]
  );
  const { count: padCount, rowHeightMm } = useMemo(
    () => computeTngtPadRows(orderedEntries, SCREEN_MARGINS),
    [orderedEntries]
  );

  const rows = blocks.map((block) => {
    if (block.kind === "routeHeader") {
      return (
        <RouteHeaderRow
          key={block.key}
          heading={block.heading}
          colSpan={TNGT_COLS.length}
        />
      );
    }
    const r = entryToTngtRow(block.entry, Math.max(0, (block.stt || 1) - 1));
    r.tt = block.stt;
    return (
      <tr key={block.key} className="tngt-data-row">
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
            {emptyRows(padCount, rowHeightMm)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
