import { useMemo } from "react";
import { useRoadWorkspace } from "../context/RoadWorkspaceContext";
import {
  blocksForPackedEntries,
  buildRouteDisplayBlocks,
  orderEntriesByRouteSections
} from "../utils/roadsCatalog";

/** Context tách/gộp đường đang xem trên sổ. */
export function useRouteViewCtx() {
  const { catalogRoad, routesViewMode, activeRouteId, titleRouteIds } = useRoadWorkspace();
  return useMemo(
    () => ({
      road: catalogRoad,
      routesViewMode,
      activeRouteId,
      titleRouteIds
    }),
    [catalogRoad, routesViewMode, activeRouteId, titleRouteIds]
  );
}

/** Blocks tiêu đề nhánh + dòng dữ liệu. */
export function useRouteDisplayBlocks(entries, orphanLabel = "Công việc khác") {
  const viewCtx = useRouteViewCtx();
  return useMemo(
    () =>
      buildRouteDisplayBlocks(entries || [], viewCtx.road, viewCtx, {
        orphanLabel
      }),
    [entries, viewCtx, orphanLabel]
  );
}

/** Entries đã xếp theo nhánh (trước pack trang in). */
export function useOrderedEntriesByRoute(entries, orphanLabel = "Công việc khác") {
  const viewCtx = useRouteViewCtx();
  return useMemo(
    () =>
      orderEntriesByRouteSections(entries || [], viewCtx.road, viewCtx, {
        orphanLabel
      }),
    [entries, viewCtx, orphanLabel]
  );
}

export { buildRouteDisplayBlocks, orderEntriesByRouteSections, blocksForPackedEntries };
