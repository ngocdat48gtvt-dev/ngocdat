import { createContext, useCallback, useContext, useMemo, useState } from "react";

const OfficeBrowseContext = createContext(null);

export function OfficeBrowseProvider({ children }) {
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRoadId, setSelectedRoadId] = useState("");
  const [selectedRouteId, setSelectedRouteId] = useState("");

  const pickCompany = useCallback((company) => {
    setSelectedCompany(company || null);
    setSelectedUser(null);
    setSelectedRoadId("");
    setSelectedRouteId("");
  }, []);

  const pickUser = useCallback((user) => {
    setSelectedUser(user || null);
    setSelectedRoadId("");
    setSelectedRouteId("");
  }, []);

  const pickRoad = useCallback((roadId, routeId = "") => {
    setSelectedRoadId(roadId || "");
    setSelectedRouteId(routeId || "");
  }, []);

  const clearRoad = useCallback(() => {
    setSelectedRoadId("");
    setSelectedRouteId("");
  }, []);

  const clearAll = useCallback(() => {
    setSelectedUser(null);
    setSelectedRoadId("");
    setSelectedRouteId("");
  }, []);

  const value = useMemo(
    () => ({
      selectedCompany,
      selectedUser,
      selectedRoadId,
      selectedRouteId,
      browseActive: !!selectedUser && !!selectedRoadId,
      pickCompany,
      pickUser,
      pickRoad,
      clearRoad,
      clearAll
    }),
    [
      selectedCompany,
      selectedUser,
      selectedRoadId,
      selectedRouteId,
      pickCompany,
      pickUser,
      pickRoad,
      clearRoad,
      clearAll
    ]
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
