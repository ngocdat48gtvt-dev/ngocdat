import { useMemo } from "react";
import {
  entryToMatDuongRow,
  formatMatDuongKmLine,
  formatMatDuongMonthTitle,
  computeMatDuongPadRows,
  packMatDuongPages,
  estimateMatDuongDataRowMm
} from "../utils/matDuongFormat";
import {
  MAT_DUONG_COLS,
  getMatDuongColWidths,
  sumMatDuongCols
} from "../hooks/useMatDuongColWidths";
import MatDuongTableHead from "./MatDuongTableHead";
import NhatKyMarginGuides from "./NhatKyMarginGuides";

function emptyRows(count, rowHeightMm) {
  if (count <= 0) return null;
  return Array.from({ length: count }, (_, i) => (
    <tr key={`empty-${i}`} className="matduong-data-row matduong-data-row--empty">
      {MAT_DUONG_COLS.map((col) => (
        <td
          key={col.key}
          style={{ height: `${rowHeightMm}mm`, minHeight: `${rowHeightMm}mm` }}
        />
      ))}
    </tr>
  ));
}

function SheetHeader({ reportMeta, yearMonth }) {
  const kmLine = formatMatDuongKmLine(reportMeta);
  const monthLabel = formatMatDuongMonthTitle(yearMonth);
  return (
    <div className="matduong-sheet-top">
      <div className="matduong-sheet-head">
        <div className="matduong-head-left">
          <div className="matduong-head-line">{reportMeta.company}</div>
          <div className="matduong-head-line">Tên Hạt: {reportMeta.hat}</div>
          <div className="matduong-head-line">Tên đường: {reportMeta.roadName}</div>
        </div>
        <div className="matduong-head-right">
          <div className="matduong-head-line">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
          <div className="matduong-head-line matduong-motto">Độc lập - Tự do - Hạnh phúc</div>
        </div>
      </div>
      <h1 className="matduong-title">ĐÁNH GIÁ TÌNH TRẠNG MẶT ĐƯỜNG {monthLabel}</h1>
      <p className="matduong-km-range">{kmLine || "Lý trình: … đến …/QL"}</p>
    </div>
  );
}

function DataRows({ entries }) {
  return entries.map((entry, idx) => {
    const r = entryToMatDuongRow(entry);
    const h = estimateMatDuongDataRowMm(entry);
    return (
      <tr
        key={`${entry.date}-${entry.kmFrom}-${idx}`}
        className="matduong-data-row"
        style={{ height: `${h}mm` }}
      >
        <td className="matduong-col-date" style={{ height: `${h}mm` }}>
          {r.date}
        </td>
        <td style={{ height: `${h}mm` }}>{r.kmFrom}</td>
        <td style={{ height: `${h}mm` }}>{r.kmTo}</td>
        <td className="matduong-col-side" style={{ height: `${h}mm` }}>
          {r.side}
        </td>
        <td style={{ height: `${h}mm` }}>{r.length}</td>
        <td style={{ height: `${h}mm` }}>{r.width}</td>
        <td style={{ height: `${h}mm` }}>{r.area}</td>
        <td className="matduong-col-damage" style={{ height: `${h}mm` }}>
          {r.damageLevel}
        </td>
        <td className="matduong-resolved-co" style={{ height: `${h}mm` }}>
          {r.resolvedCo}
        </td>
        <td className="matduong-resolved-chua" style={{ height: `${h}mm` }}>
          {r.resolvedChua}
        </td>
        <td style={{ height: `${h}mm` }}>{r.inspectorSign}</td>
        <td className="matduong-col-note" style={{ height: `${h}mm` }}>
          {r.inspectorNote}
        </td>
      </tr>
    );
  });
}

function MatDuongPrintPage({
  yearMonth,
  reportMeta,
  entries,
  margins,
  widths,
  showGuides,
  onMarginsChange,
  pageIndex,
  pageCount
}) {
  const total = sumMatDuongCols(widths) || 1;
  const { count: padCount, rowHeightMm } = computeMatDuongPadRows(entries, margins);
  const pad = {
    paddingTop: `${margins.top}mm`,
    paddingRight: `${margins.right}mm`,
    paddingBottom: `${margins.bottom}mm`,
    paddingLeft: `${margins.left}mm`
  };

  return (
    <section className="matduong-print-page" style={pad} data-print-page={pageIndex + 1}>
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
              <DataRows entries={entries} />
              {emptyRows(padCount, rowHeightMm)}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

/**
 * Xem trước / in sổ mặt đường — nhiều tờ A4 ngang, lề kéo kiểu Excel.
 * Preview và bản in dùng cùng công thức đóng gói + cùng cỡ chữ/cao hàng.
 */
export default function MatDuongPrintPages({
  yearMonth,
  reportMeta,
  entries,
  margins = { top: 8, right: 10, bottom: 8, left: 10 },
  onMarginsChange,
  widths: widthsProp
}) {
  const widths = widthsProp || getMatDuongColWidths();
  const chunks = useMemo(
    () => packMatDuongPages(entries, margins),
    [entries, margins]
  );

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
          entries={chunk}
          margins={margins}
          widths={widths}
          showGuides={i === 0}
          onMarginsChange={onMarginsChange}
          pageIndex={i}
          pageCount={chunks.length}
        />
      ))}
    </div>
  );
}
