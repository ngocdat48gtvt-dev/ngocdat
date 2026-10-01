import { useEffect, useRef, useState } from "react";
import { useRoadWorkspace } from "../context/RoadWorkspaceContext";
import RouteLabelLines from "./RouteLabelLines";

/**
 * Chọn đường/nhánh đang nhập — chỉ hiện khi sổ có ≥ 2 đường.
 * Hiển thị 2 dòng: tên đường · Km xuống dòng dưới.
 */
export default function EntryRoutePicker({
  className = "",
  label = "Đường đang nhập",
  value = "",
  onChange
}) {
  const { routes, activeRouteId, selectRoute } = useRoadWorkspace();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

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

  const selected =
    routes.find((r) => String(r.id) === String(value || activeRouteId)) ||
    routes[0] ||
    null;

  return (
    <div className={`entry-route-picker ${className}`.trim()} ref={wrapRef}>
      <span className="entry-route-picker-label">{label} *</span>
      <div className="entry-route-picker-field">
        <button
          type="button"
          className="entry-route-picker-trigger sidebar-input"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={label}
          onClick={() => setOpen((v) => !v)}
        >
          <RouteLabelLines route={selected} />
          <span className="entry-route-picker-chevron" aria-hidden>
            ⌄
          </span>
        </button>
        {open ? (
          <ul className="entry-route-picker-menu" role="listbox">
            {routes.map((r, i) => {
              const active = String(r.id) === String(selected?.id);
              return (
                <li key={r.id || `rt-${i}`} role="option" aria-selected={active}>
                  <button
                    type="button"
                    className={`entry-route-picker-option${active ? " is-active" : ""}`}
                    onClick={() => {
                      if (onChange) onChange(r);
                      else selectRoute(r.id);
                      setOpen(false);
                    }}
                  >
                    <RouteLabelLines route={r} />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
