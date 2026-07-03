import { useEffect, useState } from "react";
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
  resolveSelectedImageUrls,
  selectAllImageRefs,
  statusFromProgress,
  statusLabel,
  toggleSelectedImageRef,
  joinSelectedImageRefs
} from "../utils/incidentUtils";
import { updateSelectedReportPhoto } from "../services/incidentsService";
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
  const [selBefore, setSelBefore] = useState([]);
  const [selAfter, setSelAfter] = useState([]);
  const [saveError, setSaveError] = useState("");

  const beforeUrls = incident ? beforeConstructionImages(incident) : [];
  const afterUrls = incident ? afterConstructionImages(incident) : [];

  useEffect(() => {
    if (!incident) return;
    setSelBefore(resolveSelectedImageUrls(beforeUrls, incident.selectedBefore));
    setSelAfter(resolveSelectedImageUrls(afterUrls, incident.selectedAfter));
    setSaveError("");
  }, [incident?.id, incident?.selectedBefore, incident?.selectedAfter]);

  async function persistSelection(kind, value, nextBefore, nextAfter) {
    if (!incident || !uid) return;
    const field = kind === "before" ? "selectedBefore" : "selectedAfter";
    if (kind === "before") setSelBefore(nextBefore);
    else setSelAfter(nextAfter);
    try {
      await updateSelectedReportPhoto(uid, incident.id, field, value);
      setSaveError("");
    } catch {
      setSaveError("Không lưu được lựa chọn ảnh.");
      setSelBefore(resolveSelectedImageUrls(beforeUrls, incident.selectedBefore));
      setSelAfter(resolveSelectedImageUrls(afterUrls, incident.selectedAfter));
    }
  }

  function handleToggle(kind, url) {
    if (!incident) return;
    const pool = kind === "before" ? beforeUrls : afterUrls;
    const currentRef =
      kind === "before" ? joinSelectedImageRefs(selBefore) : joinSelectedImageRefs(selAfter);
    const nextRef = toggleSelectedImageRef(pool, currentRef, url);
    const nextBefore =
      kind === "before" ? resolveSelectedImageUrls(beforeUrls, nextRef) : selBefore;
    const nextAfter =
      kind === "after" ? resolveSelectedImageUrls(afterUrls, nextRef) : selAfter;
    void persistSelection(kind, nextRef, nextBefore, nextAfter);
  }

  function handleSelectAll(kind) {
    if (!incident) return;
    const pool = kind === "before" ? beforeUrls : afterUrls;
    const nextRef = selectAllImageRefs(pool);
    const nextBefore = kind === "before" ? pool : selBefore;
    const nextAfter = kind === "after" ? pool : selAfter;
    void persistSelection(kind, nextRef, nextBefore, nextAfter);
  }

  function handleClearAll(kind) {
    if (!incident) return;
    const nextBefore = kind === "before" ? [] : selBefore;
    const nextAfter = kind === "after" ? [] : selAfter;
    void persistSelection(kind, "", nextBefore, nextAfter);
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
            Tick góc ảnh để chọn nhiều ảnh ghép Word · «Chọn tất» chọn hết ảnh trong mục Hiện trạng / Sau xử lý.
          </p>
          {saveError ? <p className="incident-drawer-error">{saveError}</p> : null}

          <IncidentImageGallery
            beforeUrls={beforeUrls}
            afterUrls={afterUrls}
            selection={
              uid
                ? {
                    beforeUrls: selBefore,
                    afterUrls: selAfter,
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
