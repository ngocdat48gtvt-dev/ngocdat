import { displayToIso } from "./dateLocale";
import {
  HANH_LANG_SECTION,
  loadStorage,
  migrateEntry,
  saveStorage,
  stripGptcBm02Label
} from "./nhatKyFormat";
import { activeDiaryEntries } from "./officeBooksConflictMerge";
import { loadGptcLedger, saveGptcLedger, gptcScope } from "./gptcStore";
import { getRoadStorageKey } from "./roadsCatalog";

export const GPTC_NK_TYPE = "Theo dõi cấp phép thi công";

/** Ngày BM02: dd/mm/yyyy hoặc yyyy-mm-dd → ISO. */
export function normalizeGptcNgayToIso(ngay) {
  const raw = String(ngay || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return displayToIso(raw) || "";
}

function isGptcDetailEntrySyncable(entry) {
  if (!entry?.id) return false;
  const iso = normalizeGptcNgayToIso(entry.ngay);
  if (!iso) return false;
  return Boolean(
    String(entry.dienBien || "").trim() ||
      String(entry.yKienHatTruong || "").trim() ||
      String(entry.yKienTuanKiem || "").trim()
  );
}

/** Tên công trình đưa sang cột 3 nhật ký (ưu tiên cột 2 BM01). */
export function resolveGptcProjectName(permit) {
  return String(permit?.tenCongTrinh || permit?.tenCongTrinhBm02 || "").trim();
}

/**
 * Cột 3 NK: nội dung cột 2 BM01 (đã có «Công trình:») + diễn biến BM02.
 * Không thêm nhãn «Tên công trình:» (trùng).
 */
export function buildGptcDiaryContent(permit, pe) {
  const name = resolveGptcProjectName(permit);
  const dienBien = stripGptcBm02Label(pe?.dienBien || "");
  const lines = [];
  if (name) lines.push(name);
  if (dienBien) lines.push(dienBien);
  return lines.join("\n");
}

/**
 * Giữ lý trình người dùng nhập trên NK; xóa bản cũ từng sync tên CT vào cột 2.
 * Không đẩy ngược về sổ cấp phép / sổ khác.
 */
function preserveDiaryLocation(prev, permit) {
  const name = resolveGptcProjectName(permit);
  let locationNote = String(prev?.locationNote || "").trim();
  if (name && (locationNote === name || locationNote === `Công trình: ${name}`)) {
    locationNote = "";
  }
  if (/^Công trình:\s*/i.test(locationNote)) {
    locationNote = "";
  }

  let kmFrom = String(prev?.kmFrom || "").trim();
  let kmTo = String(prev?.kmTo || "").trim();
  let side = String(prev?.side || "").trim();
  // Bỏ phía P mặc định nếu chưa có lý trình / ghi chú vị trí
  if (!locationNote && !kmFrom && !kmTo && (side === "P" || side === "T" || side === "M")) {
    side = "";
  }

  return { locationNote, kmFrom, kmTo, side };
}

function buildNhatKyPatchFromGptc(permit, pe, iso) {
  const projectName = resolveGptcProjectName(permit);
  const workContent = stripGptcBm02Label(pe?.dienBien || "");
  return {
    date: iso,
    section: HANH_LANG_SECTION,
    type: GPTC_NK_TYPE,
    /** Cột 3: tên CT + diễn biến. Cột 2 (lý trình) không sync từ CPTC. */
    content: buildGptcDiaryContent(permit, pe),
    gptcProjectName: projectName,
    gptcWorkContent: workContent,
    /** Cột 5 NK ↔ cột 3 BM02 */
    leaderNote: String(pe.yKienHatTruong || "").trim(),
    resolved: "",
    inspectorNote: "",
    time: "",
    exportHanhLang: false,
    sourceGptcPermitId: permit.id,
    sourceGptcEntryId: pe.id
  };
}

function normalizedLinkText(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function gptcLogicalSignature({ date, content, leaderNote }) {
  return [date, normalizedLinkText(content), normalizedLinkText(leaderNote)].join("|");
}

function findLinkedDiaryIndex(entries, permit, pe, patch) {
  const permitId = String(permit?.id || "").trim();
  const entryId = String(pe?.id || "").trim();
  const exact = entries.findIndex(
    (entry) =>
      String(entry.sourceGptcPermitId || "").trim() === permitId &&
      String(entry.sourceGptcEntryId || "").trim() === entryId
  );
  if (exact >= 0) return exact;

  // Dữ liệu GPTC legacy từng không lưu id ổn định. Ghép theo công trình + ngày + nội dung
  // để lần hydrate sau không chèn thêm cùng một diễn biến vào Nhật ký.
  const signature = gptcLogicalSignature(patch);
  return entries.findIndex((entry) => {
    const linkedPermitId = String(entry.sourceGptcPermitId || "").trim();
    if (linkedPermitId && linkedPermitId !== permitId) return false;
    if (!entry.sourceGptcEntryId && !linkedPermitId) return false;
    return gptcLogicalSignature(entry) === signature;
  });
}

/** true nếu user đã xóa dòng NK gắn GPTC (còn tombstone). */
function isGptcLinkTombstoned(tombs, permit, pe, patch) {
  if (!tombs?.length) return false;
  const permitId = String(permit?.id || "").trim();
  const entryId = String(pe?.id || "").trim();
  const signature = gptcLogicalSignature(patch);
  return tombs.some((entry) => {
    if (!entry?.deletedAt) return false;
    const tPermit = String(entry.sourceGptcPermitId || "").trim();
    const tEntry = String(entry.sourceGptcEntryId || "").trim();
    if (permitId && entryId && tPermit === permitId && tEntry === entryId) return true;
    if (!tPermit && !tEntry) return false;
    if (tPermit && tPermit !== permitId) return false;
    return gptcLogicalSignature(entry) === signature;
  });
}

/**
 * Đồng bộ BM02 → sổ nhật ký tuần đường theo ngày.
 * Xóa công trình / dòng BM02 → gỡ dòng NK có sourceGptcPermitId / sourceGptcEntryId tương ứng.
 *
 * @param {{ pruneOrphans?: boolean, forcePruneEmpty?: boolean }} [options]
 * - pruneOrphans: mặc định true — gỡ NK khi CT/dòng BM02 không còn trên ledger.
 * - forcePruneEmpty: khi ledger trống, chỉ gỡ NK nếu true (thao tác user xóa hết CT).
 *   Máy mới hydrate CPTC trống mà forcePruneEmpty=false → không xóa dòng NK đã tải từ cloud.
 */
export function syncGptcLedgerToNhatKy(ledger, storageKey, options = {}) {
  if (!storageKey || !ledger) return { added: 0, updated: 0, removed: 0 };
  const pruneOrphans = options.pruneOrphans !== false;
  const forcePruneEmpty = Boolean(options.forcePruneEmpty);

  const parsed = loadStorage(storageKey, { includeDeleted: true });
  const allEntries = (parsed.entries || []).map(migrateEntry);
  const tombs = allEntries.filter((e) => e?.deletedAt);
  let entries = activeDiaryEntries(allEntries);
  const activePermitIds = new Set(
    (ledger.permits || []).map((p) => String(p.id || "").trim()).filter(Boolean)
  );
  // Mọi id dòng BM02 còn trên sổ (kể cả chưa đủ điều kiện sync) — để gỡ NK khi xóa CT/dòng.
  const activeEntryIds = new Set();
  (ledger.permits || []).forEach((p) => {
    (p.entries || []).forEach((e) => {
      const id = String(e?.id || "").trim();
      if (id) activeEntryIds.add(id);
    });
  });
  let added = 0;
  let updated = 0;

  for (const permit of ledger.permits || []) {
    for (const pe of permit.entries || []) {
      if (!isGptcDetailEntrySyncable(pe)) continue;
      const iso = normalizeGptcNgayToIso(pe.ngay);
      if (!iso) continue;
      const patch = buildNhatKyPatchFromGptc(permit, pe, iso);
      const idx = findLinkedDiaryIndex(entries, permit, pe, patch);
      if (idx >= 0) {
        const prev = entries[idx];
        const loc = preserveDiaryLocation(prev, permit);
        const previousResolved = String(prev.resolved || "").trim();
        const gptcLeaderNote = String(patch.leaderNote || "").trim();
        // Bản cũ từng có thể đặt ý kiến Hạt trưởng vào cột 1 trang 2 (resolved).
        // Nếu hai nội dung trùng nhau thì chuyển hẳn sang cột 2 trang 2 (leaderNote).
        const resolved =
          previousResolved && previousResolved === gptcLeaderNote ? "" : previousResolved;
        const next = migrateEntry({
          ...prev,
          ...patch,
          ...loc,
          resolved,
          inspectorNote: prev.inspectorNote || "",
          time: prev.time || ""
        });
        const changed =
          prev.date !== next.date ||
          prev.content !== next.content ||
          prev.gptcProjectName !== next.gptcProjectName ||
          prev.gptcWorkContent !== next.gptcWorkContent ||
          prev.leaderNote !== next.leaderNote ||
          prev.resolved !== next.resolved ||
          prev.locationNote !== next.locationNote ||
          prev.side !== next.side ||
          prev.section !== next.section ||
          prev.type !== next.type;
        if (changed) {
          entries[idx] = next;
          updated += 1;
        }
      } else if (isGptcLinkTombstoned(tombs, permit, pe, patch)) {
        // Đã xóa trên NK — không thêm lại từ sổ CPTC.
        continue;
      } else {
        entries.push(
          migrateEntry({
            ...patch,
            locationNote: "",
            kmFrom: "",
            kmTo: "",
            side: ""
          })
        );
        added += 1;
      }
    }
  }

  const before = entries.length;
  const ledgerEmpty = activePermitIds.size === 0 && activeEntryIds.size === 0;
  if (pruneOrphans && (!ledgerEmpty || forcePruneEmpty)) {
    entries = entries.filter((e) => {
      const permitId = String(e.sourceGptcPermitId || "").trim();
      const entryId = String(e.sourceGptcEntryId || "").trim();
      if (!permitId && !entryId) return true;
      if (permitId && !activePermitIds.has(permitId)) return false;
      if (entryId && !activeEntryIds.has(entryId)) return false;
      return true;
    });
  }
  let removed = before - entries.length;

  // Dọn bản ghi trùng do các phiên bản cũ sinh lại ID BM02. Chỉ đụng các dòng có liên kết GPTC.
  const seenLinks = new Set();
  entries = entries.filter((entry) => {
    const permitId = String(entry.sourceGptcPermitId || "").trim();
    const entryId = String(entry.sourceGptcEntryId || "").trim();
    if (!permitId && !entryId) return true;
    const key = `${permitId}|${gptcLogicalSignature(entry)}`;
    if (seenLinks.has(key)) {
      removed += 1;
      return false;
    }
    seenLinks.add(key);
    return true;
  });

  if (added || updated || removed) {
    saveStorage(entries, parsed.dayMeta, parsed.reportMeta, storageKey);
    try {
      window.dispatchEvent(
        new CustomEvent("nhatky-local-changed", { detail: { storageKey } })
      );
    } catch {
      /* ignore */
    }
  }

  return { added, updated, removed };
}

/**
 * Xóa cứng mọi dòng NK gắn với công trình / dòng BM02 (gọi khi bấm Xóa CT).
 * @returns {number} số dòng đã xóa
 */
export function removeGptcLinksFromNhatKy(storageKey, { permitIds = [], entryIds = [] } = {}) {
  if (!storageKey) return 0;
  const permitSet = new Set((permitIds || []).map((id) => String(id || "").trim()).filter(Boolean));
  const entrySet = new Set((entryIds || []).map((id) => String(id || "").trim()).filter(Boolean));
  if (!permitSet.size && !entrySet.size) return 0;

  const parsed = loadStorage(storageKey);
  const before = (parsed.entries || []).length;
  const entries = (parsed.entries || []).filter((e) => {
    const permitId = String(e.sourceGptcPermitId || "").trim();
    const entryId = String(e.sourceGptcEntryId || "").trim();
    if (permitId && permitSet.has(permitId)) return false;
    if (entryId && entrySet.has(entryId)) return false;
    return true;
  });
  const removed = before - entries.length;
  if (!removed) return 0;

  saveStorage(entries, parsed.dayMeta, parsed.reportMeta, storageKey);
  try {
    window.dispatchEvent(
      new CustomEvent("nhatky-local-changed", { detail: { storageKey } })
    );
  } catch {
    /* ignore */
  }
  return removed;
}

/**
 * Ánh xạ ngược: sửa ý kiến Hạt trên nhật ký → cột 3 BM02.
 */
export function syncNhatKyLeaderNoteToGptc({
  uid,
  roadId,
  sourceGptcPermitId,
  sourceGptcEntryId,
  leaderNote
}) {
  if (!uid || !roadId || !sourceGptcPermitId || !sourceGptcEntryId) return false;
  const scope = gptcScope(uid, roadId);
  if (!scope) return false;
  const ledger = loadGptcLedger(scope);
  let changed = false;
  const permits = (ledger.permits || []).map((p) => {
    if (p.id !== sourceGptcPermitId) return p;
    const entries = (p.entries || []).map((e) => {
      if (e.id !== sourceGptcEntryId) return e;
      const next = String(leaderNote ?? "");
      if (String(e.yKienHatTruong || "") === next) return e;
      changed = true;
      return { ...e, yKienHatTruong: next };
    });
    return { ...p, entries };
  });
  if (!changed) return false;
  saveGptcLedger(scope, { ...ledger, permits });
  return true;
}

/** storageKey nhật ký theo user + đường. */
export function nhatKyStorageKeyForRoad(uid, roadId) {
  return getRoadStorageKey(uid, roadId);
}

/** Kéo BM02 đang có trên máy vào sổ nhật ký (mở NK / lưu CPTC). */
export function syncLocalGptcLedgerToNhatKy(uid, roadId, storageKey, options = {}) {
  if (!uid || !roadId || !storageKey) {
    return { added: 0, updated: 0, removed: 0 };
  }
  const ledger = loadGptcLedger(gptcScope(uid, roadId));
  if (!(ledger?.permits || []).length) {
    return { added: 0, updated: 0, removed: 0 };
  }
  return syncGptcLedgerToNhatKy(ledger, storageKey, {
    forcePruneEmpty: false,
    ...options
  });
}

export function gptcLedgerToDiaryEntries(uid, roadId) {
  if (!uid || !roadId) return [];
  const ledger = loadGptcLedger(gptcScope(uid, roadId));
  const out = [];
  for (const permit of ledger?.permits || []) {
    for (const pe of permit.entries || []) {
      if (!isGptcDetailEntrySyncable(pe)) continue;
      const iso = normalizeGptcNgayToIso(pe.ngay);
      if (!iso) continue;
      out.push(
        migrateEntry({
          ...buildNhatKyPatchFromGptc(permit, pe, iso),
          recordId: `gptc-nk-${permit.id}-${pe.id}`
        })
      );
    }
  }
  return out;
}

export function mergeGptcLedgerIntoDiaryEntries(entries, uid, roadId) {
  const gptc = gptcLedgerToDiaryEntries(uid, roadId);
  if (!gptc.length) return entries || [];
  const byKey = new Map();
  gptc.forEach((entry) => {
    const key = `${String(entry.sourceGptcPermitId || "").trim()}|${String(entry.sourceGptcEntryId || "").trim()}`;
    if (key !== "|") byKey.set(key, entry);
  });
  const seen = new Set();
  const next = (entries || []).map((entry) => {
    const key = `${String(entry.sourceGptcPermitId || "").trim()}|${String(entry.sourceGptcEntryId || "").trim()}`;
    const fromLedger = byKey.get(key);
    if (!fromLedger) return entry;
    seen.add(key);
    const ledgerWork = String(fromLedger.gptcWorkContent || "").trim();
    const entryWork = String(entry.gptcWorkContent || "").trim();
    if (entryWork.length > ledgerWork.length) return entry;
    if (!ledgerWork && !String(fromLedger.content || "").trim()) return entry;
    const loc = preserveDiaryLocation(entry, { tenCongTrinh: fromLedger.gptcProjectName });
    return migrateEntry({
      ...entry,
      date: fromLedger.date || entry.date,
      content: fromLedger.content || entry.content,
      gptcProjectName: fromLedger.gptcProjectName || entry.gptcProjectName,
      gptcWorkContent: ledgerWork || entryWork,
      leaderNote: fromLedger.leaderNote || entry.leaderNote,
      type: GPTC_NK_TYPE,
      section: HANH_LANG_SECTION,
      ...loc
    });
  });
  const extra = gptc.filter((entry) => {
    const key = `${String(entry.sourceGptcPermitId || "").trim()}|${String(entry.sourceGptcEntryId || "").trim()}`;
    return key !== "|" && !seen.has(key);
  });
  return extra.length ? [...next, ...extra] : next;
}
