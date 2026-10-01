import { useEffect, useMemo, useState } from "react";
import BaoDuongSheet from "../components/BaoDuongSheet";
import BaoDuongPrintPages from "../components/BaoDuongPrintPages";
import ViDateInput from "../components/ViDateInput";
import { loadStorage, formatDisplayDate, safeSetLocalStorage } from "../utils/nhatKyFormat";
import {
  filterBaoDuongEntries,
  filterBaoDuongEntriesInRange,
  groupBaoDuongEntriesByExecDay,
  collectBaoDuongWorkTypes,
  isBaoDuongSection,
  packBaoDuongPages
} from "../utils/baoDuongFormat";
import {
  BAO_DUONG_QUALITY_EVENT,
  hasQualityForType,
  isQualityTypeHidden,
  upsertQualityTypes,
  DEFAULT_QUALITY_FALLBACK
} from "../utils/baoDuongQualityStore";
import { eachIsoDateInclusive } from "../utils/nhatKyPrintRows";
import { printBaoDuongPages } from "../utils/baoDuongPrint";
import { parsePrintPageStart } from "../utils/printFolio";
import { exportBaoDuongExcel } from "../utils/baoDuongExcel";
import { exportBaoDuongWord } from "../lib/baoDuongWordBuilder";
import { getBaoDuongColWidths } from "../hooks/useBaoDuongColWidths";
import { useRoadWorkspace } from "../context/RoadWorkspaceContext";
import RoutesViewSidebarControls from "../components/RoutesViewSidebarControls";

import SidebarResizer from "../components/SidebarResizer";
import { useResizableSidebar } from "../hooks/useResizableSidebar";
import {
  HAT_SIGN_ROLES,
  HAT_SIGN_ROLE_HAT_TRUONG,
  normalizeHatSignRole,
  resolveHatSignRoleLabel
} from "../utils/nhatKySignNames";

const MARGIN_KEY = "baoduong-print-margins-v1";
const CHIEF_NAME_KEY = "baoduong-chief-name-v1";
const CHIEF_ROLE_KEY = "baoduong-chief-role-v1";
const DEFAULT_MARGINS = { top: 12, right: 12, bottom: 12, left: 14 };

function loadChiefName() {
  try {
    return String(localStorage.getItem(CHIEF_NAME_KEY) || "").trim();
  } catch {
    return "";
  }
}

function loadChiefRole() {
  try {
    return normalizeHatSignRole(localStorage.getItem(CHIEF_ROLE_KEY));
  } catch {
    return HAT_SIGN_ROLE_HAT_TRUONG;
  }
}

function loadMargins() {
  try {
    const raw = JSON.parse(localStorage.getItem(MARGIN_KEY));
    if (!raw || typeof raw !== "object") return { ...DEFAULT_MARGINS };
    return {
      top: clampMm(raw.top, DEFAULT_MARGINS.top),
      right: clampMm(raw.right, DEFAULT_MARGINS.right),
      bottom: clampMm(raw.bottom, DEFAULT_MARGINS.bottom),
      left: clampMm(raw.left, DEFAULT_MARGINS.left)
    };
  } catch {
    return { ...DEFAULT_MARGINS };
  }
}

function clampMm(v, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(40, Math.max(0, Math.round(n * 10) / 10));
}

export default function SoBaoDuong({ date, onDateChange, onGoEdit, storageTick = 0, readOnly = false }) {
  const { storageKey, filterByRouteView, catalogRoad, routesViewMode, activeRouteId, titleRouteIds } =
    useRoadWorkspace();
  const routeViewCtx = useMemo(
    () => ({
      road: catalogRoad,
      routesViewMode,
      activeRouteId,
      titleRouteIds
    }),
    [catalogRoad, routesViewMode, activeRouteId, titleRouteIds]
  );
  const { sidebarStyle, onResizeStart } = useResizableSidebar({ defaultWidth: 300 });
  const [catalogTick, setCatalogTick] = useState(0);
  const [drafts, setDrafts] = useState({});
  const [printOpen, setPrintOpen] = useState(false);
  const [printScope, setPrintScope] = useState("day");
  const [rangeFrom, setRangeFrom] = useState(date);
  const [rangeTo, setRangeTo] = useState(date);
  const [margins, setMargins] = useState(loadMargins);
  const [chiefName, setChiefName] = useState(loadChiefName);
  const [chiefRole, setChiefRole] = useState(loadChiefRole);
  const [colWidths, setColWidths] = useState(getBaoDuongColWidths);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingWord, setExportingWord] = useState(false);
  const [pageStartInput, setPageStartInput] = useState("");
  const pageStart = parsePrintPageStart(pageStartInput);
  const chiefRoleLabel = resolveHatSignRoleLabel(chiefRole);

  const { entries } = useMemo(
    () => loadStorage(storageKey),
    [storageKey, storageTick]
  );

  useEffect(() => {
    const onChange = () => setCatalogTick((t) => t + 1);
    window.addEventListener(BAO_DUONG_QUALITY_EVENT, onChange);
    return () => window.removeEventListener(BAO_DUONG_QUALITY_EVENT, onChange);
  }, []);

  useEffect(() => {
    setRangeFrom(date);
    setRangeTo(date);
  }, [date]);

  useEffect(() => {
    safeSetLocalStorage(MARGIN_KEY, margins);
  }, [margins]);

  useEffect(() => {
    safeSetLocalStorage(CHIEF_NAME_KEY, chiefName);
  }, [chiefName]);

  useEffect(() => {
    safeSetLocalStorage(CHIEF_ROLE_KEY, chiefRole);
  }, [chiefRole]);

  useEffect(() => {
    if (printOpen) setColWidths(getBaoDuongColWidths());
  }, [printOpen]);

  const data = useMemo(
    () => filterByRouteView(filterBaoDuongEntries(entries, date)),
    [entries, date, catalogTick, filterByRouteView]
  );

  const rangeDates = useMemo(
    () => eachIsoDateInclusive(rangeFrom, rangeTo),
    [rangeFrom, rangeTo]
  );

  const printEntries = useMemo(() => {
    const raw =
      printScope === "range" && rangeDates.length
        ? filterBaoDuongEntriesInRange(entries, rangeFrom, rangeTo)
        : filterBaoDuongEntries(entries, date);
    return filterByRouteView(raw);
  }, [
    printScope,
    rangeDates,
    entries,
    rangeFrom,
    rangeTo,
    date,
    catalogTick,
    filterByRouteView
  ]);

  const periodFrom = printScope === "range" ? rangeFrom : date;
  const periodTo = printScope === "range" ? rangeTo : date;

  const printPageCount = useMemo(() => {
    if (printScope === "range") {
      const groups = groupBaoDuongEntriesByExecDay(printEntries, rangeFrom, rangeTo);
      if (!groups.length) return 1;
      return groups.reduce(
        (n, g) => n + packBaoDuongPages(g.entries, margins, routeViewCtx).length,
        0
      );
    }
    return packBaoDuongPages(printEntries, margins, routeViewCtx).length;
  }, [printScope, printEntries, margins, rangeFrom, rangeTo, routeViewCtx]);

  const missingTypes = useMemo(
    () =>
      collectBaoDuongWorkTypes(entries).filter(
        (t) => !hasQualityForType(t) && !isQualityTypeHidden(t)
      ),
    [entries, catalogTick]
  );

  const typeGroup = useMemo(() => {
    const map = {};
    (entries || []).forEach((e) => {
      const type = String(e?.type || "").trim();
      const section = String(e?.section || "").trim();
      if (type && section && isBaoDuongSection(section) && !map[type]) {
        map[type] = section;
      }
    });
    return map;
  }, [entries]);

  useEffect(() => {
    setDrafts((prev) => {
      const next = { ...prev };
      missingTypes.forEach((t) => {
        if (!next[t]) next[t] = { ...DEFAULT_QUALITY_FALLBACK };
      });
      return next;
    });
  }, [missingTypes]);

  function updateDraft(type, field, value) {
    if (readOnly) return;
    setDrafts((prev) => ({ ...prev, [type]: { ...prev[type], [field]: value } }));
  }

  function saveDraft(type) {
    if (readOnly) return;
    const d = drafts[type];
    if (!d || (!d.method?.trim() && !d.result?.trim())) {
      window.alert("Nhập ít nhất một nội dung biện pháp hoặc nhận xét.");
      return;
    }
    upsertQualityTypes({ [type]: { ...d, group: typeGroup[type] || "" } });
  }

  function shiftDay(delta) {
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() + delta);
    onDateChange(d.toISOString().split("T")[0]);
  }

  function runPrint() {
    printBaoDuongPages(margins, colWidths, pageStart);
  }

  async function runExportExcel() {
    if (printScope === "range" && rangeDates.length === 0) return;
    setExportingExcel(true);
    try {
      await exportBaoDuongExcel({
        entries: printEntries,
        periodFrom,
        periodTo,
        groupByDay: printScope === "range",
        margins,
        widths: colWidths,
        chiefName,
        signRole: chiefRoleLabel,
        routeView: routeViewCtx
      });
    } catch (err) {
      console.error(err);
      window.alert("Không xuất được Excel. Thử lại hoặc kiểm tra console.");
    } finally {
      setExportingExcel(false);
    }
  }

  async function runExportWord() {
    if (printScope === "range" && rangeDates.length === 0) return;
    setExportingWord(true);
    try {
      await exportBaoDuongWord({
        entries: printEntries,
        periodFrom,
        periodTo,
        groupByDay: printScope === "range",
        margins,
        chiefName,
        signRole: chiefRoleLabel,
        routeView: routeViewCtx
      });
    } catch (err) {
      console.error(err);
      window.alert("Không xuất được Word. Thử lại hoặc kiểm tra console.");
    } finally {
      setExportingWord(false);
    }
  }

  return (
    <div
      className={`nhaplieu-workspace sonhatky-workspace${
        printOpen ? " sobaoduong-workspace--print" : ""
      }`}
    >
      <aside
        className="nhaplieu-sidebar sonhatky-sidebar no-print"
        style={sidebarStyle}
      >
        <div className="sidebar-sticky-head">
          <h2 className="sidebar-title">Sổ bảo dưỡng</h2>
          <div className="sonhatky-date-toolbar">
            <div className="sonhatky-day-buttons">
              <button
                type="button"
                onClick={() => shiftDay(-1)}
                className="btn-primary btn-primary--compact sonhatky-nav-btn"
                title="Ngày trước"
              >
                ◀
              </button>
              <button
                type="button"
                onClick={() => shiftDay(1)}
                className="btn-primary btn-primary--compact sonhatky-nav-btn"
                title="Ngày sau"
              >
                ▶
              </button>
            </div>
            <ViDateInput
              value={date}
              onChange={onDateChange}
              className="sidebar-input sidebar-input--date"
              aria-label="Chọn ngày"
            />
          </div>
          <p className="sonhatky-day-summary">
            {formatDisplayDate(date)}
            {data.length > 0
              ? ` · ${data.length} công việc`
              : " · Chưa có công việc"}
          </p>
          {onGoEdit && !readOnly && (
            <button type="button" className="btn-primary sonhatky-edit-btn" onClick={onGoEdit}>
              Thêm / sửa dữ liệu
            </button>
          )}
          {readOnly && (
            <p className="sonhatky-day-summary" style={{ marginTop: 8 }}>
              Chế độ chỉ xem
            </p>
          )}
          <button
            type="button"
            className={`btn-secondary sonhatky-edit-btn sonhatky-edit-btn--sub${
              printOpen ? " active" : ""
            }`}
            onClick={() => setPrintOpen((v) => !v)}
          >
            {printOpen ? "Đóng xem trước in" : "In sổ bảo dưỡng"}
          </button>
          <RoutesViewSidebarControls />
          <div className="sidebar-field" style={{ marginTop: 10 }}>
            <span className="sidebar-field-label">Chức danh ký (phần ký sổ BD)</span>
            <div className="sonhatky-sign-role-options" role="radiogroup" aria-label="Chức danh ký sổ BD">
              {HAT_SIGN_ROLES.map((opt) => (
                <label key={opt.value} className="sonhatky-sign-role-option">
                  <input
                    type="radio"
                    name="baoduong-hat-sign-role"
                    value={opt.value}
                    checked={chiefRole === opt.value}
                    disabled={readOnly}
                    onChange={() => setChiefRole(opt.value)}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
          <label className="sidebar-field">
            <span className="sidebar-field-label">{chiefRoleLabel} (họ tên)</span>
            <input
              type="text"
              className="sidebar-input"
              value={chiefName}
              onChange={(e) => setChiefName(e.target.value)}
              placeholder={`VD: Nguyễn Văn A`}
              disabled={readOnly}
              aria-label={`Tên ${chiefRoleLabel}`}
            />
          </label>
          <label className="sidebar-field">
            <span className="sidebar-field-label">Số trang bắt đầu</span>
            <input
              className="sidebar-input"
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              placeholder="Trống = không đánh số"
              value={pageStartInput}
              onChange={(e) => setPageStartInput(e.target.value)}
              aria-label="Số trang bắt đầu khi in"
              title="Nhập số tờ đầu tiên. Các tờ sau tự tăng. Để trống thì không in số trang."
            />
          </label>
        </div>

        {printOpen && (
          <div className="sidebar-scroll">
            <div className="print-form-panel">
              <div className="print-form-label">Phạm vi in</div>
              <div className="print-scope-seg" role="tablist" aria-label="Phạm vi in">
                <button
                  type="button"
                  role="tab"
                  aria-selected={printScope === "day"}
                  className={`print-scope-seg__btn${printScope === "day" ? " is-active" : ""}`}
                  onClick={() => setPrintScope("day")}
                >
                  Ngày hiện tại
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={printScope === "range"}
                  className={`print-scope-seg__btn${printScope === "range" ? " is-active" : ""}`}
                  onClick={() => setPrintScope("range")}
                >
                  Khoảng ngày
                </button>
              </div>

              {printScope === "range" && (
                <div className="print-range-card print-range-card--compact">
                  <div className="print-range-fields-row">
                    <label className="print-range-field">
                      <span>Từ ngày</span>
                      <ViDateInput
                        value={rangeFrom}
                        onChange={setRangeFrom}
                        className="sidebar-input sidebar-input--date"
                        aria-label="Từ ngày"
                      />
                    </label>
                    <label className="print-range-field">
                      <span>Đến ngày</span>
                      <ViDateInput
                        value={rangeTo}
                        onChange={setRangeTo}
                        className="sidebar-input sidebar-input--date"
                        aria-label="Đến ngày"
                      />
                    </label>
                  </div>
                  <div
                    className={`print-range-stat${
                      rangeDates.length === 0 ? " print-range-stat--warn" : ""
                    }`}
                  >
                    {rangeDates.length > 0
                      ? `${rangeDates.length} ngày · ${printEntries.length} công việc`
                      : "Khoảng ngày không hợp lệ"}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </aside>

      <SidebarResizer onMouseDown={onResizeStart} />

      <main className="nhaplieu-review-pane">
        {!printOpen ? (
          <div className="sonhatky-screen-preview">
            <div className="nhatky-review">
              {missingTypes.length > 0 && !readOnly && (
                <div className="baoduong-missing no-print">
                  <p className="baoduong-missing-title">
                    Có {missingTypes.length} công tác mới chưa có nhận xét chuẩn. Bổ sung
                    để tự điền vào sổ BDTX:
                  </p>
                  {missingTypes.map((type) => (
                    <div key={type} className="baoduong-missing-row">
                      <span className="baoduong-missing-type">{type}</span>
                      <textarea
                        value={drafts[type]?.method || ""}
                        onChange={(e) => updateDraft(type, "method", e.target.value)}
                        rows={2}
                        placeholder="Tóm tắt biện pháp thực hiện (cột 4)"
                      />
                      <textarea
                        value={drafts[type]?.result || ""}
                        onChange={(e) => updateDraft(type, "result", e.target.value)}
                        rows={2}
                        placeholder="Nhận xét kết quả chủ yếu (cột 5)"
                      />
                      <button
                        type="button"
                        className="btn-primary btn-primary--compact"
                        onClick={() => saveDraft(type)}
                      >
                        Thêm
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="nhatky-review-canvas">
                <BaoDuongSheet
                  execDate={date}
                  entries={data}
                  chiefName={chiefName}
                  signRole={chiefRoleLabel}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="sonhatky-print-preview-pane baoduong-print-preview-pane">
            <div className="sonhatky-print-toolbar print-toolbar no-print">
              <div className="print-toolbar-main">
                <div className="print-toolbar-kicker">Xem trước in</div>
                <div className="print-toolbar-chips">
                  <span className="print-chip">
                    {periodFrom === periodTo
                      ? formatDisplayDate(periodFrom)
                      : `${formatDisplayDate(periodFrom)} → ${formatDisplayDate(periodTo)}`}
                  </span>
                  <span className="print-chip">{printEntries.length} dòng</span>
                  <span className="print-chip">{printPageCount} tờ</span>
                  <span className="print-chip print-chip--muted">
                    Lề {margins.top}/{margins.right}/{margins.bottom}/{margins.left} mm
                  </span>
                </div>
              </div>
              <div className="print-toolbar-actions">
                <button
                  type="button"
                  className="btn-secondary btn-secondary--compact print-toolbar-action"
                  disabled={
                    exportingExcel || (printScope === "range" && rangeDates.length === 0)
                  }
                  onClick={runExportExcel}
                >
                  {exportingExcel ? "Đang xuất…" : "Xuất Excel"}
                </button>
                <button
                  type="button"
                  className="btn-secondary btn-secondary--compact print-toolbar-action"
                  disabled={
                    exportingWord || (printScope === "range" && rangeDates.length === 0)
                  }
                  onClick={() => void runExportWord()}
                >
                  {exportingWord ? "Đang xuất…" : "Xuất Word"}
                </button>
                <button
                  type="button"
                  className="btn-primary btn-primary--compact print-toolbar-action"
                  disabled={printScope === "range" && rangeDates.length === 0}
                  onClick={runPrint}
                  title="In máy in hoặc chọn «Microsoft Print to PDF» / «Save as PDF»"
                >
                  In / PDF
                </button>
              </div>
            </div>
            <BaoDuongPrintPages
              periodFrom={periodFrom}
              periodTo={periodTo}
              entries={printEntries}
              groupByDay={printScope === "range"}
              margins={margins}
              onMarginsChange={setMargins}
              widths={colWidths}
              chiefName={chiefName}
              signRole={chiefRoleLabel}
              pageStart={pageStart}
            />
          </div>
        )}
      </main>
    </div>
  );
}
