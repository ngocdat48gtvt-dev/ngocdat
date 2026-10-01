import { useEffect, useMemo, useState } from "react";
import { useRoadWorkspace } from "../context/RoadWorkspaceContext";
import ViDateInput from "../components/ViDateInput";
import {
  loadStorage,
  saveReportMeta
} from "../utils/nhatKyFormat";
import { fetchOfficeBookAsStorage } from "../services/officeBooksService";
import { overlayRemoteDaysInMemory } from "../utils/officeBooksLocal";
import { addDays, BAO_DUONG_MAX_DAYS } from "../utils/baoDuongFormat";
import { resolveReportMetaFromRoad } from "../utils/roadsCatalog";
import {
  BAO_DUONG_GROUPS,
  BAO_DUONG_QUALITY_EVENT,
  getMaintenanceWorksByGroup,
  getUnitForMaintenanceWork,
  resolveMaintenanceWorkLabel
} from "../utils/baoDuongQualityStore";
import {
  buildAtgtDiaryVolumeStats,
  buildVolumeStats,
  collectSelectedVolumeDetails,
  defaultDateRange,
  formatStatsNumber,
  inferSectionForWorkType,
  newContractVolume,
  thisQuarterDateRange
} from "../utils/volumeStatsFormat";
import ContractVolumeTable from "../components/ContractVolumeTable";
import StatsResultTable from "../components/StatsResultTable";
import AtgtDiaryStatsTable from "../components/AtgtDiaryStatsTable";
import VolumeDetailFormModal from "../components/VolumeDetailFormModal";

import SidebarResizer from "../components/SidebarResizer";
import { useResizableSidebar } from "../hooks/useResizableSidebar";

function StatusBadge({ row }) {
  if (row.status === "ok") {
    return <span className="stats-badge stats-badge--ok">Đủ HĐ</span>;
  }
  if (row.status === "short") {
    return (
      <span className="stats-badge stats-badge--short">
        Thiếu {formatStatsNumber(row.remaining)}
      </span>
    );
  }
  if (row.status === "pending") {
    return <span className="stats-badge stats-badge--pending">Chưa làm</span>;
  }
  return <span className="stats-badge stats-badge--muted">Chưa HĐ</span>;
}

export default function ThongKeKhoiLuong({ storageTick = 0, readOnly = false }) {
  const { storageKey, activeRoad, ownerUid, activeRoadId, offlineMode } = useRoadWorkspace();
  const { sidebarStyle, onResizeStart } = useResizableSidebar({ defaultWidth: 560, max: 720 });
  const defaults = defaultDateRange();
  const [dateFrom, setDateFrom] = useState(defaults.dateFrom);
  const [dateTo, setDateTo] = useState(defaults.dateTo);
  const [sectionFilter, setSectionFilter] = useState("");
  const [atgtKindFilter, setAtgtKindFilter] = useState("");
  const [expandedKey, setExpandedKey] = useState("");
  const [atgtExpandedKey, setAtgtExpandedKey] = useState("");
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [atgtSelectedKeys, setAtgtSelectedKeys] = useState([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailSource, setDetailSource] = useState("bdtx"); // bdtx | atgt
  const [mainTab, setMainTab] = useState("bdtx"); // bdtx | atgt
  const [saveMessage, setSaveMessage] = useState("");
  const [catalogTick, setCatalogTick] = useState(0);

  useEffect(() => {
    const onCatalog = () => setCatalogTick((n) => n + 1);
    window.addEventListener(BAO_DUONG_QUALITY_EVENT, onCatalog);
    return () => window.removeEventListener(BAO_DUONG_QUALITY_EVENT, onCatalog);
  }, []);

  const stored = useMemo(
    () => loadStorage(storageKey),
    [storageKey, storageTick]
  );
  const [rangeEntries, setRangeEntries] = useState(null);
  const [rangeLoading, setRangeLoading] = useState(false);

  useEffect(() => {
    setRangeEntries(null);
    if (!ownerUid || !activeRoadId || offlineMode || !dateFrom || !dateTo || dateFrom > dateTo) {
      setRangeLoading(false);
      return undefined;
    }
    let cancelled = false;
    setRangeLoading(true);
    const timer = setTimeout(() => {
      const from = addDays(dateFrom, -BAO_DUONG_MAX_DAYS);
      fetchOfficeBookAsStorage(ownerUid, activeRoadId, { dateFrom: from, dateTo })
        .then((remote) => {
          if (cancelled) return;
          const overlaid = overlayRemoteDaysInMemory(stored.entries, stored.dayMeta, remote);
          setRangeEntries(overlaid.entries);
        })
        .catch((err) => {
          console.warn("Không tải đủ sổ để thống kê khối lượng.", err);
          if (!cancelled) setRangeEntries(null);
        })
        .finally(() => {
          if (!cancelled) setRangeLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    ownerUid,
    activeRoadId,
    offlineMode,
    dateFrom,
    dateTo,
    storageKey,
    storageTick,
    stored.entries,
    stored.dayMeta
  ]);

  const sourceEntries = rangeEntries || stored.entries;

  const [contractVolumes, setContractVolumes] = useState([]);

  const reportMeta = useMemo(
    () => resolveReportMetaFromRoad(stored.reportMeta, activeRoad),
    [stored.reportMeta, activeRoad]
  );

  useEffect(() => {
    const saved = loadStorage(storageKey).reportMeta?.contractVolumes;
    const rows = Array.isArray(saved) ? saved : [];
    setContractVolumes(
      rows.map((row) => {
        const workType = resolveMaintenanceWorkLabel(row.workType) || row.workType;
        const section =
          row.section || inferSectionForWorkType(workType) || inferSectionForWorkType(row.workType);
        const unit =
          row.unit || getUnitForMaintenanceWork(workType) || getUnitForMaintenanceWork(row.workType);
        return { ...row, workType, section, unit: unit || row.unit || "m3" };
      })
    );
  }, [storageTick, storageKey]);

  const stats = useMemo(
    () =>
      buildVolumeStats(sourceEntries, contractVolumes, {
        dateFrom,
        dateTo,
        sectionFilter
      }),
    [sourceEntries, contractVolumes, dateFrom, dateTo, sectionFilter, catalogTick]
  );

  const atgtStats = useMemo(
    () =>
      buildAtgtDiaryVolumeStats(sourceEntries, {
        dateFrom,
        dateTo,
        kindFilter: atgtKindFilter
      }),
    [sourceEntries, dateFrom, dateTo, atgtKindFilter]
  );

  useEffect(() => {
    setSelectedKeys([]);
    setAtgtSelectedKeys([]);
  }, [dateFrom, dateTo, sectionFilter, atgtKindFilter, storageTick, storageKey]);

  const detailRows = useMemo(() => {
    if (detailSource === "atgt") {
      return collectSelectedVolumeDetails(atgtStats.rows, atgtSelectedKeys);
    }
    return collectSelectedVolumeDetails(stats.rows, selectedKeys);
  }, [detailSource, stats.rows, selectedKeys, atgtStats.rows, atgtSelectedKeys]);

  const bdtxDetailCount = useMemo(
    () => collectSelectedVolumeDetails(stats.rows, selectedKeys).length,
    [stats.rows, selectedKeys]
  );
  const atgtDetailCount = useMemo(
    () => collectSelectedVolumeDetails(atgtStats.rows, atgtSelectedKeys).length,
    [atgtStats.rows, atgtSelectedKeys]
  );

  function toggleSelect(key) {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  function toggleSelectAll(selectAll) {
    if (!selectAll) {
      setSelectedKeys([]);
      return;
    }
    setSelectedKeys(
      stats.rows.filter((r) => r.items?.length > 0).map((r) => r.key)
    );
  }

  function toggleAtgtSelect(key) {
    setAtgtSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  function toggleAtgtSelectAll(selectAll) {
    if (!selectAll) {
      setAtgtSelectedKeys([]);
      return;
    }
    setAtgtSelectedKeys(
      atgtStats.rows.filter((r) => r.items?.length > 0).map((r) => r.key)
    );
  }

  function openDetailExport(source) {
    setDetailSource(source);
    setDetailOpen(true);
  }

  function setThisMonth() {
    const d = defaultDateRange();
    setDateFrom(d.dateFrom);
    setDateTo(d.dateTo);
  }

  function setQuarter() {
    const d = thisQuarterDateRange();
    setDateFrom(d.dateFrom);
    setDateTo(d.dateTo);
  }

  function addContractLine(partial) {
    if (readOnly) return;
    setContractVolumes((prev) => [...prev, newContractVolume(partial)]);
  }

  function updateContract(id, patch) {
    if (readOnly) return;
    setContractVolumes((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const next = { ...row, ...patch };
        if (patch.workType != null) {
          if (patch.unit == null) {
            const unit = getUnitForMaintenanceWork(next.workType);
            if (unit) next.unit = unit;
          }
          if (!next.section) {
            const inferred = inferSectionForWorkType(next.workType);
            if (inferred) next.section = inferred;
          }
        }
        return next;
      })
    );
  }

  function removeContract(id) {
    if (readOnly) return;
    setContractVolumes((prev) => prev.filter((row) => row.id !== id));
  }

  function handleSaveContracts() {
    if (readOnly) return;
    const enriched = contractVolumes.map((row) => ({
      ...row,
      workType: String(row.workType || "").trim(),
      section: row.section || inferSectionForWorkType(row.workType)
    }));
    setContractVolumes(enriched);
    saveReportMeta({ ...reportMeta, contractVolumes: enriched }, storageKey);
    setSaveMessage("Đã lưu khối lượng hợp đồng (đồng bộ cloud).");
    setTimeout(() => setSaveMessage(""), 3000);
  }

  return (
    <div className="stats-page">
      <aside
        className="stats-sidebar stats-sidebar--contract"
        style={sidebarStyle}
      >
        <div className="stats-contract-block stats-contract-block--solo">
          <div className="stats-contract-head">
            <span className="stats-filter-label">
              Khối lượng hợp đồng
              {contractVolumes.length > 0 && (
                <span className="stats-contract-count"> ({contractVolumes.length})</span>
              )}
            </span>
            {!readOnly && (
              <button
                type="button"
                className="stats-add-btn"
                onClick={() => addContractLine()}
              >
                + Thêm
              </button>
            )}
          </div>

          {readOnly && (
            <p className="section-guide" style={{ margin: "0 0 8px" }}>
              Chỉ xem — ADMIN/VIEWER không sửa thống kê KL.
            </p>
          )}

          {contractVolumes.length === 0 ? (
            <p className="stats-empty-hint">
              {readOnly
                ? "Chưa có khối lượng hợp đồng trên cloud."
                : "Chưa kê khối lượng HĐ. Nhấn + Thêm để nhập."}
            </p>
          ) : (
            <ContractVolumeTable
              rows={contractVolumes}
              onUpdate={updateContract}
              onRemove={removeContract}
              readOnly={readOnly}
            />
          )}

          {!readOnly && (
            <div className="stats-contract-foot">
              <button type="button" className="btn-primary btn-primary--compact" onClick={handleSaveContracts}>
                Lưu khối lượng HĐ
              </button>
              {saveMessage && <p className="stats-save-msg">{saveMessage}</p>}
            </div>
          )}
        </div>
        <datalist id="stats-work-types">
          {Object.values(getMaintenanceWorksByGroup())
            .flat()
            .map((t) => (
              <option key={t} value={t} />
            ))}
        </datalist>
      </aside>

      <SidebarResizer onMouseDown={onResizeStart} />

      <main className="stats-main">
        <div className="stats-toolbar">
          <div className="stats-main-tabs" role="tablist" aria-label="Loại sổ thống kê">
            <button
              type="button"
              role="tab"
              aria-selected={mainTab === "bdtx"}
              className={`stats-main-tab${mainTab === "bdtx" ? " is-active" : ""}`}
              onClick={() => setMainTab("bdtx")}
            >
              Sổ bảo dưỡng
              {stats.entryCount > 0 && (
                <span className="stats-main-tab-count">{stats.entryCount}</span>
              )}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mainTab === "atgt"}
              className={`stats-main-tab${mainTab === "atgt" ? " is-active" : ""}`}
              onClick={() => setMainTab("atgt")}
            >
              Sổ nhật ký · ATGT
              {atgtStats.entryCount > 0 && (
                <span className="stats-main-tab-count">{atgtStats.entryCount}</span>
              )}
            </button>
          </div>
          <div className="stats-toolbar-filters">
            <label className="stats-toolbar-field">
              <span>Từ</span>
              <ViDateInput
                className="stats-toolbar-input"
                value={dateFrom}
                onChange={setDateFrom}
                aria-label="Từ ngày"
              />
            </label>
            <label className="stats-toolbar-field">
              <span>Đến</span>
              <ViDateInput
                className="stats-toolbar-input"
                value={dateTo}
                onChange={setDateTo}
                aria-label="Đến ngày"
              />
            </label>
            <button type="button" className="stats-toolbar-btn" onClick={setThisMonth}>
              Tháng này
            </button>
            <button type="button" className="stats-toolbar-btn" onClick={setQuarter}>
              Quý này
            </button>
            {mainTab === "bdtx" ? (
              <label className="stats-toolbar-field stats-toolbar-field--section">
                <span>Hạng mục</span>
                <select
                  className="stats-toolbar-input stats-toolbar-input--select"
                  value={sectionFilter}
                  onChange={(e) => setSectionFilter(e.target.value)}
                >
                  <option value="">Tất cả</option>
                  {BAO_DUONG_GROUPS.map((g, i) => (
                    <option key={g} value={g}>
                      {i + 1}. {g}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="stats-toolbar-field">
                <span>Nhóm</span>
                <select
                  className="stats-toolbar-input stats-toolbar-input--select"
                  value={atgtKindFilter}
                  onChange={(e) => setAtgtKindFilter(e.target.value)}
                >
                  <option value="">Tất cả</option>
                  <option value="mat">Mất</option>
                  <option value="hu_hong">Hư hỏng</option>
                </select>
              </label>
            )}
          </div>
        </div>

        {mainTab === "bdtx" ? (
          <div className="stats-tab-panel" role="tabpanel">
            <p className="stats-tab-hint">
              Khối lượng thực hiện theo sổ bảo dưỡng (ngày dự kiến sửa).
              {rangeLoading ? " Đang tải đủ ngày trên sổ…" : ""}
            </p>
            <div className="stats-summary stats-summary--compact">
              <div className="stats-summary-card">
                <div className="stats-summary-value">{stats.entryCount}</div>
                <div className="stats-summary-label">Dòng có KL</div>
              </div>
              <div className="stats-summary-card stats-summary-card--ok">
                <div className="stats-summary-value">{stats.okCount}</div>
                <div className="stats-summary-label">Đủ HĐ</div>
              </div>
              <div className="stats-summary-card stats-summary-card--short">
                <div className="stats-summary-value">{stats.shortCount}</div>
                <div className="stats-summary-label">Còn thiếu</div>
              </div>
              <div className="stats-summary-card">
                <div className="stats-summary-value">{stats.rows.length}</div>
                <div className="stats-summary-label">Đầu việc</div>
              </div>
            </div>

            {stats.rows.length === 0 ? (
              <div className="stats-empty">
                <p>Không có khối lượng trên sổ bảo dưỡng trong khoảng ngày đã chọn.</p>
                <p className="stats-empty-hint">
                  Chỉ tính dòng đã vào sổ BDTX (có ngày dự kiến sửa).
                </p>
              </div>
            ) : (
              <>
                <div className="stats-export-bar">
                  <span className="stats-export-bar-label">
                    Đã chọn {selectedKeys.length} đầu việc
                    {bdtxDetailCount > 0 ? ` · ${bdtxDetailCount} dòng` : ""}
                  </span>
                  <button
                    type="button"
                    className="btn-primary btn-primary--compact"
                    disabled={selectedKeys.length === 0}
                    onClick={() => openDetailExport("bdtx")}
                  >
                    Xuất khối lượng chi tiết
                  </button>
                </div>
                <StatsResultTable
                  rows={stats.rows}
                  expandedKey={expandedKey}
                  onToggleExpand={(key) =>
                    setExpandedKey((prev) => (prev === key ? "" : key))
                  }
                  StatusBadge={StatusBadge}
                  selectedKeys={selectedKeys}
                  onToggleSelect={toggleSelect}
                  onToggleSelectAll={toggleSelectAll}
                />
              </>
            )}
          </div>
        ) : (
          <div className="stats-tab-panel" role="tabpanel">
            <p className="stats-tab-hint">
              Theo dõi mất / hư hỏng ATGT phát hiện trên sổ nhật ký (ngày ghi sổ).
            </p>
            <div className="stats-summary stats-summary--compact">
              <div className="stats-summary-card">
                <div className="stats-summary-value">{atgtStats.entryCount}</div>
                <div className="stats-summary-label">Dòng ATGT</div>
              </div>
              <div className="stats-summary-card stats-summary-card--short">
                <div className="stats-summary-value">{atgtStats.matCount}</div>
                <div className="stats-summary-label">
                  Mất ({formatStatsNumber(atgtStats.matQty)})
                </div>
              </div>
              <div className="stats-summary-card stats-summary-card--pending">
                <div className="stats-summary-value">{atgtStats.huHongCount}</div>
                <div className="stats-summary-label">
                  Hư hỏng ({formatStatsNumber(atgtStats.huHongQty)})
                </div>
              </div>
              <div className="stats-summary-card">
                <div className="stats-summary-value">{atgtStats.typeCount}</div>
                <div className="stats-summary-label">Loại</div>
              </div>
            </div>

            {atgtStats.rows.length === 0 ? (
              <div className="stats-empty">
                <p>Không có dòng Công trình ATGT có khối lượng trong khoảng ngày đã chọn.</p>
                <p className="stats-empty-hint">
                  Kiểm tra nhập liệu mục «Công trình an toàn giao thông» trên sổ nhật ký.
                </p>
              </div>
            ) : (
              <>
                <div className="stats-export-bar">
                  <span className="stats-export-bar-label">
                    Đã chọn {atgtSelectedKeys.length} đầu việc
                    {atgtDetailCount > 0 ? ` · ${atgtDetailCount} dòng` : ""}
                  </span>
                  <button
                    type="button"
                    className="btn-primary btn-primary--compact"
                    disabled={atgtSelectedKeys.length === 0}
                    onClick={() => openDetailExport("atgt")}
                  >
                    Xuất khối lượng chi tiết
                  </button>
                </div>
                <AtgtDiaryStatsTable
                  rows={atgtStats.rows}
                  expandedKey={atgtExpandedKey}
                  onToggleExpand={(key) =>
                    setAtgtExpandedKey((prev) => (prev === key ? "" : key))
                  }
                  selectedKeys={atgtSelectedKeys}
                  onToggleSelect={toggleAtgtSelect}
                  onToggleSelectAll={toggleAtgtSelectAll}
                />
              </>
            )}
          </div>
        )}

        <VolumeDetailFormModal
          open={detailOpen}
          rows={detailRows}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onClose={() => setDetailOpen(false)}
        />
      </main>
    </div>
  );
}
