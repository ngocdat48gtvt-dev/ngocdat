import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  VI_MONTHS,
  VI_WEEKDAYS,
  calendarCells,
  compareIso,
  currentYearMonth,
  displayToIso,
  isoToDisplay,
  isoToParts,
  partsToIso,
  todayIso
} from "../utils/dateLocale";

function clampView(iso, min, max) {
  const p = isoToParts(iso) || isoToParts(todayIso());
  return { y: p.y, m: p.m };
}

function CalendarIcon() {
  return (
    <svg
      className="vi-date-trigger-icon"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

const POPOVER_WIDTH = 280;
const POPOVER_WIDTH_MONTH = 260;

function useFloatingPopoverStyle(anchorRef, popoverRef, open, width, deps = []) {
  const [style, setStyle] = useState(null);

  useLayoutEffect(() => {
    if (!open) {
      setStyle(null);
      return;
    }

    function update() {
      const anchor = anchorRef.current;
      const pop = popoverRef.current;
      if (!anchor || !pop) return;

      const rect = anchor.getBoundingClientRect();
      const height = pop.offsetHeight || 320;

      let top = rect.bottom + 4;
      let left = rect.left;

      if (left + width > window.innerWidth - 8) {
        left = Math.max(8, rect.right - width);
      }
      if (left < 8) left = 8;

      if (top + height > window.innerHeight - 8) {
        const above = rect.top - height - 4;
        if (above >= 8) top = above;
      }

      setStyle({
        position: "fixed",
        top: `${top}px`,
        left: `${left}px`,
        width: `${width}px`,
        zIndex: 9999,
        visibility: "visible",
        pointerEvents: "auto"
      });
    }

    update();
    const raf = requestAnimationFrame(update);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);

    let ro;
    if (typeof ResizeObserver !== "undefined" && popoverRef.current) {
      ro = new ResizeObserver(update);
      ro.observe(popoverRef.current);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      ro?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, width, anchorRef, popoverRef, ...deps]);

  return style;
}

function DatePopoverPortal({ popoverRef, open, style, className, id, label, children, width }) {
  if (!open) return null;

  const mergedStyle = style
    ? style
    : {
        position: "fixed",
        top: 0,
        left: 0,
        width: `${width}px`,
        visibility: "hidden",
        pointerEvents: "none",
        zIndex: 9999
      };

  return createPortal(
    <div
      ref={popoverRef}
      className={className}
      id={id}
      role="dialog"
      aria-label={label}
      style={mergedStyle}
    >
      {children}
    </div>,
    document.body
  );
}

export default function ViDateInput({
  value = "",
  onChange,
  min,
  max,
  className = "sidebar-input sidebar-input--date",
  disabled = false,
  placeholder = "dd/mm/yyyy",
  hideCalendarButton = false,
  "aria-label": ariaLabel = "Chọn ngày"
}) {
  const listId = useId();
  const rootRef = useRef(null);
  const popoverRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(() => isoToDisplay(value));
  const [view, setView] = useState(() => clampView(value, min, max));

  useEffect(() => {
    setText(isoToDisplay(value));
    if (value) setView(clampView(value, min, max));
  }, [value]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e) {
      if (rootRef.current?.contains(e.target)) return;
      if (popoverRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const popoverStyle = useFloatingPopoverStyle(
    rootRef,
    popoverRef,
    open,
    POPOVER_WIDTH,
    [view.y, view.m, value]
  );

  function isDisabledDay(y, m, d) {
    const iso = partsToIso(y, m, d);
    if (min && compareIso(iso, min) < 0) return true;
    if (max && compareIso(iso, max) > 0) return true;
    return false;
  }

  function pickDay(d) {
    if (!d || isDisabledDay(view.y, view.m, d)) return;
    const iso = partsToIso(view.y, view.m, d);
    setText(isoToDisplay(iso));
    onChange?.(iso);
    setOpen(false);
  }

  function commitText(raw) {
    const iso = displayToIso(raw);
    if (!iso) {
      setText(isoToDisplay(value));
      return;
    }
    if (min && compareIso(iso, min) < 0) {
      setText(isoToDisplay(value));
      return;
    }
    if (max && compareIso(iso, max) > 0) {
      setText(isoToDisplay(value));
      return;
    }
    setText(isoToDisplay(iso));
    onChange?.(iso);
    setView(clampView(iso, min, max));
  }

  function shiftMonth(delta) {
    setView((prev) => {
      let m = prev.m + delta;
      let y = prev.y;
      while (m < 1) {
        m += 12;
        y -= 1;
      }
      while (m > 12) {
        m -= 12;
        y += 1;
      }
      return { y, m };
    });
  }

  const cells = calendarCells(view.y, view.m);
  const selected = isoToParts(value);

  return (
    <div className={`vi-date-wrap${hideCalendarButton ? " vi-date-wrap--no-trigger" : ""}`} ref={rootRef}>
      <input
        type="text"
        inputMode="numeric"
        className={className}
        value={text}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listId}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commitText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commitText(e.target.value);
            setOpen(false);
          }
        }}
        onFocus={() => setOpen(true)}
        onClick={() => !disabled && setOpen(true)}
      />
      {!hideCalendarButton ? (
        <button
          type="button"
          className="vi-date-trigger"
          disabled={disabled}
          aria-label="Mở lịch"
          onClick={() => setOpen((o) => !o)}
        >
          <CalendarIcon />
        </button>
      ) : null}
      {open && !disabled && (
        <DatePopoverPortal
          popoverRef={popoverRef}
          open={open}
          width={POPOVER_WIDTH}
          style={popoverStyle}
          className="vi-date-popover vi-date-popover--floating"
          id={listId}
          label="Lịch chọn ngày"
        >
          <div className="vi-date-popover-head">
            <button type="button" className="vi-date-nav" onClick={() => shiftMonth(-1)} aria-label="Tháng trước">
              ◀
            </button>
            <span className="vi-date-popover-title">
              {VI_MONTHS[view.m - 1]} {view.y}
            </span>
            <button type="button" className="vi-date-nav" onClick={() => shiftMonth(1)} aria-label="Tháng sau">
              ▶
            </button>
          </div>
          <div className="vi-date-weekdays">
            {VI_WEEKDAYS.map((w) => (
              <span key={w} className="vi-date-weekday">
                {w}
              </span>
            ))}
          </div>
          <div className="vi-date-grid">
            {cells.map((d, i) => {
              const isSel =
                selected && d === selected.d && view.m === selected.m && view.y === selected.y;
              const off = d && isDisabledDay(view.y, view.m, d);
              return (
                <button
                  key={i}
                  type="button"
                  className={`vi-date-day${!d ? " vi-date-day--empty" : ""}${isSel ? " vi-date-day--selected" : ""}${off ? " vi-date-day--disabled" : ""}`}
                  disabled={!d || off}
                  onClick={() => pickDay(d)}
                >
                  {d || ""}
                </button>
              );
            })}
          </div>
          <div className="vi-date-popover-actions">
            <button
              type="button"
              className="vi-date-action"
              onClick={() => {
                setText("");
                onChange?.("");
                setOpen(false);
              }}
            >
              Xóa
            </button>
            <button
              type="button"
              className="vi-date-action vi-date-action--primary"
              onClick={() => {
                const iso = todayIso();
                if (min && compareIso(iso, min) < 0) return;
                if (max && compareIso(iso, max) > 0) return;
                setText(isoToDisplay(iso));
                onChange?.(iso);
                setView(clampView(iso, min, max));
                setOpen(false);
              }}
            >
              Hôm nay
            </button>
          </div>
        </DatePopoverPortal>
      )}
    </div>
  );
}

export function ViMonthInput({
  value = "",
  onChange,
  className = "sidebar-input sidebar-input--date",
  disabled = false,
  "aria-label": ariaLabel = "Chọn tháng"
}) {
  const rootRef = useRef(null);
  const popoverRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [y, setY] = useState(() => {
    if (value && /^\d{4}-\d{2}$/.test(value)) return Number(value.split("-")[0]);
    return new Date().getFullYear();
  });

  useEffect(() => {
    if (value && /^\d{4}-\d{2}$/.test(value)) setY(Number(value.split("-")[0]));
  }, [value]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e) {
      if (rootRef.current?.contains(e.target)) return;
      if (popoverRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const popoverStyle = useFloatingPopoverStyle(
    rootRef,
    popoverRef,
    open,
    POPOVER_WIDTH_MONTH,
    [y, value]
  );

  const selectedY = value && /^\d{4}-\d{2}$/.test(value) ? Number(value.split("-")[0]) : y;
  const selectedM = value && /^\d{4}-\d{2}$/.test(value) ? Number(value.split("-")[1]) : 0;
  const displayValue = value ? `${VI_MONTHS[selectedM - 1]}/${selectedY}` : "";

  return (
    <div className="vi-date-wrap" ref={rootRef}>
      <input
        type="text"
        readOnly
        className={className}
        value={displayValue}
        placeholder="Chọn tháng"
        disabled={disabled}
        aria-label={ariaLabel}
        onClick={() => !disabled && setOpen((o) => !o)}
      />
      <button
        type="button"
        className="vi-date-trigger"
        disabled={disabled}
        aria-label="Mở lịch tháng"
        onClick={() => setOpen((o) => !o)}
      >
        <CalendarIcon />
      </button>
      {open && !disabled && (
        <DatePopoverPortal
          popoverRef={popoverRef}
          open={open}
          width={POPOVER_WIDTH_MONTH}
          style={popoverStyle}
          className="vi-date-popover vi-date-popover--month vi-date-popover--floating"
          label="Chọn tháng"
        >
          <div className="vi-date-popover-head">
            <button type="button" className="vi-date-nav" onClick={() => setY((v) => v - 1)}>
              ◀
            </button>
            <span className="vi-date-popover-title">Năm {y}</span>
            <button type="button" className="vi-date-nav" onClick={() => setY((v) => v + 1)}>
              ▶
            </button>
          </div>
          <div className="vi-month-grid">
            {VI_MONTHS.map((label, idx) => {
              const m = idx + 1;
              const ym = `${y}-${String(m).padStart(2, "0")}`;
              const isSel = value === ym;
              return (
                <button
                  key={label}
                  type="button"
                  className={`vi-month-cell${isSel ? " vi-month-cell--selected" : ""}`}
                  onClick={() => {
                    onChange?.(ym);
                    setOpen(false);
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div className="vi-date-popover-actions">
            <button
              type="button"
              className="vi-date-action vi-date-action--primary"
              onClick={() => {
                onChange?.(currentYearMonth());
                setY(new Date().getFullYear());
                setOpen(false);
              }}
            >
              Tháng này
            </button>
          </div>
        </DatePopoverPortal>
      )}
    </div>
  );
}
