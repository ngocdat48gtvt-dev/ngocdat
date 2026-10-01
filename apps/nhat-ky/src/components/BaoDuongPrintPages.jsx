import { useMemo } from "react";
import { formatDisplayDate } from "../utils/nhatKyFormat";
import {
  entryToBaoDuongRow,
  packBaoDuongPages,
  computeBaoDuongRowLayout,
  estimateBaoDuongBlockMm,
  countBaoDuongEntryBlocks,
  groupBaoDuongEntriesByExecDay,
  BAO_DUONG_SHEET_LAYOUT
} from "../utils/baoDuongFormat";
import {
  BAO_DUONG_COLS,
  getBaoDuongColWidths,
  sumBaoDuongCols
} from "../hooks/useBaoDuongColWidths";
import { useRoadWorkspace } from "../context/RoadWorkspaceContext";
import NhatKyMarginGuides from "./NhatKyMarginGuides";

function emptyRows(count, rowHeightMm) {
  if (count <= 0) return null;
  return Array.from({ length: count }, (_, i) => (
    <tr key={`empty-${i}`} className="baoduong-data-row baoduong-data-row--empty">
      {BAO_DUONG_COLS.map((col) => (
        <td
          key={col.key}
          align="left"
          style={{
            height: `${rowHeightMm}mm`,
            minHeight: `${rowHeightMm}mm`,
            textAlign: "left",
            verticalAlign: "middle"
          }}
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

function BlockRows({ blocks, rowScale = 1 }) {
  const scale = Number(rowScale) > 0 ? Number(rowScale) : 1;
  return (blocks || []).map((block) => {
    if (block.kind === "routeHeader") {
      const h = estimateBaoDuongBlockMm(block) * scale;
      return (
        <tr
          key={block.key}
          className="baoduong-data-row baoduong-route-header-row"
          style={{ height: `${h}mm` }}
        >
          <td
            className="baoduong-route-header-cell"
            colSpan={BAO_DUONG_COLS.length}
            style={{ height: `${h}mm` }}
          >
            {block.heading}
          </td>
        </tr>
      );
    }
    const r = entryToBaoDuongRow(block.entry, Math.max(0, (block.stt || 1) - 1));
    r.stt = block.stt;
    const h = estimateBaoDuongBlockMm(block) * scale;
    const cellStyle = {
      height: `${h}mm`,
      textAlign: "left",
      verticalAlign: "top"
    };
    return (
      <tr key={block.key} className="baoduong-data-row" style={{ height: `${h}mm` }}>
        <td
          className="baoduong-col-stt"
          align="center"
          style={{ ...cellStyle, textAlign: "center", verticalAlign: "middle" }}
        >
          {r.stt}
        </td>
        <td className="baoduong-col-work" align="left" style={cellStyle}>
          {r.work}
        </td>
        <td className="baoduong-col-vitri" align="left" style={cellStyle}>
          <pre className="baoduong-pre">{r.viTri}</pre>
        </td>
        <td className="baoduong-col-measure" align="left" style={cellStyle}>
          <pre className="baoduong-pre">{r.measureSummary}</pre>
        </td>
        <td className="baoduong-col-result" align="left" style={cellStyle}>
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
  blocks,
  margins,
  widths,
  showGuides,
  onMarginsChange,
  showTitle,
  showSign,
  pageIndex,
  pageCount,
  chiefName = "",
  signRole = "Hạt trưởng",
  showFolio = false
}) {
  const total = sumBaoDuongCols(widths) || 1;
  const hasMorePages = !showSign;
  const { count: padCount, rowHeightMm, rowScale, signNameGapMm } =
    computeBaoDuongRowLayout(blocks, margins, {
      withSign: showSign,
      withTitle: showTitle,
      hasMorePages
    });
  const signPadBottomMm = BAO_DUONG_SHEET_LAYOUT.signPadAfterNameMm || 2;

  const pad = {
    paddingTop: `${margins.top}mm`,
    paddingRight: `${margins.right}mm`,
    paddingBottom: `${margins.bottom}mm`,
    paddingLeft: `${margins.left}mm`,
    ["--bd-sign-pad-bottom"]: `${signPadBottomMm}mm`
  };
  const signGapStyle = {
    ["--bd-sign-name-gap"]: `${signNameGapMm || 24.5}mm`
  };

  return (
    <section
      className={`baoduong-print-page${showSign ? " baoduong-print-page--sign" : ""}${
        showTitle ? "" : " baoduong-print-page--cont"
      }`}
      style={pad}
      data-print-page={pageIndex + 1}
    >
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
      {showFolio ? <div className="nk-print-folio" aria-hidden="true" /> : null}
      <div className="baoduong-print-inner" style={signGapStyle}>
        {showTitle ? (
          <>
            <h1 className="baoduong-title">
              GHI CHÉP KẾT QUẢ BẢO DƯỠNG THƯỜNG XUYÊN
              <br />
              THEO CHẤT LƯỢNG THỰC HIỆN
            </h1>
            <p className="baoduong-period">
              1. Thời gian thực hiện:{" "}
              <strong>{periodLabel(periodFrom, periodTo)}</strong>
            </p>
            <p className="baoduong-intro">
              Các công việc thực hiện trong thời gian trên ghi vào bảng sau:
            </p>
          </>
        ) : null}
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
            <BlockRows blocks={blocks} rowScale={rowScale} />
            {emptyRows(padCount, rowHeightMm)}
          </tbody>
        </table>
        {showSign ? (
          <div className="baoduong-sign">
            <div className="baoduong-sign-box">
              <div className="baoduong-sign-role">{signRole || "Hạt trưởng"}</div>
              {!String(chiefName || "").trim() ? (
                <div className="baoduong-sign-hint">(Ký, ghi rõ họ tên)</div>
              ) : null}
              <div className="baoduong-sign-name">
                {String(chiefName || "").trim()}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/**
 * Xem trước / in sổ BDTX — A4 dọc.
 * Khi gộp đường: tách tiêu đề nhánh «1. Tên đường đoạn Kma–Kmb» rồi công việc.
 */
export default function BaoDuongPrintPages({
  periodFrom,
  periodTo,
  entries,
  groupByDay = false,
  margins = { top: 12, right: 12, bottom: 12, left: 14 },
  onMarginsChange,
  widths: widthsProp,
  chiefName = "",
  signRole = "Hạt trưởng",
  pageStart = null
}) {
  const widths = widthsProp || getBaoDuongColWidths();
  const { catalogRoad, routesViewMode, activeRouteId, titleRouteIds } = useRoadWorkspace();
  const viewCtx = useMemo(
    () => ({
      road: catalogRoad,
      routesViewMode,
      activeRouteId,
      titleRouteIds
    }),
    [catalogRoad, routesViewMode, activeRouteId, titleRouteIds]
  );

  const dayGroups = useMemo(() => {
    if (groupByDay) {
      const groups = groupBaoDuongEntriesByExecDay(entries, periodFrom, periodTo);
      return groups.length
        ? groups
        : [{ periodFrom, periodTo, entries: [] }];
    }
    return [{ periodFrom, periodTo, entries: entries || [] }];
  }, [groupByDay, entries, periodFrom, periodTo]);

  const flatPages = useMemo(() => {
    const out = [];
    dayGroups.forEach((group) => {
      const chunks = packBaoDuongPages(group.entries, margins, viewCtx);
      chunks.forEach((chunk, chunkIdx) => {
        out.push({
          periodFrom: group.periodFrom,
          periodTo: group.periodTo,
          blocks: chunk,
          showTitle: chunkIdx === 0,
          showSign: chunkIdx === chunks.length - 1
        });
      });
    });
    return out.length
      ? out
      : [{ periodFrom, periodTo, blocks: [], showTitle: true, showSign: true }];
  }, [dayGroups, margins, periodFrom, periodTo, viewCtx]);

  const pages = flatPages.map((page, i) => (
    <BaoDuongPrintPage
      key={`bd-p${i}-${page.periodFrom}-${page.showTitle ? "t" : "c"}`}
      periodFrom={page.periodFrom}
      periodTo={page.periodTo}
      blocks={page.blocks}
      margins={margins}
      widths={widths}
      showGuides={i === 0}
      onMarginsChange={onMarginsChange}
      showTitle={page.showTitle}
      showSign={page.showSign}
      pageIndex={i}
      pageCount={flatPages.length}
      chiefName={chiefName}
      signRole={signRole}
      showFolio={pageStart != null}
    />
  ));

  return (
    <div
      className="baoduong-print-stack baoduong-print-stack--preview"
      data-page-count={flatPages.length}
      data-entry-count={flatPages.reduce((n, p) => n + countBaoDuongEntryBlocks(p.blocks), 0)}
      style={
        pageStart != null
          ? { counterReset: `nk-folio ${pageStart - 1}` }
          : undefined
      }
    >
      {pages}
    </div>
  );
}
