import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { fetchOfficeRoadsCatalog } from "../services/officeRoadsCatalogService";
import {
  addRoad,
  applyRemoteRoadsCatalog,
  ensureRoadStorage,
  getRoadStorageKey,
  loadRoadsCatalog,
  removeRoad,
  roadDisplayLabel,
  setActiveRoadId,
  syncRoadMetaToStorage,
  updateRoad
} from "../utils/roadsCatalog";

const RoadWorkspaceContext = createContext(null);

function findRoadInCatalog(catalog, roadId) {
  return catalog.roads.find((r) => r.id === roadId) || null;
}

export function RoadWorkspaceProvider({
  uid,
  browseMode = false,
  initialRoadId = "",
  catalogLocked = false,
  children
}) {
  const [catalog, setCatalog] = useState({ activeRoadId: "", roads: [] });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!uid) {
      setCatalog({ activeRoadId: "", roads: [] });
      setReady(true);
      return;
    }

    if (browseMode) {
      let cancelled = false;
      setReady(false);
      void fetchOfficeRoadsCatalog(uid)
        .then((remote) => {
          if (cancelled) return;
          setCatalog({
            roads: remote.roads || [],
            activeRoadId: initialRoadId || ""
          });
        })
        .catch(() => {
          if (!cancelled) setCatalog({ activeRoadId: initialRoadId || "", roads: [] });
        })
        .finally(() => {
          if (!cancelled) setReady(true);
        });
      return () => {
        cancelled = true;
      };
    }

    let cancelled = false;
    setReady(false);
    void fetchOfficeRoadsCatalog(uid)
      .then((remote) => {
        if (cancelled) return;
        if (remote.roads?.length) {
          setCatalog(applyRemoteRoadsCatalog(uid, remote));
        } else {
          setCatalog(loadRoadsCatalog(uid));
        }
      })
      .catch(() => {
        if (!cancelled) setCatalog(loadRoadsCatalog(uid));
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [uid, browseMode]);

  useEffect(() => {
    if (!browseMode || !initialRoadId) return;
    setCatalog((prev) => ({ ...prev, activeRoadId: initialRoadId }));
  }, [browseMode, initialRoadId]);

  const activeRoad = useMemo(
    () => findRoadInCatalog(catalog, catalog.activeRoadId),
    [catalog]
  );

  const storageKey = useMemo(() => {
    if (!uid || !catalog.activeRoadId) return null;
    return getRoadStorageKey(uid, catalog.activeRoadId);
  }, [uid, catalog.activeRoadId]);

  const refresh = useCallback(() => {
    if (!uid) return;
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
        if (remote.roads?.length) {
          setCatalog(applyRemoteRoadsCatalog(uid, remote));
        } else {
          setCatalog(loadRoadsCatalog(uid));
        }
      })
      .catch(() => setCatalog(loadRoadsCatalog(uid)));
  }, [uid, browseMode]);

  const selectRoad = useCallback(
    (roadId) => {
      if (!uid || !roadId || browseMode) return;
      const road =
        findRoadInCatalog(catalog, roadId) ||
        loadRoadsCatalog(uid).roads.find((r) => r.id === roadId);
      if (!road) return;
      ensureRoadStorage(uid, road);
      syncRoadMetaToStorage(uid, road);
      setActiveRoadId(uid, roadId);
      setCatalog(loadRoadsCatalog(uid));
    },
    [uid, browseMode, catalog]
  );

  const clearRoad = useCallback(() => {
    if (!uid || browseMode) {
      setCatalog((prev) => ({ ...prev, activeRoadId: "" }));
      return;
    }
    setActiveRoadId(uid, "");
    setCatalog(loadRoadsCatalog(uid));
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

  const value = {
    ready,
    ownerUid: uid || "",
    roads: catalog.roads,
    activeRoad,
    activeRoadId: catalog.activeRoadId,
    roadSelected: Boolean(catalog.activeRoadId && activeRoad),
    storageKey,
    roadLabel: roadDisplayLabel(activeRoad),
    browseMode,
    catalogLocked,
    selectRoad,
    clearRoad,
    createRoad,
    editRoad,
    deleteRoad,
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
