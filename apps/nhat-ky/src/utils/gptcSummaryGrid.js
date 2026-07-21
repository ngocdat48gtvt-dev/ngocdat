export const SUMMARY_FIELD_KEYS = [
  null,
  "tenCongTrinh",
  "soNgayCapPhep",
  "ngayBanGiao",
  "donViDuocCap",
  "noiDungCapPhep",
  "ngayBatDau",
  "ngayKetThuc",
  "ghiChu"
];

export const DEFAULT_DETAIL_COL_WIDTHS = [100, 280, 220, 220];

export function normalizeDetailColWidths(raw) {
  const base = [...DEFAULT_DETAIL_COL_WIDTHS];
  if (!Array.isArray(raw) || raw.length !== 4) return base;
  return raw.map((w, i) => {
    const n = Number(w);
    return Number.isFinite(n) && n >= 28 ? Math.round(n) : base[i];
  });
}

export const DEFAULT_SUMMARY_COL_WIDTHS = [36, 150, 105, 105, 120, 170, 88, 88, 88];

export function normalizeSummaryColWidths(raw) {
  const base = [...DEFAULT_SUMMARY_COL_WIDTHS];
  if (!Array.isArray(raw) || raw.length !== 9) return base;
  return raw.map((w, i) => {
    const n = Number(w);
    return Number.isFinite(n) && n >= 28 ? Math.round(n) : base[i];
  });
}

export function parseExcelGrid(text) {
  const normalized = String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
  if (!normalized.trim()) return [];
  if (!normalized.includes("\t") && normalized.includes("\n")) {
    return normalized.split("\n").map((line) => [line]);
  }
  return normalized.split("\n").map((line) => line.split("\t"));
}

/** Nếu dán cả dòng Excel có cột STT số, căn từ cột (1). */
export function resolvePasteOrigin(startRow, startCol, grid) {
  const first = grid[0];
  if (!first?.length) return { startRow, startCol, grid };
  const looksLikeSttRow =
    first.length >= 8 && /^\d+\.?$/.test(String(first[0] ?? "").trim());
  if (looksLikeSttRow && startCol >= 1) {
    return { startRow, startCol: 0, grid };
  }
  return { startRow, startCol, grid };
}

export function buildPasteUpdates(permits, startRow, startCol, grid, makePermit) {
  const updates = [];
  const newPermits = [];
  let list = [...(permits || [])];

  grid.forEach((cols, rowOffset) => {
    let rowIndex = startRow + rowOffset;
    while (rowIndex >= list.length) {
      const p = makePermit();
      list.push(p);
      newPermits.push(p);
    }
    const permit = list[rowIndex];

    cols.forEach((raw, colOffset) => {
      const colIndex = startCol + colOffset;
      if (colIndex === 0) return;
      if (colIndex < 1 || colIndex > 8) return;
      const field = SUMMARY_FIELD_KEYS[colIndex];
      if (!field) return;
      updates.push({ id: permit.id, field, value: String(raw ?? "").trim() });
    });
  });

  return { updates, newPermits, list };
}

export function applyPermitUpdates(permits, updates) {
  if (!updates.length) return permits;
  const map = new Map(updates.map((u) => [`${u.id}:${u.field}`, u.value]));
  return permits.map((p) => {
    let next = p;
    SUMMARY_FIELD_KEYS.forEach((field) => {
      if (!field) return;
      const key = `${p.id}:${field}`;
      if (!map.has(key)) return;
      next = { ...next, [field]: map.get(key) };
    });
    return next === p ? p : next;
  });
}

/** Dòng BM01 có dữ liệu nhập (bất kỳ cột nào ngoài STT). */
export function isPermitRowFilled(permit) {
  return SUMMARY_FIELD_KEYS.some((field) => {
    if (!field) return false;
    return String(permit?.[field] ?? "").trim() !== "";
  });
}

/** Số công trình thực sự đã kê (không tính dòng trống). */
export function countFilledPermits(permits) {
  return (permits || []).filter(isPermitRowFilled).length;
}
