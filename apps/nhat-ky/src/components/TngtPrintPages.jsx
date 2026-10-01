import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  entryToTngtRow,
  formatMonthTitle,
  formatTngtKmLine,
  packTngtPages,
  computeTngtPadRows,
  estimateTngtDataRowMm,
  TNGT_SHEET_LAYOUT
} from "../utils/tngtFormat";
import {
  TNGT_COLS,
  getTngtColWidths,
  sumTngtCols
} from "../hooks/useTngtColWidths";
import {
  useOrderedEntriesByRoute,
  useRouteDisplayBlocks
} from "../hooks/useRouteDisplayBlocks";
import { blocksForPackedEntries } from "../utils/roadsCatalog";
import TngtTableHead from "./TngtTableHead";
import NhatKyMarginGuides from "./NhatKyMarginGuides";
import RouteHeaderRow from "./RouteHeaderRow";

function emptyRows(count, rowHeightMm) {
  if (count <= 0) return null;
  return Array.from({ length: count }, (_, i) => (
    <tr key={`empty-${i}`} className="tngt-data-row tngt-data-row--empty">
      {TNGT_COLS.map((col) => (
        <td
          key={col.key}
          style={{ height: `${rowHeightMm}mm`, minHeight: `${rowHeightMm}mm` }}
        />
      ))}
    </tr>
  ));
}

function BlockRows({ blocks }) {
  return (blocks || []).map((block) => {
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
    const h = estimateTngtDataRowMm(block.entry);
    return (
      <tr key={block.key} className="tngt-data-row" style={{ height: `${h}mm` }}>
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
}

function TngtPrintPage({
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
  const total = sumTngtCols(widths) || 1;
  const kmLine = formatTngtKmLine(reportMeta);
  const { count: padCount, rowHeightMm } = useMemo(
    () => computeTngtPadRows(entries, margins),
    [entries, margins]
  );
  const pad = {
    paddingTop: `${margins.top}mm`,
    paddingRight: `${margins.right}mm`,
    paddingBottom: `${margins.bottom}mm`,
    paddingLeft: `${margins.left}mm`
  };

  useLayoutEffect(() => {
    const page = pageRef.current;
    const dataRows = page?.querySelectorAll(
      "tbody tr.tngt-data-row:not(.tngt-data-row--empty)"
    );
    const lastRow = dataRows?.[dataRows.length - 1];
    const lastEntry = entries?.[entries.length - 1];
    if (!page || !lastRow || !lastEntry) return;

    const pageRect = page.getBoundingClientRect();
    const pxPerMm = pageRect.height / TNGT_SHEET_LAYOUT.sheetHeightMm;
    const bottomLimit =
      pageRect.bottom -
      ((Number(margins.bottom) || 0) + TNGT_SHEET_LAYOUT.safetyMm) * pxPerMm;

    if (lastRow.getBoundingClientRect().bottom > bottomLimit + 0.5) {
      onRowOverflow?.(pageIndex, lastEntry);
    }
  }, [entries, margins.bottom, onRowOverflow, pageIndex, widths]);

  return (
    <section
      ref={pageRef}
      className="tngt-print-page landscape-print-page"
      style={pad}
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
        <p className="landscape-print-page-num no-print">
          Tờ {pageIndex + 1}/{pageCount}
        </p>
      ) : null}
      <div className="tngt-print-inner">
        <h1 className="tngt-title tngt-title--report">
          TỔNG HỢP TAI NẠN GIAO THÔNG ĐƯỜNG BỘ {formatMonthTitle(yearMonth)}
        </h1>
        {kmLine ? <p className="tngt-km-range">{kmLine}</p> : null}
        <table className="tngt-table tngt-table--print">
          <colgroup>
            {TNGT_COLS.map((col) => (
              <col key={col.key} style={{ width: `${(widths[col.key] / total) * 100}%` }} />
            ))}
          </colgroup>
          <thead>
            <TngtTableHead />
          </thead>
          <tbody>
            <BlockRows blocks={blocks} />
            {emptyRows(padCount, rowHeightMm)}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Xem trước / in sổ TNGT — A4 ngang; gộp đường thì tách tiêu đề nhánh. */
export default function TngtPrintPages({
  yearMonth,
  reportMeta,
  entries,
  margins = { top: 8, right: 10, bottom: 8, left: 10 },
  onMarginsChange,
  widths: widthsProp
}) {
  const widths = widthsProp || getTngtColWidths();
  const allBlocks = useRouteDisplayBlocks(entries, "Tai nạn khác");
  const ordered = useOrderedEntriesByRoute(entries, "Tai nạn khác");
  const estimatedChunks = useMemo(
    () => packTngtPages(ordered, margins),
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
      if (next[pageIndex + 1]) next[pageIndex + 1].unshift(moved);
      else next.push([moved]);
      return next;
    });
  }, []);

  return (
    <div
      className="tngt-print-stack tngt-print-stack--preview landscape-print-stack--preview"
      data-page-count={chunks.length}
    >
      {chunks.map((chunk, i) => (
        <TngtPrintPage
          key={`tngt-p${i}`}
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
