import { isPermitRowFilled } from "./gptcSummaryGrid";
import { normalizeLedger, normalizePermit, reindexPermits } from "./gptcStore";

function norm(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function uniqueIds(...lists) {
  const out = [];
  const seen = new Set();
  for (const list of lists) {
    for (const raw of list || []) {
      const id = String(raw || "").trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

function pickText(local, remote, preferLocal) {
  const L = String(local ?? "").trim();
  const R = String(remote ?? "").trim();
  if (L && !R) return String(local ?? "");
  if (R && !L) return String(remote ?? "");
  if (L === R) return String(local ?? "");
  if (L && R) return preferLocal ? String(local ?? "") : String(remote ?? "");
  return String(local ?? remote ?? "");
}

function permitFingerprint(permit) {
  if (!isPermitRowFilled(permit)) return "";
  return [
    norm(permit?.tenCongTrinh),
    norm(permit?.soNgayCapPhep),
    norm(permit?.donViDuocCap),
    norm(permit?.ngayBatDau),
    norm(permit?.ngayBanGiao)
  ].join("|");
}

function entryFingerprint(entry) {
  const ngay = norm(entry?.ngay);
  const dienBien = norm(entry?.dienBien).slice(0, 120);
  if (!ngay && !dienBien) return "";
  return `${ngay}|${dienBien}`;
}

function mergeEntry(local, remote, preferLocal) {
  const localDien = String(local?.dienBien ?? "").trim();
  const remoteDien = String(remote?.dienBien ?? "").trim();
  const dienBien =
    remoteDien.length > localDien.length
      ? String(remote?.dienBien ?? "")
      : localDien.length > remoteDien.length
        ? String(local?.dienBien ?? "")
        : pickText(local?.dienBien, remote?.dienBien, preferLocal);
  const ngay =
    remoteDien.length > localDien.length
      ? pickText(remote?.ngay, local?.ngay, true)
      : localDien.length > remoteDien.length
        ? pickText(local?.ngay, remote?.ngay, true)
        : pickText(local?.ngay, remote?.ngay, preferLocal);
  return {
    id: String(local?.id || remote?.id || "").trim() || local?.id || remote?.id,
    ngay,
    dienBien,
    yKienHatTruong: pickText(local?.yKienHatTruong, remote?.yKienHatTruong, preferLocal),
    yKienTuanKiem: pickText(local?.yKienTuanKiem, remote?.yKienTuanKiem, preferLocal)
  };
}

function mergeEntries(localEntries, remoteEntries, preferLocal, deletedEntries) {
  const remoteList = Array.isArray(remoteEntries) ? remoteEntries : [];
  const localList = Array.isArray(localEntries) ? localEntries : [];
  const remoteById = new Map();
  const remoteByFp = new Map();
  for (const entry of remoteList) {
    const id = String(entry?.id || "").trim();
    if (id && deletedEntries.has(id)) continue;
    if (id) remoteById.set(id, entry);
    const fp = entryFingerprint(entry);
    if (fp && !remoteByFp.has(fp)) remoteByFp.set(fp, entry);
  }

  const usedRemote = new Set();
  const out = [];

  for (const local of localList) {
    const id = String(local?.id || "").trim();
    if (id && deletedEntries.has(id)) continue;
    let remote = id ? remoteById.get(id) : null;
    if (!remote) {
      const fp = entryFingerprint(local);
      if (fp) remote = remoteByFp.get(fp) || null;
    }
    if (remote) {
      const rid = String(remote.id || "").trim();
      if (rid) usedRemote.add(rid);
      if (rid && deletedEntries.has(rid)) continue;
      out.push(mergeEntry(local, remote, preferLocal));
    } else {
      out.push(local);
    }
  }

  for (const remote of remoteList) {
    const rid = String(remote?.id || "").trim();
    if (rid && deletedEntries.has(rid)) continue;
    if (rid && usedRemote.has(rid)) continue;
    if (!rid) {
      const fp = entryFingerprint(remote);
      const already = fp && out.some((e) => entryFingerprint(e) === fp);
      if (already) continue;
    }
    out.push(remote);
  }

  return out;
}

const PERMIT_TEXT_FIELDS = [
  "tenCongTrinh",
  "tenCongTrinhBm02",
  "soNgayCapPhep",
  "ngayBanGiao",
  "donViDuocCap",
  "noiDungCapPhep",
  "ngayBatDau",
  "ngayKetThuc",
  "ghiChu"
];

function mergePermit(local, remote, preferLocal, deletedEntries) {
  const remoteAt = Number(remote?.updatedAtMs) || 0;
  const localAt = Number(local?.updatedAtMs) || 0;
  const preferPermitLocal = remoteAt > 0 && remoteAt >= localAt ? false : preferLocal;
  const merged = {
    id: String(local?.id || remote?.id || "").trim() || local?.id || remote?.id,
    stt: preferPermitLocal ? local?.stt ?? "" : remote?.stt ?? local?.stt ?? "",
    updatedAtMs: Math.max(localAt, remoteAt)
  };
  for (const field of PERMIT_TEXT_FIELDS) {
    merged[field] = pickText(local?.[field], remote?.[field], preferPermitLocal);
  }
  merged.entries = mergeEntries(local?.entries, remote?.entries, preferPermitLocal, deletedEntries);
  return normalizePermit(merged);
}

/**
 * Gộp hai ledger CPTC (máy nhà + máy công ty):
 * - Giữ đủ công trình / dòng BM02 của cả hai phía (theo id, fallback vân tay nghiệp vụ).
 * - Tôn trọng deletedPermitIds / deletedEntryIds — xóa thật, không bị merge kéo lại.
 * - Ô trống nhường ô có chữ; hai bên đều có chữ khác nhau → ưu tiên preferLocal.
 */
export function mergeGptcLedgers(localRaw, remoteRaw, options = {}) {
  const local = normalizeLedger(localRaw || {});
  const remote = normalizeLedger(remoteRaw || {});
  const localAt = Number(local.updatedAt) || 0;
  const remoteAt = Number(remote.updatedAt) || 0;
  const preferLocal =
    options.preferLocal != null ? Boolean(options.preferLocal) : localAt >= remoteAt;

  const deletedPermitIds = uniqueIds(local.deletedPermitIds, remote.deletedPermitIds);
  const deletedEntryIds = uniqueIds(local.deletedEntryIds, remote.deletedEntryIds);
  const deletedPermits = new Set(deletedPermitIds);
  const deletedEntries = new Set(deletedEntryIds);

  // User xóa hết CT trên máy này → tombstone mọi CT còn trên cloud, không merge lại.
  if (options.tombstoneRemotePermits) {
    for (const permit of remote.permits || []) {
      const id = String(permit?.id || "").trim();
      if (id && !deletedPermits.has(id)) {
        deletedPermits.add(id);
        deletedPermitIds.push(id);
      }
      for (const entry of permit.entries || []) {
        const eid = String(entry?.id || "").trim();
        if (eid && !deletedEntries.has(eid)) {
          deletedEntries.add(eid);
          deletedEntryIds.push(eid);
        }
      }
    }
  }

  const remotePermits = remote.permits || [];
  const localPermits = local.permits || [];
  const remoteById = new Map();
  const remoteByFp = new Map();
  for (const permit of remotePermits) {
    const id = String(permit?.id || "").trim();
    if (id && deletedPermits.has(id)) continue;
    if (id) remoteById.set(id, permit);
    const fp = permitFingerprint(permit);
    if (fp && !remoteByFp.has(fp)) remoteByFp.set(fp, permit);
  }

  const usedRemote = new Set();
  const mergedPermits = [];

  for (const localPermit of localPermits) {
    const id = String(localPermit?.id || "").trim();
    if (id && deletedPermits.has(id)) continue;
    let remotePermit = id ? remoteById.get(id) : null;
    if (!remotePermit) {
      const fp = permitFingerprint(localPermit);
      if (fp) remotePermit = remoteByFp.get(fp) || null;
    }
    if (remotePermit) {
      const rid = String(remotePermit.id || "").trim();
      if (rid) usedRemote.add(rid);
      if (rid && deletedPermits.has(rid)) continue;
      mergedPermits.push(mergePermit(localPermit, remotePermit, preferLocal, deletedEntries));
    } else if (isPermitRowFilled(localPermit)) {
      mergedPermits.push(localPermit);
    } else {
      mergedPermits.push(localPermit);
    }
  }

  if (!options.tombstoneRemotePermits) {
    for (const remotePermit of remotePermits) {
      const rid = String(remotePermit?.id || "").trim();
      if (rid && deletedPermits.has(rid)) continue;
      if (rid && usedRemote.has(rid)) continue;
      if (!isPermitRowFilled(remotePermit)) continue;
      const fp = permitFingerprint(remotePermit);
      if (fp && mergedPermits.some((p) => permitFingerprint(p) === fp)) continue;
      mergedPermits.push({
        ...remotePermit,
        entries: (remotePermit.entries || []).filter(
          (e) => !deletedEntries.has(String(e?.id || "").trim())
        )
      });
    }
  }

  const filled = [];
  let emptyTail = null;
  for (const permit of mergedPermits) {
    if (isPermitRowFilled(permit)) filled.push(permit);
    else emptyTail = permit;
  }
  if (emptyTail) filled.push(emptyTail);

  return normalizeLedger({
    year: pickText(local.year, remote.year, preferLocal) || local.year || remote.year,
    tenTuyen: pickText(local.tenTuyen, remote.tenTuyen, preferLocal),
    summaryColWidths: preferLocal ? local.summaryColWidths : remote.summaryColWidths,
    detailColWidths: preferLocal ? local.detailColWidths : remote.detailColWidths,
    permits: reindexPermits(filled),
    deletedPermitIds,
    deletedEntryIds,
    updatedAt: Math.max(localAt, remoteAt)
  });
}

export function gptcLedgerContentKey(ledger) {
  const normalized = normalizeLedger(ledger || {});
  return JSON.stringify({
    year: normalized.year,
    tenTuyen: normalized.tenTuyen,
    permits: normalized.permits,
    deletedPermitIds: normalized.deletedPermitIds,
    deletedEntryIds: normalized.deletedEntryIds
  });
}
