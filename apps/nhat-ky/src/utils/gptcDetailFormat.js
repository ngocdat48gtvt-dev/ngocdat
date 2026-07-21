import { isPermitRowFilled } from "./gptcSummaryGrid";

/** Bố cục BM02 — A4 ngang, dòng cố định kiểu Excel. */
export const GPTC_DETAIL_LAYOUT = {
  sheetHeightMm: 210,
  /** Lề mặc định khi chưa truyền margins */
  paddingVerticalMm: 16,
  titleMm: 12,
  projectLineMm: 9,
  theadMm: 14,
  safetyMm: 3,
  /** Chiều cao mỗi dòng dữ liệu */
  rowMm: 9,
  /** Số dòng tối thiểu 1 trang */
  minRows: 12
};

/** Bố cục BM01 bảng tổng hợp — pad dòng trống cho đủ trang. */
export const GPTC_SUMMARY_LAYOUT = {
  sheetHeightMm: 210,
  titleMm: 14,
  /** 3 hàng thead (nhãn + phụ + số cột) */
  theadMm: 30,
  safetyMm: 4,
  /** Chiều cao tối thiểu dòng thân (khớp dòng dữ liệu ngắn) */
  rowMm: 14,
  minRows: 6
};

export function gptcDetailBodyBudgetMm(margins) {
  const L = GPTC_DETAIL_LAYOUT;
  const padV =
    margins != null
      ? (Number(margins.top) || 0) + (Number(margins.bottom) || 0)
      : L.paddingVerticalMm;
  return Math.max(
    60,
    L.sheetHeightMm - padV - L.titleMm - L.projectLineMm - L.theadMm - L.safetyMm
  );
}

/** Số dòng dữ liệu trên 1 tờ A4 ngang. */
export function gptcDetailRowsPerPage(margins) {
  const budget = gptcDetailBodyBudgetMm(margins);
  const n = Math.floor(budget / GPTC_DETAIL_LAYOUT.rowMm);
  return Math.max(GPTC_DETAIL_LAYOUT.minRows, n);
}

/**
 * Số ô hiển thị: luôn full trang; nếu trang cuối đã đầy dữ liệu thì thêm 1 trang trống.
 */
export function gptcDetailSlotCount(entryCount, margins) {
  const R = gptcDetailRowsPerPage(margins);
  const n = Math.max(0, Number(entryCount) || 0);
  if (n === 0) return R;
  if (n % R === 0) return n + R;
  return Math.ceil(n / R) * R;
}

/**
 * Chia entries thành các trang, mỗi trang đúng R dòng (pad bằng null).
 * @returns {Array<Array<object|null>>}
 */
export function packGptcDetailPages(entries, margins) {
  const R = gptcDetailRowsPerPage(margins);
  const list = Array.isArray(entries) ? entries : [];
  const slotCount = gptcDetailSlotCount(list.length, margins);
  const pageCount = Math.max(1, Math.ceil(slotCount / R));
  const pages = [];

  for (let p = 0; p < pageCount; p++) {
    const rows = [];
    for (let i = 0; i < R; i++) {
      const idx = p * R + i;
      rows.push(idx < list.length ? list[idx] : null);
    }
    pages.push(rows);
  }
  return pages;
}

export function gptcSummaryRowsPerPage(margins) {
  const L = GPTC_SUMMARY_LAYOUT;
  const padV = (Number(margins?.top) || 0) + (Number(margins?.bottom) || 0);
  const budget = Math.max(50, L.sheetHeightMm - padV - L.titleMm - L.theadMm - L.safetyMm);
  return Math.max(L.minRows, Math.floor(budget / L.rowMm));
}

/**
 * BM01 in: chỉ dòng đã kê + pad null cho đủ trang (đủ chiều cao).
 * @returns {Array<Array<object|null>>}
 */
export function packGptcSummaryPrintPages(permits, margins) {
  const R = gptcSummaryRowsPerPage(margins);
  const filled = (permits || []).filter(isPermitRowFilled);

  if (filled.length === 0) {
    return [Array.from({ length: R }, () => null)];
  }

  const pageCount = Math.max(1, Math.ceil(filled.length / R));
  const pages = [];
  for (let p = 0; p < pageCount; p++) {
    const rows = [];
    for (let i = 0; i < R; i++) {
      const idx = p * R + i;
      rows.push(idx < filled.length ? filled[idx] : null);
    }
    pages.push(rows);
  }
  return pages;
}
