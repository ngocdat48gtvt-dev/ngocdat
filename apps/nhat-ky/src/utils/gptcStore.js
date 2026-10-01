import { EMPTY_GPTC_LEDGER, EMPTY_PERMIT, EMPTY_PERMIT_ENTRY } from "./gptcConstants";
import {
  isPermitRowFilled,
  normalizeDetailColWidths,
  normalizeSummaryColWidths
} from "./gptcSummaryGrid";

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
    stt: permit?.stt ?? "",
    tenCongTrinh: strField(permit?.tenCongTrinh),
    tenCongTrinhBm02: strField(permit?.tenCongTrinhBm02),
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

function uniqueIdList(ids) {
  const out = [];
  const seen = new Set();
  for (const raw of ids || []) {
    const id = String(raw || "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function normalizeLedger(raw) {
  const base = { ...EMPTY_GPTC_LEDGER, ...(raw || {}) };
  const deletedPermitIds = uniqueIdList(base.deletedPermitIds);
  const deletedEntryIds = uniqueIdList(base.deletedEntryIds);
  const deletedPermits = new Set(deletedPermitIds);
  const deletedEntries = new Set(deletedEntryIds);
  const permits = reindexPermits(
    (base.permits || [])
      .filter((p) => !deletedPermits.has(String(p?.id || "").trim()))
      .map((p, i) => {
        const next = normalizePermit(p, i);
        return {
          ...next,
          entries: (next.entries || []).filter(
            (e) => !deletedEntries.has(String(e?.id || "").trim())
          )
        };
      })
  );
  return {
    year: String(base.year || new Date().getFullYear()),
    tenTuyen: String(base.tenTuyen || "").trim(),
    summaryColWidths: normalizeSummaryColWidths(base.summaryColWidths),
    detailColWidths: normalizeDetailColWidths(base.detailColWidths),
    permits,
    deletedPermitIds,
    deletedEntryIds,
    updatedAt: Number(base.updatedAt) || 0
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

/** Tiêu đề BM02 = tên công trình (cột 2 BM01). */
export function permitBm02Title(permit) {
  return String(permit?.tenCongTrinhBm02 || permit?.tenCongTrinh || "").trim();
}

/** Xóa công trình khỏi BM01/BM02 và ghi tombstone để merge không kéo lại. */
export function markPermitDeleted(ledger, permitId, extraEntryIds = []) {
  const id = String(permitId || "").trim();
  const permit = (ledger?.permits || []).find((p) => String(p?.id || "") === id);
  const entryIds = [
    ...(Array.isArray(extraEntryIds) ? extraEntryIds : []),
    ...((permit?.entries || []).map((e) => e?.id))
  ];
  return normalizeLedger({
    ...(ledger || {}),
    permits: (ledger?.permits || []).filter((p) => String(p?.id || "") !== id),
    deletedPermitIds: [...(ledger?.deletedPermitIds || []), id],
    deletedEntryIds: [...(ledger?.deletedEntryIds || []), ...entryIds]
  });
}

/** Xóa một dòng theo dõi BM02 và ghi tombstone. */
export function markEntryDeleted(ledger, permitId, entryId) {
  const pid = String(permitId || "").trim();
  const eid = String(entryId || "").trim();
  return normalizeLedger({
    ...(ledger || {}),
    permits: (ledger?.permits || []).map((p) =>
      String(p?.id || "") !== pid
        ? p
        : {
            ...p,
            entries: (p.entries || []).filter((e) => String(e?.id || "") !== eid)
          }
    ),
    deletedEntryIds: [...(ledger?.deletedEntryIds || []), eid]
  });
}

/** STT chỉ đánh cho dòng đã nhập liệu; dòng trống để trống. */
export function reindexPermits(permits) {
  let n = 0;
  return (permits || []).map((p) => {
    if (!isPermitRowFilled(p)) return { ...p, stt: "" };
    n += 1;
    return { ...p, stt: n };
  });
}
