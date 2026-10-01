import { routeKmLabel, routeNameLabel } from "../utils/roadsCatalog";

/** Tên đường (dòng 1) + Km (dòng 2) — dùng mọi chỗ chọn/hiện nhánh. */
export default function RouteLabelLines({ route, fallback = "Đường", className = "" }) {
  const name = routeNameLabel(route) || fallback;
  const km = routeKmLabel(route);
  return (
    <span className={`route-label-lines ${className}`.trim()}>
      <span className="route-label-lines-name">{name}</span>
      {km ? <span className="route-label-lines-km">{km}</span> : null}
    </span>
  );
}
