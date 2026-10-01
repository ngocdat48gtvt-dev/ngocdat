import {
  addMetersToKm,
  formatDisplayDate,
  formatLocationCol,
  normalizeKmInput,
  HANH_LANG_SECTION,
  isHanhLangSectionTitle
} from "./nhatKyFormat";
import { formatBookKmTitleLine } from "./roadsCatalog";
import { formatBookDecimal } from "./bookNumberFormat";

export { HANH_LANG_SECTION, isHanhLangSectionTitle };

/** Các cột nhập trên sổ (trừ TT tự đánh số). */
export const HANH_LANG_SHEET_FIELDS = [
  { key: "recorder", label: "Người lập biên bản", multiline: false },
  { key: "violator", label: "Tổ chức / cá nhân vi phạm", multiline: false },
  { key: "address", label: "Địa chỉ", multiline: false },
  { key: "location", label: "Lý trình", multiline: false },
  { key: "recordDate", label: "Ngày lập biên bản", multiline: false },
  { key: "content", label: "Nội dung vi phạm", multiline: true },
  { key: "area", label: "Diện tích vi phạm", multiline: false },
  { key: "process", label: "Theo dõi xử lý", multiline: true },
  { key: "note", label: "Ghi chú", multiline: true }
];

export function defaultExportHanhLang() {
  return true;
}

export function shouldExportHanhLang(entry) {
  if (!isHanhLangSectionTitle(entry?.section)) return false;
  if (entry.exportHanhLang === false) return false;
  return entry.exportHanhLang !== false;
}

export function entryInMonth(entry, yearMonth) {
  if (!yearMonth) return false;
  const d = entry?.hlRecordDate || entry?.date;
  return String(d || "").startsWith(yearMonth);
}

export function filterHanhLangEntries(entries, yearMonth, opts = {}) {
  const { filterByRouteView } = opts;
  const base = (entries || []).filter(
    (e) => shouldExportHanhLang(e) && entryInMonth(e, yearMonth)
  );
  const scoped = typeof filterByRouteView === "function" ? filterByRouteView(base) : base;
  return scoped.sort((a, b) => {
    const da = a.hlRecordDate || a.date;
    const db = b.hlRecordDate || b.date;
    if (da !== db) return da.localeCompare(db);
    return String(a.kmFrom || "").localeCompare(String(b.kmFrom || ""));
  });
}

export function formatHanhLangKmLine(reportMeta) {
  return formatBookKmTitleLine(reportMeta);
}

/** Tiêu đề tháng trong dòng «THÁNG …/20…». */
export function formatHanhLangMonthTitle(yearMonth) {
  const [y, m] = yearMonth.split("-").map(Number);
  if (!y || !m) return yearMonth;
  return `THÁNG ${String(m).padStart(2, "0")}/${y}`;
}

function formatViolationContent(entry) {
  const content = entry?.content?.trim();
  if (content) return content;
  return entry?.type?.trim() || "";
}

function formatAreaCell(entry) {
  const l = formatBookDecimal(entry?.length);
  const w = formatBookDecimal(entry?.width);
  if (l && w) return `${l}*${w}`;
  const q = formatBookDecimal(entry?.quantity);
  if (q && entry?.unit) {
    const unit = String(entry.unit).replace(/m²|m2/gi, "").trim();
    return unit ? `${q} ${unit}` : q;
  }
  if (q) return q;
  return "";
}

/** Hằng số bố cục trang A4 ngang — hàng tối thiểu vừa chữ Times 12pt. */
export const HANH_LANG_SHEET_LAYOUT = {
  sheetWidthMm: 297,
  sheetHeightMm: 210,
  paddingVerticalMm: 22,
  topBlockMm: 48,
  theadMm: 18,
  footerMm: 8,
  /** 1 dòng 12pt × line-height 1.25 ≈ 5.3mm + padding nhẹ */
  dataRowMinMm: 5.5,
  emptyRowMm: 5.5,
  lineMm: 5.3,
  minEmptyRows: 2,
  safetyMm: 10
};

export function hanhLangBodyBudgetMm(margins) {
  const L = HANH_LANG_SHEET_LAYOUT;
  const padV =
    margins != null
      ? (Number(margins.top) || 0) + (Number(margins.bottom) || 0)
      : L.paddingVerticalMm;
  return Math.max(
    40,
    L.sheetHeightMm - padV - L.topBlockMm - L.theadMm - L.footerMm - L.safetyMm
  );
}

/** Số hàng trống vừa đủ 1 trang (chữ 12pt). */
export function hanhLangRowsPerPage(margins) {
  const L = HANH_LANG_SHEET_LAYOUT;
  return Math.max(1, Math.floor(hanhLangBodyBudgetMm(margins) / L.emptyRowMm));
}

function estimateTextLines(text, charsPerLine = 32) {
  const raw = String(text || "");
  if (!raw.trim()) return 1;
  return raw.split("\n").reduce((sum, line) => {
    const len = line.length || 1;
    return sum + Math.max(1, Math.ceil(len / charsPerLine));
  }, 0);
}

export function estimateHanhLangDataRowMm(entry) {
  const L = HANH_LANG_SHEET_LAYOUT;
  const content = entry?.content || entry?.type || "";
  const process = entry?.hlProcessNote || entry?.resolved || "";
  const note = entry?.hlNote || entry?.inspectorNote || "";
  const violator = entry?.hlViolator || "";
  const address = entry?.hlAddress || "";
  const maxLines = Math.max(
    estimateTextLines(content, 36),
    estimateTextLines(process, 32),
    estimateTextLines(note, 18),
    estimateTextLines(violator, 16),
    estimateTextLines(address, 16),
    1
  );
  return L.dataRowMinMm + (maxLines - 1) * L.lineMm;
}

/**
 * Số dòng trống + chiều cao mỗi dòng để lấp phần còn lại của 1 trang.
 * Chiều cao hàng trống cố định (12pt), không kéo giãn thưa.
 */
export function computeHanhLangPadRows(entries, margins) {
  const L = HANH_LANG_SHEET_LAYOUT;
  const budgetMm = hanhLangBodyBudgetMm(margins);
  const dataMm = (entries || []).reduce((sum, e) => sum + estimateHanhLangDataRowMm(e), 0);
  const remainMm = Math.max(0, budgetMm - dataMm);
  const rowHeightMm = L.emptyRowMm;

  if (remainMm < rowHeightMm * 0.6) {
    return { count: 0, rowHeightMm };
  }

  let count = Math.floor(remainMm / rowHeightMm);
  if (!entries?.length) {
    count = Math.max(count, hanhLangRowsPerPage(margins));
  } else if (count < 1 && remainMm >= rowHeightMm * 0.5) {
    count = 1;
  }
  return { count: Math.max(0, count), rowHeightMm };
}

/** Chia dòng dữ liệu thành nhiều tờ A4 ngang. */
export function packHanhLangPages(entries, margins) {
  const budgetMm = hanhLangBodyBudgetMm(margins);
  const list = entries || [];
  if (!list.length) return [[]];

  const pages = [];
  let bucket = [];
  let used = 0;
  list.forEach((entry) => {
    const h = estimateHanhLangDataRowMm(entry);
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

/**
 * Chia rowItems (có thể kèm dòng trống cuối) thành nhiều tờ màn hình/in.
 * Dòng trống chỉ gắn tờ cuối để nhập tiếp.
 */
export function packHanhLangEditPages(rowItems, margins) {
  const items = rowItems || [];
  const filled = [];
  items.forEach((item, idx) => {
    if (isHanhLangSheetRowFilled(item.entry)) {
      filled.push({ item, absIndex: idx });
    }
  });

  if (!filled.length) {
    const { count, rowHeightMm } = computeHanhLangPadRows([], margins);
    return [
      {
        rows: [],
        emptyCount: count,
        rowHeightMm,
        sttOffset: 0,
        emptyAbsStart: 0,
        isLast: true,
        pageIndex: 0
      }
    ];
  }

  const entryPages = packHanhLangPages(
    filled.map((f) => f.item.entry),
    margins
  );

  let cursor = 0;
  return entryPages.map((chunk, pageIndex) => {
    const rows = filled.slice(cursor, cursor + chunk.length);
    cursor += chunk.length;
    const isLast = pageIndex === entryPages.length - 1;
    const { count, rowHeightMm } = computeHanhLangPadRows(chunk, margins);
    const emptyAbsStart = isLast
      ? (filled[filled.length - 1]?.absIndex ?? -1) + 1
      : -1;
    return {
      rows,
      emptyCount: isLast ? count : computeHanhLangPadRows(chunk, margins).count,
      rowHeightMm,
      sttOffset: filled.slice(0, cursor - chunk.length).length,
      emptyAbsStart,
      isLast,
      pageIndex
    };
  });
}

/** Số dòng trống cần giữ ở cuối danh sách nhập (đủ lấp tờ cuối). */
export function hanhLangTrailingEmptyCount(filledEntries, margins) {
  const pages = packHanhLangPages(filledEntries, margins);
  const last = pages[pages.length - 1] || [];
  const { count } = computeHanhLangPadRows(last, margins);
  return Math.max(HANH_LANG_SHEET_LAYOUT.minEmptyRows, count);
}

/** Nội dung cột 3 sổ tuần đường (trang 1) từ form hành lang. */
export function formatHanhLangDiaryContent(entry) {
  const violator = String(entry?.hlViolator || "").trim();
  const address = String(entry?.hlAddress || entry?.locationNote || "").trim();
  let content = String(entry?.content || "").trim();
  // «Đào móng…» → «đào móng…» khi nối sau địa chỉ.
  if (content) {
    content = content.charAt(0).toLocaleLowerCase("vi") + content.slice(1);
  }

  let line = "Gia đình ông (bà)";
  if (violator) line += ` ${violator}`;
  if (address) line += `, ${address}`;
  if (content) line += ` ${content}`;
  return line.trim();
}

/** Một dòng sổ hành lang — 10 cột Phụ lục 05 QL37. */
export function entryToHanhLangRow(entry, index) {
  const noteParts = [entry?.hlNote, entry?.inspectorNote].filter((s) => s?.trim());

  return {
    tt: index + 1,
    recorder: entry?.hlRecorder?.trim() || entry?.dutyPerson?.trim() || "",
    violator: entry?.hlViolator?.trim() || "",
    address: entry?.hlAddress?.trim() || entry?.locationNote?.trim() || "",
    location: formatLocationCol(entry),
    recordDate: formatDisplayDate(entry?.hlRecordDate || entry?.date),
    content: formatViolationContent(entry),
    area: formatAreaCell(entry),
    process: entry?.hlProcessNote?.trim() || entry?.resolved?.trim() || "",
    note: noteParts.join(". ")
  };
}

export const EMPTY_HANH_LANG_QUICK_ROW = {
  time: "",
  kmFrom: "",
  kmTo: "",
  side: "",
  hlRecorder: "",
  hlViolator: "",
  hlAddress: "",
  content: "",
  length: "",
  width: "",
  resolved: "",
  hlNote: "",
  exportHanhLang: true,
  routeId: "",
  roadName: ""
};

export function makeEmptyHanhLangRows(count = 6) {
  return Array.from({ length: count }, () => ({ ...EMPTY_HANH_LANG_QUICK_ROW }));
}

function toNum(v) {
  return Number(String(v ?? "").replace(",", ".")) || 0;
}

/** Lý trình cuối = đầu + dài (m). Không có dài thì trùng điểm đầu. */
export function resolveHanhLangKmTo(kmFrom, length) {
  const from = normalizeKmInput(kmFrom);
  if (!from) return "";
  const lengthM = toNum(length);
  if (lengthM > 0) return addMetersToKm(from, lengthM);
  return from;
}

/** Chuẩn hoá kmFrom / kmTo khi lưu dòng hành lang. */
export function withHanhLangKmTo(entry) {
  if (!isHanhLangSectionTitle(entry?.section)) return entry;
  const kmFrom = normalizeKmInput(entry.kmFrom);
  return {
    ...entry,
    kmFrom,
    kmTo: resolveHanhLangKmTo(kmFrom, entry.length)
  };
}

/** Dựng các dòng hành lang từ bảng nhập nhanh → ghi nhật ký + sổ theo dõi. */
export function buildHanhLangEntriesFromRows(rows, date, routeDefaults = {}) {
  const errors = [];
  const entries = [];
  const defaultRouteId = String(routeDefaults.routeId || "").trim();
  const defaultRoadName = String(routeDefaults.roadName || "").trim();

  (rows || []).forEach((row, i) => {
    const hasData = [
      row?.kmFrom,
      row?.content,
      row?.hlViolator,
      row?.hlRecorder,
      row?.hlAddress,
      row?.length
    ].some((v) => String(v ?? "").trim());
    if (!hasData) return;
    if (!String(row?.kmFrom ?? "").trim() && !String(row?.content ?? "").trim()) {
      errors.push(`Dòng ${i + 1}: cần lý trình hoặc nội dung vi phạm.`);
      return;
    }

    const l = toNum(row?.length);
    const w = toNum(row?.width);
    const resolved = String(row?.resolved ?? "").trim();
    const kmFrom = normalizeKmInput(row?.kmFrom);
    const kmTo = resolveHanhLangKmTo(kmFrom, row?.length);
    const routeId = String(row?.routeId || defaultRouteId || "").trim();
    const roadName = String(row?.roadName || defaultRoadName || "").trim();
    const entry = {
      section: HANH_LANG_SECTION,
      date,
      time: String(row?.time ?? "").trim(),
      kmFrom,
      kmTo,
      side: row?.side || "P",
      hlRecorder: String(row?.hlRecorder ?? "").trim(),
      hlViolator: String(row?.hlViolator ?? "").trim(),
      hlAddress: String(row?.hlAddress ?? "").trim(),
      content: String(row?.content ?? "").trim(),
      length: row?.length ?? "",
      width: row?.width ?? "",
      unit: "m2",
      quantity: l && w ? Math.round(l * w * 100) / 100 : 0,
      resolved,
      hlProcessNote: resolved,
      hlNote: String(row?.hlNote ?? "").trim(),
      exportHanhLang: row?.exportHanhLang !== false,
      hlRecordDate: date,
      ...(routeId ? { routeId } : {}),
      ...(roadName ? { roadName } : {})
    };
    if (Number.isInteger(row?._editIndex)) entry._editIndex = row._editIndex;
    entries.push(entry);
  });

  if (!entries.length) {
    return {
      entries: [],
      errors: errors.length ? errors : ["Không có dòng hợp lệ (cần lý trình hoặc nội dung)."]
    };
  }
  return { entries, errors };
}

export function migrateHanhLangFields(entry) {
  const isHanhLang = isHanhLangSectionTitle(entry?.section);
  return {
    exportHanhLang: entry.exportHanhLang ?? (isHanhLang ? defaultExportHanhLang() : false),
    hlRecorder: entry.hlRecorder ?? "",
    hlViolator: entry.hlViolator ?? "",
    hlAddress: entry.hlAddress ?? "",
    hlRecordDate: entry.hlRecordDate || entry.date || "",
    hlProcessNote: entry.hlProcessNote ?? entry.resolved ?? "",
    hlNote: entry.hlNote ?? entry.inspectorNote ?? ""
  };
}

export function getHanhLangCellValue(entry, field) {
  if (!entry) return "";
  switch (field) {
    case "recorder":
      return entry.hlRecorder || entry.dutyPerson || "";
    case "violator":
      return entry.hlViolator || "";
    case "address":
      return entry.hlAddress || "";
    case "location":
      return entry._locationText != null ? entry._locationText : formatLocationCol(entry);
    case "recordDate":
      return entry._recordDateText != null
        ? entry._recordDateText
        : formatDisplayDate(entry.hlRecordDate || entry.date);
    case "content":
      return entry.content || entry.type || "";
    case "area":
      return entry._areaText != null ? entry._areaText : formatAreaCell(entry);
    case "process":
      return entry.hlProcessNote || entry.resolved || "";
    case "note":
      return entry.hlNote || entry.inspectorNote || "";
    default:
      return "";
  }
}

export function isHanhLangSheetRowFilled(entry) {
  if (!entry) return false;
  const hasText = [
    entry.hlRecorder,
    entry.hlViolator,
    entry.hlAddress,
    entry.kmFrom,
    entry.kmTo,
    entry.locationNote,
    entry.content,
    entry.type,
    entry.length,
    entry.width,
    entry.hlProcessNote,
    entry.resolved,
    entry.hlNote,
    entry.inspectorNote,
    entry._locationText,
    entry._recordDateText,
    entry._areaText
  ].some((v) => String(v ?? "").trim());
  // quantity: 0 mặc định — không coi là đã nhập
  const hasQty = Number(entry.quantity) > 0;
  return hasText || hasQty;
}

/** dd/mm/yyyy hoặc yyyy-mm-dd → ISO; không hợp lệ thì "". */
export function parseHanhLangDisplayDate(text, fallbackYearMonth = "") {
  const raw = String(text ?? "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const m = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) {
    const d = String(Number(m[1])).padStart(2, "0");
    const mo = String(Number(m[2])).padStart(2, "0");
    return `${m[3]}-${mo}-${d}`;
  }
  if (fallbackYearMonth && /^\d{4}-\d{2}$/.test(fallbackYearMonth)) {
    return `${fallbackYearMonth}-01`;
  }
  return "";
}

/** Tách cột lý trình kiểu «Km0+000 -:- Km1+200 (P) · ghi chú». */
export function parseHanhLangLocation(text) {
  const raw = String(text ?? "").trim();
  if (!raw) {
    return { kmFrom: "", kmTo: "", side: "", locationNote: "" };
  }

  let rest = raw;
  let locationNote = "";
  const noteSplit = rest.split(/\s·\s/);
  if (noteSplit.length > 1) {
    locationNote = noteSplit.slice(1).join(" · ").trim();
    rest = noteSplit[0].trim();
  }

  let side = "";
  const sideMatch = rest.match(/\(([TPMCtpmc])\)\s*$/);
  if (sideMatch) {
    side = sideMatch[1].toUpperCase();
    rest = rest.slice(0, sideMatch.index).trim();
  }

  const kmRe = /Km\s*([\d.+]+)/gi;
  const kms = [];
  let m;
  while ((m = kmRe.exec(rest)) !== null) {
    const norm = normalizeKmInput(m[1]);
    if (norm) kms.push(norm);
  }

  if (kms.length) {
    return {
      kmFrom: kms[0] || "",
      kmTo: kms[1] && kms[1] !== kms[0] ? kms[1] : "",
      side,
      locationNote
    };
  }

  const plain = normalizeKmInput(rest.replace(/[()]/g, "").trim());
  if (plain) {
    return { kmFrom: plain, kmTo: "", side, locationNote };
  }

  return { kmFrom: "", kmTo: "", side, locationNote: raw };
}

/** Tách «dài*rộng» hoặc số diện tích. */
export function parseHanhLangArea(text) {
  const raw = String(text ?? "").trim();
  if (!raw) return { length: "", width: "", quantity: 0, unit: "m2" };

  const pair = raw.match(/^([\d.,]+)\s*[*x×X]\s*([\d.,]+)$/);
  if (pair) {
    const length = pair[1].replace(",", ".");
    const width = pair[2].replace(",", ".");
    const l = toNum(length);
    const w = toNum(width);
    return {
      length,
      width,
      quantity: l && w ? Math.round(l * w * 100) / 100 : 0,
      unit: "m2"
    };
  }

  const qMatch = raw.match(/^([\d.,]+)\s*(m²|m2)?$/i);
  if (qMatch) {
    const quantity = toNum(qMatch[1]);
    return { length: "", width: "", quantity, unit: "m2" };
  }

  return { length: raw, width: "", quantity: 0, unit: "m2" };
}

/** Dòng trống trên sổ — không prefill ngày (chỉ gắn ngày khi lưu nếu người dùng bỏ trống). */
export function makeEmptyHanhLangEntry(_yearMonth) {
  void _yearMonth;
  return {
    section: HANH_LANG_SECTION,
    date: "",
    time: "",
    kmFrom: "",
    kmTo: "",
    side: "",
    locationNote: "",
    hlRecorder: "",
    hlViolator: "",
    hlAddress: "",
    content: "",
    type: "",
    length: "",
    width: "",
    unit: "m2",
    quantity: 0,
    resolved: "",
    hlProcessNote: "",
    hlNote: "",
    inspectorNote: "",
    exportHanhLang: true,
    hlRecordDate: ""
  };
}

/** Gán giá trị ô sổ → trường entry (nhật ký + sổ hành lang). */
export function applyHanhLangCellPatch(entry, field, value, _yearMonth = "") {
  const next = { ...entry, exportHanhLang: entry?.exportHanhLang !== false };
  const text = String(value ?? "");
  void _yearMonth;

  switch (field) {
    case "recorder":
      next.hlRecorder = text;
      break;
    case "violator":
      next.hlViolator = text;
      break;
    case "address":
      next.hlAddress = text;
      break;
    case "location": {
      next._locationText = text;
      const trimmed = text.trim();
      if (!trimmed) {
        next.kmFrom = "";
        next.kmTo = "";
        next.side = "";
        next.locationNote = "";
        break;
      }
      // Đang gõ dở (chưa có Km / dấu +) — giữ nguyên text, không normalize từng số
      if (!/km|\+/i.test(trimmed)) {
        next.kmFrom = "";
        next.kmTo = "";
        next.locationNote = text;
        break;
      }
      const loc = parseHanhLangLocation(text);
      next.kmFrom = loc.kmFrom;
      next.kmTo = loc.kmTo;
      next.side = loc.side || next.side || "";
      next.locationNote = loc.locationNote;
      break;
    }
    case "recordDate": {
      next._recordDateText = text;
      const iso = parseHanhLangDisplayDate(text, "");
      if (iso) {
        next.hlRecordDate = iso;
        next.date = iso;
      }
      break;
    }
    case "content":
      next.content = text;
      break;
    case "area": {
      next._areaText = text;
      const area = parseHanhLangArea(text);
      next.length = area.length;
      next.width = area.width;
      next.quantity = area.quantity;
      next.unit = area.unit;
      break;
    }
    case "process": {
      next.hlProcessNote = text;
      next.resolved = text;
      break;
    }
    case "note":
      next.hlNote = text;
      break;
    default:
      break;
  }

  if (!next.section) next.section = HANH_LANG_SECTION;
  return next;
}

