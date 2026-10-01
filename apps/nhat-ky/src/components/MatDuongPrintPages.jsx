import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  entryToMatDuongRow,
  formatMatDuongKmLine,
  formatMatDuongMonthTitle,
  packMatDuongPages,
  estimateMatDuongDataRowMm,
  MAT_DUONG_SHEET_LAYOUT
} from "../utils/matDuongFormat";
import {
  MAT_DUONG_COLS,
  getMatDuongColWidths,
  sumMatDuongCols
} from "../hooks/useMatDuongColWidths";
import {
  useOrderedEntriesByRoute,
  useRouteDisplayBlocks
} from "../hooks/useRouteDisplayBlocks";
import { blocksForPackedEntries } from "../utils/roadsCatalog";
import MatDuongTableHead from "./MatDuongTableHead";
import NhatKyMarginGuides from "./NhatKyMarginGuides";
import RouteHeaderRow from "./RouteHeaderRow";

function SheetHeader({ reportMeta, yearMonth }) {
  const kmLine = formatMatDuongKmLine(reportMeta);
  const monthLabel = formatMatDuongMonthTitle(yearMonth);
  return (
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
      <h1 className="matduong-title">ĐÁNH GIÁ TÌNH TRẠNG MẶT ĐƯỜNG {monthLabel}</h1>
      <p className="matduong-km-range">{kmLine || "QL6C (TL-CN) đoạn Km… - Km…"}</p>
    </div>
  );
}

function BlockRows({ blocks }) {
  return (blocks || []).map((block) => {
    if (block.kind === "routeHeader") {
      return (
        <RouteHeaderRow
          key={block.key}
          heading={block.heading}
          colSpan={MAT_DUONG_COLS.length}
        />
      );
    }
    const h = estimateMatDuongDataRowMm(block.entry);
    const rowStyle = { height: `${h}mm`, minHeight: `${h}mm` };
    if (block.entry?._matDuongMaintenanceSummary) {
      const r = entryToMatDuongRow(block.entry);
      return (
        <tr
          key={block.key}
          className="matduong-data-row matduong-maintenance-summary"
          style={rowStyle}
        >
          <td className="matduong-col-date" style={rowStyle}>
            {r.date}
          </td>
          <td
            colSpan={7}
            className="matduong-maintenance-summary-text"
            style={rowStyle}
          >
            {block.entry.maintenanceText}
          </td>
          <td className="matduong-resolved-co" style={rowStyle}>
            {r.resolvedCo}
          </td>
          <td className="matduong-resolved-chua" style={rowStyle} />
          <td style={rowStyle}>{r.inspectorSign}</td>
          <td className="matduong-col-note" style={rowStyle}>
            {r.inspectorNote}
          </td>
        </tr>
      );
    }
    const r = entryToMatDuongRow(block.entry);
    return (
      <tr key={block.key} className="matduong-data-row" style={rowStyle}>
        <td className="matduong-col-date" style={rowStyle}>
          {r.date}
        </td>
        <td style={rowStyle}>{r.kmFrom}</td>
        <td style={rowStyle}>{r.kmTo}</td>
        <td className="matduong-col-side" style={rowStyle}>
          {r.side}
        </td>
        <td style={rowStyle}>{r.length}</td>
        <td style={rowStyle}>{r.width}</td>
        <td style={rowStyle}>{r.area}</td>
        <td className="matduong-col-damage" style={rowStyle}>
          {r.damageLevel}
        </td>
        <td className="matduong-resolved-co" style={rowStyle}>
          {r.resolvedCo}
        </td>
        <td className="matduong-resolved-chua" style={rowStyle}>
          {r.resolvedChua}
        </td>
        <td style={rowStyle}>{r.inspectorSign}</td>
        <td className="matduong-col-note" style={rowStyle}>
          {r.inspectorNote}
        </td>
      </tr>
    );
  });
}

function MatDuongPrintPage({
  yearMonth,
  reportMeta,
  blocks,
  entries,
  margins,
  widths,
  showGuides,
  onMarginsChange,
  onRowOverflow,
  pageIndex,
  pageCount
}) {
  const pageRef = useRef(null);
  const total = sumMatDuongCols(widths) || 1;
  const pagePad = {
    paddingTop: `${margins.top}mm`,
    paddingRight: `${margins.right}mm`,
    paddingBottom: `${margins.bottom}mm`,
    paddingLeft: `${margins.left}mm`
  };

  useLayoutEffect(() => {
    const page = pageRef.current;
    const dataRows = page?.querySelectorAll(
      "tbody tr.matduong-data-row:not(.matduong-data-row--empty)"
    );
    const lastRow = dataRows?.[dataRows.length - 1];
    const lastEntry = entries?.[entries.length - 1];
    if (!page || !lastRow || !lastEntry) return;

    const pageRect = page.getBoundingClientRect();
    const pxPerMm = pageRect.height / MAT_DUONG_SHEET_LAYOUT.sheetHeightMm;
    const bottomLimit =
      pageRect.bottom -
      ((Number(margins.bottom) || 0) + MAT_DUONG_SHEET_LAYOUT.safetyMm) * pxPerMm;

    if (lastRow.getBoundingClientRect().bottom > bottomLimit + 0.5) {
      onRowOverflow?.(pageIndex, lastEntry);
    }
  }, [entries, margins.bottom, onRowOverflow, pageIndex, widths]);

  return (
    <section
      ref={pageRef}
      className="matduong-print-page"
      style={pagePad}
      data-print-page={pageIndex + 1}
    >
      {showGuides && onMarginsChange ? (
        <NhatKyMarginGuides
          margins={margins}
          onChange={onMarginsChange}
          pageWMm={297}
          pageHMm={210}
          minContentMm={100}
        />
      ) : null}
      {pageCount > 1 ? (
        <p className="matduong-print-page-num no-print">
          Tờ {pageIndex + 1}/{pageCount}
        </p>
      ) : null}
      <div className="matduong-print-inner">
        <SheetHeader reportMeta={reportMeta} yearMonth={yearMonth} />
        <div className="matduong-table-area">
          <table className="matduong-table matduong-table--print">
            <colgroup>
              {MAT_DUONG_COLS.map((col) => (
                <col
                  key={col.key}
                  style={{ width: `${(widths[col.key] / total) * 100}%` }}
                />
              ))}
            </colgroup>
            <thead>
              <MatDuongTableHead />
            </thead>
            <tbody>
              <BlockRows blocks={blocks} />
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

/** Xem trước / in sổ mặt đường — nhiều tờ A4 ngang; gộp đường thì tách tiêu đề nhánh. */
export default function MatDuongPrintPages({
  yearMonth,
  reportMeta,
  entries,
  margins = { top: 8, right: 10, bottom: 8, left: 10 },
  onMarginsChange,
  widths: widthsProp
}) {
  const widths = widthsProp || getMatDuongColWidths();
  const allBlocks = useRouteDisplayBlocks(entries);
  const ordered = useOrderedEntriesByRoute(entries);
  const estimatedChunks = useMemo(
    () => packMatDuongPages(ordered, margins),
    [ordered, margins]
  );
  const [chunks, setChunks] = useState(estimatedChunks);

  useLayoutEffect(() => {
    setChunks(estimatedChunks);
  }, [estimatedChunks]);

  const moveOverflowRow = useCallback((pageIndex, expectedLastEntry) => {
    setChunks((current) => {
      const source = current[pageIndex];
      if (
        !source ||
        source.length <= 1 ||
        source[source.length - 1] !== expectedLastEntry
      ) {
        return current;
      }

      const next = current.map((chunk) => [...chunk]);
      const moved = next[pageIndex].pop();
      if (next[pageIndex + 1]) {
        next[pageIndex + 1].unshift(moved);
      } else {
        next.push([moved]);
      }
      return next;
    });
  }, []);

  return (
    <div
      className="matduong-print-stack matduong-print-stack--preview"
      data-page-count={chunks.length}
    >
      {chunks.map((chunk, i) => (
        <MatDuongPrintPage
          key={`md-p${i}`}
          yearMonth={yearMonth}
          reportMeta={reportMeta}
          blocks={blocksForPackedEntries(allBlocks, chunk)}
          entries={chunk}
          margins={margins}
          widths={widths}
          showGuides={i === 0}
          onMarginsChange={onMarginsChange}
          onRowOverflow={moveOverflowRow}
          pageIndex={i}
          pageCount={chunks.length}
        />
      ))}
    </div>
  );
}
