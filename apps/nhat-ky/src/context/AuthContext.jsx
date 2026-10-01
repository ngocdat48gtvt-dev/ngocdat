import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase/firebase";
import { clearBaoCaoMode, isBaoCaoMode, resolvePortalId } from "../lib/baoCaoMode";
import { clearPortalSession, initPortalAuth } from "../lib/portalAuth";
import { loadUserProfile } from "../services/authService";
import { resetQualityCatalogOwnerUid } from "../utils/baoDuongQualityStore";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [portalReady, setPortalReady] = useState(false);
  const portalId = resolvePortalId();
  const baoCaoMode = isBaoCaoMode();

  useEffect(() => {
    initPortalAuth(portalId).then(() => setPortalReady(true));
  }, [portalId]);

  useEffect(() => {
    if (!portalReady) return;
    return onAuthStateChanged(auth, async (u) => {
      setAuthError("");
      if (!u) {
        resetQualityCatalogOwnerUid();
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }
      try {
        const p = await loadUserProfile(u.uid, u.email);
        if (!p) {
          await signOut(auth);
          setUser(null);
          setProfile(null);
          setAuthError(
            baoCaoMode
              ? "Tài khoản chưa kích hoạt hoặc hết hạn license."
              : "Tài khoản chưa kích hoạt, hết hạn license hoặc chưa được cấp quyền Sổ nội nghiệp."
          );
        } else {
          setUser(u);
          setProfile(p);
        }
      } catch {
        setUser(null);
        setProfile(null);
        setAuthError("Không đọc được hồ sơ tài khoản.");
      } finally {
        setLoading(false);
      }
    });
  }, [portalReady, baoCaoMode]);

  async function logout() {
    resetQualityCatalogOwnerUid();
    clearPortalSession(portalId);
    if (baoCaoMode) clearBaoCaoMode();
    await signOut(auth);
  }

  const value = {
    user,
    profile,
    loading,
    authError,
    canAccess: Boolean(user && profile),
    baoCaoMode,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
