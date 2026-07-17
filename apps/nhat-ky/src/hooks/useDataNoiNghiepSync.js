import { useEffect, useRef } from "react";
import { getCatalogOwnerUid } from "../services/masterDataService";
import {
  saveDataNoiNghiep,
  subscribeDataNoiNghiep
} from "../services/dataNoiNghiepService";
import {
  applyRemoteQualityCatalog,
  getQualityCatalogOverrides
} from "../utils/baoDuongQualityStore";

/** Tải & lắng nghe MASTER DATA (data_noi_nghiep) từ Firestore. */
export function useDataNoiNghiepSync({ profile, enabled }) {
  const migratedRef = useRef(false);

  useEffect(() => {
    if (!enabled || !profile) return undefined;

    const ownerUid = getCatalogOwnerUid(profile);
    if (!ownerUid) return undefined;

    migratedRef.current = false;

    return subscribeDataNoiNghiep(ownerUid, ({ exists, catalog }) => {
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

      applyRemoteQualityCatalog(catalog);
    });
  }, [enabled, profile?.uid, profile?.catalogOwnerUid, profile?.role]);
}
