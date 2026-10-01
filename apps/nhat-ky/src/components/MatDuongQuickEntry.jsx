import { useMemo, useRef } from "react";
import MatDuongTableHead from "./MatDuongTableHead";
import WorkTypeCombo from "./WorkTypeCombo";
import {
  MAT_DUONG_ENTRY_COLS,
  matDuongEntryColWidths,
  matDuongEntryTableMinWidth
} from "../hooks/useMatDuongColWidths";
import { formatDisplayDate, allowsEmptyDiarySide } from "../utils/nhatKyFormat";
import {
  maxPlannedRepairDate,
  plannedRepairDateForType
} from "../utils/baoDuongFormat";
import {
  getUnitForType,
  formatUnitLabel,
  normalizeUnitValue,
  needMaintenanceForType,
  isCountUnit
} from "../utils/baoDuongQualityStore";
import {
  buildMatDuongEntriesFromRows,
  makeEmptyQuickRows,
  normalizeMatDuongQuickRow,
  parseMatDuongQuickFormPaste,
  fillLengthFromKmSpan
} from "../utils/bulkMatDuongImport";
import { calcAreaM2, formatKmCell } from "../utils/matDuongFormat";
import { useRoadWorkspace } from "../context/RoadWorkspaceContext";
import { findRoute, getRoadRoutes } from "../utils/roadsCatalog";
import { isBaoLuTickSection } from "../utils/trafficDutyFormat";
import ViDateInput from "./ViDateInput";

const SIDE_OPTIONS = ["", "T", "P", "T+P", "G", "M"];

/** Đơn vị theo MASTER DATA (catalog sống — không kẹt unitByType cũ). */
function resolveQuickUnit(type, unitByType = {}) {
  return normalizeUnitValue(
    getUnitForType(type) || (type && unitByType[type]) || "m2"
  );
}

function countValidRows(rows, common) {
  return rows.filter((r) => {
    const n = normalizeMatDuongQuickRow(r, common);
    if (!n) return false;
    const type = String(r?.type || common.type || "").trim();
    if (!type) return false;
    if (isCountUnit(n.unit)) return Number(n.quantity) > 0;
    return !!(n.length || n.width);
  }).length;
}

function enrichPastePatch(patch, date, unitByType) {
  const next = fillLengthFromKmSpan({ ...patch });
  const type = String(next.type || "").trim();
  if (type) {
    const unit = resolveQuickUnit(type, unitByType);
    if (unit) next.unit = unit;
    if (needMaintenanceForType(type)) {
      if (!String(next.plannedRepairDate || "").trim()) {
        next.plannedRepairDate = plannedRepairDateForType(date, type);
      }
    } else {
      next.plannedRepairDate = "";
    }
  }
  return next;
}

function mergePastedRows(currentRows, pastedRows, startIndex = 0, date, unitByType) {
  const next = currentRows.map((r) => ({ ...r }));
  pastedRows.forEach((row, i) => {
    const idx = startIndex + i;
    const mapped = enrichPastePatch(row, date, unitByType);
    if (idx < next.length) {
      next[idx] = { ...next[idx], ...mapped };
    } else {
      next.push({ ...makeEmptyQuickRows(1)[0], ...mapped });
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
  unitByType = {},
  section = "Mặt đường",
  exportField = "exportMatDuong",
  exportLabel = "Xuất sổ mặt đường"
}) {
  const { catalogRoad, activeRouteId } = useRoadWorkspace();
  const activeRoute =
    findRoute(catalogRoad, activeRouteId) || getRoadRoutes(catalogRoad)[0] || null;
  const tableRef = useRef(null);
  const focusRowRef = useRef(0);
  const nenDuong = section === "Nền đường";
  const leDuong = section === "Lề đường";
  /** Mặt đường / nền / lề đều có cột Cao (m). */
  const hasHeight = true;
  /** Luôn hiện đơn vị theo MASTER DATA (không sửa tay). */
  const hasUnit = true;
  const showExport = !leDuong;
  const showResolved = !(nenDuong || leDuong);
  const showBaoLuExport = isBaoLuTickSection(section);
  const volumeLabel = nenDuong || leDuong ? "Khối lượng" : "Diện tích hư hỏng (m²)";
  const entryWidths = matDuongEntryColWidths();
  const tableMinWidth =
    matDuongEntryTableMinWidth() +
    (hasHeight ? 58 : 0) +
    (hasUnit ? 64 : 0) +
    (showBaoLuExport ? 52 : 0) -
    (showExport ? 0 : entryWidths.md11) -
    (showResolved ? 0 : entryWidths.md9 + entryWidths.md10);
  const displayDate = formatDisplayDate(date);
  const commonForm = useMemo(() => ({ ...form, section }), [form, section]);
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
    if (showBaoLuExport) {
      specs.push({ key: "mdBaoLu", width: 52 });
    }
    return specs;
  }, [entryWidths, hasHeight, hasUnit, showExport, showResolved, showBaoLuExport]);
  const validCount = useMemo(
    () => countValidRows(rows, commonForm),
    [rows, commonForm]
  );
  const editCount = useMemo(
    () =>
      rows.filter((r) => {
        if (!Number.isInteger(r._editIndex)) return false;
        const n = normalizeMatDuongQuickRow(r, commonForm);
        if (!n) return false;
        const type = String(r?.type || commonForm.type || "").trim();
        if (!type) return false;
        if (isCountUnit(n.unit)) return Number(n.quantity) > 0;
        return !!(n.length || n.width);
      }).length,
    [rows, commonForm]
  );
  const baoLuAllChecked = useMemo(
    () => rows.length > 0 && rows.every((r) => r.exportTrafficDuty === true),
    [rows]
  );
  const baoLuSomeChecked = useMemo(
    () => rows.some((r) => r.exportTrafficDuty === true),
    [rows]
  );

  function updateRow(index, field, value) {
    onRowsChange(rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  function toggleAllBaoLu(checked) {
    onRowsChange(rows.map((row) => ({ ...row, exportTrafficDuty: checked })));
  }

  function handleTypeChange(index, type) {
    const patch = { type };
    const unit = resolveQuickUnit(type, unitByType);
    if (unit) patch.unit = unit;
    // Khóa kích thước theo đơn vị: m → khóa rộng+cao; m² → khóa cao.
    if (unit === "m") {
      patch.width = "";
      patch.height = "";
    } else if (unit === "m2") {
      patch.height = "";
    }
    // Loại cần sinh BDTX → tự điền ngày dự kiến sửa (nếu chưa có).
    if (type && needMaintenanceForType(type)) {
      const row = rows[index];
      if (!String(row?.plannedRepairDate || "").trim()) {
        patch.plannedRepairDate = plannedRepairDateForType(date, type);
      }
    } else if (type) {
      patch.plannedRepairDate = "";
    }
    onRowsChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function handleTablePaste(e) {
    const text = e.clipboardData?.getData("text/plain") || e.clipboardData?.getData("text");
    if (!text?.trim()) return;
    if (!text.includes("\t") && !text.includes("\n")) return;

    e.preventDefault();
    e.stopPropagation();

    let startIndex = focusRowRef.current;
    let startCol = 0;
    const active = document.activeElement;
    const tr = active?.closest?.("tr.matduong-quick-data-row");
    if (tr?.parentElement) {
      startIndex = Array.from(tr.parentElement.children).indexOf(tr);
      if (startIndex < 0) startIndex = focusRowRef.current;
      const td = active?.closest?.("td");
      if (td) {
        const col = Array.from(tr.children).indexOf(td);
        if (col >= 0) startCol = col;
      }
    }

    const { rows: parsed } = parseMatDuongQuickFormPaste(text, {
      types,
      startCol,
      hasHeight,
      hasUnit,
      showResolved,
      showExport,
      showBaoLuExport,
      side: allowsEmptyDiarySide(section) ? "" : commonForm.side || "P"
    });
    if (!parsed.length) return;
    onRowsChange(mergePastedRows(rows, parsed, startIndex, date, unitByType));
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
      exportField,
      routeId: activeRoute?.id || "",
      roadName: activeRoute?.roadName || "",
      showBaoLuExport
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
        {hasHeight ? (
          <>
            <strong>Ctrl+V</strong> dán Excel đúng cột: ngày → điểm đầu → điểm cuối → phía → dài →
            rộng → cao → đơn vị → khối lượng → <strong>loại sự cố</strong>. Ô trống vẫn giữ cột;
            phía nhận P/T/Phải/Trái; tên công việc khớp danh mục. Thiếu dài thì suy từ lý trình
            đầu/cuối.
            {showBaoLuExport ? (
              <>
                {" "}
                Tick cột <strong>Bão lũ</strong> để xuất sang{" "}
                <strong>sổ trực ĐBGT</strong> (thiệt hại bão lũ).
              </>
            ) : null}{" "}
            Ghi vào nhật ký ngày {displayDate || "—"}.
          </>
        ) : (
          <>
            Nhập 1 hay nhiều dòng. Chọn <strong>loại sự cố</strong> để tự lấy đơn vị theo danh mục.
            <strong> Ctrl+V</strong> dán từ Excel đúng cột trong khung (ngày → điểm đầu → … → loại
            sự cố); ô trống vẫn giữ cột; phía nhận P/T/Phải/Trái; tên công việc khớp danh mục. Điểm
            cuối &amp; khối lượng tự tính.
            {showBaoLuExport ? (
              <>
                {" "}
                Tick cột <strong>Bão lũ</strong> để xuất sang{" "}
                <strong>sổ trực ĐBGT</strong> (thiệt hại bão lũ).
              </>
            ) : null}{" "}
            Bấm sự cố ở danh sách bên trái để nạp dòng <strong>✎ sửa</strong>. Ghi vào nhật ký ngày{" "}
            {displayDate || "—"}.
          </>
        )}
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
              showBaoLuExport={showBaoLuExport}
              baoLuAllChecked={baoLuAllChecked}
              baoLuSomeChecked={baoLuSomeChecked}
              onToggleAllBaoLu={toggleAllBaoLu}
              volumeLabel={volumeLabel}
            />
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const norm = normalizeMatDuongQuickRow(row, commonForm);
              const rowUnit = resolveQuickUnit(row.type, unitByType) || row.unit || "m2";
              const countQty = isCountUnit(rowUnit);
              const lockWidth = rowUnit === "m" || countQty;
              const lockHeight = rowUnit === "m" || rowUnit === "m2" || countQty;
              const area =
                norm && (norm.length || norm.width || countQty || norm.height)
                  ? nenDuong || leDuong || countQty || rowUnit === "m3"
                    ? norm.quantity || row.quantity || ""
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
                  <td
                    className="matduong-cell-readonly matduong-col-date"
                    tabIndex={0}
                    title="Ngày theo sổ đang mở — dán Excel từ cột này để khớp khung"
                  >
                    {isEdit ? "✎ " : ""}
                    {displayDate || "—"}
                  </td>
                  <td>
                    <input
                      value={row.kmFrom}
                      onChange={(e) => updateRow(idx, "kmFrom", e.target.value)}
                      onBlur={(e) => {
                        const formatted = formatKmCell(e.target.value);
                        if (formatted) {
                          updateRow(idx, "kmFrom", formatted);
                        }
                      }}
                      className="matduong-excel-cell"
                      aria-label={`Điểm đầu dòng ${idx + 1}`}
                      placeholder="Km0+000"
                    />
                  </td>
                  <td className="matduong-cell-readonly">
                    {norm ? formatKmCell(norm.kmTo) : ""}
                  </td>
                  <td>
                    <select
                      value={row.side ?? ""}
                      onChange={(e) => updateRow(idx, "side", e.target.value)}
                      className="matduong-excel-cell matduong-excel-cell--side"
                      aria-label={`Phía dòng ${idx + 1}`}
                    >
                      {SIDE_OPTIONS.map((v) => (
                        <option key={v || "empty"} value={v}>
                          {v || ""}
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
                      disabled={countQty}
                    />
                  </td>
                  <td>
                    <input
                      value={lockWidth ? "" : row.width}
                      onChange={(e) => updateRow(idx, "width", e.target.value)}
                      className="matduong-excel-cell matduong-excel-cell--num"
                      aria-label={`Rộng dòng ${idx + 1}`}
                      disabled={lockWidth}
                      title={lockWidth ? "Đơn vị m / đếm — không nhập rộng" : undefined}
                    />
                  </td>
                  {hasHeight && (
                    <td>
                      <input
                        value={lockHeight ? "" : row.height || ""}
                        onChange={(e) => updateRow(idx, "height", e.target.value)}
                        className="matduong-excel-cell matduong-excel-cell--num"
                        aria-label={`Cao dòng ${idx + 1}`}
                        disabled={lockHeight}
                        title={
                          lockHeight
                            ? rowUnit === "m2"
                              ? "Đơn vị m² — không nhập cao"
                              : "Đơn vị m / đếm — không nhập cao"
                            : undefined
                        }
                      />
                    </td>
                  )}
                  {hasUnit && (
                    <td className="matduong-cell-readonly" title="Đơn vị theo MASTER DATA">
                      {formatUnitLabel(rowUnit)}
                    </td>
                  )}
                  <td>
                    {countQty ? (
                      <input
                        value={row.quantity ?? ""}
                        onChange={(e) => updateRow(idx, "quantity", e.target.value)}
                        className="matduong-excel-cell matduong-excel-cell--num"
                        aria-label={`Khối lượng dòng ${idx + 1}`}
                      />
                    ) : (
                      <span className="matduong-cell-readonly">{area || ""}</span>
                    )}
                  </td>
                  <td className="matduong-col-type">
                    <WorkTypeCombo
                      value={row.type || ""}
                      onChange={(val) => handleTypeChange(idx, val)}
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
                    <ViDateInput
                      value={row.plannedRepairDate || ""}
                      min={date}
                      max={maxPlannedRepairDate(date)}
                      onChange={(iso) => updateRow(idx, "plannedRepairDate", iso || "")}
                      className="matduong-excel-cell matduong-excel-cell--date"
                      aria-label={`Ngày xuất sổ BDTX dòng ${idx + 1}`}
                    />
                  </td>
                  {showBaoLuExport && (
                    <td className="matduong-col-export">
                      <input
                        type="checkbox"
                        checked={row.exportTrafficDuty === true}
                        onChange={(e) =>
                          updateRow(idx, "exportTrafficDuty", e.target.checked)
                        }
                        aria-label={`Xuất sổ bão lũ dòng ${idx + 1}`}
                        title="Xuất sang sổ trực ĐBGT (thiệt hại bão lũ)"
                      />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
