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
  toggleReportImageSlot,
  webDisplayImageUrls,
  countHiddenLocalImages
} from "../utils/incidentUtils";
import { updateReportImageSelection } from "../services/incidentsService";
import { removeIncidentImage } from "../services/incidentPhotoService";
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
  const [localIncident, setLocalIncident] = useState(incident);
  const [deletingUrl, setDeletingUrl] = useState(null);

  const beforeAll = localIncident ? beforeConstructionImages(localIncident) : [];
  const afterAll = localIncident ? afterConstructionImages(localIncident) : [];
  const beforeUrls = webDisplayImageUrls(beforeAll);
  const afterUrls = webDisplayImageUrls(afterAll);
  const hiddenPhotoCount =
    countHiddenLocalImages(beforeAll) + countHiddenLocalImages(afterAll);

  useEffect(() => {
    if (!incident || !open) return;
    setLocalIncident(incident);
    setReportSlots(reportImageSlots(incident));
    setSaveError("");
  }, [incident?.id, open, incident]);

  async function persistReportSlots(nextSlots) {
    if (!localIncident || !uid) return;
    setReportSlots(nextSlots);
    const { selectedBefore, selectedAfter } = legacyRefsFromReportSlots(nextSlots);
    const reportImageOrder = encodeReportImageOrder(nextSlots);
    try {
      await updateReportImageSelection(
        uid,
        localIncident.id,
        reportImageOrder,
        selectedBefore,
        selectedAfter
      );
      setSaveError("");
    } catch {
      setSaveError("Không lưu được lựa chọn ảnh.");
      setReportSlots(reportImageSlots(localIncident));
    }
  }

  function handleToggle(kind, url) {
    if (!localIncident) return;
    void persistReportSlots(toggleReportImageSlot(reportSlots, kind, url));
  }

  function handleSelectAll(kind) {
    if (!localIncident) return;
    const pool = kind === "before" ? beforeUrls : afterUrls;
    void persistReportSlots(selectAllReportImageSlots(reportSlots, kind, pool));
  }

  function handleClearAll(kind) {
    if (!localIncident) return;
    void persistReportSlots(clearReportImageSlots(reportSlots, kind));
  }

  function handleOrderChange(kind, url, order) {
    if (!localIncident) return;
    void persistReportSlots(assignReportSlotOrder(reportSlots, kind, url, order));
  }

  async function handleDeletePhoto(kind, url) {
    if (!localIncident || !uid) return;
    if (!window.confirm("Bạn có chắc muốn xóa ảnh này không?")) return;
    setDeletingUrl(url);
    setSaveError("");
    try {
      const patch = await removeIncidentImage(uid, localIncident.id, localIncident, kind, url);
      setLocalIncident({
        ...localIncident,
        beforeImages: patch.beforeImages,
        afterImages: patch.afterImages,
        reportImageOrder: patch.reportImageOrder,
        selectedBefore: patch.selectedBefore,
        selectedAfter: patch.selectedAfter
      });
      setReportSlots(patch.slots);
    } catch {
      setSaveError("Không xóa được ảnh.");
    } finally {
      setDeletingUrl(null);
    }
  }

  if (!open || !incident || !localIncident) return null;

  const vol = computeKhoiLuong(localIncident);
  const volUnit = formatIncidentUnit(localIncident);
  const status = localIncident.status ?? statusFromProgress(localIncident.progress);

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
            {localIncident.road || "—"} · {localIncident.km || "—"} · {localIncident.type || "—"}
          </h3>
          <button type="button" className="incident-drawer-close" onClick={onClose} aria-label="Đóng">
            ×
          </button>
        </div>

        <div className="incident-drawer-body">
          <div className="incident-drawer-grid">
            <DetailField label="Tuyến:" value={localIncident.road} />
            <DetailField label="Lý trình:" value={localIncident.km} />
            <DetailField label="Phía:" value={positionLabel(localIncident.position)} />
            <DetailField label="Loại:" value={localIncident.type} />
            <DetailField label="Nhóm:" value={localIncident.groupName} />
            <DetailField label="Kích thước:" value={formatIncidentSize(localIncident)} />
            <DetailField
              label="Khối lượng:"
              value={vol > 0 ? `${formatKhoiLuong(localIncident)} ${volUnit !== "—" ? volUnit : ""}`.trim() : "—"}
            />
            <DetailField label="Tiến độ:" value={progressLabelPct(localIncident.progress)} />
            <DetailField label="Trạng thái:" value={statusLabel(status)} />
            <DetailField label="Người tạo:" value={localIncident.createdByName} />
            <DetailField label="Ngày xảy ra:" value={localIncident.date} />
            <DetailField label="Ngày hoàn thành:" value={localIncident.completedDate} />
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

          {localIncident.note && (
            <p className="incident-drawer-note">
              <span className="incident-drawer-label">Ghi chú:</span> {localIncident.note}
            </p>
          )}

          <p className="incident-drawer-muted incident-drawer-photo-hint">
            Bấm <span className="incident-drawer-hint-strong">✓</span> chọn ảnh, điền{" "}
            <span className="incident-drawer-hint-strong">STT</span> ở ô dưới mỗi ảnh (HT / XL xen kẽ
            tùy STT). Thùng rác ở góc dưới ảnh để xóa.
          </p>
          {hiddenPhotoCount > 0 ? (
            <p className="incident-drawer-muted incident-drawer-photo-sync-hint">
              {hiddenPhotoCount} ảnh chưa có link cloud (chỉ lưu trên app). Dùng{" "}
              <strong>Khôi phục ảnh cloud</strong> trên trang Hiện trường để bổ sung.
            </p>
          ) : null}
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
            onDeletePhoto={uid ? handleDeletePhoto : undefined}
            deletingUrl={deletingUrl}
          />

          <div className="incident-drawer-section">
            <p className="incident-drawer-section-title">Lịch sử</p>
            <IncidentTimeline incident={localIncident} />
          </div>
        </div>
      </div>
    </div>
  );
}
