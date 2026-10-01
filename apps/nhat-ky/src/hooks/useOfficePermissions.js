import { useMemo } from "react";
import { useAuth } from "../context/AuthContext";

/** admin | user | viewer | so_xd — map từ users.role trên Firestore. */
export function resolveOfficePermissions(profile) {
  const officeRole = profile?.officeRole || "user";

  return {
    officeRole,
    isAdmin: officeRole === "admin",
    isUser: officeRole === "user",
    isViewer: officeRole === "viewer",
    isSoXd: officeRole === "so_xd",
    /** MASTER DATA — chỉ ADMIN được RW. */
    canEditMasterData: officeRole === "admin",
    canViewMasterData: true,
    /** Sổ / NHẬP LIỆU — chỉ USER được RW. */
    canEditOfficeData: officeRole === "user",
    canSyncOfficeData: officeRole === "user",
    isOfficeReadOnly:
      officeRole === "admin" || officeRole === "viewer" || officeRole === "so_xd",
    /** App hiện trường trong portal này — chỉ USER vận hành nhập. */
    canUseFieldApp: officeRole === "user",
    /** ADMIN / VIEWER / SO_XD — màn chọn USER → hạt trước khi xem sổ. */
    needsBrowsePicker:
      officeRole === "admin" || officeRole === "viewer" || officeRole === "so_xd",
    canBrowseAllUsers:
      officeRole === "admin" ||
      officeRole === "so_xd" ||
      (officeRole === "viewer" && profile?.viewerAccess?.mode !== "users"),
    /** Chỉ ADMIN tạo / sửa / xóa danh mục hạt-sổ (cloud). */
    canManageOfficeCatalog: officeRole === "admin"
  };
}

export function useOfficePermissions() {
  const { profile } = useAuth();
  return useMemo(() => resolveOfficePermissions(profile), [profile]);
}
