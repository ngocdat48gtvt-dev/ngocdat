import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ExcelJS from "exceljs";
import { useAuth } from "../context/AuthContext";
import { useOfficePermissions } from "../hooks/useOfficePermissions";
import ViDateInput from "../components/ViDateInput";
import CompanyVolumeTable, {
  buildCompanySectionBlocks
} from "../components/CompanyVolumeTable";
import VolumeDetailFormModal from "../components/VolumeDetailFormModal";
import {
  applyRemoteQualityCatalog,
  BAO_DUONG_GROUPS,
  BAO_DUONG_QUALITY_EVENT,
  setQualityCatalogOwnerUid
} from "../utils/baoDuongQualityStore";
import {
  collectSelectedVolumeDetails,
  defaultDateRange,
  formatStatsNumber,
  thisQuarterDateRange
} from "../utils/volumeStatsFormat";
import {
  applyCompanyContractOverrides,
  buildCompanyVolumeRows,
  companyVolumeFilterOptions
} from "../utils/companyVolumeStats";
import { fetchCompanyVolumeSources } from "../services/companyVolumeStatsService";
import { fetchDataNoiNghiep } from "../services/dataNoiNghiepService";
import {
  fetchBaoCaoContracts,
  pushBaoCaoContracts
} from "../services/baoCaoContractsService";
import {
  fallbackCompaniesFromIds,
  fetchCompaniesByIds,
  fetchPrimaryAdminUid
} from "../services/officeBrowseService";

/** Dropdown lọc nhiều giá trị — tick chọn (cùng chiều cao control toolbar). */
function CheckMultiFilter({ label, options, selected, onChange, allLabel = "Tất cả" }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  useEffect(() => {
    if (!open) return undefined;
    function onDoc(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const summary =
    selected.length === 0
      ? allLabel
      : selected.length === 1
        ? options.find((o) => o.value === selected[0])?.label || selected[0]
        : `Đã chọn ${selected.length}`;

  function toggle(value) {
    if (selectedSet.has(value)) onChange(selected.filter((v) => v !== value));
    else onChange([...selected, value]);
  }

  return (
    <div className={`stats-check-filter${label ? "" : " stats-check-filter--nolabel"}`} ref={rootRef}>
      {label ? <span className="stats-check-filter-label">{label}</span> : null}
      <button
        type="button"
        className={`stats-check-filter-btn${open ? " is-open" : ""}${selected.length ? " has-value" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={label || allLabel}
      >
        <span className="stats-check-filter-summary">{summary}</span>
        <span className="stats-check-filter-caret" aria-hidden>
          ▾
        </span>
      </button>
      {open && (
        <div className="stats-check-filter-panel" role="listbox" aria-multiselectable="true">
          <label className="stats-check-filter-item stats-check-filter-item--all">
            <input type="checkbox" checked={selected.length === 0} onChange={() => onChange([])} />
            <span>{allLabel}</span>
          </label>
          <div className="stats-check-filter-list">
            {options.map((opt) => (
              <label key={opt.value} className="stats-check-filter-item">
                <input
                  type="checkbox"
                  checked={selectedSet.has(opt.value)}
                  onChange={() => toggle(opt.value)}
                />
                <span>{opt.label}</span>
              </label>
            ))}
            {!options.length && <p className="stats-check-filter-empty">Không có mục</p>}
          </div>
          {selected.length > 0 && (
            <button
              type="button"
              className="stats-check-filter-clear"
              onClick={() => {
                onChange([]);
                setOpen(false);
              }}
            >
              Bỏ chọn
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function statusExportLabel(r) {
  if (r.status === "ok") return "Đủ HĐ";
  if (r.status === "short") return `Thiếu ${formatStatsNumber(r.remaining)}`;
  if (r.status === "pending") return "Chưa làm";
  return "Chưa HĐ";
}

async function downloadCompanyVolumeExcel(rows, dateFrom, dateTo) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("KL chung");
  const COL_COUNT = 11;
  ws.columns = [
    { header: "STT", key: "stt", width: 6 },
    { header: "Tuần đường", key: "hat", width: 10 },
    { header: "Đường", key: "road", width: 28 },
    { header: "USER", key: "user", width: 22 },
    { header: "Đầu việc", key: "work", width: 28 },
    { header: "ĐVT", key: "unit", width: 8 },
    { header: "Đã làm", key: "done", width: 10 },
    { header: "Hợp đồng", key: "contract", width: 10 },
    { header: "Còn thiếu", key: "remain", width: 10 },
    { header: "%", key: "pct", width: 8 },
    { header: "Trạng thái", key: "status", width: 12 }
  ];

  for (const block of buildCompanySectionBlocks(rows)) {
    const secRow = ws.addRow([block.label]);
    ws.mergeCells(secRow.number, 1, secRow.number, COL_COUNT);
    secRow.getCell(1).font = { bold: true };
    secRow.getCell(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE2E8F0" }
    };

    block.rows.forEach((r, i) => {
      const road =
        r.kmRange && r.roadName ? `${r.roadName} ${r.kmRange}` : r.roadName || r.kmRange || "";
      const row = ws.addRow({
        stt: i + 1,
        hat: r.hat,
        road,
        user: r.userName,
        work: r.workType,
        unit: r.unitLabel || r.unit,
        done: r.totalDone,
        contract: r.contractQty ?? "",
        remain: r.remaining ?? "",
        pct: r.percent != null ? Math.round(r.percent * 10) / 10 : "",
        status: statusExportLabel(r)
      });
      ["done", "contract", "remain", "pct"].forEach((key) => {
        const cell = row.getCell(key);
        const n = Number(cell.value);
        if (!Number.isFinite(n) || cell.value === "" || cell.value == null) return;
        if (Number.isInteger(n) && key !== "pct") {
          cell.numFmt = "0";
        } else {
          cell.value = n.toFixed(key === "pct" ? 1 : 2).replace(".", ",");
          cell.numFmt = "@";
        }
      });
    });
  }

  ws.getRow(1).font = { bold: true };
  ws.getRow(1).alignment = { horizontal: "center", vertical: "middle" };

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  const from = (dateFrom || "").replace(/-/g, "");
  const to = (dateTo || "").replace(/-/g, "");
  a.download = `Thong_ke_KL_chung_${from}_${to}.xlsx`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function ThongKeKhoiLuongChung({ onBack }) {
  const { profile } = useAuth();
  const { isSoXd } = useOfficePermissions();
  const defaults = defaultDateRange();
  const [dateFrom, setDateFrom] = useState(defaults.dateFrom);
  const [dateTo, setDateTo] = useState(defaults.dateTo);
  const [hatFilters, setHatFilters] = useState([]);
  const [roadFilters, setRoadFilters] = useState([]);
  const [userFilters, setUserFilters] = useState([]);
  const [sectionFilters, setSectionFilters] = useState([]);
  const [sources, setSources] = useState([]);
  const [contractByKey, setContractByKey] = useState({});
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const saveTimer = useRef(null);
  const [catalogTick, setCatalogTick] = useState(0);
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [contractAdminUid, setContractAdminUid] = useState("");

  useEffect(() => {
    const onCatalog = () => setCatalogTick((n) => n + 1);
    window.addEventListener(BAO_DUONG_QUALITY_EVENT, onCatalog);
    return () => window.removeEventListener(BAO_DUONG_QUALITY_EVENT, onCatalog);
  }, []);

  useEffect(() => {
    if (!isSoXd) {
      setCompanies([]);
      setSelectedCompanyId("");
      return undefined;
    }
    let cancelled = false;
    const fallback = fallbackCompaniesFromIds(profile?.soXdAccess?.companyIds);
    if (fallback.length) {
      setCompanies(fallback);
      setSelectedCompanyId((prev) => prev || fallback[0].companyId);
    }
    void fetchCompaniesByIds(profile?.soXdAccess?.companyIds)
      .then((list) => {
        if (cancelled) return;
        const next = list.length ? list : fallback;
        setCompanies(next);
        setSelectedCompanyId((prev) => {
          if (prev && next.some((c) => c.companyId === prev)) return prev;
          return next[0]?.companyId || "";
        });
      })
      .catch(() => {
        if (!cancelled) setCompanies(fallback);
      });
    return () => {
      cancelled = true;
    };
  }, [isSoXd, profile?.soXdAccess]);

  const reportCompanyId = isSoXd ? selectedCompanyId : profile?.companyId;

  const load = useCallback(async () => {
    if (isSoXd && !reportCompanyId) {
      setSources([]);
      setContractByKey({});
      setContractAdminUid("");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const adminUid = isSoXd
        ? await fetchPrimaryAdminUid(reportCompanyId)
        : profile?.uid;
      const [{ sources: list }, contracts, masterData] = await Promise.all([
        fetchCompanyVolumeSources(reportCompanyId, { dateFrom, dateTo }),
        fetchBaoCaoContracts(adminUid),
        fetchDataNoiNghiep(adminUid)
      ]);
      if (adminUid) setQualityCatalogOwnerUid(adminUid);
      if (masterData.exists) {
        applyRemoteQualityCatalog(masterData.catalog, masterData.updatedAtMs);
      }
      setSources(list);
      setContractByKey(contracts);
      setContractAdminUid(adminUid || "");
    } catch (err) {
      setError(err?.message || "Không tải được dữ liệu tổng hợp.");
      setSources([]);
    } finally {
      setLoading(false);
    }
  }, [profile, dateFrom, dateTo, isSoXd, reportCompanyId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setSelectedKeys([]);
  }, [dateFrom, dateTo, hatFilters, roadFilters, userFilters, sectionFilters]);

  const filterOpts = useMemo(() => companyVolumeFilterOptions(sources), [sources]);

  const hatOptions = useMemo(
    () => filterOpts.hats.map((h) => ({ value: h, label: h })),
    [filterOpts.hats]
  );
  const roadOptions = useMemo(
    () => filterOpts.roads.map((r) => ({ value: r.id, label: r.label })),
    [filterOpts.roads]
  );
  const userOptions = useMemo(
    () => filterOpts.users.map((u) => ({ value: u.uid, label: u.displayName })),
    [filterOpts.users]
  );
  const sectionOptions = useMemo(
    () => BAO_DUONG_GROUPS.map((g) => ({ value: g, label: g })),
    []
  );

  const baseRows = useMemo(
    () =>
      buildCompanyVolumeRows(sources, {
        dateFrom,
        dateTo,
        hatFilters,
        roadFilters,
        userFilters,
        sectionFilters
      }),
    // catalogTick: đổi tên Công việc BDTX trên danh mục → dựng lại bảng
    [sources, dateFrom, dateTo, hatFilters, roadFilters, userFilters, sectionFilters, catalogTick]
  );

  const rows = useMemo(
    () => applyCompanyContractOverrides(baseRows, contractByKey),
    [baseRows, contractByKey]
  );

  const detailRows = useMemo(
    () => collectSelectedVolumeDetails(rows, selectedKeys),
    [rows, selectedKeys]
  );

  const shortCount = rows.filter((r) => r.status === "short").length;
  const noHdCount = rows.filter((r) => r.status === "no_contract").length;

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
    setSelectedKeys(rows.filter((r) => r.items?.length > 0).map((r) => r.key));
  }

  async function handleContractChange(key, value) {
    if (isSoXd) return;
    const trimmed = String(value ?? "").trim();
    const next = { ...contractByKey };
    if (!trimmed) delete next[key];
    else next[key] = trimmed;
    setContractByKey(next);
    try {
      await pushBaoCaoContracts(contractAdminUid || profile?.uid, next);
      setSaveMsg("Đã lưu KL hợp đồng.");
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => setSaveMsg(""), 2500);
    } catch (err) {
      setError(err?.message || "Không lưu được KL hợp đồng.");
    }
  }

  async function handleExportSummary() {
    if (!rows.length) return;
    setExporting(true);
    try {
      await downloadCompanyVolumeExcel(rows, dateFrom, dateTo);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="stats-page stats-page--company">
      <div className="stats-company-bar">
        <div className="stats-company-bar-left">
          {onBack && (
            <button type="button" className="stats-toolbar-btn" onClick={onBack}>
              ← Quay lại
            </button>
          )}
          <div>
            <h1 className="stats-company-title">Thống kê khối lượng chung</h1>
            <p className="stats-company-sub">
              {isSoXd
                ? "Sở Xây dựng — xem báo cáo công ty được chọn (không sửa KL hợp đồng)."
                : "Gộp đầu việc cùng đường · tick chọn để xem / xuất chi tiết · nhập HĐ rồi Enter để lưu."}
            </p>
          </div>
        </div>
        <div className="stats-company-bar-actions">
          <button
            type="button"
            className="stats-toolbar-btn"
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? "Đang tải…" : "Tải lại cloud"}
          </button>
          <button
            type="button"
            className="btn-primary btn-primary--compact"
            onClick={() => void handleExportSummary()}
            disabled={!rows.length || exporting}
          >
            {exporting ? "Đang xuất…" : "Xuất Excel tổng hợp"}
          </button>
        </div>
      </div>

      <div className="stats-toolbar stats-toolbar--company">
        <div className="stats-toolbar-filters stats-toolbar-filters--company">
          {isSoXd && (
            <label className="stats-company-field">
              <span className="stats-company-field-label">Công ty</span>
              <select
                className="stats-company-control"
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
              >
                {companies.length === 0 ? (
                  <option value="">Chưa cấp công ty</option>
                ) : (
                  companies.map((c) => (
                    <option key={c.companyId} value={c.companyId}>
                      {c.companyName}
                    </option>
                  ))
                )}
              </select>
            </label>
          )}
          <label className="stats-company-field">
            <span className="stats-company-field-label">Từ ngày</span>
            <ViDateInput
              className="stats-company-control stats-company-control--date"
              value={dateFrom}
              onChange={setDateFrom}
            />
          </label>
          <label className="stats-company-field">
            <span className="stats-company-field-label">Đến ngày</span>
            <ViDateInput
              className="stats-company-control stats-company-control--date"
              value={dateTo}
              onChange={setDateTo}
            />
          </label>
          <div className="stats-company-field stats-company-field--nolabel">
            <div className="stats-company-quick">
              <button
                type="button"
                className="stats-company-control stats-company-control--btn"
                onClick={() => {
                  const r = defaultDateRange();
                  setDateFrom(r.dateFrom);
                  setDateTo(r.dateTo);
                }}
              >
                Tháng này
              </button>
              <button
                type="button"
                className="stats-company-control stats-company-control--btn"
                onClick={() => {
                  const r = thisQuarterDateRange();
                  setDateFrom(r.dateFrom);
                  setDateTo(r.dateTo);
                }}
              >
                Quý này
              </button>
            </div>
          </div>
          <CheckMultiFilter
            label=""
            allLabel="Tất cả tuần đường"
            options={hatOptions}
            selected={hatFilters}
            onChange={setHatFilters}
          />
          <CheckMultiFilter
            label=""
            allLabel="Tất cả đường"
            options={roadOptions}
            selected={roadFilters}
            onChange={setRoadFilters}
          />
          <CheckMultiFilter
            label=""
            allLabel="Tất cả USER"
            options={userOptions}
            selected={userFilters}
            onChange={setUserFilters}
          />
          <CheckMultiFilter
            label=""
            allLabel="Tất cả hạng mục"
            options={sectionOptions}
            selected={sectionFilters}
            onChange={setSectionFilters}
          />
        </div>
        <p className="stats-company-meta">
          {loading
            ? "Đang tải sổ từ cloud…"
            : `${rows.length} đầu việc · ${sources.length} sổ · thiếu HĐ: ${shortCount} · chưa kê HĐ: ${noHdCount}${
                saveMsg ? ` · ${saveMsg}` : ""
              }`}
        </p>
      </div>

      {error && <p className="road-select-error">{error}</p>}

      {!loading && rows.length === 0 ? (
        <p className="stats-empty-hint">
          Không có khối lượng trong khoảng lọc. Kiểm tra ngày / tuần đường hoặc dữ liệu USER trên cloud.
        </p>
      ) : (
        !loading && (
          <>
            <div className="stats-export-bar">
              <span className="stats-export-bar-label">
                Đã chọn {selectedKeys.length} đầu việc
                {detailRows.length > 0 ? ` · ${detailRows.length} dòng chi tiết` : ""}
              </span>
              <button
                type="button"
                className="btn-primary btn-primary--compact"
                disabled={selectedKeys.length === 0}
                onClick={() => setDetailOpen(true)}
              >
                Xem / xuất chi tiết
              </button>
            </div>
            <CompanyVolumeTable
              rows={rows}
              onContractChange={handleContractChange}
              editable={!isSoXd}
              selectedKeys={selectedKeys}
              onToggleSelect={toggleSelect}
              onToggleSelectAll={toggleSelectAll}
            />
          </>
        )
      )}

      <VolumeDetailFormModal
        open={detailOpen}
        rows={detailRows}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onClose={() => setDetailOpen(false)}
      />
    </div>
  );
}
