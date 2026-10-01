import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import GptcAutoTextarea, { syncGptcAutogrowRows } from "./GptcAutoTextarea";
import {
  SUMMARY_FIELD_KEYS,
  isPermitRowFilled,
  parseExcelGrid,
  resolvePasteOrigin
} from "../utils/gptcSummaryGrid";

function CellInput({ value, onChange, editable, onFocusCell, onPasteCell }) {
  if (!editable) return <span className="gptc-cell-text">{value || ""}</span>;
  return (
    <GptcAutoTextarea
      value={value ?? ""}
      onChange={onChange}
      onFocus={onFocusCell}
      onPaste={onPasteCell}
      className="gptc-cell-input--summary"
    />
  );
}

function SummaryCell({ editable, value, onChange, onFocusCell, onPasteCell }) {
  return (
    <CellInput
      editable={editable}
      value={value}
      onChange={onChange}
      onFocusCell={onFocusCell}
      onPasteCell={onPasteCell}
    />
  );
}

export default function GptcSummarySheet({
  ledger,
  editable = false,
  selectedId,
  colWidths = [],
  onRowSelect,
  onOpenDetail,
  onDeletePermit,
  onChangePermit,
  onColWidthsChange,
  onPasteGrid,
  /** Chế độ in: dùng pageRows (đã pad), chiều cao dòng cố định */
  printMode = false,
  pageRows = null,
  rowHMm = 14,
  rowHeightsMm = null
}) {
  const focusRef = useRef({ row: 0, col: 1 });
  const resizeRef = useRef(null);
  const sheetRef = useRef(null);
  const tableRef = useRef(null);
  const [resizing, setResizing] = useState(false);
  const [railMetrics, setRailMetrics] = useState({ padTop: 0, rowHs: [] });

  const titleRoad = ledger.tenTuyen || "…………………………";
  const year = ledger.year || "…………";
  const widths = colWidths?.length === 9 ? colWidths : ledger.summaryColWidths;
  const widthSum = widths.reduce((a, b) => a + (Number(b) || 0), 0) || 1;
  const rows = printMode ? pageRows || [] : ledger.permits || [];

  const setFocus = useCallback((row, col) => {
    focusRef.current = { row, col };
  }, []);

  const handleCellPaste = useCallback(
    (e, rowIndex, colIndex) => {
      if (!editable || !onPasteGrid) return;
      const text = e.clipboardData?.getData("text/plain");
      if (!text) return;
      const grid = parseExcelGrid(text);
      const multiCell = text.includes("\t") || (text.includes("\n") && grid.length > 1);
      if (!multiCell) return;
      e.preventDefault();
      const origin = resolvePasteOrigin(rowIndex, colIndex, grid);
      onPasteGrid(origin.startRow, origin.startCol, origin.grid);
    },
    [editable, onPasteGrid]
  );

  const startResize = useCallback(
    (colIndex, e) => {
      if (!editable || !onColWidthsChange) return;
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startW = widths[colIndex];
      resizeRef.current = { colIndex, startX, startW };
      setResizing(true);

      function onMove(ev) {
        if (!resizeRef.current) return;
        const delta = ev.clientX - resizeRef.current.startX;
        const next = [...widths];
        next[resizeRef.current.colIndex] = Math.max(36, resizeRef.current.startW + delta);
        onColWidthsChange(next);
      }

      function onUp() {
        resizeRef.current = null;
        setResizing(false);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      }

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [editable, onColWidthsChange, widths]
  );

  useEffect(() => {
    if (!resizing) return;
    document.body.classList.add("gptc-col-resizing");
    return () => document.body.classList.remove("gptc-col-resizing");
  }, [resizing]);

  const measureRail = useCallback(() => {
    if (printMode) return;
    const sheet = sheetRef.current;
    const table = tableRef.current;
    if (!sheet || !table?.tBodies?.[0]) return;
    const sheetTop = sheet.getBoundingClientRect().top;
    const bodyRows = Array.from(table.tBodies[0].rows);
    const first = bodyRows[0];
    const padTop = first ? first.getBoundingClientRect().top - sheetTop : 0;
    const rowHs = bodyRows.map((r) => r.getBoundingClientRect().height);
    setRailMetrics((prev) => {
      const same =
        Math.abs(prev.padTop - padTop) < 0.5 &&
        prev.rowHs.length === rowHs.length &&
        prev.rowHs.every((h, i) => Math.abs(h - rowHs[i]) < 0.5);
      return same ? prev : { padTop, rowHs };
    });
  }, [printMode]);

  useLayoutEffect(() => {
    if (!printMode && tableRef.current) {
      syncGptcAutogrowRows(tableRef.current);
    }
    measureRail();
  }, [measureRail, printMode, rows, widths, editable, selectedId, ledger?.tenTuyen, ledger?.year]);

  useEffect(() => {
    if (printMode) return undefined;
    const table = tableRef.current;
    if (!table || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(() => measureRail());
    ro.observe(table);
    Array.from(table.tBodies?.[0]?.rows || []).forEach((r) => ro.observe(r));
    window.addEventListener("resize", measureRail);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measureRail);
    };
  }, [printMode, measureRail, rows.length]);

  const sheet = (
    <div
      ref={sheetRef}
      className={`gptc-sheet gptc-sheet--landscape gptc-sheet--a4-landscape gptc-sheet--summary gptc-print-section${
        printMode ? " gptc-sheet--print-embed" : ""
      }`}
      data-print-section="gptc-summary"
      style={printMode ? { "--gptc-summary-row-h": `${rowHMm}mm` } : undefined}
    >
      <h2 className="gptc-sheet-title gptc-sheet-title--bm01">
        BẢNG TỔNG HỢP CÔNG TRÌNH ĐƯỢC CẤP PHÉP TUYẾN {titleRoad} NĂM {year}
      </h2>

      <div className={`gptc-table-scroll${printMode ? " gptc-table-scroll--fill" : ""}`}>
        <table
          ref={tableRef}
          className={`gptc-official-table gptc-summary-table${
            printMode ? " gptc-summary-table--print" : " gptc-summary-table--edit"
          }`}
        >
          <colgroup>
            {widths.map((w, i) => (
              <col
                key={i}
                style={
                  printMode
                    ? { width: `${((Number(w) || 0) / widthSum) * 100}%` }
                    : { width: `${w}px` }
                }
              />
            ))}
          </colgroup>
          <thead>
            <tr className="gptc-head-labels">
              <th rowSpan={2} className="gptc-th-resizable">
                STT
                {editable && <span className="gptc-col-resizer" onMouseDown={(e) => startResize(0, e)} />}
              </th>
              <th rowSpan={2} className="gptc-th-resizable">
                Giấy phép thi công
                {editable && <span className="gptc-col-resizer" onMouseDown={(e) => startResize(1, e)} />}
              </th>
              <th rowSpan={2} className="gptc-th-resizable">
                Ngày nhận giấy phép
                {editable && <span className="gptc-col-resizer" onMouseDown={(e) => startResize(2, e)} />}
              </th>
              <th rowSpan={2} className="gptc-th-resizable">
                Ngày bàn giao mặt bằng thi công
                {editable && <span className="gptc-col-resizer" onMouseDown={(e) => startResize(3, e)} />}
              </th>
              <th rowSpan={2} className="gptc-th-resizable">
                Tên cơ quan, đơn vị được chấp thuận xây dựng
                {editable && <span className="gptc-col-resizer" onMouseDown={(e) => startResize(4, e)} />}
              </th>
              <th rowSpan={2} className="gptc-th-resizable">
                Nội dung cấp phép thi công
                {editable && <span className="gptc-col-resizer" onMouseDown={(e) => startResize(5, e)} />}
              </th>
              <th colSpan={2} className="gptc-th-resizable gptc-col-duration-head">
                Thời hạn thi công
              </th>
              <th rowSpan={2} className="gptc-th-resizable">
                Ghi chú
                {editable && <span className="gptc-col-resizer" onMouseDown={(e) => startResize(8, e)} />}
              </th>
            </tr>
            <tr className="gptc-head-sub">
              <th className="gptc-th-resizable">
                Ngày bắt đầu
                {editable && <span className="gptc-col-resizer" onMouseDown={(e) => startResize(6, e)} />}
              </th>
              <th className="gptc-th-resizable">
                Ngày kết thúc
                {editable && <span className="gptc-col-resizer" onMouseDown={(e) => startResize(7, e)} />}
              </th>
            </tr>
            <tr className="gptc-head-nums">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n, i) => (
                <th key={n} className="gptc-th-resizable">
                  ({n})
                  {editable && <span className="gptc-col-resizer" onMouseDown={(e) => startResize(i, e)} />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p, rowIndex) => {
              const hMm =
                printMode && Array.isArray(rowHeightsMm) && rowHeightsMm[rowIndex] != null
                  ? rowHeightsMm[rowIndex]
                  : printMode
                    ? rowHMm
                    : null;
              const rowStyle =
                hMm != null
                  ? { height: `${hMm}mm`, maxHeight: `${hMm}mm` }
                  : undefined;
              const cellStyle =
                hMm != null
                  ? {
                      height: `${hMm}mm`,
                      minHeight: `${hMm}mm`,
                      maxHeight: `${hMm}mm`
                    }
                  : undefined;

              if (!p) {
                return (
                  <tr
                    key={`pad-${rowIndex}`}
                    className="gptc-summary-row gptc-summary-row--pad"
                    style={rowStyle}
                  >
                    {Array.from({ length: 9 }, (_, i) => (
                      <td key={i} className="gptc-data-cell" style={cellStyle}>
                        <span className="gptc-cell-text">{"\u00A0"}</span>
                      </td>
                    ))}
                  </tr>
                );
              }

              const active = selectedId === p.id;
              const filled = isPermitRowFilled(p);
              const fields = SUMMARY_FIELD_KEYS;

              function cell(colIndex) {
                const field = fields[colIndex];
                return (
                  <td key={colIndex} className="gptc-data-cell" style={cellStyle}>
                    <SummaryCell
                      editable={editable && !printMode}
                      value={p[field]}
                      onChange={(v) => onChangePermit?.(p.id, field, v)}
                      onFocusCell={() => setFocus(rowIndex, colIndex)}
                      onPasteCell={(e) => handleCellPaste(e, rowIndex, colIndex)}
                    />
                  </td>
                );
              }

              return (
                <tr
                  key={p.id}
                  className={`gptc-summary-row${active ? " gptc-summary-row--active" : ""}${
                    filled ? "" : " gptc-summary-row--empty"
                  }`}
                  style={rowStyle}
                  onMouseDown={(e) => {
                    if (printMode || e.target.closest("input, textarea, button")) return;
                    onRowSelect?.(p.id);
                  }}
                >
                  <td className="gptc-data-cell gptc-td-center gptc-col-stt" style={cellStyle}>
                    {filled ? p.stt : "\u00A0"}
                  </td>
                  {cell(1)}
                  {cell(2)}
                  {cell(3)}
                  {cell(4)}
                  {cell(5)}
                  {cell(6)}
                  {cell(7)}
                  {cell(8)}
                </tr>
              );
            })}
            {!printMode && !ledger.permits?.length && (
              <tr>
                <td colSpan={9} className="gptc-empty-row">
                  Chưa có công trình. Bấm &quot;Thêm công trình&quot; hoặc dán từ Excel (Ctrl+V).
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (printMode) return sheet;

  return (
    <div className="gptc-summary-layout">
      {sheet}
      <aside className="gptc-summary-rail no-print" aria-label="Chi tiết / xóa công trình">
        <div className="gptc-summary-rail-pad" style={{ height: `${railMetrics.padTop}px` }} />
        {rows.map((p, i) => {
          const h = railMetrics.rowHs[i] || 36;
          if (!p || !isPermitRowFilled(p)) {
            return <div key={p?.id || `empty-rail-${i}`} className="gptc-summary-rail-row" style={{ height: h }} />;
          }
          return (
            <div key={p.id} className="gptc-summary-rail-row" style={{ height: h }}>
              <div className="gptc-summary-rail-actions">
                <button
                  type="button"
                  className="gptc-open-detail-btn"
                  title="Mở sổ theo dõi chi tiết (BM02)"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRowSelect?.(p.id);
                    onOpenDetail?.(p.id);
                  }}
                >
                  Xem chi tiết
                </button>
                {editable && onDeletePermit ? (
                  <button
                    type="button"
                    className="gptc-delete-permit-btn"
                    title="Xóa công trình (BM01, BM02 và nhật ký liên quan)"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRowSelect?.(p.id);
                      onDeletePermit(p.id);
                    }}
                  >
                    Xóa
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </aside>
    </div>
  );
}
