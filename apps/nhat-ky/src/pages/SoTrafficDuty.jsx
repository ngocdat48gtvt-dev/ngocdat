import { useEffect, useMemo, useState } from "react";
import TrafficDutySheet from "../components/TrafficDutySheet";
import TrafficDutyPrintPages from "../components/TrafficDutyPrintPages";
import { ViMonthInput } from "../components/ViDateInput";
import {
  loadStorage,
  saveStorage,
  formatYearMonthVN,
  migrateEntry,
  safeSetLocalStorage
} from "../utils/nhatKyFormat";
import {
  filterTrafficDutyEntries,
  trafficDutyEntryField,
  packTrafficDutyPages,
  scrubLegacyTrafficDutyAutoFill
} from "../utils/trafficDutyFormat";
import { printTrafficDutyPages } from "../utils/trafficDutyPrint";
import { exportTrafficDutyExcel } from "../utils/trafficDutyExcel";
import { getTrafficDutyColWidths } from "../hooks/useTrafficDutyColWidths";
import { useRoadWorkspace } from "../context/RoadWorkspaceContext";
import { resolveReportMetaFromRoad } from "../utils/roadsCatalog";
import RoutesViewSidebarControls from "../components/RoutesViewSidebarControls";

import SidebarResizer from "../components/SidebarResizer";
import { useResizableSidebar } from "../hooks/useResizableSidebar";
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
  const { storageKey, activeRoad, filterByRouteView } = useRoadWorkspace();
  const { sidebarStyle, onResizeStart } = useResizableSidebar({ defaultWidth: 280 });
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
  const [exportingExcel, setExportingExcel] = useState(false);

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
    safeSetLocalStorage(MARGIN_KEY, margins);
  }, [margins]);

  useEffect(() => {
    if (printOpen) setColWidths(getTrafficDutyColWidths());
  }, [printOpen]);

  const data = useMemo(
    () => filterByRouteView(filterTrafficDutyEntries(entries, yearMonth)),
    [entries, yearMonth, filterByRouteView]
  );

  const rowItems = useMemo(() => {
    return data.map((entry) => {
      const loc = locateEntryInList(entries, entry);
      return {
        entry,
        globalIndex: loc.globalIndex,
        sourceIndex: loc.sourceIndex
      };
    });
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

  function updateEntry(globalIndex, field, value, sourceIndex = -1) {
    if (readOnly || globalIndex < 0) return;
    setEntries((prev) => {
      const next = [...prev];
      const patch = { [field]: value };
      if (field === "leaderNote") {
        patch.resolved = "";
      }
      const parent = next[globalIndex];
      if (
        sourceIndex >= 0 &&
        Array.isArray(parent?.mergedSources) &&
        parent.mergedSources[sourceIndex]
      ) {
        const sources = parent.mergedSources.map((s, j) =>
          j === sourceIndex ? { ...s, ...patch } : s
        );
        next[globalIndex] = { ...parent, mergedSources: sources };
      } else {
        next[globalIndex] = { ...parent, ...patch };
      }
      return next;
    });
    markDirty();
  }

  function handleApplySameDay(globalIndex, field, value, sourceIndex = -1) {
    if (readOnly) return;
    const parent = entries[globalIndex];
    const sourceDate =
      sourceIndex >= 0 && parent?.mergedSources?.[sourceIndex]
        ? parent.mergedSources[sourceIndex].date
        : parent?.date;
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

    const targets = rowItems.filter((item) => item.entry.date === sourceDate);

    setEntries((prev) => {
      let next = prev;
      for (const item of targets) {
        if (item.globalIndex < 0) continue;
        const patch = {
          [entryField]: value,
          ...(entryField === "leaderNote" ? { resolved: "" } : {})
        };
        next = next.map((entry, idx) => {
          if (idx !== item.globalIndex) return entry;
          if (
            item.sourceIndex >= 0 &&
            Array.isArray(entry?.mergedSources) &&
            entry.mergedSources[item.sourceIndex]
          ) {
            const sources = entry.mergedSources.map((s, j) =>
              j === item.sourceIndex ? { ...s, ...patch } : s
            );
            return { ...entry, mergedSources: sources };
          }
          return { ...entry, ...patch };
        });
      }
      return next;
    });
    markDirty();
  }

  function handleCellChange(globalIndex, field, value, sourceIndex = -1) {
    if (readOnly) return;
    if (field === "reportRecipient") {
      const parent = entries[globalIndex];
      const date =
        sourceIndex >= 0 && parent?.mergedSources?.[sourceIndex]
          ? parent.mergedSources[sourceIndex].date
          : parent?.date;
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
    updateEntry(globalIndex, entryField, value, sourceIndex);
  }

  function handleSave() {
    if (readOnly) return;
    saveStorage(entries, dayMetaMap, reportMeta, storageKey);
    setDirty(false);
    setSaveMessage("Đã lưu.");
    setTimeout(() => setSaveMessage(""), 3500);
  }

  /** Sidebar: đổ «Người trực» vào mọi dòng có dữ liệu của tháng đang xem. */
  function applyMonthDutyPerson(name) {
    if (readOnly) return;
    const value = String(name || "");
    setReportMeta((prev) => ({ ...prev, trafficDutyPerson: value }));
    const targets = rowItems.filter(
      (item) => Number.isInteger(item.globalIndex) && item.globalIndex >= 0
    );
    if (targets.length) {
      setEntries((prev) => {
        let next = prev;
        for (const item of targets) {
          next = next.map((entry, idx) => {
            if (idx !== item.globalIndex) return entry;
            if (
              item.sourceIndex >= 0 &&
              Array.isArray(entry?.mergedSources) &&
              entry.mergedSources[item.sourceIndex]
            ) {
              const sources = entry.mergedSources.map((s, j) =>
                j === item.sourceIndex ? { ...s, dutyPerson: value } : s
              );
              return { ...entry, mergedSources: sources };
            }
            return { ...entry, dutyPerson: value };
          });
        }
        return next;
      });
    }
    markDirty();
  }

  /** Sidebar: đổ «Người nhận báo cáo» vào mọi ngày có dữ liệu trong tháng. */
  function applyMonthReportRecipient(name) {
    if (readOnly) return;
    const value = String(name || "");
    setReportMeta((prev) => ({ ...prev, trafficDutyLeaderSign: value }));
    const dates = new Set(
      rowItems.map((item) => item.entry?.date).filter(Boolean)
    );
    if (dates.size) {
      setDayMetaMap((prev) => {
        const next = { ...prev };
        dates.forEach((d) => {
          next[d] = { ...(next[d] || {}), leaderSign: value };
        });
        return next;
      });
    }
    markDirty();
  }

  async function handleExportExcel() {
    if (exportingExcel) return;
    setExportingExcel(true);
    try {
      const { filename } = await exportTrafficDutyExcel({
        yearMonth,
        reportMeta,
        entries: data,
        dayMetaMap,
        margins,
        widths: colWidths
      });
      setSaveMessage(`Đã xuất ${filename}`);
      setTimeout(() => setSaveMessage(""), 4000);
    } catch (err) {
      console.error(err);
      window.alert(err?.message || "Không xuất được Excel. Thử lại.");
    } finally {
      setExportingExcel(false);
    }
  }

  return (
    <div
      className={`nhaplieu-workspace sonhatky-workspace${
        printOpen ? " sotrafficduty-workspace--print" : ""
      }`}
    >
      <aside
        className="nhaplieu-sidebar sonhatky-sidebar traffic-duty-sidebar no-print"
        style={sidebarStyle}
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

          {!readOnly && (
            <div className="traffic-duty-month-names">
              <div className="print-form-label">Người trực / Người nhận BC (tháng này)</div>
              <label className="sidebar-field">
                <span className="sidebar-field-label">Người trực</span>
                <input
                  type="text"
                  className="sidebar-input"
                  value={reportMeta?.trafficDutyPerson || ""}
                  placeholder="VD: Nguyễn Văn A"
                  onChange={(e) => applyMonthDutyPerson(e.target.value)}
                />
              </label>
              <label className="sidebar-field">
                <span className="sidebar-field-label">Người nhận báo cáo</span>
                <input
                  type="text"
                  className="sidebar-input"
                  value={reportMeta?.trafficDutyLeaderSign || ""}
                  placeholder="VD: Trần Văn B"
                  onChange={(e) => applyMonthReportRecipient(e.target.value)}
                />
              </label>
              <p className="traffic-duty-month-names-hint">
                Điền tên → tự điền vào mọi dòng có dữ liệu của tháng đang xem. Có thể sửa từng ô trên bảng.
              </p>
            </div>
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
          <RoutesViewSidebarControls />
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

      <SidebarResizer onMouseDown={onResizeStart} />

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
              <div className="print-toolbar-actions">
                <button
                  type="button"
                  className="btn-secondary btn-primary--compact print-toolbar-action"
                  disabled={exportingExcel}
                  onClick={() => void handleExportExcel()}
                >
                  {exportingExcel ? "Đang xuất…" : "Xuất Excel"}
                </button>
                <button
                  type="button"
                  className="btn-primary btn-primary--compact print-toolbar-action"
                  onClick={() => printTrafficDutyPages(margins, colWidths)}
                >
                  In tháng này
                </button>
              </div>
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

/** Tìm vị trí bản ghi (kể cả trong mergedSources khi đã gộp trên sổ tuần đường). */
function locateEntryInList(entries, target) {
  for (let i = 0; i < (entries || []).length; i += 1) {
    const e = entries[i];
    if (Array.isArray(e?.mergedSources) && e.mergedSources.length >= 2) {
      for (let j = 0; j < e.mergedSources.length; j += 1) {
        if (entryMatches(e.mergedSources[j], target)) {
          return { globalIndex: i, sourceIndex: j };
        }
      }
    }
    if (entryMatches(e, target)) {
      return { globalIndex: i, sourceIndex: -1 };
    }
  }
  return { globalIndex: -1, sourceIndex: -1 };
}
