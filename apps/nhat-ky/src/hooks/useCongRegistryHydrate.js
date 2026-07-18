import { useEffect, useRef } from "react";
import { hydrateCongRegistriesFromCloud } from "../services/congRegistryService";

/**
 * Khi đăng nhập / chọn hạt: kéo danh sách cống từ cloud về máy
 * để form Nhập liệu (CongQuickEntry) và Hồ sơ cống dùng được ngay.
 */
export function useCongRegistryHydrate({ uid, roads, ready, enabled = true }) {
  const roadsRef = useRef(roads);
  roadsRef.current = roads;
  const roadsKey = (roads || []).map((r) => `${r.id}:${r.roadName || r.label || ""}`).join("|");
  const ranRef = useRef("");

  useEffect(() => {
    if (!enabled || !ready || !uid || !roadsKey) return undefined;

    const key = `${uid}::${roadsKey}`;
    if (ranRef.current === key) return undefined;
    ranRef.current = key;

    let cancelled = false;
    void hydrateCongRegistriesFromCloud(uid, roadsRef.current || []).catch((err) => {
      if (!cancelled) console.warn("Không hydrate được hồ sơ cống.", err);
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, ready, uid, roadsKey]);
}
