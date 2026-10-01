import { addMetersToKm, normalizeKmInput, kmToMeters, allowsEmptyDiarySide } from "./nhatKyFormat";
import { plannedRepairDateForType } from "./baoDuongFormat";
import {
  needMaintenanceForType,
  getUnitForType,
  normalizeUnitValue,
  getMaintenanceNameForType,
  isCountUnit
} from "./baoDuongQualityStore";
import { normalizeWorkType } from "./volumeStatsFormat";
import { displayToIso } from "./dateLocale";

const HEADER_FIRST_CELL =
  /^(stt|ngày|ngay|lý trình|ly trinh|đầu|cuối|dài|rộng|cao|khối lượng|khoi luong|phía|phia|vi trí|loại|loai)$/i;

export function normalizeSide(value, fallback = "P") {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  const upper = raw.toUpperCase().replace(/\s+/g, "");
  if (upper === "T+P" || upper === "P+T" || upper === "TP" || upper === "PT") {
    return "T+P";
  }
  if (upper === "P" || upper === "T" || upper === "G" || upper === "M" || upper === "C") {
    return upper === "C" ? "M" : upper;
  }
  const folded = normalizeWorkType(raw);
  if (/trai\s*\+?\s*phai|phai\s*\+?\s*trai|hai\s*ben/.test(folded)) return "T+P";
  if (folded === "phai" || /ben\s*phai/.test(folded) || /phải/i.test(raw)) return "P";
  if (folded === "trai" || /ben\s*trai/.test(folded) || /trái/i.test(raw)) return "T";
  if (folded === "giua" || /giữa/i.test(raw) || folded === "g") return "G";
  if (/ca\s*mat/.test(folded) || /cả mặt/i.test(raw) || folded === "m") return "M";
  return fallback;
}

/** Khớp tên loại sự cố / công việc BDTX với danh mục. */
export function matchMatDuongWorkType(raw, types = []) {
  const text = String(raw || "").trim();
  if (!text) return "";
  const list = Array.isArray(types) ? types.filter(Boolean) : [];
  if (list.includes(text)) return text;

  const key = normalizeWorkType(text);
  if (!key) return "";

  const exact = list.find((t) => normalizeWorkType(t) === key);
  if (exact) return exact;

  const byMaint = list.find((t) => normalizeWorkType(getMaintenanceNameForType(t)) === key);
  if (byMaint) return byMaint;

  const partial = list.find((t) => {
    const td = normalizeWorkType(t);
    const bd = normalizeWorkType(getMaintenanceNameForType(t));
    return td.includes(key) || key.includes(td) || (bd && (bd.includes(key) || key.includes(bd)));
  });
  return partial || "";
}

export function looksLikeDateCell(value) {
  const s = String(value || "").trim();
  if (!s) return false;
  if (displayToIso(s)) return true;
  if (/^\d{1,2}[\/\-.\s]\d{1,2}[\/\-.\s]\d{2,4}$/.test(s)) return true;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return true;
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const n = Number(s);
    return n > 20000 && n < 80000;
  }
  return false;
}

export function parseDecimalNumber(value) {
  if (value === "" || value == null) return NaN;
  const s = String(value).trim().replace(/\s/g, "").replace(",", ".");
  return Number(s);
}

export function normalizeDecimalString(value) {
  if (!value && value !== 0) return "";
  const n = parseDecimalNumber(value);
  if (!Number.isNaN(n)) return String(n);
  return String(value).trim().replace(",", ".");
}

export function calcBulkQuantity(length, width, height, unit, explicitQty) {
  const explicit = parseDecimalNumber(explicitQty);
  if (!Number.isNaN(explicit) && explicitQty !== "" && explicitQty != null) {
    return explicit;
  }
  const l = parseDecimalNumber(length) || 0;
  const w = parseDecimalNumber(width) || 0;
  const h = parseDecimalNumber(height) || 0;
  if (unit === "m") return l;
  if (unit === "m2") return Math.round(l * w * 100) / 100;
  if (unit === "m3") return Math.round(l * w * h * 100) / 100;
  return 0;
}

/** Tách ô: giữ ô trống khi có tab (tránh lệch cột phía / loại sự cố). */
function splitCells(line) {
  const trimmed = String(line || "").replace(/\r$/, "");
  if (!trimmed.trim()) return [];

  if (trimmed.includes("\t")) {
    return trimmed.split("\t").map((s) => s.trim());
  }
  if (trimmed.includes(";")) {
    return trimmed.split(";").map((s) => s.trim());
  }

  const tokens = trimmed.match(/Km\d+\+\d+|\b[PTM]\b|\d+[,.]\d+|\d+/gi);
  if (tokens && tokens.length >= 4) {
    return tokens.map((s) => s.trim());
  }

  if (/\s{2,}/.test(trimmed)) {
    return trimmed.split(/\s{2,}/).map((s) => s.trim()).filter(Boolean);
  }

  return trimmed.split(/\s+/).map((s) => s.trim()).filter(Boolean);
}

function isHeaderRow(cells) {
  const first = String(cells[0] || "").trim();
  if (/^km\d/i.test(first) || /^\d+\+/.test(first)) return false;
  if (looksLikeDateCell(first) && cells.some((c) => looksLikeKm(c))) return false;
  if (HEADER_FIRST_CELL.test(first)) return true;
  const joined = cells.join(" ").toLowerCase();
  return /lý trình\s*(đầu|cuối)|khối lượng|loại sự cố/.test(joined);
}

function looksLikeKm(value) {
  const s = String(value || "").trim();
  return /km\s*\d/i.test(s) || /\d+\s*\+\s*\d+/.test(s);
}

/**
 * Thứ tự cột khớp bảng nhập nhanh mặt đường (ô trong khung đỏ → loại sự cố).
 */
export function matDuongQuickPasteFields({
  hasHeight = false,
  hasUnit = true,
  showResolved = true,
  showExport = true,
  showBaoLuExport = false
} = {}) {
  const fields = ["date", "kmFrom", "kmTo", "side", "length", "width"];
  if (hasHeight) fields.push("height");
  if (hasUnit) fields.push("unit");
  fields.push("quantityRaw", "type");
  if (showResolved) fields.push("resolvedCo", "resolvedChua");
  if (showExport) fields.push("exportMatDuong");
  fields.push("plannedRepairDate");
  if (showBaoLuExport) fields.push("exportTrafficDuty");
  return fields;
}

function applyPasteField(patch, field, raw, types) {
  const value = String(raw ?? "").trim();
  switch (field) {
    case "date":
      return;
    case "kmFrom":
      if (value) patch.kmFrom = normalizeKmInput(value) || value;
      return;
    case "kmTo":
      if (value) patch.kmTo = normalizeKmInput(value) || value;
      return;
    case "side": {
      if (!value) return;
      const side = normalizeSide(value, "");
      if (side) patch.side = side;
      return;
    }
    case "length":
      if (value !== "") patch.length = normalizeDecimalString(value);
      return;
    case "width":
      if (value !== "") patch.width = normalizeDecimalString(value);
      return;
    case "height":
      if (value !== "") patch.height = normalizeDecimalString(value);
      return;
    case "unit":
      if (value) patch.unit = normalizeUnitValue(value) || value;
      return;
    case "quantityRaw":
      if (value !== "") {
        const q = normalizeDecimalString(value);
        patch.quantityRaw = q;
        patch.quantity = q;
      }
      return;
    case "type": {
      if (!value) return;
      const matched = matchMatDuongWorkType(value, types);
      patch.type = matched || value;
      return;
    }
    case "resolvedCo":
      if (/^x$|có|co|1|true|yes/i.test(value)) patch.resolvedStatus = "co";
      return;
    case "resolvedChua":
      if (/^x$|chưa|chua|1|true|yes/i.test(value)) patch.resolvedStatus = "chua";
      return;
    case "exportMatDuong":
      if (/^(0|false|không|khong|off|no)$/i.test(value)) patch.exportMatDuong = false;
      else if (value) patch.exportMatDuong = true;
      return;
    case "exportTrafficDuty":
      if (/^(1|x|true|yes|có|co)$/i.test(value)) patch.exportTrafficDuty = true;
      else if (/^(0|false|no|không|khong)$/i.test(value)) patch.exportTrafficDuty = false;
      return;
    case "plannedRepairDate": {
      if (!value) return;
      const iso = displayToIso(value) || (/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "");
      if (iso) patch.plannedRepairDate = iso;
      return;
    }
    default:
      return;
  }
}

/** Nếu Excel có lý trình đầu/cuối mà thiếu dài → suy ra mét. */
export function fillLengthFromKmSpan(patch) {
  if (!patch || String(patch.length || "").trim()) return patch;
  const from = normalizeKmInput(patch.kmFrom);
  const to = normalizeKmInput(patch.kmTo);
  if (!from || !to) return patch;
  const span = kmToMeters(to) - kmToMeters(from);
  if (span > 0) patch.length = String(span);
  return patch;
}

/**
 * Dán theo cột form (giống Excel): bắt đầu từ startCol của bảng nhập nhanh.
 */
export function parseMatDuongQuickFormPaste(
  pasteText,
  {
    types = [],
    startCol = 0,
    hasHeight = false,
    hasUnit = true,
    showResolved = true,
    showExport = true,
    showBaoLuExport = false,
    side: defaultSide = "P"
  } = {}
) {
  const fields = matDuongQuickPasteFields({
    hasHeight,
    hasUnit,
    showResolved,
    showExport,
    showBaoLuExport
  });
  const lines = String(pasteText || "")
    .split(/\r?\n/)
    .map((l) => l.replace(/\r$/, ""))
    .filter((l) => l.trim() !== "");

  const rows = [];
  const errors = [];
  let skipped = 0;

  for (let i = 0; i < lines.length; i++) {
    const cells = splitCells(lines[i]);
    if (!cells.length) continue;
    if (isHeaderRow(cells)) {
      skipped += 1;
      continue;
    }

    let col0 = startCol;
    // Clipboard là cả hàng form (ô đầu = ngày) → luôn map từ cột 0 dù đang focus ô khác.
    if (startCol > 0 && looksLikeDateCell(cells[0]) && cells.length >= 4) {
      col0 = 0;
    } else if (
      col0 === 0 &&
      cells.length >= 2 &&
      looksLikeKm(cells[0]) &&
      !looksLikeDateCell(cells[0])
    ) {
      col0 = 1;
    }

    const patch = {};
    for (let c = 0; c < cells.length; c++) {
      const field = fields[col0 + c];
      if (!field) break;
      applyPasteField(patch, field, cells[c], types);
    }

    if (!patch.side && defaultSide) patch.side = defaultSide;
    fillLengthFromKmSpan(patch);
    if (!patch.kmFrom && !patch.length && !patch.width && !patch.type) {
      errors.push(`Dòng ${i + 1}: không đọc được dữ liệu.`);
      continue;
    }
    rows.push(patch);
  }

  return { rows, errors, skipped };
}

/**
 * Thứ tự cột form nhập nhanh BDTX (Nền đường…): giống mặt đường — loại CV sau khối lượng.
 */
export function baoDuongQuickPasteFields({
  noteQty = false,
  singleKm = false,
  showBdtxDate = true,
  showBaoLuExport = false,
  showPhieuCau = false
} = {}) {
  const fields = ["date"];
  if (singleKm) fields.push("bridge");
  fields.push("kmFrom");
  if (singleKm) {
    fields.push("side");
  } else {
    fields.push("kmTo", "side");
  }
  if (noteQty) {
    // ATGT / Cột mốc: loại công việc sau khối lượng (giống mặt đường).
    fields.push("unit", "quantityRaw", "type", "content");
  } else {
    fields.push("length", "width", "height", "unit", "quantityRaw", "type");
  }
  if (showBdtxDate) fields.push("plannedRepairDate");
  if (showBaoLuExport) fields.push("exportTrafficDuty");
  if (showPhieuCau) fields.push("exportPhieuCau");
  return fields;
}

function applyBaoDuongPasteField(patch, field, raw, types) {
  const value = String(raw ?? "").trim();
  switch (field) {
    case "bridge":
      return;
    case "exportTrafficDuty":
      if (/^(1|x|true|yes|có|co)$/i.test(value)) patch.exportTrafficDuty = true;
      else if (/^(0|false|no|không|khong)$/i.test(value)) patch.exportTrafficDuty = false;
      return;
    case "exportPhieuCau":
      if (/^(0|false|no|không|khong)$/i.test(value)) patch.exportPhieuCau = false;
      else if (value) patch.exportPhieuCau = true;
      return;
    case "content":
      if (value) patch.content = value;
      return;
    case "quantityRaw":
      if (value !== "") {
        const q = normalizeDecimalString(value);
        patch.quantityRaw = q;
        patch.quantity = q;
      }
      return;
    default:
      applyPasteField(patch, field, raw, types);
  }
}

/**
 * Dán Excel theo cột form BDTX / nền đường (giữ ô trống để không lệch cột).
 */
export function parseBaoDuongQuickFormPaste(
  pasteText,
  {
    types = [],
    startCol = 0,
    noteQty = false,
    singleKm = false,
    showBdtxDate = true,
    showBaoLuExport = false,
    showPhieuCau = false,
    side: defaultSide = "P"
  } = {}
) {
  const fields = baoDuongQuickPasteFields({
    noteQty,
    singleKm,
    showBdtxDate,
    showBaoLuExport,
    showPhieuCau
  });
  const lines = String(pasteText || "")
    .split(/\r?\n/)
    .map((l) => l.replace(/\r$/, ""))
    .filter((l) => l.trim() !== "");

  const rows = [];
  const errors = [];
  let skipped = 0;

  for (let i = 0; i < lines.length; i++) {
    const cells = splitCells(lines[i]);
    if (!cells.length) continue;
    if (isHeaderRow(cells)) {
      skipped += 1;
      continue;
    }

    let col0 = startCol;
    if (startCol > 0 && looksLikeDateCell(cells[0]) && cells.length >= 4) {
      col0 = 0;
    } else if (
      col0 === 0 &&
      !singleKm &&
      cells.length >= 2 &&
      looksLikeKm(cells[0]) &&
      !looksLikeDateCell(cells[0])
    ) {
      col0 = 1;
    }

    const patch = {};
    for (let c = 0; c < cells.length; c++) {
      const field = fields[col0 + c];
      if (!field) break;
      applyBaoDuongPasteField(patch, field, cells[c], types);
    }

    if (!singleKm && !patch.side && defaultSide) patch.side = defaultSide;
    fillLengthFromKmSpan(patch);
    if (!patch.kmFrom && !patch.length && !patch.width && !patch.type && !patch.quantity) {
      errors.push(`Dòng ${i + 1}: không đọc được dữ liệu.`);
      continue;
    }
    rows.push(patch);
  }

  return { rows, errors, skipped };
}

function parseDataCells(cells, defaultSide) {
  const clean = cells.map((c) => c.trim()).filter((c) => c !== "");
  const n = clean.length;
  if (n < 3) return null;

  let kmFrom = "";
  let kmTo = "";
  let side = defaultSide;
  let length = "";
  let width = "";
  let height = "";
  let quantity = "";

  const sideAtThird = normalizeSide(clean[2], "");

  if (sideAtThird && clean[2].length <= 4) {
    kmFrom = clean[0];
    kmTo = clean[1];
    side = clean[2];
    length = clean[3] ?? "";
    width = clean[4] ?? "";
    height = clean[5] ?? "";
    quantity = clean[6] ?? "";
  } else if (n >= 7) {
    [kmFrom, kmTo, side, length, width, height, quantity] = clean;
    side = normalizeSide(side, defaultSide);
  } else if (n === 6) {
    [kmFrom, kmTo, length, width, height, quantity] = clean;
  } else if (n === 3) {
    [kmFrom, length, width] = clean;
  } else if (n === 4) {
    if (looksLikeKm(clean[1])) {
      [kmFrom, kmTo, length, width] = clean;
    } else if (normalizeSide(clean[1], "") && clean[1].length <= 4) {
      [kmFrom, side, length, width] = clean;
      side = clean[1];
    } else {
      [kmFrom, length, width, height] = clean;
    }
  } else if (n === 5) {
    const maybeSide = normalizeSide(clean[4], "");
    if (maybeSide && clean[4].length <= 2) {
      [kmFrom, kmTo, length, width] = clean;
      side = maybeSide;
    } else {
      [kmFrom, kmTo, length, width, height] = clean;
    }
  } else {
    [kmFrom, kmTo, length, width] = clean;
  }

  side = normalizeSide(side, defaultSide);

  const kmFromNorm = normalizeKmInput(kmFrom);
  let kmToNorm = normalizeKmInput(kmTo);
  const lengthNorm = normalizeDecimalString(length);
  const lengthM = parseDecimalNumber(lengthNorm);
  if (kmFromNorm) {
    kmToNorm = lengthM > 0 ? addMetersToKm(kmFromNorm, lengthM) : kmFromNorm;
  }

  return {
    kmFrom: kmFromNorm,
    kmTo: kmToNorm,
    side,
    length: normalizeDecimalString(length),
    width: normalizeDecimalString(width),
    height: normalizeDecimalString(height),
    quantityRaw: normalizeDecimalString(quantity)
  };
}

/**
 * Dán từ Excel: đầu | cuối | [phía] | dài | rộng | [cao] | [khối lượng]
 * Hỗ trợ: Km437+415, số thập phân dấu phẩy (21,00), phía P/T/M cột 3
 */
export function parseBulkMatDuongPaste(pasteText, { side: defaultSide = "P", unit = "m2" } = {}) {
  const lines = String(pasteText || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const rows = [];
  const errors = [];
  let skipped = 0;

  for (let i = 0; i < lines.length; i++) {
    const cells = splitCells(lines[i]);
    if (!cells.length) continue;
    if (isHeaderRow(cells)) {
      skipped += 1;
      continue;
    }

    // Layout form có cột ngày đầu → bỏ qua để không nuốt phía/loại sự cố.
    let use = cells;
    if (looksLikeDateCell(cells[0])) {
      use = cells.slice(1);
    }

    const parsed = parseDataCells(use, defaultSide);
    if (!parsed) {
      errors.push(`Dòng ${i + 1}: cần ít nhất 3 cột (điểm đầu, dài, rộng).`);
      continue;
    }
    if (!parsed.kmFrom && !parsed.kmTo) {
      errors.push(`Dòng ${i + 1}: thiếu lý trình.`);
      continue;
    }

    const quantity = calcBulkQuantity(
      parsed.length,
      parsed.width,
      parsed.height,
      unit,
      parsed.quantityRaw
    );

    rows.push({
      kmFrom: parsed.kmFrom,
      kmTo: parsed.kmTo,
      side: parsed.side,
      length: parsed.length,
      width: parsed.width,
      height: parsed.height,
      quantity
    });
  }

  return { rows, errors, skipped };
}

export function previewBulkMatDuong(pasteText, common) {
  const { rows, errors, skipped } = parseBulkMatDuongPaste(pasteText, common);
  return { rows, errors, skipped, count: rows.length };
}

/** Chuẩn hóa một dòng nhập nhanh → dữ liệu sổ + nhật ký. */
export function normalizeMatDuongQuickRow(row, common = {}) {
  const kmFromNorm = normalizeKmInput(row?.kmFrom);
  if (!kmFromNorm) return null;

  const lengthNorm = normalizeDecimalString(row?.length);
  const widthNorm = normalizeDecimalString(row?.width);
  const lengthM = parseDecimalNumber(lengthNorm);
  const type = String(row?.type || common.type || "").trim();
  const unit =
    normalizeUnitValue(getUnitForType(type)) ||
    normalizeUnitValue(row?.unit) ||
    normalizeUnitValue(common.unit) ||
    "m2";
  const kmTo =
    lengthM > 0 ? addMetersToKm(kmFromNorm, lengthM) : normalizeKmInput(row?.kmTo) || kmFromNorm;
  const quantity = calcBulkQuantity(
    lengthNorm,
    widthNorm,
    row?.height || "",
    unit,
    row?.quantityRaw || row?.quantity
  );

  return {
    kmFrom: kmFromNorm,
    kmTo,
    side: normalizeSide(
      row?.side,
      allowsEmptyDiarySide(common.section) ? common.side || "" : common.side || "P"
    ),
    length: lengthNorm,
    width: widthNorm,
    height: normalizeDecimalString(row?.height || ""),
    unit,
    quantity
  };
}

export function buildMatDuongEntriesFromRows(rows, common, date, options = {}) {
  const section = options.section || "Mặt đường";
  const exportField = options.exportField || "exportMatDuong";
  const showBaoLuExport = options.showBaoLuExport === true;
  const defaultRouteId = String(options.routeId || "").trim();
  const defaultRoadName = String(options.roadName || "").trim();
  const errors = [];
  const entries = [];

  (rows || []).forEach((row, i) => {
    const norm = normalizeMatDuongQuickRow(row, { ...common, section });
    if (!norm) return;
    const type = String(row?.type || common.type || "").trim();
    const countUnit = isCountUnit(norm.unit);
    if (!countUnit && !norm.length && !norm.width) {
      errors.push(`Dòng ${i + 1}: thiếu dài hoặc rộng.`);
      return;
    }
    if (countUnit && !(Number(norm.quantity) > 0)) {
      errors.push(`Dòng ${i + 1}: thiếu khối lượng.`);
      return;
    }
    let plannedRepairDate = String(row?.plannedRepairDate || "").trim();
    // Thiếu ngày xuất BDTX nhưng loại công việc cần bảo dưỡng → tự điền theo deadline.
    if (!plannedRepairDate && type && needMaintenanceForType(type)) {
      plannedRepairDate = plannedRepairDateForType(date, type);
    }
    if (type && !needMaintenanceForType(type)) {
      plannedRepairDate = "";
    }
    // Nhánh đang chọn trên form là nguồn đúng khi thêm/sửa; không giữ nhánh cũ của dòng.
    const routeId = String(defaultRouteId || row?.routeId || "").trim();
    const roadName = String(defaultRoadName || row?.roadName || "").trim();
    const entry = {
      ...common,
      ...norm,
      section,
      date,
      type,
      content: String(row?.content || "").trim(),
      inspectorSign: String(row?.inspectorSign || common.inspectorSign || "").trim(),
      inspectorNote: String(row?.inspectorNote || "").trim(),
      resolvedStatus: row?.resolvedStatus || common.resolvedStatus || "",
      plannedRepairDate,
      ...(routeId ? { routeId } : {}),
      ...(roadName ? { roadName } : {})
    };
    entry[exportField] = row?.[exportField] !== false;
    if (showBaoLuExport) {
      entry.exportTrafficDuty = row?.exportTrafficDuty === true;
    }
    if (Number.isInteger(row?._editIndex)) entry._editIndex = row._editIndex;
    entries.push(entry);
  });

  if (!entries.length) {
    return {
      entries: [],
      errors: errors.length ? errors : ["Không có dòng hợp lệ (cần điểm đầu + dài/rộng)."]
    };
  }
  return { entries, errors };
}

export function buildBulkMatDuongEntries(pasteText, common, date) {
  const { rows, errors } = parseBulkMatDuongPaste(pasteText, common);
  if (!rows.length) {
    return { entries: [], errors: errors.length ? errors : ["Không đọc được dòng nào."] };
  }
  const built = buildMatDuongEntriesFromRows(rows, common, date);
  return { entries: built.entries, errors: [...errors, ...built.errors] };
}

export const EMPTY_MAT_DUONG_QUICK_ROW = {
  kmFrom: "",
  kmTo: "",
  side: "",
  length: "",
  width: "",
  height: "",
  type: "",
  content: "",
  quantity: "",
  unit: "",
  resolvedStatus: "",
  exportMatDuong: true,
  plannedRepairDate: "",
  exportPhieuCau: true,
  exportTrafficDuty: false,
  exportCongStatus: "",
  routeId: "",
  roadName: ""
};

export function makeEmptyQuickRows(count = 8) {
  return Array.from({ length: count }, () => ({ ...EMPTY_MAT_DUONG_QUICK_ROW }));
}
