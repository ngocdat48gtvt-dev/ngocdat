import { EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { auth } from "../firebase/firebase";

/**
 * Xác thực lại bằng mật khẩu tài khoản đang đăng nhập (tránh bấm nhầm thao tác nguy hiểm).
 * @param {string} password
 */
export async function reauthenticateCurrentUser(password) {
  const user = auth.currentUser;
  const email = String(user?.email || "").trim();
  const pwd = String(password || "");
  if (!user || !email) {
    throw new Error("Chưa đăng nhập. Vui lòng đăng nhập lại.");
  }
  if (!pwd) {
    throw new Error("Vui lòng nhập mật khẩu.");
  }
  try {
    const cred = EmailAuthProvider.credential(email, pwd);
    await reauthenticateWithCredential(user, cred);
  } catch (err) {
    const code = String(err?.code || "");
    if (
      code === "auth/wrong-password" ||
      code === "auth/invalid-credential" ||
      code === "auth/invalid-login-credentials"
    ) {
      throw new Error("Mật khẩu không đúng.");
    }
    if (code === "auth/too-many-requests") {
      throw new Error("Thử quá nhiều lần. Đợi vài phút rồi thử lại.");
    }
    if (code === "auth/network-request-failed") {
      throw new Error("Lỗi mạng. Kiểm tra kết nối rồi thử lại.");
    }
    throw new Error(err?.message || "Không xác thực được mật khẩu.");
  }
}
