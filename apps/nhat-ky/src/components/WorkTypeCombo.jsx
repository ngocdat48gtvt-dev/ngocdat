import { useEffect, useMemo, useRef, useState } from "react";
import { normalizeWorkType } from "../utils/volumeStatsFormat";

/**
 * Ô chọn loại công việc có tìm kiếm: gõ để lọc (không phân biệt dấu) kết hợp
 * cuộn chuột chọn như cũ. Panel dùng position: fixed nên không bị cắt trong
 * vùng cuộn của bảng. Dùng chung cho mọi form nhập liệu.
 */
export default function WorkTypeCombo({
  value,
  onChange,
  options,
  placeholder = "— Chọn —",
  controlClassName = "",
  ariaLabel
}) {
  const current = String(value || "").trim();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [rect, setRect] = useState(null);
  const controlRef = useRef(null);
  const panelRef = useRef(null);
  const inputRef = useRef(null);

  const list = useMemo(() => (Array.isArray(options) ? options : []), [options]);
  const hasCurrent = !current || list.includes(current);
  const nq = normalizeWorkType(query);
  const filtered = useMemo(
    () => (nq ? list.filter((t) => normalizeWorkType(t).includes(nq)) : list),
    [list, nq]
  );

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

  function choose(val) {
    onChange(val);
    setQuery("");
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        ref={controlRef}
        className={`stats-contract-combo-control ${controlClassName}`.trim()}
        title={current || placeholder}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={current ? "" : "stats-contract-combo-placeholder"}>
          {current || placeholder}
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
            width: Math.max(rect.width, 240)
          }}
        >
          <div className="stats-contract-combo-search">
            <input
              ref={inputRef}
              type="text"
              className="stats-contract-combo-search-input"
              placeholder="Gõ để tìm công việc…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="stats-contract-combo-list">
            <button
              type="button"
              className={`stats-contract-combo-item${current ? "" : " is-active"}`}
              onClick={() => choose("")}
            >
              {placeholder}
            </button>
            {!hasCurrent && current && (
              <button
                type="button"
                className="stats-contract-combo-item is-active"
                onClick={() => choose(current)}
              >
                {current}
                <span className="stats-contract-combo-tag"> (tự nhập)</span>
              </button>
            )}
            {filtered.map((t) => (
              <button
                key={t}
                type="button"
                className={`stats-contract-combo-item${t === current ? " is-active" : ""}`}
                title={t}
                onClick={() => choose(t)}
              >
                {t}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="stats-contract-combo-empty">Không có kết quả</div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
