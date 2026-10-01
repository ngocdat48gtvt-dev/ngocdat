import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import NhatKyReview from "../components/NhatKyReview";
import NhatKyPrintDay, {
  clampRowHeightScale,
  layoutSpreadForPrint
} from "../components/NhatKyPrintDay";
import ViDateInput from "../components/ViDateInput";
import {
  loadStorage,
  formatDisplayDate,
  getDayMeta,
  migrateEntry,
  safeSetLocalStorage
} from "../utils/nhatKyFormat";
import {
  eachIsoDateInclusive,
  entriesForDate,
  dayMetaForDate
} from "../utils/nhatKyPrintRows";
import {
  printNhatKyPages,
  printNhatKySheetsHtml,
  nhatKyPagesToSheetsHtml
} from "../utils/nhatKyPrint";
import { exportNhatKyExcel } from "../utils/nhatKyExcel";
import { exportNhatKyWord } from "../lib/nhatKyWordBuilder";
import { getNhatKyColWidths } from "../hooks/useColumnWidths";
import {
  useRoadWorkspace,
  RoadWorkspaceContext
} from "../context/RoadWorkspaceContext";
import { isMergedMultiRouteView } from "../utils/roadsCatalog";
import RoutesViewSidebarControls from "../components/RoutesViewSidebarControls";
import SidebarResizer from "../components/SidebarResizer";
import { useResizableSidebar } from "../hooks/useResizableSidebar";
import {
  loadNhatKySignNames,
  saveNhatKySignNames,
  HAT_SIGN_ROLES,
  resolveHatSignRoleLabel
} from "../utils/nhatKySignNames";
import {
  collectDiaryFilledDates,
  missingDiaryDatesYearToDate
} from "../utils/diaryCalendarGaps";
import { parsePrintPageStart } from "../utils/printFolio";
import { useOfficePermissions } from "../hooks/useOfficePermissions";
import { useGptcSync } from "../hooks/useGptcSync";
import { mergeGptcLedgerIntoDiaryEntries, syncLocalGptcLedgerToNhatKy } from "../utils/gptcNhatKySync";
import { GPTC_CHANGED_EVENT } from "../utils/gptcStore";
import { useAuth } from "../context/AuthContext";
import { fetchOfficeBookAsStorage } from "../services/officeBooksService";
import {
  activeDiaryEntries,
  mergeOfficeBookDayWithoutBase
} from "../utils/officeBooksConflictMerge";

const MARGIN_KEY = "nhatky-print-margins-v2";
const ROW_H_KEY = "nhatky-print-row-height-scale-v1";
/** Xem trước tối đa — in 6 tháng (~180 ngày) nếu dựng hết tờ A4 sẽ đơ máy. */
const PREVIEW_DAY_CAP = 14;
/** Lề mặc định: trái 2cm, trên 2cm, dưới 1.5cm, phải 1.5cm */
const DEFAULT_MARGINS = { top: 20, right: 15, bottom: 15, left: 20 };
const DEFAULT_ROW_HEIGHT_SCALE = 1;

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

function loadRowHeightScale() {
  try {
    const n = Number(JSON.parse(localStorage.getItem(ROW_H_KEY)));
    return clampRowHeightScale(n || DEFAULT_ROW_HEIGHT_SCALE);
  } catch {
    return DEFAULT_ROW_HEIGHT_SCALE;
  }
}

/**
 * Gộp các ngày cloud vào bản đang có trên máy — chỉ trong bộ nhớ, không ghi localStorage
 * (ghi cả sổ dễ đầy quota và làm rơi ngày khác).
 */
function overlayRemoteDays(localEntries, localDayMeta, remote) {
  const remoteDays = remote?.remoteDays || [];
  if (!remoteDays.length) {
    return { entries: localEntries || [], dayMeta: { ...(localDayMeta || {}) } };
  }
  const dates = new Set(remoteDays.map((day) => day.date));
  const kept = (localEntries || []).filter((entry) => !dates.has(String(entry?.date || "")));
  const dayMeta = { ...(localDayMeta || {}) };
  const localByDate = new Map();
  (localEntries || []).forEach((entry) => {
    const date = String(entry?.date || "");
    if (!dates.has(date)) return;
    if (!localByDate.has(date)) localByDate.set(date, []);
    localByDate.get(date).push(entry);
  });
  const merged = [];
  remoteDays.forEach((rem) => {
    const date = rem.date;
    const loc = {
      entries: localByDate.get(date) || [],
      dayMeta: dayMeta[date] || {}
    };
    const day = mergeOfficeBookDayWithoutBase(loc, rem);
    (day.entries || []).forEach((entry) => merged.push(entry));
    if (day.dayMeta && Object.keys(day.dayMeta).length) dayMeta[date] = day.dayMeta;
  });
  return { entries: [...kept, ...merged], dayMeta };
}

/** Đợi đóng trang theo DOM (giống xem từng ngày) trước khi gom HTML in. */
async function waitNhatKyDayLayoutReady(host) {
  for (let i = 0; i < 30; i += 1) {
    if (host.querySelector(".nhatky-print-day[data-nk-layout-ready='1']")) {
      return;
    }
    await new Promise((r) => requestAnimationFrame(r));
    if (i % 3 === 2) await new Promise((r) => setTimeout(r, 0));
  }
}

export default function SoNhatKy({
  date,
  onDateChange,
  onGoEdit,
  onOpenGptcDetail,
  storageTick = 0,
  readOnly = false
}) {
  const roadWorkspace = useRoadWorkspace();
  const {
    storageKey,
    filterByRouteView,
    catalogRoad,
    routesViewMode,
    activeRouteId,
    titleRouteIds,
    ownerUid,
    activeRoadId,
    activeRoad,
    browseMode,
    offlineMode
  } = roadWorkspace;
  const { profile } = useAuth();
  const { isAdmin, canEditOfficeData } = useOfficePermissions();
  const canPush = canEditOfficeData && !browseMode && !offlineMode && !readOnly;
  const roadName = (activeRoad?.roadName || activeRoad?.label || "").trim();
  useGptcSync({
    uid: ownerUid,
    companyId: profile?.companyId || "",
    roadId: activeRoadId,
    roadName,
    tenTuyen: roadName,
    enabled: !!activeRoadId && !!ownerUid,
    canPush,
    browseMode,
    offlineMode,
    nhatKyStorageKey: storageKey
  });
  const { sidebarStyle, onResizeStart } = useResizableSidebar({ defaultWidth: 320 });
  const [gptcTick, setGptcTick] = useState(0);
  useEffect(() => {
    const onGptc = () => setGptcTick((n) => n + 1);
    window.addEventListener(GPTC_CHANGED_EVENT, onGptc);
    return () => window.removeEventListener(GPTC_CHANGED_EVENT, onGptc);
  }, []);
  const { entries, dayMeta } = useMemo(
    () => loadStorage(storageKey),
    [storageKey, storageTick]
  );
  const mergedEntries = useMemo(
    () => mergeGptcLedgerIntoDiaryEntries(entries, ownerUid, activeRoadId),
    [entries, ownerUid, activeRoadId, storageTick, gptcTick]
  );
  const data = useMemo(
    () =>
      filterByRouteView(mergedEntries.map(migrateEntry).filter((x) => x.date === date)),
    [mergedEntries, date, filterByRouteView]
  );
  const meta = getDayMeta(dayMeta, date);
  const entryCount = data.length;

  const locationCtx = useMemo(() => {
    const viewOpts = { routesViewMode, activeRouteId, titleRouteIds };
    return {
      mergedMulti: isMergedMultiRouteView(catalogRoad, viewOpts),
      catalogRoad,
      viewOpts
    };
  }, [catalogRoad, routesViewMode, activeRouteId, titleRouteIds]);

  const missingDates = useMemo(() => {
    if (!isAdmin) return [];
    const filled = collectDiaryFilledDates(mergedEntries);
    return missingDiaryDatesYearToDate(filled);
  }, [mergedEntries, isAdmin]);

  const [margins, setMargins] = useState(loadMargins);
  const [rowHeightScale, setRowHeightScale] = useState(loadRowHeightScale);
  const [rangeFrom, setRangeFrom] = useState(date);
  const [rangeTo, setRangeTo] = useState(date);
  const [printOpen, setPrintOpen] = useState(false);
  const [printScope, setPrintScope] = useState("day");
  const [colWidths, setColWidths] = useState(getNhatKyColWidths);
  const [signNames, setSignNames] = useState(() => loadNhatKySignNames(storageKey));
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingWord, setExportingWord] = useState(false);
  const [printingPdf, setPrintingPdf] = useState(false);
  const [rangePack, setRangePack] = useState(null);
  const [rangeLoading, setRangeLoading] = useState(false);
  const [pageStartInput, setPageStartInput] = useState("");
  const pageStart = parsePrintPageStart(pageStartInput);

  useEffect(() => {
    if (!storageKey || !ownerUid || !activeRoadId) return;
    syncLocalGptcLedgerToNhatKy(ownerUid, activeRoadId, storageKey);
  }, [storageKey, ownerUid, activeRoadId, gptcTick]);

  useEffect(() => {
    setSignNames(loadNhatKySignNames(storageKey));
  }, [storageKey]);

  useEffect(() => {
    saveNhatKySignNames(storageKey, signNames);
  }, [storageKey, signNames]);

  useEffect(() => {
    setRangeFrom(date);
    setRangeTo(date);
  }, [date]);

  useEffect(() => {
    safeSetLocalStorage(MARGIN_KEY, margins);
  }, [margins]);

  useEffect(() => {
    safeSetLocalStorage(ROW_H_KEY, rowHeightScale);
  }, [rowHeightScale]);

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

  const previewMountDates = useMemo(
    () => previewDates.slice(0, PREVIEW_DAY_CAP),
    [previewDates]
  );
  const previewCapped = previewDates.length > PREVIEW_DAY_CAP;
  const rangePackMatches =
    printScope === "range" &&
    rangePack &&
    rangePack.from === previewDates[0] &&
    rangePack.to === previewDates[previewDates.length - 1];
  const previewEntrySource = rangePackMatches ? rangePack.entries : mergedEntries;
  const previewMetaSource = rangePackMatches ? rangePack.dayMeta : dayMeta;

  useEffect(() => {
    if (!printOpen || printScope !== "range" || rangeDates.length < 2) {
      setRangePack(null);
      setRangeLoading(false);
      return undefined;
    }
    if (!ownerUid || !activeRoadId || offlineMode) {
      setRangePack(null);
      setRangeLoading(false);
      return undefined;
    }
    const from = rangeDates[0];
    const to = rangeDates[rangeDates.length - 1];
    let cancelled = false;
    const timer = setTimeout(() => {
      setRangeLoading(true);
      fetchOfficeBookAsStorage(ownerUid, activeRoadId, {
        dateFrom: from,
        dateTo: to
      })
        .then((remote) => {
          if (cancelled) return;
          const overlaid = overlayRemoteDays(entries, dayMeta, remote);
          const live = mergeGptcLedgerIntoDiaryEntries(
            activeDiaryEntries(overlaid.entries),
            ownerUid,
            activeRoadId
          );
          setRangePack({ from, to, entries: live, dayMeta: overlaid.dayMeta });
        })
        .catch((err) => {
          console.warn("Không tải được khoảng ngày sổ nhật ký.", err);
          if (!cancelled) setRangePack(null);
        })
        .finally(() => {
          if (!cancelled) setRangeLoading(false);
        });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    printOpen,
    printScope,
    rangeDates,
    ownerUid,
    activeRoadId,
    offlineMode,
    entries,
    dayMeta,
    gptcTick
  ]);

  function shiftDay(delta) {
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() + delta);
    onDateChange(d.toISOString().split("T")[0]);
  }

  async function loadRangePrintSource() {
    const from = previewDates[0];
    const to = previewDates[previewDates.length - 1];
    if (rangePackMatches && rangePack) {
      return { entries: rangePack.entries, dayMeta: rangePack.dayMeta || dayMeta };
    }
    if (!ownerUid || !activeRoadId || offlineMode) {
      return { entries: mergedEntries, dayMeta };
    }
    const remote = await fetchOfficeBookAsStorage(ownerUid, activeRoadId, {
      dateFrom: from,
      dateTo: to
    });
    const overlaid = overlayRemoteDays(entries, dayMeta, remote);
    return {
      entries: mergeGptcLedgerIntoDiaryEntries(
        activeDiaryEntries(overlaid.entries),
        ownerUid,
        activeRoadId
      ),
      dayMeta: overlaid.dayMeta
    };
  }

  async function runPrint() {
    if (previewDates.length === 0) return;
    if (previewDates.length < 2) {
      printNhatKyPages(margins, pageStart);
      return;
    }
    setPrintingPdf(true);
    const host = document.createElement("div");
    host.setAttribute("aria-hidden", "true");
    host.style.cssText =
      "position:fixed;left:-14000px;top:0;width:440mm;min-width:440mm;pointer-events:none;opacity:1;";
    document.body.appendChild(host);
    const root = createRoot(host);
    const hatRole = resolveHatSignRoleLabel(signNames.hatRole);
    try {
      let source = { entries: mergedEntries, dayMeta };
      try {
        source = await loadRangePrintSource();
      } catch (err) {
        console.warn("Không tải được khoảng ngày để in — dùng dữ liệu đang mở.", err);
      }
      const parts = [];
      for (let i = 0; i < previewDates.length; i += 1) {
        const d = previewDates[i];
        flushSync(() => {
          root.render(
            <RoadWorkspaceContext.Provider value={roadWorkspace}>
              <div className="nhatky-print-stack nhatky-print-stack--preview">
                <NhatKyPrintDay
                  key={d}
                  date={d}
                  items={filterByRouteView(entriesForDate(source.entries, d))}
                  dayMeta={dayMetaForDate(source.dayMeta, d)}
                  margins={margins}
                  widths={colWidths}
                  signTuanDuong={signNames.tuanDuong}
                  signHatTruong={signNames.hatTruong}
                  signHatRole={hatRole}
                  rowHeightScale={rowHeightScale}
                  preciseBreak
                />
              </div>
            </RoadWorkspaceContext.Provider>
          );
        });
        await waitNhatKyDayLayoutReady(host);
        void host.offsetHeight;
        host.querySelectorAll(".nhatky-print-spread").forEach((spread) => {
          layoutSpreadForPrint(spread);
        });
        const pages = host.querySelectorAll(".nhatky-print-page");
        const html = nhatKyPagesToSheetsHtml(pages, margins, pageStart);
        if (html) parts.push(html);
        await new Promise((r) => setTimeout(r, 0));
      }
      printNhatKySheetsHtml(parts.join("\n"), margins, pageStart);
    } catch (err) {
      console.error(err);
      window.alert(err?.message || "Không in được PDF. Thử Xuất Word.");
    } finally {
      try {
        root.unmount();
      } catch {
        /* ignore */
      }
      try {
        host.remove();
      } catch {
        /* ignore */
      }
      setPrintingPdf(false);
    }
  }

  async function runExportExcel() {
    if (previewDates.length === 0) return;
    setExportingExcel(true);
    try {
      await exportNhatKyExcel({
        dates: previewDates,
        entries,
        dayMeta,
        filterByRouteView,
        locationCtx,
        margins,
        widths: colWidths,
        signTuanDuong: signNames.tuanDuong,
        signHatTruong: signNames.hatTruong,
        signHatRole: resolveHatSignRoleLabel(signNames.hatRole),
        rowHeightScale
      });
    } catch (err) {
      console.error(err);
      window.alert(err?.message || "Không xuất được Excel. Thử lại.");
    } finally {
      setExportingExcel(false);
    }
  }

  async function runExportWord() {
    if (previewDates.length === 0) return;
    setExportingWord(true);
    try {
      await exportNhatKyWord({
        dates: previewDates,
        entries,
        dayMeta,
        filterByRouteView,
        locationCtx,
        margins,
        signTuanDuong: signNames.tuanDuong,
        signHatTruong: signNames.hatTruong,
        signHatRole: resolveHatSignRoleLabel(signNames.hatRole),
        rowHeightScale
      });
    } catch (err) {
      console.error(err);
      window.alert(err?.message || "Không xuất được Word. Thử lại.");
    } finally {
      setExportingWord(false);
    }
  }

  return (
    <div className={`nhaplieu-workspace sonhatky-workspace${printOpen ? " sonhatky-workspace--print" : ""}`}>
      <aside
        className="nhaplieu-sidebar sonhatky-sidebar no-print"
        style={sidebarStyle}
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
              missingDates={missingDates}
            />
          </div>
          <p className="sonhatky-day-summary">
            {formatDisplayDate(date)}
            {entryCount > 0
              ? ` · ${entryCount} ghi chép`
              : " · Chưa có ghi chép"}
            {isAdmin && missingDates.length > 0
              ? ` · ${missingDates.length} ngày trống`
              : ""}
          </p>
          <div className="sonhatky-action-row">
            {onGoEdit && !readOnly ? (
              <button type="button" className="btn-primary sonhatky-edit-btn" onClick={onGoEdit}>
                Chỉnh sửa
              </button>
            ) : null}
            {readOnly ? (
              <p className="sonhatky-day-summary" style={{ margin: 0 }}>
                Chỉ xem
              </p>
            ) : null}
            <button
              type="button"
              className={`btn-secondary sonhatky-edit-btn sonhatky-edit-btn--sub${printOpen ? " active" : ""}`}
              onClick={() => setPrintOpen((v) => !v)}
            >
              {printOpen ? "Đóng in" : "In sổ"}
            </button>
          </div>
          {!printOpen ? (
            <>
              <RoutesViewSidebarControls />
              <div className="sonhatky-sign-form">
                <div className="print-form-label">Tên ký cuối sổ</div>
                <div className="sidebar-field">
                  <span className="sidebar-field-label">Chức danh ký</span>
                  <div className="sonhatky-sign-role-options" role="radiogroup" aria-label="Chức danh ký">
                    {HAT_SIGN_ROLES.map((opt) => (
                      <label key={opt.value} className="sonhatky-sign-role-option">
                        <input
                          type="radio"
                          name="nhatky-hat-sign-role"
                          value={opt.value}
                          checked={(signNames.hatRole || "hat_truong") === opt.value}
                          disabled={readOnly}
                          onChange={() =>
                            setSignNames((s) => ({ ...s, hatRole: opt.value }))
                          }
                        />
                        <span>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <label className="sidebar-field">
                  <span className="sidebar-field-label">Tuần đường</span>
                  <input
                    className="sidebar-input"
                    value={signNames.tuanDuong}
                    onChange={(e) =>
                      setSignNames((s) => ({ ...s, tuanDuong: e.target.value }))
                    }
                    placeholder="Họ và tên tuần đường"
                    disabled={readOnly}
                    aria-label="Tên tuần đường"
                  />
                </label>
                <label className="sidebar-field">
                  <span className="sidebar-field-label">
                    {resolveHatSignRoleLabel(signNames.hatRole)}
                  </span>
                  <input
                    className="sidebar-input"
                    value={signNames.hatTruong}
                    onChange={(e) =>
                      setSignNames((s) => ({ ...s, hatTruong: e.target.value }))
                    }
                    placeholder={`Họ và tên ${resolveHatSignRoleLabel(signNames.hatRole)}`}
                    disabled={readOnly}
                    aria-label={`Tên ${resolveHatSignRoleLabel(signNames.hatRole)}`}
                  />
                </label>
              </div>
            </>
          ) : null}
        </div>

        {printOpen && (
          <div className="sidebar-scroll">
            <div className="print-form-panel">
              <div className="sidebar-field sonhatky-rowh-field">
                <span className="sidebar-field-label">Chiều cao hàng</span>
                <div className="sonhatky-rowh-stepper">
                  <button
                    type="button"
                    className="sonhatky-rowh-btn"
                    disabled={readOnly || rowHeightScale <= 0.6}
                    onClick={() =>
                      setRowHeightScale(clampRowHeightScale(rowHeightScale - 0.05))
                    }
                    aria-label="Giảm chiều cao hàng"
                    title="Giảm"
                  >
                    −
                  </button>
                  <input
                    className="sidebar-input sonhatky-rowh-value"
                    type="number"
                    min="0.6"
                    max="1.8"
                    step="0.05"
                    value={rowHeightScale}
                    onChange={(e) => setRowHeightScale(clampRowHeightScale(e.target.value))}
                    disabled={readOnly}
                    aria-label="Chiều cao hàng sổ nhật ký"
                    title="1.0 = mặc định. 0.6 thấp hơn, 1.8 cao hơn."
                  />
                  <button
                    type="button"
                    className="sonhatky-rowh-btn"
                    disabled={readOnly || rowHeightScale >= 1.8}
                    onClick={() =>
                      setRowHeightScale(clampRowHeightScale(rowHeightScale + 0.05))
                    }
                    aria-label="Tăng chiều cao hàng"
                    title="Tăng"
                  >
                    +
                  </button>
                </div>
              </div>
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
                <li>Mỗi nửa = 1 tờ A4 dọc · kéo lề xanh trên tờ đầu</li>
                <li>Chiều cao hàng: nút − / + bên trên</li>
              </ul>
            </div>
          </div>
        )}
      </aside>

      <SidebarResizer onMouseDown={onResizeStart} />

      <main className="nhaplieu-review-pane">
        {!printOpen ? (
          <div className="sonhatky-screen-preview">
            <NhatKyReview
              date={date}
              items={data}
              dayMeta={meta}
              alwaysShow
              signTuanDuong={signNames.tuanDuong}
              signHatTruong={signNames.hatTruong}
              signHatRole={resolveHatSignRoleLabel(signNames.hatRole)}
              onSectionSelect={
                onGoEdit
                  ? (sectionTitle) => onGoEdit(sectionTitle)
                  : undefined
              }
              onEntrySelect={
                onGoEdit
                  ? (_idx, sectionTitle) => onGoEdit(sectionTitle)
                  : undefined
              }
              onGptcEntryOpen={onOpenGptcDetail}
            />
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
                    <span className="print-chip">
                      {previewCapped
                        ? `Xem ${previewMountDates.length}/${previewDates.length} ngày`
                        : `${previewDates.length} ngày`}
                    </span>
                  ) : null}
                  <span className="print-chip print-chip--muted">
                    Lề {margins.top}/{margins.right}/{margins.bottom}/{margins.left} mm
                  </span>
                  <span className="print-chip print-chip--muted">
                    Hàng ×{rowHeightScale}
                  </span>
                </div>
              </div>
              <div className="print-toolbar-actions">
                <button
                  type="button"
                  className="btn-secondary btn-secondary--compact print-toolbar-action"
                  disabled={
                    exportingExcel ||
                    exportingWord ||
                    previewDates.length === 0
                  }
                  onClick={() => void runExportExcel()}
                >
                  {exportingExcel ? "Đang xuất…" : "Xuất Excel"}
                </button>
                <button
                  type="button"
                  className="btn-secondary btn-secondary--compact print-toolbar-action"
                  disabled={
                    exportingExcel ||
                    exportingWord ||
                    previewDates.length === 0
                  }
                  onClick={() => void runExportWord()}
                >
                  {exportingWord ? "Đang xuất…" : "Xuất Word"}
                </button>
                <button
                  type="button"
                  className="btn-primary btn-primary--compact print-toolbar-action"
                  disabled={
                    exportingExcel ||
                    exportingWord ||
                    printingPdf ||
                    previewDates.length === 0
                  }
                  onClick={() => void runPrint()}
                  title="In máy in hoặc chọn «Microsoft Print to PDF» / «Save as PDF». Cả khoảng ngày, không chỉ 14 ngày xem trước."
                >
                  In / PDF
                  {printingPdf
                    ? "…"
                    : previewDates.length > 1
                      ? ` · ${previewDates.length} ngày`
                      : ""}
                </button>
              </div>
            </div>

            <div
              className="nhatky-print-stack nhatky-print-stack--preview"
              style={
                pageStart != null
                  ? { counterReset: `nk-folio ${pageStart - 1}` }
                  : undefined
              }
            >
              {rangeLoading ? (
                <p className="print-preview-cap-note no-print">
                  Đang tải dữ liệu từ {formatDisplayDate(previewDates[0])} đến{" "}
                  {formatDisplayDate(previewDates[previewDates.length - 1])}…
                </p>
              ) : null}
              {previewCapped ? (
                <p className="print-preview-cap-note no-print">
                  Khoảng {previewDates.length} ngày — chỉ xem trước {PREVIEW_DAY_CAP}{" "}
                  ngày đầu để máy không đơ. In/PDF vẫn đủ cả khoảng.
                </p>
              ) : null}
              {previewMountDates.map((d) => (
                <NhatKyPrintDay
                  key={d}
                  date={d}
                  items={filterByRouteView(entriesForDate(previewEntrySource, d))}
                  dayMeta={dayMetaForDate(previewMetaSource, d)}
                  margins={margins}
                  onMarginsChange={setMargins}
                  widths={colWidths}
                  signTuanDuong={signNames.tuanDuong}
                  signHatTruong={signNames.hatTruong}
                  signHatRole={resolveHatSignRoleLabel(signNames.hatRole)}
                  rowHeightScale={rowHeightScale}
                  showFolio={pageStart != null}
                />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
