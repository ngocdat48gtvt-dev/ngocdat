import {
  formatDisplayDate,
  formatLyTrinh,
  migrateEntry,
  EMPTY_REPORT_META,
  normalizeKmInput,
  addMetersToKm,
  kmToMeters
} from "./nhatKyFormat";
import { expandEntriesForVolumeBooks } from "./mergeDiaryEntries";
import { formatBookKmTitleLine } from "./roadsCatalog";
import { formatBookDecimal } from "./bookNumberFormat";
import { inferEntryUnit, resolveEntryQuantity } from "./incidentUtils";
import { getMaintenanceNameForType } from "./baoDuongQualityStore";

export { EMPTY_REPORT_META };

export const MAT_DUONG_SECTION = "Mặt đường";

export const MAT_DUONG_SKIP_TYPES = new Set(["Nước đọng", "Mặt đường bẩn"]);

export function defaultExportMatDuong(type) {
  if (!type) return true;
  return !MAT_DUONG_SKIP_TYPES.has(type);
}

export function shouldExportMatDuong(entry) {
  if (entry.section !== MAT_DUONG_SECTION) return false;
  if (entry.exportMatDuong === true) return true;
  if (entry.exportMatDuong === false) return false;
  return defaultExportMatDuong(entry.type);
}

export function formatMonthLabel(yearMonth) {
  if (!yearMonth) return "";
  const [y, m] = yearMonth.split("-");
  return `THÁNG ${m}/${y}`;
}

export function formatMatDuongMonthTitle(yearMonth) {
  const [y, m] = String(yearMonth || "").split("-").map(Number);
  if (!y || !m) return yearMonth || "";
  return `THÁNG ${String(m).padStart(2, "0")}/${y}`;
}

export function formatMatDuongKmLine(reportMeta) {
  return formatBookKmTitleLine(reportMeta);
}

/** Hằng số bố cục trang A4 ngang — dùng chung preview + in. */
export const MAT_DUONG_SHEET_LAYOUT = {
  sheetWidthMm: 297,
  sheetHeightMm: 210,
  paddingVerticalMm: 22,
  /** Header công ty + tiêu đề + dòng Km — khớp CSS Times 13pt. */
  topBlockMm: 31,
  /** 3 hàng thead. */
  theadMm: 21,
  /** Chiều cao hàng dữ liệu 1 dòng (mm) — khớp preview/in + viền đáy. */
  dataRowMinMm: 8.0,
  emptyRowMm: 7.2,
  minEmptyRows: 4,
  /** Hàng tiêu đề nhánh đường (khi gộp nhiều tuyến). */
  routeHeaderMm: 7.5,
  /**
   * Ngắt trang cách lề dưới đúng 1 cm (10 mm).
   * Lề dưới margins.bottom đã trừ riêng — đây là khoảng trống thêm trong vùng in.
   */
  safetyMm: 10
};

export function matDuongBodyBudgetMm(margins) {
  const L = MAT_DUONG_SHEET_LAYOUT;
  const padV =
    margins != null
      ? (Number(margins.top) || 0) + (Number(margins.bottom) || 0)
      : L.paddingVerticalMm;
  return Math.max(
    40,
    L.sheetHeightMm - padV - L.topBlockMm - L.theadMm - L.safetyMm
  );
}

export function estimateMatDuongDataRowMm(entry) {
  const L = MAT_DUONG_SHEET_LAYOUT;
  if (entry?._matDuongMaintenanceSummary) {
    const lines = Math.max(
      1,
      Math.ceil(String(entry.maintenanceText || "").length / 55)
    );
    return Math.max(L.dataRowMinMm, 5.4 + (lines - 1) * 3.7) + 0.35;
  }
  const damage = formatDamageLevel(entry);
  const note = entry?.inspectorNote?.trim() || "";

  function countLines(text, charsPerLine) {
    if (!text) return 0;
    let n = 0;
    String(text)
      .split("\n")
      .forEach((line) => {
        n += Math.max(1, Math.ceil(line.length / charsPerLine));
      });
    return n;
  }

  const lines = Math.max(1, countLines(damage, 28), countLines(note, 22));
  return Math.max(L.dataRowMinMm, 5.4 + (lines - 1) * 3.7) + 0.35;
}

/**
 * Đệm hàng trống — chia đều phần còn lại sau dữ liệu (cùng công thức preview/in).
 * @param {object} [opts]
 * @param {number} [opts.routeHeaderCount] — số hàng tiêu đề nhánh đường trên tờ.
 */
export function computeMatDuongPadRows(entries, margins, opts = {}) {
  const L = MAT_DUONG_SHEET_LAYOUT;
  const budgetMm = matDuongBodyBudgetMm(margins);
  const headerMm = (Number(opts.routeHeaderCount) || 0) * (L.routeHeaderMm || 7.5);
  const dataMm =
    (entries || []).reduce((sum, e) => sum + estimateMatDuongDataRowMm(e), 0) +
    headerMm;
  const remainMm = Math.max(0, budgetMm - dataMm);

  if (remainMm < 2.5) {
    return { count: 0, rowHeightMm: L.emptyRowMm, remainMm: 0 };
  }

  // Giãn đều hàng trống để đáy bảng sát budget (= gần căn lề dưới).
  const count = Math.max(
    entries?.length ? 1 : L.minEmptyRows,
    Math.floor(remainMm / L.emptyRowMm)
  );
  return {
    count,
    rowHeightMm: remainMm / count,
    remainMm
  };
}

/** Chia dòng dữ liệu thành nhiều tờ A4 ngang — không cắt giữa hàng. */
export function packMatDuongPages(entries, margins) {
  const budgetMm = matDuongBodyBudgetMm(margins);
  const list = entries || [];
  if (!list.length) return [[]];

  const pages = [];
  let bucket = [];
  let used = 0;
  list.forEach((entry) => {
    const h = estimateMatDuongDataRowMm(entry);
    if (bucket.length > 0 && used + h > budgetMm) {
      pages.push(bucket);
      bucket = [];
      used = 0;
    }
    if (bucket.length === 0 && h > budgetMm) {
      pages.push([entry]);
      return;
    }
    bucket.push(entry);
    used += h;
  });
  if (bucket.length) pages.push(bucket);
  return pages.length ? pages : [[]];
}

export function entryInMonth(entry, yearMonth) {
  if (!entry.date || !yearMonth) return false;
  return entry.date.startsWith(yearMonth);
}

export function filterMatDuongEntries(entries, yearMonth) {
  // Gộp chỉ trên sổ tuần đường — dòng kiểm tra mặt đường luôn tách từng vị trí.
  const expanded = expandEntriesForVolumeBooks(entries || [])
    .map(migrateEntry)
    .map(withMatDuongKmTo);

  // Ngày kiểm tra = ngày tuần đường; lúc phát hiện luôn ghi “Chưa”.
  const inspectionRows = expanded
    .filter((e) => shouldExportMatDuong(e) && entryInMonth(e, yearMonth))
    .map((e) => ({
      ...e,
      resolvedStatus: "chua",
      _matDuongRowKind: "inspection"
    }));

  // Khi thực hiện BDTX: gom cùng ngày + cùng công việc + cùng tuyến,
  // cộng khối lượng và đếm số vị trí để tạo một dòng kết quả riêng.
  const groups = new Map();
  expanded.forEach((e) => {
    if (!shouldExportMatDuong(e)) return;
    const repairDate = String(e.plannedRepairDate || "").trim();
    if (!repairDate || !repairDate.startsWith(yearMonth)) return;

    const type = String(e.type || "").trim();
    const sourceType = String(e.sourceIncidentType || "").trim();
    const work =
      getMaintenanceNameForType(type) ||
      getMaintenanceNameForType(sourceType) ||
      type ||
      sourceType ||
      "Sửa chữa mặt đường";
    const unit = inferEntryUnit(e) || e.unit || "m2";
    const routeKey = String(e.routeId || e.roadName || "").trim();
    const key = [repairDate, work.toLocaleLowerCase("vi"), unit, routeKey].join("|");
    if (!groups.has(key)) {
      groups.set(key, {
        repairDate,
        work,
        unit,
        routeId: e.routeId || "",
        roadName: e.roadName || "",
        quantity: 0,
        count: 0,
        minKm: Infinity,
        maxKm: -Infinity,
        inspectorSign: "",
        inspectorNote: ""
      });
    }
    const group = groups.get(key);
    group.quantity += resolveEntryQuantity(e) || 0;
    group.count += 1;
    if (!group.inspectorSign && String(e.inspectorSign || "").trim()) {
      group.inspectorSign = String(e.inspectorSign).trim();
    }
    if (!group.inspectorNote && String(e.inspectorNote || "").trim()) {
      group.inspectorNote = String(e.inspectorNote).trim();
    }
    const fromM = e.kmFrom ? kmToMeters(e.kmFrom) : NaN;
    const resolvedTo = resolveEntryKmTo(e);
    const toM = resolvedTo ? kmToMeters(resolvedTo) : NaN;
    if (Number.isFinite(fromM)) {
      group.minKm = Math.min(group.minKm, fromM);
      group.maxKm = Math.max(group.maxKm, fromM);
    }
    if (Number.isFinite(toM)) {
      group.minKm = Math.min(group.minKm, toM);
      group.maxKm = Math.max(group.maxKm, toM);
    }
  });

  const maintenanceRows = [...groups.values()].map((group) => {
    const kmFrom = Number.isFinite(group.minKm) ? metersToKm(group.minKm) : "";
    const kmTo = Number.isFinite(group.maxKm) ? metersToKm(group.maxKm) : kmFrom;
    const fromLabel = formatKmCell(kmFrom);
    const toLabel = formatKmCell(kmTo);
    const range =
      fromLabel && toLabel && fromLabel !== toLabel
        ? `từ ${fromLabel} đến ${toLabel}`
        : `tại ${fromLabel || toLabel || "lý trình đã ghi"}`;
    const action =
      group.work.charAt(0).toLocaleLowerCase("vi") + group.work.slice(1);
    const quantity = formatBookDecimal(group.quantity) || "0";
    const unitLabel =
      group.unit === "m2" || group.unit === "m²"
        ? "m²"
        : group.unit === "m3" || group.unit === "m³"
          ? "m³"
          : group.unit;
    return {
      _matDuongMaintenanceSummary: true,
      _matDuongRowKind: "maintenance",
      section: MAT_DUONG_SECTION,
      date: group.repairDate,
      plannedRepairDate: group.repairDate,
      routeId: group.routeId,
      roadName: group.roadName,
      kmFrom,
      kmTo,
      resolvedStatus: "co",
      inspectorSign: group.inspectorSign,
      inspectorNote: group.inspectorNote,
      maintenanceText:
        `Đã ${action}, ${range}, khối lượng ${quantity} ${unitLabel}` +
        `/ ${group.count} vị trí.`
    };
  });

  return [...inspectionRows, ...maintenanceRows].sort((a, b) => {
    if (a.date !== b.date) return String(a.date).localeCompare(String(b.date));
    if (a._matDuongRowKind !== b._matDuongRowKind) {
      // Cùng ngày: kết quả đã sửa/đã xử lý xếp trước các điểm phát sinh mới.
      return a._matDuongRowKind === "maintenance" ? -1 : 1;
    }
    return String(a.kmFrom).localeCompare(String(b.kmFrom));
  });
}

function metersToKm(totalM) {
  if (!Number.isFinite(totalM) || totalM < 0) return "";
  const rounded = Math.round(totalM);
  const km = Math.floor(rounded / 1000);
  const m = rounded % 1000;
  return `${km}+${String(m).padStart(3, "0")}`;
}

export function formatKmCell(value) {
  if (!value && value !== 0) return "";
  const norm = normalizeKmInput(value);
  if (!norm) return "";
  return `Km${norm}`;
}

export function calcAreaM2(entry) {
  const l = Number(entry.length || 0);
  const w = Number(entry.width || 0);
  if (entry.unit === "m2" && entry.quantity) return Number(entry.quantity);
  if (l && w) return Math.round(l * w * 100) / 100;
  return "";
}

export function inferResolvedStatus(entry) {
  if (entry.resolvedStatus === "co" || entry.resolvedStatus === "chua") {
    return entry.resolvedStatus;
  }
  if (entry.resolved?.trim()) return "co";
  return "chua";
}

export function formatDamageLevel(entry) {
  if (entry.type?.trim()) return entry.type.trim();
  if (entry.damageLevel) return entry.damageLevel;
  return "";
}

function parseLengthMeters(value) {
  if (value === "" || value == null) return 0;
  const n = Number(String(value).trim().replace(/\s/g, "").replace(",", "."));
  return Number.isNaN(n) ? 0 : n;
}

/** Điểm cuối = điểm đầu + chiều dài (m). Không dùng kmTo lưu sai. */
export function resolveEntryKmTo(entry) {
  const kmFrom = normalizeKmInput(entry?.kmFrom);
  if (!kmFrom) return normalizeKmInput(entry?.kmTo);
  const lengthM = parseLengthMeters(entry?.length);
  if (lengthM > 0) return addMetersToKm(kmFrom, lengthM);
  return kmFrom;
}

export function withMatDuongKmTo(entry) {
  if (entry?.section !== MAT_DUONG_SECTION) return entry;
  const kmFrom = normalizeKmInput(entry.kmFrom);
  const normalized = { ...entry, kmFrom };
  return { ...normalized, kmTo: resolveEntryKmTo(normalized) };
}

export function entryToMatDuongRow(entry) {
  const status = inferResolvedStatus(entry);
  return {
    date: formatDisplayDate(entry.date),
    kmFrom: formatKmCell(entry.kmFrom),
    kmTo: formatKmCell(resolveEntryKmTo(entry)),
    side: entry.side || "",
    length: formatBookDecimal(entry.length) || "",
    width: formatBookDecimal(entry.width) || "",
    area: formatBookDecimal(calcAreaM2(entry)) || "",
    damageLevel: formatDamageLevel(entry),
    resolvedCo: status === "co" ? "X" : "",
    resolvedChua: status === "chua" ? "X" : "",
    inspectorSign: entry.inspectorSign || "",
    inspectorNote: entry.inspectorNote || ""
  };
}
