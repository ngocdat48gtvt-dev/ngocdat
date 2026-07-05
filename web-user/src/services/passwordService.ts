import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signOut,
  updatePassword,
  type User,
} from 'firebase/auth'
import { auth } from '@/firebase/firebase'

export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code
  switch (code) {
    case 'auth/invalid-email':
      return 'Email không hợp lệ'
    case 'auth/user-not-found':
    case 'auth/invalid-credential':
      return 'Email hoặc mật khẩu không đúng'
    case 'auth/wrong-password':
      return 'Mật khẩu hiện tại không đúng'
    case 'auth/weak-password':
      return 'Mật khẩu mới phải có ít nhất 6 ký tự'
    case 'auth/too-many-requests':
      return 'Quá nhiều lần thử. Vui lòng thử lại sau.'
    case 'auth/requires-recent-login':
      return 'Phiên đăng nhập đã cũ. Đăng xuất, đăng nhập lại rồi đổi mật khẩu.'
    case 'auth/missing-email':
      return 'Tài khoản không có email — liên hệ quản trị.'
    default:
      return 'Không thực hiện được. Thử lại sau.'
  }
}

export async function sendPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim())
}

export async function changeUserPassword(
  user: User,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const email = user.email
  if (!email) throw Object.assign(new Error('missing-email'), { code: 'auth/missing-email' })

  const credential = EmailAuthProvider.credential(email, currentPassword)
  await reauthenticateWithCredential(user, credential)
  await updatePassword(user, newPassword)
  await signOut(auth)
}
