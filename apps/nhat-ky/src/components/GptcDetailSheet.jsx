import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatDisplayDate } from "../utils/nhatKyFormat";
import { displayToIso, isoToDisplay } from "../utils/dateLocale";
import { normalizeDetailColWidths } from "../utils/gptcSummaryGrid";
import {
  GPTC_DETAIL_LAYOUT,
  estimateGptcDetailRowMm,
  packGptcDetailPages
} from "../utils/gptcDetailFormat";
import GptcAutoTextarea from "./GptcAutoTextarea";
import ViDateInput from "./ViDateInput";

function formatEntryDate(iso) {
  if (!iso) return "";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(iso)) return iso;
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(iso)) {
    const parsed = displayToIso(iso);
    return parsed ? isoToDisplay(parsed) : iso;
  }
  return formatDisplayDate(iso);
}

/** Giá trị ô ngày BM02 → ISO cho ViDateInput. */
function ngayToIso(ngay) {
  const raw = String(ngay || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return displayToIso(raw) || "";
}

const COL_LABELS = [
  "Ngày/ tháng/ năm",
  "Diễn biến trong quá trình thi công",
  "Xác nhận, ý kiến chỉ đạo của hạt trưởng",
  "Ý kiến chỉ đạo của tuần kiểm"
];

const COL_CLASSES = [
  "gptc-detail-col-date",
  "gptc-detail-col-progress",
  "gptc-detail-col-hat",
  "gptc-detail-col-tuan"
];

const FIELDS = ["ngay", "dienBien", "yKienHatTruong", "yKienTuanKiem"];

function DetailTableHead({ editable, widths, onResizeStart }) {
  return (
    <>
      <colgroup>
        {widths.map((w, i) => (
          <col key={i} style={{ width: `${w}px` }} />
        ))}
      </colgroup>
      <thead>
        <tr className="gptc-head-labels">
          {COL_LABELS.map((label, i) => (
            <th key={label} className={`gptc-th-resizable ${COL_CLASSES[i]}`}>
              {label}
              {editable && onResizeStart ? (
                <span className="gptc-col-resizer" onMouseDown={(e) => onResizeStart(i, e)} />
              ) : null}
            </th>
          ))}
        </tr>
        <tr className="gptc-head-nums">
          {[1, 2, 3, 4].map((n, i) => (
            <th key={n} className={`gptc-th-resizable ${COL_CLASSES[i]}`}>
              ({n})
              {editable && onResizeStart ? (
                <span className="gptc-col-resizer" onMouseDown={(e) => onResizeStart(i, e)} />
              ) : null}
            </th>
          ))}
        </tr>
      </thead>
    </>
  );
}

function CellInput({ value, editable, placeholder, onChange, autoGrow, dateField }) {
  if (!editable) {
    return <span className="gptc-cell-text">{value || ""}</span>;
  }
  if (dateField) {
    return (
      <ViDateInput
        value={ngayToIso(value)}
        onChange={(iso) => onChange(iso ? isoToDisplay(iso) : "")}
        placeholder=""
        hideCalendarButton
        className="gptc-cell-input gptc-cell-input--date"
        aria-label="Chọn ngày tháng năm"
      />
    );
  }
  if (autoGrow) {
    return (
      <GptcAutoTextarea
        value={value || ""}
        onChange={onChange}
        placeholder={placeholder}
        className="gptc-cell-input--detail-auto"
      />
    );
  }
  return (
    <textarea
      className="gptc-cell-input gptc-cell-input--area gptc-cell-input--excel"
      value={value || ""}
      placeholder={placeholder || ""}
      rows={1}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    />
  );
}

function DetailPage({
  permit,
  pageRows,
  pageIndex,
  pageCount,
  rowOffset,
  editable,
  widths,
  rowHMm,
  rowHeightsMm,
  selectedEntryId,
  onRowSelect,
  onChangeSlot,
  onResizeStart,
  showProjectEdit
}) {
  const autoGrow = Boolean(editable);

  return (
    <div
      className={`gptc-sheet gptc-sheet--landscape gptc-sheet--detail gptc-print-section${
        autoGrow ? " gptc-sheet--detail-auto" : ""
      }`}
      data-print-section="gptc-detail"
      data-print-permit={permit.id}
      data-detail-page={pageIndex + 1}
      style={{ "--gptc-row-h": `${rowHMm || GPTC_DETAIL_LAYOUT.rowMm}mm` }}
    >
      <h2 className="gptc-sheet-title gptc-sheet-title--bm02">
        BIỂU THEO DÕI DIỄN BIẾN TRONG QUÁ TRÌNH THI CÔNG CÔNG TRÌNH CẤP PHÉP
      </h2>

      <div className="gptc-detail-project-line">
        {editable && showProjectEdit ? (
          <GptcAutoTextarea
            value={permit.tenCongTrinh || ""}
            placeholder="Tên công trình (đồng bộ cột 2 biểu tổng hợp BM01)"
            onChange={(v) => onChangeSlot?.("__permit__", "tenCongTrinh", v)}
            className="gptc-project-name-input gptc-project-name-input--wrap"
          />
        ) : (
          <span className="gptc-detail-project-name">
            {permit.tenCongTrinh || "…………………………………………"}
          </span>
        )}
      </div>

      {pageCount > 1 ? (
        <p className="gptc-detail-page-label no-print">
          Trang {pageIndex + 1}/{pageCount}
        </p>
      ) : null}

      <div className="gptc-table-scroll gptc-table-scroll--fill">
        <table
          className={`gptc-official-table gptc-detail-table${
            autoGrow ? " gptc-detail-table--auto" : " gptc-detail-table--excel"
          }`}
        >
          <DetailTableHead
            editable={editable && pageIndex === 0}
            widths={widths}
            onResizeStart={onResizeStart}
          />
          <tbody>
            {pageRows.map((row, i) => {
              const slotIndex = rowOffset + i;
              const active = row && selectedEntryId === row.id;
              const hMm = autoGrow
                ? null
                : Array.isArray(rowHeightsMm) && rowHeightsMm[i] != null
                  ? rowHeightsMm[i]
                  : row
                    ? estimateGptcDetailRowMm(row)
                    : rowHMm || GPTC_DETAIL_LAYOUT.rowMm;
              return (
                <tr
                  key={row?.id || `slot-${slotIndex}`}
                  className={`gptc-detail-row${active ? " gptc-detail-row--active" : ""}${
                    !row ? " gptc-detail-row--empty" : ""
                  }`}
                  style={autoGrow ? undefined : { height: `${hMm}mm` }}
                  onClick={() => row && onRowSelect?.(row.id)}
                >
                  {FIELDS.map((field, col) => (
                    <td
                      key={field}
                      className={`${COL_CLASSES[col]} gptc-data-cell`}
                      style={
                        autoGrow
                          ? undefined
                          : {
                              height: `${hMm}mm`,
                              minHeight: `${hMm}mm`,
                              maxHeight: `${hMm}mm`
                            }
                      }
                    >
                      <CellInput
                        editable={editable}
                        autoGrow={autoGrow && field !== "ngay"}
                        dateField={field === "ngay"}
                        value={
                          field === "ngay" && !editable
                            ? formatEntryDate(row?.ngay)
                            : row?.[field] || ""
                        }
                        placeholder=""
                        onChange={(v) => onChangeSlot?.(slotIndex, field, v)}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * BM02 — nhiều dòng full trang A4 ngang; đủ trang thì tự thêm trang mới.
 * onChangeSlot(slotIndex|"__permit__", field, value)
 */
export default function GptcDetailSheet({
  permit,
  editable = false,
  colWidths = [],
  selectedEntryId,
  onRowSelect,
  onChangeSlot,
  onChangeEntry,
  onColWidthsChange,
  margins
}) {
  const resizeRef = useRef(null);
  const [resizing, setResizing] = useState(false);
  const widths = colWidths?.length === 4 ? colWidths : normalizeDetailColWidths(colWidths);

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

  const pages = useMemo(
    () => packGptcDetailPages(permit?.entries || [], margins),
    [permit?.entries, margins]
  );

  function handleSlotChange(slotIndex, field, value) {
    if (slotIndex === "__permit__") {
      onChangeSlot?.("__permit__", field, value);
      onChangeEntry?.("__permit__", field, value);
      return;
    }
    if (onChangeSlot) {
      onChangeSlot(slotIndex, field, value);
      return;
    }
    const row = permit?.entries?.[slotIndex];
    if (row) onChangeEntry?.(row.id, field, value);
  }

  if (!permit) {
    return (
      <div className="gptc-sheet gptc-sheet--landscape gptc-sheet--detail gptc-sheet--empty">
        <p className="section-guide">
          Bấm nút <strong>Xem chi tiết</strong> ở cột ngoài khung in trên biểu tổng hợp để mở sổ theo dõi (BM02).
        </p>
      </div>
    );
  }

  let rowOffset = 0;
  return (
    <div className="gptc-detail-pages">
      {pages.map((page, pageIndex) => {
        const pageRows = page.rows;
        const offset = rowOffset;
        rowOffset += pageRows.length;
        return (
          <DetailPage
            key={`${permit.id}-p${pageIndex}`}
            permit={permit}
            pageRows={pageRows}
            pageIndex={pageIndex}
            pageCount={pages.length}
            rowOffset={offset}
            editable={editable}
            widths={widths}
            rowHMm={page.rowHeightMm || GPTC_DETAIL_LAYOUT.rowMm}
            rowHeightsMm={page.rowHeightsMm}
            selectedEntryId={selectedEntryId}
            onRowSelect={onRowSelect}
            onChangeSlot={handleSlotChange}
            onResizeStart={startResize}
            showProjectEdit={pageIndex === 0}
          />
        );
      })}
    </div>
  );
}
