import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useRoadWorkspace } from "../context/RoadWorkspaceContext";
import ViDateInput from "../components/ViDateInput";
import {
  fetchMyIncidents,
  softDeleteIncident,
  subscribeMyIncidents
} from "../services/incidentsService";
import {
  buildBaoCaoSuCoFilename,
  exportIncidentsExcel
} from "../services/incidentExportService";
import {
  formatDimValue,
  formatIncidentUnit,
  formatKhoiLuong,
  isHighVolumeM3,
  positionLabel,
  splitVolumeByGeology,
  statusLabel,
  dispatchFilterStatus
} from "../utils/incidentUtils";
import { applyDispatchFilters, computeDispatchSummary, sortedVolumeEntries, formatVolumeValue } from "../utils/incidentStats";
import { sortIncidentsByKm, buildDuplicateChainageKeySet, chainageDedupeKey } from "@quanlysuco/shared";
import {
  formatImportNote,
  getImportRecord,
  importIncidentsToNhatKy,
  isImportableIncident,
  suggestNhatKySection
} from "../utils/incidentImport";
import { loadImportMap } from "../services/nhatKyImportService";
import { formatDisplayDate } from "../utils/nhatKyFormat";
import ImportNhatKyModal from "../components/ImportNhatKyModal";
import IncidentDetailDrawer from "../components/IncidentDetailDrawer";
import IncidentFormModal from "../components/IncidentFormModal";
import IncidentTrashModal from "../components/IncidentTrashModal";
import IncidentCreateBulkDialog from "../components/IncidentCreateBulkDialog";
import HienTruongResizableTh from "../components/HienTruongResizableTh";
import { IconEye, IconPencil, IconTrash } from "../components/HienTruongActionIcons";
import { HIEN_TRUONG_DISPATCH_COLS, useHienTruongDispatchColWidths } from "../hooks/useHienTruongDispatchColWidths";
import WordExportDialog from "../components/WordExportDialog";

const EMPTY_FILTERS = {
  road: "",
  groupName: "",
  type: "",
  status: "",
  dateFrom: "",
  dateTo: "",
  chainageQuery: ""
};

export default function HienTruongPage({ storageTick = 0, onImported }) {
  const { profile } = useAuth();
  const { storageKey } = useRoadWorkspace();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [detailIncident, setDetailIncident] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [importMap, setImportMap] = useState({});
  const [importMapLoading, setImportMapLoading] = useState(true);
  const [checkedIds, setCheckedIds] = useState(() => new Set());
  const [importMessage, setImportMessage] = useState("");
  const [showImportModal, setShowImportModal] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [wordOpen, setWordOpen] = useState(false);
  const [formState, setFormState] = useState({ open: false, mode: "edit", incident: null });
  const [showTrash, setShowTrash] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { widths, tableWidth, startColumnResize } = useHienTruongDispatchColWidths();

  function openEdit(inc, event) {
    event?.stopPropagation();
    setFormState({ open: true, mode: "edit", incident: inc });
  }

  function closeForm() {
    setFormState((prev) => ({ ...prev, open: false }));
  }

  async function handleDelete(inc, event) {
    event?.stopPropagation();
    if (!profile?.uid) return;
    if (!window.confirm(`Chuyển sự cố "${inc.type || ""}" vào thùng rác? Giữ 7 ngày — có thể khôi phục.`)) return;
    try {
      await softDeleteIncident(profile.uid, inc.id);
    } catch {
      window.alert("Không xoá được. Kiểm tra mạng/quyền truy cập.");
    }
  }

  async function reload() {
    if (!profile?.uid) return;
    setLoading(true);
    setError("");
    try {
      const data = await fetchMyIncidents(profile.uid);
      setItems(data);
      setLastSyncAt(new Date());
    } catch {
      setError("Không tải được dữ liệu sự cố.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!profile?.uid) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const unsub = subscribeMyIncidents(
      profile.uid,
      (data) => {
        setItems(data);
        setLastSyncAt(new Date());
        setLoading(false);
        setError("");
      },
      () => {
        setError("Không tải được dữ liệu sự cố. Kiểm tra mạng hoặc đăng nhập lại.");
        setLoading(false);
      }
    );
    return unsub;
  }, [profile?.uid]);

  useEffect(() => {
    if (!profile?.uid) {
      setImportMap({});
      setImportMapLoading(false);
      return;
    }
    let cancelled = false;
    setImportMapLoading(true);
    void loadImportMap(profile.uid, storageKey).then((map) => {
      if (!cancelled) {
        setImportMap(map);
        setImportMapLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [profile?.uid, storageKey, storageTick]);

  const roads = useMemo(() => [...new Set(items.map((i) => i.road).filter(Boolean))], [items]);
  const groups = useMemo(() => [...new Set(items.map((i) => i.groupName).filter(Boolean))], [items]);
  const types = useMemo(() => [...new Set(items.map((i) => i.type).filter(Boolean))], [items]);

  const filtered = useMemo(
    () => sortIncidentsByKm(applyDispatchFilters(items, filters)),
    [items, filters]
  );

  const summary = useMemo(() => computeDispatchSummary(filtered), [filtered]);
  const duplicateKeys = useMemo(() => buildDuplicateChainageKeySet(filtered), [filtered]);
  const hasHighVolume = useMemo(() => filtered.some(isHighVolumeM3), [filtered]);
  const hasDuplicate = duplicateKeys.size > 0;

  const importableFiltered = useMemo(
    () => filtered.filter((inc) => isImportableIncident(inc, importMap)),
    [filtered, importMap]
  );

  const selectedForImport = useMemo(
    () => items.filter((inc) => checkedIds.has(inc.id)),
    [items, checkedIds]
  );

  function setFilter(name, value) {
    setFilters((prev) => ({ ...prev, [name]: value }));
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
  }

  function toggleCheck(id, event) {
    event.stopPropagation();
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllImportable() {
    const ids = importableFiltered.map((inc) => inc.id);
    const allSelected = ids.length > 0 && ids.every((id) => checkedIds.has(id));
    if (allSelected) {
      setCheckedIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setCheckedIds((prev) => new Set([...prev, ...ids]));
    }
  }

  function openImportModal() {
    if (checkedIds.size === 0) {
      window.alert("Chọn ít nhất một sự cố để đưa vào nhật ký.");
      return;
    }
    setShowImportModal(true);
  }

  async function handleExportExcel() {
    if (filtered.length === 0) {
      window.alert("Không có dữ liệu để xuất.");
      return;
    }
    setExporting(true);
    try {
      await exportIncidentsExcel(
        filtered,
        buildBaoCaoSuCoFilename(filtered, filters),
        { groupFilter: filters.groupName }
      );
    } catch {
      window.alert("Không xuất được file Excel.");
    } finally {
      setExporting(false);
    }
  }

  async function handleImportConfirm({ nhatKyDate, sectionMode, incidentIds }) {
    try {
      const result = await importIncidentsToNhatKy(
        items,
        incidentIds,
        nhatKyDate,
        storageKey,
        profile?.uid,
        sectionMode
      );
      setImportMap(result.importMap);
      setCheckedIds(new Set());
      setShowImportModal(false);
      onImported?.(nhatKyDate);
      if (result.added === 0) {
        const reasons = result.skipped.map((s) => s.reason).slice(0, 3).join("; ");
        setImportMessage(`Không thêm được dòng nào. ${reasons}`);
        return;
      }
      const skipNote = result.skipped.length > 0 ? ` (${result.skipped.length} dòng bỏ qua)` : "";
      setImportMessage(
        `Đã đưa ${result.added} sự cố vào nhật ký ngày ${formatDisplayDate(nhatKyDate)}${skipNote}.`
      );
    } catch {
      window.alert("Không lưu được trạng thái import lên Firestore.");
    }
  }

  function openDetail(inc) {
    setDetailIncident(inc);
    setDetailOpen(true);
  }

  function handleRowClick(inc, event) {
    const target = event.target;
    if (target.closest?.("button, a, input, label, textarea, select")) return;
    openDetail(inc);
  }

  function closeDetail() {
    setDetailOpen(false);
    setDetailIncident(null);
  }

  function typeCellHighlightClass(inc) {
    if (isHighVolumeM3(inc)) return "hientruong-cell--high-vol";
    const key = chainageDedupeKey(inc);
    if (key && duplicateKeys.has(key)) return "hientruong-cell--dup-km";
    return "";
  }

  return (
    <div className="hientruong-page hientruong-page--dispatch">
      <header className="hientruong-dispatch-head">
        <div className="hientruong-dispatch-meta">
          <div className="hientruong-kl-badges">
            {sortedVolumeEntries(summary.volumeByUnit).length === 0 ? (
              <span className="hientruong-kl-badge">Tổng KL: 0</span>
            ) : (
              sortedVolumeEntries(summary.volumeByUnit).map(([unit, val]) => (
                <span key={unit} className="hientruong-kl-badge">
                  Tổng KL ({unit}): {formatVolumeValue(val)}
                </span>
              ))
            )}
          </div>
          <p className="hientruong-dispatch-sub">
            <strong>{filtered.length}</strong> sự cố sau lọc · Lý trình tăng dần
            {profile?.email && <> · <span>{profile.email}</span></>}
            {lastSyncAt && <> · {lastSyncAt.toLocaleTimeString("vi-VN")}</>}
            {" · "}
            <span>Bấm dòng để xem chi tiết</span>
            {hasHighVolume && (
              <span className="hientruong-legend hientruong-legend--red"> Đỏ = trên 100 m³</span>
            )}
            {hasDuplicate && (
              <span className="hientruong-legend hientruong-legend--yellow"> Vàng = trùng lý trình</span>
            )}
          </p>
          {importMessage && <p className="hientruong-import-msg">{importMessage}</p>}
        </div>
        <div className="hientruong-dispatch-actions">
          <button type="button" className="btn-secondary btn-primary--compact" onClick={() => void reload()}>
            Tải lại
          </button>
          <button type="button" className="btn-primary btn-primary--compact" onClick={() => setCreateOpen(true)}>
            + Thêm sự cố
          </button>
          <button
            type="button"
            className="btn-secondary btn-primary--compact"
            disabled={exporting || filtered.length === 0}
            onClick={() => void handleExportExcel()}
          >
            Xuất Excel
          </button>
          <button
            type="button"
            className="btn-secondary btn-primary--compact"
            disabled={filtered.length === 0}
            onClick={() => setWordOpen(true)}
          >
            Xuất Word (ảnh)
          </button>
          <button type="button" className="btn-secondary btn-primary--compact" onClick={() => setShowTrash(true)}>
            Thùng rác
          </button>
          <button
            type="button"
            className="btn-primary btn-primary--compact"
            onClick={openImportModal}
            disabled={checkedIds.size === 0}
            title={`Đã chọn ${checkedIds.size}`}
          >
            Đưa vào NK ({checkedIds.size})
          </button>
        </div>
      </header>

      <div className="hientruong-dispatch-filters">
        <label className="hientruong-filter-field">
          <span className="entry-form-label">Tuyến đường</span>
          <select className="sidebar-input" value={filters.road} onChange={(e) => setFilter("road", e.target.value)}>
            <option value="">Tất cả tuyến</option>
            {roads.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </label>
        <label className="hientruong-filter-field">
          <span className="entry-form-label">Lý trình</span>
          <input
            className="sidebar-input"
            placeholder="vd: 8+995"
            value={filters.chainageQuery}
            onChange={(e) => setFilter("chainageQuery", e.target.value)}
          />
        </label>
        <label className="hientruong-filter-field">
          <span className="entry-form-label">Từ ngày</span>
          <ViDateInput
            className="sidebar-input"
            hideCalendarButton
            value={filters.dateFrom}
            onChange={(iso) => setFilter("dateFrom", iso)}
          />
        </label>
        <label className="hientruong-filter-field">
          <span className="entry-form-label">Đến ngày</span>
          <ViDateInput
            className="sidebar-input"
            hideCalendarButton
            value={filters.dateTo}
            onChange={(iso) => setFilter("dateTo", iso)}
          />
        </label>
        <label className="hientruong-filter-field">
          <span className="entry-form-label">Nhóm sự cố</span>
          <select className="sidebar-input" value={filters.groupName} onChange={(e) => setFilter("groupName", e.target.value)}>
            <option value="">Tất cả</option>
            {groups.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </label>
        <label className="hientruong-filter-field">
          <span className="entry-form-label">Loại sự cố</span>
          <select className="sidebar-input" value={filters.type} onChange={(e) => setFilter("type", e.target.value)}>
            <option value="">Tất cả</option>
            {types.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="hientruong-filter-field">
          <span className="entry-form-label">Tiến độ</span>
          <select className="sidebar-input" value={filters.status} onChange={(e) => setFilter("status", e.target.value)}>
            <option value="">Tất cả</option>
            <option value="NEW">Chưa xử lý</option>
            <option value="PARTIAL">Đang xử lý</option>
            <option value="DONE">Hoàn thành</option>
          </select>
        </label>
        <div className="hientruong-filter-field hientruong-filter-field--action">
          <span className="entry-form-label" aria-hidden="true">
            &nbsp;
          </span>
          <button type="button" className="btn-secondary btn-primary--compact hientruong-clear-filter" onClick={clearFilters}>
            Xóa lọc
          </button>
        </div>
      </div>

      <main className="hientruong-main hientruong-main--dispatch">
        {loading && <p className="section-guide">Đang tải dữ liệu...</p>}
        {importMapLoading && !loading && <p className="section-guide">Đang đồng bộ trạng thái nhật ký...</p>}
        {error && <p className="nhatky-login-error">{error}</p>}
        {!loading && !error && filtered.length === 0 && (
          <p className="section-guide">Không có sự cố phù hợp bộ lọc.</p>
        )}

        <div className="hientruong-table-wrap hientruong-table-wrap--dispatch">
          <table
            className="hientruong-table hientruong-table--dispatch"
            style={{ width: tableWidth, minWidth: tableWidth }}
          >
            <colgroup>
              {HIEN_TRUONG_DISPATCH_COLS.map((c) => (
                <col key={c.key} style={{ width: widths[c.key] }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th className="hientruong-col-check">
                  <input
                    type="checkbox"
                    title="Chọn đưa vào nhật ký"
                    checked={importableFiltered.length > 0 && importableFiltered.every((inc) => checkedIds.has(inc.id))}
                    onChange={toggleSelectAllImportable}
                    disabled={importableFiltered.length === 0}
                  />
                </th>
                <HienTruongResizableTh colKey="road" onResizeStart={startColumnResize}>Tuyến</HienTruongResizableTh>
                <HienTruongResizableTh colKey="km" onResizeStart={startColumnResize}>Lý trình</HienTruongResizableTh>
                <HienTruongResizableTh colKey="side" onResizeStart={startColumnResize}>Phía</HienTruongResizableTh>
                <HienTruongResizableTh colKey="type" onResizeStart={startColumnResize}>Loại sự cố</HienTruongResizableTh>
                <HienTruongResizableTh colKey="dai" onResizeStart={startColumnResize}>Dài</HienTruongResizableTh>
                <HienTruongResizableTh colKey="rong" onResizeStart={startColumnResize}>Rộng</HienTruongResizableTh>
                <HienTruongResizableTh colKey="cao" onResizeStart={startColumnResize}>Cao</HienTruongResizableTh>
                <HienTruongResizableTh colKey="unit" onResizeStart={startColumnResize}>ĐVT</HienTruongResizableTh>
                <HienTruongResizableTh colKey="volDat" onResizeStart={startColumnResize}>KL đất</HienTruongResizableTh>
                <HienTruongResizableTh colKey="volDa" onResizeStart={startColumnResize}>KL đá</HienTruongResizableTh>
                <HienTruongResizableTh colKey="vol" onResizeStart={startColumnResize}>KL</HienTruongResizableTh>
                <HienTruongResizableTh colKey="note" onResizeStart={startColumnResize}>Ghi chú</HienTruongResizableTh>
                <HienTruongResizableTh colKey="progress" onResizeStart={startColumnResize}>Tiến độ</HienTruongResizableTh>
                <HienTruongResizableTh colKey="date" onResizeStart={startColumnResize}>Ngày xảy ra</HienTruongResizableTh>
                <HienTruongResizableTh colKey="completedDate" onResizeStart={startColumnResize}>Hoàn thành</HienTruongResizableTh>
                <HienTruongResizableTh colKey="section" onResizeStart={startColumnResize}>Mục NK</HienTruongResizableTh>
                <HienTruongResizableTh colKey="imported" onResizeStart={startColumnResize}>Đã vào NK</HienTruongResizableTh>
                <HienTruongResizableTh colKey="actions" fixed onResizeStart={startColumnResize}>Thao tác</HienTruongResizableTh>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inc) => {
                const importRecord = getImportRecord(importMap, inc.id);
                const suggestedSection = suggestNhatKySection(inc);
                const canImport = isImportableIncident(inc, importMap);
                const geo = splitVolumeByGeology(inc);
                const status = dispatchFilterStatus(inc);
                return (
                  <tr
                    key={inc.id}
                    className={[
                      detailOpen && detailIncident?.id === inc.id ? "is-selected" : "",
                      importRecord ? "is-imported" : ""
                    ].filter(Boolean).join(" ")}
                    onClick={(e) => handleRowClick(inc, e)}
                    title="Bấm dòng để xem chi tiết sự cố"
                  >
                    <td className="hientruong-col-check" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={checkedIds.has(inc.id)}
                        disabled={!canImport}
                        onChange={(e) => toggleCheck(inc.id, e)}
                      />
                    </td>
                    <td>{inc.road}</td>
                    <td>{inc.km}</td>
                    <td>{positionLabel(inc.position)}</td>
                    <td className={typeCellHighlightClass(inc)} title={inc.type}>{inc.type}</td>
                    <td className="hientruong-num">{formatDimValue(inc.dai)}</td>
                    <td className="hientruong-num">{formatDimValue(inc.rong)}</td>
                    <td className="hientruong-num">{formatDimValue(inc.cao)}</td>
                    <td>{formatIncidentUnit(inc)}</td>
                    <td className="hientruong-num">{geo.soil != null ? formatDimValue(geo.soil) : "—"}</td>
                    <td className="hientruong-num">{geo.rock != null ? formatDimValue(geo.rock) : "—"}</td>
                    <td className="hientruong-num">{formatKhoiLuong(inc)}</td>
                    <td className="hientruong-note" title={inc.note}>{inc.note || "—"}</td>
                    <td>
                      <span className={`hientruong-status hientruong-status--${status.toLowerCase()}`}>
                        {statusLabel(status)} {inc.progress ?? 0}%
                      </span>
                    </td>
                    <td>{inc.date}</td>
                    <td>{inc.completedDate || "—"}</td>
                    <td>{importRecord?.section || suggestedSection || "—"}</td>
                    <td className="hientruong-import-cell">
                      {importRecord ? (
                        <span className="hientruong-import-badge" title={formatImportNote(importRecord)}>
                          {formatDisplayDate(importRecord.nhatKyDate)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="hientruong-col-actions hientruong-actions" onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="hientruong-row-btn" title="Xem chi tiết" onClick={(e) => { e.stopPropagation(); openDetail(inc); }}>
                        <IconEye />
                      </button>
                      <button type="button" className="hientruong-row-btn" title="Sửa" onClick={(e) => openEdit(inc, e)}>
                        <IconPencil />
                      </button>
                      <button type="button" className="hientruong-row-btn hientruong-row-btn--danger" title="Xoá" onClick={(e) => handleDelete(inc, e)}>
                        <IconTrash />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <IncidentDetailDrawer
          incident={detailIncident}
          open={detailOpen && Boolean(detailIncident)}
          onClose={closeDetail}
          uid={profile?.uid}
          suggestedSection={detailIncident ? suggestNhatKySection(detailIncident) || "" : ""}
          importNote={
            detailIncident && getImportRecord(importMap, detailIncident.id)
              ? formatImportNote(getImportRecord(importMap, detailIncident.id))
              : ""
          }
        />
      </main>

      <ImportNhatKyModal
        open={showImportModal}
        selectedIncidents={selectedForImport}
        onClose={() => setShowImportModal(false)}
        onConfirm={handleImportConfirm}
      />

      <IncidentCreateBulkDialog
        open={createOpen}
        uid={profile?.uid}
        profile={profile}
        onClose={() => setCreateOpen(false)}
        onCreated={() => void reload()}
      />

      <IncidentFormModal
        open={formState.open}
        mode={formState.mode}
        incident={formState.incident}
        uid={profile?.uid}
        profile={profile}
        extraRoads={roads}
        onClose={closeForm}
        onSaved={() => void reload()}
      />

      <IncidentTrashModal open={showTrash} uid={profile?.uid} onClose={() => setShowTrash(false)} onChanged={() => void reload()} />

      <WordExportDialog open={wordOpen} onClose={() => setWordOpen(false)} items={filtered} filters={filters} />
    </div>
  );
}
