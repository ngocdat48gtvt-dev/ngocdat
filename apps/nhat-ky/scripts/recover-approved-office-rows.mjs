// One-time recovery of the exact report explicitly approved on 2026-10-02.
// Uses the project owner's authorized Cloud Shell session; never changes security rules.
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { diaryBusinessFingerprint } from './officeBooksConflictMerge.mjs';
process.chdir(dirname(fileURLToPath(import.meta.url)));

const mode = process.argv[2] || 'plan';
assert(['plan', 'apply', 'verify'].includes(mode));
const project = 'quanlysuco-6797e';
const root = `projects/${project}/databases/(default)/documents`;
const base = 'https://firestore.googleapis.com/v1/';
const account = execFileSync('gcloud', ['config', 'get-value', 'account'], { encoding: 'utf8' }).trim();
assert.equal(account, 'ngocdat48gtvt@gmail.com', 'Wrong account');
const token = execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8' }).trim();
async function api(path, body) {
  // urllib honors the Cloud Shell proxy configuration. Credentials travel only through
  // the child process stdin, never command arguments, logs, or saved recovery files.
  const python = `import sys,json,gzip,urllib.request,urllib.error
p=json.load(sys.stdin)
r=urllib.request.Request(p['url'],data=json.dumps(p['body']).encode() if p.get('body') is not None else None,headers={'Authorization':'Bearer '+p['token'],'Content-Type':'application/json','Accept-Encoding':'gzip'})
try:
 with urllib.request.urlopen(r,timeout=90) as response:
  raw=response.read()
  if response.headers.get('Content-Encoding')=='gzip': raw=gzip.decompress(raw)
  print(json.dumps({'status':response.status,'value':json.loads(raw)}))
except urllib.error.HTTPError as error:
 raw=error.read()
 if error.headers.get('Content-Encoding')=='gzip': raw=gzip.decompress(raw)
 print(json.dumps({'status':error.code,'value':json.loads(raw)}))
`;
  const { spawn } = await import('node:child_process');
  const readTransport = () => new Promise((resolve, reject) => {
    const child = spawn('python3', ['-c', python]); let output = ''; let errorOutput = '';
    child.stdout.on('data', part => { output += part; });
    child.stderr.on('data', part => { errorOutput += part; });
    child.on('error', reject);
    child.on('close', code => code ? reject(new Error(`Transport failed: ${errorOutput.slice(-800)}`)) : resolve(JSON.parse(output)));
    child.stdin.end(JSON.stringify({ url: base + path, body, token }));
  });
  let result;
  for (let attempt = 0; ; attempt++) {
    try { result = await readTransport(); break; }
    catch (error) {
      if (path.endsWith(':commit') || attempt >= 2) throw error;
      console.log('READ_RETRY', attempt + 1, path.split('/').slice(-3).join('/'));
    }
  }
  if (result.status >= 400) throw new Error(`${result.status}: ${result.value.error?.message || 'Firestore error'}`);
  return result.value;
}
function decode(value) {
  if ('nullValue' in value) return null;
  if ('mapValue' in value) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, child]) => [key, decode(child)]));
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decode);
  if ('integerValue' in value) return Number(value.integerValue);
  return Object.values(value)[0];
}
function data(doc) { return decode({ mapValue: { fields: doc.fields || {} } }); }
async function list(path) {
  const docs = []; let pageToken = '';
  do {
    const page = await api(`${root}/${path}?pageSize=100${pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : ''}`);
    docs.push(...(page.documents || [])); pageToken = page.nextPageToken || '';
  } while (pageToken);
  return docs;
}
function entries(doc, date) {
  assert(doc.fields?.entries?.arrayValue, `Expected entries array: ${doc.name}`);
  return (doc.fields.entries.arrayValue.values || []).map((raw) => {
    const entry = decode(raw);
    return /^\d{4}-\d{2}-\d{2}$/.test(String(entry.date || '').trim()) ? entry : { ...entry, date };
  });
}
function grouped(doc, date) {
  const rows = entries(doc, date);
  const live = new Set(rows.filter(row => !row.deletedAt).map(diaryBusinessFingerprint));
  const groups = new Map();
  rows.forEach((row, index) => {
    const key = diaryBusinessFingerprint(row);
    if (!row.deletedAt || live.has(key)) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ row, index });
  });
  return [...groups.values()].map(history => {
    history.sort((a, b) => String(b.row.deletedAt).localeCompare(String(a.row.deletedAt)));
    const { row, index } = history[0];
    const batches = new Set(history.map(item => item.row.deletedAt)).size;
    const conflict = (row._syncConflicts || []).some(item => item.field === '$delete');
    const text = `${row.section ?? ''}: ${row.type ?? ''}, ${row.kmFrom ?? ''} → ${row.kmTo ?? ''}; ${history.length} bản, ${batches} lần xóa${conflict ? '; có xung đột xóa' : ''}; gần nhất ${row.deletedAt}`;
    return { row, index, text, versions: history.length, batches, conflict, fingerprint: diaryBusinessFingerprint(row) };
  });
}
const summary = plans => ({ days: plans.length, groups: plans.reduce((n, day) => n + day.rows.length, 0),
  users: [...new Set(plans.map(day => day.name))] });
await fs.mkdir('before', { recursive: true });
if (mode === 'plan') {
  const approved = JSON.parse(await fs.readFile('approved.json', 'utf8'));
  assert.equal(approved.length, 437); assert.equal(approved.reduce((n, day) => n + day.candidates.length, 0), 2043);
  const tien = await api(`${root}/users/dPvKFBn5wday9a8EVpyP0afDm5M2`);
  const response = await api(`${root}:runQuery`, { structuredQuery: { from: [{ collectionId: 'users' }],
    where: { compositeFilter: { op: 'AND', filters: [
      { fieldFilter: { field: { fieldPath: 'companyId' }, op: 'EQUAL', value: tien.fields.companyId } },
      { fieldFilter: { field: { fieldPath: 'role' }, op: 'EQUAL', value: { stringValue: 'USER' } } }
    ] } } } });
  const users = response.filter(item => item.document).map(item => ({ doc: item.document, ...data(item.document) }));
  let plans = [];
  try { plans = JSON.parse(await fs.readFile('plan-partial.json', 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  for (const day of plans) {
    const approvedDay = approved.find(item => item.name === day.name && item.road === day.roadName && item.date === day.date);
    assert(approvedDay, 'Checkpoint outside approved scope');
    const normalize = text => text.trim().replace(/\s+/g, ' ');
    assert.deepEqual(day.rows.map(row => normalize(row.text)).sort(), approvedDay.candidates.map(normalize).sort(), 'Checkpoint scope changed');
  }
  for (const name of [...new Set(approved.map(day => day.name))]) {
    const matches = users.filter(user => (user.name || user.displayName || user.email || user.doc.name.split('/').pop()) === name);
    assert.equal(matches.length, 1, `Ambiguous user ${name}`);
    const user = matches[0]; const uid = user.doc.name.split('/').pop();
    const books = await list(`users/${uid}/office_books`);
    const catalogDoc = await api(`${root}/users/${uid}/master_data/office_roads_catalog`);
    const roads = data(catalogDoc).roads || [];
    const userDays = approved.filter(day => day.name === name && !plans.some(plan => plan.name === name && plan.roadName === day.road && plan.date === day.date));
    for (let offset = 0; offset < userDays.length; offset += 6) {
      const batch = await Promise.all(userDays.slice(offset, offset + 6).map(async (approvedDay) => {
      const ids = new Set(books.filter(book => (data(book).reportMeta?.roadName || book.name.split('/').pop()) === approvedDay.road).map(book => book.name.split('/').pop()));
      roads.filter(road => (road.roadName || road.label || road.id) === approvedDay.road).forEach(road => ids.add(road.id));
      const normalized = text => text.trim().replace(/\s+/g, ' ');
      const expected = new Map();
      approvedDay.candidates.forEach(text => expected.set(normalized(text), (expected.get(normalized(text)) || 0) + 1));
      assert(ids.size > 0, `Missing road ${name}/${approvedDay.road}`);
      const candidates = [];
      for (const roadId of ids) {
        const path = `${root}/users/${uid}/office_books/${roadId}/days/${approvedDay.date}`;
        let doc;
        try { doc = await api(path); }
        catch (error) { if (error.message.startsWith('404:')) continue; throw error; }
        if (!doc.fields?.entries?.arrayValue) continue;
        const groups = grouped(doc, approvedDay.date);
        if (entries(doc, approvedDay.date).filter(row => !row.deletedAt).length !== approvedDay.liveRows) continue;
        if ([...expected].every(([text, count]) => groups.filter(group => normalized(group.text) === text).length === count)) candidates.push({ roadId, path, doc, groups });
      }
      assert.equal(candidates.length, 1, `Report does not uniquely identify road ${name}/${approvedDay.road}/${approvedDay.date}`);
      const { roadId, path, groups } = candidates[0]; const rows = [];
      for (const [text, count] of expected) {
        const matches = groups.filter(group => normalized(group.text) === text);
        // Identical displayed summaries can represent different side/dimension groups.
        // Require the exact multiplicity from the approved report before selecting any.
        assert.equal(matches.length, count, `Report changed: ${name}/${approvedDay.date}: ${text}`);
        for (const group of matches) {
          assert(group.versions >= 2 && group.batches >= 2 && group.conflict && /^2026-10-0[12]T/.test(group.row.deletedAt));
          assert(group.row.recordId, 'Missing record ID');
          rows.push({ recordId: group.row.recordId, deletedAt: group.row.deletedAt, fingerprint: group.fingerprint, text });
        }
      }
      assert.equal(new Set(rows.map(row => row.recordId)).size, rows.length, 'Duplicate selected IDs');
      return { name, uid, roadId, roadName: approvedDay.road, date: approvedDay.date, path, rows };
      }));
      plans.push(...batch);
      await fs.writeFile('plan-partial.json', JSON.stringify(plans));
      console.log('READ', name, Math.min(offset + 6, userDays.length), '/', userDays.length);
    }
    console.log('PLANNED', name, summary(plans).groups);
  }
  assert.equal(summary(plans).groups, 2043); assert.equal(plans.length, 437); assert.equal(summary(plans).users.length, 7);
  await fs.writeFile('plan.json', JSON.stringify(plans, null, 2), { flag: 'wx' });
  console.log('PLAN_OK', JSON.stringify(summary(plans)));
} else {
  const plans = JSON.parse(await fs.readFile('plan.json', 'utf8'));
  assert.equal(summary(plans).groups, 2043); assert.equal(plans.length, 437);
  const completed = []; const errors = [];
  for (const day of plans) {
    try {
      const before = await api(day.path); const beforeRows = entries(before, day.date);
      const selected = new Map(day.rows.map(row => [row.recordId, row]));
      const already = day.rows.every(row => beforeRows.some(entry => entry.recordId === row.recordId && !entry.deletedAt && diaryBusinessFingerprint(entry) === row.fingerprint));
      if (mode === 'apply' && !already) {
        const values = before.fields.entries.arrayValue.values;
        const next = structuredClone(values); let changed = 0;
        for (let i = 0; i < beforeRows.length; i++) {
          const row = beforeRows[i]; const chosen = selected.get(row.recordId);
          if (!chosen) continue;
          assert.equal(row.deletedAt, chosen.deletedAt, 'Delete state changed');
          assert.equal(diaryBusinessFingerprint(row), chosen.fingerprint, 'Row changed');
          assert(!beforeRows.some(entry => !entry.deletedAt && diaryBusinessFingerprint(entry) === chosen.fingerprint), 'A live version already exists');
          delete next[i].mapValue.fields.deletedAt;
          delete next[i].mapValue.fields.deleteReason;
          delete next[i].mapValue.fields._pendingDelete;
          changed++;
        }
        assert.equal(changed, day.rows.length);
        const filename = `before/${day.uid}_${day.roadId}_${day.date}.json`;
        try { await fs.writeFile(filename, JSON.stringify(before), { flag: 'wx' }); }
        catch (error) { if (error.code !== 'EEXIST') throw error; }
        await api(`${root}:commit`, { writes: [{ update: { name: before.name, fields: {
          entries: { arrayValue: { values: next } }, revision: { integerValue: String((Number(data(before).revision) || 0) + 1) }
        } }, updateMask: { fieldPaths: ['entries', 'revision'] },
          currentDocument: { updateTime: before.updateTime },
          updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }] }] });
      }
      const after = mode === 'apply' ? await api(day.path) : before;
      const afterRows = entries(after, day.date);
      for (const chosen of day.rows) {
        const matches = afterRows.filter(row => row.recordId === chosen.recordId);
        assert.equal(matches.length, 1); assert(!matches[0].deletedAt); assert.equal(diaryBusinessFingerprint(matches[0]), chosen.fingerprint);
      }
      const saved = JSON.parse(await fs.readFile(`before/${day.uid}_${day.roadId}_${day.date}.json`, 'utf8'));
      assert.equal(afterRows.length, entries(saved, day.date).length);
      const savedValues = saved.fields.entries.arrayValue.values;
      const afterValues = after.fields.entries.arrayValue.values;
      savedValues.forEach((value, i) => {
        const expected = structuredClone(value);
        if (selected.has(decode(value).recordId)) {
          delete expected.mapValue.fields.deletedAt; delete expected.mapValue.fields.deleteReason; delete expected.mapValue.fields._pendingDelete;
        }
        assert.deepEqual(afterValues[i], expected, 'Unexpected row changes');
      });
      assert.deepEqual(after.fields.dayMeta, saved.fields.dayMeta, 'Unexpected day metadata changes');
      completed.push(day); if (completed.length % 20 === 0) console.log(mode.toUpperCase(), completed.length, summary(completed).groups);
    } catch (error) { errors.push({ name: day.name, date: day.date, path: day.path, message: error.message }); console.error('DAY_FAILED', day.name, day.date, error.message); }
  }
  const report = { mode, completed: summary(completed), errors, byUser: summary(completed).users.map(name => ({ name, ...summary(completed.filter(day => day.name === name)) })) };
  await fs.writeFile(`${mode}-result.json`, JSON.stringify(report, null, 2));
  console.log('RESULT', JSON.stringify(report));
  if (errors.length) process.exitCode = 1;
}
