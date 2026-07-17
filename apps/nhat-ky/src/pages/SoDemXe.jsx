import { useMemo, useState, useEffect, useRef } from "react";
import DemXeEntryForm from "../components/DemXeEntryForm";
import DemXeCountSheet from "../components/DemXeCountSheet";
import DemXeSummarySheet from "../components/DemXeSummarySheet";
import { useAuth } from "../context/AuthContext";
import { useRoadWorkspace } from "../context/RoadWorkspaceContext";
import { useOfficePermissions } from "../hooks/useOfficePermissions";
import { useDemXeSync } from "../hooks/useDemXeSync";
import { DocumentViewService } from "../officeBooks/DocumentViewService";
import { ensureDayDirections, makeEmptyDirection } from "../utils/demXeStore";
import {
  buildYearQuarters,
  currentQuarterIndex,
  ensureYearQuartersInLedger,
  findQuarterByDate,
  findQuarterByKey,
  ledgerYear
} from "../utils/demXeQuarters";
import { formatDisplayDate } from "../utils/nhatKyFormat";

const SIDEBAR_WIDTH = 300;
const TABS = [
  { key: "entry", label: "Nhập liệu" },
  { key: "summary", label: "Tổng hợp" }
];

function todayIso() {
  return new Date().toISOString().split("T")[0];
}

export default function SoDemXe({ readOnly = false }) {
  const { profile } = useAuth();
  const { activeRoad, activeRoadId, storageKey, ownerUid, browseMode } = useRoadWorkspace();
  const { canEditOfficeData } = useOfficePermissions();
  const roadName = (activeRoad?.roadName || activeRoad?.label || "").trim();
  const uid = ownerUid || profile?.uid || "";
  const canPush = canEditOfficeData && !browseMode && !readOnly;

  const { ledger, setLedger, ready, flushPush } = useDemXeSync({
    uid,
    roadId: activeRoadId,
    roadName,
    activeRoad,
    storageKey,
    enabled: !!activeRoadId && !!uid,
    canPush,
    browseMode
  });

  const [tab, setTab] = useState("entry");
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [selectedDirId, setSelectedDirId] = useState("");
  const [selectedQuarterKey, setSelectedQuarterKey] = useState("");
  const [message, setMessage] = useState("");
  const [entryDraft, setEntryDraft] = useState(null);
  const [entryDirty, setEntryDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const quartersInitRef = useRef(false);
  const entryNavRef = useRef({ date: "", dirId: "" });

  const trafficView = useMemo(() => DocumentViewService.buildTrafficCount(ledger), [ledger]);
  const bookYear = useMemo(() => trafficView.year || ledgerYear(ledger?.cover), [trafficView.year, ledger?.cover]);
  const quarters = useMemo(() => buildYearQuarters(bookYear), [bookYear]);
  const selectedQuarter = useMemo(
    () => findQuarterByKey(quarters, selectedQuarterKey) || findQuarterByDate(quarters, selectedDate),
    [quarters, selectedQuarterKey, selectedDate]
  );

  const directions = ledger?.days?.[selectedDate]?.directions || [];
  const selectedDir =
    directions.find((d) => d.id === selectedDirId) || directions[0] || null;

  useEffect(() => {
    if (!ready || !ledger || quartersInitRef.current) return;
    setLedger((prev) => ensureYearQuartersInLedger(prev, bookYear));
    quartersInitRef.current = true;
  }, [ready, bookYear, setLedger]);

  useEffect(() => {
    if (!ready || !ledger || !activeRoad) return;
    const company = (activeRoad.company || "").trim();
    const tenDuong = (activeRoad.roadName || activeRoad.label || "").trim();
    const tenHat = (activeRoad.hat || "").trim();
    const patch = {};
    if (company && ledger.cover?.donVi !== company) patch.donVi = company;
    if (tenDuong && !String(ledger.cover?.tenDuong || "").trim()) patch.tenDuong = tenDuong;
    if (tenHat && !String(ledger.cover?.tenHat || "").trim()) patch.tenHat = tenHat;
    if (!Object.keys(patch).length) return;
    setLedger((prev) => ({
      ...prev,
      cover: { ...prev.cover, ...patch }
    }));
  }, [
    ready,
    activeRoad?.id,
    activeRoad?.company,
    activeRoad?.roadName,
    activeRoad?.label,
    activeRoad?.hat,
    ledger?.cover?.donVi,
    ledger?.cover?.tenDuong,
    ledger?.cover?.tenHat,
    setLedger
  ]);

  useEffect(() => {
    if (!quarters.length) return;
    const exists = quarters.some((q) => q.key === selectedQuarterKey);
    if (!exists) {
      const q = quarters[currentQuarterIndex()] || quarters[0];
      setSelectedQuarterKey(q.key);
      setSelectedDate(q.startDate);
    }
  }, [quarters, selectedQuarterKey]);

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

  useEffect(() => {
    if (!selectedDir) {
      setEntryDraft(null);
      setEntryDirty(false);
      return;
    }
    const navChanged =
      entryNavRef.current.date !== selectedDate || entryNavRef.current.dirId !== selectedDirId;
    if (navChanged) {
      entryNavRef.current = { date: selectedDate, dirId: selectedDirId };
      setEntryDraft({
        ...selectedDir,
        counts: { ...(selectedDir.counts || {}) }
      });
      setEntryDirty(false);
    }
  }, [selectedDate, selectedDirId, selectedDir]);

  function commitDirection(dir) {
    const lyTrinh = dir.lyTrinh ?? "";
    const prevDir = ledger?.days?.[selectedDate]?.directions?.find((d) => d.id === dir.id);
    const lyTrinhChanged = (prevDir?.lyTrinh ?? "") !== lyTrinh;

    setLedger((prev) => {
      const days = { ...prev.days };
      const day = days[selectedDate] || { directions: [] };
      days[selectedDate] = {
        ...day,
        directions: (day.directions || []).map((d) => (d.id === dir.id ? dir : d))
      };

      if (lyTrinhChanged) {
        for (const date of Object.keys(days)) {
          const d0 = days[date];
          if (!d0?.directions?.length) continue;
          days[date] = {
            ...d0,
            directions: d0.directions.map((d) => ({ ...d, lyTrinh }))
          };
        }
      }

      return { ...prev, days };
    });
  }

  function handleEntryChange(dir) {
    if (readOnly) return;
    setEntryDraft(dir);
    setEntryDirty(true);
  }

  async function saveEntry() {
    if (!entryDraft) return;
    if (entryDirty) {
      commitDirection(entryDraft);
      setEntryDirty(false);
    }
    setSaving(true);
    try {
      await flushPush();
      flash("Đã lưu dữ liệu");
    } catch {
      flash("Đã lưu cục bộ (chưa đồng bộ cloud)");
    } finally {
      setSaving(false);
    }
  }

  function switchEntryDay(date) {
    if (entryDirty && entryDraft) {
      commitDirection(entryDraft);
      setEntryDirty(false);
    }
    setSelectedDate(date);
    setSelectedDirId("");
  }

  function switchEntryDir(id) {
    if (entryDirty && entryDraft) {
      commitDirection(entryDraft);
      setEntryDirty(false);
    }
    setSelectedDirId(id);
  }

  function directionSeed() {
    return {
      roadName: ledger.cover?.tenDuong || "",
      lyTrinh: "",
      from: "",
      to: ""
    };
  }

  function selectQuarter(quarter, goEntry = true) {
    setSelectedQuarterKey(quarter.key);
    setSelectedDate(quarter.startDate);
    setSelectedDirId("");
    if (goEntry) setTab("entry");
  }

  function syncYearQuarters() {
    const year = ledgerYear(ledger?.cover);
    setLedger((prev) => ensureYearQuartersInLedger(prev, year));
    const qs = buildYearQuarters(year);
    selectQuarter(qs[0], false);
    flash(`Đã khởi tạo 4 quý năm ${year} (ngày 5–7 tháng cuối quý)`);
  }

  function copyPreviousDay() {
    const quarter = findQuarterByDate(quarters, selectedDate);
    const pool = quarter ? quarter.dates : Object.keys(ledger?.days || {}).sort();
    const idx = pool.indexOf(selectedDate);
    const prev = idx > 0 ? pool[idx - 1] : null;
    if (!prev || !ledger.days[prev]?.directions?.length) {
      flash("Không có ngày trước trong quý để sao chép");
      return;
    }
    const copied = ledger.days[prev].directions.map((d) =>
      makeEmptyDirection(d.directionType, {
        ...d,
        counts: { ...d.counts }
      })
    );
    updateDay(selectedDate, (day) => ensureDayDirections({ directions: copied }, directionSeed()));
    setSelectedDirId(copied[0]?.id || "");
    flash(`Đã sao chép từ ${formatDisplayDate(prev)}`);
  }

  function flash(msg) {
    setMessage(msg);
    setTimeout(() => setMessage(""), 3500);
  }

  function updateDay(date, updater) {
    setLedger((prev) => {
      const day = prev.days[date] || { directions: [] };
      const nextDay = typeof updater === "function" ? updater(day) : updater;
      return {
        ...prev,
        days: {
          ...prev.days,
          [date]: ensureDayDirections(nextDay, {
            roadName: prev.cover?.tenDuong || "",
            lyTrinh: "",
            from: "",
            to: ""
          })
        }
      };
    });
  }

  const summaryBatchStarts = selectedQuarter ? [selectedQuarter.startDate] : null;

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
        <div className="sidebar-sticky-head demxe-sidebar-head">
          <h2 className="sidebar-title">Sổ đếm xe</h2>
          <p className="demxe-sidebar-meta">
            Năm <strong>{bookYear}</strong>
            <span aria-hidden="true"> · </span>
            4 quý · ngày 5–6–7
          </p>
          {message ? <p className="save-ok demxe-sidebar-flash">{message}</p> : null}
        </div>

        <div className="sidebar-scroll demxe-sidebar-scroll">
          {(tab === "entry" || tab === "summary") && (
            <div className="demxe-nav-card">
              <div className="demxe-nav-step">
                <span className="demxe-nav-step__n">1</span>
                <span className="demxe-nav-label">Chọn quý</span>
              </div>
              <div className="demxe-quarter-seg" role="tablist" aria-label="Chọn quý">
                {quarters.map((q) => {
                  const active = selectedQuarter?.key === q.key;
                  return (
                    <button
                      key={q.key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      title={`${q.label} · tháng ${q.month}/${q.year}`}
                      className={`demxe-quarter-seg__btn${active ? " is-active" : ""}`}
                      onClick={() => selectQuarter(q, tab === "entry")}
                    >
                      <span className="demxe-quarter-seg__roman">Quý {q.roman}</span>
                      <span className="demxe-quarter-seg__month">Tháng {q.month}</span>
                    </button>
                  );
                })}
              </div>

              {tab === "entry" && selectedQuarter ? (
                <>
                  <div className="demxe-nav-step demxe-nav-step--spaced">
                    <span className="demxe-nav-step__n">2</span>
                    <span className="demxe-nav-label">Ngày đếm</span>
                  </div>
                  <div className="demxe-day-list demxe-day-list--card">
                    {selectedQuarter.schedule.map(({ date, hoursLabel }) => {
                      const active = date === selectedDate;
                      return (
                        <button
                          key={date}
                          type="button"
                          className={`demxe-day-item${active ? " demxe-day-item--active" : ""}`}
                          onClick={() => switchEntryDay(date)}
                        >
                          <span className="demxe-day-item__main">
                            <span className="demxe-day-item__date">{formatDisplayDate(date)}</span>
                            {hoursLabel ? (
                              <span className="demxe-day-item__hours">{hoursLabel}</span>
                            ) : null}
                          </span>
                          <span className="demxe-day-badge">2 chiều</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : null}

              {tab === "summary" && selectedQuarter ? (
                <p className="demxe-nav-hint">
                  Tổng hợp {selectedQuarter.label}: {formatDisplayDate(selectedQuarter.startDate)} →{" "}
                  {formatDisplayDate(selectedQuarter.endDate)}
                </p>
              ) : null}
            </div>
          )}

          {tab === "entry" && directions.length > 0 ? (
            <div className="demxe-nav-card">
              <div className="demxe-nav-step">
                <span className="demxe-nav-step__n">3</span>
                <span className="demxe-nav-label">Chiều giao thông</span>
              </div>
              <div className="demxe-dir-seg" role="tablist" aria-label="Chiều giao thông">
                {directions.map((d) => {
                  const active = d.id === (selectedDir?.id || "");
                  const isVe = d.directionType === "ve";
                  const label = isVe ? "Chiều về" : "Chiều đi";
                  const route =
                    d.from || d.to ? `${d.from || "?"} → ${d.to || "?"}` : null;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      className={`demxe-dir-seg__btn${active ? " is-active" : ""}${
                        isVe ? " demxe-dir-seg__btn--ve" : " demxe-dir-seg__btn--di"
                      }`}
                      onClick={() => switchEntryDir(d.id)}
                    >
                      <span className="demxe-dir-seg__label">{label}</span>
                      {route ? <span className="demxe-dir-seg__route">{route}</span> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="demxe-sync-block">
            <button
              type="button"
              className="demxe-sync-btn"
              onClick={syncYearQuarters}
              disabled={readOnly}
            >
              Cập nhật lịch 4 quý {bookYear}
            </button>
            <p className="demxe-sync-hint">Tạo / làm mới ngày đếm theo năm hiện tại</p>
          </div>
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
            {tab === "entry" && !readOnly && (
              <div className="demxe-tabs-save">
                {entryDirty && <span className="demxe-entry-unsaved">Chưa lưu</span>}
                <button
                  type="button"
                  className="btn-secondary btn-primary--compact"
                  onClick={copyPreviousDay}
                >
                  Sao chép ngày trước
                </button>
                <button
                  type="button"
                  className="btn-primary btn-primary--compact"
                  disabled={saving || !entryDraft}
                  onClick={() => void saveEntry()}
                >
                  {saving ? "Đang lưu..." : "Lưu dữ liệu"}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="demxe-pane">
          {tab === "entry" &&
            (selectedDir && entryDraft ? (
              <DemXeCountSheet
                date={selectedDate}
                direction={entryDraft}
                cover={{
                  ...ledger.cover,
                  tenDuong: String(ledger.cover?.tenDuong || "").trim() || roadName,
                  tenHat:
                    String(ledger.cover?.tenHat || "").trim() ||
                    String(activeRoad?.hat || "").trim()
                }}
                editable={!readOnly}
                onChange={readOnly ? undefined : handleEntryChange}
              />
            ) : (
              <DemXeEntryForm date={selectedDate} />
            ))}
          {tab === "summary" && (
            <DemXeSummarySheet
              days={ledger.days}
              cover={ledger.cover}
              batchStarts={summaryBatchStarts}
            />
          )}
        </div>
      </main>
    </div>
  );
}
