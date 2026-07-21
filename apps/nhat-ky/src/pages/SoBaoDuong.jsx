import { useEffect, useMemo, useState } from "react";
import BaoDuongSheet from "../components/BaoDuongSheet";
import BaoDuongPrintPages from "../components/BaoDuongPrintPages";
import ViDateInput from "../components/ViDateInput";
import { loadStorage, formatDisplayDate } from "../utils/nhatKyFormat";
import {
  filterBaoDuongEntries,
  filterBaoDuongEntriesInRange,
  groupBaoDuongEntriesByExecDay,
  collectBaoDuongWorkTypes,
  isBaoDuongSection,
  BAO_DUONG_MAX_DAYS,
  packBaoDuongPages
} from "../utils/baoDuongFormat";
import {
  BAO_DUONG_QUALITY_EVENT,
  hasQualityForType,
  upsertQualityTypes,
  DEFAULT_QUALITY_FALLBACK
} from "../utils/baoDuongQualityStore";
import { eachIsoDateInclusive } from "../utils/nhatKyPrintRows";
import { printBaoDuongPages } from "../utils/baoDuongPrint";
import { getBaoDuongColWidths } from "../hooks/useBaoDuongColWidths";
import { useRoadWorkspace } from "../context/RoadWorkspaceContext";

const SIDEBAR_WIDTH = 300;
const MARGIN_KEY = "baoduong-print-margins-v1";
const DEFAULT_MARGINS = { top: 12, right: 12, bottom: 12, left: 14 };

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
  const { storageKey } = useRoadWorkspace();
  const [catalogTick, setCatalogTick] = useState(0);
  const [drafts, setDrafts] = useState({});
  const [printOpen, setPrintOpen] = useState(false);
  const [printScope, setPrintScope] = useState("day");
  const [rangeFrom, setRangeFrom] = useState(date);
  const [rangeTo, setRangeTo] = useState(date);
  const [margins, setMargins] = useState(loadMargins);
  const [colWidths, setColWidths] = useState(getBaoDuongColWidths);

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
    localStorage.setItem(MARGIN_KEY, JSON.stringify(margins));
  }, [margins]);

  useEffect(() => {
    if (printOpen) setColWidths(getBaoDuongColWidths());
  }, [printOpen]);

  const data = useMemo(
    () => filterBaoDuongEntries(entries, date),
    [entries, date, catalogTick]
  );

  const rangeDates = useMemo(
    () => eachIsoDateInclusive(rangeFrom, rangeTo),
    [rangeFrom, rangeTo]
  );

  const printEntries = useMemo(() => {
    if (printScope === "range" && rangeDates.length) {
      return filterBaoDuongEntriesInRange(entries, rangeFrom, rangeTo);
    }
    return filterBaoDuongEntries(entries, date);
  }, [printScope, rangeDates, entries, rangeFrom, rangeTo, date, catalogTick]);

  const periodFrom = printScope === "range" ? rangeFrom : date;
  const periodTo = printScope === "range" ? rangeTo : date;

  const printPageCount = useMemo(() => {
    if (printScope === "range") {
      const groups = groupBaoDuongEntriesByExecDay(printEntries);
      if (!groups.length) return 1;
      return groups.reduce(
        (n, g) => n + packBaoDuongPages(g.entries, margins).length,
        0
      );
    }
    return packBaoDuongPages(printEntries, margins).length;
  }, [printScope, printEntries, margins]);

  const missingTypes = useMemo(
    () => collectBaoDuongWorkTypes(entries).filter((t) => !hasQualityForType(t)),
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
    printBaoDuongPages(margins, colWidths);
  }

  return (
    <div
      className={`nhaplieu-workspace sonhatky-workspace${
        printOpen ? " sobaoduong-workspace--print" : ""
      }`}
    >
      <aside
        className="nhaplieu-sidebar sonhatky-sidebar no-print"
        style={{
          width: SIDEBAR_WIDTH,
          minWidth: SIDEBAR_WIDTH,
          maxWidth: SIDEBAR_WIDTH
        }}
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
                      ? `${rangeDates.length} ngày · ${printEntries.length} công việc`
                      : "Khoảng ngày không hợp lệ"}
                  </div>
                </div>
              )}

              <ul className="print-form-tips">
                <li>Khổ A4 dọc</li>
                <li>Kéo lề xanh trên tờ đầu</li>
                <li>Khoảng ngày: mỗi ngày thực hiện ≥ 1 tờ</li>
              </ul>
            </div>
          </div>
        )}

        {!printOpen && (
          <div className="sidebar-scroll">
            <p className="sidebar-subtitle" style={{ padding: "0 16px 12px" }}>
              Tồn tại phát hiện ở sổ tuần đường phải được xử lý xong và ghi vào sổ BDTX
              trong vòng {BAO_DUONG_MAX_DAYS} ngày. Bảng lấy theo ngày dự kiến sửa chữa.
            </p>
          </div>
        )}
      </aside>

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
                <BaoDuongSheet execDate={date} entries={data} />
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
              <button
                type="button"
                className="btn-primary btn-primary--compact print-toolbar-action"
                disabled={printScope === "range" && rangeDates.length === 0}
                onClick={runPrint}
              >
                In sổ
              </button>
            </div>
            <BaoDuongPrintPages
              periodFrom={periodFrom}
              periodTo={periodTo}
              entries={printEntries}
              groupByDay={printScope === "range"}
              margins={margins}
              onMarginsChange={setMargins}
              widths={colWidths}
            />
          </div>
        )}
      </main>
    </div>
  );
}
