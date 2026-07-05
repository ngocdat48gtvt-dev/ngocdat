import { EMPTY_COVER, EMPTY_COUNTS, DIRECTION_DI } from "./demXeConstants";

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

export function normalizeLedger(raw) {
  const cover = { ...EMPTY_COVER, ...(raw?.cover || {}) };
  const days = {};
  Object.keys(raw?.days || {}).forEach((date) => {
    const dirs = (raw.days[date]?.directions || []).map(normalizeDirection);
    if (dirs.length) days[date] = { directions: dirs };
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
    ngayKetThuc: ""
  };
}
