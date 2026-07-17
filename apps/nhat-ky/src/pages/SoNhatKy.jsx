import { useEffect, useMemo, useState } from "react";
import NhatKyReview from "../components/NhatKyReview";
import NhatKyPrintDay from "../components/NhatKyPrintDay";
import ViDateInput from "../components/ViDateInput";
import {
  loadStorage,
  formatDisplayDate,
  getDayMeta,
  migrateEntry
} from "../utils/nhatKyFormat";
import {
  eachIsoDateInclusive,
  entriesForDate,
  dayMetaForDate
} from "../utils/nhatKyPrintRows";
import { printNhatKyPages } from "../utils/nhatKyPrint";
import { getNhatKyColWidths } from "../hooks/useColumnWidths";
import { useRoadWorkspace } from "../context/RoadWorkspaceContext";

const SIDEBAR_WIDTH = 320;
const MARGIN_KEY = "nhatky-print-margins-v1";
const DEFAULT_MARGINS = { top: 8, right: 8, bottom: 8, left: 8 };

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

export default function SoNhatKy({ date, onDateChange, onGoEdit, storageTick = 0 }) {
  const { storageKey } = useRoadWorkspace();
  const { entries, dayMeta } = useMemo(
    () => loadStorage(storageKey),
    [storageKey, storageTick]
  );
  const data = entries.map(migrateEntry).filter((x) => x.date === date);
  const meta = getDayMeta(dayMeta, date);
  const entryCount = data.length;

  const [margins, setMargins] = useState(loadMargins);
  const [rangeFrom, setRangeFrom] = useState(date);
  const [rangeTo, setRangeTo] = useState(date);
  const [printOpen, setPrintOpen] = useState(false);
  const [printScope, setPrintScope] = useState("day");
  const [colWidths, setColWidths] = useState(getNhatKyColWidths);

  useEffect(() => {
    setRangeFrom(date);
    setRangeTo(date);
  }, [date]);

  useEffect(() => {
    localStorage.setItem(MARGIN_KEY, JSON.stringify(margins));
  }, [margins]);

  // Mỗi lần mở xem trước in → đọc lại bề rộng cột từ trang nhập liệu
  useEffect(() => {
    if (printOpen) setColWidths(getNhatKyColWidths());
  }, [printOpen]);

  const rangeDates = useMemo(
    () => eachIsoDateInclusive(rangeFrom, rangeTo),
    [rangeFrom, rangeTo]
  );

  const previewDates = useMemo(() => {
    if (printScope === "range" && rangeDates.length) return rangeDates;
    return [date];
  }, [printScope, rangeDates, date]);

  function shiftDay(delta) {
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() + delta);
    onDateChange(d.toISOString().split("T")[0]);
  }

  function runPrint() {
    // In qua iframe: mỗi tờ preview = đúng 1 trang A4 (khớp số trang preview).
    printNhatKyPages(margins);
  }

  return (
    <div className={`nhaplieu-workspace sonhatky-workspace${printOpen ? " sonhatky-workspace--print" : ""}`}>
      <aside
        className="nhaplieu-sidebar sonhatky-sidebar no-print"
        style={{
          width: SIDEBAR_WIDTH,
          minWidth: SIDEBAR_WIDTH,
          maxWidth: SIDEBAR_WIDTH
        }}
      >
        <div className="sidebar-sticky-head">
          <h2 className="sidebar-title">Sổ nhật ký</h2>
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
            {entryCount > 0
              ? ` · ${entryCount} ghi chép`
              : " · Chưa có ghi chép"}
          </p>
          <button type="button" className="btn-primary sonhatky-edit-btn" onClick={onGoEdit}>
            Chỉnh sửa ngày này
          </button>
          <button
            type="button"
            className={`btn-secondary sonhatky-edit-btn sonhatky-edit-btn--sub${printOpen ? " active" : ""}`}
            onClick={() => setPrintOpen((v) => !v)}
          >
            {printOpen ? "Đóng xem trước in" : "In sổ nhật ký"}
          </button>
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
                <div className="print-range-card">
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
                  <div
                    className={`print-range-stat${
                      rangeDates.length === 0 ? " print-range-stat--warn" : ""
                    }`}
                  >
                    {rangeDates.length > 0
                      ? `${rangeDates.length} ngày trong khoảng`
                      : "Khoảng ngày không hợp lệ"}
                  </div>
                </div>
              )}

              <ul className="print-form-tips">
                <li>A4 dọc · 2 tờ ghép như A3</li>
                <li>Kéo lề xanh trên tờ đầu</li>
                <li>Bề rộng cột theo trang nhập liệu</li>
              </ul>
            </div>
          </div>
        )}
      </aside>

      <main className="nhaplieu-review-pane">
        {!printOpen ? (
          <div className="sonhatky-screen-preview">
            <NhatKyReview date={date} items={data} dayMeta={meta} alwaysShow />
          </div>
        ) : (
          <div className="sonhatky-print-preview-pane">
            <div className="sonhatky-print-toolbar print-toolbar no-print">
              <div className="print-toolbar-main">
                <div className="print-toolbar-kicker">Xem trước in</div>
                <div className="print-toolbar-chips">
                  <span className="print-chip">
                    {printScope === "day"
                      ? formatDisplayDate(date)
                      : `${formatDisplayDate(rangeFrom)} → ${formatDisplayDate(rangeTo)}`}
                  </span>
                  {printScope === "range" ? (
                    <span className="print-chip">{previewDates.length} ngày</span>
                  ) : null}
                  <span className="print-chip print-chip--muted">
                    Lề {margins.top}/{margins.right}/{margins.bottom}/{margins.left} mm
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="btn-primary btn-primary--compact print-toolbar-action"
                disabled={previewDates.length === 0}
                onClick={runPrint}
              >
                In {previewDates.length > 1 ? `${previewDates.length} ngày` : "ngày này"}
              </button>
            </div>

            <div className="nhatky-print-stack nhatky-print-stack--preview">
              {previewDates.map((d) => (
                <NhatKyPrintDay
                  key={d}
                  date={d}
                  items={entriesForDate(entries, d)}
                  dayMeta={dayMetaForDate(dayMeta, d)}
                  margins={margins}
                  onMarginsChange={setMargins}
                  widths={colWidths}
                />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
