import {
  formatDisplayDate,
  formatLyTrinh,
  isCulvertDiaryEntry,
  migrateEntry,
  parseDayWeather
} from "./nhatKyFormat";
import { calcAreaM2 } from "./matDuongFormat";
import { formatBookDecimal, parseBookNumber } from "./bookNumberFormat";
import {
  getQualityForType,
  getMaintenanceNameForType,
  getDeadlineDaysForType,
  needMaintenanceForType,
  normalizeUnitValue,
  isCountUnit
} from "./baoDuongQualityStore";
import {
  buildRouteDisplayBlocks
} from "./roadsCatalog";
import { expandEntriesForVolumeBooks } from "./mergeDiaryEntries";

export const BAO_DUONG_MAX_DAYS = 3;

/** Hạng mục sổ tuần đường được đưa sang sổ BDTX (có ngày dự kiến sửa chữa). */
export const BAO_DUONG_SECTIONS = new Set([
  "Mặt đường",
  "Nền đường",
  "Lề đường",
  "Cống, rãnh thoát nước",
  "Ngầm, tràn (lũ, ngập)",
  "Cột mốc GP mặt bằng, lộ giới",
  "Công trình an toàn giao thông",
  "Công trình cầu"
]);

export function isBaoDuongSection(section) {
  const s = String(section || "").trim();
  if (BAO_DUONG_SECTIONS.has(s)) return true;
  // Section cũ phát cây (trước khi migrateEntry) vẫn thuộc BDTX.
  return s === "Công tác phát cây" || s === "Phát cây";
}

const WORK_NAMES = {
  "Ổ gà": "Sửa chữa ổ gà",
  "Lún vệt bánh xe": "Sửa chữa lún vệt bánh xe",
  "Cao su": "Xử lý cao su",
  "Sình lún": "Xử lý sình lún",
  // Nền đường
  "Sụt lún": "Xử lý sụt lún nền đường",
  "Sạt taluy": "Hót sạt, xử lý taluy",
  "Nứt nền": "Xử lý nứt nền đường",
  "Sụt nhỏ": "Xử lý sụt nhỏ nền đường",
  "Cung trượt": "Xử lý cung trượt nền đường",
  // Lề đường
  "Lề cao": "Hạ lề đường",
  "Lề thấp": "Đắp phụ lề đường",
  "Đọng nước": "Khơi thông thoát nước",
  "Vật cản lề": "Dọn vật cản trên lề",
  "Cỏ mọc": "Phát cỏ, vệ sinh",
  "Nứt lề": "Sửa chữa nứt lề đường",
  "Xói lở lề": "Sửa chữa xói lở lề đường",
  // Cống, rãnh thoát nước
  "Tắc rãnh": "Nạo vét, khơi thông rãnh",
  "Tắc cống": "Thông tắc cống",
  "Đọng bùn": "Nạo vét bùn đất",
  "Hư thoát nước": "Sửa chữa công trình thoát nước",
  // Công trình ATGT
  "Mất biển báo": "Bổ sung, thay thế biển báo",
  "Hỏng cọc tiêu": "Sửa chữa, thay thế cọc tiêu",
  "Hỏng hộ lan": "Sửa chữa hộ lan tôn sóng",
  "Mờ sơn": "Sơn lại vạch kẻ đường",
  "Mất cột Km": "Bổ sung, thay thế cột Km",
  // Phát cây
  "Che cột Km": "Phát cây thông thoáng cột Km",
  "Che cọc tiêu": "Phát cây thông thoáng cọc tiêu",
  "Che đầu cầu/cống": "Phát cây thông thoáng đầu cầu/cống",
  "Cây cỏ ven đường": "Phát cây, cắt cỏ ven đường",
  // Cầu
  "Nứt dầm": "Theo dõi, xử lý nứt dầm cầu",
  "Hỏng khe co giãn": "Sửa chữa khe co giãn",
  "Xói mố": "Xử lý xói lở mố cầu",
  "Võng dầm": "Theo dõi võng dầm cầu",
  "Nứt mới phát sinh": "Theo dõi, xử lý vết nứt mới",
  "Sạt bờ kè": "Sửa chữa, gia cố bờ kè"
};

/**
 * Nhận xét / biện pháp tự động theo từng hạng mục hư hỏng (cột 4 & 5 sổ BDTX).
 * Lấy từ danh mục chất lượng (tab "Dữ liệu BDTX"); dùng khi người dùng chưa nhập tay.
 */
export function autoQualityForType(type) {
  return getQualityForType(type);
}

const SIDE_LABELS = {
  T: "Làn trái",
  P: "Làn phải",
  "T+P": "Làn trái + phải",
  G: "Giữa tuyến",
  M: "Cả mặt đường"
};

export function formatSideLabel(side) {
  const key = String(side || "").trim().toUpperCase();
  return SIDE_LABELS[key] || "";
}

/** Chỉ cống (không phải rãnh): lý trình không ghi phía (Làn trái/phải). */
export function shouldOmitBaoDuongSide(entry) {
  return isCulvertDiaryEntry(entry);
}

export function addDays(isoDate, days) {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export function defaultPlannedRepairDate(incidentDate) {
  return addDays(incidentDate, 1);
}

export function maxPlannedRepairDate(incidentDate) {
  return addDays(incidentDate, BAO_DUONG_MAX_DAYS);
}

/** Số ngày deadline hợp lệ của loại công việc (>=0). */
function deadlineDaysForType(type) {
  const days = Number(getDeadlineDaysForType(type));
  if (!Number.isFinite(days) || days < 0) return BAO_DUONG_MAX_DAYS;
  return days;
}

/**
 * Ngày dự kiến sửa mặc định = ngày phát hiện + 1.
 * Hạn theo loại công việc chỉ giới hạn max trên lịch (maxPlannedRepairDateForType).
 */
export function plannedRepairDateForType(incidentDate, _type) {
  return defaultPlannedRepairDate(incidentDate);
}

/** Hạn cuối cho phép chọn ngày dự kiến sửa theo deadline của loại công việc. */
export function maxPlannedRepairDateForType(incidentDate, type) {
  const days = deadlineDaysForType(type);
  return addDays(incidentDate, days > 0 ? days : BAO_DUONG_MAX_DAYS);
}

export function validatePlannedRepairDate(incidentDate, plannedDate) {
  if (!plannedDate) return { ok: true };
  if (plannedDate < incidentDate) {
    return { ok: false, msg: "Ngày dự kiến sửa chữa không được trước ngày phát hiện." };
  }
  if (plannedDate > maxPlannedRepairDate(incidentDate)) {
    return {
      ok: false,
      msg: `Phải xử lý trong vòng ${BAO_DUONG_MAX_DAYS} ngày kể từ ngày phát hiện.`
    };
  }
  return { ok: true };
}

export function shouldExportBaoDuong(entry) {
  if (!isBaoDuongSection(entry.section)) return false;
  if (!entry.plannedRepairDate) return false;
  // Loại công việc khai báo "không sinh BDTX" thì không đưa sang sổ.
  if (!needMaintenanceForType(entry.type)) return false;
  // Sổ mặt đường (exportMatDuong) và sổ BDTX độc lập:
  // bỏ tick xuất sổ mặt đường vẫn hiện BDTX nếu đã chọn ngày xuất.
  return true;
}

/** Các loại công việc (type) đang xuất hiện trong sổ BDTX, không trùng. */
export function collectBaoDuongWorkTypes(entries) {
  const seen = new Set();
  const out = [];
  expandEntriesForVolumeBooks(entries || [])
    .map(migrateEntry)
    .filter((e) => shouldExportBaoDuong(e))
    .forEach((e) => {
      const t = String(e.type || "").trim();
      if (t && !seen.has(t)) {
        seen.add(t);
        out.push(t);
      }
    });
  return out;
}

export function filterBaoDuongEntries(entries, execDate) {
  return expandEntriesForVolumeBooks(entries || [])
    .map(migrateEntry)
    .filter((e) => shouldExportBaoDuong(e) && e.plannedRepairDate === execDate)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return String(a.kmFrom).localeCompare(String(b.kmFrom));
    });
}

/** Lọc BDTX theo khoảng ngày dự kiến sửa (plannedRepairDate). */
export function filterBaoDuongEntriesInRange(entries, fromIso, toIso) {
  const from = String(fromIso || "").trim();
  const to = String(toIso || "").trim();
  if (!from || !to || from > to) return [];
  return expandEntriesForVolumeBooks(entries || [])
    .map(migrateEntry)
    .filter(
      (e) =>
        shouldExportBaoDuong(e) &&
        e.plannedRepairDate >= from &&
        e.plannedRepairDate <= to
    )
    .sort((a, b) => {
      if (a.plannedRepairDate !== b.plannedRepairDate) {
        return a.plannedRepairDate.localeCompare(b.plannedRepairDate);
      }
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return String(a.kmFrom).localeCompare(String(b.kmFrom));
    });
}

/**
 * Gom BDTX theo từng ngày thực hiện (plannedRepairDate).
 * Nếu có periodFrom/periodTo: đủ mọi ngày trong khoảng (kể cả ngày không có việc).
 */
export function groupBaoDuongEntriesByExecDay(entries, periodFrom, periodTo) {
  const map = new Map();
  expandEntriesForVolumeBooks(entries || []).forEach((e) => {
    const d = String(e?.plannedRepairDate || "").trim();
    if (!d) return;
    if (!map.has(d)) map.set(d, []);
    map.get(d).push(e);
  });

  const from = String(periodFrom || "").trim();
  const to = String(periodTo || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to) && from <= to) {
    const dates = [];
    const start = new Date(`${from}T12:00:00`);
    const end = new Date(`${to}T12:00:00`);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split("T")[0]);
    }
    return dates.map((date) => ({
      periodFrom: date,
      periodTo: date,
      entries: map.get(date) || []
    }));
  }

  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, list]) => ({
      periodFrom: date,
      periodTo: date,
      entries: list
    }));
}

/** Hằng số bố cục A4 dọc — preview + in. */
export const BAO_DUONG_SHEET_LAYOUT = {
  sheetWidthMm: 210,
  sheetHeightMm: 297,
  /** Tiêu đề + thời gian + intro (trang đầu ngày). */
  topBlockMm: 42,
  /** Trang tiếp (không tiêu đề): chỉ chừa sát bảng. */
  contTopBlockMm: 2,
  theadMm: 20,
  /**
   * Khối ký (trong vùng nội dung, dưới bảng) — CSS flow:
   * «Hạt trưởng» + cách 24,5mm (0,7 × 35) + tên 13pt + đệm nhỏ ≈ 40mm.
   */
  signNameGapMm: 24.5,
  /** Khi co hàng: khoảng «Hạt trưởng» → tên (0,7 × 25mm). */
  signNameGapCompressedMm: 17.5,
  signRoleMm: 6,
  signNameLineMm: 7,
  signPadAfterNameMm: 2,
  /** @deprecated dùng baoDuongSignBlockMm() */
  signBlockMm: 40,
  /** «Hạt trưởng» → mép dưới giấy (lề + khối ký). */
  signFromBottomMm: 55,
  /** Một dòng 12pt + padding ô — không ép hàng thấp hơn chữ. */
  dataRowMinMm: 8,
  /** Hàng tiêu đề nhánh khi gộp đường. */
  routeHeaderMm: 8,
  emptyRowMm: 11,
  /** Không co ước lượng — chữ 12pt wrap cao hơn ASCII. */
  rowHeightScale: 1,
  minEmptyRows: 3,
  safetyMm: 8,
  /** Dự phòng ước lượng thấp — tờ có ký bớt ~1 hàng trống. */
  signSlackMm: 12,
  /** Không co hàng để nhét thêm dòng (tràn lề dưới). */
  rowCompressMin: 1,
  /** Không kéo cao hàng cho kín tờ — hàng vừa chữ trong ô. */
  rowStretchMax: 1
};

/** Chiều cao khối ký (mm) trong vùng nội dung. */
export function baoDuongSignBlockMm() {
  const L = BAO_DUONG_SHEET_LAYOUT;
  return (
    L.signRoleMm + L.signNameGapMm + L.signNameLineMm + L.signPadAfterNameMm
  );
}

export function baoDuongBodyBudgetMm(
  margins,
  { withSign = false, withTitle = true } = {}
) {
  const L = BAO_DUONG_SHEET_LAYOUT;
  const padTop = Number(margins?.top) || 0;
  const padBottom = Number(margins?.bottom) || 0;
  const top = withTitle ? L.topBlockMm : L.contTopBlockMm;
  // Tờ có ký: trừ lề dưới + cả khối ký (flow) — tránh trừ trùng / thiếu chỗ tên.
  const bottomReserve = withSign
    ? padBottom + baoDuongSignBlockMm()
    : padBottom;
  const safety = withSign ? L.safetyMm + L.signSlackMm : L.safetyMm;
  return Math.max(
    40,
    L.sheetHeightMm - padTop - bottomReserve - top - L.theadMm - safety
  );
}

export function estimateBaoDuongDataRowMm(entry, index = 0) {
  const L = BAO_DUONG_SHEET_LAYOUT;
  const scale = Number(L.rowHeightScale) > 0 ? Number(L.rowHeightScale) : 1;
  const r = entryToBaoDuongRow(entry, index);

  function countLines(text, charsPerLine) {
    if (!text) return 1;
    let n = 0;
    String(text)
      .split("\n")
      .forEach((line) => {
        n += Math.max(1, Math.ceil(Math.max(line.length, 1) / charsPerLine));
      });
    return Math.max(1, n);
  }

  const lines = Math.max(
    countLines(r.work, 13),
    countLines(r.viTri, 17),
    countLines(r.measureSummary, 15),
    countLines(r.mainResult, 26)
  );
  // 12pt × line-height ~1,05 ≈ 4,6mm/dòng + padding dọc. Không cộng sẵn 12mm.
  const rawMm = Math.max(L.dataRowMinMm, 2.2 + lines * 4.65);
  return rawMm * scale;
}

export function estimateBaoDuongBlockMm(block) {
  if (!block) return 0;
  const L = BAO_DUONG_SHEET_LAYOUT;
  const scale = Number(L.rowHeightScale) > 0 ? Number(L.rowHeightScale) : 1;
  if (block.kind === "routeHeader") {
    return (L.routeHeaderMm || 8) * scale;
  }
  return estimateBaoDuongDataRowMm(block.entry, Math.max(0, (block.stt || 1) - 1));
}

/**
 * Khi gộp ≥2 nhánh: nhóm theo tên đường (cùng tên gộp km) + tiêu đề đoạn.
 * Tách 1 nhánh: vẫn hiện tiêu đề đoạn đang xem.
 */
const BAO_DUONG_ROUTE_OPTS = { forceRouteHeadings: true };

export function groupBaoDuongEntriesByRouteSections(entries, road, viewOpts = {}) {
  return buildRouteDisplayBlocks(entries, road, viewOpts, BAO_DUONG_ROUTE_OPTS)
    .reduce((sections, block) => {
      if (block.kind === "routeHeader") {
        sections.push({ heading: block.heading, routeId: block.routeId, entries: [] });
        return sections;
      }
      if (!sections.length) {
        sections.push({ heading: null, routeId: block.routeId || "", entries: [] });
      }
      sections[sections.length - 1].entries.push(block.entry);
      return sections;
    }, []);
}

/** Hàng render: tiêu đề nhánh + dòng công việc (STT liên tục cả sổ). */
export function buildBaoDuongDisplayBlocks(entries, road, viewOpts = {}) {
  return buildRouteDisplayBlocks(entries, road, viewOpts, BAO_DUONG_ROUTE_OPTS);
}

/**
 * Bố cục hàng trên 1 tờ:
 * - Không co và không kéo cao hàng (hàng vừa chữ trong ô).
 * - Tờ giữa: không chèn hàng trống.
 * - Tờ cuối có ký / tờ trống: mới dùng hàng trống pad.
 * @param {array} entriesOrBlocks — entries thuần hoặc blocks (routeHeader + entry)
 */
export function computeBaoDuongRowLayout(entriesOrBlocks, margins, opts = {}) {
  const L = BAO_DUONG_SHEET_LAYOUT;
  const withSign = opts.withSign !== false;
  const withTitle = opts.withTitle !== false;
  /** Tờ còn trang sau (không phải tờ cuối của ngày) — không chèn hàng trống. */
  const hasMorePages = opts.hasMorePages === true;
  const budgetMm = baoDuongBodyBudgetMm(margins, { withSign, withTitle });
  const list = entriesOrBlocks || [];
  const isBlock = list.some((x) => x && (x.kind === "entry" || x.kind === "routeHeader"));
  const naturalMm = list.reduce((sum, item, i) => {
    if (isBlock) return sum + estimateBaoDuongBlockMm(item);
    return sum + estimateBaoDuongDataRowMm(item, i);
  }, 0);

  const rowScale = 1;
  const usedMm = naturalMm * rowScale;
  const remainMm = Math.max(0, budgetMm - usedMm);
  const signNameGapMm =
    rowScale < 1 ? L.signNameGapCompressedMm || 17.5 : L.signNameGapMm || 24.5;
  const heightScale = Number(L.rowHeightScale) > 0 ? Number(L.rowHeightScale) : 1;
  const emptyRowMm = L.emptyRowMm * heightScale;

  // Tờ giữa có dữ liệu: không hàng trống.
  if (hasMorePages && list.length > 0) {
    return { count: 0, rowHeightMm: emptyRowMm, rowScale, signNameGapMm };
  }

  if (remainMm < 3 || rowScale < 1) {
    return { count: 0, rowHeightMm: emptyRowMm, rowScale, signNameGapMm };
  }

  let count = Math.floor(remainMm / emptyRowMm);
  if (withSign && count > 0) count -= 1;
  while (
    withSign &&
    count > 0 &&
    usedMm + count * emptyRowMm + L.signSlackMm > budgetMm
  ) {
    count -= 1;
  }

  if (!list.length) {
    count = Math.max(count, withSign ? Math.min(L.minEmptyRows, 2) : L.minEmptyRows);
  } else {
    count = Math.max(0, count);
  }
  return { count, rowHeightMm: emptyRowMm, rowScale, signNameGapMm };
}

/** Tương thích cũ — trả về count / rowHeightMm / rowScale. */
export function computeBaoDuongPadRows(entries, margins, opts = {}) {
  return computeBaoDuongRowLayout(entries, margins, opts);
}

/**
 * Chia sổ BDTX thành các tờ A4 dọc trong 1 ngày.
 * @param entries — danh sách công việc
 * @param margins
 * @param viewCtx — { road, routesViewMode, activeRouteId, titleRouteIds } để tách tiêu đề nhánh khi gộp
 * @returns {Array<Array<block>>} mỗi tờ = mảng block (routeHeader | entry)
 */
export function packBaoDuongPages(entries, margins, viewCtx = null) {
  const blocks =
    viewCtx?.road
      ? buildBaoDuongDisplayBlocks(entries, viewCtx.road, viewCtx)
      : (entries || []).map((entry, i) => ({
          kind: "entry",
          entry,
          stt: i + 1,
          key: `e-${i}`
        }));

  if (!blocks.length) return [[]];

  const heightOf = (b) => estimateBaoDuongBlockMm(b);

  // Đủ 1 tờ kể cả khối ký thì không tách.
  const singleBudget = baoDuongBodyBudgetMm(margins, {
    withSign: true,
    withTitle: true
  });
  const totalMm = blocks.reduce((s, b) => s + heightOf(b), 0);
  if (totalMm <= singleBudget) return [blocks];

  const pages = [];
  let idx = 0;
  let pageIndex = 0;

  while (idx < blocks.length) {
    const isFirst = pageIndex === 0;
    const budget = baoDuongBodyBudgetMm(margins, {
      withSign: false,
      withTitle: isFirst
    });
    const bucket = [];
    let used = 0;
    while (idx < blocks.length) {
      const item = blocks[idx];
      const h = heightOf(item);
      // Không để tiêu đề nhánh đứng một mình cuối tờ nếu còn công việc sau.
      if (
        bucket.length > 0 &&
        item.kind === "routeHeader" &&
        used + h > budget * 0.85
      ) {
        break;
      }
      if (bucket.length > 0 && used + h > budget) {
        break;
      }
      if (bucket.length === 0 && h > budget) {
        bucket.push(item);
        idx += 1;
        break;
      }
      bucket.push(item);
      used += h;
      idx += 1;
    }
    pages.push(bucket);
    pageIndex += 1;
  }

  // Tờ cuối phải vừa budget có chữ ký — chuyển hàng thừa sang tờ mới.
  let guard = 0;
  while (guard < 80) {
    guard += 1;
    const lastIdx = pages.length - 1;
    const last = pages[lastIdx];
    if (!last.length) break;
    const isFirst = lastIdx === 0;
    const budget = baoDuongBodyBudgetMm(margins, {
      withSign: true,
      withTitle: isFirst
    });
    const lastUsed = last.reduce((s, b) => s + heightOf(b), 0);
    if (lastUsed <= budget) break;
    if (last.length === 1) break;
    const moved = last.pop();
    if (!pages[lastIdx + 1]) pages.push([]);
    pages[lastIdx + 1].unshift(moved);
  }

  let cleaned = pages.filter((p) => p.length > 0);
  while (
    cleaned.length >= 2 &&
    cleaned[cleaned.length - 1].length === 0 &&
    cleaned[cleaned.length - 2].length > 0
  ) {
    cleaned[cleaned.length - 1].push(cleaned[cleaned.length - 2].pop());
    cleaned = cleaned.filter((p) => p.length > 0);
  }
  return cleaned.length ? cleaned : [[]];
}

export function countBaoDuongEntryBlocks(blocks) {
  return (blocks || []).filter((b) => b?.kind === "entry").length;
}

export function formatKmCell(value) {
  if (!value && value !== 0) return "";
  return `Km${formatLyTrinh(value)}`;
}

export function formatWorkName(type) {
  if (!type) return "";
  const maintenance = getMaintenanceNameForType(type);
  if (maintenance) return maintenance;
  return WORK_NAMES[type] || String(type).replace(/^xử\s*lý\s+/i, "").trim() || type;
}

/**
 * Tên cột 2 sổ BDTX — cùng nguồn với thống kê KL.
 * Thử type rồi sourceIncidentType trên danh mục (cột Công việc BDTX).
 */
export function formatWorkNameFromEntry(entry) {
  const e = migrateEntry(entry || {});
  const type = String(e.type || "").trim();
  const source = String(e.sourceIncidentType || "").trim();
  // Nền đường: khôi phục đúng loại từ source khi type bị gộp «Sụt lún».
  const candidates = [];
  if (e.section === "Nền đường" && type === "Sụt lún" && /^sa\s*bồi/i.test(source)) {
    candidates.push(source, type);
  } else {
    if (type) candidates.push(type);
    if (source && source !== type) candidates.push(source);
  }
  for (const candidate of candidates) {
    const maintenance = getMaintenanceNameForType(candidate);
    if (maintenance) return maintenance;
  }
  const primary = candidates[0] || "";
  if (!primary) return "";
  if (WORK_NAMES[primary]) return WORK_NAMES[primary];
  // Không ghép «Xử lý + loại tuần đường» — cột Đầu việc = Công việc BDTX.
  return primary.replace(/^xử\s*lý\s+/i, "").trim() || primary;
}

export function formatUnitLabel(unit) {
  if (unit === "m2") return "m²";
  if (unit === "m3") return "m³";
  return unit || "";
}

/** Dòng "Khối lượng thực hiện" theo mẫu sổ BDTX. */
export function formatQuantityLine(entry) {
  const unit = normalizeUnitValue(entry?.unit);
  const label = formatUnitLabel(unit || entry?.unit);
  const l = formatBookDecimal(entry?.length);
  const w = formatBookDecimal(entry?.width);
  const h = formatBookDecimal(entry?.height);
  const qFmt = formatBookDecimal(entry?.quantity);

  if (unit === "m2") {
    const area = qFmt || formatBookDecimal(calcAreaM2(entry)) || "…";
    if (l && w) {
      return `- Khối lượng thực hiện: ${l} x ${w} = ${area} ${label}`;
    }
    return `- Khối lượng thực hiện: ${area} ${label}`.trim();
  }

  if (unit === "m3") {
    let vol = qFmt;
    if (!vol) {
      const ln = parseBookNumber(entry?.length);
      const wn = parseBookNumber(entry?.width);
      const hn = parseBookNumber(entry?.height);
      if (ln > 0 && wn > 0 && hn > 0) {
        vol = formatBookDecimal(ln * wn * hn);
      }
    }
    vol = vol || "…";
    if (l && w && h) {
      return `- Khối lượng thực hiện: ${l} x ${w} x ${h} = ${vol} ${label}`;
    }
    return `- Khối lượng thực hiện: ${vol} ${label}`.trim();
  }

  if (qFmt) {
    return `- Khối lượng thực hiện: ${qFmt} ${label}`.trim();
  }
  return `- Khối lượng thực hiện: … ${label}`.trim();
}

export function formatMainResult(entry) {
  if (entry.mainResult?.trim()) return entry.mainResult.trim();
  const parts = [formatQuantityLine(entry)];
  if (entry.resolved?.trim()) {
    parts.push(`- ${entry.resolved.trim()}`);
  } else {
    parts.push(`- ${autoQualityForType(entry.type).result}`);
  }
  return parts.join("\n");
}

function baoDuongSideCode(side) {
  const key = String(side || "").trim().toUpperCase();
  if (!key) return "";
  if (key === "P" || key === "T" || key === "G" || key === "M") return key;
  if (key === "T+P" || key === "P+T" || key === "TP" || key === "PT") return "T+P";
  return "";
}

/** Cầu, cống, biển, cột, đơn vị đếm: một lý trình. Không suy km cuối từ chiều dài. */
function isPointBaoDuongEntry(entry) {
  const e = migrateEntry(entry);
  if (isCulvertDiaryEntry(e)) return true;
  const section = String(e.section || "").trim();
  if (
    section === "Công trình cầu" ||
    section === "Công trình an toàn giao thông" ||
    section === "Cột mốc GP mặt bằng, lộ giới"
  ) {
    return true;
  }
  const type = `${e.type || ""} ${e.sourceIncidentType || ""}`;
  if (/biển|cột|cọc|hộ lan|lan can/i.test(type) && !/rãnh/i.test(type)) return true;
  return isCountUnit(formatUnitLabel(e.unit));
}

/** Cột (3): giống biên bản nghiệm thu — «Km0+570 (P)», không ghi làn trái/phải. */
export function formatViTri(entry) {
  const e = migrateEntry(entry);
  const from = String(formatKmCell(e.kmFrom) || "").trim();
  const to = isPointBaoDuongEntry(e)
    ? ""
    : String(formatKmCell(e.kmTo) || "").trim();
  let km = from && to && from !== to ? `${from} - ${to}` : from || to || "";
  const side = baoDuongSideCode(e.side);
  if (km && side) km += ` (${side})`;
  return km;
}

export function formatMethodSummary(entry) {
  if (entry.measureSummary?.trim()) return entry.measureSummary.trim();
  return autoQualityForType(entry.type).method;
}

/**
 * Cùng ngày sổ tuần đường = ngày BDTX → cột 4 dòng chi tiết: Đã xử lý: tên BD, KL.
 * Khác ngày → 1 dòng nhận xét Hạt trưởng ở hàng BDTX khác ngày đầu tiên trong ngày.
 */
export function isBaoDuongSameDiaryDay(entry) {
  if (!shouldExportBaoDuong(entry)) return false;
  const diary = String(entry?.date || "").trim();
  const bdtx = String(entry?.plannedRepairDate || "").trim();
  return Boolean(diary && bdtx && diary === bdtx);
}

export function isBaoDuongDeferredDiaryDay(entry) {
  if (!shouldExportBaoDuong(entry)) return false;
  const diary = String(entry?.date || "").trim();
  const bdtx = String(entry?.plannedRepairDate || "").trim();
  return Boolean(diary && bdtx && diary !== bdtx);
}

function formatDiaryQuantityShort(entry) {
  const e = migrateEntry(entry);
  const q = formatBookDecimal(e.quantity);
  if (q) {
    return `${q} ${formatUnitLabel(e.unit)}`.trim();
  }
  const area = formatBookDecimal(calcAreaM2(e));
  if (area) return `${area} m²`;
  return "";
}

/** Cột 4 nhật ký khi xử lý trong ngày (cùng ngày BDTX). */
export function buildBaoDuongSameDayResolved(entry) {
  const e = migrateEntry(entry);
  const work = formatWorkNameFromEntry(e);
  const qty = formatDiaryQuantityShort(e);
  if (work && qty) return `Đã xử lý: ${work}, ${qty}`;
  if (work) return `Đã xử lý: ${work}`;
  if (qty) return `Đã xử lý: ${qty}`;
  return "Đã xử lý";
}

/** Nhận xét hoãn BDTX (khác ngày sổ tuần đường). Hạn = ngày sổ + 3 ngày. */
export function buildBaoDuongDeferredNote(entry) {
  const e = migrateEntry(entry);
  if (!isBaoDuongDeferredDiaryDay(e)) return "";
  const diary = String(e.date || "").trim();
  if (!diary) return "";
  const deadline = addDays(diary, 3);
  return `Yêu cầu đội thực hiện các tồn tại trong thời gian quy định và xong trước ngày ${formatDisplayDate(deadline)}`;
}

/** @deprecated */
export function buildBaoDuongDeferredNoteForGroup(groupEntries) {
  const deferred = (groupEntries || [])
    .map(migrateEntry)
    .filter((e) => isBaoDuongDeferredDiaryDay(e));
  if (!deferred.length) return "";
  return buildBaoDuongDeferredNote(deferred[0]);
}

/**
 * Cột 5: chỉ 1 dòng nhận xét ở hàng BDTX khác ngày đầu tiên (theo thứ tự duyệt).
 * `alreadyPlaced` — đã ghi nhận xét ở hạng mục trước trong cùng ngày.
 * Trả về { anns, placed }.
 */
export function annotateDeferredLeaderNotes(sectionItems, { alreadyPlaced = false } = {}) {
  const items = (sectionItems || []).map(migrateEntry);
  let placed = Boolean(alreadyPlaced);
  const anns = items.map((e) => {
    if (!isBaoDuongDeferredDiaryDay(e)) {
      return {
        note: String(e.leaderNote || "").trim(),
        rowspan: 1,
        skipLeader: false,
        deferredLocked: false,
        hatSignAnchor: false
      };
    }
    const custom = String(e.leaderNote || "").trim();
    if (custom) {
      return {
        note: custom,
        rowspan: 1,
        skipLeader: false,
        deferredLocked: false,
        hatSignAnchor: false
      };
    }
    if (placed) {
      return {
        note: "",
        rowspan: 1,
        skipLeader: false,
        deferredLocked: true,
        hatSignAnchor: false
      };
    }
    placed = true;
    return {
      note: buildBaoDuongDeferredNote(e),
      rowspan: 1,
      skipLeader: false,
      deferredLocked: true,
      hatSignAnchor: true
    };
  });
  return { anns, placed };
}

/** @deprecated dùng annotateDeferredLeaderNotes */
export function annotateDeferredTypeGroups(sectionItems, opts) {
  return annotateDeferredLeaderNotes(sectionItems, opts).anns;
}

/** @deprecated */
export function buildBaoDuongSectionDeferredNote(sectionEntries) {
  return buildBaoDuongDeferredNoteForGroup(sectionEntries);
}

/** Cột 4 sổ tuần đường (ưu tiên quy tắc BDTX cùng ngày). */
export function formatNhatKyResolvedCol(entry) {
  const e = migrateEntry(entry);
  if (isBaoDuongSameDiaryDay(e)) return buildBaoDuongSameDayResolved(e);
  return String(e.resolved || e.solution || "").trim();
}

/** Cột 5 — nhận xét hoãn BDTX do annotate gắn ở hàng đầu; không tự gắn từng dòng. */
export function formatNhatKyLeaderNoteCol(entry) {
  const e = migrateEntry(entry);
  const note = String(e.leaderNote || "").trim();
  if (note) return note;
  if (isBaoDuongDeferredDiaryDay(e)) return buildBaoDuongDeferredNote(e);
  return "";
}

/** Gắn sẵn cột 4 khi BDTX cùng ngày. Nhận xét Hạt trưởng (cột 5) giữ nguyên. */
export function applyBaoDuongDiaryNotes(entry) {
  const e = migrateEntry(entry);
  if (!shouldExportBaoDuong(e)) return e;
  if (isBaoDuongSameDiaryDay(e)) {
    return {
      ...e,
      resolved: buildBaoDuongSameDayResolved(e)
    };
  }
  return e;
}

export function entryToBaoDuongRow(entry, index) {
  return {
    stt: index + 1,
    work: formatWorkNameFromEntry(entry),
    viTri: formatViTri(entry),
    measureSummary: formatMethodSummary(entry),
    mainResult: formatMainResult(entry),
    incidentDate: formatDisplayDate(entry.date)
  };
}

export function formatBaoDuongWeather(dayMeta) {
  const { weather } = parseDayWeather(dayMeta?.weather || "");
  return weather || "";
}
