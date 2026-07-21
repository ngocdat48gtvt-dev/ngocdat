import { useMemo } from "react";
import {
  entryToHanhLangRow,
  formatHanhLangKmLine,
  formatHanhLangMonthTitle,
  computeHanhLangPadRows,
  packHanhLangPages,
  estimateHanhLangDataRowMm
} from "../utils/hanhLangFormat";
import {
  HANH_LANG_COLS,
  getHanhLangColWidths,
  sumHanhLangCols
} from "../hooks/useHanhLangColWidths";
import HanhLangTableHead from "./HanhLangTableHead";
import NhatKyMarginGuides from "./NhatKyMarginGuides";

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

function DataRows({ entries, sttOffset }) {
  return entries.map((entry, idx) => {
    const r = entryToHanhLangRow(entry, sttOffset + idx);
    const h = estimateHanhLangDataRowMm(entry);
    return (
      <tr
        key={`${entry.date}-${entry.kmFrom}-${sttOffset + idx}`}
        className="hanh-lang-data-row"
        style={{ height: `${h}mm` }}
      >
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
          <div className="hanh-lang-head-line">{reportMeta.company}</div>
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
      <p className="hanh-lang-km-range">{kmLine || "Lý trình: … Đến …/tuyến …"}</p>
    </div>
  );
}

function HanhLangPrintPage({
  yearMonth,
  reportMeta,
  entries,
  sttOffset,
  margins,
  widths,
  showGuides,
  onMarginsChange,
  showFooter,
  pageIndex,
  pageCount
}) {
  const total = sumHanhLangCols(widths) || 1;
  const { count: padCount, rowHeightMm } = computeHanhLangPadRows(entries, margins);
  const pad = {
    paddingTop: `${margins.top}mm`,
    paddingRight: `${margins.right}mm`,
    paddingBottom: `${margins.bottom}mm`,
    paddingLeft: `${margins.left}mm`
  };

  return (
    <section
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
              <DataRows entries={entries} sttOffset={sttOffset} />
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

/** Xem trước / in sổ hành lang — A4 ngang, chia tờ + kéo lề như sổ mặt đường. */
export default function HanhLangPrintPages({
  yearMonth,
  reportMeta,
  entries,
  margins = { top: 8, right: 10, bottom: 8, left: 10 },
  onMarginsChange,
  widths: widthsProp
}) {
  const widths = widthsProp || getHanhLangColWidths();
  const chunks = useMemo(() => packHanhLangPages(entries, margins), [entries, margins]);

  let sttOffset = 0;
  return (
    <div
      className="hanh-lang-print-stack hanh-lang-print-stack--preview landscape-print-stack--preview"
      data-page-count={chunks.length}
    >
      {chunks.map((chunk, i) => {
        const offset = sttOffset;
        sttOffset += chunk.length;
        return (
          <HanhLangPrintPage
            key={`hl-p${i}`}
            yearMonth={yearMonth}
            reportMeta={reportMeta}
            entries={chunk}
            sttOffset={offset}
            margins={margins}
            widths={widths}
            showGuides={i === 0}
            onMarginsChange={onMarginsChange}
            showFooter={i === chunks.length - 1}
            pageIndex={i}
            pageCount={chunks.length}
          />
        );
      })}
    </div>
  );
}
