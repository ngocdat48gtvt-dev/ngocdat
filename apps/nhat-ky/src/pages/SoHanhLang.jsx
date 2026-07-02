import { useMemo, useState } from "react";
import HanhLangSheet from "../components/HanhLangSheet";
import { ViMonthInput } from "../components/ViDateInput";
import { loadStorage, EMPTY_REPORT_META, formatYearMonthVN } from "../utils/nhatKyFormat";
import { filterHanhLangEntries } from "../utils/hanhLangFormat";
import { useRoadWorkspace } from "../context/RoadWorkspaceContext";

const SIDEBAR_WIDTH = 260;

export default function SoHanhLang({ onGoEdit, storageTick = 0 }) {
  const { storageKey } = useRoadWorkspace();
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [yearMonth, setYearMonth] = useState(defaultMonth);

  const { entries, reportMeta: savedMeta } = useMemo(
    () => loadStorage(storageKey),
    [storageKey, storageTick]
  );
  const reportMeta = { ...EMPTY_REPORT_META, ...savedMeta };
  const data = filterHanhLangEntries(entries, yearMonth);

  function shiftMonth(delta) {
    const [y, m] = yearMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setYearMonth(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    );
  }

  return (
    <div className="nhaplieu-workspace sonhatky-workspace">
      <aside
        className="nhaplieu-sidebar sonhatky-sidebar"
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
          <button type="button" className="btn-primary sonhatky-edit-btn" onClick={onGoEdit}>
            Thêm / sửa dữ liệu
          </button>
        </div>
      </aside>

      <main className="nhaplieu-review-pane">
        <div className="nhatky-review">
          <div className="nhatky-review-canvas nhatky-review-canvas--tngt">
            <HanhLangSheet yearMonth={yearMonth} reportMeta={reportMeta} entries={data} />
          </div>
        </div>
      </main>
    </div>
  );
}
