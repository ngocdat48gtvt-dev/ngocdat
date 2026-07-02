import { useEffect, useRef, useState } from "react";
import { fetchMyIncidents } from "../services/incidentsService";
import { syncImportedIncidentsToNhatKy } from "../utils/incidentImport";

/**
 * Tự động đồng bộ khối lượng / km / tiến độ từ app hiện trường vào nhật ký khi mở trang.
 */
export function useIncidentSync({ uid, storageKey, enabled = true, onUpdated }) {
  const [syncing, setSyncing] = useState(false);
  const onUpdatedRef = useRef(onUpdated);
  onUpdatedRef.current = onUpdated;

  useEffect(() => {
    if (!enabled || !uid || !storageKey) return;

    let cancelled = false;

    async function run() {
      setSyncing(true);
      try {
        const incidents = await fetchMyIncidents(uid);
        if (cancelled) return;
        const { updated } = await syncImportedIncidentsToNhatKy(
          incidents,
          storageKey,
          uid
        );
        if (!cancelled && updated > 0) {
          onUpdatedRef.current?.(updated);
        }
      } catch (err) {
        console.warn("Không đồng bộ được sự cố từ app hiện trường.", err);
      } finally {
        if (!cancelled) setSyncing(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [uid, storageKey, enabled]);

  return { syncing };
}
