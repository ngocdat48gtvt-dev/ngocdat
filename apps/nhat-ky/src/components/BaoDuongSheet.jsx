import { useMemo } from "react";
import { formatDisplayDate } from "../utils/nhatKyFormat";
import {
  entryToBaoDuongRow,
  buildBaoDuongDisplayBlocks
} from "../utils/baoDuongFormat";
import { BAO_DUONG_COLS, useBaoDuongColWidths } from "../hooks/useBaoDuongColWidths";
import { useRoadWorkspace } from "../context/RoadWorkspaceContext";

/** Hàng trống trên màn hình — thấp hơn tờ in, chỉ để nhìn khung bảng. */
const SCREEN_EMPTY_ROWS = 2;
const SCREEN_EMPTY_ROW_MM = 6;

function ResizableTh({ colKey, children, onResizeStart }) {
  return (
    <th>
      {children}
      <div
        className="col-resize-handle"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onResizeStart(colKey, e.clientX);
        }}
        title="Kéo để đổi độ rộng cột"
      />
    </th>
  );
}

function emptyRows(count, rowHeightMm) {
  return Array.from({ length: count }, (_, i) => (
    <tr key={`empty-${i}`} className="baoduong-data-row baoduong-data-row--empty">
      {BAO_DUONG_COLS.map((col) => (
        <td
          key={col.key}
          style={
            rowHeightMm
              ? { height: `${rowHeightMm}mm`, minHeight: `${rowHeightMm}mm` }
              : undefined
          }
        />
      ))}
    </tr>
  ));
}

/** Màn hình: không ép height theo A4 — theo nội dung, tránh hàng cao thừa. */
function BlockRows({ blocks }) {
  return blocks.map((block) => {
    if (block.kind === "routeHeader") {
      return (
        <tr key={block.key} className="baoduong-data-row baoduong-route-header-row">
          <td className="baoduong-route-header-cell" colSpan={BAO_DUONG_COLS.length}>
            {block.heading}
          </td>
        </tr>
      );
    }
    const r = entryToBaoDuongRow(block.entry, Math.max(0, (block.stt || 1) - 1));
    r.stt = block.stt;
    return (
      <tr key={block.key} className="baoduong-data-row baoduong-data-row--screen">
        <td className="baoduong-col-stt" align="center" style={{ textAlign: "center" }}>
          {r.stt}
        </td>
        <td className="baoduong-col-work" align="left" style={{ textAlign: "left" }}>
          {r.work}
        </td>
        <td className="baoduong-col-vitri" align="left" style={{ textAlign: "left" }}>
          <pre className="baoduong-pre">{r.viTri}</pre>
        </td>
        <td className="baoduong-col-measure" align="left" style={{ textAlign: "left" }}>
          <pre className="baoduong-pre">{r.measureSummary}</pre>
        </td>
        <td className="baoduong-col-result" align="left" style={{ textAlign: "left" }}>
          <pre className="baoduong-pre">{r.mainResult}</pre>
        </td>
      </tr>
    );
  });
}

export default function BaoDuongSheet({
  execDate,
  entries,
  chiefName = "",
  signRole = "Hạt trưởng"
}) {
  const { widths, startColumnResize } = useBaoDuongColWidths();
  const { catalogRoad, routesViewMode, activeRouteId, titleRouteIds } = useRoadWorkspace();

  const blocks = useMemo(
    () =>
      buildBaoDuongDisplayBlocks(entries || [], catalogRoad, {
        routesViewMode,
        activeRouteId,
        titleRouteIds
      }),
    [entries, catalogRoad, routesViewMode, activeRouteId, titleRouteIds]
  );

  // Giữ khoảng ký gần như tờ in (không co theo fill A4 trên màn hình).
  const signNameGapMm = 24.5;

  return (
    <div className="baoduong-sheet-wrap">
      <div
        className="baoduong-sheet baoduong-sheet--a4-portrait baoduong-sheet--screen"
        style={{ ["--bd-sign-name-gap"]: `${signNameGapMm}mm` }}
      >
        <h1 className="baoduong-title">
          GHI CHÉP KẾT QUẢ BẢO DƯỠNG THƯỜNG XUYÊN
          <br />
          THEO CHẤT LƯỢNG THỰC HIỆN
        </h1>

        <p className="baoduong-period">
          1. Thời gian thực hiện: <strong>{formatDisplayDate(execDate)}</strong>
        </p>
        <p className="baoduong-intro">
          Các công việc thực hiện trong thời gian trên ghi vào bảng sau:
        </p>

        <table className="baoduong-table">
          <colgroup>
            {BAO_DUONG_COLS.map((col) => (
              <col key={col.key} style={{ width: `${widths[col.key]}px` }} />
            ))}
          </colgroup>
          <thead>
            <tr className="baoduong-header-row">
              <ResizableTh colKey="bd1" onResizeStart={startColumnResize}>
                Số thứ tự
              </ResizableTh>
              <ResizableTh colKey="bd2" onResizeStart={startColumnResize}>
                Công việc thực hiện
              </ResizableTh>
              <ResizableTh colKey="bd3" onResizeStart={startColumnResize}>
                Ghi lý trình, vị trí công việc được thực hiện
              </ResizableTh>
              <ResizableTh colKey="bd4" onResizeStart={startColumnResize}>
                Tóm tắt biện pháp thực hiện
              </ResizableTh>
              <ResizableTh colKey="bd5" onResizeStart={startColumnResize}>
                Kết quả chủ yếu
              </ResizableTh>
            </tr>
            <tr className="baoduong-header-num">
              <th>(1)</th>
              <th>(2)</th>
              <th>(3)</th>
              <th>(4)</th>
              <th>(5)</th>
            </tr>
          </thead>
          <tbody>
            <BlockRows blocks={blocks} />
            {emptyRows(SCREEN_EMPTY_ROWS, SCREEN_EMPTY_ROW_MM)}
          </tbody>
        </table>

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
      </div>
    </div>
  );
}
