export function clampProgress(progress) {
  const p = progress ?? 0;
  return Math.min(100, Math.max(0, Math.round(p)));
}

export function progressLabel(progress) {
  const p = clampProgress(progress);
  if (p >= 100) return "Hoàn thành";
  if (p >= 90) return "Hoàn thành (≥90%)";
  if (p >= 50) return "Đã xử lý";
  if (p > 0) return "Đang xử lý";
  return "Chưa xử lý";
}

export function computeVolume(inc) {
  const l = Number(inc.dai ?? inc.length ?? 0);
  const w = Number(inc.rong ?? inc.width ?? 0);
  const h = Number(inc.cao ?? inc.height ?? 0);
  const unit = String(inc.unit || "").toLowerCase();
  if (unit === "m3" || unit === "m³") return Math.round(l * w * h * 100) / 100;
  if (unit === "m2" || unit === "m²") return Math.round(l * w * 100) / 100;
  if (unit === "m") return l;
  return computeVolumeRaw(l, w, h, unit, inc.quantity);
}

/** Khối lượng theo kích thước — khớp tab điều hành / app Android. */
export function computeKhoiLuong(inc) {
  const dai = Number(inc.dai ?? inc.length ?? 0);
  const rong = Number(inc.rong ?? inc.width ?? 0);
  const cao = Number(inc.cao ?? inc.height ?? 0);
  if (dai > 0 && rong > 0 && cao > 0) return dai * rong * cao;
  if (dai > 0 && rong > 0) return dai * rong;
  if (dai > 0) return dai;
  return 0;
}

export function normalizeDisplayUnit(unit) {
  const u = String(unit || "").trim();
  if (!u) return "";
  const lower = u.toLowerCase();
  if (lower === "m3" || lower === "m³") return "m³";
  if (lower === "m2" || lower === "m²") return "m²";
  if (lower === "m") return "m";
  return u;
}

/** Đơn vị hiển thị — ưu tiên field unit, không có thì suy từ kích thước. */
export function resolveIncidentUnit(inc) {
  const normalized = normalizeDisplayUnit(inc.unit);
  if (normalized) return normalized;
  const dai = Number(inc.dai ?? 0);
  const rong = Number(inc.rong ?? 0);
  const cao = Number(inc.cao ?? 0);
  if (dai > 0 && rong > 0 && cao > 0) return "m³";
  if (dai > 0 && rong > 0) return "m²";
  if (dai > 0) return "m";
  return "";
}

export function formatDimValue(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return "—";
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function formatKhoiLuong(inc) {
  const vol = computeKhoiLuong(inc);
  if (vol <= 0) return "—";
  return Number.isInteger(vol) ? String(vol) : vol.toFixed(1);
}

export function formatIncidentUnit(inc) {
  const u = String(inc.unit || "").trim();
  if (u) return normalizeDisplayUnit(u) || u;
  return resolveIncidentUnit(inc) || "—";
}

/** Suy đơn vị khi app/import không ghi (ổ gà thường chỉ có dài × rộng → m²). */
export function inferEntryUnit(entry) {
  const h = Number(entry?.height ?? entry?.cao ?? 0);
  const w = Number(entry?.width ?? entry?.rong ?? 0);
  const l = Number(entry?.length ?? entry?.dai ?? 0);
  const u = String(entry?.unit || "").trim().toLowerCase();

  // Dữ liệu cũ/import hay gán m³ dù chỉ có dài × rộng (ổ gà) → tính m².
  if ((u === "m3" || u === "m³") && h <= 0) {
    if (w > 0 && l > 0) return "m2";
    if (l > 0) return "m";
  }

  if (u === "m3" || u === "m³") return "m3";
  if (u === "m2" || u === "m²") return "m2";
  if (u === "m") return "m";
  if (h > 0) return "m3";
  if (w > 0) return "m2";
  if (l > 0) return "m";
  if (entry?.section === "Mặt đường") return "m2";
  return "m3";
}

export function resolveEntryQuantity(entry) {
  const normalized = {
    ...entry,
    length: entry?.length ?? entry?.dai ?? "",
    width: entry?.width ?? entry?.rong ?? "",
    height: entry?.height ?? entry?.cao ?? ""
  };
  const unit = inferEntryUnit(normalized);
  const stored = Number(normalized?.quantity);
  if (Number.isFinite(stored) && stored > 0) {
    return Math.round(stored * 100) / 100;
  }
  return computeVolume({ ...normalized, unit });
}

function formatQtyNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "";
  if (Math.abs(n - Math.round(n)) < 0.001) return String(Math.round(n));
  return n.toLocaleString("vi-VN", { maximumFractionDigits: 2 });
}

function formatUnitDisplay(unit) {
  if (unit === "m2") return "m²";
  if (unit === "m3") return "m³";
  return unit || "";
}

/**
 * Nội dung sổ tuần đường dạng «Phát sinh ...»:
 * «Phát sinh Ổ gà kích thước (1x1) m = 1 m²»
 * «Phát sinh Sạt taluy kích thước (5x1x1) m = 5 m³»
 */
export function formatPhatSinhDiaryContent(entry) {
  const typeLabel = entry?.sourceIncidentType || entry?.type || "";
  const dims = [entry?.length, entry?.width, entry?.height]
    .filter((v) => v !== "" && v != null && Number(v) > 0)
    .map((v) => formatQtyNumber(v) || String(v));
  const unit = inferEntryUnit(entry);
  const qty = resolveEntryQuantity(entry);
  const qtyStr = formatQtyNumber(qty);
  const unitLabel = formatUnitDisplay(unit) || "m²";
  let line = `Phát sinh ${typeLabel}`.trim();
  if (dims.length) line += ` kích thước (${dims.join("x")}) m`;
  if (qtyStr) line += ` = ${qtyStr} ${unitLabel}`;
  return line;
}

/** Dòng khối lượng cho sổ NK: «2 m² (2×1)» giống «54.2 m³ (20×2×0.3)». */
export function formatEntryVolumeLine(entry) {
  const unit = inferEntryUnit(entry);
  const qty = resolveEntryQuantity({ ...entry, unit });
  const dims = [entry?.length, entry?.width, entry?.height]
    .filter((v) => v !== "" && v != null && Number(v) > 0)
    .map(String);
  const qtyStr = formatQtyNumber(qty);
  if (!qtyStr) {
    return dims.length ? `(${dims.join("×")})` : "";
  }
  const unitLabel = formatUnitDisplay(unit);
  if (dims.length) return `${qtyStr} ${unitLabel} (${dims.join("×")})`;
  return `${qtyStr} ${unitLabel}`;
}

function computeVolumeRaw(length, width, height, unit, explicitQty) {
  const l = Number(length || 0);
  const w = Number(width || 0);
  const h = Number(height || 0);
  if (unit === "m") return l;
  if (unit === "m2" || unit === "m²") return Math.round(l * w * 100) / 100;
  if (unit === "m3" || unit === "m³") return Math.round(l * w * h * 100) / 100;
  return Number(explicitQty || 0);
}

export function formatVolume(inc) {
  const v = computeVolume(inc);
  if (!v) return "—";
  return `${v} ${inc.unit || ""}`.trim();
}

export function positionLabel(position) {
  const p = String(position || "").trim().toUpperCase();
  if (p === "P") return "Phải";
  if (p === "T") return "Trái";
  if (p === "M") return "Giữa";
  return position || "—";
}

export function parseViDate(str) {
  const s = String(str || "").trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (iso) {
    return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  }
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (!m) return null;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
}

export function applyIncidentFilters(items, filters) {
  return items.filter((inc) => {
    if (filters.road && inc.road !== filters.road) return false;
    if (filters.groupName && inc.groupName !== filters.groupName) return false;
    if (filters.type && inc.type !== filters.type) return false;
    if (filters.status) {
      const p = clampProgress(inc.progress);
      if (filters.status === "DONE" && p < 90 && !inc.completedDate) return false;
      if (filters.status === "PARTIAL" && (p === 0 || p >= 90)) return false;
      if (filters.status === "NEW" && p > 0) return false;
    }
    if (filters.dateFrom) {
      const from = parseViDate(filters.dateFrom);
      const d = parseViDate(inc.date);
      if (from && d && d < from) return false;
    }
    if (filters.dateTo) {
      const to = parseViDate(filters.dateTo);
      const d = parseViDate(inc.date);
      if (to && d && d > to) return false;
    }
    return true;
  });
}

import { sortIncidentsByKm as sortByKm } from "@quanlysuco/shared";

export function sortIncidentsByKm(items) {
  return sortByKm(items);
}

export function statusFromProgress(progress) {
  const p = clampProgress(progress);
  if (p >= 100) return "DONE";
  if (p > 0) return "PARTIAL";
  return "NEW";
}

export function statusLabel(status) {
  if (status === "PARTIAL") return "Đang xử lý";
  if (status === "DONE") return "Hoàn thành";
  return "Chưa xử lý";
}

/** Tiến độ dạng % — khớp tab điều hành. */
export function progressLabelPct(progress) {
  const p = clampProgress(progress);
  if (p === 0) return "0% — Chưa xử lý";
  if (p >= 100) return "100% — Hoàn thành";
  return `${p}%`;
}

export function uniqueImageUrls(urls) {
  const seen = new Set();
  const out = [];
  for (const raw of urls || []) {
    const url = String(raw || "").trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

export function completionImages(inc) {
  const fromUpdates = (inc.updates || [])
    .filter((u) => (u.progress ?? 0) >= 100)
    .flatMap((u) => u.images || []);
  if (fromUpdates.length > 0) return fromUpdates;
  if (inc.progress === 100) return inc.afterImages || [];
  return [];
}

export function beforeConstructionImages(inc) {
  return uniqueImageUrls(inc.beforeImages || []);
}

export function afterConstructionImages(inc) {
  return uniqueImageUrls([...(inc.afterImages || []), ...completionImages(inc)]);
}

export function formatIncidentSize(inc) {
  const l = inc.dai ?? 0;
  const w = inc.rong ?? 0;
  const h = inc.cao ?? 0;
  if (!l && !w && !h) return "—";
  return `${l} × ${w} × ${h} ${inc.unit || ""}`.trim();
}

export function formatTimelineDate(value) {
  const s = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-");
    return `${d}/${m}/${y}`;
  }
  return s || "—";
}

function timelineSortKey(value) {
  const d = parseViDate(value);
  return d ? d.getTime() : 0;
}

export function buildIncidentTimelineEvents(inc) {
  const events = [];

  if (inc.date?.trim()) {
    events.push({
      key: "created",
      at: inc.date.trim(),
      sortKey: timelineSortKey(inc.date),
      title: "Tạo sự cố",
      lines: [],
      by: inc.createdByName || ""
    });
  }

  for (const u of inc.updates || []) {
    if (!u.date?.trim()) continue;
    const note = u.note?.trim() || `${u.progress ?? 0}%`;
    events.push({
      key: `update-${u.date}-${note}`,
      at: u.date.trim(),
      sortKey: timelineSortKey(u.date),
      title: note,
      lines: u.progress != null ? [`Tiến độ: ${u.progress}%`] : [],
      by: u.createdBy || ""
    });
  }

  if (inc.completedDate?.trim()) {
    events.push({
      key: "completed",
      at: inc.completedDate.trim(),
      sortKey: timelineSortKey(inc.completedDate),
      title: "Hoàn thành 100%",
      lines: [],
      by: ""
    });
  }

  return events.sort((a, b) => b.sortKey - a.sortKey);
}

export const BAO_LU_GROUP = "Bão lũ";
export const TYPE_SA_BOI_CUNG = "Sa bồi cống";
export const GEOLOGY_SOIL = "DAT";
export const GEOLOGY_ROCK = "DA";
export const COMPLETION_PROGRESS_THRESHOLD = 90;
export const HIGH_VOLUME_M3_THRESHOLD = 100;

export function todayViDateString() {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${d.getFullYear()}`;
}

export function resolveCompletedDate(progress, existing) {
  const p = clampProgress(progress);
  if (p < COMPLETION_PROGRESS_THRESHOLD) return String(existing || "").trim();
  const cur = String(existing || "").trim();
  if (cur) return cur;
  return todayViDateString();
}

export function isIncidentCompleted(inc) {
  if (inc.completedDate?.trim()) return true;
  if (clampProgress(inc.progress) >= COMPLETION_PROGRESS_THRESHOLD) return true;
  const s = inc.status ?? statusFromProgress(inc.progress);
  return s === "DONE";
}

export function dispatchFilterStatus(inc) {
  if (isIncidentCompleted(inc)) return "DONE";
  if (clampProgress(inc.progress) > 0) return "PARTIAL";
  return "NEW";
}

export function isBaoLuGroup(groupName) {
  return (
    (groupName?.trim() ?? "").localeCompare(BAO_LU_GROUP, "vi", { sensitivity: "accent" }) === 0
  );
}

export function isSaBoiCungType(type) {
  return (
    (type?.trim() ?? "").localeCompare(TYPE_SA_BOI_CUNG, "vi", { sensitivity: "accent" }) === 0
  );
}

export function resolveSoilPercent(geologyType, soilPercent) {
  if (typeof soilPercent === "number" && soilPercent >= 0 && soilPercent <= 100) {
    return soilPercent;
  }
  return geologyType?.trim() === GEOLOGY_ROCK ? 0 : 100;
}

export function splitVolumeByGeology(inc) {
  if (!isBaoLuGroup(inc.groupName)) return { soil: null, rock: null };
  const vol = computeKhoiLuong(inc);
  if (vol <= 0) return { soil: null, rock: null };
  const soilPct = resolveSoilPercent(inc.geologyType, inc.soilPercent);
  const rockPct = 100 - soilPct;
  return {
    soil: soilPct > 0 ? (vol * soilPct) / 100 : null,
    rock: rockPct > 0 ? (vol * rockPct) / 100 : null
  };
}

function isM3Unit(unit) {
  const u = String(unit || "")
    .trim()
    .toLowerCase();
  return u === "m3" || u === "m³";
}

export function computeVolumeM3(inc) {
  if (!isM3Unit(inc.unit)) return 0;
  return computeKhoiLuong(inc);
}

export function isHighVolumeM3(inc) {
  return computeVolumeM3(inc) > HIGH_VOLUME_M3_THRESHOLD;
}

/**
 * Chuẩn hoá tên ảnh để đối chiếu (port PhotoPathUtils.photoToken của app):
 * lấy tên file (bỏ query/path), URL-decode, bỏ tiền tố timestamp 13 số,
 * bỏ dấu tiếng Việt, lowercase, bỏ ký tự không phải chữ/số.
 */
export function photoToken(ref) {
  let s = String(ref ?? "").trim();
  if (!s) return "";
  s = s.split(/[?#]/)[0];
  const slash = s.lastIndexOf("/");
  if (slash >= 0) s = s.slice(slash + 1);
  try {
    s = decodeURIComponent(s);
  } catch {
    /* giữ nguyên nếu decode lỗi */
  }
  const slash2 = s.lastIndexOf("/");
  if (slash2 >= 0) s = s.slice(slash2 + 1);
  s = s.replace(/^\d{13}[-_]?/, "");
  s = s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
  s = s.toLowerCase().replace(/[^a-z0-9]/g, "");
  return s;
}

export function resolveSelectedImageUrl(pool, ref) {
  const trimmed = String(ref || "").trim();
  if (!trimmed || pool.length === 0) return null;
  const matchByToken = (token) => pool.find((url) => photoToken(url) === token) ?? null;
  if (trimmed.startsWith("http")) {
    if (pool.includes(trimmed)) return trimmed;
    return matchByToken(photoToken(trimmed));
  }
  if (trimmed.startsWith("token:")) return matchByToken(trimmed.slice(6));
  return matchByToken(trimmed);
}

export function splitSelectedImageRefs(ref) {
  const trimmed = String(ref || "").trim();
  if (!trimmed) return [];
  return trimmed.split("|").map((s) => s.trim()).filter(Boolean);
}

export function joinSelectedImageRefs(urls) {
  return (urls || []).filter((u) => String(u || "").trim()).join("|");
}

export function resolveSelectedImageUrls(pool, ref) {
  const out = [];
  for (const part of splitSelectedImageRefs(ref)) {
    const url = resolveSelectedImageUrl(pool, part);
    if (url && !out.includes(url)) out.push(url);
  }
  return out;
}

export function isImageSelectedForReport(pool, ref, url) {
  return resolveSelectedImageUrls(pool, ref).includes(url);
}

export function toggleSelectedImageRef(pool, ref, url) {
  const current = resolveSelectedImageUrls(pool, ref);
  const already = isImageSelectedForReport(pool, ref, url);
  const next = already ? current.filter((u) => u !== url) : [...current, url];
  return joinSelectedImageRefs(next);
}

export function selectAllImageRefs(pool) {
  return joinSelectedImageRefs(pool);
}

export function reportBeforeImages(inc) {
  const pool = beforeConstructionImages(inc);
  if (pool.length === 0) return [];
  const picked = resolveSelectedImageUrls(pool, inc.selectedBefore);
  return picked.length > 0 ? picked : pool[0] ? [pool[0]] : [];
}

export function reportAfterImages(inc) {
  const pool = afterConstructionImages(inc);
  if (pool.length === 0) return [];
  const picked = resolveSelectedImageUrls(pool, inc.selectedAfter);
  return picked.length > 0 ? picked : pool[0] ? [pool[0]] : [];
}

export function reportBeforeImage(inc) {
  const list = reportBeforeImages(inc);
  return list[0] ?? null;
}

export function reportAfterImage(inc) {
  const list = reportAfterImages(inc);
  return list[0] ?? null;
}

const REPORT_ORDER_BEFORE = "b";
const REPORT_ORDER_AFTER = "a";

/** Mã hoá thứ tự ghép Word: `b:url|a:url|…` (thứ tự = STT ghép). */
export function encodeReportImageOrder(slots) {
  return slots
    .map((s) => `${s.kind === "before" ? REPORT_ORDER_BEFORE : REPORT_ORDER_AFTER}:${s.url}`)
    .join("|");
}

function parseReportOrderPart(part) {
  const trimmed = part.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith(`${REPORT_ORDER_BEFORE}:`)) {
    return { kind: "before", ref: trimmed.slice(2) };
  }
  if (trimmed.startsWith(`${REPORT_ORDER_AFTER}:`)) {
    return { kind: "after", ref: trimmed.slice(2) };
  }
  return null;
}

export function decodeReportImageOrder(order, beforePool, afterPool) {
  const out = [];
  for (const part of splitSelectedImageRefs(order)) {
    const parsed = parseReportOrderPart(part);
    if (!parsed) continue;
    const pool = parsed.kind === "before" ? beforePool : afterPool;
    const url = resolveSelectedImageUrl(pool, parsed.ref);
    if (!url) continue;
    if (!out.some((s) => s.kind === parsed.kind && s.url === url)) {
      out.push({ kind: parsed.kind, url });
    }
  }
  return out;
}

/** Thứ tự ghép Word — ưu tiên reportImageOrder; không có thì HT rồi XL (legacy). */
export function reportImageSlots(inc) {
  const beforePool = beforeConstructionImages(inc);
  const afterPool = afterConstructionImages(inc);
  const fromOrder = decodeReportImageOrder(inc.reportImageOrder, beforePool, afterPool);
  if (fromOrder.length > 0) return fromOrder;

  const before = reportBeforeImages(inc).map((url) => ({ kind: "before", url }));
  const after = reportAfterImages(inc).map((url) => ({ kind: "after", url }));
  return [...before, ...after];
}

function hasExplicitReportSelection(inc) {
  return Boolean(
    (inc.reportImageOrder ?? "").trim() ||
      (inc.selectedBefore ?? "").trim() ||
      (inc.selectedAfter ?? "").trim()
  );
}

/** Mặc định Word: 1 ảnh hiện trạng đầu + 1 ảnh xử lý đầu (khi chưa chọn). */
export function defaultExportReportSlots(beforePool, afterPool) {
  const out = [];
  if (beforePool[0]) out.push({ kind: "before", url: beforePool[0] });
  if (afterPool[0]) out.push({ kind: "after", url: afterPool[0] });
  return out;
}

/** Thứ tự ghép Word khi xuất — mặc định 1 HT + 1 XL nếu người dùng chưa chọn ảnh. */
export function reportImageSlotsForExport(inc) {
  const beforePool = beforeConstructionImages(inc);
  const afterPool = afterConstructionImages(inc);
  if (!hasExplicitReportSelection(inc)) {
    return defaultExportReportSlots(beforePool, afterPool);
  }
  const slots = reportImageSlots(inc);
  if (slots.length > 0) return slots;
  return defaultExportReportSlots(beforePool, afterPool);
}

export function reportSlotOrderIndex(slots, kind, url) {
  const idx = slots.findIndex((s) => s.kind === kind && s.url === url);
  return idx >= 0 ? idx + 1 : undefined;
}

export function toggleReportImageSlot(slots, kind, url) {
  const idx = slots.findIndex((s) => s.kind === kind && s.url === url);
  if (idx >= 0) return slots.filter((_, i) => i !== idx);
  return [...slots, { kind, url }];
}

export function selectAllReportImageSlots(slots, kind, pool) {
  const kept = slots.filter((s) => s.kind !== kind);
  const added = pool.map((url) => ({ kind, url }));
  return [...kept, ...added];
}

export function clearReportImageSlots(slots, kind) {
  return slots.filter((s) => s.kind !== kind);
}

export function moveReportImageSlot(slots, index, delta) {
  const next = index + delta;
  if (index < 0 || index >= slots.length || next < 0 || next >= slots.length) return slots;
  const copy = [...slots];
  const [item] = copy.splice(index, 1);
  copy.splice(next, 0, item);
  return copy;
}

/** Đặt STT ghép (1-based) cho ảnh — chèn/di chuyển trong danh sách. */
export function assignReportSlotOrder(slots, kind, url, order) {
  const slot = slots.find((s) => s.kind === kind && s.url === url) ?? { kind, url };
  const without = slots.filter((s) => !(s.kind === kind && s.url === url));
  const clamped = Math.max(1, Math.min(Math.round(order) || 1, without.length + 1));
  const copy = [...without];
  copy.splice(clamped - 1, 0, slot);
  return copy;
}

/** Đồng bộ selectedBefore/selectedAfter (app Android) từ thứ tự ghép. */
export function legacyRefsFromReportSlots(slots) {
  return {
    selectedBefore: joinSelectedImageRefs(
      slots.filter((s) => s.kind === "before").map((s) => s.url)
    ),
    selectedAfter: joinSelectedImageRefs(
      slots.filter((s) => s.kind === "after").map((s) => s.url)
    )
  };
}

export function isCompletedToday(inc) {
  const today = todayViDateString();
  return String(inc.completedDate || "").trim() === today;
}
