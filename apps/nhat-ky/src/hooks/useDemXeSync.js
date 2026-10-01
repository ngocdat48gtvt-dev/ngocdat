import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DemXeRepository } from "../officeBooks/repositories/DemXeRepository";
import { loadStorage } from "../utils/nhatKyFormat";

const PUSH_DEBOUNCE_MS = 1800;
const EMPTY_CLOUD_OPTS = Object.freeze({});

export function useDemXeSync({
  uid,
  roadId,
  roadName,
  activeRoad,
  storageKey,
  routeId = "",
  routes = [],
  enabled = true,
  canPush = true,
  browseMode = false,
  offlineMode = false
}) {
  const routeList = Array.isArray(routes) ? routes : [];
  const rid = String(routeId || "").trim();
  const multi = routeList.length > 1;
  const isFirstRoute = multi ? String(routeList[0]?.id || "") === rid : true;
  const routesKey = routeList.map((r) => String(r.id || "")).join("|");

  const readScope = useMemo(
    () => DemXeRepository.resolveScope(uid, roadId, rid, routeList),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [uid, roadId, rid, routesKey]
  );
  const writeScope = useMemo(
    () => DemXeRepository.writeScope(uid, roadId, rid, routeList),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [uid, roadId, rid, routesKey]
  );
  const cloudOpts = useMemo(
    () => (multi && rid ? { routeId: rid, isFirstRoute } : EMPTY_CLOUD_OPTS),
    [multi, rid, isFirstRoute]
  );

  // Chỉ lấy field ổn định — tránh object activeRoad đổi reference mỗi render
  const coverSeedKey = [
    activeRoad?.id || "",
    activeRoad?.roadName || activeRoad?.label || "",
    activeRoad?.hat || "",
    activeRoad?.company || "",
    activeRoad?.kmRange || "",
    activeRoad?.kmFrom || "",
    activeRoad?.kmTo || ""
  ].join("|");

  const [ledger, setLedger] = useState(() =>
    readScope ? DemXeRepository.load(readScope) : null
  );
  const [ready, setReady] = useState(false);
  const pushTimer = useRef(null);
  const localDirty = useRef(false);
  const hydratingRef = useRef(false);
  const activeRoadRef = useRef(activeRoad);
  activeRoadRef.current = activeRoad;

  const flushPush = useCallback(async () => {
    if (!canPush || !uid || !roadId || !writeScope) return;
    const current = DemXeRepository.load(writeScope);
    await DemXeRepository.pushRemote(uid, roadId, current, roadName, cloudOpts);
  }, [canPush, uid, roadId, roadName, writeScope, cloudOpts]);

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
    if (!enabled || !readScope || !writeScope) {
      setLedger(null);
      setReady(true);
      return undefined;
    }

    let cancelled = false;
    localDirty.current = false;

    async function hydrate() {
      hydratingRef.current = true;
      try {
        let local = DemXeRepository.load(readScope);
        const localDays = Object.keys(local.days || {}).length;
        const hasLocal =
          localDays > 0 ||
          Object.values(local.cover || {}).some((v) => String(v || "").trim());

        if (uid && roadId && !offlineMode) {
          const remote = await DemXeRepository.fetchRemote(
            uid,
            roadId,
            roadName,
            cloudOpts
          );
          if (cancelled) return;
          if (remote) {
            const remoteDays = Object.keys(remote.days || {}).length;
            const hasRemote =
              remoteDays > 0 ||
              Object.values(remote.cover || {}).some((v) => String(v || "").trim());
            const takeRemote =
              hasRemote &&
              (browseMode ||
                !hasLocal ||
                (!localDirty.current && remoteDays >= localDays));
            if (takeRemote && JSON.stringify(remote) !== JSON.stringify(local)) {
              local = DemXeRepository.replace(writeScope, remote);
            } else if (!hasRemote && hasLocal && canPush) {
              if (readScope !== writeScope) {
                local = DemXeRepository.replace(writeScope, local);
              }
              await DemXeRepository.pushRemote(uid, roadId, local, roadName, cloudOpts);
            }
          } else if (hasLocal && canPush) {
            if (readScope !== writeScope) {
              local = DemXeRepository.replace(writeScope, local);
            }
            await DemXeRepository.pushRemote(uid, roadId, local, roadName, cloudOpts);
          }
        }

        const road = activeRoadRef.current;
        if (!hasLocal && road) {
          const { reportMeta } = loadStorage(storageKey || `nhatky_${uid}_${roadId}`);
          const cover = DemXeRepository.coverFromRoad(road, reportMeta);
          local = { ...local, cover: { ...cover, ...local.cover } };
          DemXeRepository.save(writeScope, local);
        }

        if (!cancelled) {
          setLedger(local);
          setReady(true);
        }
      } catch (err) {
        console.warn("Không hydrate được sổ đếm xe.", err);
        if (!cancelled) {
          setLedger(DemXeRepository.load(writeScope));
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
  }, [
    enabled,
    readScope,
    writeScope,
    uid,
    roadId,
    roadName,
    coverSeedKey,
    storageKey,
    canPush,
    browseMode,
    offlineMode,
    cloudOpts
  ]);

  const updateLedger = useCallback(
    (updater) => {
      if (!writeScope || (!canPush && !offlineMode)) return;
      setLedger((prev) => {
        const base = prev || DemXeRepository.load(writeScope);
        const next = typeof updater === "function" ? updater(base) : updater;
        const saved = DemXeRepository.save(writeScope, next);
        localDirty.current = true;
        schedulePush();
        return saved;
      });
    },
    [writeScope, canPush, offlineMode, schedulePush]
  );

  useEffect(
    () => () => {
      if (pushTimer.current) clearTimeout(pushTimer.current);
    },
    []
  );

  return { ledger, setLedger: updateLedger, ready, scope: writeScope, flushPush };
}
