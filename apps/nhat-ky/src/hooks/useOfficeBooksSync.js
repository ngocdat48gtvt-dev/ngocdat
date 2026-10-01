import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchOfficeBookAsStorage,
  pushOfficeBookDays,
  pushOfficeBookMeta
} from "../services/officeBooksService";
import { loadStorage, saveStorage } from "../utils/nhatKyFormat";
import {
  applySyncedDayResults,
  applySyncedReportMeta,
  mergeRemoteSafelyIntoLocalStorage,
  splitStorageByDay
} from "../utils/officeBooksLocal";
import {
  alignLegacyRecordIds,
  dedupeDiaryEntriesByFingerprint,
  activeDiaryEntries,
  diaryBusinessFingerprint,
  recoverFalseLegacyDeleteTombstones
} from "../utils/officeBooksConflictMerge";
import { subscribeOfficeBooksLocalChange } from "../utils/officeBooksSyncBus";
import { syncRoadMetaToStorage } from "../utils/roadsCatalog";
import {
  clearPendingOfficeBook,
  loadPendingOfficeBook,
  savePendingOfficeBook
} from "../utils/officeBooksPendingQueue";

const PUSH_DEBOUNCE_MS = 0;
// Trước đây 2000ms → sửa ngày BDTX chỉ nằm local; F5 trước khi đẩy = mất dữ liệu.
// 0 = mỗi lần saveStorage đẩy cloud ngay (vẫn gộp nếu nhiều notify cùng tick).
const SYNC_MARKER_PREFIX = "nhatky_office_sync_v1_";
// v4: marker sau khi tắt incremental (v3 dễ sót ngày legacy không có updatedAt).
const FULL_SYNC_MARKER_PREFIX = "nhatky_office_full_sync_v4_";

function syncMarkerKey(uid, roadId) {
  return `${SYNC_MARKER_PREFIX}${uid}_${roadId}`;
}

function writeSyncMarker(uid, roadId, value = Date.now()) {
  try {
    localStorage.setItem(syncMarkerKey(uid, roadId), String(value));
  } catch {
    // Cache marker is optional; a full hydrate next time remains safe.
  }
}

function fullSyncMarkerKey(uid, roadId) {
  return `${FULL_SYNC_MARKER_PREFIX}${uid}_${roadId}`;
}

function writeFullSyncMarker(uid, roadId, value = Date.now()) {
  try {
    localStorage.setItem(fullSyncMarkerKey(uid, roadId), String(value));
  } catch {
    // Thiếu marker chỉ làm lần mở sau đối soát đầy đủ lại; không ảnh hưởng dữ liệu.
  }
}

function dayFingerprint(day) {
  return JSON.stringify({
    entries: day.entries || [],
    dayMeta: day.dayMeta || {}
  });
}

function pendingSnapshotAsRemote(snapshot) {
  const remoteDays = splitStorageByDay(snapshot || {});
  return {
    entries: activeDiaryEntries(snapshot?.entries || []),
    dayMeta: snapshot?.dayMeta || {},
    reportMeta: snapshot?.reportMeta || {},
    remoteDays,
    remoteDayCount: remoteDays.length
  };
}

/** Baseline transaction phải là snapshot cloud, không phải bản local đã gộp. */
function ensureAlignedDayEntries(hydratedDay, remoteDay) {
  if (!remoteDay) return [];
  const hydrated = recoverFalseLegacyDeleteTombstones(hydratedDay?.entries || []);
  const remote = recoverFalseLegacyDeleteTombstones(remoteDay.entries || []);
  // Entry cloud legacy thiếu recordId được mượn ID từ bản hydrate tương ứng.
  return alignLegacyRecordIds(remote, hydrated);
}

/**
 * Hydrate sổ từ Firestore → localStorage; USER debounce-push khi saveStorage.
 * ADMIN/VIEWER (canPush=false): chỉ đọc cloud.
 */
export function useOfficeBooksSync({
  uid,
  roadId,
  storageKey,
  focusDate = "",
  enabled = true,
  canPush = false,
  browseMode = false,
  catalogRoad = null,
  onHydrated
}) {
  const hydratingRef = useRef(false);
  const pushedFpRef = useRef(new Map());
  const pushTimer = useRef(null);
  const metaFpRef = useRef("");
  const baseDaysRef = useRef(new Map());
  const baseMetaRef = useRef({ reportMeta: {}, revision: 0 });
  const onHydratedRef = useRef(onHydrated);
  const catalogRoadRef = useRef(catalogRoad);
  const pendingWriteRef = useRef(Promise.resolve());
  const flushRunRef = useRef(null);
  const hydrateGenRef = useRef(0);
  const [syncStatus, setSyncStatus] = useState("idle");
  const [syncError, setSyncError] = useState("");

  useEffect(() => {
    onHydratedRef.current = onHydrated;
    catalogRoadRef.current = catalogRoad;
  }, [onHydrated, catalogRoad]);

  const applyCatalogMeta = useCallback(() => {
    const road = catalogRoadRef.current;
    if (!uid || !road?.id) return;
    syncRoadMetaToStorage(uid, road);
  }, [uid]);

  const persistCurrentPending = useCallback(() => {
    if (!storageKey) return Promise.resolve(false);
    const snapshot = loadStorage(storageKey, { includeDeleted: true });
    const write = pendingWriteRef.current
      .catch(() => false)
      .then(() => savePendingOfficeBook(storageKey, snapshot));
    pendingWriteRef.current = write;
    return write;
  }, [storageKey]);

  const flushPush = useCallback(async () => {
    if (!canPush || !uid || !roadId || !storageKey) return;
    if (flushRunRef.current) return flushRunRef.current;

    const run = (async () => {
      setSyncStatus("syncing");
      setSyncError("");
      await pendingWriteRef.current.catch(() => false);
      applyCatalogMeta();
      const stored = loadStorage(storageKey, { includeDeleted: true });
      await savePendingOfficeBook(storageKey, stored);
      const days = splitStorageByDay(stored);
      const dirtyDays = days.filter((d) => {
        const fp = dayFingerprint(d);
        return pushedFpRef.current.get(d.date) !== fp;
      });

      try {
        if (dirtyDays.length) {
          const results = await pushOfficeBookDays(uid, roadId, dirtyDays, {
            baseDays: baseDaysRef.current
          });
          const canonical = applySyncedDayResults(storageKey, results);
          const canonicalDays = splitStorageByDay(canonical);
          (results || []).forEach((result) => {
            baseDaysRef.current.set(result.date, {
              entries: result.rawEntries || result.entries || [],
              dayMeta: result.dayMeta || {},
              revision: result.revision || 0
            });
            const day = canonicalDays.find((item) => item.date === result.date);
            if (day) pushedFpRef.current.set(day.date, dayFingerprint(day));
          });
          if ((results || []).some((result) => result?.conflicts?.length)) {
            console.warn("Phát hiện xung đột office_books; đã bảo toàn trong metadata.");
          }
        }
        const latest = loadStorage(storageKey);
        const metaFp = JSON.stringify(latest.reportMeta || {});
        if (metaFp !== metaFpRef.current) {
          const result = await pushOfficeBookMeta(uid, roadId, latest.reportMeta || {}, {
            baseMeta: baseMetaRef.current.reportMeta,
            baseRevision: baseMetaRef.current.revision
          });
          baseMetaRef.current = {
            reportMeta: result?.reportMeta || latest.reportMeta || {},
            revision: result?.revision || 0
          };
          applySyncedReportMeta(storageKey, baseMetaRef.current.reportMeta);
          metaFpRef.current = JSON.stringify(baseMetaRef.current.reportMeta);
        }

        const current = loadStorage(storageKey, { includeDeleted: true });
        const stillDirty =
          splitStorageByDay(current).some(
            (day) => pushedFpRef.current.get(day.date) !== dayFingerprint(day)
          ) ||
          JSON.stringify(current.reportMeta || {}) !== metaFpRef.current;
        if (stillDirty) {
          await savePendingOfficeBook(storageKey, current);
          setSyncStatus("pending");
        } else {
          await clearPendingOfficeBook(storageKey);
          setSyncStatus("synced");
        }
        return true;
      } catch (err) {
        await savePendingOfficeBook(
          storageKey,
          loadStorage(storageKey, { includeDeleted: true })
        );
        setSyncStatus("error");
        setSyncError(err?.message || "Không kết nối được Firestore.");
        console.warn("Đồng bộ office_books lên cloud thất bại.", err);
        return false;
      }
    })();

    flushRunRef.current = run;
    try {
      return await run;
    } finally {
      if (flushRunRef.current === run) flushRunRef.current = null;
    }
  }, [canPush, uid, roadId, storageKey, applyCatalogMeta]);

  const schedulePush = useCallback(() => {
    if (!canPush || hydratingRef.current) return;
    setSyncStatus("pending");
    setSyncError("");
    void persistCurrentPending();
    if (pushTimer.current) clearTimeout(pushTimer.current);
    // Debounce 0: xếp hàng microtask/cùng tick rồi flush — không chờ vài giây trên máy.
    pushTimer.current = setTimeout(() => {
      pushTimer.current = null;
      void flushPush();
    }, PUSH_DEBOUNCE_MS);
  }, [canPush, flushPush, persistCurrentPending]);

  const retrySync = useCallback(async () => {
    if (!canPush) return false;
    setSyncStatus("pending");
    setSyncError("");
    await persistCurrentPending();
    return flushPush();
  }, [canPush, flushPush, persistCurrentPending]);

  useEffect(() => {
    if (syncStatus !== "pending" || !canPush || hydratingRef.current) return undefined;
    const timer = setTimeout(() => void flushPush(), 25);
    return () => clearTimeout(timer);
  }, [syncStatus, canPush, flushPush]);

  useEffect(() => {
    if (!canPush || (syncStatus !== "error" && syncStatus !== "pending")) {
      return undefined;
    }
    const onOnline = () => void retrySync();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [canPush, syncStatus, retrySync]);

  useEffect(() => {
    if (!enabled || !uid || !roadId || !storageKey) return undefined;

    let cancelled = false;
    const gen = ++hydrateGenRef.current;

    async function hydrate() {
      hydratingRef.current = true;
      let skipPushAfterHydrate;
      let hadPending = false;
      let hydrateFailed = false;
      try {
        if (canPush && !browseMode) {
          setSyncStatus("checking");
          setSyncError("");
          const pending = await loadPendingOfficeBook(storageKey);
          if (pending) {
            hadPending = true;
            mergeRemoteSafelyIntoLocalStorage(
              storageKey,
              pendingSnapshotAsRemote(pending)
            );
          }
        }
        const syncStartedAt = Date.now();
        const local = loadStorage(storageKey, { includeDeleted: true });
        const hasLocalLive = activeDiaryEntries(local.entries || []).length > 0;
        const hasLocalTombs = (local.entries || []).some((e) => e?.deletedAt);
        const hasLocal = hasLocalLive || hasLocalTombs;
        // Máy mới / local trống: dọn quota trước, chỉ tải cloud, không push ngay.
        skipPushAfterHydrate = (!hasLocal && !hadPending) || browseMode;
        // Luôn tải đủ ngày từ cloud. Incremental (updatedAt) dễ bỏ sót document
        // legacy không có field updatedAt → máy/tài khoản khác mở sổ thấy trống/thiếu.
        const remote = await fetchOfficeBookAsStorage(uid, roadId, { sinceMs: 0 });
        if (cancelled) return;

        const hasRemote = (remote.remoteDayCount || 0) > 0;

        if (hasRemote) {
          // ADMIN/VIEWER browse: luôn lấy cloud của USER (không giữ cache local máy admin).
          if (browseMode) {
            const entries = [];
            const dayMeta = {};
            (remote.remoteDays || []).forEach((day) => {
              activeDiaryEntries(day.entries || []).forEach((entry) => entries.push(entry));
              if (day.dayMeta && Object.keys(day.dayMeta).length) {
                dayMeta[day.date] = day.dayMeta;
              }
            });
            const remoteMeta =
              remote.reportMeta && typeof remote.reportMeta === "object"
                ? remote.reportMeta
                : {};
            saveStorage(entries, dayMeta, { ...remoteMeta }, storageKey, {
              silent: true,
              replaceAll: true
            });
            const written = loadStorage(storageKey);
            if (entries.length && !activeDiaryEntries(written.entries || []).length) {
              throw new Error("Không ghi được sổ tuần đường vào trình duyệt (bộ nhớ đầy).");
            }
          } else {
            // Gộp cloud → local theo nội dung (tránh nhân đôi khi khác recordId)
            mergeRemoteSafelyIntoLocalStorage(storageKey, remote);
          }
          // Catalog hạt thắng tên công ty sau khi hydrate (tránh meta cloud cũ đè)
          applyCatalogMeta();
          // Không gọi syncGptcLedgerToNhatKy ở đây: trên máy mới sổ CPTC local còn trống
          // → prune sẽ xóa dòng NK gắn CPTC, rồi flushPush đẩy tombstone lên cloud = mất dữ liệu.
          // useGptcSync sẽ sync CPTC→NK sau khi hydrate xong sổ cấp phép.

          const hydratedDays = splitStorageByDay(
            loadStorage(storageKey, { includeDeleted: true })
          );
          const remoteByDate = new Map(
            (remote.remoteDays || []).map((day) => [day.date, day])
          );
          baseDaysRef.current = new Map(
            hydratedDays.map((day) => {
              const remoteDay = remoteByDate.get(day.date);
              return [
                day.date,
                {
                  entries: ensureAlignedDayEntries(day, remoteDay),
                  dayMeta: day.dayMeta || {},
                  revision: remoteDay?.revision || 0
                }
              ];
            })
          );
          baseMetaRef.current = {
            reportMeta: remote.reportMeta || {},
            revision: remote.metaRevision || 0
          };
          // Đánh dấu đã khớp với bản vừa hydrate — không push xóa nhầm lên cloud.
          pushedFpRef.current = new Map(
            hydratedDays.map((day) => [day.date, dayFingerprint(day)])
          );
          // Tombstone local đã thắng bản sống trên cloud → phải đẩy xóa lên cloud.
          // Bản ghi chỉ có local (recordId mới trên ngày đã có cloud) → phải đẩy;
          // trước đây `if (!rem) return false` khiến admin không thấy dữ liệu từ máy USER.
          hydratedDays.forEach((day) => {
            const remoteDay = remoteByDate.get(day.date);
            const remoteRaw = remoteDay?.entries || [];
            const remoteRecovered = recoverFalseLegacyDeleteTombstones(remoteRaw);
            const remoteLive = activeDiaryEntries(remoteDay?.entries || []);
            const localLive = activeDiaryEntries(day.entries || []);
            const tombs = (day.entries || []).filter((e) => e?.deletedAt);

            // Dọn vĩnh viễn tombstone bị tạo nhầm ở phiên bản lỗi; ADMIN có thể
            // xem ngay, USER mở sổ sẽ đẩy lại document sạch lên Firestore.
            let needsPush = remoteRaw.some(
              (entry, index) => entry?.deletedAt && !remoteRecovered[index]?.deletedAt
            );
            if (!needsPush && tombs.length && remoteLive.length) {
              const tombFps = new Set(tombs.map((e) => diaryBusinessFingerprint(e)));
              const tombIds = new Set(
                tombs.map((e) => String(e.recordId || "").trim()).filter(Boolean)
              );
              needsPush = remoteLive.some((e) => {
                const id = String(e.recordId || "").trim();
                return (id && tombIds.has(id)) || tombFps.has(diaryBusinessFingerprint(e));
              });
            }
            if (!needsPush && localLive.length) {
              const remoteById = new Map(
                remoteLive
                  .map((e) => [String(e.recordId || "").trim(), e])
                  .filter(([id]) => id)
              );
              const remoteFps = new Set(remoteLive.map((e) => diaryBusinessFingerprint(e)));
              needsPush = localLive.some((e) => {
                const id = String(e.recordId || "").trim();
                if (id) {
                  const rem = remoteById.get(id);
                  if (!rem) return true;
                  return JSON.stringify(e) !== JSON.stringify(rem);
                }
                return !remoteFps.has(diaryBusinessFingerprint(e));
              });
            }
            if (needsPush) {
              pushedFpRef.current.delete(day.date);
              skipPushAfterHydrate = false;
            }
          });
          metaFpRef.current = JSON.stringify(
            (loadStorage(storageKey).reportMeta || {})
          );
          writeSyncMarker(uid, roadId, syncStartedAt);
          writeFullSyncMarker(uid, roadId, syncStartedAt);
          onHydratedRef.current?.();

          // Local đã có sẵn trước hydrate: đẩy ngày chỉ có local + ngày lệch nội dung (ở trên).
          if (hasLocal && canPush && !browseMode) {
            const localOnlyDays = hydratedDays.filter((day) => !remoteByDate.has(day.date));
            if (localOnlyDays.length) {
              skipPushAfterHydrate = false;
              localOnlyDays.forEach((day) => {
                pushedFpRef.current.delete(day.date);
              });
            }
          }
        } else if (browseMode) {
          // Cloud trống / chưa có ngày: xóa cache máy admin, không giữ dữ liệu cũ.
          saveStorage([], {}, remote.reportMeta || {}, storageKey, {
            silent: true,
            replaceAll: true
          });
          applyCatalogMeta();
          baseDaysRef.current = new Map();
          baseMetaRef.current = {
            reportMeta: remote.reportMeta || {},
            revision: remote.metaRevision || 0
          };
          pushedFpRef.current = new Map();
          metaFpRef.current = JSON.stringify(remote.reportMeta || {});
          writeSyncMarker(uid, roadId, syncStartedAt);
          writeFullSyncMarker(uid, roadId, syncStartedAt);
          onHydratedRef.current?.();
          skipPushAfterHydrate = true;
        } else if (hasLocal && canPush) {
          applyCatalogMeta();
          const fresh = loadStorage(storageKey, { includeDeleted: true });
          const dedupedEntries = dedupeDiaryEntriesByFingerprint(fresh.entries || []);
          if (dedupedEntries.length !== (fresh.entries || []).length) {
            saveStorage(dedupedEntries, fresh.dayMeta || {}, fresh.reportMeta || {}, storageKey, {
              silent: true,
              replaceAll: true
            });
            onHydratedRef.current?.();
          }
          const days = splitStorageByDay(loadStorage(storageKey, { includeDeleted: true }));
          if (days.length) {
            const results = await pushOfficeBookDays(uid, roadId, days);
            const canonical = applySyncedDayResults(storageKey, results);
            (results || []).forEach((result) => {
              baseDaysRef.current.set(result.date, {
                entries: result.rawEntries || result.entries || [],
                dayMeta: result.dayMeta || {},
                revision: result.revision || 0
              });
            });
            splitStorageByDay(canonical).forEach((d) =>
              pushedFpRef.current.set(d.date, dayFingerprint(d))
            );
          }
          const metaResult = await pushOfficeBookMeta(
            uid,
            roadId,
            loadStorage(storageKey).reportMeta || {}
          );
          baseMetaRef.current = {
            reportMeta: metaResult?.reportMeta || loadStorage(storageKey).reportMeta || {},
            revision: metaResult?.revision || 0
          };
          metaFpRef.current = JSON.stringify(baseMetaRef.current.reportMeta);
          writeSyncMarker(uid, roadId, syncStartedAt);
          writeFullSyncMarker(uid, roadId, syncStartedAt);
          await clearPendingOfficeBook(storageKey);
          skipPushAfterHydrate = true;
        } else {
          applyCatalogMeta();
          pushedFpRef.current = new Map();
          metaFpRef.current = "";
          writeSyncMarker(uid, roadId, syncStartedAt);
          writeFullSyncMarker(uid, roadId, syncStartedAt);
          onHydratedRef.current?.();
          skipPushAfterHydrate = true;
        }
      } catch (err) {
        hydrateFailed = true;
        console.warn("Không hydrate được office_books.", err);
        skipPushAfterHydrate = true;
        if (canPush && !browseMode) {
          setSyncStatus("error");
          setSyncError(err?.message || "Không đối chiếu được dữ liệu cloud.");
        }
      } finally {
        // Phiên hydrate cũ không được hạ cờ của phiên mới (nếu không, push chạy
        // khi cloud chưa về và sổ trên màn hình thành lúc có lúc trống).
        if (hydrateGenRef.current !== gen) return;
        hydratingRef.current = false;
        if (!cancelled && canPush && !browseMode && !skipPushAfterHydrate) {
          setSyncStatus("pending");
          setTimeout(() => void flushPush(), 0);
        } else if (!cancelled && canPush && !browseMode && !hydrateFailed) {
          setSyncStatus("synced");
        }
      }
    }

    pushedFpRef.current = new Map();
    metaFpRef.current = "";
    baseDaysRef.current = new Map();
    baseMetaRef.current = { reportMeta: {}, revision: 0 };
    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [
    enabled,
    uid,
    roadId,
    storageKey,
    canPush,
    browseMode,
    applyCatalogMeta,
    flushPush
  ]);

  // Đọc trực tiếp ngày người dùng đang mở — chỉ khi local chưa có ngày đó
  // (tránh ghi lại cả sổ mỗi lần đổi ngày → QuotaExceeded trên Chrome).
  useEffect(() => {
    if (!enabled || !uid || !roadId || !storageKey || !/^\d{4}-\d{2}-\d{2}$/.test(focusDate)) {
      return undefined;
    }
    const local = loadStorage(storageKey, { includeDeleted: true });
    const hasDay =
      (local.entries || []).some((e) => String(e.date || "") === focusDate) ||
      Boolean(local.dayMeta?.[focusDate]);
    if (hasDay) return undefined;

    let cancelled = false;
    void fetchOfficeBookAsStorage(uid, roadId, {
      dateFrom: focusDate,
      dateTo: focusDate
    })
      .then((remote) => {
        if (cancelled || !(remote.remoteDayCount > 0)) return;
        mergeRemoteSafelyIntoLocalStorage(storageKey, remote);
        applyCatalogMeta();
        onHydratedRef.current?.();
      })
      .catch((err) => {
        console.warn(`Không tải được nhật ký ngày ${focusDate}.`, err);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, uid, roadId, storageKey, focusDate, applyCatalogMeta]);

  // Đổi tên công ty trên danh mục → ghi lại local + báo UI
  useEffect(() => {
    if (!enabled || !uid || !catalogRoad?.id || !storageKey) return;
    applyCatalogMeta();
    onHydratedRef.current?.();
  }, [
    enabled,
    uid,
    storageKey,
    catalogRoad?.id,
    catalogRoad?.company,
    catalogRoad?.hat,
    catalogRoad?.roadName,
    catalogRoad?.kmRange,
    applyCatalogMeta
  ]);

  useEffect(() => {
    if (!enabled || !storageKey) return undefined;
    return subscribeOfficeBooksLocalChange((key) => {
      if (key !== storageKey) return;
      schedulePush();
    });
  }, [enabled, storageKey, schedulePush]);

  // F5 / đổi tab: đẩy ngay (không chờ debounce 2s) để sửa ngày BDTX không bị hydrate đè.
  useEffect(() => {
    if (!enabled || !canPush || browseMode) return undefined;
    function flushSoon() {
      if (pushTimer.current) {
        clearTimeout(pushTimer.current);
        pushTimer.current = null;
      }
      void persistCurrentPending().then(() => flushPush());
    }
    function onVisibility() {
      if (document.visibilityState === "hidden") flushSoon();
    }
    window.addEventListener("pagehide", flushSoon);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flushSoon);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, canPush, browseMode, flushPush, persistCurrentPending]);

  useEffect(
    () => () => {
      if (pushTimer.current) clearTimeout(pushTimer.current);
    },
    []
  );

  return {
    status: canPush ? syncStatus : browseMode ? "readonly" : "idle",
    error: syncError,
    retry: retrySync
  };
}
