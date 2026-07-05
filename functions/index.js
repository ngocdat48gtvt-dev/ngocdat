const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { initializeApp } = require('firebase-admin/app')
const { getAuth } = require('firebase-admin/auth')
const { getFirestore } = require('firebase-admin/firestore')
const { notifyLeadTelegram } = require('./notify-lead-telegram')

initializeApp()

const ADMIN_EMAILS = ['ngocdat48gtvt@gmail.com']

function assertAdmin(request) {
  const callerEmail = request.auth?.token?.email?.toLowerCase()
  if (!callerEmail || !ADMIN_EMAILS.includes(callerEmail)) {
    throw new HttpsError('permission-denied', 'Chỉ admin mới được thực hiện')
  }
}

/** Lấy Gmail đăng nhập app của khách theo UID (Firebase Authentication). */
exports.lookupCustomerEmails = onCall(async (request) => {
  assertAdmin(request)
  const uids = request.data?.uids
  if (!Array.isArray(uids) || uids.length === 0) {
    return { emails: {} }
  }

  const auth = getAuth()
  const emails = {}
  const unique = [...new Set(uids.filter((uid) => typeof uid === 'string' && uid.length > 0))]

  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100)
    const result = await auth.getUsers(chunk.map((uid) => ({ uid })))
    for (const user of result.users) {
      if (user.email) emails[user.uid] = user.email.toLowerCase()
    }
  }

  return { emails }
})

exports.syncAuthEmails = onCall(async (request) => {
  assertAdmin(request)

  const auth = getAuth()
  const db = getFirestore()
  let updated = 0
  let matched = 0
  let nextPageToken

  do {
    const result = await auth.listUsers(1000, nextPageToken)
    for (const user of result.users) {
      if (!user.email) continue
      const ref = db.collection('users').doc(user.uid)
      const snap = await ref.get()
      if (!snap.exists) continue
      matched++
      const email = user.email.toLowerCase()
      if (snap.data().email !== email) {
        await ref.update({ email })
        updated++
      }
    }
    nextPageToken = result.pageToken
  } while (nextPageToken)

  return { updated, matched }
})

/** Gán catalogOwnerUid — admin chính / USER cùng công ty dùng chung danh mục. */
exports.backfillCatalogOwnerUids = onCall(async (request) => {
  assertAdmin(request)

  const db = getFirestore()
  const snap = await db.collection('users').get()
  const byCompany = new Map()

  for (const docSnap of snap.docs) {
    const data = docSnap.data()
    const cid = String(data.companyId ?? '').trim()
    if (!cid) continue
    const list = byCompany.get(cid) ?? []
    list.push({
      uid: docSnap.id,
      role: String(data.role ?? 'USER').toUpperCase(),
      createdAt: data.createdAt?.toMillis?.() ?? 0,
      catalogOwnerUid: String(data.catalogOwnerUid ?? '').trim(),
    })
    byCompany.set(cid, list)
  }

  let updated = 0
  let unchanged = 0

  for (const [, group] of byCompany) {
    const admins = group
      .filter((u) => u.role === 'ADMIN')
      .sort((a, b) => (a.createdAt !== b.createdAt ? a.createdAt - b.createdAt : a.uid.localeCompare(b.uid)))
    const primaryUid = admins[0]?.uid
    if (!primaryUid) continue

    for (const u of group) {
      const expected = u.role === 'ADMIN' && u.uid === primaryUid ? '' : primaryUid
      if (u.catalogOwnerUid === expected) {
        unchanged++
        continue
      }
      await db.collection('users').doc(u.uid).update({ catalogOwnerUid: expected })
      updated++
    }
  }

  return { updated, unchanged }
})

exports.notifyLeadTelegram = notifyLeadTelegram

const vebinhdoLicense = require('./vebinhdo-license')
exports.licenseActivate = vebinhdoLicense.licenseActivate
exports.licenseVerify = vebinhdoLicense.licenseVerify
