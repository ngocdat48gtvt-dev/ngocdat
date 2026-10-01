import { useMemo } from "react";
import {
  entryToMatDuongRow,
  formatMatDuongKmLine,
  formatMatDuongMonthTitle,
  computeMatDuongPadRows
} from "../utils/matDuongFormat";
import { MAT_DUONG_COLS, useMatDuongColWidths } from "../hooks/useMatDuongColWidths";
import { useRouteDisplayBlocks } from "../hooks/useRouteDisplayBlocks";
import MatDuongTableHead from "./MatDuongTableHead";
import RouteHeaderRow from "./RouteHeaderRow";

function emptyRows(count, rowHeightMm) {
  return Array.from({ length: count }, (_, i) => (
    <tr key={`empty-${i}`} className="matduong-data-row matduong-data-row--empty">
      {MAT_DUONG_COLS.map((col) => (
        <td key={col.key} style={{ height: `${rowHeightMm}mm` }} />
      ))}
    </tr>
  ));
}

/** Sổ theo dõi tình trạng mặt đường — 12 cột Phụ lục 09 QL37. */
export default function MatDuongSheet({ yearMonth, reportMeta, entries }) {
  const { widths, startColumnResize } = useMatDuongColWidths();
  const kmLine = formatMatDuongKmLine(reportMeta);
  const monthLabel = formatMatDuongMonthTitle(yearMonth);
  const blocks = useRouteDisplayBlocks(entries);
  const orderedEntries = useMemo(
    () => blocks.filter((b) => b.kind === "entry").map((b) => b.entry),
    [blocks]
  );
  const { count: padCount, rowHeightMm } = computeMatDuongPadRows(orderedEntries);

  const rows = blocks.map((block) => {
    if (block.kind === "routeHeader") {
      return (
        <RouteHeaderRow
          key={block.key}
          heading={block.heading}
          colSpan={MAT_DUONG_COLS.length}
        />
      );
    }
    if (block.entry?._matDuongMaintenanceSummary) {
      const summary = entryToMatDuongRow(block.entry);
      return (
        <tr key={block.key} className="matduong-data-row matduong-maintenance-summary">
          <td className="matduong-col-date">{summary.date}</td>
          <td colSpan={7} className="matduong-maintenance-summary-text">
            {block.entry.maintenanceText}
          </td>
          <td className="matduong-resolved-co">{summary.resolvedCo}</td>
          <td className="matduong-resolved-chua" />
          <td>{summary.inspectorSign}</td>
          <td className="matduong-col-note">{summary.inspectorNote}</td>
        </tr>
      );
    }
    const r = entryToMatDuongRow(block.entry);
    return (
      <tr key={block.key} className="matduong-data-row">
        <td className="matduong-col-date">{r.date}</td>
        <td>{r.kmFrom}</td>
        <td>{r.kmTo}</td>
        <td className="matduong-col-side">{r.side}</td>
        <td>{r.length}</td>
        <td>{r.width}</td>
        <td>{r.area}</td>
        <td className="matduong-col-damage">{r.damageLevel}</td>
        <td className="matduong-resolved-co">{r.resolvedCo}</td>
        <td className="matduong-resolved-chua">{r.resolvedChua}</td>
        <td>{r.inspectorSign}</td>
        <td className="matduong-col-note">{r.inspectorNote}</td>
      </tr>
    );
  });

  return (
    <div className="matduong-sheet-wrap">
      <div className="matduong-sheet matduong-sheet--a4-landscape">
        <div className="matduong-sheet-top">
          <div className="matduong-sheet-head">
            <div className="matduong-head-left">
              <div className="matduong-head-line matduong-head-line--company">
                {reportMeta.company}
              </div>
              <div className="matduong-head-line">Tên Hạt: {reportMeta.hat}</div>
              <div className="matduong-head-line">Tên đường: {reportMeta.roadName}</div>
            </div>
            <div className="matduong-head-right">
              <div className="matduong-head-line">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
              <div className="matduong-head-line matduong-motto">Độc lập - Tự do - Hạnh phúc</div>
            </div>
          </div>

          <h1 className="matduong-title">
            ĐÁNH GIÁ TÌNH TRẠNG MẶT ĐƯỜNG {monthLabel}
          </h1>
          <p className="matduong-km-range">{kmLine || "QL6C (TL-CN) đoạn Km… - Km…"}</p>
        </div>

        <div className="matduong-table-area">
          <table className="matduong-table matduong-table--fill">
            <colgroup>
              {MAT_DUONG_COLS.map((col) => (
                <col key={col.key} style={{ width: `${widths[col.key]}px` }} />
              ))}
            </colgroup>
            <thead>
              <MatDuongTableHead resizable onResizeStart={startColumnResize} />
            </thead>
            <tbody>
              {rows}
              {emptyRows(padCount, rowHeightMm)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
