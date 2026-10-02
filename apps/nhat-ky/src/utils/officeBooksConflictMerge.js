const SYNC_FIELDS = new Set(["_syncConflicts"]);

function clone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function same(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function randomToken() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

export function newDiaryRecordId() {
  return `nk_${randomToken()}`;
}

export function ensureDiaryRecordIds(entries) {
  return (Array.isArray(entries) ? entries : []).map((entry) => {
    if (String(entry?.recordId || "").trim()) return entry;
    return { ...entry, recordId: newDiaryRecordId() };
  });
}

function legacyFingerprint(entry) {
  const clean = {};
  Object.keys(entry || {})
    .filter((key) => key !== "recordId" && !SYNC_FIELDS.has(key))
    .sort()
    .forEach((key) => {
      clean[key] = entry[key];
    });
  return JSON.stringify(clean);
}

function normText(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function normNum(value) {
  const s = String(value ?? "")
    .trim()
    .replace(",", ".");
  if (!s) return "";
  const n = Number(s);
  return Number.isFinite(n) ? String(n) : s.toLowerCase();
}

function normKm(value) {
  let text = String(value ?? "")
    .trim()
    .replace(/^km\s*/i, "")
    .replace(/\s/g, "");
  const m = text.match(/^(\d+)\+(\d+)/);
  if (!m) return text.toLowerCase();
  const km = String(Number(m[1]) || 0);
  const met = String(Number(m[2].slice(0, 3)) || 0).padStart(3, "0");
  return `${km}+${met}`;
}

function normSide(value) {
  const s = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s/g, "");
  if (s === "P+T" || s === "TP" || s === "PT") return "T+P";
  return s;
}

/**
 * Vân tay nghiệp vụ — cùng ngày, hạng mục, lý trình, kích thước và nội dung = một dòng.
 * Không tách theo mã sự cố / mã nhánh: các bản đồng bộ giống hệt nhau phải gom một.
 */
export function diaryBusinessFingerprint(entry) {
  return [
    normText(entry?.date),
    normText(entry?.section),
    normText(entry?.type || entry?.sourceIncidentType),
    normKm(entry?.kmFrom),
    normKm(entry?.kmTo),
    normSide(entry?.side),
    normNum(entry?.length),
    normNum(entry?.width),
    normNum(entry?.height),
    normNum(entry?.quantity),
    normText(entry?.unit),
    normText(entry?.content).slice(0, 240)
  ].join("|");
}

function entryRichness(entry) {
  let score = 0;
  [
    "resolved",
    "leaderNote",
    "inspectorNote",
    "plannedRepairDate",
    "measureSummary",
    "mainResult",
    "content"
  ].forEach((key) => {
    if (String(entry?.[key] || "").trim()) score += 1;
  });
  if (String(entry?.recordId || "").trim()) score += 0.05;
  return score;
}

function isEmptyMergeValue(value) {
  if (value == null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function keepRicherEntry(prev, next) {
  if (!prev) return next;
  const preferNext = entryRichness(next) >= entryRichness(prev);
  const primary = preferNext ? next : prev;
  const secondary = preferNext ? prev : next;
  const merged = { ...secondary, ...primary };
  Object.keys(secondary).forEach((key) => {
    if (isEmptyMergeValue(merged[key]) && !isEmptyMergeValue(secondary[key])) {
      merged[key] = secondary[key];
    }
  });
  return merged;
}

/** Cùng recordId mới gộp. Khác mã dòng thì giữ riêng, không nuốt sự cố. */
function dedupeKey(entry) {
  const recordId = String(entry?.recordId || "").trim();
  if (recordId) return `id:${recordId}`;
  const incidentId = normText(entry?.sourceIncidentId);
  const fp = diaryBusinessFingerprint(entry);
  if (incidentId) return `inc:${incidentId}|${fp}`;
  return fp;
}

/**
 * Bỏ dòng trùng nghiệp vụ (khác recordId). Giữ bản «đủ thông tin» hơn.
 * Tombstone giữ nguyên.
 */
export function dedupeDiaryEntriesByFingerprint(entries) {
  const seen = new Map();
  const tombstones = [];
  (entries || []).forEach((entry) => {
    if (entry?.deletedAt) {
      tombstones.push(entry);
      return;
    }
    const key = dedupeKey(entry);
    seen.set(key, keepRicherEntry(seen.get(key), entry));
  });
  return [...seen.values(), ...tombstones];
}

/** Gắn recordId của baseline vào record legacy tương ứng trên cloud. */
export function alignLegacyRecordIds(entries, baselineEntries) {
  const queues = new Map();
  (baselineEntries || []).forEach((entry) => {
    const id = String(entry?.recordId || "").trim();
    if (!id) return;
    const fp = legacyFingerprint(entry);
    if (!queues.has(fp)) queues.set(fp, []);
    queues.get(fp).push(id);
  });

  return (entries || []).map((entry) => {
    if (String(entry?.recordId || "").trim()) return entry;
    const queue = queues.get(legacyFingerprint(entry));
    const recordId = queue?.shift();
    return recordId ? { ...entry, recordId } : { ...entry, recordId: newDiaryRecordId() };
  });
}

function conflict(field, localValue, remoteValue) {
  return {
    field,
    localValue: clone(localValue),
    remoteValue: clone(remoteValue),
    detectedAt: new Date().toISOString()
  };
}

function mergeObject(base = {}, local = {}, remote = {}) {
  const result = {};
  const conflicts = [];
  const keys = new Set([
    ...Object.keys(base || {}),
    ...Object.keys(local || {}),
    ...Object.keys(remote || {})
  ]);
  keys.delete("_syncConflicts");

  keys.forEach((key) => {
    const b = base?.[key];
    const l = local?.[key];
    const r = remote?.[key];
    const localChanged = !same(l, b);
    const remoteChanged = !same(r, b);
    if (!localChanged) result[key] = clone(r);
    else if (!remoteChanged || same(l, r)) result[key] = clone(l);
    else {
      // Cloud đang tồn tại được giữ làm giá trị hiển thị; giá trị local không bị mất,
      // được lưu trong metadata conflict để có thể khôi phục/đối soát.
      result[key] = clone(r);
      conflicts.push(conflict(key, l, r));
    }
  });

  const previous = [
    ...(Array.isArray(base?._syncConflicts) ? base._syncConflicts : []),
    ...(Array.isArray(local?._syncConflicts) ? local._syncConflicts : []),
    ...(Array.isArray(remote?._syncConflicts) ? remote._syncConflicts : [])
  ];
  if (previous.length || conflicts.length) {
    result._syncConflicts = [...previous, ...conflicts].slice(-100);
  }
  return { value: result, conflicts };
}

function tombstone(entry, reason, conflicts = []) {
  return {
    ...(entry || {}),
    recordId: entry?.recordId || newDiaryRecordId(),
    deletedAt: entry?.deletedAt || new Date().toISOString(),
    deleteReason: entry?.deleteReason || reason,
    ...(conflicts.length
      ? { _syncConflicts: [...(entry?._syncConflicts || []), ...conflicts].slice(-100) }
      : {})
  };
}

/**
 * Bản ghi từng bị đánh dấu xóa nhầm khi remote vắng record nhưng baseline local
 * lại chứa record đó. Chỉ phục hồi đúng tombstone do nhánh lỗi
 * `remote-legacy-delete`; tombstone xóa thật (`local-delete`/`remote-delete`)
 * vẫn được giữ nguyên.
 */
export function recoverFalseLegacyDeleteTombstones(entries) {
  return (entries || []).map((entry) => {
    if (
      !entry?.deletedAt ||
      entry?.deleteReason !== "remote-legacy-delete" ||
      !(entry?._syncConflicts || []).some(
        (item) => item?.field === "$legacyDelete" && item?.localValue
      )
    ) {
      return entry;
    }
    const next = { ...entry };
    delete next.deletedAt;
    delete next.deleteReason;
    const remaining = (next._syncConflicts || []).filter(
      (item) => item?.field !== "$legacyDelete"
    );
    if (remaining.length) next._syncConflicts = remaining;
    else delete next._syncConflicts;
    return next;
  });
}

/**
 * Merge ba chiều một day document.
 * - Hai máy sửa hai record khác nhau: giữ cả hai.
 * - Xóa: tạo tombstone, nên snapshot cũ không làm record sống lại.
 * - Cùng sửa một field: giữ cloud để không ghi đè; lưu giá trị local trong conflict metadata.
 */
export function mergeOfficeBookDay(baseDay = {}, localDay = {}, remoteDay = {}) {
  const baseEntries = ensureDiaryRecordIds(
    recoverFalseLegacyDeleteTombstones(baseDay.entries || [])
  );
  const localEntries = alignLegacyRecordIds(
    recoverFalseLegacyDeleteTombstones(localDay.entries || []),
    baseEntries
  );
  const remoteEntries = alignLegacyRecordIds(
    recoverFalseLegacyDeleteTombstones(remoteDay.entries || []),
    baseEntries
  );
  const baseMap = new Map(baseEntries.map((entry) => [entry.recordId, entry]));
  const localMap = new Map(localEntries.map((entry) => [entry.recordId, entry]));
  const remoteMap = new Map(remoteEntries.map((entry) => [entry.recordId, entry]));
  const ids = new Set([...baseMap.keys(), ...localMap.keys(), ...remoteMap.keys()]);
  const entries = [];
  const conflicts = [];

  ids.forEach((id) => {
    const b = baseMap.get(id);
    const l = localMap.get(id);
    const r = remoteMap.get(id);
    const localDeleted = Boolean(b && !l);
    const remoteDeleted = Boolean(r?.deletedAt);

    if (localDeleted) {
      const remoteChanged = Boolean(r && !same(r, b));
      const rowConflicts = remoteChanged && !remoteDeleted
        ? [conflict("$delete", null, r)]
        : [];
      entries.push(tombstone(r || b, "local-delete", rowConflicts));
      conflicts.push(...rowConflicts);
      return;
    }
    if (remoteDeleted) {
      const localChanged = Boolean(l && !same(l, b));
      const rowConflicts = localChanged ? [conflict("$delete", l, null)] : [];
      entries.push(tombstone(r, "remote-delete", rowConflicts));
      conflicts.push(...rowConflicts);
      return;
    }
    if (!b) {
      if (l && r && !same(l, r)) {
        const merged = mergeObject({}, l, r);
        entries.push({ ...merged.value, recordId: id });
        conflicts.push(...merged.conflicts);
      } else if (l || r) entries.push(clone(l || r));
      return;
    }
    if (!l) return;
    if (!r) {
      // Vắng record trên remote không đủ chứng minh đã xóa. Xóa thật phải có
      // tombstone; giữ local để không làm mất bản ghi chưa từng được đẩy cloud.
      entries.push(clone(l));
      return;
    }
    if (same(l, b)) entries.push(clone(r));
    else if (same(r, b) || same(l, r)) entries.push(clone(l));
    else {
      const merged = mergeObject(b, l, r);
      entries.push({ ...merged.value, recordId: id });
      conflicts.push(...merged.conflicts);
    }
  });

  const meta = mergeObject(
    baseDay.dayMeta || {},
    localDay.dayMeta || {},
    remoteDay.dayMeta || {}
  );
  conflicts.push(...meta.conflicts);
  return {
    entries: dedupeDiaryEntriesByFingerprint(entries),
    dayMeta: meta.value,
    conflicts
  };
}

/**
 * Hydrate lần đầu không có common ancestor: union theo nội dung (fingerprint),
 * không union mù theo recordId — tránh nhân đôi khi local/cloud cùng dòng nhưng khác id.
 * Trùng fingerprint → cloud; cùng recordId nhưng khác nội dung → giữ local (sửa chưa push).
 */
export function mergeOfficeBookDayWithoutBase(localDay = {}, remoteDay = {}) {
  const localEntries = ensureDiaryRecordIds(
    dedupeDiaryEntriesByFingerprint(
      recoverFalseLegacyDeleteTombstones(localDay.entries || [])
    )
  );
  const remoteEntries = ensureDiaryRecordIds(
    alignLegacyRecordIds(
      dedupeDiaryEntriesByFingerprint(
        recoverFalseLegacyDeleteTombstones(remoteDay.entries || [])
      ),
      localEntries
    )
  );

  const remoteById = new Map(
    remoteEntries.map((entry) => [entry.recordId, entry])
  );
  const remoteLiveFps = new Set(
    remoteEntries
      .filter((entry) => !entry?.deletedAt)
      .map((entry) => diaryBusinessFingerprint(entry))
  );

  const entries = remoteEntries.map((entry) => clone(entry));
  const conflicts = [];
  const claimedRemoteIds = new Set(remoteById.keys());

  localEntries.forEach((local) => {
    if (local?.deletedAt) {
      // Tombstone local thắng bản sống cùng id / cùng fingerprint trên cloud
      // (tránh hydrate làm dòng vừa xóa «sống lại»).
      const fp = diaryBusinessFingerprint(local);
      let replaced = false;
      for (let i = 0; i < entries.length; i += 1) {
        const cur = entries[i];
        if (cur?.deletedAt) continue;
        const sameId =
          local.recordId && cur.recordId && String(cur.recordId) === String(local.recordId);
        const sameFp = diaryBusinessFingerprint(cur) === fp;
        if (sameId || sameFp) {
          entries[i] = clone(local);
          claimedRemoteIds.add(local.recordId);
          replaced = true;
        }
      }
      if (!replaced && !claimedRemoteIds.has(local.recordId)) {
        entries.push(clone(local));
        claimedRemoteIds.add(local.recordId);
      }
      return;
    }
    const fp = diaryBusinessFingerprint(local);
    if (remoteLiveFps.has(fp)) {
      const idx = entries.findIndex(
        (e) =>
          !e?.deletedAt &&
          ((local.recordId && e.recordId === local.recordId) ||
            diaryBusinessFingerprint(e) === fp)
      );
      if (idx >= 0 && (!local.recordId || entries[idx].recordId === local.recordId)) {
        entries[idx] = keepRicherEntry(entries[idx], local);
        return;
      }
      if (!local.recordId) return;
    }
    if (claimedRemoteIds.has(local.recordId)) {
      const remote = remoteById.get(local.recordId);
      if (remote && !same(local, remote) && !remote.deletedAt) {
        const rowConflict = conflict("$hydrate", local, remote);
        const idx = entries.findIndex((e) => e.recordId === local.recordId);
        if (idx >= 0) {
          // Giữ bản local (vd. vừa sửa plannedRepairDate chưa kịp push).
          // Caller phải đánh dấu ngày dirty và đẩy lại cloud — nếu giữ remote thì F5 mất sửa.
          entries[idx] = {
            ...local,
            _syncConflicts: [...(local._syncConflicts || []), rowConflict].slice(-100)
          };
        }
        conflicts.push(rowConflict);
      }
      return;
    }
    entries.push(clone(local));
    claimedRemoteIds.add(local.recordId);
  });

  return {
    entries,
    dayMeta: { ...(localDay.dayMeta || {}), ...(remoteDay.dayMeta || {}) },
    conflicts
  };
}

export function mergeReportMeta(baseMeta = {}, localMeta = {}, remoteMeta = {}) {
  return mergeObject(baseMeta, localMeta, remoteMeta);
}

export function activeDiaryEntries(entries) {
  return recoverFalseLegacyDeleteTombstones(entries).filter((entry) => !entry?.deletedAt);
}
