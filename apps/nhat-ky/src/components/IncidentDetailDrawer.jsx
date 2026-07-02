import {
  afterConstructionImages,
  beforeConstructionImages,
  buildIncidentTimelineEvents,
  computeKhoiLuong,
  formatIncidentSize,
  formatIncidentUnit,
  formatKhoiLuong,
  formatTimelineDate,
  positionLabel,
  progressLabelPct,
  statusFromProgress,
  statusLabel
} from "../utils/incidentUtils";
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
  importNote = "",
  suggestedSection = ""
}) {
  if (!open || !incident) return null;

  const vol = computeKhoiLuong(incident);
  const volUnit = formatIncidentUnit(incident);
  const status = incident.status ?? statusFromProgress(incident.progress);
  const beforeUrls = beforeConstructionImages(incident);
  const afterUrls = afterConstructionImages(incident);

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

          <IncidentImageGallery beforeUrls={beforeUrls} afterUrls={afterUrls} />

          <div className="incident-drawer-section">
            <p className="incident-drawer-section-title">Lịch sử</p>
            <IncidentTimeline incident={incident} />
          </div>
        </div>
      </div>
    </div>
  );
}
