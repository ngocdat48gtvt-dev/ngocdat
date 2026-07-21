import { useMemo } from "react";
import {
  entryToTngtRow,
  formatMonthTitle,
  formatTngtKmLine,
  computeTngtPadRows,
  packTngtPages,
  estimateTngtDataRowMm
} from "../utils/tngtFormat";
import {
  TNGT_COLS,
  getTngtColWidths,
  sumTngtCols
} from "../hooks/useTngtColWidths";
import TngtTableHead from "./TngtTableHead";
import NhatKyMarginGuides from "./NhatKyMarginGuides";

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

function DataRows({ entries, sttOffset }) {
  return entries.map((entry, idx) => {
    const r = entryToTngtRow(entry, sttOffset + idx);
    const h = estimateTngtDataRowMm(entry);
    return (
      <tr
        key={`${entry.date}-${entry.kmFrom}-${sttOffset + idx}`}
        className="tngt-data-row"
        style={{ height: `${h}mm` }}
      >
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
  entries,
  sttOffset,
  margins,
  widths,
  showGuides,
  onMarginsChange,
  pageIndex,
  pageCount
}) {
  const total = sumTngtCols(widths) || 1;
  const { count: padCount, rowHeightMm } = computeTngtPadRows(entries, margins);
  const kmLine = formatTngtKmLine(reportMeta);
  const pad = {
    paddingTop: `${margins.top}mm`,
    paddingRight: `${margins.right}mm`,
    paddingBottom: `${margins.bottom}mm`,
    paddingLeft: `${margins.left}mm`
  };

  return (
    <section className="tngt-print-page landscape-print-page" style={pad} data-print-page={pageIndex + 1}>
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
            <DataRows entries={entries} sttOffset={sttOffset} />
            {emptyRows(padCount, rowHeightMm)}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Xem trước / in sổ TNGT — A4 ngang, chia tờ + kéo lề như sổ mặt đường. */
export default function TngtPrintPages({
  yearMonth,
  reportMeta,
  entries,
  margins = { top: 8, right: 10, bottom: 8, left: 10 },
  onMarginsChange,
  widths: widthsProp
}) {
  const widths = widthsProp || getTngtColWidths();
  const chunks = useMemo(() => packTngtPages(entries, margins), [entries, margins]);

  let sttOffset = 0;
  return (
    <div className="tngt-print-stack tngt-print-stack--preview landscape-print-stack--preview" data-page-count={chunks.length}>
      {chunks.map((chunk, i) => {
        const offset = sttOffset;
        sttOffset += chunk.length;
        return (
          <TngtPrintPage
            key={`tngt-p${i}`}
            yearMonth={yearMonth}
            reportMeta={reportMeta}
            entries={chunk}
            sttOffset={offset}
            margins={margins}
            widths={widths}
            showGuides={i === 0}
            onMarginsChange={onMarginsChange}
            pageIndex={i}
            pageCount={chunks.length}
          />
        );
      })}
    </div>
  );
}
