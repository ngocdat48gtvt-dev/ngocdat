import { useCallback, useEffect, useRef, useState } from "react";
import GptcAutoTextarea from "./GptcAutoTextarea";
import {
  SUMMARY_FIELD_KEYS,
  isPermitRowFilled,
  parseExcelGrid,
  resolvePasteOrigin
} from "../utils/gptcSummaryGrid";

function CellInput({ value, onChange, editable, onFocusCell, onPasteCell }) {
  if (!editable) return <span className="gptc-cell-text">{value || ""}</span>;
  return (
    <input
      type="text"
      className="gptc-cell-input"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onFocus={onFocusCell}
      onPaste={onPasteCell}
    />
  );
}

function SummaryCell({ editable, value, onChange, onFocusCell, onPasteCell, multiline }) {
  if (multiline) {
    return (
      <GptcAutoTextarea
        readOnly={!editable}
        value={value}
        onChange={onChange}
        onFocus={onFocusCell}
        onPaste={onPasteCell}
      />
    );
  }
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
  onChangePermit,
  onColWidthsChange,
  onPasteGrid,
  /** Chế độ in: dùng pageRows (đã pad), chiều cao dòng cố định */
  printMode = false,
  pageRows = null,
  rowHMm = 14
}) {
  const focusRef = useRef({ row: 0, col: 1 });
  const resizeRef = useRef(null);
  const [resizing, setResizing] = useState(false);

  const titleRoad = ledger.tenTuyen || "…………………………";
  const year = ledger.year || "…………";
  const widths = colWidths?.length === 9 ? colWidths : ledger.summaryColWidths;

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

  return (
    <div
      className={`gptc-sheet gptc-sheet--landscape gptc-sheet--a4-landscape gptc-sheet--summary gptc-print-section${printMode ? " gptc-sheet--print-embed" : ""}`}
      data-print-section="gptc-summary"
      style={printMode ? { "--gptc-summary-row-h": `${rowHMm}mm` } : undefined}
    >
      <h2 className="gptc-sheet-title gptc-sheet-title--bm01">
        BẢNG TỔNG HỢP CÔNG TRÌNH ĐƯỢC CẤP PHÉP TUYẾN {titleRoad} NĂM {year}
      </h2>

      {editable && (
        <p className="gptc-paste-hint no-print">
          Click ô rồi gõ hoặc Ctrl+V từ Excel (dán đúng cột). Double-click dòng để mở sổ chi tiết.
        </p>
      )}

      <div className={`gptc-table-scroll${printMode ? " gptc-table-scroll--fill" : ""}`}>
        <table
          className={`gptc-official-table gptc-summary-table${printMode ? " gptc-summary-table--print" : ""}`}
        >
          <colgroup>
            {widths.map((w, i) => (
              <col key={i} style={{ width: `${w}px` }} />
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
            {(printMode ? pageRows || [] : ledger.permits || []).map((p, rowIndex) => {
              if (!p) {
                return (
                  <tr key={`pad-${rowIndex}`} className="gptc-summary-row gptc-summary-row--pad">
                    {Array.from({ length: 9 }, (_, i) => (
                      <td key={i} className="gptc-data-cell">
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
                const multiline = colIndex === 1 || colIndex === 4 || colIndex === 5 || colIndex === 8;
                return (
                  <td key={colIndex} className="gptc-data-cell">
                    <SummaryCell
                      editable={editable && !printMode}
                      multiline={multiline}
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
                  className={`gptc-summary-row${active ? " gptc-summary-row--active" : ""}${filled ? "" : " gptc-summary-row--empty"}`}
                  onMouseDown={(e) => {
                    if (printMode || e.target.closest("input, textarea")) return;
                    onRowSelect?.(p.id);
                  }}
                  onDoubleClick={(e) => {
                    if (printMode || e.target.closest("input, textarea")) return;
                    onOpenDetail?.(p.id);
                  }}
                  title={
                    editable && !printMode
                      ? "Double-click dòng (không bấm ô) để mở BM02"
                      : undefined
                  }
                >
                  <td className="gptc-data-cell gptc-td-center gptc-col-stt">
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
}
