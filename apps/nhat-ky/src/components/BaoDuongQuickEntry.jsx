import { useMemo } from "react";
import { formatDisplayDate, addMetersToKm, normalizeKmInput } from "../utils/nhatKyFormat";
import {
  isBaoDuongSection,
  plannedRepairDateForType,
  maxPlannedRepairDateForType
} from "../utils/baoDuongFormat";
import {
  parseDecimalNumber,
  normalizeDecimalString,
  normalizeSide,
  makeEmptyQuickRows
} from "../utils/bulkMatDuongImport";
import {
  BAO_DUONG_UNITS,
  getUnitForType,
  isCountUnit,
  needMaintenanceForType
} from "../utils/baoDuongQualityStore";
import { formatKmCell } from "../utils/matDuongFormat";
import WorkTypeCombo from "./WorkTypeCombo";

const SIDE_OPTIONS = ["", "T", "P", "G", "M"];

function round2(n) {
  return Math.round(n * 100) / 100;
}

/** Khối lượng của một dòng theo đơn vị: m→dài, m²→dài×rộng, m³→dài×rộng×cao, đếm→nhập tay. */
function calcRowQuantity(row) {
  const unit = row?.unit || "";
  if (isCountUnit(unit)) {
    const q = parseDecimalNumber(row?.quantity);
    return Number.isNaN(q) ? "" : q;
  }
  const l = parseDecimalNumber(row?.length) || 0;
  const w = parseDecimalNumber(row?.width) || 0;
  const h = parseDecimalNumber(row?.height) || 0;
  if (unit === "m") return l || "";
  if (unit === "m2") return l && w ? round2(l * w) : "";
  if (unit === "m3") return l && w && h ? round2(l * w * h) : "";
  return "";
}

function rowIsValid(row) {
  const kmFrom = normalizeKmInput(row?.kmFrom);
  const type = String(row?.type || "").trim();
  if (!kmFrom || !type) return false;
  const q = calcRowQuantity(row);
  return Number(q) > 0;
}

/** Dựng các entry nhật ký từ các dòng nhập nhanh của hạng mục BDTX. */
export function buildBaoDuongEntries(rows, { section, date }) {
  const errors = [];
  const entries = [];
  (rows || []).forEach((row, i) => {
    const kmFrom = normalizeKmInput(row?.kmFrom);
    const type = String(row?.type || "").trim();
    if (!kmFrom && !type) return; // dòng trống, bỏ qua
    if (!kmFrom) {
      errors.push(`Dòng ${i + 1}: thiếu lý trình.`);
      return;
    }
    if (!type) {
      errors.push(`Dòng ${i + 1}: chưa chọn loại công việc.`);
      return;
    }
    const unit = row?.unit || getUnitForType(type) || "m2";
    const length = normalizeDecimalString(row?.length);
    const width = normalizeDecimalString(row?.width);
    const height = normalizeDecimalString(row?.height);
    const quantity = calcRowQuantity({ ...row, unit });
    if (!quantity || Number(quantity) <= 0) {
      errors.push(`Dòng ${i + 1}: thiếu khối lượng.`);
      return;
    }
    const lengthM = parseDecimalNumber(length);
    const kmTo = lengthM > 0 ? addMetersToKm(kmFrom, lengthM) : kmFrom;
    // Sinh BDTX: nếu loại công việc cần xử lý thì tự đặt ngày dự kiến sửa
    // = ngày phát hiện + deadlineDays (nếu chưa nhập tay). Loại không sinh BDTX
    // thì bỏ ngày dự kiến để không đưa sang sổ BDTX.
    const need = needMaintenanceForType(type);
    let plannedRepairDate = String(row?.plannedRepairDate || "").trim();
    if (!need) {
      plannedRepairDate = "";
    } else if (!plannedRepairDate && isBaoDuongSection(section)) {
      plannedRepairDate = plannedRepairDateForType(date, type);
    }
    const entry = {
      section,
      date,
      type,
      unit,
      kmFrom,
      kmTo,
      side: normalizeSide(row?.side, "P"),
      length,
      width,
      height,
      quantity,
      content: "",
      plannedRepairDate
    };
    if (Number.isInteger(row?._editIndex)) entry._editIndex = row._editIndex;
    entries.push(entry);
  });
  if (!entries.length) {
    return {
      entries: [],
      errors: errors.length
        ? errors
        : ["Không có dòng hợp lệ (cần lý trình, loại công việc và khối lượng)."]
    };
  }
  return { entries, errors };
}

/**
 * Bảng nhập nhanh cho các hạng mục bảo dưỡng (Cống rãnh, Ngầm tràn, Cột mốc,
 * Công trình ATGT, Công tác phát cây, Công trình cầu). Đơn vị và cách tính khối
 * lượng tự theo loại công việc của từng dòng.
 */
export default function BaoDuongQuickEntry({
  date,
  section,
  rows,
  onRowsChange,
  onImport,
  types
}) {
  const displayDate = formatDisplayDate(date);
  const showBdtxDate = isBaoDuongSection(section);

  const validCount = useMemo(() => rows.filter(rowIsValid).length, [rows]);
  const editCount = useMemo(
    () => rows.filter((r) => Number.isInteger(r._editIndex) && rowIsValid(r)).length,
    [rows]
  );

  function updateRow(index, patch) {
    onRowsChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function handleTypeChange(index, type) {
    const patch = { type };
    // Đổi loại công việc → tự lấy đơn vị theo danh mục (nếu loại đó có khai báo).
    const unit = getUnitForType(type);
    if (unit) patch.unit = unit;
    // Tự đặt ngày dự kiến sửa theo deadlineDays khi loại công việc cần sinh BDTX.
    if (showBdtxDate) {
      if (type && needMaintenanceForType(type)) {
        patch.plannedRepairDate = plannedRepairDateForType(date, type);
      } else {
        patch.plannedRepairDate = "";
      }
    }
    updateRow(index, patch);
  }

  function addEmptyRows() {
    onRowsChange([...rows, ...makeEmptyQuickRows(5)]);
  }

  function clearGrid() {
    onRowsChange(makeEmptyQuickRows(8));
  }

  function handleImport() {
    const { entries, errors } = buildBaoDuongEntries(rows, { section, date });
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
        Chọn <strong>loại công việc</strong> để tự lấy đơn vị; khối lượng tự tính theo
        đơn vị (m: dài; m²: dài×rộng; m³: dài×rộng×cao; đếm: nhập tay). Bấm sự cố ở
        danh sách bên trái để nạp dòng <strong>✎ sửa</strong>. Ghi vào nhật ký ngày{" "}
        {displayDate || "—"}.
      </p>

      <div className="matduong-quick-sheet-scroll">
        <table className="matduong-table matduong-table--entry matduong-table--quick baoduong-quick-table">
          <colgroup>
            <col style={{ width: "82px" }} />
            <col style={{ width: "90px" }} />
            <col style={{ width: "90px" }} />
            <col style={{ width: "50px" }} />
            <col style={{ width: "190px" }} />
            <col style={{ width: "64px" }} />
            <col style={{ width: "56px" }} />
            <col style={{ width: "56px" }} />
            <col style={{ width: "56px" }} />
            <col style={{ width: "76px" }} />
            {showBdtxDate && <col style={{ width: "140px" }} />}
          </colgroup>
          <thead>
            <tr>
              <th>Ngày</th>
              <th>Lý trình đầu</th>
              <th>Lý trình cuối</th>
              <th>Phía</th>
              <th>Loại công việc</th>
              <th>Đơn vị</th>
              <th>Dài</th>
              <th>Rộng</th>
              <th>Cao</th>
              <th>Khối lượng</th>
              {showBdtxDate && <th>Ngày dự kiến sửa (BDTX)</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const unit = row.unit || "";
              const count = isCountUnit(unit);
              const useWidth = unit === "m2" || unit === "m3";
              const useHeight = unit === "m3";
              const useLength = unit === "m" || unit === "m2" || unit === "m3";
              const quantity = calcRowQuantity(row);
              const lengthM = parseDecimalNumber(row.length);
              const kmTo =
                lengthM > 0 && normalizeKmInput(row.kmFrom)
                  ? addMetersToKm(normalizeKmInput(row.kmFrom), lengthM)
                  : normalizeKmInput(row.kmFrom);
              const isEdit = Number.isInteger(row._editIndex);
              return (
                <tr
                  key={idx}
                  className={`matduong-quick-data-row${isEdit ? " is-edit" : ""}`}
                >
                  <td className="matduong-cell-readonly matduong-col-date">
                    {isEdit ? "✎ " : ""}
                    {displayDate || "—"}
                  </td>
                  <td>
                    <input
                      value={row.kmFrom || ""}
                      onChange={(e) => updateRow(idx, { kmFrom: e.target.value })}
                      onBlur={(e) => {
                        const formatted = formatKmCell(e.target.value).replace(/^Km/, "");
                        if (formatted && formatted !== e.target.value) {
                          updateRow(idx, { kmFrom: formatted });
                        }
                      }}
                      className="matduong-excel-cell"
                      aria-label={`Lý trình đầu dòng ${idx + 1}`}
                    />
                  </td>
                  <td className="matduong-cell-readonly">{kmTo ? formatKmCell(kmTo) : ""}</td>
                  <td>
                    <select
                      value={row.side || "P"}
                      onChange={(e) => updateRow(idx, { side: e.target.value })}
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
                  <td className="matduong-col-type">
                    <WorkTypeCombo
                      value={row.type || ""}
                      onChange={(val) => handleTypeChange(idx, val)}
                      options={types}
                      controlClassName="matduong-excel-cell matduong-excel-cell--type"
                      ariaLabel={`Loại công việc dòng ${idx + 1}`}
                    />
                  </td>
                  <td>
                    <select
                      value={unit}
                      onChange={(e) => updateRow(idx, { unit: e.target.value })}
                      className="matduong-excel-cell matduong-excel-cell--side"
                      aria-label={`Đơn vị dòng ${idx + 1}`}
                    >
                      <option value="">—</option>
                      {BAO_DUONG_UNITS.map((u) => (
                        <option key={u.value} value={u.value}>
                          {u.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      value={useLength ? row.length || "" : ""}
                      onChange={(e) => updateRow(idx, { length: e.target.value })}
                      className="matduong-excel-cell matduong-excel-cell--num"
                      disabled={!useLength}
                      aria-label={`Dài dòng ${idx + 1}`}
                    />
                  </td>
                  <td>
                    <input
                      value={useWidth ? row.width || "" : ""}
                      onChange={(e) => updateRow(idx, { width: e.target.value })}
                      className="matduong-excel-cell matduong-excel-cell--num"
                      disabled={!useWidth}
                      aria-label={`Rộng dòng ${idx + 1}`}
                    />
                  </td>
                  <td>
                    <input
                      value={useHeight ? row.height || "" : ""}
                      onChange={(e) => updateRow(idx, { height: e.target.value })}
                      className="matduong-excel-cell matduong-excel-cell--num"
                      disabled={!useHeight}
                      aria-label={`Cao dòng ${idx + 1}`}
                    />
                  </td>
                  <td>
                    {count ? (
                      <input
                        value={row.quantity ?? ""}
                        onChange={(e) => updateRow(idx, { quantity: e.target.value })}
                        className="matduong-excel-cell matduong-excel-cell--num"
                        aria-label={`Khối lượng dòng ${idx + 1}`}
                      />
                    ) : (
                      <span className="matduong-cell-readonly matduong-quick-qty">
                        {quantity || ""}
                      </span>
                    )}
                  </td>
                  {showBdtxDate && (
                    <td>
                      <input
                        type="date"
                        value={row.plannedRepairDate || ""}
                        min={date}
                        max={maxPlannedRepairDateForType(date, row.type)}
                        onChange={(e) => updateRow(idx, { plannedRepairDate: e.target.value })}
                        className="matduong-excel-cell matduong-excel-cell--date"
                        aria-label={`Ngày dự kiến sửa dòng ${idx + 1}`}
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
