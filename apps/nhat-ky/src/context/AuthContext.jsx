import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase/firebase";
import {
  clearPortalSession,
  initPortalAuth,
  NHAT_KY_PORTAL
} from "../lib/portalAuth";
import { loadUserProfile } from "../services/authService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    initPortalAuth(NHAT_KY_PORTAL).then(() => setPortalReady(true));
  }, []);

  useEffect(() => {
    if (!portalReady) return;
    return onAuthStateChanged(auth, async (u) => {
      setAuthError("");
      if (!u) {
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
            "Tài khoản chưa kích hoạt, hết hạn license hoặc chưa được cấp quyền Sổ nội nghiệp."
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
  }, [portalReady]);

  useEffect(() => {
    if (!profile?.uid) return;
    const key = `nhatky_${profile.uid}`;
    if (!localStorage.getItem(key) && localStorage.getItem("nhatky")) {
      localStorage.setItem(key, localStorage.getItem("nhatky"));
    }
  }, [profile?.uid]);

  async function logout() {
    clearPortalSession(NHAT_KY_PORTAL);
    await signOut(auth);
  }

  const value = {
    user,
    profile,
    loading,
    authError,
    canAccess: Boolean(user && profile),
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
