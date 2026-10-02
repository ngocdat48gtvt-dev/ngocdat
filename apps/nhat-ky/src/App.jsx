import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { RoadWorkspaceProvider, useRoadWorkspace } from "./context/RoadWorkspaceContext";
import { OfficeBrowseProvider, useOfficeBrowse } from "./context/OfficeBrowseContext";
import RoadSelectPage from "./pages/RoadSelectPage";
import OfficeBrowseSelectPage from "./pages/OfficeBrowseSelectPage";
import NhapLieuPage from "./pages/NhapLieuPage";
import SoNhatKy from "./pages/SoNhatKy";
import SoMatDuong from "./pages/SoMatDuong";
import SoBaoDuong from "./pages/SoBaoDuong";
import SoNghiemThu from "./pages/SoNghiemThu";
import SoTrafficDuty from "./pages/SoTrafficDuty";
import SoTngt from "./pages/SoTngt";
import SoHanhLang from "./pages/SoHanhLang";
import SoDemXe from "./pages/SoDemXe";
import SoCapPhepThiCong from "./pages/SoCapPhepThiCong";
import HienTruongPage from "./pages/HienTruongPage";
import ThongKeKhoiLuong from "./pages/ThongKeKhoiLuong";
import ThongKeKhoiLuongChung from "./pages/ThongKeKhoiLuongChung";
import DanhMucBaoDuong from "./pages/DanhMucBaoDuong";
import HoSoCong from "./pages/HoSoCong";
import DanhSachCau from "./pages/DanhSachCau";
import PhieuKiemTraCau from "./pages/PhieuKiemTraCau";
import { useIncidentSync } from "./hooks/useIncidentSync";
import { useDataNoiNghiepSync } from "./hooks/useDataNoiNghiepSync";
import { useOfficeBooksSync } from "./hooks/useOfficeBooksSync";
import { useCauInspectionSync } from "./hooks/useCauInspectionSync";
import { useCongRegistryHydrate } from "./hooks/useCongRegistryHydrate";
import { useOfficePermissions } from "./hooks/useOfficePermissions";
import { formatKmDisplay, roadDisplayLabel } from "./utils/roadsCatalog";
import OfficeBackupDialog from "./components/OfficeBackupDialog";
import { disposeOfficeBackup, downloadEditedOfficeBackup, materializeOfficeBackup, overwriteEditedOfficeBackup, purgeStaleOfficeBackupStorage, readOfficeBackup } from "./services/officeBackupService";

const HOME_URL = "/quan-ly-duong-bo.html";

function RoadWorkspaceNav({ road, browseUserName, onChangeRoad }) {
  if (!road) return null;

  const roadName = road.roadName || road.label || "";
  const kmFrom = formatKmDisplay(road.kmFrom);
  const kmTo = formatKmDisplay(road.kmTo);
  const kmText =
    road.routesViewMode === "merged" && road.kmRange
      ? road.kmRange
      : kmFrom && kmTo
        ? `${kmFrom} → ${kmTo}`
        : road.kmRange
          ? road.kmRange.replace(/\s*[-–—]\s*/g, " → ")
          : "";

  return (
    <div className="road-workspace-nav" title={roadDisplayLabel(road)}>
      {browseUserName && (
        <span className="road-workspace-nav-browse-user">Xem: {browseUserName}</span>
      )}
      {road.hat && <span className="road-workspace-nav-hat">{road.hat}</span>}
      {roadName && (
        <span
          className={`road-workspace-nav-road${
            road.routesViewMode === "merged" ? " road-workspace-nav-road--merged" : ""
          }`}
          title={roadName}
        >
          {roadName}
        </span>
      )}
      {kmText && (
        <span className="road-workspace-nav-km" title={kmText}>
          {kmText}
        </span>
      )}
      <button type="button" className="road-workspace-nav-switch" onClick={onChangeRoad}>
        {browseUserName ? "Đổi người / sổ" : "Đổi sổ"}
      </button>
    </div>
  );
}

function OfficeSyncStatus({ sync }) {
  if (!sync || sync.status === "idle" || sync.status === "readonly") return null;
  const labels = {
    checking: "Đang đối chiếu dữ liệu",
    pending: "Đang chờ đồng bộ",
    syncing: "Đang đồng bộ",
    synced: "Đã đồng bộ",
    error: "Chưa đồng bộ – bấm thử lại"
  };
  const isError = sync.status === "error";
  return (
    <button
      type="button"
      className={`office-sync-chip office-sync-chip--${sync.status}`}
      disabled={!isError}
      onClick={isError ? () => void sync.retry() : undefined}
      title={isError ? sync.error || "Bấm để thử đồng bộ lại" : labels[sync.status]}
    >
      <span className="office-sync-chip-dot" aria-hidden />
      {labels[sync.status] || "Đang đồng bộ"}
    </button>
  );
}

function OfficeDayComparison({ sync }) {
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  async function inspect() {
    setBusy(true); setError("");
    try { setResult(await sync.inspectDay()); }
    catch (err) { setError(err.message || "Không đọc được dữ liệu ngày."); }
    finally { setBusy(false); }
  }
  return <>
    <button type="button" className="nhat-ky-backup-btn" disabled={busy} onClick={() => void inspect()}>{busy ? "Đang đối chiếu…" : "Đối chiếu ngày"}</button>
    {(result || error) && createPortal(<div className="backup-overlay" role="dialog" aria-modal="true" aria-label="Đối chiếu dữ liệu ngày">
      <div className="backup-dialog">
        <div className="backup-title"><h2>Đối chiếu dữ liệu ngày {result?.date}</h2><button type="button" onClick={() => { setResult(null); setError(""); }}>×</button></div>
        <p>Đọc dữ liệu Firebase và bộ nhớ trên máy, không ghi thay đổi.</p>
        {error && <p>{error}</p>}
        {sync.canRestore && <button type="button" disabled={busy || !selectedIds.length} onClick={async () => {
          setBusy(true); setError("");
          try { setResult(await sync.restoreRows(selectedIds)); setSelectedIds([]); }
          catch (err) { setError(err.message || "Không khôi phục được dữ liệu."); }
          finally { setBusy(false); }
        }}>Khôi phục {selectedIds.length} dòng đã chọn</button>}
        {result && ["cloud", "local"].map((source) => <div key={source}>
          <h3>{source === "cloud" ? "Firebase" : "Trên máy"}: {result[source].filter((entry) => !entry.deletedAt).length} dòng đang dùng / {result[source].length} dòng lưu</h3>
          <div className="backup-table-wrap"><table><thead><tr><th>Mã dòng</th><th>Hạng mục</th><th>Nội dung</th><th>Lý trình</th><th>Trạng thái</th></tr></thead><tbody>{result[source].map((entry, i) => <tr key={i}><td>{source === "cloud" && entry.deletedAt && sync.canRestore && <input type="checkbox" aria-label={`Khôi phục ${entry.recordId}`} checked={selectedIds.includes(entry.recordId)} onChange={(event) => setSelectedIds((ids) => event.target.checked ? [...ids, entry.recordId] : ids.filter((id) => id !== entry.recordId))} />}{entry.recordId}</td><td>{entry.section}</td><td>{entry.type}</td><td>{entry.kmFrom} → {entry.kmTo}</td><td>{entry.deletedAt ? `Đã xóa: ${entry.deleteReason || ""} (${entry.deletedAt})` : "Đang dùng"}{entry.conflicts && `; xung đột: ${entry.conflicts}`}</td></tr>)}</tbody></table></div>
        </div>)}
      </div>
    </div>, document.body)}
  </>;
}

function NhatKySubNav({ page, setPage, canEditOfficeData }) {
  const [hosoOpen, setHosoOpen] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const hosoRef = useRef(null);
  const menuRef = useRef(null);
  const hosoPages = ["hosocong", "danhsachcau"];
  const hosoActive = hosoPages.includes(page);

  useEffect(() => {
    if (!hosoOpen) return undefined;
    const updatePos = () => {
      const el = hosoRef.current?.querySelector("button");
      if (!el) return;
      const r = el.getBoundingClientRect();
      setMenuPos({
        top: r.bottom,
        left: Math.min(r.left, window.innerWidth - 220)
      });
    };
    updatePos();
    const onDown = (e) => {
      if (hosoRef.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      setHosoOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setHosoOpen(false);
    };
    window.addEventListener("resize", updatePos);
    window.addEventListener("scroll", updatePos, true);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", updatePos);
      window.removeEventListener("scroll", updatePos, true);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [hosoOpen]);

  function goHoso(nextPage) {
    setPage(nextPage);
    setHosoOpen(false);
  }

  const hosoMenu =
    hosoOpen && menuPos
      ? createPortal(
          <div
            ref={menuRef}
            className="nhat-ky-nav-dd-menu"
            role="menu"
            style={{ top: menuPos.top, left: menuPos.left }}
          >
            <button
              type="button"
              role="menuitem"
              className={page === "hosocong" ? "is-active" : ""}
              onClick={() => goHoso("hosocong")}
            >
              Danh sách cống
            </button>
            <button
              type="button"
              role="menuitem"
              className={page === "danhsachcau" ? "is-active" : ""}
              onClick={() => goHoso("danhsachcau")}
            >
              Danh sách cầu
            </button>
          </div>,
          document.body
        )
      : null;

  return (
    <div className="nhat-ky-nav nhat-ky-nav--sub nhat-ky-nav--sub-inline">
      {canEditOfficeData && (
      <button
        type="button"
        className={page === "nhaplieu" ? "nav-active" : ""}
        onClick={() => setPage("nhaplieu")}
      >
        NHẬP LIỆU
      </button>
      )}
      <button
        type="button"
        className={page === "sonhatky" ? "nav-active" : ""}
        onClick={() => setPage("sonhatky")}
      >
        SỔ NHẬT KÝ
      </button>
      <button
        type="button"
        className={page === "somatduong" ? "nav-active" : ""}
        onClick={() => setPage("somatduong")}
      >
        SỔ MẶT ĐƯỜNG
      </button>
      <button
        type="button"
        className={page === "sobaoduong" ? "nav-active" : ""}
        onClick={() => setPage("sobaoduong")}
      >
        SỔ BẢO DƯỠNG
      </button>
      <button
        type="button"
        className={page === "songhiemthu" ? "nav-active" : ""}
        onClick={() => setPage("songhiemthu")}
      >
        BB NGHIỆM THU
      </button>
      <button
        type="button"
        className={page === "sotructraffic" ? "nav-active" : ""}
        onClick={() => setPage("sotructraffic")}
      >
        SỔ TRỰC ĐBGT
      </button>
      <button
        type="button"
        className={page === "sotngt" ? "nav-active" : ""}
        onClick={() => setPage("sotngt")}
      >
        SỔ TNGT
      </button>
      <button
        type="button"
        className={page === "sohanhlang" ? "nav-active" : ""}
        onClick={() => setPage("sohanhlang")}
      >
        SỔ HÀNH LANG
      </button>
      <button
        type="button"
        className={page === "sodemxe" ? "nav-active" : ""}
        onClick={() => setPage("sodemxe")}
      >
        SỔ ĐẾM XE
      </button>
      <button
        type="button"
        className={page === "sogptc" ? "nav-active" : ""}
        onClick={() => setPage("sogptc")}
      >
        SỔ CẤP PHÉP TC
      </button>
      <button
        type="button"
        className={page === "phieucau" ? "nav-active" : ""}
        onClick={() => setPage("phieucau")}
      >
        PHIẾU KT CẦU
      </button>
      <button
        type="button"
        className={page === "thongke" ? "nav-active" : ""}
        onClick={() => setPage("thongke")}
      >
        THỐNG KÊ KL
      </button>
      <button
        type="button"
        className={page === "baoduongdata" ? "nav-active" : ""}
        onClick={() => setPage("baoduongdata")}
      >
        DANH MỤC CÔNG VIỆC
      </button>
      <div
        className={`nhat-ky-nav-dd${hosoActive ? " is-active" : ""}${hosoOpen ? " is-open" : ""}`}
        ref={hosoRef}
      >
        <button
          type="button"
          className={hosoActive ? "nav-active" : ""}
          aria-expanded={hosoOpen}
          aria-haspopup="true"
          onClick={(e) => {
            if (hosoOpen) {
              setHosoOpen(false);
              return;
            }
            const r = e.currentTarget.getBoundingClientRect();
            setMenuPos({
              top: r.bottom,
              left: Math.min(r.left, window.innerWidth - 220)
            });
            setHosoOpen(true);
          }}
        >
          TÀI SẢN ĐƯỜNG BỘ ▾
        </button>
        {hosoMenu}
      </div>
    </div>
  );
}

function NhatKyWorkspace({
  page,
  setPage,
  storageTick,
  workspaceDate,
  setWorkspaceDate,
  onStorageChange,
  matDuongQuickBoot,
  onMatDuongQuickBootConsumed,
  nhapLieuBootSection = "",
  onNhapLieuBootSection,
  onNhapLieuBootSectionConsumed,
  gptcBoot = null,
  onGptcBoot,
  onGptcBootConsumed,
  officeReadOnly,
  canEditOfficeData
}) {
  const goEdit = canEditOfficeData
    ? (sectionTitle) => {
        if (typeof sectionTitle === "string" && sectionTitle.trim()) {
          onNhapLieuBootSection?.(sectionTitle.trim());
        }
        setPage("nhaplieu");
      }
    : undefined;

  const openGptcDetail = (item) => {
    const permitId = String(item?.sourceGptcPermitId || "").trim();
    if (!permitId) return;
    onGptcBoot?.({
      permitId,
      entryId: String(item?.sourceGptcEntryId || "").trim()
    });
    setPage("sogptc");
  };

  return (
    <div className="nhat-ky-workspace">
      {page === "nhaplieu" && (
        <NhapLieuPage
          date={workspaceDate}
          onDateChange={setWorkspaceDate}
          storageTick={storageTick}
          onStorageChange={onStorageChange}
          matDuongQuickBoot={matDuongQuickBoot}
          onMatDuongQuickBootConsumed={onMatDuongQuickBootConsumed}
          bootSection={nhapLieuBootSection}
          onBootSectionConsumed={onNhapLieuBootSectionConsumed}
          onOpenGptcDetail={openGptcDetail}
          readOnly={officeReadOnly}
        />
      )}
      {page === "sonhatky" && (
        <SoNhatKy
          date={workspaceDate}
          onDateChange={setWorkspaceDate}
          onGoEdit={goEdit}
          onOpenGptcDetail={openGptcDetail}
          storageTick={storageTick}
          readOnly={officeReadOnly}
        />
      )}
      {page === "somatduong" && (
        <SoMatDuong
          workspaceDate={workspaceDate}
          onWorkspaceDateChange={setWorkspaceDate}
          onStorageChange={onStorageChange}
          storageTick={storageTick}
          readOnly={officeReadOnly}
        />
      )}
      {page === "sobaoduong" && (
        <SoBaoDuong
          date={workspaceDate}
          onDateChange={setWorkspaceDate}
          onGoEdit={goEdit}
          storageTick={storageTick}
          readOnly={officeReadOnly}
        />
      )}
      {page === "songhiemthu" && (
        <SoNghiemThu
          date={workspaceDate}
          onDateChange={setWorkspaceDate}
          onGoEdit={goEdit}
          storageTick={storageTick}
          readOnly={officeReadOnly}
        />
      )}
      {page === "sotructraffic" && (
        <SoTrafficDuty
          onGoEdit={goEdit}
          storageTick={storageTick}
          readOnly={officeReadOnly}
        />
      )}
      {page === "sotngt" && (
        <SoTngt onGoEdit={goEdit} storageTick={storageTick} readOnly={officeReadOnly} />
      )}
      {page === "sohanhlang" && (
        <SoHanhLang
          onGoEdit={goEdit}
          storageTick={storageTick}
          readOnly={officeReadOnly}
          onStorageChange={onStorageChange}
        />
      )}
      {page === "sodemxe" && <SoDemXe readOnly={officeReadOnly} />}
      {page === "sogptc" && (
        <SoCapPhepThiCong
          readOnly={officeReadOnly}
          bootTarget={gptcBoot}
          onBootConsumed={onGptcBootConsumed}
        />
      )}
      {page === "thongke" && (
        <ThongKeKhoiLuong storageTick={storageTick} readOnly={officeReadOnly} />
      )}
      {page === "baoduongdata" && <DanhMucBaoDuong />}
      {page === "hosocong" && (
        <HoSoCong readOnly={officeReadOnly} storageTick={storageTick} />
      )}
      {page === "danhsachcau" && <DanhSachCau readOnly={officeReadOnly} />}
      {page === "phieucau" && (
        <PhieuKiemTraCau readOnly={officeReadOnly} storageTick={storageTick} />
      )}
    </div>
  );
}

function AppContent({ offlineSession, onOpenBackup, onEnableBackupEdit, onCloseBackup }) {
  const { canAccess, profile, logout } = useAuth();
  const { canEditOfficeData, canUseFieldApp, isOfficeReadOnly, needsBrowsePicker } =
    useOfficePermissions();
  const browse = useOfficeBrowse();
  const {
    ready,
    roadSelected,
    storageKey,
    activeRoad,
    activeRoadId,
    routesViewMode,
    ownerUid,
    browseMode,
    offlineMode,
    clearRoad,
    roads
  } = useRoadWorkspace();
  const [portal, setPortal] = useState("nhatky");
  const [page, setPage] = useState(() => (needsBrowsePicker ? "sonhatky" : "nhaplieu"));
  const [storageTick, setStorageTick] = useState(0);
  const [workspaceDate, setWorkspaceDate] = useState(
    () => new Date().toISOString().split("T")[0]
  );
  const [matDuongQuickBoot, setMatDuongQuickBoot] = useState(false);
  const [nhapLieuBootSection, setNhapLieuBootSection] = useState("");
  const [gptcBoot, setGptcBoot] = useState(null);
  const [backupOpen, setBackupOpen] = useState(false);
  const [backupSaving, setBackupSaving] = useState(false);

  useEffect(() => {
    if (needsBrowsePicker && page === "nhaplieu") {
      setPage("sonhatky");
    }
  }, [needsBrowsePicker, page]);

  const browseWorkspaceReady = browse.browseActive && ready && roadSelected;
  const workspaceOpen = offlineMode
    ? roadSelected
    : needsBrowsePicker
      ? browseWorkspaceReady
      : roadSelected;
  const backupEditable = Boolean(offlineMode && offlineSession?.editable);
  const effectiveCanEdit = offlineMode ? backupEditable : canEditOfficeData;

  async function handleSaveEditedBackup() {
    const overwrite = Boolean(offlineSession?.fileHandle?.createWritable);
    if (overwrite && !window.confirm("Ghi đè trực tiếp lên file backup cũ? Thao tác này thay thế nội dung file hiện tại.")) return;
    setBackupSaving(true);
    try {
      const filename = overwrite
        ? await overwriteEditedOfficeBackup(offlineSession)
        : await downloadEditedOfficeBackup(offlineSession);
      window.alert(overwrite ? `Đã ghi đè file backup: ${filename}` : `Đã lưu bản sao mới: ${filename}`);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Không lưu được file backup mới.");
    } finally {
      setBackupSaving(false);
    }
  }

  useEffect(() => {
    if (!canUseFieldApp && portal === "hientruong") {
      setPortal("nhatky");
    }
  }, [canUseFieldApp, portal]);

  useEffect(() => {
    const onLocal = () => setStorageTick((t) => t + 1);
    window.addEventListener("nhatky-local-changed", onLocal);
    return () => window.removeEventListener("nhatky-local-changed", onLocal);
  }, []);

  useEffect(() => {
    setStorageTick((t) => t + 1);
  }, [routesViewMode, activeRoad?.roadName, activeRoad?.kmRange, activeRoad?.titleRouteIds]);

  useIncidentSync({
    uid: profile?.uid,
    storageKey,
    enabled: !offlineMode && canAccess && roadSelected && !needsBrowsePicker,
    onUpdated: () => setStorageTick((t) => t + 1)
  });

  useDataNoiNghiepSync({
    profile,
    enabled: !offlineMode && canAccess
  });

  const officeSync = useOfficeBooksSync({
    uid: ownerUid,
    roadId: activeRoadId,
    storageKey,
    focusDate: workspaceDate,
    enabled: !offlineMode && canAccess && !!ownerUid && !!activeRoadId && !!storageKey && workspaceOpen,
    canPush: canEditOfficeData && !browseMode,
    browseMode,
    catalogRoad: activeRoad,
    onHydrated: () => setStorageTick((t) => t + 1)
  });

  useCauInspectionSync({
    uid: ownerUid,
    roadId: activeRoadId,
    enabled: !offlineMode && canAccess && !!ownerUid && !!activeRoadId && workspaceOpen,
    canPush: canEditOfficeData && !browseMode,
    browseMode,
    onHydrated: () => setStorageTick((t) => t + 1)
  });

  useCongRegistryHydrate({
    uid: ownerUid,
    roads,
    ready: ready && !!ownerUid && workspaceOpen,
    enabled: !offlineMode && canAccess
  });

  function handleImported(nhatKyDate) {
    setStorageTick((t) => t + 1);
    if (nhatKyDate) setWorkspaceDate(nhatKyDate);
  }

  function handleChangeRoad() {
    if (offlineMode) {
      clearRoad();
      return;
    }
    if (needsBrowsePicker) {
      browse.clearAll();
    } else {
      clearRoad();
      setPage("nhaplieu");
    }
  }

  const showBrowsePicker = needsBrowsePicker && !offlineMode && !browseWorkspaceReady;

  if (!ready && !showBrowsePicker) {
    return (
      <div className="nhatky-login">
        <p className="section-guide">Đang tải danh sách đường...</p>
      </div>
    );
  }

  return (
    <div className="nhat-ky-app">
      <header className="nhat-ky-header">
        <div className="nhat-ky-nav nhat-ky-nav--portal">
          <a href={HOME_URL} className="nhat-ky-home-link" title="Về trung tâm quản lý đường bộ" aria-label="Về trung tâm quản lý đường bộ">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 10.5 12 3l9 7.5" />
              <path d="M5 9.5V20h14V9.5" />
              <path d="M10 20v-6h4v6" />
            </svg>
          </a>

          <button
            type="button"
            className={portal === "nhatky" ? "nav-active" : ""}
            onClick={() => setPortal("nhatky")}
          >
            SỔ NỘI NGHIỆP
          </button>

          <button
            type="button"
            className={portal === "hientruong" ? "nav-active" : ""}
            onClick={() => setPortal("hientruong")}
            disabled={!canUseFieldApp || offlineMode}
            title={offlineMode ? "Backup offline không mở App hiện trường" : !canUseFieldApp ? "Chỉ tài khoản USER được dùng App hiện trường" : undefined}
          >
            APP HIỆN TRƯỜNG
          </button>

          <div className="nhat-ky-nav-right">
            {offlineMode && <span className="backup-mode-chip">{backupEditable ? "BACKUP ĐANG SỬA" : "BACKUP CHỈ ĐỌC"}</span>}
            {workspaceOpen && (
              <RoadWorkspaceNav
                road={activeRoad}
                onChangeRoad={handleChangeRoad}
                browseUserName={needsBrowsePicker ? browse.selectedUser?.displayName : ""}
              />
            )}
            {workspaceOpen && canEditOfficeData && !browseMode && (
              <OfficeSyncStatus sync={officeSync} />
            )}
            {workspaceOpen && !offlineMode && <OfficeDayComparison sync={officeSync} />}
            {offlineMode ? (
              <>
                {!backupEditable && <button type="button" className="nhat-ky-backup-btn" onClick={() => { if (window.confirm("Chỉ sửa bản sao offline và không ghi lên Firebase. Tiếp tục?")) onEnableBackupEdit(); }}>Cho phép sửa</button>}
                {backupEditable && <button type="button" className="nhat-ky-backup-btn" disabled={backupSaving} onClick={() => void handleSaveEditedBackup()}>{backupSaving ? "Đang lưu..." : offlineSession?.fileHandle ? "Ghi đè file backup" : "Lưu bản sao mới"}</button>}
                <button type="button" className="nhat-ky-backup-btn" onClick={() => { if (!backupEditable || window.confirm("Đóng backup? Thay đổi chưa lưu thành file mới sẽ bị mất.")) onCloseBackup(); }}>Đóng backup</button>
              </>
            ) : (
              <button type="button" className="nhat-ky-backup-btn" onClick={() => setBackupOpen(true)}>Sao lưu</button>
            )}
            <span className="nhat-ky-user-chip" title={profile?.email || ""}>
              {profile?.displayName || profile?.email}
            </span>
            <button type="button" className="nhat-ky-logout-btn" onClick={() => void logout()}>
              Thoát
            </button>
          </div>
        </div>

        {workspaceOpen && portal === "nhatky" && (
          <div className="nhat-ky-header-subrow">
            <NhatKySubNav
              page={page}
              setPage={setPage}
              canEditOfficeData={effectiveCanEdit}
            />
          </div>
        )}
      </header>

      <div className="nhat-ky-body">
      {portal === "hientruong" ? (
        workspaceOpen ? (
          <HienTruongPage storageTick={storageTick} onImported={handleImported} />
        ) : (
          <div className="road-select-hint">
            <p>Chọn đường làm việc trong <strong>Sổ nội nghiệp</strong> trước khi đồng bộ app hiện trường vào sổ.</p>
            <button type="button" className="btn-primary" onClick={() => setPortal("nhatky")}>
              Chọn đường
            </button>
          </div>
        )
      ) : showBrowsePicker ? (
        <OfficeBrowseSelectPage />
      ) : !needsBrowsePicker && !roadSelected ? (
        <RoadSelectPage />
      ) : (
        <NhatKyWorkspace
          page={page}
          setPage={setPage}
          storageTick={storageTick}
          workspaceDate={workspaceDate}
          setWorkspaceDate={setWorkspaceDate}
          onStorageChange={() => setStorageTick((t) => t + 1)}
          matDuongQuickBoot={matDuongQuickBoot}
          onMatDuongQuickBootConsumed={() => setMatDuongQuickBoot(false)}
          nhapLieuBootSection={nhapLieuBootSection}
          onNhapLieuBootSection={setNhapLieuBootSection}
          onNhapLieuBootSectionConsumed={() => setNhapLieuBootSection("")}
          gptcBoot={gptcBoot}
          onGptcBoot={setGptcBoot}
          onGptcBootConsumed={() => setGptcBoot(null)}
          officeReadOnly={offlineMode ? !backupEditable : isOfficeReadOnly}
          canEditOfficeData={effectiveCanEdit}
        />
      )}
      </div>
      {backupOpen && <OfficeBackupDialog profile={profile} onClose={() => setBackupOpen(false)} onOpenInWebsite={(session) => { setBackupOpen(false); onOpenBackup(session); }} />}
    </div>
  );
}

function BaoCaoApp() {
  const { profile, logout } = useAuth();

  useEffect(() => {
    document.title = "Báo cáo khối lượng";
  }, []);

  return (
    <div className="nhat-ky-app nhat-ky-app--bao-cao">
      <header className="nhat-ky-header">
        <div className="nhat-ky-nav nhat-ky-nav--portal">
          <a href={HOME_URL} className="nhat-ky-home-link" title="Về trung tâm quản lý đường bộ" aria-label="Về trung tâm quản lý đường bộ">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 10.5 12 3l9 7.5" />
              <path d="M5 9.5V20h14V9.5" />
              <path d="M10 20v-6h4v6" />
            </svg>
          </a>
          <span className="nhat-ky-portal-title">
            BÁO CÁO
          </span>
          <div className="nhat-ky-nav-right">
            <span className="nhat-ky-user-chip" title={profile?.email || ""}>
              {profile?.displayName || profile?.email}
            </span>
            <button type="button" className="nhat-ky-logout-btn" onClick={() => void logout()}>
              Thoát
            </button>
          </div>
        </div>
      </header>
      <div className="nhat-ky-body">
        <ThongKeKhoiLuongChung />
      </div>
    </div>
  );
}

function AppShell() {
  const { loading, canAccess, profile, baoCaoMode } = useAuth();
  const { needsBrowsePicker, isAdmin, isSoXd } = useOfficePermissions();

  if (new URLSearchParams(window.location.search).get("backup") === "1") {
    return <PublicBackupApp />;
  }

  if (loading) {
    return (
      <div className="nhatky-login">
        <p className="section-guide">Đang kiểm tra đăng nhập...</p>
      </div>
    );
  }

  if (!canAccess) {
    window.location.replace(`${HOME_URL}?login=1&next=${encodeURIComponent(window.location.href)}`);
    return null;
  }

  if (baoCaoMode) {
    if (!isAdmin && !isSoXd) {
      window.location.replace(`${HOME_URL}?denied=bao-cao`);
      return null;
    }
    return <BaoCaoApp />;
  }

  return (
    <OfficeBrowseProvider>
      <AppWithRoadWorkspace profile={profile} needsBrowsePicker={needsBrowsePicker} />
    </OfficeBrowseProvider>
  );
}

function PublicBackupApp() {
  const [session, setSession] = useState(null);
  if (!session) {
    return <PublicBackupPicker onOpen={(opened) => setSession({ ...opened, editable: false })} />;
  }
  return (
    <OfficeBrowseProvider>
      <RoadWorkspaceProvider
        uid={session.offlineUid}
        browseMode={false}
        catalogLocked
        offlineMode
      >
        <AppContent
          offlineSession={session}
          onOpenBackup={(opened) => setSession({ ...opened, editable: false })}
          onEnableBackupEdit={() =>
            setSession((current) => (current ? { ...current, editable: true } : current))
          }
          onCloseBackup={() =>
            setSession((current) => {
              disposeOfficeBackup(current);
              return null;
            })
          }
        />
      </RoadWorkspaceProvider>
    </OfficeBrowseProvider>
  );
}

function PublicBackupPicker({ onOpen }) {
  const fileRef = useRef(null);
  const autoOpenedRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function openFile(file, fileHandle = null) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const payload = await readOfficeBackup(file);
      onOpen({ ...materializeOfficeBackup(payload), fileHandle });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không mở được file backup.");
    } finally {
      setBusy(false);
    }
  }

  async function chooseFile() {
    if (busy) return;
    if (typeof window.showOpenFilePicker !== "function") {
      fileRef.current?.click();
      return;
    }
    try {
      const [handle] = await window.showOpenFilePicker({
        multiple: false,
        types: [{ description: "Backup Nhật ký", accept: { "application/json": [".qldbackup"] } }]
      });
      if (handle) await openFile(await handle.getFile(), handle);
    } catch (err) {
      if (err instanceof Error && (err.name === "AbortError" || err.name === "NotAllowedError" || err.name === "SecurityError")) return;
      setError(err instanceof Error ? err.message : "Không mở được file backup.");
    }
  }

  useEffect(() => {
    if (autoOpenedRef.current) return;
    autoOpenedRef.current = true;
    void chooseFile();
  }, []);

  return (
    <div className="public-backup-picker">
      <div className="public-backup-picker-card">
        <span className="public-backup-picker-icon" aria-hidden="true">▣</span>
        <h1>Mở dữ liệu backup</h1>
        <p>Chọn file <strong>.qldbackup</strong> đã lưu trên máy tính.</p>
        <button type="button" className="btn-primary" disabled={busy} onClick={() => void chooseFile()}>
          {busy ? "Đang kiểm tra file..." : "Chọn file backup"}
        </button>
        <input
          ref={fileRef}
          hidden
          type="file"
          accept=".qldbackup,application/json"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            void openFile(file);
          }}
        />
        {error && <p className="public-backup-picker-error">{error}</p>}
        <a href={HOME_URL}>← Về Quản lý đường bộ</a>
      </div>
    </div>
  );
}

function AppWithRoadWorkspace({ profile, needsBrowsePicker }) {
  const browse = useOfficeBrowse();
  const { canManageOfficeCatalog } = useOfficePermissions();
  const [offlineSession, setOfflineSession] = useState(null);
  const browseReady = needsBrowsePicker && browse.browseActive;
  const dataOwnerUid =
    offlineSession?.offlineUid ||
    (needsBrowsePicker ? (browseReady ? browse.selectedUser?.uid : "") : profile?.uid);

  return (
    <RoadWorkspaceProvider
      uid={dataOwnerUid}
      browseMode={!offlineSession && browseReady}
      initialRoadId={browse.selectedRoadId}
      initialRouteId={browse.selectedRouteId}
      catalogLocked={!canManageOfficeCatalog}
      offlineMode={!!offlineSession}
    >
      <AppContent
        offlineSession={offlineSession}
        onOpenBackup={(session) => setOfflineSession({ ...session, editable: false })}
        onEnableBackupEdit={() => setOfflineSession((session) => session ? { ...session, editable: true } : session)}
        onCloseBackup={() => setOfflineSession((session) => { disposeOfficeBackup(session); return null; })}
      />
    </RoadWorkspaceProvider>
  );
}

function App() {
  useState(() => purgeStaleOfficeBackupStorage());
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

export default App;
