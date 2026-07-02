import { useEffect, useMemo, useState } from "react";
import TrafficDutySheet from "../components/TrafficDutySheet";
import { ViMonthInput } from "../components/ViDateInput";
import {
  loadStorage,
  saveStorage,
  EMPTY_REPORT_META,
  formatYearMonthVN,
  migrateEntry
} from "../utils/nhatKyFormat";
import { filterTrafficDutyEntries, trafficDutyEntryField } from "../utils/trafficDutyFormat";
import { useRoadWorkspace } from "../context/RoadWorkspaceContext";

const SIDEBAR_WIDTH = 260;

export default function SoTrafficDuty({ onGoEdit, storageTick = 0 }) {
  const { storageKey } = useRoadWorkspace();
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [yearMonth, setYearMonth] = useState(defaultMonth);
  const [dirty, setDirty] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  const initial = loadStorage(storageKey);
  const [entries, setEntries] = useState(() => initial.entries.map(migrateEntry));
  const [dayMetaMap, setDayMetaMap] = useState(initial.dayMeta || {});
  const [reportMeta, setReportMeta] = useState(() => ({
    ...EMPTY_REPORT_META,
    ...(initial.reportMeta || {})
  }));

  useEffect(() => {
    if (!storageTick) return;
    if (dirty) return;
    const stored = loadStorage(storageKey);
    setEntries(stored.entries.map(migrateEntry));
    setDayMetaMap(stored.dayMeta || {});
    setReportMeta({ ...EMPTY_REPORT_META, ...(stored.reportMeta || {}) });
    setDirty(false);
    setSaveMessage("Đã đồng bộ khối lượng từ App hiện trường.");
    const t = setTimeout(() => setSaveMessage(""), 3000);
    return () => clearTimeout(t);
  }, [storageTick, storageKey, dirty]);

  const data = filterTrafficDutyEntries(entries, yearMonth);

  const rowItems = useMemo(() => {
    return data.map((entry) => ({
      entry,
      globalIndex: entries.findIndex((e) => entryMatches(e, entry))
    }));
  }, [data, entries]);

  function shiftMonth(delta) {
    const [y, m] = yearMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setYearMonth(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    );
  }

  function markDirty() {
    setDirty(true);
    setSaveMessage("");
  }

  function updateEntry(globalIndex, field, value) {
    if (globalIndex < 0) return;
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
          ? { ...entry, [entryField]: value, ...(entryField === "leaderNote" ? { resolved: "" } : {}) }
          : entry
      )
    );
    markDirty();
  }

  function handleCellChange(globalIndex, field, value) {
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
    saveStorage(entries, dayMetaMap, reportMeta, storageKey);
    setDirty(false);
    setSaveMessage("Đã lưu.");
    setTimeout(() => setSaveMessage(""), 3500);
  }

  return (
    <div className="nhaplieu-workspace sonhatky-workspace">
      <aside
        className="nhaplieu-sidebar sonhatky-sidebar traffic-duty-sidebar"
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
            <p className="traffic-duty-save-msg traffic-duty-save-msg--warn">Có thay đổi chưa lưu</p>
          )}

          <button type="button" className="btn-primary sonhatky-edit-btn" onClick={onGoEdit}>
            Thêm sự cố (Nhập liệu)
          </button>
        </div>
      </aside>

      <main className="nhaplieu-review-pane">
        <div className="nhatky-review">
          <div className="nhatky-review-canvas nhatky-review-canvas--traffic-duty">
            <TrafficDutySheet
              yearMonth={yearMonth}
              reportMeta={reportMeta}
              rowItems={rowItems}
              dayMetaMap={dayMetaMap}
              onCellChange={handleCellChange}
              onApplySameDay={handleApplySameDay}
            />
          </div>
        </div>
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
