import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "../firebase/firebase";

function nameFromUserDoc(data) {
  const name = String(data?.name ?? "").trim();
  if (name) return name;
  const email = String(data?.email ?? "").trim();
  return email || "Chưa đặt tên";
}

/** USER đang hoạt động trong công ty — nguồn cho màn chọn sổ. */
export async function fetchCompanyOfficeUsers(companyId) {
  if (!companyId) return [];
  const q = query(
    collection(db, "users"),
    where("companyId", "==", companyId),
    where("role", "==", "USER")
  );
  const snap = await getDocs(q);
  const list = [];
  for (const d of snap.docs) {
    const data = d.data();
    if (data.active !== true) continue;
    list.push({
      uid: d.id,
      displayName: nameFromUserDoc(data),
      companyId: String(data.companyId ?? "").trim()
    });
  }
  return list.sort((a, b) =>
    a.displayName.localeCompare(b.displayName, "vi", { sensitivity: "base" })
  );
}

export function filterUsersForViewer(allUsers, viewerAccess) {
  if (!Array.isArray(allUsers) || !allUsers.length) return [];
  const mode = viewerAccess?.mode === "users" ? "users" : "all";
  if (mode === "all") return allUsers;
  const allowed = new Set(
    (viewerAccess?.userUids || []).map((id) => String(id).trim()).filter(Boolean)
  );
  return allUsers.filter((u) => allowed.has(u.uid));
}

export function fallbackCompaniesFromIds(companyIds) {
  return [
    ...new Set((companyIds || []).map((id) => String(id).trim()).filter(Boolean))
  ].map((companyId) => ({ companyId, companyName: companyId }));
}

async function companyNameFromRole(companyId, role) {
  const q = query(
    collection(db, "users"),
    where("companyId", "==", companyId),
    where("role", "==", role),
    limit(5)
  );
  const snap = await getDocs(q);
  for (const d of snap.docs) {
    const n = String(d.data().companyName ?? d.data().company ?? "").trim();
    if (n) return n;
  }
  return "";
}

/** Công ty theo mã — chọn phạm vi Sở Xây dựng. Không throw: luôn trả về list từ ID. */
export async function fetchCompaniesByIds(companyIds) {
  const ids = [
    ...new Set((companyIds || []).map((id) => String(id).trim()).filter(Boolean))
  ];
  const out = [];
  for (const companyId of ids) {
    let name = companyId;
    try {
      name =
        (await companyNameFromRole(companyId, "ADMIN")) ||
        (await companyNameFromRole(companyId, "USER")) ||
        companyId;
    } catch {
      name = companyId;
    }
    out.push({ companyId, companyName: name || companyId });
  }
  return out.sort((a, b) =>
    a.companyName.localeCompare(b.companyName, "vi", { sensitivity: "base" })
  );
}

/** ADMIN chính của công ty — đọc KL hợp đồng báo cáo. */
export async function fetchPrimaryAdminUid(companyId) {
  if (!companyId) return "";
  const q = query(
    collection(db, "users"),
    where("companyId", "==", companyId),
    where("role", "==", "ADMIN"),
    limit(20)
  );
  const snap = await getDocs(q);
  const admins = snap.docs
    .map((d) => {
      const ts = d.data().createdAt;
      const ms = ts && typeof ts.toMillis === "function" ? ts.toMillis() : 0;
      return { id: d.id, ms };
    })
    .sort((a, b) => (a.ms !== b.ms ? a.ms - b.ms : a.id.localeCompare(b.id)));
  return admins[0]?.id || "";
}
