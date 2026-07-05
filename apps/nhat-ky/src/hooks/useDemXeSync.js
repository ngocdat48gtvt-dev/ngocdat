import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadDemXeLedger,
  saveDemXeLedger,
  setDemXeLedger,
  coverFromRoad,
  demXeScope
} from "../utils/demXeStore";
import { fetchDemXeForRoad, pushDemXeForRoad } from "../services/demXeService";
import { loadStorage } from "../utils/nhatKyFormat";

const PUSH_DEBOUNCE_MS = 1800;

export function useDemXeSync({ uid, roadId, roadName, activeRoad, storageKey, enabled = true }) {
  const scope = demXeScope(uid, roadId);
  const [ledger, setLedger] = useState(() => (scope ? loadDemXeLedger(scope) : null));
  const [ready, setReady] = useState(false);
  const pushTimer = useRef(null);
  const localDirty = useRef(false);

  useEffect(() => {
    if (!enabled || !scope) {
      setLedger(null);
      setReady(true);
      return;
    }

    let cancelled = false;
    async function hydrate() {
      let local = loadDemXeLedger(scope);
      const hasLocal =
        Object.keys(local.days || {}).length > 0 ||
        Object.values(local.cover || {}).some((v) => String(v || "").trim());

      if (uid && roadName) {
        const remote = await fetchDemXeForRoad(uid, roadName);
        if (cancelled) return;
        if (remote && !hasLocal) {
          local = setDemXeLedger(scope, remote);
        } else if (remote && hasLocal && !localDirty.current) {
          const remoteTs = JSON.stringify(remote);
          const localTs = JSON.stringify(local);
          if (remoteTs !== localTs) {
            local = setDemXeLedger(scope, remote);
          }
        }
      }

      if (!hasLocal && activeRoad) {
        const { reportMeta } = loadStorage(storageKey || `nhatky_${uid}_${roadId}`);
        const cover = coverFromRoad(activeRoad, reportMeta);
        local = { ...local, cover: { ...cover, ...local.cover } };
        saveDemXeLedger(scope, local);
      }

      if (!cancelled) {
        setLedger(local);
        setReady(true);
      }
    }

    setReady(false);
    hydrate();
    return () => {
      cancelled = true;
    };
  }, [enabled, scope, uid, roadId, roadName, activeRoad, storageKey]);

  const schedulePush = useCallback(() => {
    if (!uid || !roadName) return;
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => {
      const current = loadDemXeLedger(scope);
      pushDemXeForRoad(uid, roadName, current).catch((err) => {
        console.warn("Đồng bộ sổ đếm xe lên cloud thất bại.", err);
      });
    }, PUSH_DEBOUNCE_MS);
  }, [uid, roadName, scope]);

  const updateLedger = useCallback(
    (updater) => {
      if (!scope) return;
      setLedger((prev) => {
        const base = prev || loadDemXeLedger(scope);
        const next = typeof updater === "function" ? updater(base) : updater;
        const saved = saveDemXeLedger(scope, next);
        localDirty.current = true;
        schedulePush();
        return saved;
      });
    },
    [scope, schedulePush]
  );

  useEffect(
    () => () => {
      if (pushTimer.current) clearTimeout(pushTimer.current);
    },
    []
  );

  return { ledger, setLedger: updateLedger, ready, scope };
}
