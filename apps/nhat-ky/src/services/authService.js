import { collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "../firebase/firebase";
import {
  cacheCatalogOwnerUid,
  readCachedCatalogOwnerUid
} from "./masterDataService";

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
  const explicit = String(catalogOwnerUid ?? "").trim();
  if (explicit) return explicit;
  const companyCached = readCachedCatalogOwnerUid(companyId);
  if (!companyId) return companyCached || uid;

  try {
    const q = query(
      collection(db, "users"),
      where("companyId", "==", companyId),
      where("role", "==", "ADMIN"),
      limit(20)
    );
    const snap = await getDocs(q);
    if (snap.empty) return companyCached || uid;

    const admins = snap.docs
      .map((d) => {
        const data = d.data();
        const ts = data.createdAt;
        const ms = ts && typeof ts.toMillis === "function" ? ts.toMillis() : 0;
        return { id: d.id, ms };
      })
      .sort((a, b) => (a.ms !== b.ms ? a.ms - b.ms : a.id.localeCompare(b.id)));

    const primary = admins[0]?.id?.trim();
    return primary || companyCached || uid;
  } catch (err) {
    console.warn("Không resolve được catalogOwnerUid, dùng cache công ty.", err);
    return companyCached || uid;
  }
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
  let catalogOwnerUid = "";
  if (roleRaw !== "SO_XD") {
    catalogOwnerUid = await resolveCatalogOwnerUid(
      uid,
      companyId,
      String(data.catalogOwnerUid ?? "")
    );
    const isSelfFallback = catalogOwnerUid && catalogOwnerUid === uid && roleRaw !== "ADMIN";
    if (catalogOwnerUid && companyId && !isSelfFallback) {
      cacheCatalogOwnerUid(companyId, catalogOwnerUid);
    } else if (!catalogOwnerUid && companyId) {
      catalogOwnerUid = readCachedCatalogOwnerUid(companyId);
    }
  }

  let officeRole = "user";
  if (roleRaw === "ADMIN") officeRole = "admin";
  else if (roleRaw === "VIEWER") officeRole = "viewer";
  else if (roleRaw === "SO_XD") officeRole = "so_xd";

  const viewerRaw = data.viewerAccess;
  const viewerAccess = {
    mode: viewerRaw?.mode === "users" ? "users" : "all",
    userUids: Array.isArray(viewerRaw?.userUids)
      ? viewerRaw.userUids.map((id) => String(id).trim()).filter(Boolean)
      : []
  };

  const soXdRaw = data.soXdAccess;
  const soXdAccess = {
    companyIds: Array.isArray(soXdRaw?.companyIds)
      ? soXdRaw.companyIds.map((id) => String(id).trim()).filter(Boolean)
      : []
  };

  const role =
    roleRaw === "ADMIN"
      ? "ADMIN"
      : roleRaw === "VIEWER"
        ? "VIEWER"
        : roleRaw === "SO_XD"
          ? "SO_XD"
          : "USER";

  return {
    uid,
    role,
    officeRole,
    companyId: role === "SO_XD" ? "" : companyId,
    companyName:
      role === "SO_XD"
        ? String(data.companyName ?? data.company ?? "").trim() || "Sở Xây dựng"
        : String(data.companyName ?? data.company ?? ""),
    displayName: String(data.name ?? email ?? ""),
    email: String(data.email ?? email ?? ""),
    active: true,
    expireDate,
    catalogOwnerUid: role === "SO_XD" ? "" : catalogOwnerUid,
    viewerAccess,
    soXdAccess
  };
}
