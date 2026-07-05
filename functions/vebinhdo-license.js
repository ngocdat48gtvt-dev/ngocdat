const { onRequest } = require('firebase-functions/v2/https')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const crypto = require('crypto')

const PRODUCT = 'VeBinhDo'
const PASSWORD_SALT = 'VeBinhDoSalt'

function hashPassword(password) {
  return crypto.createHash('sha256').update(String(password) + PASSWORD_SALT).digest('hex')
}

function normalizeKey(key) {
  return String(key || '').trim().toUpperCase()
}

async function loadLicense(key) {
  const doc = await getFirestore().collection('licenses').doc(key).get()
  if (!doc.exists) {
    return null
  }
  return { ref: doc.ref, data: doc.data() }
}

function isExpired(data) {
  if (!data.expiresAt) {
    return false
  }
  const exp = data.expiresAt.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt)
  return exp.getTime() < Date.now()
}

async function processLicense(body, bindMachine) {
  const licenseKey = normalizeKey(body.licenseKey)
  const password = body.password
  const machineId = String(body.machineId || '').trim()
  const machineName = String(body.machineName || '').trim()
  const product = String(body.product || PRODUCT)

  if (!licenseKey) {
    return { ok: false, message: 'Thiếu mã license.' }
  }

  const license = await loadLicense(licenseKey)
  if (!license) {
    return { ok: false, message: 'Mã license không tồn tại.' }
  }

  const data = license.data
  if (data.product && data.product !== product) {
    return { ok: false, message: 'License không dùng cho sản phẩm này.' }
  }
  if (data.active === false) {
    return { ok: false, message: 'License đã bị khóa.' }
  }
  if (isExpired(data)) {
    return { ok: false, message: 'License đã hết hạn.' }
  }

  if (bindMachine) {
    if (!password) {
      return { ok: false, message: 'Thiếu mật khẩu.' }
    }
    if (hashPassword(password) !== data.passwordHash) {
      return { ok: false, message: 'Mật khẩu không đúng.' }
    }
    if (!machineId) {
      return { ok: false, message: 'Thiếu mã máy.' }
    }

    if (data.machineId && data.machineId !== machineId) {
      return {
        ok: false,
        message: 'License đã gắn máy khác. Admin cần Reset máy trên web license.',
      }
    }

    if (!data.machineId) {
      await license.ref.update({
        machineId,
        machineName,
        activatedAt: FieldValue.serverTimestamp(),
      })
    }
  } else {
    if (!machineId || data.machineId !== machineId) {
      return { ok: false, message: 'License không khớp máy này.' }
    }
  }

  let expiresAt = null
  if (data.expiresAt) {
    const d = data.expiresAt.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt)
    expiresAt = d.toISOString()
  }

  return {
    ok: true,
    message: 'OK',
    customerName: data.customerName || '',
    expiresAt,
  }
}

const httpOpts = { region: 'asia-southeast1', cors: true }

exports.licenseActivate = onRequest(httpOpts, async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method not allowed' })
  }

  try {
    const result = await processLicense(req.body || {}, true)
    return res.json(result)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ ok: false, message: 'Lỗi server license.' })
  }
})

exports.licenseVerify = onRequest(httpOpts, async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method not allowed' })
  }

  try {
    const result = await processLicense(req.body || {}, false)
    return res.json(result)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ ok: false, message: 'Lỗi server license.' })
  }
})
