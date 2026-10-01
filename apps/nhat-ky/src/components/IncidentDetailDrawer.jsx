import { useEffect, useRef, useState } from "react";
import {
  afterConstructionImages,
  assignReportSlotOrder,
  beforeConstructionImages,
  buildIncidentTimelineEvents,
  clearReportImageSlots,
  encodeReportImageOrder,
  formatDimValue,
  formatIncidentUnit,
  formatKhoiLuong,
  formatTimelineDate,
  legacyRefsFromReportSlots,
  positionLabel,
  progressLabelPct,
  reportImageSlots,
  reportSlotOrderIndex,
  selectAllReportImageSlots,
  clampProgress,
  splitVolumeByGeology,
  statusFromProgress,
  statusLabel,
  toggleReportImageSlot,
  webDisplayImageUrls,
  countHiddenLocalImages,
  isBaoLuGroup,
  dispatchFilterStatus
} from "../utils/incidentUtils";
import {
  updateIncidentProgressFields,
  updateReportImageSelection,
  updateWordMergeChecked
} from "../services/incidentsService";
import { removeIncidentImage } from "../services/incidentPhotoService";
import IncidentImageGallery from "./IncidentImageGallery";

function displayValue(value) {
  const s = String(value ?? "").trim();
  return s || "—";
}

function BasicItem({ label, children }) {
  return (
    <div className="incident-detail-basic-item">
      <span className="incident-detail-basic-label">{label}</span>
      <div className="incident-detail-basic-value">{children || "—"}</div>
    </div>
  );
}

function AccordionSection({ title, open, onToggle, children, className = "" }) {
  const sectionRef = useRef(null);

  useEffect(() => {
    if (!open || !sectionRef.current) return;
    const id = window.requestAnimationFrame(() => {
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  return (
    <section ref={sectionRef} className={`incident-detail-accordion ${className}`.trim()}>
      <button
        type="button"
        className="incident-detail-accordion-trigger"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span>{title}</span>
        <span className={`incident-detail-accordion-chevron${open ? " is-open" : ""}`} aria-hidden>
          ▾
        </span>
      </button>
      {open ? <div className="incident-detail-accordion-body">{children}</div> : null}
    </section>
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
  const [savingMeta, setSavingMeta] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

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

  useEffect(() => {
    if (!open) return;
    setIsDetailsOpen(false);
    setIsHistoryOpen(false);
  }, [incident?.id, open]);

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
      if (
        isBaoLuGroup(localIncident.groupName) &&
        nextSlots.length > 0 &&
        !localIncident.wordMergeChecked
      ) {
        await updateWordMergeChecked(uid, localIncident.id, true);
        setLocalIncident((prev) => (prev ? { ...prev, wordMergeChecked: true } : prev));
      }
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

  function handleSelectAllPhotos() {
    if (!localIncident) return;
    let next = selectAllReportImageSlots(reportSlots, "before", beforeUrls);
    next = selectAllReportImageSlots(next, "after", afterUrls);
    void persistReportSlots(next);
  }

  function handleClearAllPhotos() {
    if (!localIncident) return;
    void persistReportSlots([]);
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
        updates: patch.updates,
        reportImageOrder: patch.reportImageOrder,
        selectedBefore: patch.selectedBefore,
        selectedAfter: patch.selectedAfter
      });
      setReportSlots(patch.slots);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setSaveError(msg && !msg.includes("Firebase") ? msg : "Không xóa được ảnh.");
    } finally {
      setDeletingUrl(null);
    }
  }

  async function handleProgressChange(raw) {
    if (!localIncident || !uid || savingMeta) return;
    const p = clampProgress(raw);
    setSavingMeta(true);
    setSaveError("");
    try {
      const result = await updateIncidentProgressFields(uid, localIncident.id, {
        progress: p
      });
      setLocalIncident({
        ...localIncident,
        progress: result.progress ?? p,
        status: result.status ?? statusFromProgress(p)
      });
    } catch {
      setSaveError("Không lưu được tiến độ.");
    } finally {
      setSavingMeta(false);
    }
  }

  if (!open || !incident || !localIncident) return null;

  const status = localIncident.status ?? statusFromProgress(localIncident.progress);
  const filterStatus = dispatchFilterStatus(localIncident);
  const historyCount = buildIncidentTimelineEvents(localIncident).length;
  const selectedPhotoCount = reportSlots.length;
  const totalPhotoCount = beforeUrls.length + afterUrls.length;
  const geo = splitVolumeByGeology(localIncident);

  return (
    <div className="incident-drawer-overlay" onClick={onClose}>
      <div
        className="incident-drawer incident-drawer--detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby="incident-drawer-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="incident-drawer-head incident-drawer-head--sticky">
          <div className="incident-detail-head-main">
            <h3 id="incident-drawer-title">
              {displayValue(localIncident.road)} · {displayValue(localIncident.km)}
            </h3>
            <p className="incident-detail-head-sub">
              {displayValue(localIncident.type)}
              <span className="incident-detail-head-sep" aria-hidden>
                ·
              </span>
              {displayValue(localIncident.groupName)}
            </p>
          </div>
          <div className="incident-detail-head-meta">
            <span
              className={`incident-detail-status-badge incident-detail-status-badge--${filterStatus.toLowerCase()}`}
            >
              {statusLabel(status)}
            </span>
            <span className="incident-detail-progress-pill">
              {clampProgress(localIncident.progress)}%
            </span>
            <button
              type="button"
              className="incident-drawer-close"
              onClick={onClose}
              aria-label="Đóng"
            >
              ×
            </button>
          </div>
        </div>

        <div className="incident-drawer-body incident-drawer-body--detail">
          <section className="incident-detail-basics" aria-label="Thông tin cơ bản">
            <table className="incident-detail-basics-table">
              <thead>
                <tr>
                  <th scope="col">Phía</th>
                  <th scope="col">Dài</th>
                  <th scope="col">Rộng</th>
                  <th scope="col">Cao</th>
                  <th scope="col">ĐVT</th>
                  <th scope="col">KL đất</th>
                  <th scope="col">KL đá</th>
                  <th scope="col">KL tổng</th>
                  <th scope="col">Ngày xảy ra</th>
                  <th scope="col">Hoàn thành</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{displayValue(positionLabel(localIncident.position))}</td>
                  <td className="incident-detail-basics-num">
                    {formatDimValue(localIncident.dai)}
                  </td>
                  <td className="incident-detail-basics-num">
                    {formatDimValue(localIncident.rong)}
                  </td>
                  <td className="incident-detail-basics-num">
                    {formatDimValue(localIncident.cao)}
                  </td>
                  <td>{formatIncidentUnit(localIncident)}</td>
                  <td className="incident-detail-basics-num">
                    {geo.soil != null ? formatDimValue(geo.soil) : "—"}
                  </td>
                  <td className="incident-detail-basics-num">
                    {geo.rock != null ? formatDimValue(geo.rock) : "—"}
                  </td>
                  <td className="incident-detail-basics-num">
                    {formatKhoiLuong(localIncident)}
                  </td>
                  <td>{displayValue(localIncident.date)}</td>
                  <td>{displayValue(localIncident.completedDate)}</td>
                </tr>
              </tbody>
            </table>
          </section>

          {saveError ? <p className="incident-drawer-error">{saveError}</p> : null}
          {hiddenPhotoCount > 0 ? (
            <p className="incident-drawer-muted incident-drawer-photo-sync-hint">
              {hiddenPhotoCount} ảnh chưa có link cloud (chỉ lưu trên app). Dùng{" "}
              <strong>Khôi phục ảnh cloud</strong> trên trang Hiện trường để bổ sung.
            </p>
          ) : null}

          <IncidentImageGallery
            beforeUrls={beforeUrls}
            afterUrls={afterUrls}
            wordBarTitle="Ảnh dùng trong báo cáo Word"
            wordBarHint="Chọn ảnh và sắp xếp thứ tự xuất báo cáo."
            selectedSummary={
              totalPhotoCount > 0
                ? `Đã chọn ${selectedPhotoCount}/${totalPhotoCount} ảnh`
                : "Chưa có ảnh"
            }
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
                    onClearAll: handleClearAll,
                    onSelectAllPhotos: handleSelectAllPhotos,
                    onClearAllPhotos: handleClearAllPhotos
                  }
                : undefined
            }
            onDeletePhoto={uid ? handleDeletePhoto : undefined}
            deletingUrl={deletingUrl}
          />

          <AccordionSection
            title="Thông tin chi tiết"
            open={isDetailsOpen}
            onToggle={() => setIsDetailsOpen((v) => !v)}
          >
            <div className="incident-detail-meta-grid">
              <BasicItem label="Nhóm">{displayValue(localIncident.groupName)}</BasicItem>
              <BasicItem label="Trạng thái">{displayValue(statusLabel(status))}</BasicItem>
              <BasicItem label="Tiến độ">
                {uid ? (
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className="sidebar-input incident-drawer-date-input"
                    value={localIncident.progress ?? 0}
                    disabled={savingMeta}
                    onChange={(e) => {
                      const p = clampProgress(e.target.value);
                      setLocalIncident((prev) =>
                        prev
                          ? { ...prev, progress: p, status: statusFromProgress(p) }
                          : prev
                      );
                    }}
                    onBlur={(e) => void handleProgressChange(e.target.value)}
                    aria-label="Tiến độ phần trăm"
                  />
                ) : (
                  progressLabelPct(localIncident.progress)
                )}
              </BasicItem>
              {suggestedSection ? (
                <BasicItem label="Gợi ý mục NK">{displayValue(suggestedSection)}</BasicItem>
              ) : null}
              {importNote ? (
                <BasicItem label="Đã đưa vào nhật ký">{displayValue(importNote)}</BasicItem>
              ) : null}
              <BasicItem label="Người tạo">
                <span className="incident-detail-basic-value--wrap">
                  {displayValue(localIncident.createdByName)}
                </span>
              </BasicItem>
              <BasicItem label="Ghi chú">
                <span className="incident-detail-basic-value--wrap">
                  {displayValue(localIncident.note)}
                </span>
              </BasicItem>
            </div>
          </AccordionSection>

          <AccordionSection
            title={`Lịch sử hoạt động (${historyCount})`}
            open={isHistoryOpen}
            onToggle={() => setIsHistoryOpen((v) => !v)}
            className="incident-detail-accordion--history"
          >
            <div className="incident-detail-history-scroll">
              <IncidentTimeline incident={localIncident} />
            </div>
          </AccordionSection>
        </div>
      </div>
    </div>
  );
}
