/**
 * Migration một lần: bổ sung field điều hành cho incidents cũ (không xóa field cũ).
 *
 * Cách chạy:
 *   cd scripts && npm install && set GOOGLE_APPLICATION_CREDENTIALS=path\to\serviceAccount.json
 *   node migrate-incidents.mjs [--dry-run]
 *
 * Quy tắc suy luận an toàn:
 *   - Không có afterImages -> NEW, progress 0
 *   - Có afterImages -> PARTIAL, progress 90
 *   - createdAt: giữ nếu đã có; không thì parse field date (dd/MM/yyyy hoặc yyyy-MM-dd)
 *   - updates: chỉ tạo mảng khởi tạo nếu chưa có
 */

import { existsSync, readFileSync } from 'fs'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore'

const DRY_RUN = process.argv.includes('--dry-run')

function argValue(prefix) {
  const hit = process.argv.find((a) => a.startsWith(`${prefix}=`))
  return hit ? hit.slice(prefix.length + 1).trim() : ''
}

const ONLY_UID = argValue('--uid')
const ONLY_EMAIL = argValue('--email').toLowerCase()

function initAdmin() {
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (!credPath) {
    console.error(
      'Thiếu GOOGLE_APPLICATION_CREDENTIALS.\n' +
        'CMD:     set GOOGLE_APPLICATION_CREDENTIALS=C:\\duong\\dan\\key.json\n' +
        'PowerShell: $env:GOOGLE_APPLICATION_CREDENTIALS="C:\\duong\\dan\\key.json"',
    )
    process.exit(1)
  }
  if (!existsSync(credPath)) {
    console.error('Không tìm thấy file key:', credPath)
    process.exit(1)
  }
  const serviceAccount = JSON.parse(readFileSync(credPath, 'utf8'))
  const projectId = process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id
  if (!projectId) {
    console.error('Không có project_id. Thêm FIREBASE_PROJECT_ID hoặc dùng file service account hợp lệ.')
    process.exit(1)
  }
  if (!getApps().length) {
    initializeApp({
      credential: cert(serviceAccount),
      projectId,
    })
  }
  console.log('Project:', projectId, DRY_RUN ? '(DRY-RUN)' : '')
}

function parseDateToMillis(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null
  const s = dateStr.trim()
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s)
  if (dmy) {
    const [, d, m, y] = dmy
    return new Date(Number(y), Number(m) - 1, Number(d)).getTime()
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (iso) {
    const [, y, m, d] = iso
    return new Date(Number(y), Number(m) - 1, Number(d)).getTime()
  }
  const compact = /^(\d{2})(\d{2})(\d{4})$/.exec(s)
  if (compact) {
    const [, d, m, y] = compact
    return new Date(Number(y), Number(m) - 1, Number(d)).getTime()
  }
  return null
}

function normalizeIncidentDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return todayIso()
  const s = dateStr.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s)
  if (dmy) {
    const [, d, m, y] = dmy
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  const compact = /^(\d{2})(\d{2})(\d{4})$/.exec(s)
  if (compact) {
    const [, d, m, y] = compact
    return `${y}-${m}-${d}`
  }
  return todayIso()
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function inferStatusProgress(data) {
  const after = Array.isArray(data.afterImages) ? data.afterImages : []
  if (data.status && typeof data.progress === 'number') {
    return { status: data.status, progress: data.progress }
  }
  if (after.length > 0) {
    return { status: 'PARTIAL', progress: 90 }
  }
  return { status: 'NEW', progress: 0 }
}

function buildInitialUpdate(data, progress, userName = '') {
  const before = Array.isArray(data.beforeImages) ? data.beforeImages : []
  return {
    date: normalizeIncidentDate(data.date),
    progress: 0,
    note: (data.note && String(data.note).trim()) || 'Phát hiện sự cố (migration)',
    images: before,
    createdBy: String(data.createdByName ?? '').trim() || userName || 'migration',
  }
}

async function resolveTargetUsers(db) {
  if (ONLY_UID) {
    const ref = db.collection('users').doc(ONLY_UID)
    const snap = await ref.get()
    if (!snap.exists) {
      console.error('Không tìm thấy user uid:', ONLY_UID)
      process.exit(1)
    }
    return [snap]
  }
  const all = await db.collection('users').get()
  if (!ONLY_EMAIL) return all.docs
  const hits = all.docs.filter(
    (d) => String(d.data().email ?? '').trim().toLowerCase() === ONLY_EMAIL,
  )
  if (hits.length === 0) {
    console.error('Không tìm thấy user email:', ONLY_EMAIL)
    process.exit(1)
  }
  return hits
}

async function main() {
  initAdmin()
  const db = getFirestore()
  let userDocs
  try {
    userDocs = await resolveTargetUsers(db)
  } catch (e) {
    console.error('Không đọc được users:', e.message)
    process.exit(1)
  }

  if (ONLY_UID || ONLY_EMAIL) {
    console.log(`Chỉ xử lý ${userDocs.length} user(s)`)
  }

  let patched = 0
  let skipped = 0

  for (const userDoc of userDocs) {
    const uid = userDoc.id
    const userData = userDoc.data()
    const userCompanyId = String(userData.companyId ?? '').trim()
    const userName = String(userData.name ?? '').trim()
    const userPatch = {}
    if (userData.role == null) userPatch.role = 'USER'
    if (userData.companyId == null) userPatch.companyId = ''
    if (userCompanyId && userData.active !== true) userPatch.active = true

    if (Object.keys(userPatch).length > 0) {
      console.log(`User ${uid} (${userName || userData.email || '—'}):`, userPatch)
      if (!DRY_RUN) {
        await userDoc.ref.set(userPatch, { merge: true })
      }
    }

    const incidents = await userDoc.ref.collection('incidents').get()
    for (const doc of incidents.docs) {
      const data = doc.data()
      if (data.deleted === 1) {
        skipped++
        continue
      }

      const incidentCompanyId = String(data.companyId ?? '').trim()
      const needsCompanyId =
        userCompanyId.length > 0 && incidentCompanyId !== userCompanyId

      const needs =
        data.status == null ||
        data.progress == null ||
        data.locked == null ||
        data.createdAt == null ||
        data.updatedAt == null ||
        data.priority == null ||
        !Array.isArray(data.updates) ||
        needsCompanyId

      if (!needs) {
        skipped++
        continue
      }

      const { status, progress } = inferStatusProgress(data)
      let createdMs = data.createdAt?.toMillis?.() ?? null
      if (createdMs == null) {
        createdMs = parseDateToMillis(data.date) ?? Date.now()
      }
      const locked = data.locked === true || Date.now() - createdMs >= 24 * 60 * 60 * 1000

      const normalizedDate = normalizeIncidentDate(data.date)
      const patch = {
        status: data.status ?? status,
        progress: typeof data.progress === 'number' ? data.progress : progress,
        locked: data.locked ?? locked,
        createdAt: data.createdAt ?? Timestamp.fromMillis(createdMs),
        updatedAt: data.updatedAt ?? FieldValue.serverTimestamp(),
        createdByName:
          String(data.createdByName ?? '').trim() || userName || '',
        companyId:
          String(data.companyId ?? '').trim() || userCompanyId || '',
        priority: data.priority ?? 'NORMAL',
        updates: Array.isArray(data.updates) ? data.updates : [buildInitialUpdate(data, progress, userName)],
      }
      if (normalizedDate && data.date !== normalizedDate) {
        patch.date = normalizedDate
      }

      console.log(
        `  incident ${doc.id} -> ${patch.status}/${patch.progress} companyId=${patch.companyId} locked=${patch.locked}`,
      )
      if (!DRY_RUN) {
        await doc.ref.set(patch, { merge: true })
      }
      patched++
    }
  }

  console.log(DRY_RUN ? '[DRY-RUN] ' : '', `Done. Patched=${patched}, skipped=${skipped}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
