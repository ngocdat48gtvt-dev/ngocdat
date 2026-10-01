import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { normalizeWorkType } from "../utils/volumeStatsFormat";
import {
  formatUnitLabel,
  getMaintenanceNameForType,
  getUnitForType
} from "../utils/baoDuongQualityStore";

function unitOf(type) {
  const u = getUnitForType(type);
  return u ? formatUnitLabel(u) : "";
}

function bdtxOf(type) {
  return String(getMaintenanceNameForType(type) || "").trim();
}

/**
 * Ô chọn loại công việc: mở form giữa màn hình (cao, rộng) để dễ tìm.
 * Danh sách: Công việc tuần đường | Công việc BDTX | Đơn vị.
 */
export default function WorkTypeCombo({
  value,
  onChange,
  options,
  placeholder = "Chọn…",
  controlClassName = "",
  ariaLabel,
  /** Hiện đơn vị trong danh sách gợi ý. */
  showUnit = true,
  /** Hiện cột công việc BDTX trong danh sách. */
  showBdtx = true,
  /** Hiện đơn vị trên ô đã chọn — tắt khi form đã có cột Đơn vị riêng. */
  showUnitInControl = false
}) {
  const current = String(value || "").trim();
  const currentUnit = showUnitInControl ? unitOf(current) : "";
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const controlRef = useRef(null);
  const panelRef = useRef(null);
  const inputRef = useRef(null);

  const list = useMemo(() => (Array.isArray(options) ? options : []), [options]);
  const hasCurrent = !current || list.includes(current);
  const nq = normalizeWorkType(query);
  const filtered = useMemo(() => {
    if (!nq) return list;
    return list.filter((t) => {
      const td = normalizeWorkType(t);
      const bd = normalizeWorkType(bdtxOf(t));
      return td.includes(nq) || (bd && bd.includes(nq));
    });
  }, [list, nq]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (controlRef.current?.contains(e.target)) return;
      if (panelRef.current?.contains(e.target)) return;
      setOpen(false);
      setQuery("");
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    const focusId = setTimeout(() => inputRef.current?.focus(), 0);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      clearTimeout(focusId);
    };
  }, [open]);

  function choose(val) {
    onChange(val);
    setQuery("");
    setOpen(false);
  }

  function close() {
    setOpen(false);
    setQuery("");
  }

  const showCols = showBdtx || showUnit;

  const panel = open
    ? createPortal(
        <div className="stats-contract-combo-overlay" role="presentation">
          <div
            ref={panelRef}
            className={`stats-contract-combo-panel stats-contract-combo-panel--center${showBdtx ? " stats-contract-combo-panel--bdtx" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel || "Chọn loại công việc"}
          >
            <div className="stats-contract-combo-dialog-head">
              <strong>Chọn loại công việc</strong>
              <button
                type="button"
                className="stats-contract-combo-dialog-close"
                onClick={close}
                title="Đóng"
                aria-label="Đóng"
              >
                ×
              </button>
            </div>
            <div className="stats-contract-combo-search">
              <input
                ref={inputRef}
                type="text"
                className="stats-contract-combo-search-input"
                placeholder="Gõ để tìm tuần đường / BDTX…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            {showCols && (
              <div
                className={`stats-contract-combo-head${showBdtx ? " has-bdtx" : ""}${showUnit ? " has-unit" : ""}`}
                aria-hidden="true"
              >
                <span>Công việc tuần đường</span>
                {showBdtx ? <span>Công việc BDTX</span> : null}
                {showUnit ? <span>Đơn vị</span> : null}
              </div>
            )}
            <div className="stats-contract-combo-list">
              <button
                type="button"
                className={`stats-contract-combo-item${current ? "" : " is-active"}`}
                onClick={() => choose("")}
              >
                <span className="stats-contract-combo-item-main">{placeholder}</span>
              </button>
              {!hasCurrent && current && (
                <button
                  type="button"
                  className={`stats-contract-combo-item is-active${showBdtx ? " has-bdtx" : ""}${showUnit ? " has-unit" : ""}`}
                  onClick={() => choose(current)}
                >
                  <span className="stats-contract-combo-item-main">{current}</span>
                  {showBdtx ? (
                    <span className="stats-contract-combo-item-bdtx">
                      <span className="stats-contract-combo-tag"> (tự nhập)</span>
                    </span>
                  ) : (
                    <span className="stats-contract-combo-tag"> (tự nhập)</span>
                  )}
                  {showUnit ? <span className="stats-contract-combo-item-unit" /> : null}
                </button>
              )}
              {filtered.map((t) => {
                const u = showUnit ? unitOf(t) : "";
                const bd = showBdtx ? bdtxOf(t) : "";
                const tip = [t, bd && `BDTX: ${bd}`, u].filter(Boolean).join(" · ");
                return (
                  <button
                    key={t}
                    type="button"
                    className={`stats-contract-combo-item${t === current ? " is-active" : ""}${showBdtx ? " has-bdtx" : ""}${showUnit ? " has-unit" : ""}`}
                    title={tip}
                    onClick={() => choose(t)}
                  >
                    <span className="stats-contract-combo-item-main">{t}</span>
                    {showBdtx ? (
                      <span className="stats-contract-combo-item-bdtx">{bd || ""}</span>
                    ) : null}
                    {showUnit ? (
                      <span className="stats-contract-combo-item-unit">{u}</span>
                    ) : null}
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <div className="stats-contract-combo-empty">Không có kết quả</div>
              )}
            </div>
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
        title={
          current
            ? currentUnit
              ? `${current} (${currentUnit})`
              : current
            : placeholder
        }
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={current ? "" : "stats-contract-combo-placeholder"}>
          {current || placeholder}
          {current && currentUnit ? (
            <span className="stats-contract-combo-unit"> · {currentUnit}</span>
          ) : null}
        </span>
        <span className="stats-contract-combo-caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {panel}
    </>
  );
}
