import { addMetersToKm, normalizeKmInput } from "./nhatKyFormat";

const HEADER_FIRST_CELL =
  /^(stt|lý trình|ly trinh|đầu|cuối|dài|rộng|cao|khối lượng|khoi luong|phía|vi trí)$/i;

export function normalizeSide(value, fallback = "P") {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  const upper = raw.toUpperCase();
  if (upper === "P" || upper === "T" || upper === "G" || upper === "M" || upper === "C") {
    return upper === "C" ? "M" : upper;
  }
  if (/phải/i.test(raw)) return "P";
  if (/trái/i.test(raw)) return "T";
  if (/giữa/i.test(raw)) return "G";
  if (/cả mặt/i.test(raw)) return "M";
  return fallback;
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

/** Tách ô: ưu tiên tab, sau đó nhận dạng Km / P-T-M / số (hỗ trợ 21,00) */
function splitCells(line) {
  const trimmed = line.trim();
  if (!trimmed) return [];

  if (trimmed.includes("\t")) {
    return trimmed.split("\t").map((s) => s.trim()).filter(Boolean);
  }
  if (trimmed.includes(";")) {
    return trimmed.split(";").map((s) => s.trim()).filter(Boolean);
  }

  const tokens = trimmed.match(
    /Km\d+\+\d+|\b[PTM]\b|\d+[,.]\d+|\d+/gi
  );
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
  if (HEADER_FIRST_CELL.test(first)) return true;
  const joined = cells.join(" ").toLowerCase();
  return /lý trình\s*(đầu|cuối)|khối lượng/.test(joined);
}

function looksLikeKm(value) {
  const s = String(value || "").trim();
  return /km\s*\d/i.test(s) || /\d+\s*\+\s*\d+/.test(s);
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

  if (sideAtThird && clean[2].length <= 2) {
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
    } else if (normalizeSide(clean[1], "") && clean[1].length <= 2) {
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

    const parsed = parseDataCells(cells, defaultSide);
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
  const unit = row?.unit || common.unit || "m2";
  const kmTo =
    lengthM > 0 ? addMetersToKm(kmFromNorm, lengthM) : normalizeKmInput(row?.kmTo) || kmFromNorm;
  const quantity = calcBulkQuantity(lengthNorm, widthNorm, row?.height || "", unit, row?.quantityRaw);

  return {
    kmFrom: kmFromNorm,
    kmTo,
    side: normalizeSide(row?.side, common.side || "P"),
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
  const errors = [];
  const entries = [];

  (rows || []).forEach((row, i) => {
    const norm = normalizeMatDuongQuickRow(row, common);
    if (!norm) return;
    if (!norm.length && !norm.width) {
      errors.push(`Dòng ${i + 1}: thiếu dài hoặc rộng.`);
      return;
    }
    const entry = {
      ...common,
      ...norm,
      section,
      date,
      type: String(row?.type || common.type || "").trim(),
      content: String(row?.content || "").trim(),
      inspectorSign: String(row?.inspectorSign || common.inspectorSign || "").trim(),
      inspectorNote: String(row?.inspectorNote || "").trim(),
      resolvedStatus: row?.resolvedStatus || common.resolvedStatus || "",
      plannedRepairDate: String(row?.plannedRepairDate || "").trim()
    };
    entry[exportField] = row?.[exportField] !== false;
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
  side: "",
  length: "",
  width: "",
  height: "",
  type: "",
  resolvedStatus: "",
  exportMatDuong: true,
  plannedRepairDate: ""
};

export function makeEmptyQuickRows(count = 8) {
  return Array.from({ length: count }, () => ({ ...EMPTY_MAT_DUONG_QUICK_ROW }));
}
