import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  formatMonthTitle,
  formatTrafficDutyKmLine,
  entryToTrafficDutyRow,
  packTrafficDutyPages,
  estimateTrafficDutyDataRowMm,
  TRAFFIC_DUTY_SHEET_LAYOUT
} from "../utils/trafficDutyFormat";
import {
  TRAFFIC_DUTY_COLS,
  getTrafficDutyColWidths,
  sumTrafficDutyCols
} from "../hooks/useTrafficDutyColWidths";
import {
  useOrderedEntriesByRoute,
  useRouteDisplayBlocks
} from "../hooks/useRouteDisplayBlocks";
import { blocksForPackedEntries } from "../utils/roadsCatalog";
import NhatKyMarginGuides from "./NhatKyMarginGuides";
import RouteHeaderRow from "./RouteHeaderRow";

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

function BlockRows({ blocks, dayMetaMap, reportMeta }) {
  return (blocks || []).map((block) => {
    if (block.kind === "routeHeader") {
      return (
        <RouteHeaderRow
          key={block.key}
          heading={block.heading}
          colSpan={TRAFFIC_DUTY_COLS.length}
        />
      );
    }
    const entry = block.entry;
    const r = entryToTrafficDutyRow(entry, dayMetaMap, reportMeta);
    const h = estimateTrafficDutyDataRowMm(entry, dayMetaMap, reportMeta);
    return (
      <tr key={block.key} className="traffic-duty-data-row" style={{ height: `${h}mm` }}>
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
  blocks,
  entries,
  dayMetaMap,
  margins,
  widths,
  showGuides,
  onMarginsChange,
  onRowOverflow,
  pageIndex,
  pageCount
}) {
  const pageRef = useRef(null);
  const total = sumTrafficDutyCols(widths) || 1;
  const pad = {
    paddingTop: `${margins.top}mm`,
    paddingRight: `${margins.right}mm`,
    paddingBottom: `${margins.bottom}mm`,
    paddingLeft: `${margins.left}mm`
  };

  useLayoutEffect(() => {
    const page = pageRef.current;
    const dataRows = page?.querySelectorAll(
      "tbody tr.traffic-duty-data-row:not(.traffic-duty-data-row--empty)"
    );
    const lastRow = dataRows?.[dataRows.length - 1];
    const lastEntry = entries?.[entries.length - 1];
    if (!page || !lastRow || !lastEntry) return;

    const pageRect = page.getBoundingClientRect();
    const pxPerMm = pageRect.height / TRAFFIC_DUTY_SHEET_LAYOUT.sheetHeightMm;
    const bottomLimit =
      pageRect.bottom -
      ((Number(margins.bottom) || 0) + TRAFFIC_DUTY_SHEET_LAYOUT.safetyMm) * pxPerMm;

    if (lastRow.getBoundingClientRect().bottom > bottomLimit + 0.5) {
      onRowOverflow?.(pageIndex, lastEntry);
    }
  }, [entries, margins.bottom, onRowOverflow, pageIndex, widths, dayMetaMap, reportMeta]);

  return (
    <section
      ref={pageRef}
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
            <BlockRows blocks={blocks} dayMetaMap={dayMetaMap} reportMeta={reportMeta} />
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Xem trước / in sổ trực ĐBGT — A4 ngang; gộp đường thì tách tiêu đề nhánh. */
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
  const allBlocks = useRouteDisplayBlocks(entries, "Thiệt hại khác");
  const ordered = useOrderedEntriesByRoute(entries, "Thiệt hại khác");
  const estimatedChunks = useMemo(
    () => packTrafficDutyPages(ordered, margins, dayMetaMap, reportMeta),
    [ordered, margins, dayMetaMap, reportMeta]
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
      className="traffic-duty-print-stack traffic-duty-print-stack--preview landscape-print-stack--preview"
      data-page-count={chunks.length}
    >
      {chunks.map((chunk, i) => (
        <TrafficDutyPrintPage
          key={`td-p${i}`}
          yearMonth={yearMonth}
          reportMeta={reportMeta}
          blocks={blocksForPackedEntries(allBlocks, chunk)}
          entries={chunk}
          dayMetaMap={dayMetaMap}
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
