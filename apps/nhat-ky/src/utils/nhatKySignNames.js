/** Tên ký cuối sổ tuần đường (Tuần đường / bên phải) — theo từng sổ. */

export const HAT_SIGN_ROLE_HAT_TRUONG = "hat_truong";
export const HAT_SIGN_ROLE_GIAM_DOC = "giam_doc";
export const HAT_SIGN_ROLE_CAN_BO_KY_THUAT = "can_bo_ky_thuat";

/** Phương án chức danh ký bên phải (trang 2 / sổ BD). */
export const HAT_SIGN_ROLES = [
  { value: HAT_SIGN_ROLE_HAT_TRUONG, label: "Hạt trưởng" },
  { value: HAT_SIGN_ROLE_GIAM_DOC, label: "Giám đốc điều hành" },
  { value: HAT_SIGN_ROLE_CAN_BO_KY_THUAT, label: "Cán bộ kỹ thuật" }
];

function storageKeyFor(roadStorageKey) {
  return `nhatky_sign_names_${roadStorageKey || "default"}`;
}

export function normalizeHatSignRole(raw) {
  const v = String(raw || "").trim();
  if (HAT_SIGN_ROLES.some((r) => r.value === v)) return v;
  return HAT_SIGN_ROLE_HAT_TRUONG;
}

/** Nhãn chức danh hiển thị trên sổ theo phương án đã chọn. */
export function resolveHatSignRoleLabel(hatRole) {
  const role = normalizeHatSignRole(hatRole);
  return HAT_SIGN_ROLES.find((r) => r.value === role)?.label || "Hạt trưởng";
}

export function loadNhatKySignNames(roadStorageKey) {
  try {
    const raw = localStorage.getItem(storageKeyFor(roadStorageKey));
    if (!raw) {
      return { tuanDuong: "", hatTruong: "", hatRole: HAT_SIGN_ROLE_HAT_TRUONG };
    }
    const parsed = JSON.parse(raw);
    return {
      tuanDuong: String(parsed?.tuanDuong || "").trim(),
      hatTruong: String(parsed?.hatTruong || "").trim(),
      hatRole: normalizeHatSignRole(parsed?.hatRole)
    };
  } catch {
    return { tuanDuong: "", hatTruong: "", hatRole: HAT_SIGN_ROLE_HAT_TRUONG };
  }
}

export function saveNhatKySignNames(roadStorageKey, names) {
  try {
    localStorage.setItem(
      storageKeyFor(roadStorageKey),
      JSON.stringify({
        tuanDuong: String(names?.tuanDuong || "").trim(),
        hatTruong: String(names?.hatTruong || "").trim(),
        hatRole: normalizeHatSignRole(names?.hatRole)
      })
    );
  } catch {
    /* ignore */
  }
}
