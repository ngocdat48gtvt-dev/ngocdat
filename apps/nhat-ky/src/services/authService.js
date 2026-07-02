import { collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "../firebase/firebase";

export const NHAT_KY_APP_ID = "nhat_ky_tuan_duong";
const SHARED_APP_IDS = new Set([NHAT_KY_APP_ID, "quan_ly_su_co"]);

function isLicenseExpired(expireDate) {
  if (!expireDate) return false;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(expireDate);
  if (iso) {
    const end = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 23, 59, 59);
    return Date.now() > end.getTime();
  }
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(expireDate);
  if (dmy) {
    const end = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]), 23, 59, 59);
    return Date.now() > end.getTime();
  }
  return false;
}

function normalizeAllowedApps(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((v) => String(v).trim()).filter(Boolean);
}

function canUseNhatKy(allowedApps) {
  const apps = normalizeAllowedApps(allowedApps);
  if (apps.length === 0) return true;
  return apps.some((id) => SHARED_APP_IDS.has(id));
}

async function resolveCatalogOwnerUid(uid, companyId, catalogOwnerUid) {
  const cached = String(catalogOwnerUid ?? "").trim();
  if (cached) return cached;
  if (!companyId) return uid;

  const q = query(
    collection(db, "users"),
    where("companyId", "==", companyId),
    where("role", "==", "ADMIN")
  );
  const snap = await getDocs(q);
  if (snap.empty) return uid;

  const admins = snap.docs
    .map((d) => {
      const data = d.data();
      const ts = data.createdAt;
      const ms = ts && typeof ts.toMillis === "function" ? ts.toMillis() : 0;
      return { id: d.id, ms };
    })
    .sort((a, b) => (a.ms !== b.ms ? a.ms - b.ms : a.id.localeCompare(b.id)));

  const primary = admins[0]?.id?.trim();
  return primary && primary !== uid ? primary : primary || uid;
}

export async function loadUserProfile(uid, email) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;

  const data = snap.data();
  if (data.active !== true) return null;

  const expireDate = String(data.expireDate ?? "").trim();
  if (isLicenseExpired(expireDate)) return null;

  if (!canUseNhatKy(data.allowedApps)) return null;

  const roleRaw = String(data.role ?? "USER").toUpperCase();
  const companyId = String(data.companyId ?? "").trim();
  const catalogOwnerUid = await resolveCatalogOwnerUid(
    uid,
    companyId,
    String(data.catalogOwnerUid ?? "")
  );

  return {
    uid,
    role: roleRaw === "ADMIN" ? "ADMIN" : "USER",
    companyId,
    companyName: String(data.companyName ?? data.company ?? ""),
    displayName: String(data.name ?? email ?? ""),
    email: String(data.email ?? email ?? ""),
    active: true,
    expireDate,
    catalogOwnerUid
  };
}
