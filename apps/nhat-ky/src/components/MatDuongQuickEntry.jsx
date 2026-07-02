import { useMemo, useRef } from "react";
import MatDuongTableHead from "./MatDuongTableHead";
import WorkTypeCombo from "./WorkTypeCombo";
import {
  MAT_DUONG_ENTRY_COLS,
  matDuongEntryColWidths,
  matDuongEntryTableMinWidth
} from "../hooks/useMatDuongColWidths";
import { formatDisplayDate } from "../utils/nhatKyFormat";
import { maxPlannedRepairDate } from "../utils/baoDuongFormat";
import {
  buildMatDuongEntriesFromRows,
  makeEmptyQuickRows,
  normalizeMatDuongQuickRow,
  parseBulkMatDuongPaste
} from "../utils/bulkMatDuongImport";
import { calcAreaM2, formatKmCell } from "../utils/matDuongFormat";

const SIDE_OPTIONS = ["", "T", "P", "G", "M"];

function countValidRows(rows, common) {
  return rows.filter((r) => normalizeMatDuongQuickRow(r, common)).length;
}

function mergePastedRows(currentRows, pastedRows, startIndex = 0) {
  const next = currentRows.map((r) => ({ ...r }));
  pastedRows.forEach((row, i) => {
    const idx = startIndex + i;
    const mapped = {
      kmFrom: row.kmFrom || "",
      side: row.side || "",
      length: row.length || "",
      width: row.width || "",
      height: row.height || ""
    };
    if (idx < next.length) {
      next[idx] = { ...next[idx], ...mapped };
    } else {
      next.push(mapped);
    }
  });
  while (next.length < startIndex + pastedRows.length) {
    next.push({ ...makeEmptyQuickRows(1)[0] });
  }
  return next;
}

/** Bảng nhập nhanh 12 cột — giống sổ mặt đường, dán Excel trực tiếp. */
export default function MatDuongQuickEntry({
  date,
  form,
  rows,
  onRowsChange,
  onImport,
  types,
  section = "Mặt đường",
  exportField = "exportMatDuong",
  exportLabel = "Xuất sổ mặt đường"
}) {
  const tableRef = useRef(null);
  const focusRowRef = useRef(0);
  const nenDuong = section === "Nền đường";
  const leDuong = section === "Lề đường";
  const hasHeight = nenDuong || leDuong;
  const hasUnit = leDuong;
  const showExport = !leDuong;
  const showResolved = !(nenDuong || leDuong);
  const volumeLabel = leDuong
    ? "Khối lượng"
    : nenDuong
    ? "Khối lượng (m³)"
    : "Diện tích hư hỏng (m²)";
  const entryWidths = matDuongEntryColWidths();
  const tableMinWidth =
    matDuongEntryTableMinWidth() +
    (hasHeight ? 58 : 0) +
    (hasUnit ? 64 : 0) -
    (showExport ? 0 : entryWidths.md11) -
    (showResolved ? 0 : entryWidths.md9 + entryWidths.md10);
  const displayDate = formatDisplayDate(date);
  const commonForm = useMemo(
    () => (nenDuong ? { ...form, unit: "m3" } : form),
    [form, nenDuong]
  );
  const colSpecs = useMemo(() => {
    let specs = MAT_DUONG_ENTRY_COLS.map((col) => ({
      key: col.key,
      width: entryWidths[col.key]
    }));
    if (!showExport) specs = specs.filter((c) => c.key !== "md11");
    if (!showResolved) specs = specs.filter((c) => c.key !== "md9" && c.key !== "md10");
    if (hasHeight) {
      const idx = specs.findIndex((c) => c.key === "md6");
      specs.splice(idx + 1, 0, { key: "mdH", width: 58 });
    }
    if (hasUnit) {
      const idx = specs.findIndex((c) => c.key === "md7");
      specs.splice(idx, 0, { key: "mdUnit", width: 64 });
    }
    return specs;
  }, [entryWidths, hasHeight, hasUnit, showExport, showResolved]);
  const validCount = useMemo(
    () => countValidRows(rows, commonForm),
    [rows, commonForm]
  );
  const editCount = useMemo(
    () =>
      rows.filter(
        (r) => Number.isInteger(r._editIndex) && normalizeMatDuongQuickRow(r, commonForm)
      ).length,
    [rows, commonForm]
  );

  function updateRow(index, field, value) {
    onRowsChange(rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  function handleTablePaste(e) {
    const text = e.clipboardData?.getData("text");
    if (!text?.trim()) return;
    if (!text.includes("\t") && !text.includes("\n")) return;

    e.preventDefault();
    e.stopPropagation();

    let startIndex = focusRowRef.current;
    const active = document.activeElement;
    const tr = active?.closest?.("tr.matduong-quick-data-row");
    if (tr?.parentElement) {
      startIndex = Array.from(tr.parentElement.children).indexOf(tr);
      if (startIndex < 0) startIndex = focusRowRef.current;
    }

    const { rows: parsed } = parseBulkMatDuongPaste(text, commonForm);
    if (!parsed.length) return;
    const mapped = parsed.map((r) => ({
      kmFrom: r.kmFrom,
      side: r.side || "",
      length: r.length,
      width: r.width,
      height: r.height || ""
    }));
    onRowsChange(mergePastedRows(rows, mapped, startIndex));
  }

  function addEmptyRows() {
    onRowsChange([...rows, ...makeEmptyQuickRows(5)]);
  }

  function clearGrid() {
    onRowsChange(makeEmptyQuickRows(8));
  }

  function handleImport() {
    const { entries, errors } = buildMatDuongEntriesFromRows(rows, commonForm, date, {
      section,
      exportField
    });
    onImport(entries, errors);
  }

  return (
    <div className="matduong-quick-entry">
      <div className="matduong-quick-actions">
        <button
          type="button"
          className="btn-primary matduong-quick-actions-main"
          disabled={validCount === 0}
          onClick={handleImport}
        >
          {validCount === 0
            ? "Thêm vào nhật ký"
            : editCount > 0
            ? `Lưu ${validCount} dòng (${editCount} sửa)`
            : `Thêm ${validCount} dòng vào nhật ký`}
        </button>
        <button type="button" className="btn-secondary btn-secondary--compact" onClick={addEmptyRows}>
          + 5 dòng
        </button>
        <button type="button" className="btn-secondary btn-secondary--compact" onClick={clearGrid}>
          Xóa bảng
        </button>
      </div>

      <p className="section-guide section-guide--compact matduong-quick-hint">
        Nhập 1 hay nhiều dòng. <strong>Ctrl+V</strong> dán từ Excel; điểm cuối &amp; khối lượng tự tính. Bấm sự cố ở danh sách bên trái để nạp dòng <strong>✎ sửa</strong>. Ghi vào nhật ký ngày {displayDate || "—"}.
      </p>

      <div
        className="matduong-quick-sheet-scroll"
        ref={tableRef}
        onPasteCapture={handleTablePaste}
      >
        <table
          className="matduong-table matduong-table--entry matduong-table--quick"
          style={{ minWidth: `${tableMinWidth}px` }}
        >
          <colgroup>
            {colSpecs.map((col) => (
              <col key={col.key} style={{ width: `${col.width}px` }} />
            ))}
          </colgroup>
          <thead>
            <MatDuongTableHead
              variant="quick"
              exportLabel={exportLabel}
              hasHeight={hasHeight}
              hasUnit={hasUnit}
              showExport={showExport}
              showResolved={showResolved}
              volumeLabel={volumeLabel}
            />
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const norm = normalizeMatDuongQuickRow(row, commonForm);
              const area =
                norm && (norm.length || norm.width)
                  ? nenDuong || leDuong
                    ? norm.quantity || ""
                    : calcAreaM2({ length: norm.length, width: norm.width, unit: "m2" })
                  : "";
              const isEdit = Number.isInteger(row._editIndex);
              return (
                <tr
                  key={idx}
                  className={`matduong-quick-data-row${isEdit ? " is-edit" : ""}`}
                  onFocusCapture={() => {
                    focusRowRef.current = idx;
                  }}
                >
                  <td className="matduong-cell-readonly matduong-col-date">
                    {isEdit ? "✎ " : ""}
                    {displayDate || "—"}
                  </td>
                  <td>
                    <input
                      value={row.kmFrom}
                      onChange={(e) => updateRow(idx, "kmFrom", e.target.value)}
                      onBlur={(e) => {
                        const formatted = formatKmCell(e.target.value);
                        if (formatted && formatted !== e.target.value) {
                          updateRow(idx, "kmFrom", formatted);
                        }
                      }}
                      className="matduong-excel-cell"
                      aria-label={`Điểm đầu dòng ${idx + 1}`}
                    />
                  </td>
                  <td className="matduong-cell-readonly">
                    {norm ? formatKmCell(norm.kmTo) : ""}
                  </td>
                  <td>
                    <select
                      value={row.side || form.side || "P"}
                      onChange={(e) => updateRow(idx, "side", e.target.value)}
                      className="matduong-excel-cell matduong-excel-cell--side"
                      aria-label={`Phía dòng ${idx + 1}`}
                    >
                      {SIDE_OPTIONS.map((v) => (
                        <option key={v || "default"} value={v}>
                          {v || "—"}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      value={row.length}
                      onChange={(e) => updateRow(idx, "length", e.target.value)}
                      className="matduong-excel-cell matduong-excel-cell--num"
                      aria-label={`Dài dòng ${idx + 1}`}
                    />
                  </td>
                  <td>
                    <input
                      value={row.width}
                      onChange={(e) => updateRow(idx, "width", e.target.value)}
                      className="matduong-excel-cell matduong-excel-cell--num"
                      aria-label={`Rộng dòng ${idx + 1}`}
                    />
                  </td>
                  {hasHeight && (
                    <td>
                      <input
                        value={row.height || ""}
                        onChange={(e) => updateRow(idx, "height", e.target.value)}
                        className="matduong-excel-cell matduong-excel-cell--num"
                        aria-label={`Cao dòng ${idx + 1}`}
                      />
                    </td>
                  )}
                  {hasUnit && (
                    <td>
                      <select
                        value={row.unit || "m2"}
                        onChange={(e) => updateRow(idx, "unit", e.target.value)}
                        className="matduong-excel-cell matduong-excel-cell--side"
                        aria-label={`Đơn vị dòng ${idx + 1}`}
                      >
                        <option value="m">m</option>
                        <option value="m2">m²</option>
                        <option value="m3">m³</option>
                      </select>
                    </td>
                  )}
                  <td className="matduong-cell-readonly">{area || ""}</td>
                  <td className="matduong-col-type">
                    <WorkTypeCombo
                      value={row.type || ""}
                      onChange={(val) => updateRow(idx, "type", val)}
                      options={types}
                      controlClassName="matduong-excel-cell matduong-excel-cell--type"
                      ariaLabel={`Loại sự cố dòng ${idx + 1}`}
                    />
                  </td>
                  {showResolved && (
                    <>
                      <td
                        className={`matduong-col-check matduong-col-check--click${
                          (row.resolvedStatus || "chua") === "co" ? " is-on" : ""
                        }`}
                        role="button"
                        tabIndex={0}
                        aria-label={`Đã giải quyết: Có — dòng ${idx + 1}`}
                        onClick={() => updateRow(idx, "resolvedStatus", "co")}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            updateRow(idx, "resolvedStatus", "co");
                          }
                        }}
                      >
                        {(row.resolvedStatus || "chua") === "co" ? "X" : ""}
                      </td>
                      <td
                        className={`matduong-col-check matduong-col-check--click${
                          (row.resolvedStatus || "chua") !== "co" ? " is-on" : ""
                        }`}
                        role="button"
                        tabIndex={0}
                        aria-label={`Chưa giải quyết — dòng ${idx + 1}`}
                        onClick={() => updateRow(idx, "resolvedStatus", "chua")}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            updateRow(idx, "resolvedStatus", "chua");
                          }
                        }}
                      >
                        {(row.resolvedStatus || "chua") !== "co" ? "X" : ""}
                      </td>
                    </>
                  )}
                  {showExport && (
                    <td className="matduong-col-export">
                      <input
                        type="checkbox"
                        checked={row[exportField] !== false}
                        onChange={(e) => updateRow(idx, exportField, e.target.checked)}
                        aria-label={`${exportLabel} dòng ${idx + 1}`}
                      />
                    </td>
                  )}
                  <td>
                    <input
                      type="date"
                      value={row.plannedRepairDate || ""}
                      min={date}
                      max={maxPlannedRepairDate(date)}
                      onChange={(e) => updateRow(idx, "plannedRepairDate", e.target.value)}
                      className="matduong-excel-cell matduong-excel-cell--date"
                      aria-label={`Ngày xuất sổ BDTX dòng ${idx + 1}`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
