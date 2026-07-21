import { useMemo } from "react";
import { formatDisplayDate } from "../utils/nhatKyFormat";
import {
  entryToBaoDuongRow,
  packBaoDuongPages,
  computeBaoDuongPadRows,
  estimateBaoDuongDataRowMm,
  groupBaoDuongEntriesByExecDay
} from "../utils/baoDuongFormat";
import {
  BAO_DUONG_COLS,
  getBaoDuongColWidths,
  sumBaoDuongCols
} from "../hooks/useBaoDuongColWidths";
import NhatKyMarginGuides from "./NhatKyMarginGuides";

function emptyRows(count, rowHeightMm) {
  if (count <= 0) return null;
  return Array.from({ length: count }, (_, i) => (
    <tr key={`empty-${i}`} className="baoduong-data-row baoduong-data-row--empty">
      {BAO_DUONG_COLS.map((col) => (
        <td
          key={col.key}
          style={{ height: `${rowHeightMm}mm`, minHeight: `${rowHeightMm}mm` }}
        />
      ))}
    </tr>
  ));
}

function TableHead() {
  return (
    <>
      <tr className="baoduong-header-row">
        <th>Số thứ tự</th>
        <th>Công việc thực hiện</th>
        <th>Ghi lý trình, vị trí công việc được thực hiện</th>
        <th>Tóm tắt biện pháp thực hiện</th>
        <th>Kết quả chủ yếu</th>
      </tr>
      <tr className="baoduong-header-num">
        <th>(1)</th>
        <th>(2)</th>
        <th>(3)</th>
        <th>(4)</th>
        <th>(5)</th>
      </tr>
    </>
  );
}

function DataRows({ entries, sttOffset }) {
  return entries.map((entry, idx) => {
    const r = entryToBaoDuongRow(entry, sttOffset + idx);
    const h = estimateBaoDuongDataRowMm(entry, sttOffset + idx);
    return (
      <tr
        key={`${entry.plannedRepairDate || entry.date}-${entry.kmFrom}-${sttOffset + idx}`}
        className="baoduong-data-row"
        style={{ height: `${h}mm` }}
      >
        <td className="baoduong-col-stt" style={{ height: `${h}mm` }}>
          {r.stt}
        </td>
        <td className="baoduong-col-work" style={{ height: `${h}mm` }}>
          {r.work}
        </td>
        <td className="baoduong-col-vitri" style={{ height: `${h}mm` }}>
          <pre className="baoduong-pre">{r.viTri}</pre>
        </td>
        <td className="baoduong-col-measure" style={{ height: `${h}mm` }}>
          <pre className="baoduong-pre">{r.measureSummary}</pre>
        </td>
        <td className="baoduong-col-result" style={{ height: `${h}mm` }}>
          <pre className="baoduong-pre">{r.mainResult}</pre>
        </td>
      </tr>
    );
  });
}

function periodLabel(periodFrom, periodTo) {
  if (periodFrom && periodTo && periodFrom !== periodTo) {
    return `${formatDisplayDate(periodFrom)} → ${formatDisplayDate(periodTo)}`;
  }
  return formatDisplayDate(periodFrom || periodTo);
}

function BaoDuongPrintPage({
  periodFrom,
  periodTo,
  entries,
  sttOffset,
  margins,
  widths,
  showGuides,
  onMarginsChange,
  showSign,
  pageIndex,
  pageCount
}) {
  const total = sumBaoDuongCols(widths) || 1;
  const { count: padCount, rowHeightMm } = computeBaoDuongPadRows(entries, margins, {
    withSign: showSign
  });
  const pad = {
    paddingTop: `${margins.top}mm`,
    paddingRight: `${margins.right}mm`,
    paddingBottom: `${margins.bottom}mm`,
    paddingLeft: `${margins.left}mm`
  };

  return (
    <section className="baoduong-print-page" style={pad} data-print-page={pageIndex + 1}>
      {showGuides && onMarginsChange ? (
        <NhatKyMarginGuides
          margins={margins}
          onChange={onMarginsChange}
          pageWMm={210}
          pageHMm={297}
          minContentMm={100}
        />
      ) : null}
      {pageCount > 1 ? (
        <p className="baoduong-print-page-num no-print">
          Tờ {pageIndex + 1}/{pageCount}
        </p>
      ) : null}
      <div className="baoduong-print-inner">
        <h1 className="baoduong-title">
          GHI CHÉP KẾT QUẢ BẢO DƯỠNG THƯỜNG XUYÊN THEO CHẤT LƯỢNG THỰC HIỆN
        </h1>
        <p className="baoduong-period">
          1. Thời gian thực hiện: <strong>{periodLabel(periodFrom, periodTo)}</strong>
        </p>
        <p className="baoduong-intro">
          Các công việc thực hiện trong thời gian trên ghi vào bảng sau:
        </p>
        <table className="baoduong-table baoduong-table--print">
          <colgroup>
            {BAO_DUONG_COLS.map((col) => (
              <col
                key={col.key}
                style={{ width: `${(widths[col.key] / total) * 100}%` }}
              />
            ))}
          </colgroup>
          <thead>
            <TableHead />
          </thead>
          <tbody>
            <DataRows entries={entries} sttOffset={sttOffset} />
            {emptyRows(padCount, rowHeightMm)}
          </tbody>
        </table>
        {showSign ? (
          <div className="baoduong-sign">
            <div className="baoduong-sign-box">
              <div className="baoduong-sign-role">Hạt trưởng</div>
              <div className="baoduong-sign-hint">(Ký, ghi rõ họ tên)</div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/**
 * Xem trước / in sổ BDTX — A4 dọc.
 * - 1 ngày: gói entries thành nhiều tờ nếu vượt trang.
 * - Khoảng A→B (groupByDay): mỗi ngày thực hiện = nhóm tờ riêng (không gộp 1 tờ).
 */
export default function BaoDuongPrintPages({
  periodFrom,
  periodTo,
  entries,
  groupByDay = false,
  margins = { top: 12, right: 12, bottom: 12, left: 14 },
  onMarginsChange,
  widths: widthsProp
}) {
  const widths = widthsProp || getBaoDuongColWidths();

  const dayGroups = useMemo(() => {
    if (groupByDay) {
      const groups = groupBaoDuongEntriesByExecDay(entries);
      return groups.length
        ? groups
        : [{ periodFrom, periodTo, entries: [] }];
    }
    return [{ periodFrom, periodTo, entries: entries || [] }];
  }, [groupByDay, entries, periodFrom, periodTo]);

  const flatPages = useMemo(() => {
    const out = [];
    dayGroups.forEach((group) => {
      const chunks = packBaoDuongPages(group.entries, margins);
      chunks.forEach((chunk, chunkIdx) => {
        out.push({
          periodFrom: group.periodFrom,
          periodTo: group.periodTo,
          entries: chunk,
          showSign: chunkIdx === chunks.length - 1
        });
      });
    });
    return out.length ? out : [{ periodFrom, periodTo, entries: [], showSign: true }];
  }, [dayGroups, margins, periodFrom, periodTo]);

  let sttOffset = 0;
  let prevDay = "";
  const pages = flatPages.map((page, i) => {
    const dayKey = page.periodFrom || "";
    if (dayKey !== prevDay) {
      sttOffset = 0;
      prevDay = dayKey;
    }
    const offset = sttOffset;
    sttOffset += page.entries.length;
    return (
      <BaoDuongPrintPage
        key={`bd-p${i}-${page.periodFrom}`}
        periodFrom={page.periodFrom}
        periodTo={page.periodTo}
        entries={page.entries}
        sttOffset={offset}
        margins={margins}
        widths={widths}
        showGuides={i === 0}
        onMarginsChange={onMarginsChange}
        showSign={page.showSign}
        pageIndex={i}
        pageCount={flatPages.length}
      />
    );
  });

  return (
    <div
      className="baoduong-print-stack baoduong-print-stack--preview"
      data-page-count={flatPages.length}
    >
      {pages}
    </div>
  );
}
