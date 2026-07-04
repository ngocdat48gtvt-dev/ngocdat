import { useEffect, useState } from "react";
import {
  afterConstructionImages,
  assignReportSlotOrder,
  beforeConstructionImages,
  buildIncidentTimelineEvents,
  clearReportImageSlots,
  computeKhoiLuong,
  encodeReportImageOrder,
  formatIncidentSize,
  formatIncidentUnit,
  formatKhoiLuong,
  formatTimelineDate,
  legacyRefsFromReportSlots,
  positionLabel,
  progressLabelPct,
  reportImageSlots,
  reportSlotOrderIndex,
  selectAllReportImageSlots,
  statusFromProgress,
  statusLabel,
  toggleReportImageSlot
} from "../utils/incidentUtils";
import { updateReportImageSelection } from "../services/incidentsService";
import IncidentImageGallery from "./IncidentImageGallery";

function DetailField({ label, value }) {
  return (
    <p className="incident-drawer-field">
      <span className="incident-drawer-label">{label}</span> {value || "—"}
    </p>
  );
}

function IncidentTimeline({ incident }) {
  const events = buildIncidentTimelineEvents(incident);
  if (events.length === 0) {
    return <p className="incident-drawer-muted">Chưa có lịch sử.</p>;
  }

  return (
    <ol className="incident-timeline">
      {events.map((ev) => (
        <li key={ev.key} className="incident-timeline-item">
          <p className="incident-timeline-date">{formatTimelineDate(ev.at)}</p>
          <p className="incident-timeline-title">{ev.title}</p>
          {ev.lines.map((line) => (
            <p key={line} className="incident-timeline-line">
              {line}
            </p>
          ))}
          {ev.by && <p className="incident-timeline-by">{ev.by}</p>}
        </li>
      ))}
    </ol>
  );
}

export default function IncidentDetailDrawer({
  incident,
  open,
  onClose,
  uid,
  importNote = "",
  suggestedSection = ""
}) {
  const [reportSlots, setReportSlots] = useState([]);
  const [saveError, setSaveError] = useState("");

  const beforeUrls = incident ? beforeConstructionImages(incident) : [];
  const afterUrls = incident ? afterConstructionImages(incident) : [];

  useEffect(() => {
    if (!incident || !open) return;
    setReportSlots(reportImageSlots(incident));
    setSaveError("");
  }, [incident?.id, open]);

  async function persistReportSlots(nextSlots) {
    if (!incident || !uid) return;
    setReportSlots(nextSlots);
    const { selectedBefore, selectedAfter } = legacyRefsFromReportSlots(nextSlots);
    const reportImageOrder = encodeReportImageOrder(nextSlots);
    try {
      await updateReportImageSelection(
        uid,
        incident.id,
        reportImageOrder,
        selectedBefore,
        selectedAfter
      );
      setSaveError("");
    } catch {
      setSaveError("Không lưu được lựa chọn ảnh.");
      setReportSlots(reportImageSlots(incident));
    }
  }

  function handleToggle(kind, url) {
    if (!incident) return;
    void persistReportSlots(toggleReportImageSlot(reportSlots, kind, url));
  }

  function handleSelectAll(kind) {
    if (!incident) return;
    const pool = kind === "before" ? beforeUrls : afterUrls;
    void persistReportSlots(selectAllReportImageSlots(reportSlots, kind, pool));
  }

  function handleClearAll(kind) {
    if (!incident) return;
    void persistReportSlots(clearReportImageSlots(reportSlots, kind));
  }

  function handleOrderChange(kind, url, order) {
    if (!incident) return;
    void persistReportSlots(assignReportSlotOrder(reportSlots, kind, url, order));
  }

  if (!open || !incident) return null;

  const vol = computeKhoiLuong(incident);
  const volUnit = formatIncidentUnit(incident);
  const status = incident.status ?? statusFromProgress(incident.progress);

  return (
    <div className="incident-drawer-overlay" onClick={onClose}>
      <div
        className="incident-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="incident-drawer-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="incident-drawer-head">
          <h3 id="incident-drawer-title">
            {incident.road || "—"} · {incident.km || "—"} · {incident.type || "—"}
          </h3>
          <button type="button" className="incident-drawer-close" onClick={onClose} aria-label="Đóng">
            ×
          </button>
        </div>

        <div className="incident-drawer-body">
          <div className="incident-drawer-grid">
            <DetailField label="Tuyến:" value={incident.road} />
            <DetailField label="Lý trình:" value={incident.km} />
            <DetailField label="Phía:" value={positionLabel(incident.position)} />
            <DetailField label="Loại:" value={incident.type} />
            <DetailField label="Nhóm:" value={incident.groupName} />
            <DetailField label="Kích thước:" value={formatIncidentSize(incident)} />
            <DetailField
              label="Khối lượng:"
              value={vol > 0 ? `${formatKhoiLuong(incident)} ${volUnit !== "—" ? volUnit : ""}`.trim() : "—"}
            />
            <DetailField label="Tiến độ:" value={progressLabelPct(incident.progress)} />
            <DetailField label="Trạng thái:" value={statusLabel(status)} />
            <DetailField label="Người tạo:" value={incident.createdByName} />
            <DetailField label="Ngày xảy ra:" value={incident.date} />
            <DetailField label="Ngày hoàn thành:" value={incident.completedDate} />
          </div>

          {(importNote || suggestedSection) && (
            <div className="incident-drawer-nk">
              {suggestedSection && (
                <p>
                  <span className="incident-drawer-label">Gợi ý mục NK:</span> {suggestedSection}
                </p>
              )}
              {importNote && (
                <p className="incident-drawer-import">
                  <span className="incident-drawer-label">Đã đưa vào nhật ký:</span> {importNote}
                </p>
              )}
            </div>
          )}

          {incident.note && (
            <p className="incident-drawer-note">
              <span className="incident-drawer-label">Ghi chú:</span> {incident.note}
            </p>
          )}

          <p className="incident-drawer-muted incident-drawer-photo-hint">
            Bấm <span className="incident-drawer-hint-strong">✓</span> chọn ảnh, điền{" "}
            <span className="incident-drawer-hint-strong">STT</span> ở ô dưới mỗi ảnh (HT / XL xen kẽ
            tùy STT).
          </p>
          {saveError ? <p className="incident-drawer-error">{saveError}</p> : null}

          <IncidentImageGallery
            beforeUrls={beforeUrls}
            afterUrls={afterUrls}
            selection={
              uid
                ? {
                    beforeUrls: reportSlots
                      .filter((s) => s.kind === "before")
                      .map((s) => s.url),
                    afterUrls: reportSlots
                      .filter((s) => s.kind === "after")
                      .map((s) => s.url),
                    orderIndex: (kind, url) => reportSlotOrderIndex(reportSlots, kind, url),
                    onOrderChange: handleOrderChange,
                    onToggle: handleToggle,
                    onSelectAll: handleSelectAll,
                    onClearAll: handleClearAll
                  }
                : undefined
            }
          />

          <div className="incident-drawer-section">
            <p className="incident-drawer-section-title">Lịch sử</p>
            <IncidentTimeline incident={incident} />
          </div>
        </div>
      </div>
    </div>
  );
}
