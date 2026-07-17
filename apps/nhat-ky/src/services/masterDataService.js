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

const THOAT_NUOC_GROUP_PRIORITY = [
  "Cống, rãnh thoát nước",
  "Cống rãnh thoát nước",
  "Thoát nước",
  "Hư hỏng cống, rãnh"
];

/** Tên công việc mặc định thuộc tab Cống (khi master data chưa tách rõ). */
export const DEFAULT_CONG_WORK_TYPES = [
  "Tắc cống",
  "Đất đá bồi lấp cửa cống",
  "Rác cửa cống",
  "Hư đầu cống",
  "Hư thân cống",
  "Hư cửa cống",
  "Xói đầu cống",
  "Xói cuối cống"
];

function isMatDuongGroupName(name) {
  const g = normalizeGroupKey(name);
  return (
    g.includes("mat duong") ||
    g.includes("hu hong mat duong") ||
    g === "mat duong"
  );
}

function isThoatNuocGroupName(name) {
  const g = normalizeGroupKey(name);
  return (
    g.includes("thoat nuoc") ||
    (g.includes("cong") && g.includes("ranh")) ||
    g.includes("cong ranh") ||
    g === "cong"
  );
}

/** Loại công việc thuộc form Cống (không phải rãnh). */
export function isCongWorkTypeName(type) {
  const t = String(type || "").trim();
  if (!t) return false;
  if (DEFAULT_CONG_WORK_TYPES.includes(t)) return true;
  const n = normalizeGroupKey(t);
  if (n.includes("ranh") && !n.includes("cong")) return false;
  return (
    n.includes("cong") ||
    n.includes("ho ga") ||
    n.includes("song chan rac") ||
    n.includes("tam dan")
  );
}

function pickTypesByPriority(typesByGroup, priorityNames, fuzzyPred, fallback = []) {
  const map = typesByGroup && typeof typesByGroup === "object" ? typesByGroup : {};
  for (const name of priorityNames) {
    const list = map[name];
    if (Array.isArray(list) && list.length) return [...list];
  }
  const fuzzyKey = Object.keys(map).find((k) => fuzzyPred(k));
  if (fuzzyKey && map[fuzzyKey]?.length) return [...map[fuzzyKey]];
  return [...fallback];
}

/** Loại sự cố nhóm mặt đường từ danh mục web điều hành. */
export function pickMatDuongTypes(typesByGroup = {}) {
  return pickTypesByPriority(
    typesByGroup,
    MAT_DUONG_GROUP_PRIORITY,
    isMatDuongGroupName,
    DEFAULT_MAT_DUONG_TYPES
  );
}

/** Loại sự cố nhóm cống/rãnh thoát nước từ master data. */
export function pickThoatNuocTypes(typesByGroup = {}) {
  return pickTypesByPriority(
    typesByGroup,
    THOAT_NUOC_GROUP_PRIORITY,
    isThoatNuocGroupName,
    []
  );
}

export function splitCongRanhTypes(allTypes = []) {
  const list = (allTypes || []).map((t) => String(t || "").trim()).filter(Boolean);
  const cong = [];
  const ranh = [];
  const seenC = new Set();
  const seenR = new Set();
  list.forEach((t) => {
    if (isCongWorkTypeName(t)) {
      if (!seenC.has(t)) {
        seenC.add(t);
        cong.push(t);
      }
    } else if (!seenR.has(t)) {
      seenR.add(t);
      ranh.push(t);
    }
  });
  return { cong, ranh };
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
