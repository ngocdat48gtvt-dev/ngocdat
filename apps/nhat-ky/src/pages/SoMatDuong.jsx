import { useMemo, useState } from "react";
import MatDuongSheet from "../components/MatDuongSheet";
import { ViMonthInput } from "../components/ViDateInput";
import { loadStorage, formatYearMonthVN } from "../utils/nhatKyFormat";
import { EMPTY_REPORT_META, filterMatDuongEntries } from "../utils/matDuongFormat";
import { useRoadWorkspace } from "../context/RoadWorkspaceContext";

const SIDEBAR_WIDTH = 260;

export default function SoMatDuong({ storageTick = 0 }) {
  const { storageKey } = useRoadWorkspace();
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [yearMonth, setYearMonth] = useState(defaultMonth);

  const stored = useMemo(() => loadStorage(storageKey), [storageKey, storageTick]);
  const reportMeta = { ...EMPTY_REPORT_META, ...(stored.reportMeta || {}) };
  const data = filterMatDuongEntries(stored.entries, yearMonth);

  function shiftMonth(delta) {
    const [y, m] = yearMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setYearMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  return (
    <div className="nhaplieu-workspace sonhatky-workspace somatduong-workspace">
      <aside
        className="nhaplieu-sidebar sonhatky-sidebar"
        style={{
          width: SIDEBAR_WIDTH,
          minWidth: SIDEBAR_WIDTH,
          maxWidth: SIDEBAR_WIDTH
        }}
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
            {data.length > 0 ? ` · ${data.length} ghi chép` : " · Chưa có ghi chép"}
          </p>
          <p className="sidebar-subtitle">
            Nhập liệu mặt đường ở tab <strong>Nhập liệu</strong>. Sổ này chỉ để xem và in theo tháng.
          </p>
        </div>
      </aside>

      <main className="nhaplieu-review-pane">
        <div className="nhatky-review">
          <div className="nhatky-review-canvas">
            <MatDuongSheet yearMonth={yearMonth} reportMeta={reportMeta} entries={data} />
          </div>
        </div>
      </main>
    </div>
  );
}
