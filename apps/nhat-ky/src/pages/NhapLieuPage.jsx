import { useState, useEffect, useMemo } from "react";
import NhatKyReview from "../components/NhatKyReview";
import DraggableFormPanel from "../components/DraggableFormPanel";
import TngtEntryForm from "../components/TngtEntryForm";
import HanhLangEntryForm from "../components/HanhLangEntryForm";
import HanhLangQuickEntry from "../components/HanhLangQuickEntry";
import MatDuongEntryForm from "../components/MatDuongEntryForm";
import EntryRoutePicker from "../components/EntryRoutePicker";
import SidebarResizer from "../components/SidebarResizer";
import { useResizableSidebar } from "../hooks/useResizableSidebar";
import {
  SECTIONS,
  VISIBLE_SECTIONS,
  EMPTY_DAY_META,
  EMPTY_REPORT_META,
  loadStorage,
  saveStorage,
  getDayMeta,
  migrateEntry,
  sortEntriesOnDate,
  compareEntriesByTypeAndKm,
  entryIncidentType,
  resolveNenDuongDiaryType,
  DIARY_ENTRY_COLUMN_HINT,
  HANH_LANG_SECTION,
  isHanhLangSectionTitle,
  formatSectionPartPrefix
} from "../utils/nhatKyFormat";
import {
  MAT_DUONG_SECTION,
  defaultExportMatDuong,
  withMatDuongKmTo,
  formatKmCell
} from "../utils/matDuongFormat";
import { withHanhLangKmTo } from "../utils/hanhLangFormat";
import { syncNhatKyLeaderNoteToGptc } from "../utils/gptcNhatKySync";
import { addMetersToKm, normalizeKmInput } from "../utils/nhatKyFormat";
import {
  defaultPlannedRepairDate,
  maxPlannedRepairDate,
  plannedRepairDateForType,
  validatePlannedRepairDate,
  isBaoDuongSection,
  applyBaoDuongDiaryNotes,
  BAO_DUONG_MAX_DAYS
} from "../utils/baoDuongFormat";
import {
  listFormTypesForSection,
  isMasterDataSection,
  getUnitForType,
  formatUnitLabel,
  normalizeUnitValue,
  needMaintenanceForType,
  BAO_DUONG_QUALITY_EVENT
} from "../utils/baoDuongQualityStore";
import {
  mergeDiaryEntries,
  validateDiaryMergeSelection,
  unmergeDiaryEntries,
  isMergedDiaryEntry
} from "../utils/mergeDiaryEntries";
import MatDuongQuickEntry from "../components/MatDuongQuickEntry";
import BaoDuongQuickEntry from "../components/BaoDuongQuickEntry";
import CongQuickEntry from "../components/CongQuickEntry";
import WorkTypeCombo from "../components/WorkTypeCombo";
import ViDateInput from "../components/ViDateInput";
import {
  collectDiaryFilledDates,
  missingDiaryDatesYearToDate
} from "../utils/diaryCalendarGaps";
import { makeEmptyQuickRows } from "../utils/bulkMatDuongImport";
import {
  NEN_DUONG_SECTION,
  defaultExportTrafficDuty,
  isBaoLuTickSection,
  looksLikeEmail,
  isLegacyAutoRestoredAt
} from "../utils/trafficDutyFormat";
import {
  TNGT_SECTION,
  defaultExportTngt
} from "../utils/tngtFormat";
import {
  defaultExportHanhLang
} from "../utils/hanhLangFormat";
import { useAuth } from "../context/AuthContext";
import { useOfficePermissions } from "../hooks/useOfficePermissions";
import {
  fetchMatDuongIncidentTypes,
  fetchMasterData,
  getCatalogOwnerUid,
  pickMatDuongTypes,
  pickThoatNuocTypes,
  splitCongRanhTypes,
  DEFAULT_CONG_WORK_TYPES
} from "../services/masterDataService";
import { useRoadWorkspace } from "../context/RoadWorkspaceContext";
import {
  loadNhatKySignNames,
  resolveHatSignRoleLabel
} from "../utils/nhatKySignNames";
import {
  resolveReportMetaFromRoad,
  findRoute,
  getRoadRoutes,
  pickActiveRoute,
  routeNameLabel
} from "../utils/roadsCatalog";
import { persistImportMapFromEntries } from "../services/nhatKyImportService";
import {
  applyCongExportStatusesToRegistry,
  resolveCongScope,
  writeCongScope
} from "../utils/congRegistryStore";
import {
  loadCauRegistryForRoute,
  CAU_REGISTRY_EVENT,
  CAU_SECTION
} from "../utils/cauRegistryStore";
import { hydrateCauRegistriesFromCloud } from "../services/cauRegistryService";
import { syncCauInspectionsFromEntries } from "../utils/cauInspectionStore";

const LE_DUONG_SECTION = "Lề đường";
const THOAT_NUOC_SECTION = "Cống, rãnh thoát nước";
/** Các hạng mục bảo dưỡng dùng bảng nhập nhanh (đơn vị/khối lượng theo loại công việc). */
const BAO_DUONG_QUICK_SECTIONS = new Set([
  "Nền đường",
  "Cống, rãnh thoát nước",
  "Ngầm, tràn (lũ, ngập)",
  "Công trình an toàn giao thông",
  "Công trình cầu"
]);
const QUICK_GRID_SECTIONS = new Set([
  MAT_DUONG_SECTION,
  LE_DUONG_SECTION,
  HANH_LANG_SECTION,
  ...BAO_DUONG_QUICK_SECTIONS
]);

/** Chuyển một ghi chép đã lưu → một dòng bảng nhập nhanh để sửa. */
function entryToQuickRow(item, globalIndex) {
  if (isHanhLangSectionTitle(item.section)) {
    return {
      time: item.time || "",
      kmFrom: item.kmFrom ? formatKmCell(item.kmFrom) || item.kmFrom : "",
      kmTo: item.kmTo ? formatKmCell(item.kmTo) || item.kmTo : "",
      side: item.side || "",
      hlRecorder: item.hlRecorder || "",
      hlViolator: item.hlViolator || "",
      hlAddress: item.hlAddress || "",
      content: item.content || "",
      length: item.length ?? "",
      width: item.width ?? "",
      resolved: item.hlProcessNote || item.resolved || "",
      hlNote: item.hlNote || "",
      exportHanhLang: item.exportHanhLang,
      routeId: item.routeId || "",
      roadName: item.roadName || "",
      _editIndex: globalIndex
    };
  }
  return {
    kmFrom: item.kmFrom ? formatKmCell(item.kmFrom) || item.kmFrom : "",
    kmTo: item.kmTo ? formatKmCell(item.kmTo) || item.kmTo : "",
    side: item.side || "",
    length: item.length ?? "",
    width: item.width ?? "",
    height: item.height ?? "",
    unit: resolveQuickRowUnit(item),
    quantity: item.quantity ?? "",
    type: resolveNenDuongDiaryType(item) || item.type || "",
    content: item.content || "",
    resolvedStatus: item.resolvedStatus || "",
    exportMatDuong: item.exportMatDuong,
    exportTrafficDuty: item.exportTrafficDuty ?? defaultExportTrafficDuty(item),
    exportPhieuCau: item.exportPhieuCau,
    routeId: item.routeId || "",
    roadName: item.roadName || "",
    bridgeId: item.bridgeId || "",
    bridgeName: item.bridgeName || "",
    plannedRepairDate: item.plannedRepairDate || "",
    congId: item.congId || item.assetId || "",
    congType: item.viTriNote || "",
    congLength: item.length ?? "",
    exportCongStatus:
      item.exportCongStatus ||
      (item.exportCongList === true ? "hu_hong" : ""),
    _editIndex: globalIndex
  };
}

/** Đơn vị dòng sửa: luôn ưu tiên MASTER DATA. */
function resolveQuickRowUnit(item) {
  const catalog = normalizeUnitValue(getUnitForType(item?.type));
  if (catalog) return catalog;
  return normalizeUnitValue(item?.unit) || "m2";
}

/** Đơn vị form chi tiết: MASTER DATA (catalog sống), không nhận nhập tay. */
function resolveFormCatalogUnit(type, unitMap = {}, fallback = "") {
  return (
    normalizeUnitValue(getUnitForType(type) || (type && unitMap[type]) || "") ||
    normalizeUnitValue(fallback) ||
    ""
  );
}

function calcFormQuantity(unit, length, width, height, quantity) {
  const u = normalizeUnitValue(unit);
  const l = Number(length || 0);
  const w = Number(width || 0);
  const h = Number(height || 0);
  if (u === "m") return l;
  if (u === "m2") return l * w;
  if (u === "m3") return l * w * h;
  return Number(quantity || 0);
}

const EMPTY_FORM = {
  type: "",
  time: "",
  kmFrom: "",
  kmTo: "",
  side: "",
  locationNote: "",
  length: "",
  width: "",
  height: "",
  unit: "m2",
  quantity: "",
  content: "",
  resolved: "",
  leaderNote: "",
  inspectorNote: "",
  damageLevel: "",
  resolvedStatus: "",
  inspectorSign: "",
  exportMatDuong: true,
  plannedRepairDate: "",
  measureSummary: "",
  mainResult: "",
  exportTrafficDuty: false,
  dutyPerson: "",
  trafficCause: "",
  trafficRestoredAt: "",
  trafficNote: "",
  exportTngt: true,
  tngtOccurDate: "",
  tngtOccurTime: "",
  tngtCauseDetail: "",
  tngtCauseCategory: "nguoi",
  vehicleAutoType: "",
  vehicleMotoInvolved: false,
  vehicleBikeInvolved: false,
  tngtCauseDuong: false,
  tngtCauseNguoi: true,
  tngtCausePhuongTien: false,
  vehicleAuto: "",
  vehicleMoto: "",
  vehicleBike: "",
  casualtyDead: "",
  casualtyInjured: "",
  casualtyHumanNote: "",
  damageRoadMillion: "",
  damageRoadNote: "",
  damageVehicleMillion: "",
  damageVehicleNote: "",
  tngtNote: "",
  tngtWitnessStatement: "",
  exportHanhLang: false,
  hlRecorder: "",
  hlViolator: "",
  hlAddress: "",
  hlRecordDate: "",
  hlProcessNote: "",
  hlNote: "",
  routeId: "",
  roadName: ""
};

export default function NhapLieuPage({
  date,
  onDateChange,
  storageTick = 0,
  onStorageChange,
  matDuongQuickBoot = false,
  onMatDuongQuickBootConsumed,
  bootSection = "",
  onBootSectionConsumed,
  onOpenGptcDetail,
  readOnly = false
}) {
  const { profile } = useAuth();
  const { isAdmin } = useOfficePermissions();
  const { storageKey, activeRoadId, ownerUid, activeRoad, catalogRoad, activeRouteId, selectRoute, routes, browseMode } =
    useRoadWorkspace();
  const signNames = useMemo(() => loadNhatKySignNames(storageKey), [storageKey]);
  const initial = loadStorage(storageKey);
  const [currentSection, setCurrentSection] = useState("");
  const [editingIndex, setEditingIndex] = useState(-1);
  const [data, setData] = useState(() =>
    initial.entries.map(migrateEntry)
  );
  const [dayMetaMap, setDayMetaMap] = useState(initial.dayMeta || {});
  const [reportMeta, setReportMeta] = useState(() =>
    resolveReportMetaFromRoad(initial.reportMeta, activeRoad)
  );
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saveMessage, setSaveMessage] = useState("");
  const { sidebarStyle, onResizeStart } = useResizableSidebar({ defaultWidth: 340 });
  const [matDuongMode, setMatDuongMode] = useState("single");
  const [quickRows, setQuickRows] = useState(() => makeEmptyQuickRows(8));
  const [congSubTab, setCongSubTab] = useState("cong");
  const [showEntryDetails, setShowEntryDetails] = useState(false);
  const [expandedSections, setExpandedSections] = useState(() => new Set());
  const [bulkDeleteMode, setBulkDeleteMode] = useState(false);
  const [bulkMergeMode, setBulkMergeMode] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState(() => new Set());
  const [selectedForMerge, setSelectedForMerge] = useState(() => new Set());
  const [matDuongTypes, setMatDuongTypes] = useState(
    () => SECTIONS.find((s) => s.key === "mat_duong")?.types || []
  );
  const [thoatNuocMasterTypes, setThoatNuocMasterTypes] = useState([]);
  const [unitByType, setUnitByType] = useState({});
  const [cauBridges, setCauBridges] = useState([]);
  const [catalogTick, setCatalogTick] = useState(0);

  useEffect(() => {
    const onChange = () => setCatalogTick((n) => n + 1);
    window.addEventListener(BAO_DUONG_QUALITY_EVENT, onChange);
    return () => window.removeEventListener(BAO_DUONG_QUALITY_EVENT, onChange);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function reloadCau() {
      const uid = ownerUid || profile?.uid || "";
      if (!uid || !activeRoadId) {
        setCauBridges([]);
        return;
      }
      const roadForHydrate = catalogRoad || activeRoad;
      if (roadForHydrate) {
        try {
          await hydrateCauRegistriesFromCloud(uid, [roadForHydrate], {
            force: browseMode || readOnly
          });
        } catch {
          /* giữ list local nếu có */
        }
      }
      if (cancelled) return;
      const routeList = routes?.length ? routes : getRoadRoutes(catalogRoad || activeRoad);
      const route = pickActiveRoute(routeList, activeRouteId);
      setCauBridges(loadCauRegistryForRoute(uid, activeRoadId, route, routeList));
    }
    void reloadCau();
    function onRegistry() {
      void reloadCau();
    }
    window.addEventListener(CAU_REGISTRY_EVENT, onRegistry);
    return () => {
      cancelled = true;
      window.removeEventListener(CAU_REGISTRY_EVENT, onRegistry);
    };
  }, [
    ownerUid,
    profile?.uid,
    activeRoadId,
    activeRouteId,
    catalogRoad,
    activeRoad,
    routes,
    browseMode,
    readOnly
  ]);

  const dayMeta = getDayMeta(dayMetaMap, date);

  useEffect(() => {
    const ownerUid = getCatalogOwnerUid(profile);
    if (!ownerUid) return;
    let cancelled = false;
    fetchMasterData(ownerUid)
      .then((data) => {
        if (cancelled) return;
        const types = pickMatDuongTypes(data.typesByGroup);
        if (types.length) setMatDuongTypes(types);
        const thoat = pickThoatNuocTypes(data.typesByGroup);
        setThoatNuocMasterTypes(thoat);
        setUnitByType(data.unitByType && typeof data.unitByType === "object" ? data.unitByType : {});
      })
      .catch(() => {
        if (!cancelled) {
          fetchMatDuongIncidentTypes(ownerUid).then((types) => {
            if (!cancelled && types.length) setMatDuongTypes(types);
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [profile?.uid, profile?.catalogOwnerUid, profile?.role]);

  useEffect(() => {
    if (!matDuongQuickBoot) return;
    setCurrentSection(MAT_DUONG_SECTION);
    setEditingIndex(-1);
    setMatDuongMode("bulk");
    setForm({ ...EMPTY_FORM });
    setQuickRows(makeEmptyQuickRows(8));
    setShowEntryDetails(true);
    setExpandedSections((prev) => new Set([...prev, "mat_duong"]));
    onMatDuongQuickBootConsumed?.();
  }, [matDuongQuickBoot, onMatDuongQuickBootConsumed]);

  useEffect(() => {
    const title = String(bootSection || "").trim();
    if (!title) return;
    openForm(title);
    const key = SECTIONS.find((s) => s.title === title)?.key;
    if (key) {
      setShowEntryDetails(true);
      setExpandedSections((prev) => new Set([...prev, key]));
    }
    onBootSectionConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootSection]);

  useEffect(() => {
    if (!storageTick) return;
    const stored = loadStorage(storageKey);
    setData(stored.entries.map(migrateEntry));
    setDayMetaMap(stored.dayMeta || {});
    setReportMeta(resolveReportMetaFromRoad(stored.reportMeta, activeRoad));
    setSaveMessage("Đã đồng bộ dữ liệu từ App hiện trường.");
  }, [storageTick, storageKey, activeRoad]);

  const missingDates = useMemo(() => {
    if (!isAdmin) return [];
    const filled = collectDiaryFilledDates(data);
    return missingDiaryDatesYearToDate(filled);
  }, [data, isAdmin]);

  useEffect(() => {
    setReportMeta((prev) => resolveReportMetaFromRoad(prev, activeRoad));
  }, [
    activeRoad?.id,
    activeRoad?.company,
    activeRoad?.hat,
    activeRoad?.roadName,
    activeRoad?.label,
    activeRoad?.kmRange
  ]);

  useEffect(() => {
    if (!currentSection || !showEntryDetails) return;
    const key = SECTIONS.find((s) => s.title === currentSection)?.key;
    if (!key) return;
    setExpandedSections((prev) => new Set([...prev, key]));
  }, [currentSection, showEntryDetails]);

  function persistNow(
    nextData = data,
    nextDayMetaMap = dayMetaMap,
    nextReportMeta = reportMeta,
    message = "Đã lưu."
  ) {
    if (readOnly) return;
    const saved = saveStorage(nextData, nextDayMetaMap, nextReportMeta, storageKey);
    if (!saved) {
      setSaveMessage(
        "Không lưu được: bộ nhớ trình duyệt đầy. Dòng vừa nhập vẫn ở trên màn hình — đừng tải lại trang."
      );
      return;
    }
    const uid = ownerUid || profile?.uid || "";
    if (uid && activeRoadId && cauBridges.length) {
      syncCauInspectionsFromEntries(
        uid,
        activeRoadId,
        cauBridges,
        nextData,
        profile?.displayName || profile?.email || ""
      );
    }
    if (message) {
      setSaveMessage(message);
      setTimeout(() => setSaveMessage(""), 2500);
    }
    onStorageChange?.();
    const importUid = ownerUid || profile?.uid || "";
    void persistImportMapFromEntries(importUid, storageKey, nextData).catch(() => {
      setSaveMessage("Đã lưu local; chưa đồng bộ trạng thái «đã vào NK» lên cloud.");
    });
  }

  function updateDayMeta(patch) {
    const nextDayMetaMap = {
      ...dayMetaMap,
      [date]: { ...getDayMeta(dayMetaMap, date), ...patch }
    };
    setDayMetaMap(nextDayMetaMap);
    persistNow(data, nextDayMetaMap, reportMeta);
  }

  function openForm(sectionTitle, itemIndex = -1) {
    if (readOnly) {
      setCurrentSection(sectionTitle);
      setEditingIndex(-1);
      return;
    }
    setCurrentSection(sectionTitle);
    setEditingIndex(itemIndex);
    setMatDuongMode("single");
    setQuickRows(makeEmptyQuickRows(8));
    if (itemIndex >= 0) {
      const item = data[itemIndex];
      const type = resolveNenDuongDiaryType(item) || item.type;
      const unit = resolveFormCatalogUnit(type, unitByType, item.unit);
      const quantity = calcFormQuantity(
        unit,
        item.length,
        item.width,
        item.height,
        item.quantity
      );
      setForm({
        type,
        time: item.time || "",
        kmFrom: item.kmFrom ? formatKmCell(item.kmFrom) || item.kmFrom : item.kmFrom,
        kmTo: item.kmTo ? formatKmCell(item.kmTo) || item.kmTo : item.kmTo,
        side: item.side,
        locationNote: item.locationNote || "",
        length: item.length,
        width: item.width,
        height: item.height,
        unit: unit || item.unit,
        quantity,
        content: item.content,
        resolved: item.resolved || item.solution || "",
        leaderNote: item.leaderNote || "",
        inspectorNote: item.inspectorNote || "",
        damageLevel: item.damageLevel || "",
        resolvedStatus: item.resolvedStatus || "",
        inspectorSign: item.inspectorSign || "",
        exportMatDuong: item.exportMatDuong ?? defaultExportMatDuong(item.type),
        plannedRepairDate: item.plannedRepairDate || "",
        measureSummary: item.measureSummary || "",
        mainResult: item.mainResult || "",
        exportTrafficDuty: item.exportTrafficDuty ?? defaultExportTrafficDuty(item),
        dutyPerson: looksLikeEmail(item.dutyPerson) ? "" : item.dutyPerson || "",
        trafficCause: item.trafficCause || "",
        trafficRestoredAt: isLegacyAutoRestoredAt(item) ? "" : item.trafficRestoredAt || "",
        trafficNote: item.trafficNote || "",
        exportTngt: item.exportTngt ?? defaultExportTngt(),
        tngtOccurDate: item.tngtOccurDate || item.date || date,
        tngtOccurTime: item.tngtOccurTime || "",
        tngtCauseDetail: item.tngtCauseDetail || item.content || "",
        tngtCauseCategory: item.tngtCauseCategory || "nguoi",
        vehicleAutoType: item.vehicleAutoType || item.vehicleAuto || "",
        vehicleMotoInvolved: item.vehicleMotoInvolved ?? Number(item.vehicleMoto) > 0,
        vehicleBikeInvolved: item.vehicleBikeInvolved ?? Number(item.vehicleBike) > 0,
        tngtCauseDuong: item.tngtCauseDuong ?? item.tngtCauseCategory === "duong",
        tngtCauseNguoi: item.tngtCauseNguoi ?? (item.tngtCauseCategory === "nguoi" || !item.tngtCauseCategory),
        tngtCausePhuongTien: item.tngtCausePhuongTien ?? item.tngtCauseCategory === "phuong_tien",
        vehicleAuto: item.vehicleAuto ?? "",
        vehicleMoto: item.vehicleMoto ?? "",
        vehicleBike: item.vehicleBike ?? "",
        casualtyDead: item.casualtyDead ?? "",
        casualtyInjured: item.casualtyInjured ?? "",
        casualtyHumanNote: item.casualtyHumanNote || "",
        damageRoadMillion: item.damageRoadMillion ?? "",
        damageRoadNote: item.damageRoadNote || "",
        damageVehicleMillion: item.damageVehicleMillion ?? "",
        damageVehicleNote: item.damageVehicleNote || "",
        tngtNote: item.tngtNote || "",
        tngtWitnessStatement: item.tngtWitnessStatement || "",
        exportHanhLang: item.exportHanhLang ?? defaultExportHanhLang(),
        hlRecorder: item.hlRecorder || "",
        hlViolator: item.hlViolator || "",
        hlAddress: item.hlAddress || "",
        hlRecordDate: item.hlRecordDate || item.date || date,
        hlProcessNote: item.hlProcessNote || item.resolved || "",
        hlNote: item.hlNote || item.inspectorNote || "",
        routeId: item.routeId || "",
        roadName: item.roadName || ""
      });
      if (item.routeId) selectRoute(item.routeId);
    } else {
      setForm({
        ...EMPTY_FORM,
        unit: "m2",
        exportMatDuong: true,
        exportTngt: sectionTitle === TNGT_SECTION,
        exportHanhLang: sectionTitle === HANH_LANG_SECTION,
        type: sectionTitle === TNGT_SECTION ? "Tai nạn giao thông" : "",
        tngtOccurDate: sectionTitle === TNGT_SECTION ? date : "",
        hlRecordDate: sectionTitle === HANH_LANG_SECTION ? date : "",
        side: sectionTitle === TNGT_SECTION || sectionTitle === HANH_LANG_SECTION ? "P" : "",
        tngtCauseNguoi: sectionTitle === TNGT_SECTION,
        plannedRepairDate: isBaoDuongSection(sectionTitle)
          ? defaultPlannedRepairDate(date)
          : "",
        routeId: "",
        roadName: ""
      });
    }
  }

  function resetForm() {
    setForm({ ...EMPTY_FORM });
    setEditingIndex(-1);
  }

  /** Bấm 1 sự cố ở mục dùng bảng nhập nhanh → nạp vào bảng để sửa (gộp nhiều dòng). */
  function editEntryInGrid(globalIndex, sectionTitle) {
    if (readOnly) {
      setCurrentSection(sectionTitle);
      return;
    }
    const item = data[globalIndex];
    if (!item) return;
    const switching = sectionTitle !== currentSection;
    setCurrentSection(sectionTitle);
    setEditingIndex(-1);
    if (item.routeId) selectRoute(item.routeId);
    setQuickRows((prev) => {
      if (switching) {
        return [entryToQuickRow(item, globalIndex), ...makeEmptyQuickRows(4)];
      }
      if (prev.some((r) => r._editIndex === globalIndex)) return prev;
      const edits = prev.filter((r) => Number.isInteger(r._editIndex));
      const empties = prev.filter((r) => !Number.isInteger(r._editIndex));
      const keptEmpties = empties.length ? empties : makeEmptyQuickRows(4);
      return [...edits, entryToQuickRow(item, globalIndex), ...keptEmpties];
    });
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => {
      const newForm = {
        ...prev,
        [name]: type === "checkbox" ? checked : value
      };
      if (name === "type" && value) {
        const catalogUnit = normalizeUnitValue(
          getUnitForType(value) || unitByType[value] || ""
        );
        if (catalogUnit) newForm.unit = catalogUnit;
        if (catalogUnit === "m") {
          newForm.width = "";
          newForm.height = "";
        } else if (catalogUnit === "m2") {
          newForm.height = "";
        }
      }
      if (name === "type" && currentSection === MAT_DUONG_SECTION) {
        newForm.exportMatDuong = defaultExportMatDuong(value);
        if (!defaultExportMatDuong(value) || !needMaintenanceForType(value)) {
          newForm.plannedRepairDate = "";
        } else if (!newForm.plannedRepairDate) {
          newForm.plannedRepairDate = plannedRepairDateForType(date, value);
        }
      }
      if (
        name === "type" &&
        currentSection !== MAT_DUONG_SECTION &&
        isBaoDuongSection(currentSection) &&
        value
      ) {
        if (!needMaintenanceForType(value)) {
          newForm.plannedRepairDate = "";
        } else if (!newForm.plannedRepairDate) {
          newForm.plannedRepairDate = plannedRepairDateForType(date, value);
        }
      }
      if (name === "resolved" && currentSection === HANH_LANG_SECTION) {
        newForm.hlProcessNote = value;
      }
      if (
        (currentSection === MAT_DUONG_SECTION ||
          currentSection === HANH_LANG_SECTION) &&
        (name === "kmFrom" || name === "length")
      ) {
        const kmFrom = normalizeKmInput(newForm.kmFrom);
        if (kmFrom && currentSection === MAT_DUONG_SECTION) {
          newForm.kmFrom = kmFrom;
        }
        const len = Number(String(newForm.length || "").replace(",", ".")) || 0;
        if (kmFrom) {
          newForm.kmTo = len > 0 ? addMetersToKm(kmFrom, len) : kmFrom;
        }
      }
      const l = Number(newForm.length || 0);
      const w = Number(newForm.width || 0);
      const h = Number(newForm.height || 0);
      let quantity = 0;
      if (newForm.unit === "m") quantity = l;
      else if (newForm.unit === "m2") quantity = l * w;
      else if (newForm.unit === "m3") quantity = l * w * h;
      else quantity = Number(newForm.quantity || 0);
      newForm.quantity = quantity;
      return newForm;
    });
  }

  function updateItemField(globalIndex, field, value) {
    if (readOnly) return;
    const next = [...data];
    const prev = next[globalIndex];
    next[globalIndex] = { ...prev, [field]: value };
    setData(next);
    if (editingIndex === globalIndex) {
      setForm((f) => ({ ...f, [field]: value }));
    }
    persistNow(next, dayMetaMap, reportMeta);
    if (
      field === "leaderNote" &&
      prev?.sourceGptcEntryId &&
      ownerUid &&
      activeRoadId
    ) {
      try {
        syncNhatKyLeaderNoteToGptc({
          uid: ownerUid,
          roadId: activeRoadId,
          sourceGptcPermitId: prev.sourceGptcPermitId,
          sourceGptcEntryId: prev.sourceGptcEntryId,
          leaderNote: value
        });
      } catch (err) {
        console.warn("Đồng bộ ý kiến Hạt NK → CPTC thất bại.", err);
      }
    }
  }

  function addToPreview() {
    if (readOnly) return;
    if (
      !form.type &&
      currentSection !== TNGT_SECTION &&
      currentSection !== HANH_LANG_SECTION
    ) {
      window.alert("Vui lòng chọn loại sự cố / nội dung ghi chép.");
      return;
    }
    if (currentSection === HANH_LANG_SECTION && !form.content?.trim()) {
      window.alert("Vui lòng nhập nội dung vi phạm (cột 3 nhật ký / cột 7 sổ hành lang).");
      return;
    }
    if (currentSection === TNGT_SECTION && form.exportTngt) {
      if (!form.kmFrom?.trim()) {
        window.alert("Vui lòng nhập lý trình (cột 2 nhật ký tuần đường).");
        return;
      }
      if (!form.tngtCauseDetail?.trim()) {
        window.alert("Vui lòng mô tả diễn biến tai nạn (ghi vào sổ nhật ký).");
        return;
      }
      if (!form.tngtCauseDuong && !form.tngtCauseNguoi && !form.tngtCausePhuongTien) {
        window.alert("Chọn ít nhất một nguyên nhân (cột 7–9 sổ TNGT).");
        return;
      }
    }
    if (currentSection === HANH_LANG_SECTION && form.exportHanhLang) {
      if (!form.kmFrom?.trim()) {
        window.alert("Vui lòng nhập lý trình (cột 2 nhật ký tuần đường).");
        return;
      }
    }
    if (isBaoDuongSection(currentSection) && form.plannedRepairDate) {
      const check = validatePlannedRepairDate(date, form.plannedRepairDate);
      if (!check.ok) {
        window.alert(check.msg);
        return;
      }
    }
    const activeRt =
      findRoute(catalogRoad, form.routeId || activeRouteId) ||
      getRoadRoutes(catalogRoad)[0] ||
      null;
    const savedType =
      form.type || (currentSection === TNGT_SECTION ? "Tai nạn giao thông" : "");
    const catalogUnit =
      currentSection !== TNGT_SECTION && currentSection !== HANH_LANG_SECTION
        ? resolveFormCatalogUnit(savedType, unitByType, form.unit)
        : form.unit;
    const item = applyBaoDuongDiaryNotes(
      withHanhLangKmTo(
        withMatDuongKmTo(
          migrateEntry({
            ...form,
            type: savedType,
            // Đồng bộ loại hiển thị — tránh giữ sourceIncidentType cũ khi sửa loại.
            sourceIncidentType: savedType,
            unit: catalogUnit || form.unit,
            quantity: calcFormQuantity(
              catalogUnit || form.unit,
              form.length,
              form.width,
              form.height,
              form.quantity
            ),
            section: currentSection,
            date,
            // Giữ một bản tương thích trong content để dữ liệu TNGT cũ/mới đều
            // hiện đủ diễn biến ở nhật ký và không bị mất khi qua các bước migrate.
            content:
              currentSection === TNGT_SECTION
                ? form.tngtCauseDetail || form.content || ""
                : form.content,
            exportTngt:
              currentSection === TNGT_SECTION ? form.exportTngt !== false : form.exportTngt,
            tngtOccurDate: currentSection === TNGT_SECTION ? date : form.tngtOccurDate || date,
            tngtOccurTime:
              currentSection === TNGT_SECTION
                ? form.tngtOccurTime || form.time || ""
                : form.tngtOccurTime,
            hlRecordDate: currentSection === HANH_LANG_SECTION ? date : form.hlRecordDate || date,
            ...(activeRt?.id
              ? { routeId: form.routeId || activeRt.id, roadName: form.roadName || activeRt.roadName }
              : {})
          })
        )
      )
    );
    let newData;
    if (editingIndex >= 0) {
      newData = [...data];
      newData[editingIndex] = item;
    } else {
      newData = [...data, item];
    }
    newData = sortEntriesOnDate(newData, date);
    setData(newData);
    persistNow(
      newData,
      dayMetaMap,
      reportMeta,
      editingIndex >= 0 ? "Đã cập nhật ghi chép." : "Đã thêm vào nhật ký."
    );
    resetForm();
    setCurrentSection("");
  }

  function addQuickToPreview(entries, errors = []) {
    if (readOnly) {
      window.alert("Chế độ chỉ xem — không lưu được vào nhật ký.");
      return;
    }
    if (!entries.length) {
      window.alert(errors.join("\n") || "Không có dòng hợp lệ.");
      return;
    }
    if (errors.length && !window.confirm(
      `Thêm ${entries.length} dòng vào nhật ký?\n\nCó ${errors.length} dòng lỗi sẽ bỏ qua.`
    )) {
      return;
    }
    const activeRt =
      findRoute(catalogRoad, form.routeId || activeRouteId) ||
      getRoadRoutes(catalogRoad)[0] ||
      null;
    const newData = [...data];
    const inserts = [];
    let updateCount = 0;
    const stampedEntries = [];
    entries.forEach((e) => {
      const editIdx = e._editIndex;
      const stamped = {
        ...e,
        routeId: form.routeId || activeRt?.id || e.routeId || "",
        roadName: form.roadName || activeRt?.roadName || e.roadName || ""
      };
      const built = applyBaoDuongDiaryNotes(
        withHanhLangKmTo(withMatDuongKmTo(migrateEntry(stamped)))
      );
      stampedEntries.push(built);
      if (Number.isInteger(editIdx) && editIdx >= 0 && editIdx < newData.length) {
        const orig = newData[editIdx];
        let patch;
        if (built.section === HANH_LANG_SECTION) {
          patch = {
            time: built.time,
            kmFrom: built.kmFrom,
            kmTo: built.kmTo,
            side: built.side,
            hlRecorder: built.hlRecorder,
            hlViolator: built.hlViolator,
            hlAddress: built.hlAddress,
            content: built.content,
            length: built.length,
            width: built.width,
            unit: built.unit,
            quantity: built.quantity,
            resolved: built.resolved,
            hlProcessNote: built.hlProcessNote,
            hlNote: built.hlNote,
            exportHanhLang: built.exportHanhLang,
            routeId: built.routeId || "",
            roadName: built.roadName || ""
          };
        } else {
          patch = {
            kmFrom: built.kmFrom,
            kmTo: built.kmTo,
            side: built.side,
            length: built.length,
            width: built.width,
            height: built.height,
            unit: built.unit,
            quantity: built.quantity,
            type: built.type,
            // Đồng bộ loại hiển thị với loại vừa sửa (entryIncidentType ưu tiên field này).
            sourceIncidentType: built.type || "",
            // Ghi chú ATGT/Cột mốc (và content chung) — phải ghi cả chuỗi rỗng để xóa được.
            content: built.content ?? "",
            resolvedStatus: built.resolvedStatus,
            plannedRepairDate: built.plannedRepairDate,
            resolved: built.resolved,
            leaderNote: built.leaderNote,
            routeId: built.routeId || "",
            roadName: built.roadName || ""
          };
          if (built.exportMatDuong !== undefined) patch.exportMatDuong = built.exportMatDuong;
          if (built.exportTrafficDuty !== undefined) {
            patch.exportTrafficDuty = built.exportTrafficDuty;
          }
          if (built.exportPhieuCau !== undefined) patch.exportPhieuCau = built.exportPhieuCau;
          if (built.bridgeId !== undefined) patch.bridgeId = built.bridgeId;
          if (built.bridgeName !== undefined) patch.bridgeName = built.bridgeName;
          if (built.exportCongStatus !== undefined) {
            patch.exportCongStatus = built.exportCongStatus;
          }
          if (built.congId !== undefined) patch.congId = built.congId;
          if (built.assetType !== undefined) patch.assetType = built.assetType;
          if (built.assetId !== undefined) patch.assetId = built.assetId;
        }
        newData[editIdx] = { ...orig, ...patch };
        updateCount += 1;
      } else {
        inserts.push(built);
      }
    });
    const finalData = sortEntriesOnDate([...newData, ...inserts], date);
    setData(finalData);
    const parts = [];
    if (updateCount) parts.push(`cập nhật ${updateCount} dòng`);
    if (inserts.length) parts.push(`thêm ${inserts.length} dòng`);
    persistNow(
      finalData,
      dayMetaMap,
      reportMeta,
      `Đã ${parts.join(", ") || "lưu"} trong nhật ký.`
    );
    const congExports = stampedEntries.filter(
      (e) =>
        e.section === THOAT_NUOC_SECTION &&
        (e.exportCongStatus === "hu_hong" ||
          e.exportCongStatus === "sua_chua" ||
          e.exportCongStatus === "bo_sung")
    );
    if (congExports.length && (ownerUid || profile?.uid)) {
      const uid = ownerUid || profile?.uid || "";
      const routeList = routes?.length ? routes : getRoadRoutes(catalogRoad || activeRoad);
      const scope = writeCongScope(
        uid,
        activeRoadId,
        activeRt?.id || activeRouteId,
        routeList
      );
      applyCongExportStatusesToRegistry(scope, congExports);
      // Đồng bộ luôn scope đọc (khi resolve khác write) để DS cống thấy ngay.
      const readScope = resolveCongScope(
        uid,
        activeRoadId,
        activeRt?.id || activeRouteId,
        routeList
      );
      if (readScope !== scope) {
        applyCongExportStatusesToRegistry(readScope, congExports);
      }
    }
    setQuickRows(makeEmptyQuickRows(8));
    resetForm();
    setCurrentSection("");
  }

  function deleteItems(indices) {
    if (readOnly) return;
    const indexSet = new Set(
      (indices || [])
        .map((i) => Number(i))
        .filter((i) => Number.isInteger(i) && i >= 0)
    );
    if (!indexSet.size) return;
    const remaining = data.filter((_, i) => !indexSet.has(i));
    setData(remaining);
    setQuickRows((prev) =>
      prev.map((row) => {
        const editIdx = row?._editIndex;
        if (!Number.isInteger(editIdx)) return row;
        if (indexSet.has(editIdx)) {
          const { _editIndex, ...rest } = row;
          return rest;
        }
        let nextIdx = editIdx;
        for (const i of [...indexSet].sort((a, b) => a - b)) {
          if (i < editIdx) nextIdx -= 1;
        }
        return nextIdx === editIdx ? row : { ...row, _editIndex: nextIdx };
      })
    );
    persistNow(remaining, dayMetaMap, reportMeta, "Đã xoá ghi chép.");
    if (editingIndex >= 0) {
      if (indexSet.has(editingIndex)) {
        resetForm();
      } else {
        let newIdx = editingIndex;
        for (const i of [...indexSet].sort((a, b) => a - b)) {
          if (i < editingIndex) newIdx -= 1;
        }
        setEditingIndex(newIdx);
      }
    }
    setSelectedForDelete((prev) => {
      const next = new Set(prev);
      indexSet.forEach((i) => next.delete(i));
      return next;
    });
  }

  function deleteItem(index, event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (!window.confirm("Xác nhận xoá dòng ghi chép này?")) return;
    deleteItems([index]);
  }

  function deleteSelectedItems() {
    if (selectedForDelete.size === 0) return;
    if (!window.confirm(`Xoá ${selectedForDelete.size} dòng đã chọn?`)) return;
    deleteItems([...selectedForDelete]);
    setSelectedForDelete(new Set());
  }

  function deleteSectionItems(sectionTitle) {
    const indices = filteredData
      .filter((x) => x.section === sectionTitle)
      .map((x) => x._globalIndex);
    if (!indices.length) return;
    if (!window.confirm(`Xoá tất cả ${indices.length} dòng trong «${sectionTitle}»?`)) return;
    deleteItems(indices);
  }

  function toggleShowEntryDetails() {
    setShowEntryDetails((prev) => {
      const next = !prev;
      if (next) {
        const keys = SECTIONS.filter((s) =>
          data.some((x) => x.date === date && x.section === s.title)
        ).map((s) => s.key);
        setExpandedSections(new Set(keys));
      }
      return next;
    });
  }

  function toggleSectionExpanded(sectionKey, event) {
    event?.stopPropagation();
    setShowEntryDetails(true);
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionKey)) next.delete(sectionKey);
      else next.add(sectionKey);
      return next;
    });
  }

  function toggleBulkDeleteMode() {
    setBulkMergeMode(false);
    setSelectedForMerge(new Set());
    setBulkDeleteMode((prev) => {
      const next = !prev;
      if (next) {
        setShowEntryDetails(true);
        const keys = SECTIONS.filter((s) =>
          data.some((x) => x.date === date && x.section === s.title)
        ).map((s) => s.key);
        setExpandedSections(new Set(keys));
      } else {
        setSelectedForDelete(new Set());
      }
      return next;
    });
  }

  function toggleBulkMergeMode() {
    setBulkDeleteMode(false);
    setSelectedForDelete(new Set());
    setBulkMergeMode((prev) => {
      const next = !prev;
      if (next) {
        setShowEntryDetails(true);
        const keys = SECTIONS.filter((s) =>
          data.some((x) => x.date === date && x.section === s.title)
        ).map((s) => s.key);
        setExpandedSections(new Set(keys));
      } else {
        setSelectedForMerge(new Set());
      }
      return next;
    });
  }

  function toggleSelectAllDay() {
    const all = filteredData.map((x) => x._globalIndex);
    const selected = bulkMergeMode ? selectedForMerge : selectedForDelete;
    const setSelected = bulkMergeMode ? setSelectedForMerge : setSelectedForDelete;
    if (selected.size === all.length && all.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(all));
    }
  }

  function toggleSelectIndex(index) {
    const setSelected = bulkMergeMode ? setSelectedForMerge : setSelectedForDelete;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function selectSectionForDelete(sectionTitle) {
    const indices = filteredData
      .filter((x) => x.section === sectionTitle)
      .map((x) => x._globalIndex);
    const setSelected = bulkMergeMode ? setSelectedForMerge : setSelectedForDelete;
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = indices.every((i) => next.has(i));
      if (allSelected) indices.forEach((i) => next.delete(i));
      else indices.forEach((i) => next.add(i));
      return next;
    });
  }

  function mergeSelectedItems() {
    if (readOnly) return;
    const indices = [...selectedForMerge].sort((a, b) => a - b);
    const items = indices.map((i) => data[i]).filter(Boolean);
    const check = validateDiaryMergeSelection(items);
    if (!check.ok) {
      window.alert(check.msg);
      return;
    }
    if (
      !window.confirm(
        `Gộp ${items.length} dòng «${entryIncidentType(items[0]) || items[0].type}» thành 1 hàng trên sổ?`
      )
    ) {
      return;
    }
    let merged;
    try {
      merged = mergeDiaryEntries(items);
    } catch (err) {
      window.alert(err?.message || "Không gộp được.");
      return;
    }
    const keepIndex = indices[0];
    const drop = new Set(indices.slice(1));
    const nextData = data
      .map((row, i) => (i === keepIndex ? merged : row))
      .filter((_, i) => !drop.has(i));
    setData(nextData);
    persistNow(nextData, dayMetaMap, reportMeta, `Đã gộp ${items.length} dòng thành 1.`);
    setSelectedForMerge(new Set());
    if (editingIndex >= 0 && (editingIndex === keepIndex || drop.has(editingIndex))) {
      resetForm();
    }
  }

  function unmergeItem(index) {
    if (readOnly) return;
    const item = data[index];
    if (!isMergedDiaryEntry(item)) return;
    const sources = unmergeDiaryEntries(item);
    if (!sources?.length) {
      window.alert("Không tách được dòng đã gộp.");
      return;
    }
    if (
      !window.confirm(
        `Bỏ gộp «${entryIncidentType(item) || item.type}» thành ${sources.length} dòng riêng?`
      )
    ) {
      return;
    }
    const nextData = [
      ...data.slice(0, index),
      ...sources,
      ...data.slice(index + 1)
    ];
    setData(nextData);
    persistNow(nextData, dayMetaMap, reportMeta, `Đã bỏ gộp thành ${sources.length} dòng.`);
    setSelectedForMerge(new Set());
    if (editingIndex === index) resetForm();
  }

  function handleDateChange(nextDate) {
    const hasDraft =
      currentSection &&
      (form.type || form.kmFrom || form.kmTo ||
        (currentSection !== MAT_DUONG_SECTION && form.content) ||
        form.resolved);
    if (hasDraft && !window.confirm("Form đang nhập dở. Đổi ngày và bỏ qua?")) return;
    onDateChange(nextDate);
    setSaveMessage("");
    resetForm();
    setCurrentSection("");
  }

  function shiftDay(delta) {
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() + delta);
    handleDateChange(d.toISOString().split("T")[0]);
  }

  const filteredData = (() => {
    // Hiện đủ công việc trong ngày (mọi nhánh). Ô «Đường đang nhập» chỉ gán nhánh khi thêm mới.
    return data
      .map((item, globalIndex) => ({ ...item, _globalIndex: globalIndex }))
      .filter((x) => x.date === date);
  })();
  const currentSectionDef = SECTIONS.find((x) => x.title === currentSection);
  const currentTypes = useMemo(() => {
    if (!currentSection) return [];

    const extras = [];
    if (isMasterDataSection(currentSection)) {
      // Chỉ lấy loại từ danh mục công việc (data_noi_nghiep) + loại đã có trên sổ.
      filteredData
        .filter((x) => x.section === currentSection && x.type)
        .forEach((x) => extras.push(x.type));
      if (form.type) extras.push(form.type);
      return listFormTypesForSection(currentSection, extras);
    }

    extras.push(...(currentSectionDef?.types || []));
    filteredData
      .filter((x) => x.section === currentSection && x.type)
      .forEach((x) => extras.push(x.type));
    if (form.type) extras.push(form.type);
    return listFormTypesForSection(currentSection, extras);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentSection,
    matDuongTypes,
    thoatNuocMasterTypes,
    currentSectionDef,
    catalogTick,
    filteredData,
    form.type
  ]);
  const { congTypes, ranhTypes } = useMemo(() => {
    const pool = thoatNuocMasterTypes.length ? thoatNuocMasterTypes : currentTypes;
    const split = splitCongRanhTypes(pool);
    if (split.cong.length || split.ranh.length) {
      return {
        congTypes: split.cong.length ? split.cong : [...DEFAULT_CONG_WORK_TYPES],
        ranhTypes: split.ranh.length
          ? split.ranh
          : pool.filter((t) => !DEFAULT_CONG_WORK_TYPES.includes(t))
      };
    }
    return {
      congTypes: currentTypes.filter((t) => DEFAULT_CONG_WORK_TYPES.includes(t)),
      ranhTypes: currentTypes.filter((t) => !DEFAULT_CONG_WORK_TYPES.includes(t))
    };
  }, [thoatNuocMasterTypes, currentTypes]);
  const formHasDraft =
    currentSection &&
    (form.type ||
      form.kmFrom ||
      form.kmTo ||
      form.time ||
      (currentSection === TNGT_SECTION && form.tngtCauseDetail) ||
      (currentSection !== MAT_DUONG_SECTION && form.content) ||
      form.resolved ||
      form.leaderNote ||
      form.inspectorNote);
  const draftItem = formHasDraft
    ? migrateEntry({
        ...form,
        section: currentSection,
        date,
        resolved: form.resolved ?? form.solution ?? ""
      })
    : null;
  const reviewItems =
    draftItem && editingIndex >= 0
      ? filteredData.filter((x) => x._globalIndex !== editingIndex)
      : filteredData;

  return (
    <div className="nhaplieu-workspace">
      <aside
        className="nhaplieu-sidebar"
        style={sidebarStyle}
      >
        <div className="sidebar-sticky-head">
          <h2 className="sidebar-title">Nhập liệu</h2>
          {readOnly && (
            <p className="section-guide danhmuc-bd-readonly-hint">
              Chế độ chỉ xem. Chỉ tài khoản <strong>USER</strong> được nhập và sửa dữ liệu sổ.
            </p>
          )}
          <div className="sidebar-date-toolbar">
            <div className="sidebar-date-nav">
              <button
                type="button"
                onClick={() => shiftDay(-1)}
                className="btn-primary btn-primary--compact sidebar-date-nav-btn"
                title="Ngày trước"
              >
                ◀
              </button>
              <button
                type="button"
                onClick={() => shiftDay(1)}
                className="btn-primary btn-primary--compact sidebar-date-nav-btn"
                title="Ngày sau"
              >
                ▶
              </button>
            </div>
            <ViDateInput
              value={date}
              onChange={handleDateChange}
              className="sidebar-input sidebar-input--date"
              aria-label="Ngày nhập liệu"
              missingDates={missingDates}
            />
          </div>
          <EntryRoutePicker className="entry-route-picker--sidebar" />
          {isAdmin && missingDates.length > 0 ? (
            <p className="sidebar-missing-summary">
              {missingDates.length} ngày chưa nhập (đầu năm → nay) — mở lịch để xem ô đỏ
            </p>
          ) : null}
          {saveMessage && <p className="save-ok">{saveMessage}</p>}
        </div>

        <div className="sidebar-scroll">
        <div className="sidebar-block sidebar-block--flat">
          <div className="sidebar-block-head">
            <div className="sidebar-block-label">Hạng mục</div>
            <div className="section-toolbar">
              <button
                type="button"
                className={`section-toolbar-btn${showEntryDetails ? " active" : ""}`}
                onClick={toggleShowEntryDetails}
              >
                {showEntryDetails ? "Ẩn chi tiết" : "Hiện chi tiết"}
              </button>
              <button
                type="button"
                className={`section-toolbar-btn${bulkMergeMode ? " active" : ""}`}
                onClick={toggleBulkMergeMode}
                hidden={readOnly}
              >
                Gộp công việc
              </button>
              <button
                type="button"
                className={`section-toolbar-btn section-toolbar-btn--danger${bulkDeleteMode ? " active" : ""}`}
                onClick={toggleBulkDeleteMode}
                hidden={readOnly}
              >
                Xoá nhanh
              </button>
            </div>
          </div>
          {bulkDeleteMode && (
            <div className="bulk-delete-bar">
              <button type="button" className="bulk-delete-btn" onClick={toggleSelectAllDay}>
                {selectedForDelete.size === filteredData.length && filteredData.length > 0
                  ? "Bỏ chọn"
                  : `Chọn tất cả (${filteredData.length})`}
              </button>
              <button
                type="button"
                className="bulk-delete-btn bulk-delete-btn--danger"
                disabled={selectedForDelete.size === 0}
                onClick={deleteSelectedItems}
              >
                Xoá {selectedForDelete.size} dòng
              </button>
            </div>
          )}
          {bulkMergeMode && (
            <div className="bulk-delete-bar">
              <button type="button" className="bulk-delete-btn" onClick={toggleSelectAllDay}>
                {selectedForMerge.size === filteredData.length && filteredData.length > 0
                  ? "Bỏ chọn"
                  : `Chọn tất cả (${filteredData.length})`}
              </button>
              <button
                type="button"
                className="bulk-delete-btn bulk-delete-btn--merge"
                disabled={selectedForMerge.size < 2}
                onClick={mergeSelectedItems}
              >
                Gộp {selectedForMerge.size} dòng
              </button>
            </div>
          )}
          <ul className="section-list">
            {VISIBLE_SECTIONS.map((section) => {
              const count = filteredData.filter((x) => x.section === section.title).length;
              const active = currentSection === section.title;
              const sectionItems = filteredData
                .filter((x) => x.section === section.title)
                .sort(compareEntriesByTypeAndKm);
              const expanded = showEntryDetails && expandedSections.has(section.key);
              const selectMode = bulkDeleteMode || bulkMergeMode;
              const selectedSet = bulkMergeMode ? selectedForMerge : selectedForDelete;
              const sectionSelectedCount = sectionItems.filter((item) =>
                selectedSet.has(item._globalIndex)
              ).length;
              return (
                <li key={section.key} className={active ? "active" : ""}>
                  <div className="section-header-row">
                    {count > 0 && (
                      <button
                        type="button"
                        className="section-chevron"
                        title={expanded ? "Thu gọn" : "Mở chi tiết"}
                        onClick={(e) => toggleSectionExpanded(section.key, e)}
                      >
                        {expanded ? "▾" : "▸"}
                      </button>
                    )}
                    <button
                      type="button"
                      className="section-btn"
                      onClick={() => openForm(section.title)}
                    >
                      <span>
                        <span className="section-part">{formatSectionPartPrefix(section)}</span>
                        {section.displayTitle || section.title}
                      </span>
                      {count > 0 && <span className="section-count">{count}</span>}
                    </button>
                  </div>
                  {expanded && count > 0 && (
                    <div className="section-entries-wrap">
                      {selectMode && (
                        <div className="section-entries-actions">
                          <button
                            type="button"
                            className="section-entries-action"
                            onClick={() => selectSectionForDelete(section.title)}
                          >
                            {sectionSelectedCount === count
                              ? "Bỏ chọn hạng mục"
                              : `Chọn ${count} dòng`}
                          </button>
                          {bulkDeleteMode ? (
                            <button
                              type="button"
                              className="section-entries-action section-entries-action--danger"
                              onClick={() => deleteSectionItems(section.title)}
                            >
                              Xoá hết
                            </button>
                          ) : null}
                        </div>
                      )}
                      <ul className="section-entries">
                        {sectionItems.map((item) => {
                          const label = entryIncidentType(item) || item.type || "—";
                          const kmHint = item.kmFrom
                            ? `Km${item.kmFrom}`
                            : "";
                          const merged = isMergedDiaryEntry(item);
                          const routeHint =
                            String(item.roadName || "").trim() ||
                            routeNameLabel(findRoute(catalogRoad, item.routeId)) ||
                            "";
                          return (
                            <li key={item._globalIndex}>
                              {selectMode && (
                                <input
                                  type="checkbox"
                                  className="section-entry-check"
                                  checked={selectedSet.has(item._globalIndex)}
                                  onChange={() => toggleSelectIndex(item._globalIndex)}
                                />
                              )}
                              <button
                                type="button"
                                className="section-entry-btn"
                                onClick={() =>
                                  QUICK_GRID_SECTIONS.has(section.title)
                                    ? editEntryInGrid(item._globalIndex, section.title)
                                    : openForm(section.title, item._globalIndex)
                                }
                              >
                                <span className="section-entry-label">
                                  {label}
                                  {merged ? (
                                    <span className="section-entry-merged"> · đã gộp</span>
                                  ) : null}
                                </span>
                                {kmHint && (
                                  <span className="section-entry-km">{kmHint}</span>
                                )}
                                {routeHint ? (
                                  <span className="section-entry-km">{routeHint}</span>
                                ) : null}
                              </button>
                              {!selectMode && !readOnly && merged && (
                                <button
                                  type="button"
                                  className="entry-unmerge"
                                  onClick={() => unmergeItem(item._globalIndex)}
                                  title="Bỏ gộp"
                                >
                                  Bỏ gộp
                                </button>
                              )}
                              {!selectMode && !readOnly && (
                                <button
                                  type="button"
                                  className="entry-delete"
                                  onClick={(e) => deleteItem(item._globalIndex, e)}
                                  title="Xoá"
                                >
                                  ×
                                </button>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
        </div>
      </aside>

      {!readOnly && currentSection && currentSectionDef && (
        <DraggableFormPanel
          key={currentSection}
          wide
          tngt={
            currentSection === TNGT_SECTION ||
            currentSection === MAT_DUONG_SECTION ||
            ((currentSection === NEN_DUONG_SECTION ||
              currentSection === LE_DUONG_SECTION ||
              currentSection === HANH_LANG_SECTION ||
              BAO_DUONG_QUICK_SECTIONS.has(currentSection)) &&
              editingIndex < 0)
          }
          title={`${editingIndex >= 0 ? "Sửa" : "Thêm"} — ${formatSectionPartPrefix(currentSectionDef)} ${currentSection}`}
          center
          onClose={() => {
            resetForm();
            setCurrentSection("");
          }}
        >
          <div className="entry-form">
            <EntryRoutePicker
              className="entry-route-picker--form-top"
              value={
                form.routeId ||
                quickRows.find((row) => Number.isInteger(row._editIndex))?.routeId ||
                ""
              }
              onChange={(route) => {
                selectRoute(route.id);
                setForm((prev) => ({
                  ...prev,
                  routeId: route.id || "",
                  roadName: route.roadName || route.label || ""
                }));
                setQuickRows((prev) =>
                  prev.map((row) =>
                    Number.isInteger(row._editIndex)
                      ? {
                          ...row,
                          routeId: route.id || "",
                          roadName: route.roadName || route.label || ""
                        }
                      : row
                  )
                );
              }}
            />
            {currentSection !== TNGT_SECTION && currentSection !== HANH_LANG_SECTION && currentSection !== MAT_DUONG_SECTION && (
              <p className="section-guide">{currentSectionDef.guide}</p>
            )}

            {currentSection === MAT_DUONG_SECTION && editingIndex < 0 ? (
              <MatDuongQuickEntry
                date={date}
                form={form}
                rows={quickRows}
                onRowsChange={setQuickRows}
                onImport={addQuickToPreview}
                types={currentTypes}
                unitByType={unitByType}
              />
            ) : currentSection === MAT_DUONG_SECTION ? (
              <>
                <MatDuongEntryForm
                  form={form}
                  onChange={handleChange}
                  date={date}
                  types={currentTypes}
                />
                <div className="sidebar-form-actions">
                  <button type="button" className="btn-primary" onClick={addToPreview}>
                    {editingIndex >= 0 ? "Cập nhật" : "Thêm vào nhật ký"}
                  </button>
                  {editingIndex >= 0 && (
                    <button
                      type="button"
                      className="btn-danger"
                      onClick={() => deleteItem(editingIndex)}
                    >
                      Xoá
                    </button>
                  )}
                </div>
                <div className="entry-form-section">
                  <label className="form-check-row">
                    <input
                      type="checkbox"
                      name="exportTrafficDuty"
                      checked={Boolean(form.exportTrafficDuty)}
                      onChange={handleChange}
                    />
                    <span>Xuất sang sổ trực ĐBGT (thiệt hại bão lũ)</span>
                  </label>
                </div>
              </>
            ) : currentSection === TNGT_SECTION ? (
              <>
                <TngtEntryForm
                  form={form}
                  onChange={handleChange}
                  date={date}
                />
                <div className="sidebar-form-actions">
                  <button type="button" className="btn-primary" onClick={addToPreview}>
                    {editingIndex >= 0 ? "Cập nhật" : "Thêm vào nhật ký"}
                  </button>
                  {editingIndex >= 0 && (
                    <button
                      type="button"
                      className="btn-danger"
                      onClick={() => deleteItem(editingIndex)}
                    >
                      Xoá
                    </button>
                  )}
                </div>
              </>
            ) : currentSection === HANH_LANG_SECTION && editingIndex < 0 ? (
              <HanhLangQuickEntry
                date={date}
                rows={quickRows}
                onRowsChange={setQuickRows}
                onImport={addQuickToPreview}
              />
            ) : currentSection === HANH_LANG_SECTION ? (
              <>
                <HanhLangEntryForm
                  form={form}
                  onChange={handleChange}
                  date={date}
                />
                <div className="sidebar-form-actions">
                  <button type="button" className="btn-primary" onClick={addToPreview}>
                    {editingIndex >= 0 ? "Cập nhật" : "Thêm vào nhật ký"}
                  </button>
                  {editingIndex >= 0 && (
                    <button
                      type="button"
                      className="btn-danger"
                      onClick={() => deleteItem(editingIndex)}
                    >
                      Xoá
                    </button>
                  )}
                </div>
              </>
            ) : currentSection === "Lề đường" && editingIndex < 0 ? (
              <MatDuongQuickEntry
                date={date}
                form={form}
                rows={quickRows}
                onRowsChange={setQuickRows}
                onImport={addQuickToPreview}
                types={currentTypes}
                unitByType={unitByType}
                section="Lề đường"
                exportField="exportLeDuong"
              />
            ) : currentSection === THOAT_NUOC_SECTION && editingIndex < 0 ? (
              <>
                <div className="cong-subtab">
                  <button
                    type="button"
                    className={congSubTab === "cong" ? "nav-active" : ""}
                    onClick={() => {
                      if (congSubTab !== "cong") {
                        setCongSubTab("cong");
                        setQuickRows(makeEmptyQuickRows(8));
                      }
                    }}
                  >
                    Cống
                  </button>
                  <button
                    type="button"
                    className={congSubTab === "ranh" ? "nav-active" : ""}
                    onClick={() => {
                      if (congSubTab !== "ranh") {
                        setCongSubTab("ranh");
                        setQuickRows(makeEmptyQuickRows(8));
                      }
                    }}
                  >
                    Rãnh
                  </button>
                </div>
                {congSubTab === "cong" ? (
                  <CongQuickEntry
                    date={date}
                    section={currentSection}
                    rows={quickRows}
                    onRowsChange={setQuickRows}
                    onImport={addQuickToPreview}
                    types={congTypes}
                    unitByType={unitByType}
                  />
                ) : (
                  <BaoDuongQuickEntry
                    date={date}
                    section={currentSection}
                    rows={quickRows}
                    onRowsChange={setQuickRows}
                    onImport={addQuickToPreview}
                    types={ranhTypes}
                  />
                )}
              </>
            ) : BAO_DUONG_QUICK_SECTIONS.has(currentSection) && editingIndex < 0 ? (
              <BaoDuongQuickEntry
                date={date}
                section={currentSection}
                rows={quickRows}
                onRowsChange={setQuickRows}
                onImport={addQuickToPreview}
                types={currentTypes}
                bridges={currentSection === CAU_SECTION ? cauBridges : []}
              />
            ) : (
              <>
            <div className="entry-form-section">
              <div className="entry-form-field entry-form-field--full">
                <label className="entry-form-label" htmlFor="entry-type">
                  Nội dung ghi chép
                </label>
                <WorkTypeCombo
                  value={form.type}
                  onChange={(val) =>
                    handleChange({ target: { name: "type", value: val } })
                  }
                  options={currentTypes}
                  placeholder="Chọn loại sự cố / nội dung"
                  controlClassName="sidebar-input"
                  ariaLabel="Nội dung ghi chép"
                />
              </div>
            </div>

            <div className="entry-form-section">
              <div className="entry-form-section-title">Vị trí · lý trình</div>
              <div className="entry-form-grid entry-form-grid--3">
                <div className="entry-form-field">
                  <label className="entry-form-label" htmlFor="entry-kmFrom">
                    Lý trình đầu
                  </label>
                  <input
                    id="entry-kmFrom"
                    name="kmFrom"
                    placeholder="VD: 372+400"
                    value={form.kmFrom}
                    onChange={handleChange}
                    className="sidebar-input"
                  />
                </div>
                <div className="entry-form-field">
                  <label className="entry-form-label" htmlFor="entry-kmTo">Lý trình cuối</label>
                  <input
                    id="entry-kmTo"
                    name="kmTo"
                    placeholder="VD: 10+205"
                    value={form.kmTo}
                    onChange={handleChange}
                    className="sidebar-input"
                  />
                </div>
                <div className="entry-form-field">
                  <label className="entry-form-label" htmlFor="entry-side">Phía</label>
                  <select id="entry-side" name="side" value={form.side ?? ""} onChange={handleChange} className="sidebar-input">
                    <option value=""></option>
                    <option value="P">P — Phải</option>
                    <option value="T">T — Trái</option>
                    <option value="M">M — Giữa</option>
                    <option value="C">C — Cả mặt</option>
                  </select>
                </div>
                {currentSection !== MAT_DUONG_SECTION && (
                  <div className="entry-form-field entry-form-field--full">
                    <label className="entry-form-label" htmlFor="entry-locationNote">Ghi chú vị trí</label>
                    <input
                      id="entry-locationNote"
                      name="locationNote"
                      placeholder="Nếu có"
                      value={form.locationNote}
                      onChange={handleChange}
                      className="sidebar-input"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="entry-form-section">
              <div className="entry-form-section-title">Khối lượng · kích thước</div>
              <div className="entry-form-grid entry-form-grid--5">
                <div className="entry-form-field">
                  <label className="entry-form-label" htmlFor="entry-length">Dài</label>
                  <input id="entry-length" name="length" value={form.length} onChange={handleChange} className="sidebar-input" />
                </div>
                <div className="entry-form-field">
                  <label className="entry-form-label" htmlFor="entry-width">Rộng</label>
                  <input id="entry-width" name="width" value={form.width} onChange={handleChange} className="sidebar-input" />
                </div>
                <div className="entry-form-field">
                  <label className="entry-form-label" htmlFor="entry-height">Cao</label>
                  <input id="entry-height" name="height" value={form.height} onChange={handleChange} className="sidebar-input" />
                </div>
                <div className="entry-form-field">
                  <label className="entry-form-label" htmlFor="entry-unit">
                    Đơn vị (danh mục công việc)
                  </label>
                  <input
                    id="entry-unit"
                    value={formatUnitLabel(
                      normalizeUnitValue(
                        getUnitForType(form.type) || unitByType[form.type] || form.unit
                      )
                    )}
                    readOnly
                    className="sidebar-input sidebar-input-readonly"
                    title="Đơn vị lấy theo danh mục công việc — không sửa tay"
                  />
                </div>
                <div className="entry-form-field">
                  <label className="entry-form-label" htmlFor="entry-quantity">Khối lượng</label>
                  <input
                    id="entry-quantity"
                    value={form.quantity}
                    readOnly
                    className="sidebar-input sidebar-input-readonly"
                  />
                </div>
              </div>
            </div>

            {currentSection !== MAT_DUONG_SECTION && (
              <div className="entry-form-section">
                <div className="entry-form-section-title">Hiện trạng</div>
                <div className="entry-form-field">
                  <label className="entry-form-label" htmlFor="entry-content">Mô tả hiện trạng, diễn biến</label>
                  <textarea
                    id="entry-content"
                    name="content"
                    value={form.content}
                    onChange={handleChange}
                    className="sidebar-textarea"
                    rows={3}
                  />
                </div>
              </div>
            )}

            {currentSection !== MAT_DUONG_SECTION &&
              isBaoDuongSection(currentSection) && (
                <div className="entry-form-section">
                  <div className="entry-form-section-title">
                    Bảo dưỡng thường xuyên (sổ BDTX)
                  </div>
                  <p className="section-guide section-guide--compact">
                    Cùng ngày sổ tuần đường: cột «Đã giải quyết» ghi{" "}
                    <em>Đã xử lý: tên BDTX, khối lượng</em>. Khác ngày: gộp các dòng cùng
                    loại công việc, ghi yêu cầu tổ đội ở cột nhận xét (hàng đầu nhóm).
                  </p>
                  <div className="entry-form-grid">
                    <div className="entry-form-field">
                      <label
                        className="entry-form-label"
                        htmlFor="entry-plannedRepairDate"
                      >
                        Ngày dự kiến sửa chữa (đưa vào sổ BDTX)
                      </label>
                      <ViDateInput
                        id="entry-plannedRepairDate"
                        value={form.plannedRepairDate}
                        min={date}
                        max={maxPlannedRepairDate(date)}
                        onChange={(iso) =>
                          handleChange({
                            target: {
                              name: "plannedRepairDate",
                              value: iso,
                              type: "text"
                            }
                          })
                        }
                        className="sidebar-input sidebar-input--date"
                        aria-label="Ngày dự kiến sửa chữa"
                      />
                    </div>
                    <div className="entry-form-field entry-form-field--full">
                      <label
                        className="entry-form-label"
                        htmlFor="entry-measureSummary"
                      >
                        Tóm tắt biện pháp thực hiện (cột 4 sổ BDTX)
                      </label>
                      <textarea
                        id="entry-measureSummary"
                        name="measureSummary"
                        value={form.measureSummary}
                        onChange={handleChange}
                        className="sidebar-textarea"
                        rows={2}
                        placeholder="Để trống sẽ tự điền theo danh mục loại công việc"
                      />
                    </div>
                  </div>
                </div>
              )}

            {isBaoLuTickSection(currentSection) && (
              <div className="entry-form-section">
                <label className="form-check-row">
                  <input
                    type="checkbox"
                    name="exportTrafficDuty"
                    checked={Boolean(form.exportTrafficDuty)}
                    onChange={handleChange}
                  />
                  <span>Xuất sang sổ trực ĐBGT (thiệt hại bão lũ)</span>
                </label>
                {form.exportTrafficDuty && (
                  <>
                    <p className="section-guide">
                      Số liệu sự cố (lý trình, kích thước, KL) lấy từ app hiện trường.
                      Thời tiết ghi ở <strong>dòng đầu ngày</strong> trên sổ nhật ký.
                      <strong> Người trực</strong> và <strong>thời gian thông xe</strong> để trống —
                      tự nhập trên sổ trực bão lũ.
                    </p>
                    <div className="entry-form-grid">
                      <div className="entry-form-field entry-form-field--full">
                        <label className="entry-form-label" htmlFor="entry-leaderNote-nen">
                          Ý kiến chỉ đạo / nhận xét Hạt trưởng (cột 5 sổ chi tiết)
                        </label>
                        <textarea
                          id="entry-leaderNote-nen"
                          name="leaderNote"
                          placeholder="VD: Bố trí nhân lực, máy móc hót dọn, đảm bảo giao thông trên tuyến"
                          value={form.leaderNote}
                          onChange={handleChange}
                          className="sidebar-textarea"
                          rows={2}
                        />
                      </div>
                      <div className="entry-form-field">
                        <label className="entry-form-label" htmlFor="entry-leaderSign-nen">
                          Người nhận báo cáo (ký tên, chung ngày)
                        </label>
                        <input
                          id="entry-leaderSign-nen"
                          placeholder="VD: Hạt trưởng Dương Ngọc Đạt"
                          value={dayMeta.leaderSign || ""}
                          onChange={(e) => updateDayMeta({ leaderSign: e.target.value })}
                          className="sidebar-input"
                        />
                      </div>
                      <div className="entry-form-field">
                        <label className="entry-form-label" htmlFor="entry-trafficRestoredAt">
                          Thời gian thông xe
                        </label>
                        <input
                          id="entry-trafficRestoredAt"
                          name="trafficRestoredAt"
                          placeholder="VD: 14h30 ngày …"
                          value={form.trafficRestoredAt}
                          onChange={handleChange}
                          className="sidebar-input"
                        />
                      </div>
                      <div className="entry-form-field">
                        <label className="entry-form-label" htmlFor="entry-trafficCause">
                          Nguyên nhân (bỏ trống = tự suy từ loại thiệt hại)
                        </label>
                        <input
                          id="entry-trafficCause"
                          name="trafficCause"
                          placeholder="VD: Do sụt taluy dương"
                          value={form.trafficCause}
                          onChange={handleChange}
                          className="sidebar-input"
                        />
                      </div>
                      <div className="entry-form-field entry-form-field--full">
                        <label className="entry-form-label" htmlFor="entry-trafficNote">
                          Ghi chú
                        </label>
                        <input
                          id="entry-trafficNote"
                          name="trafficNote"
                          placeholder="VD: Tổng hợp nội dung thiệt hại báo công ty"
                          value={form.trafficNote}
                          onChange={handleChange}
                          className="sidebar-input"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {currentSection !== TNGT_SECTION && currentSection !== HANH_LANG_SECTION && currentSection !== MAT_DUONG_SECTION && (
            <div className="entry-form-section">
              <div className="entry-form-section-title">Nhật ký tuần đường — cột 1, 4, 5, 6</div>
              <p className="section-guide section-guide--compact">{DIARY_ENTRY_COLUMN_HINT}</p>
              <div className="entry-form-grid entry-form-grid--2">
                <div className="entry-form-field">
                  <label className="entry-form-label" htmlFor="entry-time">
                    Giờ phát hiện (cột 1)
                  </label>
                  <input
                    id="entry-time"
                    name="time"
                    placeholder="VD: 8h30"
                    value={form.time}
                    onChange={handleChange}
                    className="sidebar-input"
                  />
                </div>
                {currentSection !== MAT_DUONG_SECTION && currentSection !== TNGT_SECTION && (
                  <div className="entry-form-field">
                    <label className="entry-form-label" htmlFor="entry-resolved-general">
                      Đã xử lý tại chỗ (cột 4)
                    </label>
                    <input
                      id="entry-resolved-general"
                      name="resolved"
                      placeholder="VD: Đã dọn, đã báo công ty"
                      value={form.resolved}
                      onChange={handleChange}
                      className="sidebar-input"
                    />
                  </div>
                )}
                <div className="entry-form-field entry-form-field--full">
                  <label className="entry-form-label" htmlFor="entry-leaderNote">
                    Nhận xét Hạt (cột 5, nếu có)
                  </label>
                  <input
                    id="entry-leaderNote"
                    name="leaderNote"
                    placeholder="Theo từng dòng hoặc ghi chung cuối ngày ở sidebar"
                    value={form.leaderNote}
                    onChange={handleChange}
                    className="sidebar-input"
                  />
                </div>
                <div className="entry-form-field entry-form-field--full">
                  <label className="entry-form-label" htmlFor="entry-note">
                    Ghi chú (cột 6)
                  </label>
                  <input
                    id="entry-note"
                    name="inspectorNote"
                    placeholder="Nội dung cần lưu ý thêm"
                    value={form.inspectorNote}
                    onChange={handleChange}
                    className="sidebar-input"
                  />
                </div>
              </div>
            </div>
            )}

            <div className="sidebar-form-actions">
              <button type="button" className="btn-primary" onClick={addToPreview}>
                {editingIndex >= 0 ? "Cập nhật" : "Thêm vào nhật ký"}
              </button>
              {editingIndex >= 0 && (
                <button
                  type="button"
                  className="btn-danger"
                  onClick={() => deleteItem(editingIndex)}
                >
                  Xoá
                </button>
              )}
            </div>
              </>
            )}
          </div>
        </DraggableFormPanel>
      )}

      <SidebarResizer onMouseDown={onResizeStart} />

      <main className="nhaplieu-review-pane">
        <NhatKyReview
          date={date}
          items={reviewItems}
          draftItem={draftItem}
          dayMeta={dayMeta}
          alwaysShow
          signTuanDuong={signNames.tuanDuong}
          signHatTruong={signNames.hatTruong}
          signHatRole={resolveHatSignRoleLabel(signNames.hatRole)}
          onItemFieldChange={readOnly ? undefined : updateItemField}
          onDraftFieldChange={
            readOnly
              ? undefined
              : (field, value) => setForm((prev) => ({ ...prev, [field]: value }))
          }
          onDayMetaChange={readOnly ? undefined : updateDayMeta}
          onSectionSelect={(sectionTitle) => openForm(sectionTitle)}
          onEntrySelect={(globalIndex, sectionTitle) => {
            if (QUICK_GRID_SECTIONS.has(sectionTitle)) {
              editEntryInGrid(globalIndex, sectionTitle);
            } else {
              openForm(sectionTitle, globalIndex);
            }
          }}
          onGptcEntryOpen={onOpenGptcDetail}
        />
      </main>
    </div>
  );
}
