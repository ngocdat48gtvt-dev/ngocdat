import { useEffect, useMemo, useRef, useState } from "react";
import { formatKmCell } from "../utils/matDuongFormat";

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
  return c.type ? `${km} — ${c.type}` : km;
}

/**
 * Chọn cống từ danh sách — gõ lý trình để lọc nhanh (giống WorkTypeCombo).
 */
export default function CongCombo({
  value,
  onChange,
  options,
  placeholder = "— Chọn cống —",
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
      const hay = normalizeKmSearch(`${c.km || ""} ${c.type || ""} ${c.length || ""}`);
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

      {open && rect && (
        <div
          ref={panelRef}
          className="stats-contract-combo-panel"
          style={{
            top: rect.bottom + 2,
            left: rect.left,
            width: Math.max(rect.width, 260)
          }}
        >
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
        </div>
      )}
    </>
  );
}
