import { useEffect, useRef } from "react";
import { getCatalogOwnerUid } from "../services/masterDataService";
import {
  saveDataNoiNghiep,
  subscribeDataNoiNghiep
} from "../services/dataNoiNghiepService";
import {
  applyRemoteQualityCatalog,
  BAO_DUONG_QUALITY_EVENT,
  getQualityCatalogOverrides,
  normalizeBaoDuongGroup,
  resetQualityCatalogOwnerUid,
  setQualityCatalogOwnerUid
} from "../utils/baoDuongQualityStore";

/** Tải & lắng nghe MASTER DATA (data_noi_nghiep) từ Firestore. */
export function useDataNoiNghiepSync({ profile, enabled }) {
  const migratedRef = useRef(false);
  const groupMigratedRef = useRef(false);

  const ownerUid = enabled && profile ? getCatalogOwnerUid(profile) : "";
  // Đồng bộ owner trước effect — tránh load local sai key khi mở MASTER DATA / đổi USER.
  if (ownerUid) setQualityCatalogOwnerUid(ownerUid);
  else resetQualityCatalogOwnerUid();

  useEffect(() => {
    if (!ownerUid) return undefined;
    window.dispatchEvent(new CustomEvent(BAO_DUONG_QUALITY_EVENT));
    return undefined;
  }, [ownerUid]);

  useEffect(() => {
    if (!enabled || !profile || !ownerUid) return undefined;

    migratedRef.current = false;
    groupMigratedRef.current = false;

    return subscribeDataNoiNghiep(ownerUid, ({ exists, catalog, updatedAtMs }) => {
      if (!exists) {
        const local = getQualityCatalogOverrides();
        const canMigrate =
          !migratedRef.current &&
          profile.role === "ADMIN" &&
          profile.uid === ownerUid &&
          Object.keys(local).length > 0;
        if (canMigrate) {
          migratedRef.current = true;
          void saveDataNoiNghiep(ownerUid, local).catch((err) => {
            console.warn("Không đẩy được data_noi_nghiep lên cloud.", err);
            migratedRef.current = false;
          });
        }
        return;
      }

      // Gộp nhóm cũ «Công tác phát cây» → «Nền đường» trước khi áp local.
      let needsGroupPush = false;
      const cleaned = {};
      for (const [key, val] of Object.entries(catalog || {})) {
        const rawGroup = String(val?.group || "").trim();
        const group = normalizeBaoDuongGroup(rawGroup);
        if (rawGroup && group !== rawGroup) needsGroupPush = true;
        cleaned[key] = group === rawGroup ? val : { ...val, group };
      }

      applyRemoteQualityCatalog(cleaned, updatedAtMs || 0);

      const canPushGroups =
        needsGroupPush &&
        !groupMigratedRef.current &&
        profile.role === "ADMIN" &&
        profile.uid === ownerUid;
      if (canPushGroups) {
        groupMigratedRef.current = true;
        void saveDataNoiNghiep(ownerUid, getQualityCatalogOverrides()).catch((err) => {
          console.warn("Không đẩy migrate nhóm phát cây lên cloud.", err);
          groupMigratedRef.current = false;
        });
      }
    });
  }, [enabled, ownerUid, profile?.role, profile?.uid]);
}
