import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  addRoad,
  ensureRoadStorage,
  findRoad,
  getRoadStorageKey,
  loadRoadsCatalog,
  removeRoad,
  roadDisplayLabel,
  setActiveRoadId,
  syncRoadMetaToStorage,
  updateRoad
} from "../utils/roadsCatalog";

const RoadWorkspaceContext = createContext(null);

export function RoadWorkspaceProvider({ uid, children }) {
  const [catalog, setCatalog] = useState({ activeRoadId: "", roads: [] });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!uid) {
      setCatalog({ activeRoadId: "", roads: [] });
      setReady(true);
      return;
    }
    setCatalog(loadRoadsCatalog(uid));
    setReady(true);
  }, [uid]);

  const activeRoad = useMemo(
    () => catalog.roads.find((r) => r.id === catalog.activeRoadId) || null,
    [catalog]
  );

  const storageKey = useMemo(() => {
    if (!uid || !catalog.activeRoadId) return null;
    return getRoadStorageKey(uid, catalog.activeRoadId);
  }, [uid, catalog.activeRoadId]);

  const refresh = useCallback(() => {
    if (!uid) return;
    setCatalog(loadRoadsCatalog(uid));
  }, [uid]);

  const selectRoad = useCallback(
    (roadId) => {
      if (!uid || !roadId) return;
      const road = findRoad(uid, roadId);
      if (!road) return;
      ensureRoadStorage(uid, road);
      syncRoadMetaToStorage(uid, road);
      setActiveRoadId(uid, roadId);
      setCatalog(loadRoadsCatalog(uid));
    },
    [uid]
  );

  const clearRoad = useCallback(() => {
    if (!uid) return;
    setActiveRoadId(uid, "");
    setCatalog(loadRoadsCatalog(uid));
  }, [uid]);

  const createRoad = useCallback(
    (partial) => {
      if (!uid) return null;
      const road = addRoad(uid, partial);
      refresh();
      return road;
    },
    [uid, refresh]
  );

  const editRoad = useCallback(
    (roadId, patch) => {
      if (!uid) return null;
      const road = updateRoad(uid, roadId, patch);
      refresh();
      return road;
    },
    [uid, refresh]
  );

  const deleteRoad = useCallback(
    (roadId) => {
      if (!uid) return;
      removeRoad(uid, roadId);
      refresh();
    },
    [uid, refresh]
  );

  const value = {
    ready,
    roads: catalog.roads,
    activeRoad,
    activeRoadId: catalog.activeRoadId,
    roadSelected: Boolean(catalog.activeRoadId && activeRoad),
    storageKey,
    roadLabel: roadDisplayLabel(activeRoad),
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
