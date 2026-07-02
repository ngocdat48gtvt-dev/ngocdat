import { useEffect, useMemo, useState } from "react";
import BaoDuongSheet from "../components/BaoDuongSheet";
import ViDateInput from "../components/ViDateInput";
import { loadStorage, formatDisplayDate } from "../utils/nhatKyFormat";
import {
  filterBaoDuongEntries,
  collectBaoDuongWorkTypes,
  isBaoDuongSection,
  BAO_DUONG_MAX_DAYS
} from "../utils/baoDuongFormat";
import {
  BAO_DUONG_QUALITY_EVENT,
  hasQualityForType,
  upsertQualityTypes,
  DEFAULT_QUALITY_FALLBACK
} from "../utils/baoDuongQualityStore";
import { useRoadWorkspace } from "../context/RoadWorkspaceContext";

const SIDEBAR_WIDTH = 260;

export default function SoBaoDuong({ date, onDateChange, onGoEdit, storageTick = 0 }) {
  const { storageKey } = useRoadWorkspace();
  const [catalogTick, setCatalogTick] = useState(0);
  const [drafts, setDrafts] = useState({});
  const { entries } = useMemo(
    () => loadStorage(storageKey),
    [storageKey, storageTick]
  );

  useEffect(() => {
    const onChange = () => setCatalogTick((t) => t + 1);
    window.addEventListener(BAO_DUONG_QUALITY_EVENT, onChange);
    return () => window.removeEventListener(BAO_DUONG_QUALITY_EVENT, onChange);
  }, []);

  const data = useMemo(
    () => filterBaoDuongEntries(entries, date),
    [entries, date, catalogTick]
  );

  const missingTypes = useMemo(
    () => collectBaoDuongWorkTypes(entries).filter((t) => !hasQualityForType(t)),
    [entries, catalogTick]
  );

  // Nhóm công việc (mục) cho từng loại, lấy từ chính dữ liệu sổ tuần đường.
  const typeGroup = useMemo(() => {
    const map = {};
    (entries || []).forEach((e) => {
      const type = String(e?.type || "").trim();
      const section = String(e?.section || "").trim();
      if (type && section && isBaoDuongSection(section) && !map[type]) {
        map[type] = section;
      }
    });
    return map;
  }, [entries]);

  useEffect(() => {
    setDrafts((prev) => {
      const next = { ...prev };
      missingTypes.forEach((t) => {
        if (!next[t]) next[t] = { ...DEFAULT_QUALITY_FALLBACK };
      });
      return next;
    });
  }, [missingTypes]);

  function updateDraft(type, field, value) {
    setDrafts((prev) => ({ ...prev, [type]: { ...prev[type], [field]: value } }));
  }

  function saveDraft(type) {
    const d = drafts[type];
    if (!d || (!d.method?.trim() && !d.result?.trim())) {
      window.alert("Nhập ít nhất một nội dung biện pháp hoặc nhận xét.");
      return;
    }
    upsertQualityTypes({ [type]: { ...d, group: typeGroup[type] || "" } });
  }

  function shiftDay(delta) {
    const d = new Date(`${date}T12:00:00`);
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
          <h2 className="sidebar-title">Sổ bảo dưỡng</h2>
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
            {data.length > 0
              ? ` · ${data.length} công việc`
              : " · Chưa có công việc"}
          </p>
          <p className="sidebar-subtitle">
            Tồn tại phát hiện ở sổ tuần đường phải được xử lý xong và ghi vào
            sổ BDTX trong vòng {BAO_DUONG_MAX_DAYS} ngày. Bảng lấy theo ngày dự
            kiến sửa chữa của từng sự cố mặt đường.
          </p>
          <button type="button" className="btn-primary sonhatky-edit-btn" onClick={onGoEdit}>
            Thêm / sửa dữ liệu
          </button>
        </div>
      </aside>

      <main className="nhaplieu-review-pane">
        <div className="nhatky-review">
          {missingTypes.length > 0 && (
            <div className="baoduong-missing">
              <p className="baoduong-missing-title">
                Có {missingTypes.length} công tác mới trong sổ tuần đường chưa có nhận
                xét chuẩn. Bổ sung để tự điền vào sổ BDTX:
              </p>
              {missingTypes.map((type) => (
                <div key={type} className="baoduong-missing-row">
                  <span className="baoduong-missing-type">{type}</span>
                  <textarea
                    value={drafts[type]?.method || ""}
                    onChange={(e) => updateDraft(type, "method", e.target.value)}
                    rows={2}
                    placeholder="Tóm tắt biện pháp thực hiện (cột 4)"
                  />
                  <textarea
                    value={drafts[type]?.result || ""}
                    onChange={(e) => updateDraft(type, "result", e.target.value)}
                    rows={2}
                    placeholder="Nhận xét kết quả chủ yếu (cột 5)"
                  />
                  <button
                    type="button"
                    className="btn-primary btn-primary--compact"
                    onClick={() => saveDraft(type)}
                  >
                    Thêm
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="nhatky-review-canvas">
            <BaoDuongSheet execDate={date} entries={data} />
          </div>
        </div>
      </main>
    </div>
  );
}
