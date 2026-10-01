import { useMemo, useRef } from "react";
import { formatDisplayDate, addMetersToKm, normalizeKmInput, allowsEmptyDiarySide } from "../utils/nhatKyFormat";
import {
  isBaoDuongSection,
  plannedRepairDateForType,
  maxPlannedRepairDateForType
} from "../utils/baoDuongFormat";
import {
  parseDecimalNumber,
  normalizeDecimalString,
  normalizeSide,
  makeEmptyQuickRows,
  parseBaoDuongQuickFormPaste
} from "../utils/bulkMatDuongImport";
import {
  getUnitForType,
  formatUnitLabel,
  normalizeUnitValue,
  isCountUnit,
  needMaintenanceForType
} from "../utils/baoDuongQualityStore";
import { isNoteQtyDiarySection } from "../utils/incidentUtils";
import { CAU_SECTION } from "../utils/cauRegistryStore";
import { isBaoLuTickSection } from "../utils/trafficDutyFormat";
import { formatKmCell } from "../utils/matDuongFormat";
import { useRoadWorkspace } from "../context/RoadWorkspaceContext";
import { findRoute, getRoadRoutes } from "../utils/roadsCatalog";
import WorkTypeCombo from "./WorkTypeCombo";
import ViDateInput from "./ViDateInput";

const SIDE_OPTIONS = ["", "T", "P", "T+P", "G", "M"];
/** Form cầu: T / P / Giữa / M (lưu G = Giữa). */
const CAU_SIDE_OPTIONS = [
  { value: "", label: "" },
  { value: "T", label: "T" },
  { value: "P", label: "P" },
  { value: "G", label: "Giữa" },
  { value: "M", label: "M" }
];

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
export function buildBaoDuongEntries(rows, { section, date, routeId = "", roadName = "" }) {
  const errors = [];
  const entries = [];
  const noteQty = isNoteQtyDiarySection(section);
  const defaultRouteId = String(routeId || "").trim();
  const defaultRoadName = String(roadName || "").trim();
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
    const catalogUnit = normalizeUnitValue(getUnitForType(type));
    // Đơn vị luôn theo MASTER DATA — không nhận đơn vị nhập tay.
    const unit = catalogUnit || (noteQty ? "cái" : "m2");
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

    // Sinh BDTX: loại cần xử lý → mặc định ngày dự kiến = phát hiện + 1
    // (chưa nhập tay). Loại không sinh BDTX → bỏ ngày.
    const need = needMaintenanceForType(type);
    let plannedRepairDate = String(row?.plannedRepairDate || "").trim();
    if (!need) {
      plannedRepairDate = "";
    } else if (!plannedRepairDate && isBaoDuongSection(section)) {
      plannedRepairDate = plannedRepairDateForType(date, type);
    }
    const rowRouteId = String(defaultRouteId || row?.routeId || "").trim();
    const rowRoadName = String(defaultRoadName || row?.roadName || "").trim();
    const entry = {
      section,
      date,
      type,
      unit,
      kmFrom,
      kmTo,
      side:
        isCauSection(section) || allowsEmptyDiarySide(section)
          ? normalizeSide(row?.side, "")
          : normalizeSide(row?.side, "P"),
      length,
      width,
      height,
      quantity,
      content: noteQty ? String(row?.content || row?.note || "").trim() : "",
      plannedRepairDate,
      ...(rowRouteId ? { routeId: rowRouteId } : {}),
      ...(rowRoadName ? { roadName: rowRoadName } : {})
    };
    if (row?.bridgeId) entry.bridgeId = row.bridgeId;
    if (row?.bridgeName) entry.bridgeName = String(row.bridgeName).trim();
    if (isCauSection(section)) {
      entry.exportPhieuCau = row?.exportPhieuCau !== false;
    }
    if (isBaoLuTickSection(section)) {
      // Tick → xuất sổ trực ĐBGT / bão lũ (logic shouldExportTrafficDuty).
      entry.exportTrafficDuty = row?.exportTrafficDuty === true;
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

function enrichPastePatch(patch, date, showBdtxDate) {
  const next = { ...patch };
  const type = String(next.type || "").trim();
  if (type) {
    const unit = normalizeUnitValue(getUnitForType(type));
    if (unit) next.unit = unit;
    if (showBdtxDate) {
      if (needMaintenanceForType(type)) {
        if (!String(next.plannedRepairDate || "").trim()) {
          next.plannedRepairDate = plannedRepairDateForType(date, type);
        }
      } else {
        next.plannedRepairDate = "";
      }
    }
  }
  return next;
}

function mergePastedRows(currentRows, pastedRows, startIndex, date, showBdtxDate) {
  const next = currentRows.map((r) => ({ ...r }));
  pastedRows.forEach((row, i) => {
    const idx = startIndex + i;
    const mapped = enrichPastePatch(row, date, showBdtxDate);
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

/**
 * Bảng nhập nhanh cho các hạng mục bảo dưỡng (Nền đường + phát cây, Cống rãnh,
 * Ngầm tràn, Công trình ATGT, Công trình cầu). Đơn vị và cách tính khối
 * lượng tự theo loại công việc của từng dòng.
 * ATGT / Cột mốc: không có Dài/Rộng/Cao; có Ghi chú; lý trình đầu/cuối nhập tay.
 *
 * Nền đường (!noteQty): cột giống mặt đường — Loại công việc sau Khối lượng.
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
  const { catalogRoad, activeRouteId } = useRoadWorkspace();
  const activeRoute =
    findRoute(catalogRoad, activeRouteId) || getRoadRoutes(catalogRoad)[0] || null;
  const displayDate = formatDisplayDate(date);
  const showBdtxDate = isBaoDuongSection(section);
  const noteQty = isNoteQtyDiarySection(section);
  const singleKm = isCauSection(section);
  const showBaoLuExport = isBaoLuTickSection(section);
  const bridgeList = Array.isArray(bridges) ? bridges : [];
  /** Layout kích thước giống mặt đường: loại CV sau khối lượng. */
  const dimLayout = !noteQty && !singleKm;
  const focusRowRef = useRef(0);

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

  const baoLuAllChecked = useMemo(
    () => rows.length > 0 && rows.every((r) => r.exportTrafficDuty === true),
    [rows]
  );
  const baoLuSomeChecked = useMemo(
    () => rows.some((r) => r.exportTrafficDuty === true),
    [rows]
  );

  function updateRow(index, patch) {
    onRowsChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function toggleAllBaoLu(checked) {
    onRowsChange(rows.map((row) => ({ ...row, exportTrafficDuty: checked })));
  }

  function handleTypeChange(index, type) {
    const patch = { type };
    // Đổi loại công việc → đơn vị theo MASTER DATA (không cho sửa tay).
    const unit = normalizeUnitValue(getUnitForType(type));
    if (unit) patch.unit = unit;
    // Tự đặt ngày dự kiến sửa (phát hiện + 1) khi loại công việc cần sinh BDTX.
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
      kmFrom: formatKmCell(b.km) || b.km || ""
    });
  }

  function addEmptyRows() {
    onRowsChange([...rows, ...makeEmptyQuickRows(5)]);
  }

  function clearGrid() {
    onRowsChange(makeEmptyQuickRows(8));
  }

  function handleImport() {
    const { entries, errors } = buildBaoDuongEntries(rows, {
      section,
      date,
      routeId: activeRoute?.id || "",
      roadName: activeRoute?.roadName || ""
    });
    onImport(entries, errors);
  }

  function blurFormatKm(index, field, value) {
    const formatted = formatKmCell(value);
    if (formatted && formatted !== value) {
      updateRow(index, { [field]: formatted });
    }
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

    const { rows: parsed } = parseBaoDuongQuickFormPaste(text, {
      types,
      startCol,
      noteQty,
      singleKm,
      showBdtxDate,
      showBaoLuExport,
      showPhieuCau: singleKm,
      side: isCauSection(section) || allowsEmptyDiarySide(section) ? "" : "P"
    });
    if (!parsed.length) return;
    onRowsChange(mergePastedRows(rows, parsed, startIndex, date, showBdtxDate));
  }

  function renderTypeCell(row, idx) {
    return (
      <td className="matduong-col-type">
        <WorkTypeCombo
          value={row.type || ""}
          onChange={(val) => handleTypeChange(idx, val)}
          options={types}
          controlClassName="matduong-excel-cell matduong-excel-cell--type"
          ariaLabel={`Loại công việc dòng ${idx + 1}`}
        />
      </td>
    );
  }

  function renderUnitCell(unit) {
    return (
      <td className="matduong-cell-readonly" title="Đơn vị theo MASTER DATA">
        {formatUnitLabel(unit)}
      </td>
    );
  }

  function renderDimCells(row, idx, { useLength, useWidth, useHeight }) {
    return (
      <>
        <td>
          <input
            value={row.length || ""}
            onChange={(e) => updateRow(idx, { length: e.target.value })}
            className="matduong-excel-cell matduong-excel-cell--num"
            disabled={!useLength}
            aria-label={`Dài dòng ${idx + 1}`}
          />
        </td>
        <td>
          <input
            value={row.width || ""}
            onChange={(e) => updateRow(idx, { width: e.target.value })}
            className="matduong-excel-cell matduong-excel-cell--num"
            disabled={!useWidth}
            aria-label={`Rộng dòng ${idx + 1}`}
          />
        </td>
        <td>
          <input
            value={row.height || ""}
            onChange={(e) => updateRow(idx, { height: e.target.value })}
            className="matduong-excel-cell matduong-excel-cell--num"
            disabled={!useHeight}
            aria-label={`Cao dòng ${idx + 1}`}
          />
        </td>
      </>
    );
  }

  function renderQtyCell(row, idx, { count, quantity }) {
    return (
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
    );
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
            <strong>Ctrl+V</strong> dán Excel đúng cột: ngày → lý trình đầu → lý trình cuối → phía →
            đơn vị → khối lượng → <strong>loại công việc</strong> → ghi chú. Ô trống vẫn giữ cột;
            phía nhận P/T/Phải/Trái; tên công việc khớp danh mục. Lý trình cuối để trống nếu chỉ
            một điểm. Bấm sự cố ở danh sách bên trái để nạp dòng <strong>✎ sửa</strong>. Ghi vào
            nhật ký ngày {displayDate || "—"}.
          </>
        ) : (
          <>
            <strong>Ctrl+V</strong> dán Excel đúng cột: ngày → lý trình → phía → dài → rộng →
            cao → đơn vị → khối lượng → <strong>loại công việc</strong>. Khối lượng tự tính
            (m / m² / m³; đếm: nhập tay).
            {showBaoLuExport ? (
              <>
                {" "}
                Tick cột <strong>Bão lũ</strong> để xuất sang{" "}
                <strong>sổ trực ĐBGT</strong> (thiệt hại bão lũ).
              </>
            ) : null}{" "}
            Bấm sự cố ở danh sách bên trái để nạp dòng <strong>✎ sửa</strong>. Ghi vào nhật
            ký ngày {displayDate || "—"}.
          </>
        )}
      </p>

      <div className="matduong-quick-sheet-scroll" onPasteCapture={handleTablePaste}>
        <table className="matduong-table matduong-table--entry matduong-table--quick baoduong-quick-table">
          <colgroup>
            <col style={{ width: "82px" }} />
            {singleKm && <col style={{ width: "160px" }} />}
            <col style={{ width: "90px" }} />
            {!singleKm && <col style={{ width: "90px" }} />}
            <col style={{ width: "56px" }} />
            {dimLayout ? (
              <>
                <col style={{ width: "56px" }} />
                <col style={{ width: "56px" }} />
                <col style={{ width: "56px" }} />
                <col style={{ width: "64px" }} />
                <col style={{ width: "76px" }} />
                <col style={{ width: "190px" }} />
              </>
            ) : noteQty ? (
              <>
                <col style={{ width: "64px" }} />
                <col style={{ width: "76px" }} />
                <col style={{ width: "190px" }} />
                <col style={{ width: "160px" }} />
              </>
            ) : (
              <>
                <col style={{ width: "190px" }} />
                <col style={{ width: "64px" }} />
                <col style={{ width: "56px" }} />
                <col style={{ width: "56px" }} />
                <col style={{ width: "56px" }} />
                <col style={{ width: "76px" }} />
              </>
            )}
            {showBdtxDate && <col style={{ width: "140px" }} />}
            {showBaoLuExport && <col style={{ width: "52px" }} />}
            {singleKm && <col style={{ width: "52px" }} />}
          </colgroup>
          <thead>
            <tr>
              <th>Ngày</th>
              {singleKm && <th>Cầu</th>}
              <th>{singleKm ? "Lý trình" : "Lý trình đầu"}</th>
              {!singleKm && <th>Lý trình cuối</th>}
              <th>Phía</th>
              {dimLayout ? (
                <>
                  <th>Dài</th>
                  <th>Rộng</th>
                  <th>Cao</th>
                  <th>Đơn vị</th>
                  <th>Khối lượng</th>
                  <th>Loại công việc</th>
                </>
              ) : noteQty ? (
                <>
                  <th>Đơn vị</th>
                  <th>Khối lượng</th>
                  <th>Loại công việc</th>
                  <th>Ghi chú</th>
                </>
              ) : (
                <>
                  <th>Loại công việc</th>
                  <th>Đơn vị</th>
                  <th>Dài</th>
                  <th>Rộng</th>
                  <th>Cao</th>
                  <th>Khối lượng</th>
                </>
              )}
              {showBdtxDate && <th>Ngày dự kiến sửa (BDTX)</th>}
              {showBaoLuExport && (
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
              )}
              {singleKm && (
                <th title="Xuất sang phiếu kiểm tra cầu">Phiếu</th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const catalogUnit = normalizeUnitValue(getUnitForType(row.type));
              const unit = catalogUnit || normalizeUnitValue(row.unit) || "";
              const count = noteQty || isCountUnit(unit);
              // Chưa chọn loại (unit="") → cho nhập cả 3 kích thước để dán Excel hiện đủ.
              const useWidth = !noteQty && !count && (!unit || unit === "m2" || unit === "m3");
              const useHeight = !noteQty && !count && (!unit || unit === "m3");
              const useLength =
                !noteQty && !count && (!unit || unit === "m" || unit === "m2" || unit === "m3");
              const quantity = calcRowQuantity({ ...row, unit }, { noteQty });
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
                  {singleKm && (
                    <td>
                      <select
                        className="matduong-excel-cell"
                        value={row.bridgeId || ""}
                        onChange={(e) => handleBridgeChange(idx, e.target.value)}
                        aria-label={`Cầu dòng ${idx + 1}`}
                      >
                        <option value="">Chọn cầu…</option>
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
                          aria-label={`Lý trình cuối dòng ${idx + 1}`}
                        />
                      ) : (
                        <span className="matduong-cell-readonly">
                          {kmToDisplay ? formatKmCell(kmToDisplay) : ""}
                        </span>
                      )}
                    </td>
                  )}
                  <td>
                    <select
                      value={row.side ?? ""}
                      onChange={(e) => updateRow(idx, { side: e.target.value })}
                      className="matduong-excel-cell matduong-excel-cell--side"
                      aria-label={`Phía dòng ${idx + 1}`}
                    >
                      {singleKm
                        ? CAU_SIDE_OPTIONS.map((opt) => (
                            <option key={opt.value || "empty"} value={opt.value}>
                              {opt.label}
                            </option>
                          ))
                        : SIDE_OPTIONS.map((v) => (
                            <option key={v || "empty"} value={v}>
                              {v || ""}
                            </option>
                          ))}
                    </select>
                  </td>
                  {dimLayout ? (
                    <>
                      {renderDimCells(row, idx, { useLength, useWidth, useHeight })}
                      {renderUnitCell(unit)}
                      {renderQtyCell(row, idx, { count, quantity })}
                      {renderTypeCell(row, idx)}
                    </>
                  ) : noteQty ? (
                    <>
                      {renderUnitCell(unit)}
                      {renderQtyCell(row, idx, { count, quantity })}
                      {renderTypeCell(row, idx)}
                      <td>
                        <input
                          value={row.content || ""}
                          onChange={(e) => updateRow(idx, { content: e.target.value })}
                          className="matduong-excel-cell"
                          aria-label={`Ghi chú dòng ${idx + 1}`}
                        />
                      </td>
                    </>
                  ) : (
                    <>
                      {renderTypeCell(row, idx)}
                      {renderUnitCell(unit)}
                      {renderDimCells(row, idx, { useLength, useWidth, useHeight })}
                      {renderQtyCell(row, idx, { count, quantity })}
                    </>
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
                  {showBaoLuExport && (
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
