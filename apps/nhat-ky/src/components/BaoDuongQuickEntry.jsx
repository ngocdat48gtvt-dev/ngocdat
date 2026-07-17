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
import { isNoteQtyDiarySection } from "../utils/incidentUtils";
import { CAU_SECTION } from "../utils/cauRegistryStore";
import { formatKmCell } from "../utils/matDuongFormat";
import WorkTypeCombo from "./WorkTypeCombo";
import ViDateInput from "./ViDateInput";

const SIDE_OPTIONS = ["", "T", "P", "G", "M"];

function isCauSection(section) {
  return String(section || "").trim() === CAU_SECTION;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

/** Khối lượng của một dòng theo đơn vị: m→dài, m²→dài×rộng, m³→dài×rộng×cao, đếm→nhập tay. */
function calcRowQuantity(row, { noteQty = false } = {}) {
  const unit = row?.unit || "";
  if (noteQty || isCountUnit(unit)) {
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

function rowIsValid(row, { noteQty = false } = {}) {
  const kmFrom = normalizeKmInput(row?.kmFrom);
  const type = String(row?.type || "").trim();
  if (!kmFrom || !type) return false;
  const q = calcRowQuantity(row, { noteQty });
  return Number(q) > 0;
}

/** Dựng các entry nhật ký từ các dòng nhập nhanh của hạng mục BDTX. */
export function buildBaoDuongEntries(rows, { section, date }) {
  const errors = [];
  const entries = [];
  const noteQty = isNoteQtyDiarySection(section);
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
    const catalogUnit = getUnitForType(type);
    let unit = row?.unit || catalogUnit || (noteQty ? "cái" : "m2");
    if (noteQty && catalogUnit) {
      const geometric = new Set(["m", "m2", "m3", "m²", "m³"]);
      // Bản ghi cũ bị gán m³ nhầm → lấy lại đơn vị master data.
      if (isCountUnit(catalogUnit) && geometric.has(String(unit).trim())) {
        unit = catalogUnit;
      }
    }
    const length = noteQty ? "" : normalizeDecimalString(row?.length);
    const width = noteQty ? "" : normalizeDecimalString(row?.width);
    const height = noteQty ? "" : normalizeDecimalString(row?.height);
    const quantity = calcRowQuantity({ ...row, unit }, { noteQty });
    if (!quantity || Number(quantity) <= 0) {
      errors.push(`Dòng ${i + 1}: thiếu khối lượng.`);
      return;
    }

    let kmTo = "";
    if (noteQty) {
      // Người dùng tự điền; để trống = một điểm (vd. cột mốc, biển báo).
      kmTo = normalizeKmInput(row?.kmTo) || "";
    } else if (isCauSection(section)) {
      // Cầu chỉ có một lý trình.
      kmTo = kmFrom;
    } else {
      const lengthM = parseDecimalNumber(length);
      kmTo = lengthM > 0 ? addMetersToKm(kmFrom, lengthM) : kmFrom;
    }

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
      content: noteQty ? String(row?.content || row?.note || "").trim() : "",
      plannedRepairDate
    };
    if (row?.bridgeId) entry.bridgeId = row.bridgeId;
    if (row?.bridgeName) entry.bridgeName = String(row.bridgeName).trim();
    if (isCauSection(section)) {
      entry.exportPhieuCau = row?.exportPhieuCau !== false;
    }
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
 * ATGT / Cột mốc: không có Dài/Rộng/Cao; có Ghi chú; lý trình đầu/cuối nhập tay.
 */
export default function BaoDuongQuickEntry({
  date,
  section,
  rows,
  onRowsChange,
  onImport,
  types,
  bridges = []
}) {
  const displayDate = formatDisplayDate(date);
  const showBdtxDate = isBaoDuongSection(section);
  const noteQty = isNoteQtyDiarySection(section);
  const singleKm = isCauSection(section);
  const bridgeList = Array.isArray(bridges) ? bridges : [];

  const validCount = useMemo(
    () => rows.filter((r) => rowIsValid(r, { noteQty })).length,
    [rows, noteQty]
  );
  const editCount = useMemo(
    () =>
      rows.filter((r) => Number.isInteger(r._editIndex) && rowIsValid(r, { noteQty }))
        .length,
    [rows, noteQty]
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

  function handleBridgeChange(index, bridgeId) {
    const b = bridgeList.find((x) => x.id === bridgeId);
    if (!b) {
      updateRow(index, { bridgeId: "", bridgeName: "" });
      return;
    }
    updateRow(index, {
      bridgeId: b.id,
      bridgeName: b.name || "",
      kmFrom: b.km || ""
    });
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

  function blurFormatKm(index, field, value) {
    const formatted = formatKmCell(value).replace(/^Km/, "");
    if (formatted && formatted !== value) {
      updateRow(index, { [field]: formatted });
    }
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
        {singleKm ? (
          <>
            Chọn <strong>cầu</strong> để lấy lý trình (một điểm). Chọn{" "}
            <strong>loại công việc</strong> để tự lấy đơn vị. Tick cột{" "}
            <strong>Phiếu</strong> để đưa hư hỏng sang{" "}
            <strong>Phiếu kiểm tra cầu</strong>. Ghi vào nhật ký ngày {displayDate || "—"}.
          </>
        ) : noteQty ? (
          <>
            Chọn <strong>loại công việc</strong> để tự lấy đơn vị; nhập{" "}
            <strong>khối lượng</strong> và <strong>ghi chú</strong> (nếu có). Lý trình
            cuối để trống nếu chỉ một điểm (vd. cột mốc, biển báo). Bấm sự cố ở danh sách bên
            trái để nạp dòng <strong>✎ sửa</strong>. Ghi vào nhật ký ngày{" "}
            {displayDate || "—"}.
          </>
        ) : (
          <>
            Chọn <strong>loại công việc</strong> để tự lấy đơn vị; khối lượng tự tính theo
            đơn vị (m: dài; m²: dài×rộng; m³: dài×rộng×cao; đếm: nhập tay). Bấm sự cố ở
            danh sách bên trái để nạp dòng <strong>✎ sửa</strong>. Ghi vào nhật ký ngày{" "}
            {displayDate || "—"}.
          </>
        )}
      </p>

      <div className="matduong-quick-sheet-scroll">
        <table className="matduong-table matduong-table--entry matduong-table--quick baoduong-quick-table">
          <colgroup>
            <col style={{ width: "82px" }} />
            {singleKm && <col style={{ width: "160px" }} />}
            <col style={{ width: "90px" }} />
            {!singleKm && <col style={{ width: "90px" }} />}
            {!singleKm && <col style={{ width: "50px" }} />}
            <col style={{ width: "190px" }} />
            <col style={{ width: "64px" }} />
            {!noteQty && (
              <>
                <col style={{ width: "56px" }} />
                <col style={{ width: "56px" }} />
                <col style={{ width: "56px" }} />
              </>
            )}
            <col style={{ width: "76px" }} />
            {noteQty && <col style={{ width: "160px" }} />}
            {showBdtxDate && <col style={{ width: "140px" }} />}
            {singleKm && <col style={{ width: "52px" }} />}
          </colgroup>
          <thead>
            <tr>
              <th>Ngày</th>
              {singleKm && <th>Cầu</th>}
              <th>{singleKm ? "Lý trình" : "Lý trình đầu"}</th>
              {!singleKm && <th>Lý trình cuối</th>}
              {!singleKm && <th>Phía</th>}
              <th>Loại công việc</th>
              <th>Đơn vị</th>
              {!noteQty && (
                <>
                  <th>Dài</th>
                  <th>Rộng</th>
                  <th>Cao</th>
                </>
              )}
              <th>Khối lượng</th>
              {noteQty && <th>Ghi chú</th>}
              {showBdtxDate && <th>Ngày dự kiến sửa (BDTX)</th>}
              {singleKm && (
                <th title="Xuất sang phiếu kiểm tra cầu">Phiếu</th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const catalogUnit = getUnitForType(row.type);
              const geometric = new Set(["m", "m2", "m3", "m²", "m³"]);
              let unit = row.unit || "";
              if (
                noteQty &&
                catalogUnit &&
                isCountUnit(catalogUnit) &&
                (!unit || geometric.has(unit))
              ) {
                unit = catalogUnit;
              }
              const count = noteQty || isCountUnit(unit);
              const useWidth = !noteQty && (unit === "m2" || unit === "m3");
              const useHeight = !noteQty && unit === "m3";
              const useLength = !noteQty && (unit === "m" || unit === "m2" || unit === "m3");
              const quantity = calcRowQuantity(row, { noteQty });
              const lengthM = parseDecimalNumber(row.length);
              const kmToDisplay = singleKm
                ? normalizeKmInput(row.kmFrom) || ""
                : noteQty
                  ? normalizeKmInput(row.kmTo) || ""
                  : lengthM > 0 && normalizeKmInput(row.kmFrom)
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
                  {singleKm && (
                    <td>
                      <select
                        className="matduong-excel-cell"
                        value={row.bridgeId || ""}
                        onChange={(e) => handleBridgeChange(idx, e.target.value)}
                        aria-label={`Cầu dòng ${idx + 1}`}
                      >
                        <option value="">— Chọn cầu —</option>
                        {bridgeList.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name || b.km || b.id}
                          </option>
                        ))}
                      </select>
                    </td>
                  )}
                  <td>
                    <input
                      value={row.kmFrom || ""}
                      onChange={(e) => updateRow(idx, { kmFrom: e.target.value })}
                      onBlur={(e) => blurFormatKm(idx, "kmFrom", e.target.value)}
                      className="matduong-excel-cell"
                      readOnly={singleKm && !!row.bridgeId}
                      aria-label={`Lý trình dòng ${idx + 1}`}
                    />
                  </td>
                  {!singleKm && (
                    <td>
                      {noteQty ? (
                        <input
                          value={row.kmTo || ""}
                          onChange={(e) => updateRow(idx, { kmTo: e.target.value })}
                          onBlur={(e) => blurFormatKm(idx, "kmTo", e.target.value)}
                          className="matduong-excel-cell"
                          placeholder="—"
                          aria-label={`Lý trình cuối dòng ${idx + 1}`}
                        />
                      ) : (
                        <span className="matduong-cell-readonly">
                          {kmToDisplay ? formatKmCell(kmToDisplay) : ""}
                        </span>
                      )}
                    </td>
                  )}
                  {!singleKm && (
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
                  )}
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
                  {!noteQty && (
                    <>
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
                    </>
                  )}
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
                  {noteQty && (
                    <td>
                      <input
                        value={row.content || ""}
                        onChange={(e) => updateRow(idx, { content: e.target.value })}
                        className="matduong-excel-cell"
                        aria-label={`Ghi chú dòng ${idx + 1}`}
                      />
                    </td>
                  )}
                  {showBdtxDate && (
                    <td>
                      <ViDateInput
                        value={row.plannedRepairDate || ""}
                        min={date}
                        max={maxPlannedRepairDateForType(date, row.type)}
                        onChange={(iso) => updateRow(idx, { plannedRepairDate: iso || "" })}
                        className="matduong-excel-cell matduong-excel-cell--date"
                        aria-label={`Ngày dự kiến sửa dòng ${idx + 1}`}
                      />
                    </td>
                  )}
                  {singleKm && (
                    <td className="matduong-col-export">
                      <input
                        type="checkbox"
                        checked={row.exportPhieuCau !== false}
                        onChange={(e) => updateRow(idx, { exportPhieuCau: e.target.checked })}
                        aria-label={`Xuất phiếu kiểm tra cầu dòng ${idx + 1}`}
                        title="Xuất sang phiếu kiểm tra cầu"
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
