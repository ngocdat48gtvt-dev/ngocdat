import { useEffect, useMemo, useState } from "react";
import MatDuongSheet from "../components/MatDuongSheet";
import MatDuongPrintPages from "../components/MatDuongPrintPages";
import { ViMonthInput } from "../components/ViDateInput";
import { loadStorage, formatYearMonthVN, safeSetLocalStorage } from "../utils/nhatKyFormat";
import {
  filterMatDuongEntries,
  packMatDuongPages
} from "../utils/matDuongFormat";
import { printMatDuongPages } from "../utils/matDuongPrint";
import { exportMatDuongExcel } from "../utils/matDuongExcel";
import { getMatDuongColWidths } from "../hooks/useMatDuongColWidths";
import { useRoadWorkspace } from "../context/RoadWorkspaceContext";
import { resolveReportMetaFromRoad } from "../utils/roadsCatalog";
import RoutesViewSidebarControls from "../components/RoutesViewSidebarControls";
import SidebarResizer from "../components/SidebarResizer";
import { useResizableSidebar } from "../hooks/useResizableSidebar";

const MARGIN_KEY = "matduong-print-margins-v1";
const DEFAULT_MARGINS = { top: 8, right: 10, bottom: 8, left: 10 };

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

export default function SoMatDuong({ storageTick = 0, readOnly = false }) {
  const { storageKey, activeRoad, filterByRouteView } = useRoadWorkspace();
  const { sidebarStyle, onResizeStart } = useResizableSidebar({ defaultWidth: 300 });
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [yearMonth, setYearMonth] = useState(defaultMonth);
  const [printOpen, setPrintOpen] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [margins, setMargins] = useState(loadMargins);
  const [colWidths, setColWidths] = useState(getMatDuongColWidths);

  const stored = useMemo(() => loadStorage(storageKey), [storageKey, storageTick]);
  const reportMeta = useMemo(
    () => resolveReportMetaFromRoad(stored.reportMeta, activeRoad),
    [stored.reportMeta, activeRoad]
  );
  const data = useMemo(
    () => filterByRouteView(filterMatDuongEntries(stored.entries, yearMonth)),
    [stored.entries, yearMonth, filterByRouteView]
  );
  const printPageCount = useMemo(
    () => packMatDuongPages(data, margins).length,
    [data, margins]
  );

  useEffect(() => {
    safeSetLocalStorage(MARGIN_KEY, margins);
  }, [margins]);

  useEffect(() => {
    if (printOpen) setColWidths(getMatDuongColWidths());
  }, [printOpen]);

  function shiftMonth(delta) {
    const [y, m] = yearMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setYearMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  function runPrint() {
    printMatDuongPages(margins, colWidths);
  }

  async function runExportExcel() {
    if (exportingExcel) return;
    setExportingExcel(true);
    try {
      await exportMatDuongExcel({
        entries: data,
        yearMonth,
        reportMeta,
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

  const kmHint =
    reportMeta.kmRange || reportMeta.roadName
      ? `Tuyến: ${reportMeta.roadName || "…"} · ${reportMeta.kmRange || "…"}`
      : null;

  return (
    <div
      className={`nhaplieu-workspace sonhatky-workspace somatduong-workspace${
        printOpen ? " somatduong-workspace--print" : ""
      }`}
    >
      <aside
        className="nhaplieu-sidebar sonhatky-sidebar no-print"
        style={sidebarStyle}
      >
        <div className="sidebar-sticky-head">
          <h2 className="sidebar-title">Sổ mặt đường</h2>
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
              onChange={(v) => setYearMonth(v)}
              className="sidebar-input sidebar-input--date"
              aria-label="Chọn tháng"
            />
          </div>
          <p className="sonhatky-day-summary">
            {formatYearMonthVN(yearMonth)}
            {data.length > 0
              ? ` · ${data.length} vị trí hư hỏng`
              : " · 0 vị trí hư hỏng"}
          </p>
          {kmHint ? <p className="sonhatky-day-summary">{kmHint}</p> : null}
          <button
            type="button"
            className={`btn-secondary sonhatky-edit-btn sonhatky-edit-btn--sub${
              printOpen ? " active" : ""
            }`}
            onClick={() => setPrintOpen((v) => !v)}
          >
            {printOpen ? "Đóng xem trước in" : "In sổ mặt đường"}
          </button>
          <RoutesViewSidebarControls />
        </div>

        {printOpen && (
          <div className="sidebar-scroll">
            <div className="print-form-panel">
              <div className="print-form-label">In sổ mặt đường</div>
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
          <div className="sonhatky-screen-preview somatduong-screen-preview">
            <div className="nhatky-review">
              <div className="nhatky-review-canvas">
                <MatDuongSheet
                  yearMonth={yearMonth}
                  reportMeta={reportMeta}
                  entries={data}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="sonhatky-print-preview-pane somatduong-print-preview-pane">
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
                  onClick={runPrint}
                >
                  In tháng này
                </button>
              </div>
            </div>
            <MatDuongPrintPages
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
