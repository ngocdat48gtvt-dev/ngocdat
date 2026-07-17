import { useCallback, useEffect, useRef, useState } from "react";
import { fetchGptcForRoad, pushGptcForRoad } from "../services/gptcService";
import { loadGptcLedger, saveGptcLedger, setGptcLedger, gptcScope } from "../utils/gptcStore";

const PUSH_DEBOUNCE_MS = 1800;

function hasGptcData(ledger) {
  return (ledger?.permits || []).length > 0 || String(ledger?.tenTuyen || "").trim();
}

/**
 * Hydrate/push sổ cấp phép TC theo office_books/{roadId}/modules/gptc.
 * canPush=false (ADMIN/VIEWER browse): chỉ đọc.
 */
export function useGptcSync({
  uid,
  roadId,
  roadName,
  tenTuyen,
  enabled = true,
  canPush = false,
  browseMode = false
}) {
  const scope = gptcScope(uid, roadId);
  const [ledger, setLedger] = useState(() => (scope ? loadGptcLedger(scope) : null));
  const [ready, setReady] = useState(false);
  const pushTimer = useRef(null);
  const localDirty = useRef(false);
  const hydratingRef = useRef(false);

  const flushPush = useCallback(async () => {
    if (!canPush || !uid || !roadId || !scope) return;
    const current = loadGptcLedger(scope);
    await pushGptcForRoad(uid, roadId, current);
  }, [canPush, uid, roadId, scope]);

  const schedulePush = useCallback(() => {
    if (!canPush || hydratingRef.current) return;
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => {
      flushPush().catch((err) => {
        console.warn("Đồng bộ sổ cấp phép thi công lên cloud thất bại.", err);
      });
    }, PUSH_DEBOUNCE_MS);
  }, [canPush, flushPush]);

  useEffect(() => {
    if (!enabled || !scope) {
      setLedger(null);
      setReady(true);
      return undefined;
    }

    let cancelled = false;
    localDirty.current = false;

    async function hydrate() {
      hydratingRef.current = true;
      try {
        let local = loadGptcLedger(scope);
        const hasLocal = hasGptcData(local);

        if (uid && roadId) {
          const remote = await fetchGptcForRoad(uid, roadId, roadName);
          if (cancelled) return;

          if (remote && (browseMode || !hasLocal || !localDirty.current)) {
            if (browseMode || !hasLocal || JSON.stringify(remote) !== JSON.stringify(local)) {
              local = setGptcLedger(scope, remote);
            }
          } else if (!remote && hasLocal && canPush) {
            await pushGptcForRoad(uid, roadId, local);
          }
        }

        if (!hasGptcData(local) && tenTuyen) {
          local = {
            ...local,
            tenTuyen,
            year: local.year || String(new Date().getFullYear())
          };
          saveGptcLedger(scope, local);
        }

        if (!cancelled) {
          setLedger(local);
          setReady(true);
        }
      } catch (err) {
        console.warn("Không hydrate được sổ cấp phép thi công.", err);
        if (!cancelled) {
          setLedger(loadGptcLedger(scope));
          setReady(true);
        }
      } finally {
        hydratingRef.current = false;
      }
    }

    setReady(false);
    void hydrate();
    return () => {
      cancelled = true;
      hydratingRef.current = false;
    };
  }, [enabled, scope, uid, roadId, roadName, tenTuyen, canPush, browseMode]);

  const updateLedger = useCallback(
    (updater) => {
      if (!scope || !canPush) return;
      setLedger((prev) => {
        const base = prev || loadGptcLedger(scope);
        const next = typeof updater === "function" ? updater(base) : updater;
        const saved = saveGptcLedger(scope, next);
        localDirty.current = true;
        schedulePush();
        return saved;
      });
    },
    [scope, canPush, schedulePush]
  );

  useEffect(
    () => () => {
      if (pushTimer.current) clearTimeout(pushTimer.current);
    },
    []
  );

  return { ledger, setLedger: updateLedger, ready, scope, flushPush };
}
