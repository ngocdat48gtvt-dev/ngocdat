import { useEffect, useMemo, useState } from "react";
import HanhLangSheet from "../components/HanhLangSheet";
import HanhLangPrintPages from "../components/HanhLangPrintPages";
import { ViMonthInput } from "../components/ViDateInput";
import { loadStorage, formatYearMonthVN } from "../utils/nhatKyFormat";
import { filterHanhLangEntries, packHanhLangPages } from "../utils/hanhLangFormat";
import { printHanhLangPages } from "../utils/hanhLangPrint";
import { getHanhLangColWidths } from "../hooks/useHanhLangColWidths";
import { useRoadWorkspace } from "../context/RoadWorkspaceContext";
import { resolveReportMetaFromRoad } from "../utils/roadsCatalog";

const SIDEBAR_WIDTH = 280;
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

export default function SoHanhLang({ onGoEdit, storageTick = 0, readOnly = false }) {
  const { storageKey, activeRoad } = useRoadWorkspace();
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [yearMonth, setYearMonth] = useState(defaultMonth);
  const [printOpen, setPrintOpen] = useState(false);
  const [margins, setMargins] = useState(loadMargins);
  const [colWidths, setColWidths] = useState(getHanhLangColWidths);

  const { entries, reportMeta: savedMeta } = useMemo(
    () => loadStorage(storageKey),
    [storageKey, storageTick]
  );
  const reportMeta = useMemo(
    () => resolveReportMetaFromRoad(savedMeta, activeRoad),
    [savedMeta, activeRoad]
  );
  const data = filterHanhLangEntries(entries, yearMonth);
  const printPageCount = useMemo(
    () => packHanhLangPages(data, margins).length,
    [data, margins]
  );

  useEffect(() => {
    localStorage.setItem(MARGIN_KEY, JSON.stringify(margins));
  }, [margins]);

  useEffect(() => {
    if (printOpen) setColWidths(getHanhLangColWidths());
  }, [printOpen]);

  function shiftMonth(delta) {
    const [y, m] = yearMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setYearMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  return (
    <div
      className={`nhaplieu-workspace sonhatky-workspace${
        printOpen ? " sohanhlang-workspace--print" : ""
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
              onChange={setYearMonth}
              className="sidebar-input sidebar-input--date"
              aria-label="Chọn tháng"
            />
          </div>
          <p className="sonhatky-day-summary">
            {formatYearMonthVN(yearMonth)}
            {data.length > 0 ? ` · ${data.length} vụ vi phạm` : " · Chưa có ghi chép"}
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
            {printOpen ? "Đóng xem trước in" : "In sổ hành lang"}
          </button>
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

      <main className="nhaplieu-review-pane">
        {!printOpen ? (
          <div className="sonhatky-screen-preview">
            <div className="nhatky-review">
              <div className="nhatky-review-canvas nhatky-review-canvas--tngt">
                <HanhLangSheet yearMonth={yearMonth} reportMeta={reportMeta} entries={data} />
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
                onClick={() => printHanhLangPages(margins, colWidths)}
              >
                In tháng này
              </button>
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
