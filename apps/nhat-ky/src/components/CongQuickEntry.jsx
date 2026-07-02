import { useEffect, useMemo, useState } from "react";
import { formatDisplayDate, normalizeKmInput } from "../utils/nhatKyFormat";
import {
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
import { loadCongRegistry, congScope, CONG_REGISTRY_EVENT } from "../utils/congRegistryStore";
import { formatKmCell } from "../utils/matDuongFormat";
import { useAuth } from "../context/AuthContext";
import { useRoadWorkspace } from "../context/RoadWorkspaceContext";
import WorkTypeCombo from "./WorkTypeCombo";

const SIDE_OPTIONS = ["", "T", "P", "G", "M"];

function round2(n) {
  return Math.round(n * 100) / 100;
}

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
  const km = normalizeKmInput(row?.kmFrom);
  const type = String(row?.type || "").trim();
  if (!km || !type) return false;
  return Number(calcRowQuantity(row)) > 0;
}

/** Dựng entry nhật ký từ các dòng nhập nhanh hạng mục Cống (1 lý trình). */
export function buildCongEntries(rows, { section, date }) {
  const errors = [];
  const entries = [];
  (rows || []).forEach((row, i) => {
    const km = normalizeKmInput(row?.kmFrom);
    const type = String(row?.type || "").trim();
    if (!km && !type) return;
    if (!km) {
      errors.push(`Dòng ${i + 1}: chưa chọn cống (thiếu lý trình).`);
      return;
    }
    if (!type) {
      errors.push(`Dòng ${i + 1}: chưa chọn công việc.`);
      return;
    }
    const unit = row?.unit || getUnitForType(type) || "cái";
    const quantity = calcRowQuantity({ ...row, unit });
    if (!quantity || Number(quantity) <= 0) {
      errors.push(`Dòng ${i + 1}: thiếu khối lượng.`);
      return;
    }
    const need = needMaintenanceForType(type);
    let plannedRepairDate = String(row?.plannedRepairDate || "").trim();
    if (!need) plannedRepairDate = "";
    else if (!plannedRepairDate) plannedRepairDate = plannedRepairDateForType(date, type);
    const congType = String(row?.congType || "").trim();
    const entry = {
      section,
      date,
      type,
      unit,
      kmFrom: km,
      kmTo: km,
      side: normalizeSide(row?.side, "P"),
      length: normalizeDecimalString(row?.length),
      width: normalizeDecimalString(row?.width),
      height: normalizeDecimalString(row?.height),
      quantity,
      content: "",
      viTriNote: congType,
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
        : ["Không có dòng hợp lệ (cần chọn cống, công việc và khối lượng)."]
    };
  }
  return { entries, errors };
}

/**
 * Bảng nhập nhanh hạng mục CỐNG: chọn cống từ hồ sơ quản lý đường (1 lý trình),
 * tự điền loại cống + chiều dài; khối lượng theo đơn vị của loại công việc.
 */
export default function CongQuickEntry({ date, section, rows, onRowsChange, onImport, types }) {
  const displayDate = formatDisplayDate(date);
  const { profile } = useAuth();
  const { activeRoadId } = useRoadWorkspace();
  const scope = congScope(profile?.uid, activeRoadId);
  const [registry, setRegistry] = useState(() => loadCongRegistry(scope));

  useEffect(() => {
    setRegistry([...loadCongRegistry(scope)]);
    const onChange = () => setRegistry([...loadCongRegistry(scope)]);
    window.addEventListener(CONG_REGISTRY_EVENT, onChange);
    return () => window.removeEventListener(CONG_REGISTRY_EVENT, onChange);
  }, [scope]);

  const validCount = useMemo(() => rows.filter(rowIsValid).length, [rows]);
  const editCount = useMemo(
    () => rows.filter((r) => Number.isInteger(r._editIndex) && rowIsValid(r)).length,
    [rows]
  );

  function updateRow(index, patch) {
    onRowsChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function handleCongChange(index, congId) {
    const cong = registry.find((c) => c.id === congId);
    const patch = { congId };
    if (cong) {
      patch.kmFrom = cong.km;
      patch.congType = cong.type;
      patch.congLength = cong.length;
    }
    updateRow(index, patch);
  }

  function handleTypeChange(index, type) {
    const patch = { type };
    const unit = getUnitForType(type);
    if (unit) patch.unit = unit;
    if (type && needMaintenanceForType(type)) {
      patch.plannedRepairDate = plannedRepairDateForType(date, type);
    } else {
      patch.plannedRepairDate = "";
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
    const { entries, errors } = buildCongEntries(rows, { section, date });
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

      {registry.length === 0 ? (
        <p className="section-guide section-guide--compact matduong-quick-hint">
          Chưa có hồ sơ cống. Vào tab <strong>HỒ SƠ CỐNG</strong> để khai báo (lý trình,
          loại cống, chiều dài) trước khi nhập.
        </p>
      ) : (
        <p className="section-guide section-guide--compact matduong-quick-hint">
          Chọn <strong>cống</strong> để lấy lý trình chuẩn theo hồ sơ; chọn{" "}
          <strong>công việc</strong> để tự lấy đơn vị; khối lượng tự tính theo đơn vị. Ghi
          vào nhật ký ngày {displayDate || "—"}.
        </p>
      )}

      <div className="matduong-quick-sheet-scroll">
        <table className="matduong-table matduong-table--entry matduong-table--quick baoduong-quick-table">
          <colgroup>
            <col style={{ width: "82px" }} />
            <col style={{ width: "200px" }} />
            <col style={{ width: "110px" }} />
            <col style={{ width: "150px" }} />
            <col style={{ width: "70px" }} />
            <col style={{ width: "50px" }} />
            <col style={{ width: "180px" }} />
            <col style={{ width: "64px" }} />
            <col style={{ width: "56px" }} />
            <col style={{ width: "56px" }} />
            <col style={{ width: "56px" }} />
            <col style={{ width: "76px" }} />
            <col style={{ width: "140px" }} />
          </colgroup>
          <thead>
            <tr>
              <th>Ngày</th>
              <th>Cống (hồ sơ)</th>
              <th>Lý trình</th>
              <th>Loại cống</th>
              <th>Chiều dài (m)</th>
              <th>Phía</th>
              <th>Loại công việc</th>
              <th>Đơn vị</th>
              <th>Dài</th>
              <th>Rộng</th>
              <th>Cao</th>
              <th>Khối lượng</th>
              <th>Ngày dự kiến sửa (BDTX)</th>
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
              const km = normalizeKmInput(row.kmFrom);
              const isEdit = Number.isInteger(row._editIndex);
              return (
                <tr key={idx} className={`matduong-quick-data-row${isEdit ? " is-edit" : ""}`}>
                  <td className="matduong-cell-readonly matduong-col-date">
                    {isEdit ? "✎ " : ""}
                    {displayDate || "—"}
                  </td>
                  <td className="matduong-col-type">
                    <select
                      value={row.congId || ""}
                      onChange={(e) => handleCongChange(idx, e.target.value)}
                      className="matduong-excel-cell matduong-excel-cell--type"
                      aria-label={`Chọn cống dòng ${idx + 1}`}
                    >
                      <option value="">— Chọn cống —</option>
                      {registry.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.km || "(chưa có lý trình)"}
                          {c.type ? ` — ${c.type}` : ""}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="matduong-cell-readonly">{km ? formatKmCell(km) : ""}</td>
                  <td className="matduong-cell-readonly">{row.congType || ""}</td>
                  <td className="matduong-cell-readonly">{row.congLength || ""}</td>
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
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
