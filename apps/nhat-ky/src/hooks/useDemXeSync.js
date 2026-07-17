import { useCallback, useEffect, useRef, useState } from "react";
import { DemXeRepository } from "../officeBooks/repositories/DemXeRepository";
import { loadStorage } from "../utils/nhatKyFormat";

const PUSH_DEBOUNCE_MS = 1800;

export function useDemXeSync({
  uid,
  roadId,
  roadName,
  activeRoad,
  storageKey,
  enabled = true,
  canPush = true,
  browseMode = false
}) {
  const scope = DemXeRepository.scope(uid, roadId);
  const [ledger, setLedger] = useState(() => (scope ? DemXeRepository.load(scope) : null));
  const [ready, setReady] = useState(false);
  const pushTimer = useRef(null);
  const localDirty = useRef(false);
  const hydratingRef = useRef(false);

  const flushPush = useCallback(async () => {
    if (!canPush || !uid || !roadId || !scope) return;
    const current = DemXeRepository.load(scope);
    await DemXeRepository.pushRemote(uid, roadId, current, roadName);
  }, [canPush, uid, roadId, roadName, scope]);

  const schedulePush = useCallback(() => {
    if (!canPush || hydratingRef.current) return;
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => {
      flushPush().catch((err) => {
        console.warn("Đồng bộ sổ đếm xe lên cloud thất bại.", err);
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
        let local = DemXeRepository.load(scope);
        const hasLocal =
          Object.keys(local.days || {}).length > 0 ||
          Object.values(local.cover || {}).some((v) => String(v || "").trim());

        if (uid && roadId) {
          const remote = await DemXeRepository.fetchRemote(uid, roadId, roadName);
          if (cancelled) return;
          if (remote && (browseMode || !hasLocal || !localDirty.current)) {
            if (browseMode || !hasLocal || JSON.stringify(remote) !== JSON.stringify(local)) {
              local = DemXeRepository.replace(scope, remote);
            }
          } else if (!remote && hasLocal && canPush) {
            await DemXeRepository.pushRemote(uid, roadId, local, roadName);
          }
        }

        if (!hasLocal && activeRoad) {
          const { reportMeta } = loadStorage(storageKey || `nhatky_${uid}_${roadId}`);
          const cover = DemXeRepository.coverFromRoad(activeRoad, reportMeta);
          local = { ...local, cover: { ...cover, ...local.cover } };
          DemXeRepository.save(scope, local);
        }

        if (!cancelled) {
          setLedger(local);
          setReady(true);
        }
      } catch (err) {
        console.warn("Không hydrate được sổ đếm xe.", err);
        if (!cancelled) {
          setLedger(DemXeRepository.load(scope));
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
  }, [enabled, scope, uid, roadId, roadName, activeRoad, storageKey, canPush, browseMode]);

  const updateLedger = useCallback(
    (updater) => {
      if (!scope || !canPush) return;
      setLedger((prev) => {
        const base = prev || DemXeRepository.load(scope);
        const next = typeof updater === "function" ? updater(base) : updater;
        const saved = DemXeRepository.save(scope, next);
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
