import { useMemo } from "react";
import NhatKyReview from "../components/NhatKyReview";
import ViDateInput from "../components/ViDateInput";
import {
  loadStorage,
  formatDisplayDate,
  getDayMeta,
  migrateEntry,
  SECTIONS
} from "../utils/nhatKyFormat";
import { useRoadWorkspace } from "../context/RoadWorkspaceContext";

const SIDEBAR_WIDTH = 240;

export default function SoNhatKy({ date, onDateChange, onGoEdit, storageTick = 0 }) {
  const { storageKey } = useRoadWorkspace();
  const { entries, dayMeta } = useMemo(
    () => loadStorage(storageKey),
    [storageKey, storageTick]
  );
  const data = entries
    .map(migrateEntry)
    .filter((x) => x.date === date);
  const meta = getDayMeta(dayMeta, date);
  const entryCount = data.length;

  function shiftDay(delta) {
    const d = new Date(date);
    d.setDate(d.getDate() + delta);
    onDateChange(d.toISOString().split("T")[0]);
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
            />
          </div>
          <p className="sonhatky-day-summary">
            {formatDisplayDate(date)}
            {entryCount > 0
              ? ` · ${entryCount} ghi chép`
              : " · Chưa có ghi chép"}
          </p>
          <button type="button" className="btn-primary sonhatky-edit-btn" onClick={onGoEdit}>
            Chỉnh sửa ngày này
          </button>
        </div>

        <div className="sidebar-scroll">
          <div className="sidebar-block sidebar-block--flat">
            <div className="sidebar-block-label">Hạng mục có dữ liệu</div>
            <ul className="sonhatky-section-summary">
              {SECTIONS.map((section) => {
                const count = data.filter((x) => x.section === section.title).length;
                if (!count) return null;
                return (
                  <li key={section.key}>
                    <span className="section-part">
                      {section.part}.{section.num}
                    </span>
                    {section.title}
                    <span className="section-count">{count}</span>
                  </li>
                );
              })}
              {entryCount === 0 && (
                <li className="sonhatky-section-empty">Không có dữ liệu ngày này</li>
              )}
            </ul>
          </div>
        </div>
      </aside>

      <main className="nhaplieu-review-pane">
        <NhatKyReview
          date={date}
          items={data}
          dayMeta={meta}
          alwaysShow
        />
      </main>
    </div>
  );
}
