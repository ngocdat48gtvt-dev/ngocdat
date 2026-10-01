import { isPermitRowFilled } from "./gptcSummaryGrid";

/** Bố cục BM02 — A4 ngang, co/giãn dòng tự động. */
export const GPTC_DETAIL_LAYOUT = {
  sheetHeightMm: 210,
  /** Lề mặc định khi chưa truyền margins */
  paddingVerticalMm: 16,
  titleMm: 12,
  projectLineMm: 9,
  theadMm: 14,
  safetyMm: 5,
  /** Chiều cao dòng chuẩn */
  rowMm: 9,
  /** Co tối đa 20% trước khi nhảy trang */
  rowCompressMin: 0.8,
  /** Giãn tối đa khi dàn đều */
  rowStretchMax: 1.5,
  /** Số dòng tối thiểu 1 trang (chừa ô trống nhập) */
  minRows: 12
};

/** Bố cục BM01 bảng tổng hợp — co/giãn khi in. */
export const GPTC_SUMMARY_LAYOUT = {
  sheetHeightMm: 210,
  /** Tiêu đề có thể 2 dòng */
  titleMm: 18,
  /** 3 hàng thead (nhãn dài + phụ + số cột) */
  theadMm: 42,
  /** Chừa nét đáy + sai số đo */
  safetyMm: 6,
  rowMm: 12,
  rowCompressMin: 0.75,
  rowStretchMax: 1.25,
  minRows: 4
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

export function gptcSummaryBodyBudgetMm(margins) {
  const L = GPTC_SUMMARY_LAYOUT;
  const padV = (Number(margins?.top) || 0) + (Number(margins?.bottom) || 0);
  return Math.max(50, L.sheetHeightMm - padV - L.titleMm - L.theadMm - L.safetyMm);
}

/** Số dòng chuẩn / trang (chiều cao rowMm). */
export function gptcDetailRowsPerPage(margins) {
  const budget = gptcDetailBodyBudgetMm(margins);
  const n = Math.floor(budget / GPTC_DETAIL_LAYOUT.rowMm);
  return Math.max(GPTC_DETAIL_LAYOUT.minRows, n);
}

/** Số dòng tối đa khi co 20%. */
export function gptcDetailMaxRowsPerPage(margins) {
  const L = GPTC_DETAIL_LAYOUT;
  const budget = gptcDetailBodyBudgetMm(margins);
  const n = Math.floor(budget / (L.rowMm * (L.rowCompressMin || 0.8)));
  return Math.max(L.minRows, n);
}

function clampRowHeight(budget, count, baseMm, compressMin, stretchMax) {
  const n = Math.max(1, count);
  const h = budget / n;
  const minH = baseMm * (compressMin || 0.8);
  const maxH = baseMm * (stretchMax || 1.5);
  return Math.min(maxH, Math.max(minH, h));
}

/** Ước chiều cao dòng BM02 theo lượng chữ (mm). */
export function estimateGptcDetailRowMm(entry) {
  const L = GPTC_DETAIL_LAYOUT;
  if (!entry) return L.rowMm;

  function countLines(text, charsPerLine) {
    if (!text) return 1;
    let n = 0;
    String(text)
      .split("\n")
      .forEach((line) => {
        n += Math.max(1, Math.ceil(Math.max(String(line).length, 1) / charsPerLine));
      });
    return Math.max(1, n);
  }

  const lines = Math.max(
    countLines(entry.ngay, 14),
    countLines(entry.dienBien, 46),
    countLines(entry.yKienHatTruong, 34),
    countLines(entry.yKienTuanKiem, 34)
  );
  return Math.max(L.rowMm, 7.2 + (lines - 1) * 4.6);
}

/**
 * Chia BM02 theo chiều cao nội dung chữ.
 * - Co ≤20% nếu sát mép; tờ giữa không hàng trống.
 * - Tờ cuối: thêm ô trống nhập rồi dàn phần còn lại.
 * @returns {{ rows: Array<object|null>, rowHeightMm: number, rowHeightsMm: number[] }[]}
 */
export function packGptcDetailPages(entries, margins) {
  const L = GPTC_DETAIL_LAYOUT;
  const list = Array.isArray(entries) ? entries : [];
  const budget = gptcDetailBodyBudgetMm(margins);
  const compressMin = L.rowCompressMin || 0.8;
  const stretchMax = L.rowStretchMax || 1.5;
  const emptyH = L.rowMm;
  const minEmptySlots = L.minRows;

  function finishPage(chunkRows, chunkHeights, { padEmpty }) {
    let rows = [...chunkRows];
    let hs = [...chunkHeights];
    let sum = hs.reduce((a, b) => a + b, 0);

    if (sum > budget && sum > 0) {
      const s = Math.max(compressMin, budget / sum);
      hs = hs.map((h) => h * s);
      sum = hs.reduce((a, b) => a + b, 0);
    }

    if (padEmpty) {
      let remain = budget - sum;
      while (
        (rows.length < minEmptySlots || remain >= emptyH * 0.9) &&
        remain >= emptyH * 0.55
      ) {
        rows.push(null);
        const h = Math.min(emptyH, remain);
        hs.push(h);
        remain -= h;
        sum += h;
        if (rows.length >= minEmptySlots && remain < emptyH) break;
        if (rows.length > minEmptySlots + 30) break;
      }
      // Phần dư: ưu tiên giãn ô trống, không phình quá chữ.
      remain = budget - sum;
      if (remain > 0.8) {
        const emptyIdx = rows
          .map((r, i) => (r == null ? i : -1))
          .filter((i) => i >= 0);
        if (emptyIdx.length) {
          const add = remain / emptyIdx.length;
          emptyIdx.forEach((i) => {
            hs[i] += add;
          });
        } else if (sum > 0) {
          const s = Math.min(stretchMax, budget / sum);
          hs = hs.map((h) => h * s);
        }
      }
    } else if (sum > 0 && sum < budget) {
      const s = Math.min(stretchMax, budget / sum);
      hs = hs.map((h) => h * s);
    }

    const avg = hs.length ? hs.reduce((a, b) => a + b, 0) / hs.length : emptyH;
    return { rows, rowHeightsMm: hs, rowHeightMm: avg };
  }

  if (!list.length) {
    const n = Math.max(minEmptySlots, Math.floor(budget / emptyH));
    return [
      finishPage(
        Array.from({ length: n }, () => null),
        Array.from({ length: n }, () => emptyH),
        { padEmpty: true }
      )
    ];
  }

  const pages = [];
  let idx = 0;
  while (idx < list.length) {
    const chunk = [];
    const heights = [];
    let used = 0;
    while (idx < list.length) {
      const h = estimateGptcDetailRowMm(list[idx]);
      if (chunk.length > 0) {
        const next = used + h;
        const scale = next > 0 ? budget / next : 1;
        if (scale < compressMin) break;
      }
      chunk.push(list[idx]);
      heights.push(h);
      used += h;
      idx += 1;
      if (chunk.length === 1 && h * compressMin > budget) break;
    }
    const isLast = idx >= list.length;
    pages.push(finishPage(chunk, heights, { padEmpty: isLast }));
  }
  return pages;
}

/** @deprecated dùng packGptcDetailPages[].rows.length */
export function gptcDetailSlotCount(entryCount, margins) {
  const pages = packGptcDetailPages(
    Array.from({ length: Number(entryCount) || 0 }, (_, i) => ({ id: i })),
    margins
  );
  return pages.reduce((s, p) => s + p.rows.length, 0);
}

export function gptcSummaryRowsPerPage(margins) {
  const budget = gptcSummaryBodyBudgetMm(margins);
  const L = GPTC_SUMMARY_LAYOUT;
  return Math.max(L.minRows, Math.floor(budget / L.rowMm));
}

export function gptcSummaryMaxRowsPerPage(margins) {
  const budget = gptcSummaryBodyBudgetMm(margins);
  const L = GPTC_SUMMARY_LAYOUT;
  return Math.max(
    L.minRows,
    Math.floor(budget / (L.rowMm * (L.rowCompressMin || 0.75)))
  );
}

/** Ước chiều cao hàng BM01 theo chữ (mm) — dùng khi in để không tràn khung. */
export function estimateGptcSummaryRowMm(permit) {
  const L = GPTC_SUMMARY_LAYOUT;
  if (!permit) return L.rowMm;

  function countLines(text, charsPerLine) {
    if (!text) return 1;
    let n = 0;
    String(text)
      .split("\n")
      .forEach((line) => {
        n += Math.max(1, Math.ceil(Math.max(String(line).length, 1) / charsPerLine));
      });
    return Math.max(1, n);
  }

  const lines = Math.max(
    countLines(permit.tenCongTrinh, 28),
    countLines(permit.donViDuocCap, 22),
    countLines(permit.noiDungCapPhep, 32),
    countLines(permit.ghiChu, 16),
    1
  );
  return Math.max(L.rowMm, 8 + (lines - 1) * 4.2);
}

/**
 * BM01 in: ước cao hàng dữ liệu, chỉ pad hàng trống trong phần còn lại — tổng ≤ budget.
 * @returns {{ rows: Array<object|null>, rowHeightMm: number, rowHeightsMm: number[] }[]}
 */
export function packGptcSummaryPrintPages(permits, margins) {
  const L = GPTC_SUMMARY_LAYOUT;
  const budget = gptcSummaryBodyBudgetMm(margins);
  const emptyH = L.rowMm;
  const filled = (permits || []).filter(isPermitRowFilled);

  function finishPage(chunkRows) {
    const rows = [...chunkRows];
    const heights = rows.map((p) => estimateGptcSummaryRowMm(p));
    let sum = heights.reduce((a, b) => a + b, 0);

    // Pad hàng trống nếu còn chỗ
    while (sum + emptyH <= budget + 0.05) {
      rows.push(null);
      heights.push(emptyH);
      sum += emptyH;
    }

    // Giãn nhẹ hàng trống (không đụng hàng có chữ) cho khít trang
    const remain = budget - sum;
    if (remain > 0.2) {
      const emptyIdx = [];
      heights.forEach((h, i) => {
        if (!rows[i]) emptyIdx.push(i);
      });
      if (emptyIdx.length) {
        const add = Math.min(remain, emptyIdx.length * emptyH * 0.25);
        const each = add / emptyIdx.length;
        emptyIdx.forEach((i) => {
          heights[i] += each;
        });
        sum += add;
      }
    }

    // Phòng thủ: nếu vẫn vượt (hàng chữ quá cao) — co đều xuống vừa budget
    if (sum > budget) {
      const scale = budget / sum;
      for (let i = 0; i < heights.length; i += 1) {
        heights[i] *= scale;
      }
      sum = budget;
    }

    const avg = heights.length > 0 ? sum / heights.length : emptyH;

    return {
      rows,
      rowHeightMm: avg,
      rowHeightsMm: heights
    };
  }

  if (filled.length === 0) {
    return [finishPage([])];
  }

  const pages = [];
  let idx = 0;
  while (idx < filled.length) {
    const chunk = [];
    let used = 0;
    while (idx < filled.length) {
      const h = estimateGptcSummaryRowMm(filled[idx]);
      // Ít nhất 1 hàng/trang; thêm hàng nếu còn chỗ + chừa 1 hàng trống tối thiểu khi còn CT sau
      if (chunk.length > 0 && used + h > budget) break;
      chunk.push(filled[idx]);
      used += h;
      idx += 1;
    }
    pages.push(finishPage(chunk));
  }
  return pages;
}
