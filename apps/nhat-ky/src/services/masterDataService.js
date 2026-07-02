import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { normalizeGroupKey } from "../utils/incidentImport";

const DEFAULT_MAT_DUONG_TYPES = [
  "Ổ gà",
  "Hư hỏng lớp móng mặt đường",
  "Hư hỏng mặt đường"
];

const MAT_DUONG_GROUP_PRIORITY = [
  "Hư hỏng mặt đường",
  "Mặt đường",
  "mặt đường"
];

function isMatDuongGroupName(name) {
  const g = normalizeGroupKey(name);
  return (
    g.includes("mat duong") ||
    g.includes("hu hong mat duong") ||
    g === "mat duong"
  );
}

/** Loại sự cố nhóm mặt đường từ danh mục web điều hành. */
export function pickMatDuongTypes(typesByGroup = {}) {
  for (const name of MAT_DUONG_GROUP_PRIORITY) {
    const list = typesByGroup[name];
    if (Array.isArray(list) && list.length) return [...list];
  }
  const fuzzyKey = Object.keys(typesByGroup).find((k) => isMatDuongGroupName(k));
  if (fuzzyKey && typesByGroup[fuzzyKey]?.length) {
    return [...typesByGroup[fuzzyKey]];
  }
  return [...DEFAULT_MAT_DUONG_TYPES];
}

export function getCatalogOwnerUid(profile) {
  const fromEnv = import.meta.env.VITE_CATALOG_UID?.trim();
  if (fromEnv) return fromEnv;
  if (profile?.catalogOwnerUid) return profile.catalogOwnerUid;
  if (profile?.role === "ADMIN") return profile.uid;
  return profile?.uid || "";
}

export async function fetchMasterData(ownerUid) {
  if (!ownerUid) {
    return { typesByGroup: { "Hư hỏng mặt đường": DEFAULT_MAT_DUONG_TYPES } };
  }

  const [roadsSnap, groupsSnap, typesSnap] = await Promise.all([
    getDoc(doc(db, "users", ownerUid, "master_data", "roads")),
    getDoc(doc(db, "users", ownerUid, "master_data", "groups")),
    getDoc(doc(db, "users", ownerUid, "master_data", "types"))
  ]);

  return {
    roads: roadsSnap.data()?.list ?? [],
    groups: groupsSnap.data()?.list ?? [],
    typesByGroup: typesSnap.data()?.map ?? {},
    unitByType: typesSnap.data()?.units ?? {}
  };
}

export async function fetchMatDuongIncidentTypes(ownerUid) {
  try {
    const data = await fetchMasterData(ownerUid);
    return pickMatDuongTypes(data.typesByGroup);
  } catch (err) {
    console.warn("Không đọc được danh mục mặt đường, dùng mặc định.", err);
    return [...DEFAULT_MAT_DUONG_TYPES];
  }
}
