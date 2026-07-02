import { useState, useCallback, useEffect, useMemo } from "react";
import NhatKyReview from "../components/NhatKyReview";
import DraggableFormPanel from "../components/DraggableFormPanel";
import TngtEntryForm from "../components/TngtEntryForm";
import HanhLangEntryForm from "../components/HanhLangEntryForm";
import HanhLangQuickEntry from "../components/HanhLangQuickEntry";
import MatDuongEntryForm from "../components/MatDuongEntryForm";
import {
  SECTIONS,
  EMPTY_DAY_META,
  EMPTY_REPORT_META,
  loadStorage,
  saveStorage,
  getDayMeta,
  migrateEntry,
  sortEntriesOnDate,
  compareEntriesByTypeAndKm,
  entryIncidentType,
  DIARY_ENTRY_COLUMN_HINT,
  HANH_LANG_SECTION
} from "../utils/nhatKyFormat";
import {
  MAT_DUONG_SECTION,
  defaultExportMatDuong,
  withMatDuongKmTo
} from "../utils/matDuongFormat";
import { addMetersToKm, normalizeKmInput } from "../utils/nhatKyFormat";
import {
  defaultPlannedRepairDate,
  maxPlannedRepairDate,
  validatePlannedRepairDate,
  isBaoDuongSection,
  BAO_DUONG_MAX_DAYS
} from "../utils/baoDuongFormat";
import {
  listTypesForGroup,
  BAO_DUONG_QUALITY_EVENT
} from "../utils/baoDuongQualityStore";
import MatDuongQuickEntry from "../components/MatDuongQuickEntry";
import BaoDuongQuickEntry from "../components/BaoDuongQuickEntry";
import CongQuickEntry from "../components/CongQuickEntry";
import WorkTypeCombo from "../components/WorkTypeCombo";
import ViDateInput from "../components/ViDateInput";
import { makeEmptyQuickRows } from "../utils/bulkMatDuongImport";
import {
  NEN_DUONG_SECTION,
  defaultExportTrafficDuty
} from "../utils/trafficDutyFormat";
import {
  TNGT_SECTION,
  defaultExportTngt
} from "../utils/tngtFormat";
import {
  defaultExportHanhLang
} from "../utils/hanhLangFormat";
import { useAuth } from "../context/AuthContext";
import {
  fetchMatDuongIncidentTypes,
  getCatalogOwnerUid
} from "../services/masterDataService";
import { useRoadWorkspace } from "../context/RoadWorkspaceContext";
import { persistImportMapFromEntries } from "../services/nhatKyImportService";

const SIDEBAR_MIN = 300;
const SIDEBAR_MAX = 420;
const SIDEBAR_DEFAULT = 340;

const LE_DUONG_SECTION = "Lề đường";
const THOAT_NUOC_SECTION = "Cống, rãnh thoát nước";
/** Công việc thuộc về CỐNG (phần còn lại trong hạng mục coi là RÃNH/hệ thống thoát nước). */
const CONG_WORK_TYPES = new Set([
  "Tắc cống",
  "Đất đá bồi lấp cửa cống",
  "Rác cửa cống",
  "Hư đầu cống",
  "Hư thân cống",
  "Hư cửa cống",
  "Xói đầu cống",
  "Xói cuối cống"
]);
/** Các hạng mục bảo dưỡng dùng bảng nhập nhanh (đơn vị/khối lượng theo loại công việc). */
const BAO_DUONG_QUICK_SECTIONS = new Set([
  "Cống, rãnh thoát nước",
  "Ngầm, tràn (lũ, ngập)",
  "Cột mốc GP mặt bằng, lộ giới",
  "Công trình an toàn giao thông",
  "Công tác phát cây",
  "Công trình cầu"
]);
const QUICK_GRID_SECTIONS = new Set([
  MAT_DUONG_SECTION,
  NEN_DUONG_SECTION,
  LE_DUONG_SECTION,
  HANH_LANG_SECTION,
  ...BAO_DUONG_QUICK_SECTIONS
]);

/** Chuyển một ghi chép đã lưu → một dòng bảng nhập nhanh để sửa. */
function entryToQuickRow(item, globalIndex) {
  if (item.section === HANH_LANG_SECTION) {
    return {
      time: item.time || "",
      kmFrom: item.kmFrom || "",
      kmTo: item.kmTo || "",
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
      _editIndex: globalIndex
    };
  }
  return {
    kmFrom: item.kmFrom || "",
    side: item.side || "",
    length: item.length ?? "",
    width: item.width ?? "",
    height: item.height ?? "",
    unit: item.unit || "m2",
    quantity: item.quantity ?? "",
    type: item.type || "",
    resolvedStatus: item.resolvedStatus || "",
    exportMatDuong: item.exportMatDuong,
    exportTrafficDuty: item.exportTrafficDuty,
    plannedRepairDate: item.plannedRepairDate || "",
    _editIndex: globalIndex
  };
}

const EMPTY_FORM = {
  type: "",
  time: "",
  kmFrom: "",
  kmTo: "",
  side: "P",
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
  hlNote: ""
};

export default function NhapLieuPage({
  date,
  onDateChange,
  storageTick = 0,
  onStorageChange,
  matDuongQuickBoot = false,
  onMatDuongQuickBootConsumed
}) {
  const { profile } = useAuth();
  const { storageKey } = useRoadWorkspace();
  const initial = loadStorage(storageKey);
  const [currentSection, setCurrentSection] = useState("");
  const [editingIndex, setEditingIndex] = useState(-1);
  const [data, setData] = useState(() =>
    initial.entries.map(migrateEntry)
  );
  const [dayMetaMap, setDayMetaMap] = useState(initial.dayMeta || {});
  const [reportMeta, setReportMeta] = useState(() => ({
    ...EMPTY_REPORT_META,
    ...(initial.reportMeta || {})
  }));
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saveMessage, setSaveMessage] = useState("");
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT);
  const [matDuongMode, setMatDuongMode] = useState("single");
  const [quickRows, setQuickRows] = useState(() => makeEmptyQuickRows(8));
  const [congSubTab, setCongSubTab] = useState("cong");
  const [showEntryDetails, setShowEntryDetails] = useState(false);
  const [expandedSections, setExpandedSections] = useState(() => new Set());
  const [bulkDeleteMode, setBulkDeleteMode] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState(() => new Set());
  const [matDuongTypes, setMatDuongTypes] = useState(
    () => SECTIONS.find((s) => s.key === "mat_duong")?.types || []
  );
  const [catalogTick, setCatalogTick] = useState(0);

  useEffect(() => {
    const onChange = () => setCatalogTick((n) => n + 1);
    window.addEventListener(BAO_DUONG_QUALITY_EVENT, onChange);
    return () => window.removeEventListener(BAO_DUONG_QUALITY_EVENT, onChange);
  }, []);

  const dayMeta = getDayMeta(dayMetaMap, date);

  useEffect(() => {
    const ownerUid = getCatalogOwnerUid(profile);
    if (!ownerUid) return;
    let cancelled = false;
    fetchMatDuongIncidentTypes(ownerUid).then((types) => {
      if (!cancelled && types.length) setMatDuongTypes(types);
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
    if (!storageTick) return;
    const stored = loadStorage(storageKey);
    setData(stored.entries.map(migrateEntry));
    setDayMetaMap(stored.dayMeta || {});
    setReportMeta({ ...EMPTY_REPORT_META, ...(stored.reportMeta || {}) });
    setSaveMessage("Đã đồng bộ dữ liệu từ App hiện trường.");
  }, [storageTick, storageKey]);

  useEffect(() => {
    if (!currentSection || !showEntryDetails) return;
    const key = SECTIONS.find((s) => s.title === currentSection)?.key;
    if (!key) return;
    setExpandedSections((prev) => new Set([...prev, key]));
  }, [currentSection, showEntryDetails]);

  const onResizeStart = useCallback((e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = sidebarWidth;
    function onMove(ev) {
      setSidebarWidth(
        Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, startW + ev.clientX - startX))
      );
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [sidebarWidth]);

  function persistNow(
    nextData = data,
    nextDayMetaMap = dayMetaMap,
    nextReportMeta = reportMeta,
    message = "Đã lưu."
  ) {
    saveStorage(nextData, nextDayMetaMap, nextReportMeta, storageKey);
    if (message) {
      setSaveMessage(message);
      setTimeout(() => setSaveMessage(""), 2500);
    }
    onStorageChange?.();
    void persistImportMapFromEntries(profile?.uid, storageKey, nextData).catch(() => {
      setSaveMessage("Đã lưu local; chưa đồng bộ importMap lên Firestore.");
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
    setCurrentSection(sectionTitle);
    setEditingIndex(itemIndex);
    setMatDuongMode("single");
    setQuickRows(makeEmptyQuickRows(8));
    if (itemIndex >= 0) {
      const item = data[itemIndex];
      setForm({
        type: item.type,
        time: item.time || "",
        kmFrom: item.kmFrom,
        kmTo: item.kmTo,
        side: item.side,
        locationNote: item.locationNote || "",
        length: item.length,
        width: item.width,
        height: item.height,
        unit: item.unit,
        quantity: item.quantity,
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
        dutyPerson: item.dutyPerson || "",
        trafficCause: item.trafficCause || "",
        trafficRestoredAt: item.trafficRestoredAt || "",
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
        hlNote: item.hlNote || item.inspectorNote || ""
      });
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
        side: sectionTitle === TNGT_SECTION || sectionTitle === HANH_LANG_SECTION ? "P" : "P",
        tngtCauseNguoi: sectionTitle === TNGT_SECTION,
        plannedRepairDate: isBaoDuongSection(sectionTitle)
          ? defaultPlannedRepairDate(date)
          : ""
      });
    }
  }

  function resetForm() {
    setForm({ ...EMPTY_FORM });
    setEditingIndex(-1);
  }

  /** Bấm 1 sự cố ở mục dùng bảng nhập nhanh → nạp vào bảng để sửa (gộp nhiều dòng). */
  function editEntryInGrid(globalIndex, sectionTitle) {
    const item = data[globalIndex];
    if (!item) return;
    const switching = sectionTitle !== currentSection;
    setCurrentSection(sectionTitle);
    setEditingIndex(-1);
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
      if (name === "type" && currentSection === MAT_DUONG_SECTION) {
        newForm.exportMatDuong = defaultExportMatDuong(value);
        if (!defaultExportMatDuong(value)) {
          newForm.plannedRepairDate = "";
        } else if (!newForm.plannedRepairDate) {
          newForm.plannedRepairDate = defaultPlannedRepairDate(date);
        }
      }
      if (
        name === "type" &&
        currentSection !== MAT_DUONG_SECTION &&
        isBaoDuongSection(currentSection) &&
        value &&
        !newForm.plannedRepairDate
      ) {
        newForm.plannedRepairDate = defaultPlannedRepairDate(date);
      }
      if (name === "resolved" && currentSection === HANH_LANG_SECTION) {
        newForm.hlProcessNote = value;
      }
      if (
        currentSection === MAT_DUONG_SECTION &&
        (name === "kmFrom" || name === "length")
      ) {
        const kmFrom = normalizeKmInput(newForm.kmFrom);
        if (kmFrom) newForm.kmFrom = kmFrom;
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
    const next = [...data];
    next[globalIndex] = { ...next[globalIndex], [field]: value };
    setData(next);
    if (editingIndex === globalIndex) {
      setForm((prev) => ({ ...prev, [field]: value }));
    }
    persistNow(next, dayMetaMap, reportMeta);
  }

  function addToPreview() {
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
    const item = withMatDuongKmTo(
      migrateEntry({
        ...form,
        type: form.type || (currentSection === TNGT_SECTION ? "Tai nạn giao thông" : ""),
        section: currentSection,
        date,
        tngtOccurDate: currentSection === TNGT_SECTION ? date : form.tngtOccurDate || date,
        hlRecordDate: currentSection === HANH_LANG_SECTION ? date : form.hlRecordDate || date
      })
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
  }

  function addQuickToPreview(entries, errors = []) {
    if (!entries.length) {
      window.alert(errors.join("\n") || "Không có dòng hợp lệ.");
      return;
    }
    if (errors.length && !window.confirm(
      `Thêm ${entries.length} dòng vào nhật ký?\n\nCó ${errors.length} dòng lỗi sẽ bỏ qua.`
    )) {
      return;
    }
    const newData = [...data];
    const inserts = [];
    let updateCount = 0;
    entries.forEach((e) => {
      const editIdx = e._editIndex;
      const built = withMatDuongKmTo(migrateEntry(e));
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
            exportHanhLang: built.exportHanhLang
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
            resolvedStatus: built.resolvedStatus,
            plannedRepairDate: built.plannedRepairDate
          };
          if (built.exportMatDuong !== undefined) patch.exportMatDuong = built.exportMatDuong;
          if (built.exportTrafficDuty !== undefined) {
            patch.exportTrafficDuty = built.exportTrafficDuty;
          }
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
    setQuickRows(makeEmptyQuickRows(8));
  }

  function deleteItems(indices) {
    const indexSet = new Set(indices);
    const remaining = data.filter((_, i) => !indexSet.has(i));
    setData(remaining);
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
      indices.forEach((i) => next.delete(i));
      return next;
    });
  }

  function deleteItem(index) {
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

  function toggleSelectAllDay() {
    const all = filteredData.map((x) => x._globalIndex);
    if (selectedForDelete.size === all.length && all.length > 0) {
      setSelectedForDelete(new Set());
    } else {
      setSelectedForDelete(new Set(all));
    }
  }

  function toggleSelectIndex(index) {
    setSelectedForDelete((prev) => {
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
    setSelectedForDelete((prev) => {
      const next = new Set(prev);
      const allSelected = indices.every((i) => next.has(i));
      if (allSelected) indices.forEach((i) => next.delete(i));
      else indices.forEach((i) => next.add(i));
      return next;
    });
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

  const filteredData = data
    .map((item, globalIndex) => ({ ...item, _globalIndex: globalIndex }))
    .filter((x) => x.date === date);
  const currentSectionDef = SECTIONS.find((x) => x.title === currentSection);
  const currentTypes = useMemo(() => {
    const base =
      currentSection === MAT_DUONG_SECTION
        ? matDuongTypes
        : currentSectionDef?.types || [];
    // Bổ sung loại công việc đã khai báo trong danh mục BDTX thuộc đúng nhóm.
    const fromCatalog = listTypesForGroup(currentSection);
    const seen = new Set();
    const merged = [];
    [...base, ...fromCatalog].forEach((t) => {
      const key = String(t || "").trim();
      if (key && !seen.has(key)) {
        seen.add(key);
        merged.push(key);
      }
    });
    return merged;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSection, matDuongTypes, currentSectionDef, catalogTick]);
  const congTypes = useMemo(
    () => currentTypes.filter((t) => CONG_WORK_TYPES.has(t)),
    [currentTypes]
  );
  const ranhTypes = useMemo(
    () => currentTypes.filter((t) => !CONG_WORK_TYPES.has(t)),
    [currentTypes]
  );
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
        style={{ width: sidebarWidth, minWidth: sidebarWidth, maxWidth: sidebarWidth }}
      >
        <div className="sidebar-sticky-head">
          <h2 className="sidebar-title">Nhập liệu</h2>
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
            />
          </div>
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
                className={`section-toolbar-btn section-toolbar-btn--danger${bulkDeleteMode ? " active" : ""}`}
                onClick={toggleBulkDeleteMode}
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
          <ul className="section-list">
            {SECTIONS.map((section) => {
              const count = filteredData.filter((x) => x.section === section.title).length;
              const active = currentSection === section.title;
              const sectionItems = filteredData
                .filter((x) => x.section === section.title)
                .sort(compareEntriesByTypeAndKm);
              const expanded = showEntryDetails && expandedSections.has(section.key);
              const sectionSelectedCount = sectionItems.filter((item) =>
                selectedForDelete.has(item._globalIndex)
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
                        <span className="section-part">{section.part}.{section.num}</span>
                        {section.title}
                      </span>
                      {count > 0 && <span className="section-count">{count}</span>}
                    </button>
                  </div>
                  {expanded && count > 0 && (
                    <div className="section-entries-wrap">
                      {bulkDeleteMode && (
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
                          <button
                            type="button"
                            className="section-entries-action section-entries-action--danger"
                            onClick={() => deleteSectionItems(section.title)}
                          >
                            Xoá hết
                          </button>
                        </div>
                      )}
                      <ul className="section-entries">
                        {sectionItems.map((item) => {
                          const label = entryIncidentType(item) || item.type || "—";
                          const kmHint = item.kmFrom
                            ? `Km${item.kmFrom}`
                            : "";
                          return (
                            <li key={item._globalIndex}>
                              {bulkDeleteMode && (
                                <input
                                  type="checkbox"
                                  className="section-entry-check"
                                  checked={selectedForDelete.has(item._globalIndex)}
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
                                <span className="section-entry-label">{label}</span>
                                {kmHint && (
                                  <span className="section-entry-km">{kmHint}</span>
                                )}
                              </button>
                              {!bulkDeleteMode && (
                                <button
                                  type="button"
                                  className="entry-delete"
                                  onClick={() => deleteItem(item._globalIndex)}
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

      {currentSection && currentSectionDef && (
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
          title={`${editingIndex >= 0 ? "Sửa" : "Thêm"} — ${currentSectionDef.part}.${currentSectionDef.num} ${currentSection}`}
          defaultX={sidebarWidth + 24}
          defaultY={72}
          onClose={() => {
            resetForm();
            setCurrentSection("");
          }}
        >
          <div className="entry-form">
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
            ) : currentSection === NEN_DUONG_SECTION && editingIndex < 0 ? (
              <MatDuongQuickEntry
                date={date}
                form={form}
                rows={quickRows}
                onRowsChange={setQuickRows}
                onImport={addQuickToPreview}
                types={currentTypes}
                section={NEN_DUONG_SECTION}
                exportField="exportTrafficDuty"
                exportLabel="Xuất sổ trực ĐBGT"
              />
            ) : currentSection === "Lề đường" && editingIndex < 0 ? (
              <MatDuongQuickEntry
                date={date}
                form={form}
                rows={quickRows}
                onRowsChange={setQuickRows}
                onImport={addQuickToPreview}
                types={currentTypes}
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
                  <select id="entry-side" name="side" value={form.side} onChange={handleChange} className="sidebar-input">
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
                  <label className="entry-form-label" htmlFor="entry-unit">Đơn vị</label>
                  <select id="entry-unit" name="unit" value={form.unit} onChange={handleChange} className="sidebar-input">
                    <option value="m">m</option>
                    <option value="m2">m²</option>
                    <option value="m3">m³</option>
                    <option value="cái">cái</option>
                    <option value="vị trí">vị trí</option>
                    <option value="%">%</option>
                  </select>
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
                    Tồn tại phải được xử lý xong và ghi vào sổ BDTX trong vòng{" "}
                    {BAO_DUONG_MAX_DAYS} ngày kể từ ngày phát hiện. Biện pháp và nhận
                    xét kết quả sẽ tự điền theo danh mục nếu để trống.
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

            {currentSection === NEN_DUONG_SECTION && (
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
                      Số liệu sự cố (lý trình, kích thước, KL, người trực) lấy từ app hiện trường.
                      Thời tiết ghi ở <strong>dòng đầu ngày</strong> trên sổ nhật ký. Các mục dưới
                      ghi vào <strong>sổ chi tiết</strong> rồi tự sang sổ trực ĐBGT.
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

      <div className="nhaplieu-resizer" onMouseDown={onResizeStart} title="Kéo đổi độ rộng form" role="separator" aria-orientation="vertical" />

      <main className="nhaplieu-review-pane">
        <NhatKyReview
          date={date}
          items={reviewItems}
          draftItem={draftItem}
          dayMeta={dayMeta}
          alwaysShow
          onItemFieldChange={updateItemField}
          onDraftFieldChange={(field, value) =>
            setForm((prev) => ({ ...prev, [field]: value }))
          }
          onDayMetaChange={updateDayMeta}
        />
      </main>
    </div>
  );
}
