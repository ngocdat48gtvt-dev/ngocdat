import { EMPTY_GPTC_LEDGER, EMPTY_PERMIT, EMPTY_PERMIT_ENTRY } from "./gptcConstants";
import { normalizeDetailColWidths, normalizeSummaryColWidths } from "./gptcSummaryGrid";

export const GPTC_CHANGED_EVENT = "gptc-changed";

let idSeq = 0;
function nextId(prefix) {
  idSeq += 1;
  return `${prefix}_${Date.now().toString(36)}_${idSeq}`;
}

export function gptcScope(uid, roadId) {
  const u = String(uid || "").trim();
  const r = String(roadId || "").trim();
  if (!u || !r) return "";
  return `${u}__${r}`;
}

function storageKeyFor(scope) {
  return scope ? `gptc-v1-${scope}` : "gptc-v1";
}

const cacheByKey = new Map();

function strField(v) {
  return v == null ? "" : String(v);
}

function normalizeEntry(entry) {
  return {
    id: entry?.id || nextId("gptc_e"),
    ngay: strField(entry?.ngay).trim(),
    dienBien: strField(entry?.dienBien),
    yKienHatTruong: strField(entry?.yKienHatTruong),
    yKienTuanKiem: strField(entry?.yKienTuanKiem)
  };
}

export function normalizePermit(permit, index = 0) {
  const entries = Array.isArray(permit?.entries) ? permit.entries.map(normalizeEntry) : [];
  return {
    id: permit?.id || nextId("gptc_p"),
    stt: permit?.stt ?? index + 1,
    tenCongTrinh: strField(permit?.tenCongTrinh),
    soNgayCapPhep: strField(permit?.soNgayCapPhep),
    ngayBanGiao: strField(permit?.ngayBanGiao),
    donViDuocCap: strField(permit?.donViDuocCap),
    noiDungCapPhep: strField(permit?.noiDungCapPhep),
    ngayBatDau: strField(permit?.ngayBatDau),
    ngayKetThuc: strField(permit?.ngayKetThuc),
    ghiChu: strField(permit?.ghiChu),
    entries
  };
}

export function normalizeLedger(raw) {
  const base = { ...EMPTY_GPTC_LEDGER, ...(raw || {}) };
  const permits = (base.permits || []).map((p, i) => normalizePermit(p, i));
  permits.forEach((p, i) => {
    p.stt = i + 1;
  });
  return {
    year: String(base.year || new Date().getFullYear()),
    tenTuyen: String(base.tenTuyen || "").trim(),
    summaryColWidths: normalizeSummaryColWidths(base.summaryColWidths),
    detailColWidths: normalizeDetailColWidths(base.detailColWidths),
    permits
  };
}

export function loadGptcLedger(scope) {
  const key = storageKeyFor(scope);
  if (cacheByKey.has(key)) return cacheByKey.get(key);
  try {
    const raw = localStorage.getItem(key);
    const ledger = raw ? normalizeLedger(JSON.parse(raw)) : normalizeLedger({});
    cacheByKey.set(key, ledger);
    return ledger;
  } catch {
    const ledger = normalizeLedger({});
    cacheByKey.set(key, ledger);
    return ledger;
  }
}

export function saveGptcLedger(scope, ledger) {
  const key = storageKeyFor(scope);
  const normalized = normalizeLedger(ledger);
  localStorage.setItem(key, JSON.stringify(normalized));
  cacheByKey.set(key, normalized);
  window.dispatchEvent(new CustomEvent(GPTC_CHANGED_EVENT, { detail: { scope } }));
  return normalized;
}

export function setGptcLedger(scope, ledger) {
  return saveGptcLedger(scope, ledger);
}

export function makeEmptyPermit() {
  return normalizePermit({ ...EMPTY_PERMIT, entries: [] });
}

export function makeEmptyEntry() {
  return normalizeEntry({ ...EMPTY_PERMIT_ENTRY });
}

export function reindexPermits(permits) {
  return (permits || []).map((p, i) => ({ ...p, stt: i + 1 }));
}
