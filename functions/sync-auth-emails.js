/**
 * Đồng bộ Gmail từ Firebase Authentication → Firestore users/{uid}.email
 *
 * Cách chạy (một lần, không cần deploy Cloud Function):
 * 1. Firebase Console → Project settings → Service accounts → Generate new private key
 * 2. PowerShell:
 *    cd functions
 *    npm install
 *    $env:GOOGLE_APPLICATION_CREDENTIALS="G:\path\to\service-account.json"
 *    node sync-auth-emails.js
 */

const { initializeApp, applicationDefault } = require('firebase-admin/app')
const { getAuth } = require('firebase-admin/auth')
const { getFirestore } = require('firebase-admin/firestore')

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('Thiếu biến GOOGLE_APPLICATION_CREDENTIALS (đường dẫn file service account JSON).')
  process.exit(1)
}

initializeApp({ credential: applicationDefault() })

async function main() {
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
        console.log(`✓ ${snap.data().name || user.uid} → ${email}`)
      }
    }
    nextPageToken = result.pageToken
  } while (nextPageToken)

  console.log(`\nXong: cập nhật ${updated}/${matched} license.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
