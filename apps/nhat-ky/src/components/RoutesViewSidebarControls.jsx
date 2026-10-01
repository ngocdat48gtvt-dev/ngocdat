import { useEffect, useMemo, useRef, useState } from "react";
import { useRoadWorkspace } from "../context/RoadWorkspaceContext";
import RouteLabelLines from "./RouteLabelLines";

function selectedIdsFromView(routes, routesViewMode, activeRouteId, titleRouteIds) {
  if (!Array.isArray(routes) || !routes.length) return [];
  if (routesViewMode === "split") {
    const id = String(activeRouteId || routes[0]?.id || "");
    return id ? [id] : [];
  }
  const fromTitle = (titleRouteIds || []).map(String).filter(Boolean);
  if (fromTitle.length) return fromTitle;
  return routes.map((r) => String(r.id));
}

function summaryLabel(routes, selectedIds) {
  const n = selectedIds.length;
  const total = routes.length;
  if (n <= 0) return "Chọn đường";
  if (n === total) return `Tất cả (${total} đường)`;
  if (n === 1) {
    const r = routes.find((x) => String(x.id) === String(selectedIds[0]));
    const name = String(r?.roadName || "").trim();
    return name || "1 đường";
  }
  return `${n}/${total} đường`;
}

/**
 * Nút «Chọn đường» gọn — bấm mở danh sách, chọn 1 / vài / tất cả, xong thì ẩn.
 * 1 đường → tách; ≥2 đường → gộp. Dùng chung mọi sổ có tách/gộp.
 */
export default function RoutesViewSidebarControls() {
  const {
    routes,
    routesViewMode,
    activeRouteId,
    titleRouteIds,
    setTitleRouteIds
  } = useRoadWorkspace();

  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const selectedIds = useMemo(
    () => selectedIdsFromView(routes, routesViewMode, activeRouteId, titleRouteIds),
    [routes, routesViewMode, activeRouteId, titleRouteIds]
  );

  const [draftIds, setDraftIds] = useState(selectedIds);

  useEffect(() => {
    if (open) setDraftIds(selectedIds);
  }, [open, selectedIds]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!Array.isArray(routes) || routes.length <= 1) return null;

  const allIds = routes.map((r) => String(r.id));
  const draftSet = new Set(draftIds.map(String));
  const allChecked = allIds.length > 0 && allIds.every((id) => draftSet.has(id));
  const label = summaryLabel(routes, selectedIds);

  function applyIds(ids) {
    const next = ids.map(String).filter((id) => allIds.includes(id));
    setTitleRouteIds(next.length ? next : [allIds[0]]);
  }

  function toggleOne(id) {
    const key = String(id);
    setDraftIds((prev) => {
      const set = new Set(prev.map(String));
      if (set.has(key)) {
        if (set.size <= 1) return prev;
        set.delete(key);
      } else {
        set.add(key);
      }
      return allIds.filter((x) => set.has(x));
    });
  }

  function toggleAll() {
    setDraftIds(allChecked ? [String(selectedIds[0] || allIds[0])] : [...allIds]);
  }

  function confirmAndClose() {
    applyIds(draftIds);
    setOpen(false);
  }

  return (
    <div className="routes-pick" ref={wrapRef}>
      <button
        type="button"
        className={`routes-pick-trigger${open ? " is-open" : ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Chọn đường"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="routes-pick-trigger-kicker">Chọn đường</span>
        <span className="routes-pick-trigger-value">{label}</span>
        <span className="routes-pick-trigger-chevron" aria-hidden>
          {open ? "▴" : "▾"}
        </span>
      </button>

      {open ? (
        <div className="routes-pick-panel" role="dialog" aria-label="Chọn đường trên sổ">
          <div className="routes-pick-panel-head">
            <button
              type="button"
              className="routes-pick-all"
              onClick={toggleAll}
            >
              {allChecked ? "Bỏ chọn tất" : "Chọn tất cả"}
            </button>
            <span className="routes-pick-count">
              {draftIds.length}/{routes.length}
            </span>
          </div>

          <ul className="routes-pick-list">
            {routes.map((route) => {
              const id = String(route.id);
              const checked = draftSet.has(id);
              return (
                <li key={route.id}>
                  <label className={`routes-pick-item${checked ? " is-checked" : ""}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleOne(id)}
                    />
                    <RouteLabelLines route={route} />
                  </label>
                </li>
              );
            })}
          </ul>

          <div className="routes-pick-actions">
            <button
              type="button"
              className="btn-secondary btn-secondary--compact"
              onClick={() => setOpen(false)}
            >
              Hủy
            </button>
            <button
              type="button"
              className="btn-primary btn-primary--compact"
              onClick={confirmAndClose}
            >
              Xong
            </button>
          </div>
          <p className="routes-pick-hint">
            1 đường = xem tách · ≥2 đường = gộp trên sổ
          </p>
        </div>
      ) : null}
    </div>
  );
}
