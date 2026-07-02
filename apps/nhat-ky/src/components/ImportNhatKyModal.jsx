import { useMemo, useState } from "react";
import { formatDisplayDate, PART_LABELS } from "../utils/nhatKyFormat";
import ViDateInput from "./ViDateInput";
import {
  getImportSectionOptionGroups,
  resolveNhatKySection
} from "../utils/incidentImport";
import { positionLabel } from "../utils/incidentUtils";

export default function ImportNhatKyModal({
  open,
  selectedIncidents,
  onClose,
  onConfirm
}) {
  const [nhatKyDate, setNhatKyDate] = useState(
    () => new Date().toISOString().split("T")[0]
  );
  const [sectionMode, setSectionMode] = useState("auto");
  const sectionGroups = useMemo(() => getImportSectionOptionGroups(), []);

  const preview = useMemo(() => {
    return selectedIncidents.map((inc) => {
      const autoSection = resolveNhatKySection(inc);
      const targetSection =
        sectionMode === "auto" ? autoSection : sectionMode;
      return { inc, autoSection, targetSection };
    });
  }, [selectedIncidents, sectionMode]);

  const importable = preview.filter((row) => row.targetSection);
  const skipped = preview.filter((row) => !row.targetSection);

  if (!open) return null;

  function handleConfirm() {
    if (!nhatKyDate) {
      window.alert("Vui lòng chọn ngày ghi nhật ký.");
      return;
    }
    if (importable.length === 0) {
      window.alert("Không có sự cố nào phù hợp mục đã chọn.");
      return;
    }
    onConfirm({
      nhatKyDate,
      sectionMode,
      incidentIds: importable.map((row) => row.inc.id)
    });
  }

  return (
    <div className="hientruong-modal-overlay" onClick={onClose}>
      <div
        className="hientruong-modal"
        role="dialog"
        aria-labelledby="import-nhatky-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="hientruong-modal-head">
          <h3 id="import-nhatky-title">Đưa vào nhật ký tuần đường</h3>
          <button type="button" className="draggable-form-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="hientruong-modal-body">
          <p className="hientruong-modal-hint">
            Ngày ghi nhật ký do bạn chọn, không theo ngày trên app hiện trường.
          </p>

          <label className="entry-form-label">Ngày ghi nhật ký</label>
          <ViDateInput
            className="sidebar-input hientruong-modal-input"
            value={nhatKyDate}
            onChange={setNhatKyDate}
            aria-label="Ngày ghi nhật ký"
          />

          <label className="entry-form-label">Mục đưa vào nhật ký</label>
          <select
            className="sidebar-input hientruong-modal-input"
            value={sectionMode}
            onChange={(e) => setSectionMode(e.target.value)}
          >
            {sectionGroups.auto.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
            {Object.entries(sectionGroups.parts).map(([part, options]) => (
              <optgroup key={part} label={PART_LABELS[part] || part}>
                {options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>

          {sectionMode === "auto" && (
            <p className="hientruong-modal-note">
              Bão lũ → <strong>Nền đường</strong> · Hư hỏng mặt đường →{" "}
              <strong>Mặt đường</strong> · ATGT →{" "}
              <strong>Công trình an toàn giao thông</strong>. Chọn mục cụ thể nếu cần
              đưa vào hạng mục khác.
            </p>
          )}

          <div className="hientruong-modal-summary">
            <strong>
              Sẽ đưa {importable.length} / {selectedIncidents.length} sự cố
              {nhatKyDate ? ` · ngày ${formatDisplayDate(nhatKyDate)}` : ""}
            </strong>
            {skipped.length > 0 && sectionMode === "auto" && (
              <p className="hientruong-modal-warn">
                {skipped.length} sự cố chưa có ánh xạ tự động — chọn mục nhật ký thủ công.
              </p>
            )}
          </div>

          <ul className="hientruong-modal-list">
            {preview.map(({ inc, autoSection, targetSection }) => (
              <li
                key={inc.id}
                className={targetSection ? "" : "is-skipped"}
              >
                <span className="hientruong-modal-list-km">{inc.km}</span>
                <span>{inc.type}</span>
                <span className="hientruong-modal-list-side">{positionLabel(inc.position)}</span>
                <span className="hientruong-modal-list-section">
                  {targetSection || "—"}
                  {sectionMode === "auto" && autoSection && (
                    <span className="hientruong-modal-list-auto"> (tự động)</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="hientruong-modal-actions">
          <button type="button" className="hientruong-modal-btn-cancel" onClick={onClose}>
            Hủy
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleConfirm}
            disabled={importable.length === 0}
          >
            Xác nhận đưa vào nhật ký
          </button>
        </div>
      </div>
    </div>
  );
}
