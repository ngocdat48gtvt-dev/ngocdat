import { createContext, useCallback, useContext, useMemo, useState } from "react";

const OfficeBrowseContext = createContext(null);

export function OfficeBrowseProvider({ children }) {
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRoadId, setSelectedRoadId] = useState("");

  const pickUser = useCallback((user) => {
    setSelectedUser(user || null);
    setSelectedRoadId("");
  }, []);

  const pickRoad = useCallback((roadId) => {
    setSelectedRoadId(roadId || "");
  }, []);

  const clearRoad = useCallback(() => {
    setSelectedRoadId("");
  }, []);

  const clearAll = useCallback(() => {
    setSelectedUser(null);
    setSelectedRoadId("");
  }, []);

  const value = useMemo(
    () => ({
      selectedUser,
      selectedRoadId,
      browseActive: !!selectedUser && !!selectedRoadId,
      pickUser,
      pickRoad,
      clearRoad,
      clearAll
    }),
    [selectedUser, selectedRoadId, pickUser, pickRoad, clearRoad, clearAll]
  );

  return (
    <OfficeBrowseContext.Provider value={value}>{children}</OfficeBrowseContext.Provider>
  );
}

export function useOfficeBrowse() {
  const ctx = useContext(OfficeBrowseContext);
  if (!ctx) {
    throw new Error("useOfficeBrowse phải dùng trong OfficeBrowseProvider");
  }
  return ctx;
}
