/**
 * Dọn ảnh trùng trên Firebase (Admin SDK) — chỉ chạy CLI, không qua web.
 *
 * Dry-run:
 *   gcloud auth application-default login
 *   $env:FIREBASE_PROJECT_ID="quanlysuco-6797e"
 *   node scripts/cleanup-duplicate-photos.mjs --uid=USER_UID
 *
 * Ghi thật:
 *   node scripts/cleanup-duplicate-photos.mjs --apply --uid=USER_UID
 */
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { applicationDefault, initializeApp, getApps, getApp } = require('firebase-admin/app')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const { getStorage } = require('firebase-admin/storage')

const apply = process.argv.includes('--apply')
const uidArg = process.argv.find((a) => a.startsWith('--uid='))
const onlyUid = uidArg ? uidArg.slice('--uid='.length).trim() : ''

function initApp() {
  if (getApps().length) return getApp()
  const projectId = process.env.FIREBASE_PROJECT_ID
  if (!projectId) throw new Error('Thiếu FIREBASE_PROJECT_ID; hãy đăng nhập Application Default Credentials')
  const bucket =
    process.env.FIREBASE_STORAGE_BUCKET ||
    `${projectId}.firebasestorage.app`
  return initializeApp({
    credential: applicationDefault(),
    projectId,
    storageBucket: bucket,
  })
}

function storageFileBaseName(urlOrPath) {
  let s = String(urlOrPath || '').trim().split(/[?#]/)[0]
  const slash = s.lastIndexOf('/')
  if (slash >= 0) s = s.slice(slash + 1)
  try {
    s = decodeURIComponent(s)
  } catch {
    /* keep */
  }
  while (/^[a-z]?\d{13}[-_]/i.test(s)) {
    s = s.replace(/^[a-z]?\d{13}[-_]/i, '')
  }
  return s
}

function photoToken(ref) {
  let s = storageFileBaseName(ref)
  if (!s) return ''
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd')
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function captureStampKey(url) {
  const base = storageFileBaseName(url).toLowerCase()
  const m = /_(before|after)_(\d{13})/.exec(base)
  return m ? `${m[1]}_${m[2]}` : ''
}

function isCacheHash(url) {
  return /^[a-f0-9]{32}\.jpe?g$/i.test(storageFileBaseName(url))
}

function uploadMillis(path) {
  let name = String(path || '').trim().split(/[?#]/)[0]
  const slash = name.lastIndexOf('/')
  if (slash >= 0) name = name.slice(slash + 1)
  try {
    name = decodeURIComponent(name)
  } catch {
    /* keep */
  }
  const m = /^[a-z]?(\d{13})/i.exec(name)
  return m ? Number(m[1]) : null
}

function preferKeep(a, b) {
  const aHash = isCacheHash(a)
  const bHash = isCacheHash(b)
  if (aHash !== bHash) return aHash ? b : a
  const ca = captureStampKey(a)
  const cb = captureStampKey(b)
  if (ca && !cb) return a
  if (!ca && cb) return b
  const ma = uploadMillis(a)
  const mb = uploadMillis(b)
  if (ma != null && mb != null && ma !== mb) return ma < mb ? a : b
  return a
}

function isSame(a, b) {
  if (a === b) return true
  const ta = photoToken(a)
  const tb = photoToken(b)
  if (ta && ta === tb) return true
  const ca = captureStampKey(a)
  const cb = captureStampKey(b)
  return !!(ca && ca === cb)
}

function dedupeByToken(urls) {
  const result = []
  const removed = []
  const byToken = new Map()
  const byCap = new Map()
  for (const raw of urls) {
    const url = String(raw || '').trim()
    if (!url.startsWith('http')) continue
    const dup = result.findIndex((e) => isSame(e, url))
    if (dup >= 0) {
      const keep = preferKeep(result[dup], url)
      const drop = keep === result[dup] ? url : result[dup]
      result[dup] = keep
      if (drop !== keep) removed.push(drop)
      continue
    }
    const pt = photoToken(url)
    if (pt && byToken.has(pt)) {
      const i = byToken.get(pt)
      const keep = preferKeep(result[i], url)
      const drop = keep === result[i] ? url : result[i]
      result[i] = keep
      if (drop !== keep) removed.push(drop)
      continue
    }
    const cap = captureStampKey(url)
    if (cap && byCap.has(cap)) {
      const i = byCap.get(cap)
      const keep = preferKeep(result[i], url)
      const drop = keep === result[i] ? url : result[i]
      result[i] = keep
      if (drop !== keep) removed.push(drop)
      continue
    }
    const idx = result.length
    result.push(url)
    if (pt) byToken.set(pt, idx)
    if (cap) byCap.set(cap, idx)
  }
  return { kept: result, removed }
}

function removeCacheHashesWhenDescriptive(urls) {
  const step = dedupeByToken(urls)
  const list = step.kept
  const removed = [...step.removed]
  const hashes = list.filter(isCacheHash)
  const desc = list.filter((u) => !isCacheHash(u))
  if (desc.length > 0 && hashes.length > 0) {
    return { kept: desc, removed: [...removed, ...hashes] }
  }
  return { kept: list, removed }
}

function objectKeyFromUrl(url) {
  const m = /\/o\/([^?]+)/.exec(String(url || ''))
  if (!m) return null
  try {
    return decodeURIComponent(m[1])
  } catch {
    return m[1]
  }
}

async function byteSize(bucket, url) {
  const key = objectKeyFromUrl(url)
  if (!key) return null
  try {
    const [meta] = await bucket.file(key).getMetadata()
    const n = Number(meta.size)
    return Number.isFinite(n) && n > 0 ? n : null
  } catch {
    return null
  }
}

async function dedupeField(bucket, urls) {
  const step1 = removeCacheHashesWhenDescriptive(urls)
  let working = step1.kept
  const removed = [...step1.removed]

  if (working.length >= 2) {
    const sized = []
    for (const u of working) {
      sized.push({ u, size: await byteSize(bucket, u) })
    }
    const bySize = new Map()
    const unknown = []
    for (const { u, size } of sized) {
      if (size == null) {
        unknown.push(u)
        continue
      }
      const g = bySize.get(size) || []
      g.push(u)
      bySize.set(size, g)
    }
    const kept = [...unknown]
    for (const group of bySize.values()) {
      if (group.length === 1) {
        kept.push(group[0])
        continue
      }
      let best = group[0]
      for (let i = 1; i < group.length; i++) best = preferKeep(best, group[i])
      kept.push(best)
      for (const u of group) {
        if (u !== best) removed.push(u)
      }
    }
    working = dedupeByToken(kept).kept
  }

  const keptSet = new Set(working)
  return {
    kept: working,
    removed: [...new Set(removed.filter((u) => !keptSet.has(u)))],
  }
}

function httpList(raw) {
  if (Array.isArray(raw)) {
    return raw.map((e) => String(e || '').trim()).filter((u) => u.startsWith('http'))
  }
  if (typeof raw === 'string' && raw.trim()) {
    return raw
      .split('|')
      .map((s) => s.trim())
      .filter((u) => u.startsWith('http'))
  }
  return []
}

async function main() {
  if (!onlyUid) {
    console.error('Bắt buộc --uid=... để tránh dọn nhầm toàn bộ user.')
    process.exit(1)
  }

  initApp()
  const db = getFirestore()
  const bucket = getStorage().bucket()

  console.log(apply ? '=== APPLY (ghi Firestore) ===' : '=== DRY-RUN (không ghi) ===')
  console.log(`Chỉ user: ${onlyUid}`)

  let scanned = 0
  let changed = 0
  let removedTotal = 0

  const incSnap = await db
    .collection('users')
    .doc(onlyUid)
    .collection('incidents')
    .get()

  for (const doc of incSnap.docs) {
    const data = doc.data() || {}
    if (data.deleted === 1) continue
    scanned++
    const beforeRaw = httpList(data.beforeImages)
    const afterRaw = httpList(data.afterImages)
    if (beforeRaw.length < 2 && afterRaw.length < 2) continue

    const before = await dedupeField(bucket, beforeRaw)
    const after = await dedupeField(bucket, afterRaw)
    const removed = [...before.removed, ...after.removed]
    const sameBefore =
      before.kept.length === beforeRaw.length &&
      before.kept.every((u, i) => u === beforeRaw[i])
    const sameAfter =
      after.kept.length === afterRaw.length &&
      after.kept.every((u, i) => u === afterRaw[i])
    if (sameBefore && sameAfter && removed.length === 0) continue

    changed++
    removedTotal += removed.length
    console.log(
      `[${onlyUid}/${doc.id}] before ${beforeRaw.length}→${before.kept.length}, after ${afterRaw.length}→${after.kept.length}, trash ${removed.length}`,
    )

    if (!apply) continue

    const trashItems = [
      ...before.removed.map((url) => ({
        url,
        kind: 'before',
        trashedAtMs: Date.now(),
        reason: isCacheHash(url) ? 'cache-hash-dup' : 'dup',
      })),
      ...after.removed.map((url) => ({
        url,
        kind: 'after',
        trashedAtMs: Date.now(),
        reason: isCacheHash(url) ? 'cache-hash-dup' : 'dup',
      })),
    ]
    const prevTrash = Array.isArray(data.trashedDuplicatePhotos)
      ? data.trashedDuplicatePhotos
      : []
    const nextTrash = [
      ...prevTrash.filter(
        (t) => !trashItems.some((n) => n.url === t.url || isSame(n.url, t.url)),
      ),
      ...trashItems,
    ]
    const prevDeleted = Array.isArray(data.deletedImageUrls)
      ? data.deletedImageUrls
      : []
    const nextDeleted = [...new Set([...prevDeleted, ...removed])]

    await doc.ref.update({
      beforeImages: before.kept,
      afterImages: after.kept,
      trashedDuplicatePhotos: nextTrash,
      deletedImageUrls: nextDeleted,
      updatedAt: FieldValue.serverTimestamp(),
    })
  }

  console.log(
    `\nQuét ${scanned} sự cố · ${changed} cần sửa · ${removedTotal} URL thừa`,
  )
  if (!apply) {
    console.log('Chạy lại với --apply để ghi Firestore (chỉ UID này).')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
