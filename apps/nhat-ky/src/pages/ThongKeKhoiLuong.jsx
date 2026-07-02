import { useEffect, useMemo, useState } from "react";
import { useRoadWorkspace } from "../context/RoadWorkspaceContext";
import ViDateInput from "../components/ViDateInput";
import {
  EMPTY_REPORT_META,
  SECTIONS,
  loadStorage,
  saveReportMeta
} from "../utils/nhatKyFormat";
import {
  buildVolumeStats,
  defaultDateRange,
  formatStatsNumber,
  inferSectionForWorkType,
  newContractVolume
} from "../utils/volumeStatsFormat";
import ContractVolumeTable from "../components/ContractVolumeTable";
import StatsResultTable from "../components/StatsResultTable";

const SIDEBAR_WIDTH = 690;

function StatusBadge({ row }) {
  if (row.status === "ok") {
    return <span className="stats-badge stats-badge--ok">Đủ HĐ</span>;
  }
  if (row.status === "short") {
    return (
      <span className="stats-badge stats-badge--short">
        Thiếu {formatStatsNumber(row.remaining)} {row.unitLabel}
      </span>
    );
  }
  if (row.status === "pending") {
    return <span className="stats-badge stats-badge--pending">Chưa làm</span>;
  }
  return <span className="stats-badge stats-badge--muted">Chưa kê HĐ</span>;
}

export default function ThongKeKhoiLuong({ storageTick = 0 }) {
  const { storageKey } = useRoadWorkspace();
  const defaults = defaultDateRange();
  const [dateFrom, setDateFrom] = useState(defaults.dateFrom);
  const [dateTo, setDateTo] = useState(defaults.dateTo);
  const [sectionFilter, setSectionFilter] = useState("");
  const [expandedKey, setExpandedKey] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  const stored = useMemo(
    () => loadStorage(storageKey),
    [storageKey, storageTick]
  );

  const [contractVolumes, setContractVolumes] = useState([]);

  const reportMeta = { ...EMPTY_REPORT_META, ...(stored.reportMeta || {}) };

  useEffect(() => {
    const saved = loadStorage(storageKey).reportMeta?.contractVolumes;
    const rows = Array.isArray(saved) ? saved : [];
    setContractVolumes(
      rows.map((row) => ({
        ...row,
        section: row.section || inferSectionForWorkType(row.workType)
      }))
    );
  }, [storageTick, storageKey]);

  const stats = useMemo(
    () =>
      buildVolumeStats(stored.entries, contractVolumes, {
        dateFrom,
        dateTo,
        sectionFilter
      }),
    [stored.entries, contractVolumes, dateFrom, dateTo, sectionFilter]
  );

  function setThisMonth() {
    const d = defaultDateRange();
    setDateFrom(d.dateFrom);
    setDateTo(d.dateTo);
  }

  function setQuarter() {
    const now = new Date();
    const qStartMonth = Math.floor(now.getMonth() / 3) * 3;
    const from = new Date(now.getFullYear(), qStartMonth, 1);
    setDateFrom(from.toISOString().split("T")[0]);
    setDateTo(now.toISOString().split("T")[0]);
  }

  function addContractLine(partial) {
    setContractVolumes((prev) => [...prev, newContractVolume(partial)]);
  }

  function updateContract(id, patch) {
    setContractVolumes((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const next = { ...row, ...patch };
        if (patch.workType != null && !next.section) {
          const inferred = inferSectionForWorkType(next.workType);
          if (inferred) next.section = inferred;
        }
        return next;
      })
    );
  }

  function removeContract(id) {
    setContractVolumes((prev) => prev.filter((row) => row.id !== id));
  }

  function handleSaveContracts() {
    const enriched = contractVolumes.map((row) => ({
      ...row,
      workType: String(row.workType || "").trim(),
      section: row.section || inferSectionForWorkType(row.workType)
    }));
    setContractVolumes(enriched);
    saveReportMeta({ ...reportMeta, contractVolumes: enriched }, storageKey);
    setSaveMessage("Đã lưu khối lượng hợp đồng.");
    setTimeout(() => setSaveMessage(""), 3000);
  }

  return (
    <div className="stats-page">
      <aside
        className="stats-sidebar stats-sidebar--contract"
        style={{
          width: SIDEBAR_WIDTH,
          minWidth: SIDEBAR_WIDTH,
          maxWidth: SIDEBAR_WIDTH
        }}
      >
        <div className="stats-contract-block stats-contract-block--solo">
          <div className="stats-contract-head">
            <span className="stats-filter-label">
              Khối lượng hợp đồng
              {contractVolumes.length > 0 && (
                <span className="stats-contract-count"> ({contractVolumes.length})</span>
              )}
            </span>
            <button
              type="button"
              className="stats-add-btn"
              onClick={() => addContractLine()}
            >
              + Thêm
            </button>
          </div>

          {contractVolumes.length === 0 ? (
            <p className="stats-empty-hint">Chưa kê khối lượng HĐ. Nhấn + Thêm để nhập.</p>
          ) : (
            <ContractVolumeTable
              rows={contractVolumes}
              onUpdate={updateContract}
              onRemove={removeContract}
            />
          )}

          <div className="stats-contract-foot">
            <button type="button" className="btn-primary btn-primary--compact" onClick={handleSaveContracts}>
              Lưu khối lượng HĐ
            </button>
            {saveMessage && <p className="stats-save-msg">{saveMessage}</p>}
          </div>
        </div>
        <datalist id="stats-work-types">
          {SECTIONS.flatMap((s) => s.types).map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </aside>

      <main className="stats-main">
        <div className="stats-toolbar">
          <h2 className="stats-toolbar-title">Thống kê khối lượng</h2>
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
            <label className="stats-toolbar-field stats-toolbar-field--section">
              <span>Hạng mục</span>
              <select
                className="stats-toolbar-input stats-toolbar-input--select"
                value={sectionFilter}
                onChange={(e) => setSectionFilter(e.target.value)}
              >
                <option value="">Tất cả</option>
                {SECTIONS.map((s) => (
                  <option key={s.key} value={s.title}>
                    {s.num}. {s.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="stats-summary">
          <div className="stats-summary-card">
            <div className="stats-summary-value">{stats.entryCount}</div>
            <div className="stats-summary-label">Dòng ghi chép có KL</div>
          </div>
          <div className="stats-summary-card stats-summary-card--ok">
            <div className="stats-summary-value">{stats.okCount}</div>
            <div className="stats-summary-label">Đủ hợp đồng</div>
          </div>
          <div className="stats-summary-card stats-summary-card--short">
            <div className="stats-summary-value">{stats.shortCount}</div>
            <div className="stats-summary-label">Còn thiếu</div>
          </div>
          <div className="stats-summary-card">
            <div className="stats-summary-value">{stats.rows.length}</div>
            <div className="stats-summary-label">Đầu việc theo dõi</div>
          </div>
        </div>

        {stats.rows.length === 0 ? (
          <div className="stats-empty">
            <p>Không có dữ liệu khối lượng trong khoảng ngày đã chọn.</p>
            <p className="stats-empty-hint">
              Kiểm tra nhật ký đã nhập dài × rộng × cao hoặc khối lượng chưa.
            </p>
          </div>
        ) : (
          <StatsResultTable
            rows={stats.rows}
            expandedKey={expandedKey}
            onToggleExpand={(key) => setExpandedKey((prev) => (prev === key ? "" : key))}
            StatusBadge={StatusBadge}
          />
        )}

      </main>
    </div>
  );
}
