import { collection, getDocs, query, where } from "firebase/firestore";
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
