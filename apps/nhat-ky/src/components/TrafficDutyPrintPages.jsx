import { useMemo } from "react";
import {
  formatMonthTitle,
  formatTrafficDutyKmLine,
  entryToTrafficDutyRow,
  computeTrafficDutyPadRows,
  packTrafficDutyPages,
  estimateTrafficDutyDataRowMm
} from "../utils/trafficDutyFormat";
import {
  TRAFFIC_DUTY_COLS,
  getTrafficDutyColWidths,
  sumTrafficDutyCols
} from "../hooks/useTrafficDutyColWidths";
import NhatKyMarginGuides from "./NhatKyMarginGuides";

function emptyRows(count, rowHeightMm) {
  if (count <= 0) return null;
  return Array.from({ length: count }, (_, i) => (
    <tr key={`empty-${i}`} className="traffic-duty-data-row traffic-duty-data-row--empty">
      {TRAFFIC_DUTY_COLS.map((col) => (
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
      <tr className="traffic-duty-header-row">
        <th rowSpan={2}>Ngày trực</th>
        <th rowSpan={2}>
          Tình hình
          <br />
          thời tiết
        </th>
        <th rowSpan={2}>Nội dung thiệt hại</th>
        <th colSpan={2} className="traffic-duty-header-group">
          Lý trình
        </th>
        <th rowSpan={2}>Phía</th>
        <th colSpan={3} className="traffic-duty-header-group">
          Kích thước
        </th>
        <th rowSpan={2}>Khối lượng</th>
        <th rowSpan={2}>Nguyên nhân</th>
        <th rowSpan={2}>Người trực</th>
        <th rowSpan={2}>
          Người nhận
          <br />
          báo cáo
        </th>
        <th rowSpan={2}>
          Ý kiến
          <br />
          chỉ đạo
        </th>
        <th rowSpan={2}>
          Thời gian
          <br />
          thông xe
        </th>
        <th rowSpan={2}>Ghi chú</th>
      </tr>
      <tr className="traffic-duty-header-sub">
        <th>Điểm đầu</th>
        <th>Điểm cuối</th>
        <th>Dài</th>
        <th>Rộng</th>
        <th>Cao</th>
      </tr>
    </>
  );
}

function DataRows({ entries, dayMetaMap, reportMeta }) {
  return entries.map((entry, idx) => {
    const r = entryToTrafficDutyRow(entry, dayMetaMap, reportMeta);
    const h = estimateTrafficDutyDataRowMm(entry, dayMetaMap, reportMeta);
    return (
      <tr
        key={`${entry.date}-${entry.kmFrom}-${idx}`}
        className="traffic-duty-data-row"
        style={{ height: `${h}mm` }}
      >
        <td>{r.dutyDate}</td>
        <td>{r.weather}</td>
        <td className="traffic-duty-col-damage">{r.damageContent}</td>
        <td>{r.kmFrom}</td>
        <td>{r.kmTo}</td>
        <td>{r.side}</td>
        <td>{r.length}</td>
        <td>{r.width}</td>
        <td>{r.height}</td>
        <td>{r.quantity}</td>
        <td>{r.cause}</td>
        <td>{r.dutyPerson}</td>
        <td>{r.reportRecipient}</td>
        <td className="traffic-duty-col-editable">
          {r.directives ? <pre className="traffic-duty-pre">{r.directives}</pre> : null}
        </td>
        <td>{r.restoredAt}</td>
        <td className="traffic-duty-col-editable">
          {r.note ? <pre className="traffic-duty-pre">{r.note}</pre> : null}
        </td>
      </tr>
    );
  });
}

function TrafficDutyPrintPage({
  yearMonth,
  reportMeta,
  entries,
  dayMetaMap,
  margins,
  widths,
  showGuides,
  onMarginsChange,
  pageIndex,
  pageCount
}) {
  const total = sumTrafficDutyCols(widths) || 1;
  const { count: padCount, rowHeightMm } = computeTrafficDutyPadRows(
    entries,
    margins,
    dayMetaMap,
    reportMeta
  );
  const pad = {
    paddingTop: `${margins.top}mm`,
    paddingRight: `${margins.right}mm`,
    paddingBottom: `${margins.bottom}mm`,
    paddingLeft: `${margins.left}mm`
  };

  return (
    <section
      className="traffic-duty-print-page landscape-print-page"
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
      <div className="traffic-duty-print-inner">
        <h1 className="traffic-duty-title">
          TỔNG HỢP KHỐI LƯỢNG THIỆT HẠI BÃO LŨ {formatMonthTitle(yearMonth)}
        </h1>
        <p className="traffic-duty-km-range">{formatTrafficDutyKmLine(reportMeta)}</p>
        <table className="traffic-duty-table traffic-duty-table--print">
          <colgroup>
            {TRAFFIC_DUTY_COLS.map((col) => (
              <col key={col.key} style={{ width: `${(widths[col.key] / total) * 100}%` }} />
            ))}
          </colgroup>
          <thead>
            <TableHead />
          </thead>
          <tbody>
            <DataRows entries={entries} dayMetaMap={dayMetaMap} reportMeta={reportMeta} />
            {emptyRows(padCount, rowHeightMm)}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Xem trước / in sổ trực ĐBGT — A4 ngang, chia tờ + kéo lề như sổ mặt đường. */
export default function TrafficDutyPrintPages({
  yearMonth,
  reportMeta,
  entries,
  dayMetaMap,
  margins = { top: 8, right: 10, bottom: 8, left: 10 },
  onMarginsChange,
  widths: widthsProp
}) {
  const widths = widthsProp || getTrafficDutyColWidths();
  const chunks = useMemo(
    () => packTrafficDutyPages(entries, margins, dayMetaMap, reportMeta),
    [entries, margins, dayMetaMap, reportMeta]
  );

  return (
    <div
      className="traffic-duty-print-stack traffic-duty-print-stack--preview landscape-print-stack--preview"
      data-page-count={chunks.length}
    >
      {chunks.map((chunk, i) => (
        <TrafficDutyPrintPage
          key={`td-p${i}`}
          yearMonth={yearMonth}
          reportMeta={reportMeta}
          entries={chunk}
          dayMetaMap={dayMetaMap}
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
