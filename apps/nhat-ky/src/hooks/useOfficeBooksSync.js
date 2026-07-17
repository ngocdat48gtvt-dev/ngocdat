import { useCallback, useEffect, useRef } from "react";
import {
  fetchOfficeBookAsStorage,
  pushOfficeBookDays,
  pushOfficeBookMeta
} from "../services/officeBooksService";
import { loadStorage } from "../utils/nhatKyFormat";
import { mergeRemoteIntoLocalStorage, splitStorageByDay } from "../utils/officeBooksLocal";
import { subscribeOfficeBooksLocalChange } from "../utils/officeBooksSyncBus";

const PUSH_DEBOUNCE_MS = 2000;

function dayFingerprint(day) {
  return JSON.stringify({
    entries: day.entries || [],
    dayMeta: day.dayMeta || {}
  });
}

/**
 * Hydrate sổ từ Firestore → localStorage; USER debounce-push khi saveStorage.
 * ADMIN/VIEWER (canPush=false): chỉ đọc cloud.
 */
export function useOfficeBooksSync({
  uid,
  roadId,
  storageKey,
  enabled = true,
  canPush = false,
  browseMode = false,
  onHydrated
}) {
  const hydratingRef = useRef(false);
  const pushedFpRef = useRef(new Map());
  const pushTimer = useRef(null);
  const metaFpRef = useRef("");
  const onHydratedRef = useRef(onHydrated);
  onHydratedRef.current = onHydrated;

  const flushPush = useCallback(async () => {
    if (!canPush || !uid || !roadId || !storageKey) return;
    const stored = loadStorage(storageKey);
    const days = splitStorageByDay(stored);
    const dirtyDays = days.filter((d) => {
      const fp = dayFingerprint(d);
      return pushedFpRef.current.get(d.date) !== fp;
    });

    try {
      if (dirtyDays.length) {
        await pushOfficeBookDays(uid, roadId, dirtyDays);
        dirtyDays.forEach((d) => {
          pushedFpRef.current.set(d.date, dayFingerprint(d));
        });
      }
      const metaFp = JSON.stringify(stored.reportMeta || {});
      if (metaFp !== metaFpRef.current) {
        await pushOfficeBookMeta(uid, roadId, stored.reportMeta || {});
        metaFpRef.current = metaFp;
      }
    } catch (err) {
      console.warn("Đồng bộ office_books lên cloud thất bại.", err);
    }
  }, [canPush, uid, roadId, storageKey]);

  const schedulePush = useCallback(() => {
    if (!canPush || hydratingRef.current) return;
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => {
      void flushPush();
    }, PUSH_DEBOUNCE_MS);
  }, [canPush, flushPush]);

  useEffect(() => {
    if (!enabled || !uid || !roadId || !storageKey) return undefined;

    let cancelled = false;

    async function hydrate() {
      hydratingRef.current = true;
      try {
        const remote = await fetchOfficeBookAsStorage(uid, roadId);
        if (cancelled) return;

        const local = loadStorage(storageKey);
        const hasLocal = (local.entries || []).length > 0;
        const hasRemote = (remote.remoteDayCount || 0) > 0 || (remote.entries || []).length > 0;

        if (hasRemote) {
          mergeRemoteIntoLocalStorage(storageKey, remote, {
            replace: browseMode || !hasLocal
          });
          splitStorageByDay(loadStorage(storageKey)).forEach((d) => {
            pushedFpRef.current.set(d.date, dayFingerprint(d));
          });
          metaFpRef.current = JSON.stringify(
            (loadStorage(storageKey).reportMeta || {})
          );
          onHydratedRef.current?.();
        } else if (hasLocal && canPush) {
          // Migration one-shot: local → cloud
          const days = splitStorageByDay(local);
          if (days.length) {
            await pushOfficeBookDays(uid, roadId, days);
            days.forEach((d) => pushedFpRef.current.set(d.date, dayFingerprint(d)));
          }
          await pushOfficeBookMeta(uid, roadId, local.reportMeta || {});
          metaFpRef.current = JSON.stringify(local.reportMeta || {});
        } else {
          pushedFpRef.current = new Map();
          metaFpRef.current = "";
        }
      } catch (err) {
        console.warn("Không hydrate được office_books.", err);
      } finally {
        hydratingRef.current = false;
      }
    }

    pushedFpRef.current = new Map();
    metaFpRef.current = "";
    void hydrate();

    return () => {
      cancelled = true;
      hydratingRef.current = false;
    };
  }, [enabled, uid, roadId, storageKey, canPush, browseMode]);

  useEffect(() => {
    if (!enabled || !storageKey) return undefined;
    return subscribeOfficeBooksLocalChange((key) => {
      if (key !== storageKey) return;
      schedulePush();
    });
  }, [enabled, storageKey, schedulePush]);

  useEffect(
    () => () => {
      if (pushTimer.current) clearTimeout(pushTimer.current);
    },
    []
  );

  return { flushPush };
}
