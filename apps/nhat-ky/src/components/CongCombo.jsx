import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatKmCell } from "../utils/matDuongFormat";
import { formatCongTypeLabel, resolveCongLength } from "../utils/congRegistryStore";

function normalizeKmSearch(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^km\s*/i, "")
    .replace(/[^0-9a-z+]/g, "");
}

function congLabel(c) {
  if (!c) return "";
  const km = c.km ? formatKmCell(c.km) || c.km : "(chưa có lý trình)";
  const type = formatCongTypeLabel(c);
  return type ? `${km} — ${type}` : km;
}

/**
 * Chọn cống từ danh sách — gõ lý trình để lọc nhanh (giống WorkTypeCombo).
 * Panel portal ra body, tự mở lên khi thiếu chỗ dưới.
 */
export default function CongCombo({
  value,
  onChange,
  options,
  placeholder = "Chọn cống…",
  controlClassName = "",
  ariaLabel
}) {
  const list = useMemo(() => (Array.isArray(options) ? options : []), [options]);
  const selected = list.find((c) => c.id === value) || null;
  const currentLabel = congLabel(selected);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [rect, setRect] = useState(null);
  const controlRef = useRef(null);
  const panelRef = useRef(null);
  const inputRef = useRef(null);

  const nq = normalizeKmSearch(query);
  const filtered = useMemo(() => {
    if (!nq) return list;
    return list.filter((c) => {
      const hay = normalizeKmSearch(
        `${c.km || ""} ${formatCongTypeLabel(c)} ${resolveCongLength(c)} ${c.aperture || ""}`
      );
      return hay.includes(nq);
    });
  }, [list, nq]);

  useEffect(() => {
    if (!open) return undefined;
    const updateRect = () => {
      const el = controlRef.current;
      if (el) setRect(el.getBoundingClientRect());
    };
    updateRect();
    const onDown = (e) => {
      if (controlRef.current?.contains(e.target)) return;
      if (panelRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("scroll", updateRect, true);
    window.addEventListener("resize", updateRect);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    const focusId = setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("resize", updateRect);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      clearTimeout(focusId);
    };
  }, [open]);

  function choose(id) {
    onChange(id);
    setQuery("");
    setOpen(false);
  }

  const panelStyle = (() => {
    if (!rect) return null;
    const width = Math.max(rect.width, 260);
    let left = rect.left;
    if (left + width > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - width - 8);
    }
    const gap = 2;
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const openUp = spaceBelow < 220 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(160, Math.min(360, openUp ? spaceAbove : spaceBelow));
    if (openUp) {
      return {
        top: "auto",
        bottom: window.innerHeight - rect.top + gap,
        left,
        width,
        maxHeight
      };
    }
    return {
      top: rect.bottom + gap,
      bottom: "auto",
      left,
      width,
      maxHeight
    };
  })();

  const panel =
    open && panelStyle
      ? createPortal(
          <div ref={panelRef} className="stats-contract-combo-panel" style={panelStyle}>
            <div className="stats-contract-combo-search">
              <input
                ref={inputRef}
                type="text"
                className="stats-contract-combo-search-input"
                placeholder="Gõ lý trình để lọc cống…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="stats-contract-combo-list">
              <button
                type="button"
                className={`stats-contract-combo-item${value ? "" : " is-active"}`}
                onClick={() => choose("")}
              >
                {placeholder}
              </button>
              {filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`stats-contract-combo-item${c.id === value ? " is-active" : ""}`}
                  title={congLabel(c)}
                  onClick={() => choose(c.id)}
                >
                  {congLabel(c)}
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="stats-contract-combo-empty">Không có cống khớp lý trình</div>
              )}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        type="button"
        ref={controlRef}
        className={`stats-contract-combo-control ${controlClassName}`.trim()}
        title={currentLabel || placeholder}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={currentLabel ? "" : "stats-contract-combo-placeholder"}>
          {currentLabel || placeholder}
        </span>
        <span className="stats-contract-combo-caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {panel}
    </>
  );
}
