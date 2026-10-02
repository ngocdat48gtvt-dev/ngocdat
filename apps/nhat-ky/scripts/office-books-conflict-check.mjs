import assert from "node:assert/strict";
import {
  activeDiaryEntries,
  boundDayConflictHistory,
  ensureDiaryRecordIds,
  mergeOfficeBookDay,
  mergeOfficeBookDayWithoutBase,
  mergeReportMeta
} from "../src/utils/officeBooksConflictMerge.js";

function row(recordId, content, extra = {}) {
  return { recordId, date: "2026-08-08", content, ...extra };
}

{
  const base = { entries: [row("a", "A0"), row("b", "B0")], dayMeta: {} };
  const local = { entries: [row("a", "A1"), row("b", "B0")], dayMeta: {} };
  const remote = { entries: [row("a", "A0"), row("b", "B1")], dayMeta: {} };
  const merged = mergeOfficeBookDay(base, local, remote);
  assert.equal(merged.entries.find((e) => e.recordId === "a").content, "A1");
  assert.equal(merged.entries.find((e) => e.recordId === "b").content, "B1");
  assert.equal(merged.conflicts.length, 0);
}

{
  const base = { entries: [row("a", "v0")], dayMeta: {} };
  const local = { entries: [row("a", "local")], dayMeta: {} };
  const remote = { entries: [row("a", "remote")], dayMeta: {} };
  const merged = mergeOfficeBookDay(base, local, remote);
  const result = merged.entries[0];
  assert.equal(result.content, "remote");
  assert.equal(result._syncConflicts.at(-1).localValue, "local");
  assert.equal(result._syncConflicts.at(-1).remoteValue, "remote");
}

{
  const base = { entries: [row("a", "v0")], dayMeta: {} };
  const deleted = mergeOfficeBookDay(base, { entries: [], dayMeta: {} }, base);
  assert.ok(deleted.entries[0].deletedAt);
  const stale = mergeOfficeBookDay(
    { entries: deleted.entries, dayMeta: {} },
    { entries: [row("a", "v0")], dayMeta: {} },
    { entries: deleted.entries, dayMeta: {} }
  );
  assert.equal(activeDiaryEntries(stale.entries).length, 0);
}

{
  const entries = ensureDiaryRecordIds([{ date: "2026-08-08", content: "legacy" }]);
  assert.match(entries[0].recordId, /^nk_/);
  const union = mergeOfficeBookDayWithoutBase(
    { entries, dayMeta: {} },
    { entries: [row("cloud", "cloud")], dayMeta: {} }
  );
  assert.equal(activeDiaryEntries(union.entries).length, 2);
}

{
  const merged = mergeReportMeta(
    { trafficDutyPerson: "A", ntNhaThauTen: "B" },
    { trafficDutyPerson: "A2", ntNhaThauTen: "B" },
    { trafficDutyPerson: "A", ntNhaThauTen: "B2" }
  );
  assert.deepEqual(merged.value, {
    trafficDutyPerson: "A2",
    ntNhaThauTen: "B2"
  });
}

{
  const cloud = Array.from({ length: 8 }, (_, i) => row(`cloud-${i}`, `Row ${i}`));
  const local = cloud.map((entry, i) => i < 6
    ? { ...entry, deletedAt: "2026-09-30T00:00:00Z", deleteReason: "remote-delete" }
    : entry);
  const merged = mergeOfficeBookDayWithoutBase(
    { entries: local }, { entries: cloud }
  );
  assert.equal(activeDiaryEntries(merged.entries).length, 8,
    "Cached tombstones must not hide live cloud rows");
}

{
  const restored = row("restored", "same content");
  const merged = mergeOfficeBookDayWithoutBase(
    { entries: [row("old", "same content", { deletedAt: "2026-09-30T00:00:00Z" })] },
    { entries: [restored] }
  );
  assert.deepEqual(activeDiaryEntries(merged.entries), [restored],
    "Tombstone of another record must not delete a reimported cloud row");
  const deleted = mergeOfficeBookDayWithoutBase(
    { entries: [restored] },
    { entries: [{ ...restored, deletedAt: "2026-09-30T00:00:00Z" }] }
  );
  assert.equal(activeDiaryEntries(deleted.entries).length, 0,
    "Actual cloud deletion must still win");
}

{
  const cloud = row("nested", "cloud");
  let local = row("nested", "unsaved edit");
  for (let i = 0; i < 30; i++) {
    local = mergeOfficeBookDayWithoutBase({ entries: [local] }, { entries: [cloud] }).entries[0];
  }
  assert.ok(JSON.stringify(local).length < 10000, "Hydrate must not nest conflict histories");
  assert.equal(local.content, "unsaved edit", "Compaction must preserve pending edits");
  assert.equal(local._syncConflicts.length, 1, "Identical conflicts must be deduplicated");
}

{
  const cloud = row("partial-cache", "Must stay");
  const partial = mergeOfficeBookDay({ entries: [cloud] }, { entries: [] }, { entries: [cloud] }, { requireExplicitDeletes: true });
  assert.equal(activeDiaryEntries(partial.entries).length, 1, "Partial local cache cannot delete cloud rows");
  const pending = { ...cloud, deletedAt: "2026-10-02T00:00:00Z", deleteReason: "local-delete", _pendingDelete: true };
  const removed = mergeOfficeBookDay({ entries: [cloud] }, { entries: [pending] }, { entries: [cloud] }, { requireExplicitDeletes: true });
  assert.equal(activeDiaryEntries(removed.entries).length, 0, "Explicit user deletion must sync");
  assert.equal(removed.entries[0]._pendingDelete, undefined, "Acknowledged deletion must not remain pending");
  const cache = { ...pending }; delete cache._pendingDelete;
  const restored = mergeOfficeBookDay({}, { entries: [cache] }, { entries: [cloud] }, { requireExplicitDeletes: true });
  assert.equal(activeDiaryEntries(restored.entries).length, 1, "Old acknowledged tombstone cannot delete a restored cloud row");
}

{
  const entries = Array.from({ length: 100 }, (_, i) => row(String(i), "Giữ nội dung", {
    _syncConflicts: Array.from({ length: 20 }, (_, j) => ({ field: String(j), localValue: "x".repeat(4000), remoteValue: "y" }))
  }));
  const bounded = boundDayConflictHistory({ entries, dayMeta: {}, conflicts: [] });
  assert.equal(bounded.entries.length, 100);
  assert.ok(bounded.entries.every((entry) => entry.content === "Giữ nội dung"));
  assert.ok(Buffer.byteLength(JSON.stringify(bounded.entries)) < 80000, "Audit history must fit the day budget");
}
console.log("office-books conflict checks: OK");
