import { useState } from "react";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "../firebase/firebase";
import { isBaoCaoMode } from "../lib/baoCaoMode";
import {
  BAO_CAO_PORTAL,
  getPortalRememberedEmail,
  markPortalLogin,
  NHAT_KY_PORTAL
} from "../lib/portalAuth";
import { loadUserProfile } from "../services/authService";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { authError } = useAuth();
  const baoCao = isBaoCaoMode();
  const portalId = baoCao ? BAO_CAO_PORTAL : NHAT_KY_PORTAL;
  const [email, setEmail] = useState(() => getPortalRememberedEmail(portalId));
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const profile = await loadUserProfile(cred.user.uid, cred.user.email);
      if (!profile) {
        await signOut(auth);
        setError(
          baoCao
            ? "Tài khoản chưa kích hoạt hoặc hết hạn license."
            : "Tài khoản chưa kích hoạt, hết hạn hoặc chưa được cấp quyền Sổ nội nghiệp."
        );
      } else if (baoCao && profile.role !== "ADMIN" && profile.role !== "SO_XD") {
        await signOut(auth);
        setError("Cổng Báo cáo chỉ dành cho ADMIN hoặc Sở Xây dựng.");
      } else {
        markPortalLogin(portalId, email);
      }
    } catch {
      setError("Email hoặc mật khẩu không đúng.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="nhatky-login">
      <div className="nhatky-login-card">
        <h1>{baoCao ? "Báo cáo khối lượng" : "Sổ nội nghiệp"}</h1>
        <p className="nhatky-login-sub">
          {baoCao
            ? "Đăng nhập ADMIN hoặc Sở Xây dựng để xem thống kê khối lượng (theo hạt / đường)."
            : "Đăng nhập sổ nội nghiệp. Sở Xây dựng / VIEWER chỉ xem, không sửa."
        </p>
        <form className="nhatky-login-form" onSubmit={handleSubmit}>
          <label className="entry-form-label" htmlFor="nhat-ky-login-email">
            Email
          </label>
          <input
            id="nhat-ky-login-email"
            type="email"
            autoComplete="username"
            className="sidebar-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <label className="entry-form-label" htmlFor="login-password">
            Mật khẩu
          </label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            className="sidebar-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {(error || authError) && (
            <p className="nhatky-login-error">{error || authError}</p>
          )}
          <button type="submit" className="btn-primary nhatky-login-btn" disabled={submitting}>
            {submitting ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </form>
        <a href="/quan-ly-duong-bo.html" className="nhatky-login-home">
          ← Về trang chủ
        </a>
      </div>
    </div>
  );
}
