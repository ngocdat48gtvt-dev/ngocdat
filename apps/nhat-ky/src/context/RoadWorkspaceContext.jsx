import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  fetchOfficeRoadsCatalog,
  subscribeOfficeRoadsCatalog
} from "../services/officeRoadsCatalogService";
import {
  addRoad,
  applyRemoteRoadsCatalog,
  ensureRoadStorage,
  filterEntriesByRouteView,
  findRoute,
  getRoadRoutes,
  getRoadStorageKey,
  getRoutesViewMode,
  getTitleRouteIds,
  loadRoadsCatalog,
  removeRoad,
  roadDisplayLabel,
  setActiveRoadId,
  setRoutesViewMode as persistRoutesViewMode,
  setTitleRouteIds as persistTitleRouteIds,
  syncRoadMetaToStorage,
  updateRoad,
  withRoadTitleView
} from "../utils/roadsCatalog";

export const RoadWorkspaceContext = createContext(null);

function findRoadInCatalog(catalog, roadId) {
  return catalog.roads.find((r) => r.id === roadId) || null;
}

function activeRouteStorageKey(uid, roadId) {
  return `nhatky_active_route_${uid}_${roadId}`;
}

function loadStoredActiveRouteId(uid, roadId) {
  if (!uid || !roadId) return "";
  try {
    return localStorage.getItem(activeRouteStorageKey(uid, roadId)) || "";
  } catch {
    return "";
  }
}

function saveStoredActiveRouteId(uid, roadId, routeId) {
  if (!uid || !roadId) return;
  try {
    if (routeId) localStorage.setItem(activeRouteStorageKey(uid, roadId), routeId);
    else localStorage.removeItem(activeRouteStorageKey(uid, roadId));
  } catch {
    /* ignore */
  }
}

export function RoadWorkspaceProvider({
  uid,
  browseMode = false,
  initialRoadId = "",
  initialRouteId = "",
  catalogLocked = false,
  offlineMode = false,
  children
}) {
  const [catalog, setCatalog] = useState({ activeRoadId: "", roads: [] });
  const [activeRouteId, setActiveRouteIdState] = useState("");
  const [routesViewMode, setRoutesViewModeState] = useState("merged");
  const [titleRouteIds, setTitleRouteIdsState] = useState([]);
  const [routesViewTick, setRoutesViewTick] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!uid) {
      setCatalog({ activeRoadId: "", roads: [] });
      setActiveRouteIdState("");
      setReady(true);
      return;
    }

    // Đổi tài khoản / USER browse → xóa catalog cũ ngay, tránh hiện sổ người trước.
    setCatalog({ activeRoadId: "", roads: [] });
    setActiveRouteIdState("");

    if (offlineMode) {
      setCatalog(loadRoadsCatalog(uid));
      setReady(true);
      return;
    }

    if (browseMode) {
      let cancelled = false;
      setReady(false);
      const watchdog = window.setTimeout(() => {
        void fetchOfficeRoadsCatalog(uid)
          .then((remote) => {
            if (cancelled) return;
            const roads = remote?.roads || [];
            setCatalog({
              roads,
              activeRoadId:
                initialRoadId && roads.some((r) => r.id === initialRoadId)
                  ? initialRoadId
                  : ""
            });
            setReady(true);
          })
          .catch(() => {
            if (!cancelled) setReady(true);
          });
      }, 8000);
      const unsub = subscribeOfficeRoadsCatalog(
        uid,
        (remote) => {
          window.clearTimeout(watchdog);
          if (cancelled) return;
          const roads = remote.roads || [];
          setCatalog({
            roads,
            activeRoadId:
              (initialRoadId && roads.some((r) => r.id === initialRoadId)
                ? initialRoadId
                : "") || ""
          });
          setReady(true);
        },
        () => {
          window.clearTimeout(watchdog);
          if (cancelled) return;
          setCatalog({ activeRoadId: "", roads: [] });
          setReady(true);
        }
      );
      return () => {
        cancelled = true;
        window.clearTimeout(watchdog);
        unsub();
      };
    }

    let cancelled = false;
    setReady(false);
    const finish = (nextCatalog) => {
      if (cancelled) return;
      setCatalog(nextCatalog);
      setReady(true);
    };
    const watchdog = window.setTimeout(() => {
      finish(loadRoadsCatalog(uid));
    }, 8000);
    const unsub = subscribeOfficeRoadsCatalog(
      uid,
      (remote) => {
        window.clearTimeout(watchdog);
        if (cancelled) return;
        try {
          // Cloud là SSOT danh mục sổ — kể cả rỗng (không giữ local lẫn từ máy chung).
          finish(applyRemoteRoadsCatalog(uid, remote || { roads: [], activeRoadId: "" }));
        } catch (err) {
          console.warn("Không áp danh mục đường từ cloud.", err);
          finish({
            roads: remote?.roads || [],
            activeRoadId: remote?.activeRoadId || ""
          });
        }
      },
      () => {
        window.clearTimeout(watchdog);
        if (!cancelled) {
          // Lỗi mạng: chỉ đọc local đã gắn uid (không migrate từ key chung).
          finish(loadRoadsCatalog(uid));
        }
      }
    );

    return () => {
      cancelled = true;
      window.clearTimeout(watchdog);
      unsub();
    };
  }, [uid, browseMode, offlineMode]);

  useEffect(() => {
    if (!browseMode || !initialRoadId) return;
    setCatalog((prev) => ({ ...prev, activeRoadId: initialRoadId }));
  }, [browseMode, initialRoadId]);

  const catalogRoad = useMemo(
    () => findRoadInCatalog(catalog, catalog.activeRoadId),
    [catalog]
  );

  // Khôi phục route đang ghi khi đổi sổ (browse: theo initialRouteId nếu có)
  useEffect(() => {
    if (!catalogRoad) {
      setActiveRouteIdState("");
      setRoutesViewModeState("merged");
      setTitleRouteIdsState([]);
      return;
    }
    const list = getRoadRoutes(catalogRoad);
    setRoutesViewModeState(getRoutesViewMode(uid, catalogRoad));
    setTitleRouteIdsState(getTitleRouteIds(uid, catalogRoad));
    if (browseMode && initialRouteId) {
      const fromBrowse = findRoute(catalogRoad, initialRouteId)?.id;
      if (fromBrowse) {
        setActiveRouteIdState(fromBrowse);
        return;
      }
    }
    const stored = loadStoredActiveRouteId(uid, catalogRoad.id);
    const next = findRoute(catalogRoad, stored)?.id || list[0]?.id || "";
    setActiveRouteIdState(next);
  }, [
    uid,
    browseMode,
    initialRouteId,
    catalogRoad?.id,
    catalogRoad?.routes,
    routesViewTick
  ]);

  const activeRoad = useMemo(
    () =>
      catalogRoad
        ? withRoadTitleView(catalogRoad, activeRouteId, routesViewMode, titleRouteIds)
        : null,
    [catalogRoad, activeRouteId, routesViewMode, titleRouteIds]
  );

  const routes = useMemo(() => getRoadRoutes(catalogRoad), [catalogRoad]);

  const storageKey = useMemo(() => {
    if (!uid || !catalog.activeRoadId) return null;
    return getRoadStorageKey(uid, catalog.activeRoadId);
  }, [uid, catalog.activeRoadId]);

  // Danh mục + chế độ tách/gộp → reportMeta (tiêu đề sổ)
  useEffect(() => {
    if (!uid || !catalogRoad) return;
    ensureRoadStorage(uid, catalogRoad, activeRouteId, routesViewMode, titleRouteIds);
    syncRoadMetaToStorage(uid, catalogRoad, activeRouteId, routesViewMode, titleRouteIds);
  }, [
    uid,
    catalogRoad?.id,
    catalogRoad?.company,
    catalogRoad?.hat,
    catalogRoad?.routes,
    activeRouteId,
    routesViewMode,
    titleRouteIds,
    activeRoad?.roadName,
    activeRoad?.kmRange
  ]);

  const refresh = useCallback(() => {
    if (!uid) return;
    if (offlineMode) {
      setCatalog(loadRoadsCatalog(uid));
      return;
    }
    if (browseMode) {
      void fetchOfficeRoadsCatalog(uid).then((remote) => {
        setCatalog((prev) => ({
          roads: remote.roads || [],
          activeRoadId: prev.activeRoadId
        }));
      });
      return;
    }
    void fetchOfficeRoadsCatalog(uid)
      .then((remote) => {
        setCatalog(applyRemoteRoadsCatalog(uid, remote || { roads: [], activeRoadId: "" }));
      })
      .catch(() => setCatalog(loadRoadsCatalog(uid)));
  }, [uid, browseMode, offlineMode]);

  const selectRoute = useCallback(
    (routeId) => {
      if (!catalogRoad || !routeId) return;
      const route = findRoute(catalogRoad, routeId);
      if (!route) return;
      setActiveRouteIdState(route.id);
      saveStoredActiveRouteId(uid, catalogRoad.id, route.id);
      if (uid) {
        const mode = getRoutesViewMode(uid, catalogRoad);
        const ids = getTitleRouteIds(uid, catalogRoad);
        syncRoadMetaToStorage(uid, catalogRoad, route.id, mode, ids);
      }
    },
    [uid, catalogRoad]
  );

  const selectRoad = useCallback(
    (roadId, routeId = "") => {
      if (!uid || !roadId || browseMode) return;
      const road =
        findRoadInCatalog(catalog, roadId) ||
        loadRoadsCatalog(uid).roads.find((r) => r.id === roadId);
      if (!road) return;
      const mode = getRoutesViewMode(uid, road);
      const ids = getTitleRouteIds(uid, road);
      const chosenRouteId =
        findRoute(road, routeId)?.id || getRoadRoutes(road)[0]?.id || "";
      ensureRoadStorage(uid, road, chosenRouteId, mode, ids);
      syncRoadMetaToStorage(uid, road, chosenRouteId, mode, ids);
      setActiveRoadId(uid, roadId);
      setCatalog(loadRoadsCatalog(uid));
      setActiveRouteIdState(chosenRouteId);
      setRoutesViewModeState(mode);
      setTitleRouteIdsState(ids);
      saveStoredActiveRouteId(uid, roadId, chosenRouteId);
    },
    [uid, browseMode, catalog]
  );

  const setRoutesViewMode = useCallback(
    (mode, roadId) => {
      const targetId = roadId || catalogRoad?.id;
      if (!uid || !targetId) return;
      const road =
        findRoadInCatalog(catalog, targetId) ||
        (catalogRoad?.id === targetId ? catalogRoad : null);
      if (!road || getRoadRoutes(road).length <= 1) return;
      const next = persistRoutesViewMode(uid, targetId, mode);
      setRoutesViewModeState(next);
      const list = getRoadRoutes(road);
      let ids;
      if (next === "merged") {
        ids = list.map((r) => r.id);
        persistTitleRouteIds(uid, targetId, ids);
        setTitleRouteIdsState(ids);
      } else {
        const only = activeRouteId || list[0]?.id || "";
        ids = only ? [only] : [];
        if (only) {
          persistTitleRouteIds(uid, targetId, ids);
          setTitleRouteIdsState(ids);
        }
      }
      setRoutesViewTick((t) => t + 1);
      if (catalog.activeRoadId === targetId) {
        syncRoadMetaToStorage(uid, road, activeRouteId, next, ids);
      }
    },
    [uid, catalog, catalogRoad, activeRouteId]
  );

  const setTitleRouteIds = useCallback(
    (routeIds) => {
      if (!uid || !catalogRoad) return;
      const list = getRoadRoutes(catalogRoad);
      if (list.length <= 1) return;
      const valid = (routeIds || [])
        .map(String)
        .filter((id) => list.some((r) => String(r.id) === id));
      const next = valid.length ? valid : [list[0].id];
      persistTitleRouteIds(uid, catalogRoad.id, next);
      setTitleRouteIdsState(next);
      if (next.length === 1) {
        const only = next[0];
        setActiveRouteIdState(only);
        saveStoredActiveRouteId(uid, catalogRoad.id, only);
        persistRoutesViewMode(uid, catalogRoad.id, "split");
        setRoutesViewModeState("split");
        syncRoadMetaToStorage(uid, catalogRoad, only, "split", next);
      } else {
        persistRoutesViewMode(uid, catalogRoad.id, "merged");
        setRoutesViewModeState("merged");
        syncRoadMetaToStorage(uid, catalogRoad, activeRouteId, "merged", next);
      }
      setRoutesViewTick((t) => t + 1);
    },
    [uid, catalogRoad, activeRouteId]
  );

  const toggleTitleRoute = useCallback(
    (routeId) => {
      if (!catalogRoad || !routeId) return;
      const list = getRoadRoutes(catalogRoad);
      if (list.length <= 1) return;
      const current =
        titleRouteIds.length > 0
          ? titleRouteIds.map(String)
          : list.map((r) => String(r.id));
      const id = String(routeId);
      let next;
      if (routesViewMode === "split") {
        next = [id];
      } else if (current.includes(id)) {
        next = current.filter((x) => x !== id);
        if (!next.length) next = [id];
      } else {
        next = [...current, id];
      }
      setTitleRouteIds(next);
      if (routesViewMode === "split" || next.length === 1) {
        selectRoute(id);
      }
    },
    [catalogRoad, titleRouteIds, routesViewMode, setTitleRouteIds, selectRoute]
  );

  const resolveRoutesViewMode = useCallback(
    (road) => getRoutesViewMode(uid, road),
    [uid, routesViewTick]
  );

  const clearRoad = useCallback(() => {
    if (!uid || browseMode) {
      setCatalog((prev) => ({ ...prev, activeRoadId: "" }));
      setActiveRouteIdState("");
      return;
    }
    setActiveRoadId(uid, "");
    setCatalog(loadRoadsCatalog(uid));
    setActiveRouteIdState("");
  }, [uid, browseMode]);

  const createRoad = useCallback(
    (partial) => {
      if (!uid || browseMode || catalogLocked) return null;
      const road = addRoad(uid, partial);
      refresh();
      return road;
    },
    [uid, browseMode, catalogLocked, refresh]
  );

  const editRoad = useCallback(
    (roadId, patch) => {
      if (!uid || browseMode || catalogLocked) return null;
      const road = updateRoad(uid, roadId, patch);
      refresh();
      return road;
    },
    [uid, browseMode, catalogLocked, refresh]
  );

  const deleteRoad = useCallback(
    (roadId) => {
      if (!uid || browseMode || catalogLocked) return;
      removeRoad(uid, roadId);
      refresh();
    },
    [uid, browseMode, catalogLocked, refresh]
  );

  const filterByRouteView = useCallback(
    (entries) =>
      filterEntriesByRouteView(entries, catalogRoad, {
        routesViewMode,
        activeRouteId,
        titleRouteIds
      }),
    [catalogRoad, routesViewMode, activeRouteId, titleRouteIds]
  );

  const value = {
    ready,
    ownerUid: uid || "",
    roads: catalog.roads,
    activeRoad,
    catalogRoad,
    activeRoadId: catalog.activeRoadId,
    activeRouteId,
    routes,
    routesViewMode,
    titleRouteIds,
    roadSelected: Boolean(catalog.activeRoadId && activeRoad),
    storageKey,
    roadLabel: roadDisplayLabel(catalogRoad),
    browseMode,
    offlineMode,
    catalogLocked,
    selectRoad,
    selectRoute,
    setRoutesViewMode,
    setTitleRouteIds,
    toggleTitleRoute,
    resolveRoutesViewMode,
    clearRoad,
    createRoad,
    editRoad,
    deleteRoad,
    filterByRouteView,
    refresh
  };

  return (
    <RoadWorkspaceContext.Provider value={value}>{children}</RoadWorkspaceContext.Provider>
  );
}

export function useRoadWorkspace() {
  const ctx = useContext(RoadWorkspaceContext);
  if (!ctx) {
    throw new Error("useRoadWorkspace must be used within RoadWorkspaceProvider");
  }
  return ctx;
}
