/* Đồng bộ localStorage / meta đường — cùng kiểu SoMatDuong / SoTNGT */
/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react";
import HanhLangSheet from "../components/HanhLangSheet";
import HanhLangPrintPages from "../components/HanhLangPrintPages";
import { ViMonthInput } from "../components/ViDateInput";
import {
  loadStorage,
  saveStorage,
  formatYearMonthVN,
  migrateEntry,
  HANH_LANG_SECTION,
  safeSetLocalStorage
} from "../utils/nhatKyFormat";
import {
  filterHanhLangEntries,
  packHanhLangPages,
  applyHanhLangCellPatch,
  makeEmptyHanhLangEntry,
  isHanhLangSheetRowFilled,
  shouldExportHanhLang,
  entryInMonth,
  parseHanhLangDisplayDate,
  hanhLangTrailingEmptyCount
} from "../utils/hanhLangFormat";
import { printHanhLangPages } from "../utils/hanhLangPrint";
import { exportHanhLangExcel } from "../utils/hanhLangExcel";
import { getHanhLangColWidths } from "../hooks/useHanhLangColWidths";
import { useRoadWorkspace } from "../context/RoadWorkspaceContext";
import { resolveReportMetaFromRoad } from "../utils/roadsCatalog";
import {
  fetchOfficeBookAsStorage,
  pushOfficeBookDays,
  pushOfficeBookMeta
} from "../services/officeBooksService";
import { splitStorageByDay } from "../utils/officeBooksLocal";
import RoutesViewSidebarControls from "../components/RoutesViewSidebarControls";

import SidebarResizer from "../components/SidebarResizer";
import { useResizableSidebar } from "../hooks/useResizableSidebar";
const MARGIN_KEY = "hanh-lang-print-margins-v1";
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

function buildSheetRows(allEntries, yearMonth, margins = DEFAULT_MARGINS, routeOpts = {}) {
  const monthEntries = filterHanhLangEntries(allEntries, yearMonth, routeOpts).filter(
    isHanhLangSheetRowFilled
  );
  const rows = monthEntries.map((entry) => {
    const globalIndex = allEntries.indexOf(entry);
    return {
      entry: { ...entry },
      globalIndex,
      draftKey: null
    };
  });

  let draftSeq = 0;
  const emptyNeed = hanhLangTrailingEmptyCount(
    monthEntries,
    margins || DEFAULT_MARGINS
  );
  while (rows.filter((r) => !isHanhLangSheetRowFilled(r.entry)).length < emptyNeed) {
    rows.push({
      entry: makeEmptyHanhLangEntry(yearMonth),
      globalIndex: -1,
      draftKey: draftSeq++
    });
  }
  return rows;
}

function ensureTrailingEmpty(rows, yearMonth, margins = DEFAULT_MARGINS) {
  const next = [...rows];
  let draftSeq =
    next.reduce((max, r) => Math.max(max, r.draftKey == null ? -1 : r.draftKey), -1) + 1;

  const filled = next.filter((r) => isHanhLangSheetRowFilled(r.entry)).map((r) => r.entry);
  const emptyNeed = hanhLangTrailingEmptyCount(filled, margins || DEFAULT_MARGINS);

  let trailing = 0;
  for (let i = next.length - 1; i >= 0; i -= 1) {
    if (isHanhLangSheetRowFilled(next[i].entry)) break;
    trailing += 1;
  }
  while (trailing < emptyNeed) {
    next.push({
      entry: makeEmptyHanhLangEntry(yearMonth),
      globalIndex: -1,
      draftKey: draftSeq++
    });
    trailing += 1;
  }
  while (trailing > emptyNeed && next.length) {
    const last = next[next.length - 1];
    if (isHanhLangSheetRowFilled(last.entry) || last.globalIndex >= 0) break;
    next.pop();
    trailing -= 1;
  }
  return next;
}

export default function SoHanhLang({
  onGoEdit,
  storageTick = 0,
  readOnly = false,
  onStorageChange
}) {
  const {
    storageKey,
    activeRoad,
    activeRoadId,
    ownerUid,
    browseMode,
    filterByRouteView
  } = useRoadWorkspace();
  const { sidebarStyle, onResizeStart } = useResizableSidebar({ defaultWidth: 280 });
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [yearMonth, setYearMonth] = useState(defaultMonth);
  const [printOpen, setPrintOpen] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [margins, setMargins] = useState(loadMargins);
  const [colWidths, setColWidths] = useState(getHanhLangColWidths);
  const [dirty, setDirty] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  /** Bản nháp khi USER sửa trên bảng; admin/readOnly không dùng. */
  const [draftRows, setDraftRows] = useState(null);
  const [cloudStorage, setCloudStorage] = useState(null);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudError, setCloudError] = useState("");
  const [cloudSyncing, setCloudSyncing] = useState(false);

  const localStored = useMemo(
    () => loadStorage(storageKey),
    [storageKey, storageTick]
  );

  // ADMIN/VIEWER ở máy khác: đọc thẳng office_books của USER, không phụ thuộc localStorage.
  useEffect(() => {
    if (!browseMode || !ownerUid || !activeRoadId) {
      setCloudStorage(null);
      setCloudLoading(false);
      setCloudError("");
      return undefined;
    }
    let cancelled = false;
    setCloudStorage(null);
    setCloudLoading(true);
    setCloudError("");
    void fetchOfficeBookAsStorage(ownerUid, activeRoadId, { sinceMs: 0 })
      .then((remote) => {
        if (cancelled) return;
        setCloudStorage(remote);
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn("Không tải được sổ hành lang của USER từ cloud.", err);
        setCloudError(err?.message || "Không tải được dữ liệu USER từ cloud.");
      })
      .finally(() => {
        if (!cancelled) setCloudLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [browseMode, ownerUid, activeRoadId, storageTick]);

  const stored = browseMode
    ? cloudStorage || { entries: [], dayMeta: {}, reportMeta: {} }
    : localStored;
  const entries = useMemo(
    () => (stored.entries || []).map(migrateEntry),
    [stored.entries]
  );
  const dayMetaMap = stored.dayMeta || {};
  const reportMeta = useMemo(
    () => resolveReportMetaFromRoad(stored.reportMeta, activeRoad),
    [stored.reportMeta, activeRoad]
  );

  const liveRows = useMemo(
    () =>
      buildSheetRows(entries, yearMonth, margins, {
        filterByRouteView
      }),
    [entries, yearMonth, margins, filterByRouteView]
  );

  // Đổi sổ / hydrate / tháng → bỏ nháp, hiện dữ liệu mới.
  useEffect(() => {
    setDirty(false);
    setDraftRows(null);
    if (storageTick > 0) {
      setSaveMessage("Đã đồng bộ từ nhật ký / app hiện trường.");
      const t = setTimeout(() => setSaveMessage(""), 3000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [storageKey, storageTick, yearMonth, filterByRouteView]);

  const sheetRows = !readOnly && dirty && draftRows ? draftRows : liveRows;

  const data = useMemo(
    () => sheetRows.map((r) => r.entry).filter(isHanhLangSheetRowFilled),
    [sheetRows]
  );

  const printPageCount = useMemo(
    () => packHanhLangPages(data, margins).length,
    [data, margins]
  );

  useEffect(() => {
    safeSetLocalStorage(MARGIN_KEY, margins);
  }, [margins]);

  useEffect(() => {
    if (printOpen) setColWidths(getHanhLangColWidths());
  }, [printOpen]);

  function shiftMonth(delta) {
    if (dirty && !readOnly) {
      const ok = window.confirm("Có thay đổi chưa lưu. Đổi tháng sẽ mất thay đổi. Tiếp tục?");
      if (!ok) return;
    }
    const [y, m] = yearMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setYearMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    setDirty(false);
    setDraftRows(null);
    setSaveMessage("");
  }

  function handleYearMonthChange(v) {
    if (dirty && !readOnly) {
      const ok = window.confirm("Có thay đổi chưa lưu. Đổi tháng sẽ mất thay đổi. Tiếp tục?");
      if (!ok) return;
    }
    setYearMonth(v);
    setDirty(false);
    setDraftRows(null);
    setSaveMessage("");
  }

  async function runExportExcel() {
    if (exportingExcel) return;
    setExportingExcel(true);
    try {
      await exportHanhLangExcel({
        yearMonth,
        reportMeta,
        entries: data,
        margins,
        widths: colWidths
      });
    } catch (error) {
      console.error(error);
      window.alert("Không xuất được Excel. Vui lòng thử lại.");
    } finally {
      setExportingExcel(false);
    }
  }

  function handleCellChange(rowIndex, field, value) {
    if (readOnly) return;
    setDraftRows((prev) => {
      const base = prev || liveRows;
      const next = [...base];
      let draftSeq =
        next.reduce((max, r) => Math.max(max, r.draftKey == null ? -1 : r.draftKey), -1) + 1;
      while (next.length <= rowIndex) {
        next.push({
          entry: makeEmptyHanhLangEntry(yearMonth),
          globalIndex: -1,
          draftKey: draftSeq++
        });
      }
      const row = next[rowIndex];
      next[rowIndex] = {
        ...row,
        entry: applyHanhLangCellPatch(row.entry, field, value, yearMonth)
      };
      return ensureTrailingEmpty(next, yearMonth, margins);
    });
    setDirty(true);
    setSaveMessage("");
  }

  function handleSave() {
    if (readOnly) return;
    const rows = draftRows || liveRows;

    const kept = entries.filter(
      (e) => !(shouldExportHanhLang(e) && entryInMonth(e, yearMonth))
    );

    const merged = [];
    rows.forEach((row) => {
      if (!isHanhLangSheetRowFilled(row.entry)) return;
      const rawEntry = { ...row.entry };
      const draftDateText = rawEntry._recordDateText;
      delete rawEntry._locationText;
      delete rawEntry._recordDateText;
      delete rawEntry._areaText;

      let entry = {
        ...rawEntry,
        section: rawEntry.section || HANH_LANG_SECTION,
        exportHanhLang: true,
        hlRecorder: String(rawEntry.hlRecorder || "").trim(),
        hlViolator: String(rawEntry.hlViolator || "").trim(),
        hlAddress: String(rawEntry.hlAddress || "").trim(),
        content: String(rawEntry.content || "").trim(),
        hlProcessNote: String(rawEntry.hlProcessNote || "").trim(),
        resolved: String(rawEntry.resolved || rawEntry.hlProcessNote || "").trim(),
        hlNote: String(rawEntry.hlNote || "").trim()
      };

      if (draftDateText != null && String(draftDateText).trim()) {
        const iso = parseHanhLangDisplayDate(draftDateText, yearMonth);
        if (iso) {
          entry.hlRecordDate = iso;
          entry.date = iso;
        }
      }
      if (!entry.hlRecordDate && entry.date) entry.hlRecordDate = entry.date;
      if (!entry.date && entry.hlRecordDate) entry.date = entry.hlRecordDate;
      if (!entry.date) {
        entry.date = `${yearMonth}-01`;
        entry.hlRecordDate = entry.date;
      }

      if (row.globalIndex >= 0 && entries[row.globalIndex]) {
        const base = entries[row.globalIndex];
        entry = {
          ...base,
          ...entry,
          sourceIncidentId: base.sourceIncidentId,
          sourceIncidentDate: base.sourceIncidentDate,
          sourceGroupName: base.sourceGroupName,
          sourceIncidentType: base.sourceIncidentType,
          sourceIncidentCompletedDate: base.sourceIncidentCompletedDate
        };
      }
      merged.push(migrateEntry(entry));
    });

    const finalEntries = [...kept, ...merged];
    saveStorage(finalEntries, dayMetaMap, reportMeta, storageKey);
    setDirty(false);
    setDraftRows(null);
    setSaveMessage("Đã lưu sổ hành lang.");
    onStorageChange?.();
    setTimeout(() => setSaveMessage(""), 3500);
  }

  async function handleSyncCloud() {
    if (readOnly || browseMode || !ownerUid || !activeRoadId || cloudSyncing) return;
    const current = loadStorage(storageKey, { includeDeleted: true });
    const days = splitStorageByDay(current);
    if (!days.length) {
      setSaveMessage("Không có dữ liệu local để đồng bộ.");
      return;
    }
    setCloudSyncing(true);
    setSaveMessage("Đang đưa dữ liệu sổ lên cloud...");
    try {
      await pushOfficeBookDays(ownerUid, activeRoadId, days);
      await pushOfficeBookMeta(ownerUid, activeRoadId, current.reportMeta || {});
      const remote = await fetchOfficeBookAsStorage(ownerUid, activeRoadId, { sinceMs: 0 });
      const remoteHanhLangCount = filterHanhLangEntries(
        (remote.entries || []).map(migrateEntry),
        yearMonth
      ).length;
      setSaveMessage(
        `Đã đồng bộ cloud · tháng này có ${remoteHanhLangCount} vụ hành lang. Admin có thể tải lại.`
      );
    } catch (err) {
      console.warn("Đồng bộ sổ hành lang lên cloud thất bại.", err);
      setSaveMessage(`Chưa đồng bộ được cloud: ${err?.message || "Lỗi không xác định"}`);
    } finally {
      setCloudSyncing(false);
    }
  }

  return (
    <div
      className={`nhaplieu-workspace sonhatky-workspace${
        printOpen ? " sohanhlang-workspace--print" : ""
      }`}
    >
      <aside
        className="nhaplieu-sidebar sonhatky-sidebar no-print"
        style={sidebarStyle}
      >
        <div className="sidebar-sticky-head">
          <h2 className="sidebar-title">Sổ hành lang</h2>
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
              onChange={handleYearMonthChange}
              className="sidebar-input sidebar-input--date"
              aria-label="Chọn tháng"
            />
          </div>
          <p className="sonhatky-day-summary">
            {formatYearMonthVN(yearMonth)}
            {data.length > 0 ? ` · ${data.length} vụ vi phạm` : " · Chưa có ghi chép"}
            {printPageCount > 1 ? ` · ${printPageCount} tờ` : ""}
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
                  Lưu sổ hành lang
                </button>
                <button
                  type="button"
                  className="btn-secondary btn-primary--compact"
                  onClick={() => void handleSyncCloud()}
                  disabled={cloudSyncing}
                >
                  {cloudSyncing ? "Đang đồng bộ..." : "Đồng bộ cloud"}
                </button>
              </div>
              {saveMessage && <p className="traffic-duty-save-msg">{saveMessage}</p>}
              {dirty && !saveMessage && (
                <p className="traffic-duty-save-msg traffic-duty-save-msg--warn">
                  Có thay đổi chưa lưu — click ô dưới hàng (1)…(10) để nhập
                </p>
              )}
              {!dirty && !saveMessage && (
                <p className="traffic-duty-save-msg">
                  Dữ liệu từ tab Nhập liệu (hành lang) hiện ở đây. Có thể sửa / thêm
                  dòng trên bảng rồi bấm Lưu.
                </p>
              )}
            </>
          )}

          {readOnly && (
            <p className="traffic-duty-save-msg">
              {cloudLoading
                ? "Đang tải trực tiếp dữ liệu USER từ cloud..."
                : cloudError
                  ? `Lỗi tải cloud: ${cloudError}`
                  : `Chế độ chỉ xem — đã tải trực tiếp từ cloud${data.length ? "." : ", chưa có dữ liệu trong tháng này."}`}
            </p>
          )}

          {onGoEdit && !readOnly && (
            <button type="button" className="btn-primary sonhatky-edit-btn" onClick={onGoEdit}>
              Thêm / sửa (Nhập liệu)
            </button>
          )}
          <button
            type="button"
            className={`btn-secondary sonhatky-edit-btn sonhatky-edit-btn--sub${
              printOpen ? " active" : ""
            }`}
            onClick={() => setPrintOpen((v) => !v)}
          >
            {printOpen ? "Đóng xem trước in" : "In sổ hành lang"}
          </button>
          <RoutesViewSidebarControls />
        </div>

        {printOpen && (
          <div className="sidebar-scroll">
            <div className="print-form-panel">
              <div className="print-form-label">In sổ hành lang</div>
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
              <div className="nhatky-review-canvas nhatky-review-canvas--tngt">
                {readOnly ? (
                  <HanhLangPrintPages
                    yearMonth={yearMonth}
                    reportMeta={reportMeta}
                    entries={data}
                    margins={margins}
                    widths={colWidths}
                    showGuides={false}
                    screenMode
                  />
                ) : (
                  <HanhLangSheet
                    yearMonth={yearMonth}
                    reportMeta={reportMeta}
                    rowItems={sheetRows}
                    margins={margins}
                    onCellChange={handleCellChange}
                  />
                )}
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
                  className="btn-secondary btn-secondary--compact print-toolbar-action"
                  disabled={exportingExcel}
                  onClick={() => void runExportExcel()}
                >
                  {exportingExcel ? "Đang xuất…" : "Xuất Excel"}
                </button>
                <button
                  type="button"
                  className="btn-primary btn-primary--compact print-toolbar-action"
                  onClick={() => printHanhLangPages(margins, colWidths)}
                >
                  In tháng này
                </button>
              </div>
            </div>
            <HanhLangPrintPages
              yearMonth={yearMonth}
              reportMeta={reportMeta}
              entries={data}
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
