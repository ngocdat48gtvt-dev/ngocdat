import { useMemo, useState, useEffect } from "react";
import DemXeCoverSheet from "../components/DemXeCoverSheet";
import DemXeGuidePanel from "../components/DemXeGuidePanel";
import DemXeEntryForm from "../components/DemXeEntryForm";
import DemXeCountSheet from "../components/DemXeCountSheet";
import DemXeSummarySheet from "../components/DemXeSummarySheet";
import ViDateInput from "../components/ViDateInput";
import { useAuth } from "../context/AuthContext";
import { useRoadWorkspace } from "../context/RoadWorkspaceContext";
import { useDemXeSync } from "../hooks/useDemXeSync";
import { downloadDemXeWord } from "../lib/demXeWordBuilder";
import { listActiveDates } from "../utils/demXeCompute";
import {
  makeEmptyDirection
} from "../utils/demXeStore";
import {
  DIRECTION_DI,
  DIRECTION_VE
} from "../utils/demXeConstants";
import { formatDisplayDate } from "../utils/nhatKyFormat";

const SIDEBAR_WIDTH = 260;
const TABS = [
  { key: "cover", label: "Bìa sổ" },
  { key: "guide", label: "Hướng dẫn" },
  { key: "entry", label: "Nhập liệu" },
  { key: "summary", label: "Tổng hợp" }
];

function todayIso() {
  return new Date().toISOString().split("T")[0];
}

function applyPrintMode(mode, { selectedDate, selectedDirId, dates }) {
  document.body.classList.remove(
    "demxe-print-cover",
    "demxe-print-guide",
    "demxe-print-summary",
    "demxe-print-all",
    "demxe-print-day"
  );
  document.querySelectorAll(".demxe-print-section").forEach((el) => {
    el.classList.remove("demxe-print-hidden");
  });
  document.querySelectorAll("[data-print-date]").forEach((el) => {
    el.classList.remove("demxe-print-hidden");
  });

  if (mode === "cover") {
    document.body.classList.add("demxe-print-cover");
    return;
  }
  if (mode === "guide") {
    document.body.classList.add("demxe-print-guide");
    return;
  }
  if (mode === "summary") {
    document.body.classList.add("demxe-print-summary");
    return;
  }
  if (mode === "day" && selectedDate) {
    document.body.classList.add("demxe-print-day");
    document.querySelectorAll("[data-print-date]").forEach((el) => {
      if (el.getAttribute("data-print-date") !== selectedDate) {
        el.classList.add("demxe-print-hidden");
      }
    });
    return;
  }
  if (mode === "all") {
    document.body.classList.add("demxe-print-all");
    return;
  }
}

export default function SoDemXe() {
  const { profile } = useAuth();
  const { activeRoad, activeRoadId, storageKey } = useRoadWorkspace();
  const roadName = (activeRoad?.roadName || activeRoad?.label || "").trim();
  const uid = profile?.uid || "";

  const { ledger, setLedger, ready } = useDemXeSync({
    uid,
    roadId: activeRoadId,
    roadName,
    activeRoad,
    storageKey,
    enabled: !!activeRoadId
  });

  const [tab, setTab] = useState("entry");
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [selectedDirId, setSelectedDirId] = useState("");
  const [newDateInput, setNewDateInput] = useState(todayIso());
  const [message, setMessage] = useState("");
  const [exporting, setExporting] = useState(false);

  const dates = useMemo(() => listActiveDates(ledger?.days || {}), [ledger]);
  const allDayKeys = useMemo(
    () => Object.keys(ledger?.days || {}).sort(),
    [ledger]
  );

  const directions = ledger?.days?.[selectedDate]?.directions || [];
  const selectedDir =
    directions.find((d) => d.id === selectedDirId) || directions[0] || null;

  useEffect(() => {
    const dirs = ledger?.days?.[selectedDate]?.directions || [];
    if (!dirs.length) {
      setSelectedDirId("");
      return;
    }
    if (!dirs.some((d) => d.id === selectedDirId)) {
      setSelectedDirId(dirs[0].id);
    }
  }, [selectedDate, ledger?.days, selectedDirId]);

  function directionSeed() {
    return {
      roadName: ledger.cover?.tenDuong || "",
      lyTrinh: "",
      from: "",
      to: ""
    };
  }

  function addDayWithDirections(dateIso, directionTypes = [DIRECTION_DI]) {
    setLedger((prev) => {
      const existing = prev.days[dateIso];
      if (existing?.directions?.length) return prev;
      const seed = {
        roadName: prev.cover?.tenDuong || "",
        lyTrinh: "",
        from: "",
        to: ""
      };
      const dirs = directionTypes.map((t) => makeEmptyDirection(t, seed));
      return {
        ...prev,
        days: { ...prev.days, [dateIso]: { directions: dirs } }
      };
    });
    setSelectedDate(dateIso);
  }

  function flash(msg) {
    setMessage(msg);
    setTimeout(() => setMessage(""), 3500);
  }

  function updateCover(key, value) {
    setLedger((prev) => ({
      ...prev,
      cover: { ...prev.cover, [key]: value }
    }));
  }

  function updateDay(date, updater) {
    setLedger((prev) => {
      const day = prev.days[date] || { directions: [] };
      const nextDay = typeof updater === "function" ? updater(day) : updater;
      return {
        ...prev,
        days: { ...prev.days, [date]: nextDay }
      };
    });
  }

  function addDay() {
    const d = newDateInput || todayIso();
    addDayWithDirections(d, [DIRECTION_DI]);
    flash(`Đã thêm ngày ${formatDisplayDate(d)} · chiều đi`);
  }

  function addDirection(directionType) {
    const seed = selectedDir || directionSeed();
    const dir = makeEmptyDirection(directionType, seed);
    setLedger((prev) => {
      const day = prev.days[selectedDate] || { directions: [] };
      return {
        ...prev,
        days: {
          ...prev.days,
          [selectedDate]: { directions: [...(day.directions || []), dir] }
        }
      };
    });
    setSelectedDirId(dir.id);
    flash(`Đã thêm ${directionType === DIRECTION_VE ? "chiều về" : "chiều đi"}`);
  }

  function duplicateDirection() {
    if (!selectedDir) return;
    const copy = makeEmptyDirection(selectedDir.directionType, {
      ...selectedDir,
      counts: { ...selectedDir.counts }
    });
    updateDay(selectedDate, (day) => ({
      directions: [...(day.directions || []), copy]
    }));
    setSelectedDirId(copy.id);
    flash("Đã nhân bản chiều đếm");
  }

  function copyPreviousDay() {
    const sorted = [...allDayKeys].sort();
    const idx = sorted.indexOf(selectedDate);
    const prev = idx > 0 ? sorted[idx - 1] : sorted.filter((d) => d < selectedDate).pop();
    if (!prev || !ledger.days[prev]?.directions?.length) {
      flash("Không có ngày trước để sao chép");
      return;
    }
    const copied = ledger.days[prev].directions.map((d) =>
      makeEmptyDirection(d.directionType, {
        ...d,
        counts: { ...d.counts }
      })
    );
    updateDay(selectedDate, { directions: copied });
    setSelectedDirId(copied[0]?.id || "");
    flash(`Đã sao chép từ ${formatDisplayDate(prev)}`);
  }

  function updateDirection(dir) {
    updateDay(selectedDate, (day) => ({
      directions: (day.directions || []).map((d) => (d.id === dir.id ? dir : d))
    }));
  }

  function deleteDirection(id) {
    if (!window.confirm("Xóa chiều đếm này?")) return;
    updateDay(selectedDate, (day) => ({
      directions: (day.directions || []).filter((d) => d.id !== id)
    }));
    setSelectedDirId("");
  }

  async function handleExportWord() {
    setExporting(true);
    try {
      const name = (ledger.cover?.tenDuong || roadName || "SoDemXe").replace(/\s+/g, "_");
      await downloadDemXeWord(ledger, `So_dem_xe_${name}.docx`);
      flash("Đã xuất file Word");
    } catch (err) {
      window.alert(`Không xuất được Word: ${err?.message || err}`);
    } finally {
      setExporting(false);
    }
  }

  function handlePrint(mode) {
    applyPrintMode(mode, { selectedDate, selectedDirId, dates });
    window.print();
    setTimeout(() => applyPrintMode(null), 500);
  }

  if (!ready || !ledger) {
    return (
      <div className="nhaplieu-workspace">
        <p className="section-guide">Đang tải sổ đếm xe...</p>
      </div>
    );
  }

  return (
    <div className="nhaplieu-workspace sonhatky-workspace demxe-workspace">
      <aside
        className="nhaplieu-sidebar sonhatky-sidebar demxe-sidebar"
        style={{ width: SIDEBAR_WIDTH, minWidth: SIDEBAR_WIDTH, maxWidth: SIDEBAR_WIDTH }}
      >
        <div className="sidebar-sticky-head">
          <h2 className="sidebar-title">Sổ đếm xe</h2>
          <p className="sonhatky-day-summary">
            {dates.length ? `${dates.length} ngày có dữ liệu` : "Chưa có ngày đếm"}
          </p>
          {message && <p className="save-ok">{message}</p>}

          <label className="sidebar-field">
            <span className="sidebar-field-label">Thêm ngày đếm</span>
            <div className="demxe-sidebar-add-day">
              <ViDateInput value={newDateInput} onChange={setNewDateInput} className="sidebar-input sidebar-input--date" />
              <button type="button" className="btn-primary btn-primary--compact" onClick={addDay}>
                +
              </button>
            </div>
          </label>

          {tab === "entry" && (
            <>
              <div className="demxe-day-list">
                {(allDayKeys.length ? allDayKeys : [selectedDate]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`demxe-day-item${d === selectedDate ? " demxe-day-item--active" : ""}`}
                    onClick={() => {
                      setSelectedDate(d);
                      setSelectedDirId("");
                    }}
                  >
                    {formatDisplayDate(d)}
                    <span className="demxe-day-badge">
                      {(ledger.days[d]?.directions || []).length} chiều
                    </span>
                  </button>
                ))}
              </div>

              {directions.length > 0 ? (
                <div className="demxe-dir-list">
                  {directions.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      className={`demxe-dir-item${d.id === (selectedDir?.id || "") ? " demxe-dir-item--active" : ""}`}
                      onClick={() => setSelectedDirId(d.id)}
                    >
                      {d.directionType === DIRECTION_VE ? "Chiều về" : "Chiều đi"}
                      {d.from || d.to ? `: ${d.from || "?"} → ${d.to || "?"}` : ""}
                    </button>
                  ))}
                </div>
              ) : (
                allDayKeys.includes(selectedDate) && (
                  <div className="demxe-sidebar-dir-actions">
                    <button type="button" className="btn-primary btn-primary--compact demxe-sidebar-dir-btn" onClick={() => addDirection(DIRECTION_DI)}>
                      + Chiều đi
                    </button>
                    <button type="button" className="btn-secondary btn-primary--compact demxe-sidebar-dir-btn" onClick={() => addDirection(DIRECTION_VE)}>
                      + Chiều về
                    </button>
                  </div>
                )
              )}

              {directions.length > 0 && (
                <div className="demxe-sidebar-dir-actions demxe-sidebar-dir-actions--secondary">
                  <button type="button" className="btn-secondary btn-primary--compact demxe-sidebar-dir-btn" onClick={() => addDirection(DIRECTION_DI)}>
                    + Chiều đi
                  </button>
                  <button type="button" className="btn-secondary btn-primary--compact demxe-sidebar-dir-btn" onClick={() => addDirection(DIRECTION_VE)}>
                    + Chiều về
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </aside>

      <main className="nhaplieu-review-pane demxe-main">
        <div className="demxe-toolbar no-print">
          <div className="demxe-tabs">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                className={tab === t.key ? "demxe-tab demxe-tab--active" : "demxe-tab"}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="demxe-toolbar-actions">
            {tab === "entry" && (
              <>
                <button type="button" className="btn-secondary btn-primary--compact" onClick={() => addDirection(DIRECTION_DI)}>
                  + Chiều đi
                </button>
                <button type="button" className="btn-secondary btn-primary--compact" onClick={() => addDirection(DIRECTION_VE)}>
                  + Chiều về
                </button>
                <button type="button" className="btn-secondary btn-primary--compact" onClick={copyPreviousDay}>
                  Sao chép ngày
                </button>
                {selectedDir && (
                  <button type="button" className="btn-secondary btn-primary--compact demxe-btn-danger" onClick={() => deleteDirection(selectedDir.id)}>
                    Xóa chiều
                  </button>
                )}
              </>
            )}
            <button type="button" className="btn-secondary btn-primary--compact" onClick={() => handlePrint(tab === "cover" ? "cover" : tab === "guide" ? "guide" : tab === "summary" ? "summary" : "day")}>
              In
            </button>
            <button type="button" className="btn-secondary btn-primary--compact" onClick={() => handlePrint("all")}>
              In/PDF toàn sổ
            </button>
            <button type="button" className="btn-primary btn-primary--compact" disabled={exporting} onClick={() => void handleExportWord()}>
              {exporting ? "Đang xuất..." : "Xuất Word"}
            </button>
          </div>
        </div>

        <div className="demxe-pane">
          {tab === "cover" && (
            <DemXeCoverSheet cover={ledger.cover} onChange={updateCover} />
          )}
          {tab === "guide" && <DemXeGuidePanel />}
          {tab === "entry" && (
            selectedDir ? (
              <DemXeCountSheet
                date={selectedDate}
                direction={selectedDir}
                cover={ledger.cover}
                editable
                onChange={updateDirection}
                onDuplicate={duplicateDirection}
              />
            ) : (
              <DemXeEntryForm
                date={selectedDate}
                onAddDi={() => addDirection(DIRECTION_DI)}
                onAddVe={() => addDirection(DIRECTION_VE)}
              />
            )
          )}
          {tab === "summary" && <DemXeSummarySheet days={ledger.days} />}
        </div>

        {/* Hidden print stack — always in DOM for full-book print */}
        <div className="demxe-print-stack" aria-hidden="true">
          <DemXeCoverSheet cover={ledger.cover} readOnly />
          <DemXeGuidePanel />
          {allDayKeys.flatMap((date) =>
            (ledger.days[date]?.directions || []).map((dir) => (
              <DemXeCountSheet key={`${date}-${dir.id}`} date={date} direction={dir} cover={ledger.cover} />
            ))
          )}
          <DemXeSummarySheet days={ledger.days} />
        </div>
      </main>
    </div>
  );
}
