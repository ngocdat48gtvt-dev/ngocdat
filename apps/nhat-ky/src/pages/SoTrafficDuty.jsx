import { useEffect, useMemo, useState } from "react";
import TrafficDutySheet from "../components/TrafficDutySheet";
import TrafficDutyPrintPages from "../components/TrafficDutyPrintPages";
import { ViMonthInput } from "../components/ViDateInput";
import {
  loadStorage,
  saveStorage,
  formatYearMonthVN,
  migrateEntry
} from "../utils/nhatKyFormat";
import {
  filterTrafficDutyEntries,
  trafficDutyEntryField,
  packTrafficDutyPages,
  scrubLegacyTrafficDutyAutoFill
} from "../utils/trafficDutyFormat";
import { printTrafficDutyPages } from "../utils/trafficDutyPrint";
import { getTrafficDutyColWidths } from "../hooks/useTrafficDutyColWidths";
import { useRoadWorkspace } from "../context/RoadWorkspaceContext";
import { resolveReportMetaFromRoad } from "../utils/roadsCatalog";

const SIDEBAR_WIDTH = 280;
const MARGIN_KEY = "traffic-duty-print-margins-v1";
const DEFAULT_MARGINS = { top: 8, right: 10, bottom: 8, left: 10 };

function clampMm(v, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(40, Math.max(0, Math.round(n * 10) / 10));
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

export default function SoTrafficDuty({ onGoEdit, storageTick = 0, readOnly = false }) {
  const { storageKey, activeRoad } = useRoadWorkspace();
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [yearMonth, setYearMonth] = useState(defaultMonth);
  const [dirty, setDirty] = useState(() => {
    if (readOnly) return false;
    return loadStorage(storageKey).entries.some((e) => {
      const raw = migrateEntry(e);
      const scrubbed = scrubLegacyTrafficDutyAutoFill(raw);
      return (
        scrubbed.dutyPerson !== raw.dutyPerson ||
        scrubbed.trafficRestoredAt !== raw.trafficRestoredAt
      );
    });
  });
  const [saveMessage, setSaveMessage] = useState("");
  const [printOpen, setPrintOpen] = useState(false);
  const [margins, setMargins] = useState(loadMargins);
  const [colWidths, setColWidths] = useState(getTrafficDutyColWidths);

  const initial = loadStorage(storageKey);
  const [entries, setEntries] = useState(() =>
    initial.entries.map(migrateEntry).map(scrubLegacyTrafficDutyAutoFill)
  );
  const [dayMetaMap, setDayMetaMap] = useState(initial.dayMeta || {});
  const [reportMeta, setReportMeta] = useState(() =>
    resolveReportMetaFromRoad(initial.reportMeta, activeRoad)
  );

  useEffect(() => {
    if (!storageTick) return;
    if (dirty) return;
    const stored = loadStorage(storageKey);
    setEntries(stored.entries.map(migrateEntry).map(scrubLegacyTrafficDutyAutoFill));
    setDayMetaMap(stored.dayMeta || {});
    setReportMeta(resolveReportMetaFromRoad(stored.reportMeta, activeRoad));
    setDirty(false);
    setSaveMessage("Đã đồng bộ khối lượng từ App hiện trường.");
    const t = setTimeout(() => setSaveMessage(""), 3000);
    return () => clearTimeout(t);
  }, [storageTick, storageKey, dirty, activeRoad]);

  useEffect(() => {
    setReportMeta((prev) => resolveReportMetaFromRoad(prev, activeRoad));
  }, [
    activeRoad?.id,
    activeRoad?.company,
    activeRoad?.hat,
    activeRoad?.roadName,
    activeRoad?.label,
    activeRoad?.kmRange
  ]);

  useEffect(() => {
    localStorage.setItem(MARGIN_KEY, JSON.stringify(margins));
  }, [margins]);

  useEffect(() => {
    if (printOpen) setColWidths(getTrafficDutyColWidths());
  }, [printOpen]);

  const data = filterTrafficDutyEntries(entries, yearMonth);

  const rowItems = useMemo(() => {
    return data.map((entry) => ({
      entry,
      globalIndex: entries.findIndex((e) => entryMatches(e, entry))
    }));
  }, [data, entries]);

  const printPageCount = useMemo(
    () => packTrafficDutyPages(data, margins, dayMetaMap, reportMeta).length,
    [data, margins, dayMetaMap, reportMeta]
  );

  function shiftMonth(delta) {
    const [y, m] = yearMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setYearMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  function markDirty() {
    if (readOnly) return;
    setDirty(true);
    setSaveMessage("");
  }

  function updateEntry(globalIndex, field, value) {
    if (readOnly || globalIndex < 0) return;
    setEntries((prev) => {
      const next = [...prev];
      const patch = { [field]: value };
      if (field === "leaderNote") {
        patch.resolved = "";
      }
      next[globalIndex] = { ...next[globalIndex], ...patch };
      return next;
    });
    markDirty();
  }

  function handleApplySameDay(globalIndex, field, value) {
    if (readOnly) return;
    const sourceDate = entries[globalIndex]?.date;
    if (!sourceDate || !String(value || "").trim()) return;

    if (field === "reportRecipient") {
      setDayMetaMap((prev) => ({
        ...prev,
        [sourceDate]: { ...(prev[sourceDate] || {}), leaderSign: value }
      }));
      markDirty();
      return;
    }

    const entryField = trafficDutyEntryField(field);
    if (!entryField) return;

    const indicesOnDay = new Set(
      rowItems
        .filter((item) => item.entry.date === sourceDate)
        .map((item) => item.globalIndex)
    );

    setEntries((prev) =>
      prev.map((entry, idx) =>
        indicesOnDay.has(idx)
          ? {
              ...entry,
              [entryField]: value,
              ...(entryField === "leaderNote" ? { resolved: "" } : {})
            }
          : entry
      )
    );
    markDirty();
  }

  function handleCellChange(globalIndex, field, value) {
    if (readOnly) return;
    if (field === "reportRecipient") {
      const date = entries[globalIndex]?.date;
      if (!date) return;
      setDayMetaMap((prev) => ({
        ...prev,
        [date]: { ...(prev[date] || {}), leaderSign: value }
      }));
      markDirty();
      return;
    }

    const entryField = trafficDutyEntryField(field);
    if (!entryField) return;
    updateEntry(globalIndex, entryField, value);
  }

  function handleSave() {
    if (readOnly) return;
    saveStorage(entries, dayMetaMap, reportMeta, storageKey);
    setDirty(false);
    setSaveMessage("Đã lưu.");
    setTimeout(() => setSaveMessage(""), 3500);
  }

  return (
    <div
      className={`nhaplieu-workspace sonhatky-workspace${
        printOpen ? " sotrafficduty-workspace--print" : ""
      }`}
    >
      <aside
        className="nhaplieu-sidebar sonhatky-sidebar traffic-duty-sidebar no-print"
        style={{
          width: SIDEBAR_WIDTH,
          minWidth: SIDEBAR_WIDTH,
          maxWidth: SIDEBAR_WIDTH
        }}
      >
        <div className="sidebar-sticky-head">
          <h2 className="sidebar-title">Sổ trực ĐBGT</h2>
          <div className="sonhatky-date-toolbar">
            <div className="sonhatky-day-buttons">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                className="btn-primary btn-primary--compact sonhatky-nav-btn"
                title="Tháng trước"
              >
                ◀
              </button>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                className="btn-primary btn-primary--compact sonhatky-nav-btn"
                title="Tháng sau"
              >
                ▶
              </button>
            </div>
            <ViMonthInput
              value={yearMonth}
              onChange={setYearMonth}
              className="sidebar-input sidebar-input--date"
              aria-label="Chọn tháng"
            />
          </div>
          <p className="sonhatky-day-summary">
            {formatYearMonthVN(yearMonth)}
            {data.length > 0
              ? ` · ${data.length} thiệt hại bão lũ`
              : " · Chưa có dòng"}
          </p>

          {!printOpen && !readOnly && (
            <>
              <div className="traffic-duty-toolbar">
                <button
                  type="button"
                  className="btn-primary btn-primary--compact"
                  onClick={handleSave}
                  disabled={!dirty}
                >
                  Lưu
                </button>
              </div>
              {saveMessage && <p className="traffic-duty-save-msg">{saveMessage}</p>}
              {dirty && !saveMessage && (
                <p className="traffic-duty-save-msg traffic-duty-save-msg--warn">
                  Có thay đổi chưa lưu
                </p>
              )}
            </>
          )}

          {readOnly && (
            <p className="traffic-duty-save-msg">Chế độ chỉ xem — không nhập liệu / sửa sổ.</p>
          )}

          {onGoEdit && !readOnly && (
            <button type="button" className="btn-primary sonhatky-edit-btn" onClick={onGoEdit}>
              Thêm sự cố (Nhập liệu)
            </button>
          )}
          <button
            type="button"
            className={`btn-secondary sonhatky-edit-btn sonhatky-edit-btn--sub${
              printOpen ? " active" : ""
            }`}
            onClick={() => setPrintOpen((v) => !v)}
          >
            {printOpen ? "Đóng xem trước in" : "In sổ trực ĐBGT"}
          </button>
        </div>

        {printOpen && (
          <div className="sidebar-scroll">
            <div className="print-form-panel">
              <div className="print-form-label">In sổ trực ĐBGT</div>
              <ul className="print-form-tips">
                <li>Khổ A4 ngang (297 × 210 mm)</li>
                <li>Kéo lề xanh trên tờ đầu bằng chuột</li>
                <li>Bề rộng cột theo chỉnh trên sổ</li>
                <li>Mỗi tờ preview = đúng 1 trang in</li>
              </ul>
            </div>
          </div>
        )}
      </aside>

      <main className="nhaplieu-review-pane">
        {!printOpen ? (
          <div className="sonhatky-screen-preview">
            <div className="nhatky-review">
              <div className="nhatky-review-canvas nhatky-review-canvas--traffic-duty">
                <TrafficDutySheet
                  yearMonth={yearMonth}
                  reportMeta={reportMeta}
                  rowItems={rowItems}
                  dayMetaMap={dayMetaMap}
                  onCellChange={readOnly ? undefined : handleCellChange}
                  onApplySameDay={readOnly ? undefined : handleApplySameDay}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="sonhatky-print-preview-pane landscape-print-preview-pane">
            <div className="sonhatky-print-toolbar print-toolbar no-print">
              <div className="print-toolbar-main">
                <div className="print-toolbar-kicker">Xem trước in · A4 ngang</div>
                <div className="print-toolbar-chips">
                  <span className="print-chip">{formatYearMonthVN(yearMonth)}</span>
                  <span className="print-chip">{data.length} dòng</span>
                  <span className="print-chip">{printPageCount} tờ</span>
                  <span className="print-chip print-chip--muted">
                    Lề {margins.top}/{margins.right}/{margins.bottom}/{margins.left} mm
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="btn-primary btn-primary--compact print-toolbar-action"
                onClick={() => printTrafficDutyPages(margins, colWidths)}
              >
                In tháng này
              </button>
            </div>
            <TrafficDutyPrintPages
              yearMonth={yearMonth}
              reportMeta={reportMeta}
              entries={data}
              dayMetaMap={dayMetaMap}
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

function entryMatches(a, b) {
  if (a.sourceIncidentId && b.sourceIncidentId) {
    return a.sourceIncidentId === b.sourceIncidentId;
  }
  return (
    a.date === b.date &&
    a.kmFrom === b.kmFrom &&
    a.kmTo === b.kmTo &&
    a.type === b.type &&
    a.section === b.section
  );
}
