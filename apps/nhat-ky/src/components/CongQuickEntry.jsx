import { useEffect, useMemo, useState } from "react";
import { formatDisplayDate, normalizeKmInput } from "../utils/nhatKyFormat";
import {
  plannedRepairDateForType,
  maxPlannedRepairDateForType
} from "../utils/baoDuongFormat";
import {
  parseDecimalNumber,
  normalizeDecimalString,
  makeEmptyQuickRows
} from "../utils/bulkMatDuongImport";
import {
  getUnitForType,
  formatUnitLabel,
  normalizeUnitValue,
  isCountUnit,
  needMaintenanceForType
} from "../utils/baoDuongQualityStore";
import { loadCongRegistryForRoute, resolveCongScope, CONG_REGISTRY_EVENT, formatCongTypeLabel, resolveCongLength } from "../utils/congRegistryStore";
import { hydrateCongRegistriesFromCloud } from "../services/congRegistryService";
import { formatKmCell } from "../utils/matDuongFormat";
import { useAuth } from "../context/AuthContext";
import { useRoadWorkspace } from "../context/RoadWorkspaceContext";
import { getRoadRoutes, pickActiveRoute } from "../utils/roadsCatalog";
import WorkTypeCombo from "./WorkTypeCombo";
import CongCombo from "./CongCombo";
import ViDateInput from "./ViDateInput";
import {
  CONG_EXPORT_STATUS_OPTIONS,
  normalizeExportCongStatus
} from "../utils/congDiaryStatus";

function round2(n) {
  return Math.round(n * 100) / 100;
}

function calcRowQuantity(row) {
  const unit = row?.unit || "";
  const manual = parseDecimalNumber(row?.quantity);
  const hasManual = !Number.isNaN(manual) && manual > 0;
  if (isCountUnit(unit)) {
    return hasManual ? manual : "";
  }
  const l = parseDecimalNumber(row?.length) || 0;
  const w = parseDecimalNumber(row?.width) || 0;
  const h = parseDecimalNumber(row?.height) || 0;
  if (unit === "m") return l || (hasManual ? manual : "");
  // m2/m3: ưu tiên Dài×Rộng(×Cao); thiếu kích thước thì dùng khối lượng gõ tay.
  if (unit === "m2") return l && w ? round2(l * w) : hasManual ? manual : "";
  if (unit === "m3") return l && w && h ? round2(l * w * h) : hasManual ? manual : "";
  return hasManual ? manual : "";
}

function rowIsValid(row) {
  const km = normalizeKmInput(row?.kmFrom);
  const type = String(row?.type || "").trim();
  if (!km || !type) return false;
  return Number(calcRowQuantity(row)) > 0;
}

/** Áp đơn vị + khối lượng mặc định theo loại việc / chiều dài cống hồ sơ. */
function applyCongMeasureDefaults(row, { type, congLength, resolveUnit } = {}) {
  const next = { ...row };
  const resolvedType = type !== undefined ? type : next.type;
  if (type !== undefined) next.type = type;

  const unitFn = typeof resolveUnit === "function" ? resolveUnit : getUnitForType;
  let unit = normalizeUnitValue(unitFn(resolvedType));
  if (!unit && resolvedType) unit = "cái";
  if (unit) next.unit = unit;

  const len =
    congLength !== undefined
      ? String(congLength ?? "").trim()
      : String(next.congLength ?? "").trim();

  // Chỉ đơn vị m lấy chiều dài hồ sơ cống; m2/m3 nhập kích thước hư hỏng (hoặc KL tay).
  if (unit === "m" && len && !String(next.length || "").trim()) {
    next.length = len;
  }
  if (isCountUnit(unit) && !String(next.quantity ?? "").trim()) {
    next.quantity = "1";
  }
  return next;
}

/** Dựng entry nhật ký từ các dòng nhập nhanh hạng mục Cống (1 lý trình). */
export function buildCongEntries(rows, { section, date, routeId = "", roadName = "" }) {
  const errors = [];
  const entries = [];
  const defaultRouteId = String(routeId || "").trim();
  const defaultRoadName = String(roadName || "").trim();
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
    const unit =
      normalizeUnitValue(row?.unit) ||
      normalizeUnitValue(getUnitForType(type)) ||
      "cái";
    const quantity = calcRowQuantity({ ...row, unit });
    if (!quantity || Number(quantity) <= 0) {
      errors.push(
        `Dòng ${i + 1}: thiếu khối lượng (đơn vị ${formatUnitLabel(unit)}: nhập Dài/Rộng/Cao hoặc gõ Khối lượng).`
      );
      return;
    }
    const need = needMaintenanceForType(type);
    let plannedRepairDate = String(row?.plannedRepairDate || "").trim();
    if (!need) plannedRepairDate = "";
    else if (!plannedRepairDate) plannedRepairDate = plannedRepairDateForType(date, type);
    const congType = String(row?.congType || "").trim();
    const congId = String(row?.congId || "").trim();
    // Nhánh đang chọn trên form là nguồn đúng khi thêm/sửa; không để routeId cũ của dòng ghi đè.
    const rowRouteId = String(defaultRouteId || row?.routeId || "").trim();
    const rowRoadName = String(defaultRoadName || row?.roadName || "").trim();
    const entry = {
      section,
      date,
      type,
      unit,
      kmFrom: km,
      kmTo: km,
      side: "",
      length: normalizeDecimalString(row?.length),
      width: normalizeDecimalString(row?.width),
      height: normalizeDecimalString(row?.height),
      quantity,
      content: "",
      viTriNote: congType,
      plannedRepairDate,
      // "" = không xuất; hu_hong | sua_chua | bo_sung → lịch sử DS cống.
      exportCongStatus: normalizeExportCongStatus(row?.exportCongStatus),
      exportTrafficDuty: row?.exportTrafficDuty === true,
      ...(congId
        ? { congId, assetType: "culvert", assetId: congId }
        : {}),
      ...(rowRouteId ? { routeId: rowRouteId } : {}),
      ...(rowRoadName ? { roadName: rowRoadName } : {})
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
export default function CongQuickEntry({
  date,
  section,
  rows,
  onRowsChange,
  onImport,
  types,
  unitByType = {}
}) {
  const displayDate = formatDisplayDate(date);
  const { profile } = useAuth();
  const { activeRoadId, activeRoad, ownerUid, catalogRoad, activeRouteId, routes } =
    useRoadWorkspace();
  const routeList = routes?.length ? routes : getRoadRoutes(catalogRoad || activeRoad);
  const activeRoute = pickActiveRoute(routeList, activeRouteId);
  const uid = ownerUid || profile?.uid || "";
  const scope = resolveCongScope(
    uid,
    activeRoadId,
    activeRoute?.id || activeRouteId,
    routeList
  );

  function readRegistry() {
    return loadCongRegistryForRoute(uid, activeRoadId, activeRoute, routeList);
  }

  const [registry, setRegistry] = useState(() => readRegistry());

  useEffect(() => {
    let cancelled = false;
    setRegistry([...readRegistry()]);
    async function refresh() {
      if (uid && activeRoad) {
        try {
          await hydrateCongRegistriesFromCloud(uid, [activeRoad], { force: false });
        } catch {
          /* giữ local */
        }
      }
      if (!cancelled) setRegistry([...readRegistry()]);
    }
    void refresh();
    const onChange = () => {
      if (!cancelled) setRegistry([...readRegistry()]);
    };
    window.addEventListener(CONG_REGISTRY_EVENT, onChange);
    return () => {
      cancelled = true;
      window.removeEventListener(CONG_REGISTRY_EVENT, onChange);
    };
  }, [scope, uid, activeRoad, activeRoute?.id, activeRoadId, routeList]);

  const validCount = useMemo(() => rows.filter(rowIsValid).length, [rows]);
  const editCount = useMemo(
    () => rows.filter((r) => Number.isInteger(r._editIndex) && rowIsValid(r)).length,
    [rows]
  );
  const baoLuAllChecked = useMemo(
    () => rows.length > 0 && rows.every((r) => r.exportTrafficDuty === true),
    [rows]
  );
  const baoLuSomeChecked = useMemo(
    () => rows.some((r) => r.exportTrafficDuty === true),
    [rows]
  );

  function resolveUnit(type) {
    const key = String(type || "").trim();
    return normalizeUnitValue(getUnitForType(key) || (key && unitByType[key]) || "cái");
  }

  function updateRow(index, patch) {
    onRowsChange(
      rows.map((row, i) => {
        if (i !== index) return row;
        const next = { ...row, ...patch };
        const unit =
          normalizeUnitValue(next.unit) || resolveUnit(next.type) || "";
        // Đồng bộ KL khi đủ kích thước (tránh ô KL trống dù đã có Dài×Rộng).
        if (
          !("quantity" in patch) &&
          !isCountUnit(unit) &&
          (unit === "m2" || unit === "m3" || unit === "m")
        ) {
          const q = calcRowQuantity({ ...next, unit });
          if (q !== "" && q != null) next.quantity = String(q);
        }
        return next;
      })
    );
  }

  function toggleAllBaoLu(checked) {
    onRowsChange(rows.map((row) => ({ ...row, exportTrafficDuty: checked })));
  }

  function handleCongChange(index, congId) {
    const cong = registry.find((c) => c.id === congId);
    const row = rows[index] || {};
    let patch = { congId };
    if (cong) {
      patch.kmFrom = normalizeKmInput(cong.km) || String(cong.km || "").trim();
      patch.congType = formatCongTypeLabel(cong);
      patch.congLength = resolveCongLength(cong);
      patch = applyCongMeasureDefaults(
        { ...row, ...patch },
        { congLength: patch.congLength, resolveUnit }
      );
      if (patch.type && needMaintenanceForType(patch.type) && !patch.plannedRepairDate) {
        patch.plannedRepairDate = plannedRepairDateForType(date, patch.type);
      }
    }
    updateRow(index, patch);
  }

  function handleTypeChange(index, type) {
    const row = rows[index] || {};
    let patch = applyCongMeasureDefaults(row, {
      type,
      congLength: row.congLength,
      resolveUnit
    });
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
    const { entries, errors } = buildCongEntries(rows, {
      section,
      date,
      routeId: activeRoute?.id || "",
      roadName: activeRoute?.roadName || ""
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

      {registry.length === 0 ? (
        <p className="section-guide section-guide--compact matduong-quick-hint">
          Chưa có danh sách cống. Vào tab <strong>DANH SÁCH CỐNG</strong> để khai báo (lý trình,
          loại cống, chiều dài) trước khi nhập.
        </p>
      ) : (
        <p className="section-guide section-guide--compact matduong-quick-hint">
          Gõ <strong>lý trình</strong> để lọc cống; chọn cống + công việc. Đơn vị đếm (cái…)
          mặc định khối lượng <strong>1</strong>; đơn vị m lấy chiều dài từ hồ sơ cống; m²/m³
          nhập Dài×Rộng(×Cao) hoặc gõ thẳng Khối lượng. Cột <strong>Xuất DS cống</strong>:
          chọn Hư hỏng / Sửa chữa / Bổ sung mới ghi lịch sử (mặc định không xuất). Tick cột{" "}
          <strong>Bão lũ</strong> để xuất sang <strong>sổ trực ĐBGT</strong>. Ghi nhật ký ngày{" "}
          {displayDate || "—"}.
        </p>
      )}

      <div className="matduong-quick-sheet-scroll">
        <table className="matduong-table matduong-table--entry matduong-table--quick baoduong-quick-table">
          <colgroup>
            <col style={{ width: "72px" }} />
            <col style={{ width: "140px" }} />
            <col style={{ width: "100px" }} />
            <col style={{ width: "64px" }} />
            <col style={{ width: "240px" }} />
            <col style={{ width: "56px" }} />
            <col style={{ width: "52px" }} />
            <col style={{ width: "52px" }} />
            <col style={{ width: "52px" }} />
            <col style={{ width: "70px" }} />
            <col style={{ width: "110px" }} />
            <col style={{ width: "130px" }} />
            <col style={{ width: "52px" }} />
          </colgroup>
          <thead>
            <tr>
              <th>Ngày</th>
              <th>Cống (hồ sơ)</th>
              <th>Lý trình</th>
              <th>Chiều dài (m)</th>
              <th>Loại công việc</th>
              <th>Đơn vị</th>
              <th>Dài</th>
              <th>Rộng</th>
              <th>Cao</th>
              <th>Khối lượng</th>
              <th title="Chọn trạng thái mới xuất sang danh sách cống">Xuất DS cống</th>
              <th>Ngày dự kiến sửa (BDTX)</th>
              <th title="Tick cả / bỏ tick cả — xuất sổ trực ĐBGT (bão lũ)">
                <label className="baoduong-bao-lu-head">
                  <input
                    type="checkbox"
                    checked={baoLuAllChecked}
                    ref={(el) => {
                      if (el) el.indeterminate = baoLuSomeChecked && !baoLuAllChecked;
                    }}
                    onChange={(e) => toggleAllBaoLu(e.target.checked)}
                    aria-label="Tick tất cả cột Bão lũ"
                  />
                  <span>Bão lũ</span>
                </label>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const unit =
                normalizeUnitValue(row.unit) ||
                resolveUnit(row.type) ||
                "";
              const count = isCountUnit(unit);
              const useWidth = unit === "m2" || unit === "m3";
              const useHeight = unit === "m3";
              const useLength = unit === "m" || unit === "m2" || unit === "m3";
              const km = normalizeKmInput(row.kmFrom);
              const isEdit = Number.isInteger(row._editIndex);
              return (
                <tr key={idx} className={`matduong-quick-data-row${isEdit ? " is-edit" : ""}`}>
                  <td className="matduong-cell-readonly matduong-col-date">
                    {isEdit ? "✎ " : ""}
                    {displayDate || "—"}
                  </td>
                  <td className="matduong-col-type">
                    <CongCombo
                      value={row.congId || ""}
                      onChange={(id) => handleCongChange(idx, id)}
                      options={registry}
                      controlClassName="matduong-excel-cell matduong-excel-cell--type"
                      ariaLabel={`Chọn cống dòng ${idx + 1}`}
                    />
                  </td>
                  <td className="matduong-cell-readonly">{km ? formatKmCell(km) : ""}</td>
                  <td className="matduong-cell-readonly">{row.congLength || ""}</td>
                  <td className="matduong-col-type">
                    <WorkTypeCombo
                      value={row.type || ""}
                      onChange={(val) => handleTypeChange(idx, val)}
                      options={types}
                      controlClassName="matduong-excel-cell matduong-excel-cell--type"
                      ariaLabel={`Loại công việc dòng ${idx + 1}`}
                    />
                  </td>
                  <td className="matduong-cell-readonly" title="Đơn vị theo MASTER DATA">
                    {formatUnitLabel(unit)}
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
                    <input
                      value={row.quantity ?? ""}
                      onChange={(e) => updateRow(idx, { quantity: e.target.value })}
                      className="matduong-excel-cell matduong-excel-cell--num"
                      aria-label={`Khối lượng dòng ${idx + 1}`}
                      title={
                        count
                          ? "Khối lượng (đếm)"
                          : "Tự tính từ Dài×Rộng(×Cao); hoặc gõ trực tiếp"
                      }
                    />
                  </td>
                  <td className="matduong-col-export">
                    <select
                      value={normalizeExportCongStatus(row.exportCongStatus)}
                      onChange={(e) =>
                        updateRow(idx, { exportCongStatus: e.target.value })
                      }
                      className="matduong-excel-cell matduong-excel-cell--type"
                      aria-label={`Xuất sang danh sách cống dòng ${idx + 1}`}
                      title="Chọn trạng thái xuất sang danh sách cống (mặc định không xuất)"
                    >
                      {CONG_EXPORT_STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value || "none"} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </td>
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
                  <td className="matduong-col-export">
                    <input
                      type="checkbox"
                      checked={row.exportTrafficDuty === true}
                      onChange={(e) =>
                        updateRow(idx, { exportTrafficDuty: e.target.checked })
                      }
                      aria-label={`Xuất sổ bão lũ dòng ${idx + 1}`}
                      title="Xuất sang sổ trực ĐBGT (thiệt hại bão lũ)"
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
