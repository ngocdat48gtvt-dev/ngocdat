import {
  entryToHanhLangRow,
  formatHanhLangKmLine,
  formatHanhLangMonthTitle,
  computeHanhLangPadRows
} from "../utils/hanhLangFormat";
import { HANH_LANG_COLS, useHanhLangColWidths } from "../hooks/useHanhLangColWidths";
import HanhLangTableHead from "./HanhLangTableHead";

function emptyRows(count, rowHeightMm) {
  return Array.from({ length: count }, (_, i) => (
    <tr key={`empty-${i}`} className="hanh-lang-data-row hanh-lang-data-row--empty">
      {HANH_LANG_COLS.map((col) => (
        <td key={col.key} style={{ height: `${rowHeightMm}mm` }} />
      ))}
    </tr>
  ));
}

/** Tổng hợp vi phạm hành lang tháng — 10 cột Phụ lục 05 QL37. */
export default function HanhLangSheet({ yearMonth, reportMeta, entries }) {
  const { widths, startColumnResize } = useHanhLangColWidths();
  const kmLine = formatHanhLangKmLine(reportMeta);
  const monthLabel = formatHanhLangMonthTitle(yearMonth);
  const { count: padCount, rowHeightMm } = computeHanhLangPadRows(entries);

  const rows = entries.map((entry, idx) => {
    const r = entryToHanhLangRow(entry, idx);
    return (
      <tr key={`${entry.date}-${entry.kmFrom}-${idx}`} className="hanh-lang-data-row">
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

  return (
    <div className="hanh-lang-sheet-wrap">
      <div className="hanh-lang-sheet hanh-lang-sheet--a4-landscape">
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

        <div className="hanh-lang-table-area">
          <table className="hanh-lang-table hanh-lang-table--fill">
            <colgroup>
              {HANH_LANG_COLS.map((col) => (
                <col key={col.key} style={{ width: `${widths[col.key]}px` }} />
              ))}
            </colgroup>
            <thead>
              <HanhLangTableHead resizable onResizeStart={startColumnResize} />
            </thead>
            <tbody>
              {rows}
              {emptyRows(padCount, rowHeightMm)}
              <tr className="hanh-lang-footer-row">
                <td colSpan={2} className="hanh-lang-footer-label">
                  TỔNG CỘNG
                </td>
                <td colSpan={8} />
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
