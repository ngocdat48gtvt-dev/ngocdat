import { useEffect, useRef } from "react";
import { hydrateCongRegistriesFromCloud } from "../services/congRegistryService";

/**
 * Khi đăng nhập / chọn hạt: kéo danh sách cống từ cloud về máy.
 * Không dùng ranRef cứng — cho phép hydrate lại khi đổi đường / lần vào sau.
 */
export function useCongRegistryHydrate({ uid, roads, ready, enabled = true }) {
  const roadsRef = useRef(roads);
  roadsRef.current = roads;
  const roadsKey = (roads || []).map((r) => `${r.id}:${r.roadName || r.label || ""}`).join("|");

  useEffect(() => {
    if (!enabled || !ready || !uid || !roadsKey) return undefined;

    let cancelled = false;
    void hydrateCongRegistriesFromCloud(uid, roadsRef.current || [])
      .then((result) => {
        if (cancelled) return;
        if (result?.cloudKeys?.length && result.loadedRoads === 0) {
          console.warn("[cong] Hydrate không nạp được đường nào từ cloud.", result);
        }
      })
      .catch((err) => {
        if (!cancelled) console.warn("Không hydrate được hồ sơ cống.", err);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, ready, uid, roadsKey]);
}
