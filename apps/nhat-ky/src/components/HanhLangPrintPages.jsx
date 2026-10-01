import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  entryToHanhLangRow,
  formatHanhLangKmLine,
  formatHanhLangMonthTitle,
  packHanhLangPages,
  computeHanhLangPadRows,
  estimateHanhLangDataRowMm,
  HANH_LANG_SHEET_LAYOUT
} from "../utils/hanhLangFormat";
import {
  HANH_LANG_COLS,
  getHanhLangColWidths,
  sumHanhLangCols
} from "../hooks/useHanhLangColWidths";
import {
  useOrderedEntriesByRoute,
  useRouteDisplayBlocks
} from "../hooks/useRouteDisplayBlocks";
import { blocksForPackedEntries } from "../utils/roadsCatalog";
import HanhLangTableHead from "./HanhLangTableHead";
import NhatKyMarginGuides from "./NhatKyMarginGuides";
import RouteHeaderRow from "./RouteHeaderRow";

function emptyRows(count, rowHeightMm) {
  if (count <= 0) return null;
  return Array.from({ length: count }, (_, i) => (
    <tr key={`empty-${i}`} className="hanh-lang-data-row hanh-lang-data-row--empty">
      {HANH_LANG_COLS.map((col) => (
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
          colSpan={HANH_LANG_COLS.length}
        />
      );
    }
    const r = entryToHanhLangRow(block.entry, Math.max(0, (block.stt || 1) - 1));
    r.tt = block.stt;
    const h = estimateHanhLangDataRowMm(block.entry);
    return (
      <tr key={block.key} className="hanh-lang-data-row" style={{ height: `${h}mm` }}>
        <td className="hanh-lang-col-tt">{r.tt}</td>
        <td>{r.recorder}</td>
        <td>{r.violator}</td>
        <td>{r.address}</td>
        <td>{r.location}</td>
        <td className="hanh-lang-col-date">{r.recordDate}</td>
        <td className="hanh-lang-col-content">{r.content}</td>
        <td>{r.area}</td>
        <td className="hanh-lang-col-process">{r.process}</td>
        <td>{r.note}</td>
      </tr>
    );
  });
}

function SheetHeader({ reportMeta, yearMonth }) {
  const kmLine = formatHanhLangKmLine(reportMeta);
  const monthLabel = formatHanhLangMonthTitle(yearMonth);
  return (
    <div className="hanh-lang-sheet-top">
      <div className="hanh-lang-sheet-head">
        <div className="hanh-lang-head-left">
          <div className="hanh-lang-head-line hanh-lang-head-line--company">
            {reportMeta.company}
          </div>
          <div className="hanh-lang-head-line">Tên Hạt: {reportMeta.hat}</div>
          <div className="hanh-lang-head-line">Tên đường: {reportMeta.roadName}</div>
        </div>
        <div className="hanh-lang-head-right">
          <div className="hanh-lang-head-line">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
          <div className="hanh-lang-head-line hanh-lang-motto">Độc lập - Tự do - Hạnh phúc</div>
        </div>
      </div>
      <h1 className="hanh-lang-title">
        TỔNG HỢP VI PHẠM HÀNH LANG AN TOÀN GIAO THÔNG {monthLabel}
      </h1>
      <p className="hanh-lang-km-range">{kmLine || "… đoạn Km… - Km…"}</p>
    </div>
  );
}

function HanhLangPrintPage({
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
  pageCount,
  showFooter
}) {
  const pageRef = useRef(null);
  const total = sumHanhLangCols(widths) || 1;
  const { count: padCount, rowHeightMm } = useMemo(
    () => computeHanhLangPadRows(entries, margins),
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
      "tbody tr.hanh-lang-data-row:not(.hanh-lang-data-row--empty)"
    );
    const lastRow = dataRows?.[dataRows.length - 1];
    const lastEntry = entries?.[entries.length - 1];
    if (!page || !lastRow || !lastEntry) return;

    const pageRect = page.getBoundingClientRect();
    const pxPerMm = pageRect.height / HANH_LANG_SHEET_LAYOUT.sheetHeightMm;
    const bottomLimit =
      pageRect.bottom -
      ((Number(margins.bottom) || 0) + HANH_LANG_SHEET_LAYOUT.safetyMm) * pxPerMm;

    if (lastRow.getBoundingClientRect().bottom > bottomLimit + 0.5) {
      onRowOverflow?.(pageIndex, lastEntry);
    }
  }, [entries, margins.bottom, onRowOverflow, pageIndex, widths, showFooter]);

  return (
    <section
      ref={pageRef}
      className="hanh-lang-print-page landscape-print-page"
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
      <div className="hanh-lang-print-inner">
        <SheetHeader reportMeta={reportMeta} yearMonth={yearMonth} />
        <div className="hanh-lang-table-area">
          <table className="hanh-lang-table hanh-lang-table--print">
            <colgroup>
              {HANH_LANG_COLS.map((col) => (
                <col key={col.key} style={{ width: `${(widths[col.key] / total) * 100}%` }} />
              ))}
            </colgroup>
            <thead>
              <HanhLangTableHead />
            </thead>
            <tbody>
              <BlockRows blocks={blocks} />
              {emptyRows(padCount, rowHeightMm)}
              {showFooter ? (
                <tr className="hanh-lang-footer-row">
                  <td colSpan={2} className="hanh-lang-footer-label">
                    TỔNG CỘNG
                  </td>
                  <td colSpan={8} />
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

/** Xem trước / in sổ hành lang — A4 ngang; gộp đường thì tách tiêu đề nhánh. */
export default function HanhLangPrintPages({
  yearMonth,
  reportMeta,
  entries,
  margins = { top: 8, right: 10, bottom: 8, left: 10 },
  onMarginsChange,
  widths: widthsProp,
  showGuides = true,
  screenMode = false
}) {
  const widths = widthsProp || getHanhLangColWidths();
  const allBlocks = useRouteDisplayBlocks(entries, "Vi phạm khác");
  const ordered = useOrderedEntriesByRoute(entries, "Vi phạm khác");
  const estimatedChunks = useMemo(
    () => packHanhLangPages(ordered, margins),
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
      className={`hanh-lang-print-stack hanh-lang-print-stack--preview landscape-print-stack--preview${
        screenMode ? " hanh-lang-print-stack--screen" : ""
      }`}
      data-page-count={chunks.length}
    >
      {chunks.map((chunk, i) => (
        <HanhLangPrintPage
          key={`hl-p${i}`}
          yearMonth={yearMonth}
          reportMeta={reportMeta}
          blocks={blocksForPackedEntries(allBlocks, chunk)}
          entries={chunk}
          margins={margins}
          widths={widths}
          showGuides={showGuides && i === 0}
          onMarginsChange={onMarginsChange}
          onRowOverflow={moveOverflowRow}
          pageIndex={i}
          pageCount={chunks.length}
          showFooter={i === chunks.length - 1}
        />
      ))}
    </div>
  );
}
