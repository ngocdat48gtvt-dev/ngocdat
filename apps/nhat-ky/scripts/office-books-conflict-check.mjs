import assert from "node:assert/strict";
import {
  activeDiaryEntries,
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

console.log("office-books conflict checks: OK");
