import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { RoadWorkspaceProvider, useRoadWorkspace } from "./context/RoadWorkspaceContext";
import { OfficeBrowseProvider, useOfficeBrowse } from "./context/OfficeBrowseContext";
import LoginPage from "./pages/LoginPage";
import RoadSelectPage from "./pages/RoadSelectPage";
import OfficeBrowseSelectPage from "./pages/OfficeBrowseSelectPage";
import NhapLieuPage from "./pages/NhapLieuPage";
import SoNhatKy from "./pages/SoNhatKy";
import SoMatDuong from "./pages/SoMatDuong";
import SoBaoDuong from "./pages/SoBaoDuong";
import SoTrafficDuty from "./pages/SoTrafficDuty";
import SoTngt from "./pages/SoTngt";
import SoHanhLang from "./pages/SoHanhLang";
import SoDemXe from "./pages/SoDemXe";
import SoCapPhepThiCong from "./pages/SoCapPhepThiCong";
import HienTruongPage from "./pages/HienTruongPage";
import ThongKeKhoiLuong from "./pages/ThongKeKhoiLuong";
import DanhMucBaoDuong from "./pages/DanhMucBaoDuong";
import HoSoCong from "./pages/HoSoCong";
import DanhSachCau from "./pages/DanhSachCau";
import PhieuKiemTraCau from "./pages/PhieuKiemTraCau";
import { useIncidentSync } from "./hooks/useIncidentSync";
import { useDataNoiNghiepSync } from "./hooks/useDataNoiNghiepSync";
import { useOfficeBooksSync } from "./hooks/useOfficeBooksSync";
import { useCauInspectionSync } from "./hooks/useCauInspectionSync";
import { useOfficePermissions } from "./hooks/useOfficePermissions";
import { formatKmDisplay, roadDisplayLabel } from "./utils/roadsCatalog";

const HOME_URL = "/san-pham";

function RoadWorkspaceNav({ road, onChangeRoad, browseUserName }) {
  if (!road) return null;

  const roadName = road.roadName || road.label || "";
  const kmFrom = formatKmDisplay(road.kmFrom);
  const kmTo = formatKmDisplay(road.kmTo);
  const kmText =
    kmFrom && kmTo
      ? `${kmFrom} → ${kmTo}`
      : road.kmRange
        ? road.kmRange.replace(/\s*[-–—]\s*/g, " → ")
        : "";

  return (
    <div className="road-workspace-nav" title={roadDisplayLabel(road)}>
      {browseUserName && (
        <span className="road-workspace-nav-browse-user">Xem: {browseUserName}</span>
      )}
      {roadName && <span className="road-workspace-nav-road">{roadName}</span>}
      {road.hat && <span className="road-workspace-nav-hat">Hạt {road.hat}</span>}
      {kmText && <span className="road-workspace-nav-km">{kmText}</span>}
      <button type="button" className="road-workspace-nav-switch" onClick={onChangeRoad}>
        {browseUserName ? "Đổi người / hạt" : "Đổi hạt"}
      </button>
    </div>
  );
}

function NhatKySubNav({ page, setPage, canEditOfficeData }) {
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
        MASTER DATA
      </button>
      <button
        type="button"
        className={page === "hosocong" ? "nav-active" : ""}
        onClick={() => setPage("hosocong")}
      >
        DANH SÁCH CỐNG
      </button>
      <button
        type="button"
        className={page === "danhsachcau" ? "nav-active" : ""}
        onClick={() => setPage("danhsachcau")}
      >
        DANH SÁCH CẦU
      </button>
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
  officeReadOnly,
  canEditOfficeData
}) {
  const goEdit = canEditOfficeData ? () => setPage("nhaplieu") : undefined;

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
          readOnly={officeReadOnly}
        />
      )}
      {page === "sonhatky" && (
        <SoNhatKy
          date={workspaceDate}
          onDateChange={setWorkspaceDate}
          onGoEdit={goEdit}
          storageTick={storageTick}
        />
      )}
      {page === "somatduong" && (
        <SoMatDuong
          workspaceDate={workspaceDate}
          onWorkspaceDateChange={setWorkspaceDate}
          onStorageChange={onStorageChange}
          storageTick={storageTick}
        />
      )}
      {page === "sobaoduong" && (
        <SoBaoDuong
          date={workspaceDate}
          onDateChange={setWorkspaceDate}
          onGoEdit={goEdit}
          storageTick={storageTick}
        />
      )}
      {page === "sotructraffic" && (
        <SoTrafficDuty onGoEdit={goEdit} storageTick={storageTick} />
      )}
      {page === "sotngt" && (
        <SoTngt onGoEdit={goEdit} storageTick={storageTick} />
      )}
      {page === "sohanhlang" && (
        <SoHanhLang onGoEdit={goEdit} storageTick={storageTick} />
      )}
      {page === "sodemxe" && <SoDemXe readOnly={officeReadOnly} />}
      {page === "sogptc" && <SoCapPhepThiCong readOnly={officeReadOnly} />}
      {page === "thongke" && (
        <ThongKeKhoiLuong storageTick={storageTick} readOnly={officeReadOnly} />
      )}
      {page === "baoduongdata" && <DanhMucBaoDuong />}
      {page === "hosocong" && <HoSoCong readOnly={officeReadOnly} />}
      {page === "danhsachcau" && <DanhSachCau readOnly={officeReadOnly} />}
      {page === "phieucau" && (
        <PhieuKiemTraCau readOnly={officeReadOnly} storageTick={storageTick} />
      )}
    </div>
  );
}

function AppContent() {
  const { canAccess, profile, logout } = useAuth();
  const { canEditOfficeData, canUseFieldApp, isOfficeReadOnly, needsBrowsePicker } =
    useOfficePermissions();
  const browse = useOfficeBrowse();
  const { ready, roadSelected, storageKey, activeRoad, activeRoadId, ownerUid, browseMode, clearRoad } =
    useRoadWorkspace();
  const [portal, setPortal] = useState("nhatky");
  const [page, setPage] = useState(() => (needsBrowsePicker ? "sonhatky" : "nhaplieu"));
  const [storageTick, setStorageTick] = useState(0);
  const [workspaceDate, setWorkspaceDate] = useState(
    () => new Date().toISOString().split("T")[0]
  );
  const [matDuongQuickBoot, setMatDuongQuickBoot] = useState(false);

  useEffect(() => {
    if (needsBrowsePicker && page === "nhaplieu") {
      setPage("sonhatky");
    }
  }, [needsBrowsePicker, page]);

  const workspaceOpen = needsBrowsePicker ? browse.browseActive : roadSelected;

  useEffect(() => {
    if (!canUseFieldApp && portal === "hientruong") {
      setPortal("nhatky");
    }
  }, [canUseFieldApp, portal]);

  useIncidentSync({
    uid: profile?.uid,
    storageKey,
    enabled: canAccess && roadSelected && !needsBrowsePicker,
    onUpdated: () => setStorageTick((t) => t + 1)
  });

  useDataNoiNghiepSync({
    profile,
    enabled: canAccess
  });

  useOfficeBooksSync({
    uid: ownerUid,
    roadId: activeRoadId,
    storageKey,
    enabled: canAccess && !!ownerUid && !!activeRoadId && !!storageKey && workspaceOpen,
    canPush: canEditOfficeData && !browseMode,
    browseMode,
    onHydrated: () => setStorageTick((t) => t + 1)
  });

  useCauInspectionSync({
    uid: ownerUid,
    roadId: activeRoadId,
    enabled: canAccess && !!ownerUid && !!activeRoadId && workspaceOpen,
    canPush: canEditOfficeData && !browseMode,
    browseMode,
    onHydrated: () => setStorageTick((t) => t + 1)
  });

  function handleImported(nhatKyDate) {
    setStorageTick((t) => t + 1);
    if (nhatKyDate) setWorkspaceDate(nhatKyDate);
  }

  function handleChangeRoad() {
    if (needsBrowsePicker) {
      browse.clearAll();
    } else {
      clearRoad();
      setPage("nhaplieu");
    }
  }

  if (!ready) {
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
          <a href={HOME_URL} className="nhat-ky-home-link" title="Trang chủ" aria-label="Trang chủ">
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
            disabled={!canUseFieldApp}
            title={!canUseFieldApp ? "Chỉ tài khoản USER được dùng App hiện trường" : undefined}
          >
            APP HIỆN TRƯỜNG
          </button>

          <div className="nhat-ky-nav-right">
            <span className="nhat-ky-user-chip">
              {profile?.displayName || profile?.email}
            </span>
            <button type="button" className="nhat-ky-logout-btn" onClick={() => void logout()}>
              Đăng xuất
            </button>
          </div>
        </div>

        {workspaceOpen && (
          <div className="nhat-ky-header-subrow">
            {portal === "nhatky" && (
              <NhatKySubNav
                page={page}
                setPage={setPage}
                canEditOfficeData={canEditOfficeData}
              />
            )}
            <RoadWorkspaceNav
              road={activeRoad}
              onChangeRoad={handleChangeRoad}
              browseUserName={needsBrowsePicker ? browse.selectedUser?.displayName : ""}
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
      ) : needsBrowsePicker && !browse.browseActive ? (
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
          officeReadOnly={isOfficeReadOnly}
          canEditOfficeData={canEditOfficeData}
        />
      )}
      </div>
    </div>
  );
}

function AppShell() {
  const { loading, canAccess, profile } = useAuth();
  const { needsBrowsePicker } = useOfficePermissions();

  if (loading) {
    return (
      <div className="nhatky-login">
        <p className="section-guide">Đang kiểm tra đăng nhập...</p>
      </div>
    );
  }

  if (!canAccess) {
    return <LoginPage />;
  }

  return (
    <OfficeBrowseProvider>
      <AppWithRoadWorkspace profile={profile} needsBrowsePicker={needsBrowsePicker} />
    </OfficeBrowseProvider>
  );
}

function AppWithRoadWorkspace({ profile, needsBrowsePicker }) {
  const browse = useOfficeBrowse();
  const { canManageOfficeCatalog } = useOfficePermissions();
  const dataOwnerUid = needsBrowsePicker ? browse.selectedUser?.uid : profile?.uid;

  return (
    <RoadWorkspaceProvider
      uid={dataOwnerUid}
      browseMode={needsBrowsePicker && !!browse.selectedUser}
      initialRoadId={browse.selectedRoadId}
      catalogLocked={!canManageOfficeCatalog}
    >
      <AppContent />
    </RoadWorkspaceProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

export default App;
