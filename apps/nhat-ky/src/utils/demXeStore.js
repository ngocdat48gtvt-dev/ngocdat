import {
  COUNT_BATCH_DAYS,
  DIRECTION_DI,
  DIRECTION_VE,
  EMPTY_COVER,
  EMPTY_COUNTS
} from "./demXeConstants";

const LEGACY_KEY = "dem-xe-v1";
export const DEMXE_CHANGED_EVENT = "demxe-changed";

let idSeq = 0;
function nextId() {
  idSeq += 1;
  return `dx_${Date.now().toString(36)}_${idSeq}`;
}

export function demXeScope(uid, roadId) {
  const u = String(uid || "").trim();
  const r = String(roadId || "").trim();
  if (!u || !r) return "";
  return `${u}__${r}`;
}

function storageKeyFor(scope) {
  const s = String(scope || "").trim();
  return s ? `dem-xe-v1-${s}` : LEGACY_KEY;
}

const cacheByKey = new Map();

function emptyLedger() {
  return { cover: { ...EMPTY_COVER }, days: {} };
}

function normalizeCounts(counts) {
  const out = { ...EMPTY_COUNTS };
  Object.keys(out).forEach((k) => {
    const raw = counts?.[k];
    out[k] = raw === "" || raw == null ? "" : String(raw);
  });
  return out;
}

function normalizeDirection(dir) {
  return {
    id: dir?.id || nextId(),
    directionType: dir?.directionType === "ve" ? "ve" : "di",
    roadName: String(dir?.roadName || "").trim(),
    lyTrinh: String(dir?.lyTrinh || "").trim(),
    from: String(dir?.from || "").trim(),
    to: String(dir?.to || "").trim(),
    startTime: String(dir?.startTime || "").trim(),
    endTime: String(dir?.endTime || "").trim(),
    counts: normalizeCounts(dir?.counts)
  };
}

export function addDaysIso(iso, offset) {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

export function batchDatesFromStart(startIso) {
  return Array.from({ length: COUNT_BATCH_DAYS }, (_, i) => addDaysIso(startIso, i));
}

export function makeDayDirections(seed = {}) {
  return [makeEmptyDirection(DIRECTION_DI, seed), makeEmptyDirection(DIRECTION_VE, seed)];
}

/** Mỗi ngày luôn có đúng 1 chiều đi và 1 chiều về. */
export function ensureDayDirections(day, seed = {}) {
  const dirs = (day?.directions || []).map(normalizeDirection);
  const di = dirs.find((d) => d.directionType === DIRECTION_DI) || makeEmptyDirection(DIRECTION_DI, seed);
  const ve = dirs.find((d) => d.directionType === DIRECTION_VE) || makeEmptyDirection(DIRECTION_VE, seed);
  return { directions: [di, ve] };
}

export function normalizeLedger(raw) {
  const cover = { ...EMPTY_COVER, ...(raw?.cover || {}) };
  const seed = { roadName: cover.tenDuong || "" };
  const days = {};
  Object.keys(raw?.days || {}).forEach((date) => {
    days[date] = ensureDayDirections(raw.days[date], seed);
  });
  return { cover, days };
}

function readKey(key) {
  try {
    const raw = JSON.parse(localStorage.getItem(key));
    if (raw && typeof raw === "object") return normalizeLedger(raw);
  } catch {
    /* ignore */
  }
  return emptyLedger();
}

export function loadDemXeLedger(scope) {
  const key = storageKeyFor(scope);
  if (cacheByKey.has(key)) return cacheByKey.get(key);
  const ledger = readKey(key);
  cacheByKey.set(key, ledger);
  return ledger;
}

export function saveDemXeLedger(scope, ledger) {
  const key = storageKeyFor(scope);
  const clean = normalizeLedger(ledger);
  localStorage.setItem(key, JSON.stringify(clean));
  cacheByKey.set(key, clean);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(DEMXE_CHANGED_EVENT));
  }
  return clean;
}

export function setDemXeLedger(scope, ledger) {
  const key = storageKeyFor(scope);
  const clean = normalizeLedger(ledger);
  localStorage.setItem(key, JSON.stringify(clean));
  cacheByKey.set(key, clean);
  return clean;
}

export function makeEmptyDirection(directionType = DIRECTION_DI, seed = {}) {
  return normalizeDirection({
    directionType,
    roadName: seed.roadName || "",
    lyTrinh: seed.lyTrinh || "",
    from: seed.from || "",
    to: seed.to || "",
    startTime: seed.startTime || "",
    endTime: seed.endTime || "",
    counts: { ...EMPTY_COUNTS }
  });
}

export function coverFromRoad(road, reportMeta = {}) {
  const kmFrom = road?.kmFrom ? `Km${road.kmFrom}` : "";
  const kmTo = road?.kmTo ? `Km${road.kmTo}` : "";
  const kmRange =
    road?.kmRange ||
    (kmFrom && kmTo ? `${kmFrom} – ${kmTo}` : "") ||
    reportMeta?.kmRange ||
    "";
  return {
    donVi: reportMeta?.company || road?.company || "",
    tenHat: road?.hat || reportMeta?.hat || "",
    tenDuong: road?.roadName || road?.label || reportMeta?.roadName || "",
    lyTrinhQuanLy: kmRange,
    ngayBatDau: "",
    ngayKetThuc: "",
    noiKy: reportMeta?.place || road?.place || "Sơn La",
    nam: String(new Date().getFullYear())
  };
}
