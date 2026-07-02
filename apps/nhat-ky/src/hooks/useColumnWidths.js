import { useState } from "react";

export const LEFT_COLS = [
  { key: "c1", label: "Cột 1", defaultWidth: 130, min: 70, max: 300 },
  { key: "c2", label: "Cột 2", defaultWidth: 260, min: 110, max: 520 },
  { key: "c3", label: "Cột 3", defaultWidth: 380, min: 180, max: 700 }
];

export const RIGHT_COLS = [
  { key: "c4", label: "Cột 4", defaultWidth: 260, min: 110, max: 520 },
  { key: "c5", label: "Cột 5", defaultWidth: 260, min: 110, max: 520 },
  { key: "c6", label: "Cột 6", defaultWidth: 240, min: 90, max: 480 }
];

export const COLUMN_DEFS = [...LEFT_COLS, ...RIGHT_COLS];

const STORAGE_KEY = "nhatky-col-widths-v7";
const ZOOM_KEY = "nhatky-preview-zoom";

function defaultWidths() {
  return Object.fromEntries(COLUMN_DEFS.map((c) => [c.key, c.defaultWidth]));
}

function loadWidths() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || typeof saved !== "object") return defaultWidths();
    const base = defaultWidths();
    for (const col of COLUMN_DEFS) {
      const v = Number(saved[col.key]);
      if (v >= col.min && v <= col.max) base[col.key] = v;
    }
    return base;
  } catch {
    return defaultWidths();
  }
}

function loadZoom() {
  const v = Number(localStorage.getItem(ZOOM_KEY));
  return v >= 70 && v <= 150 ? v : 100;
}

export function sumCols(cols, widths) {
  return cols.reduce((s, c) => s + widths[c.key], 0);
}

export function useColumnWidths() {
  const [widths, setWidths] = useState(loadWidths);
  const [zoom, setZoom] = useState(loadZoom);
  const [showCols, setShowCols] = useState(false);

  function setWidth(key, value) {
    const col = COLUMN_DEFS.find((c) => c.key === key);
    if (!col) return;
    const n = Math.min(col.max, Math.max(col.min, Number(value) || col.defaultWidth));
    setWidths((prev) => {
      const next = { ...prev, [key]: n };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  function setZoomLevel(value) {
    const n = Math.min(150, Math.max(70, Number(value) || 100));
    setZoom(n);
    localStorage.setItem(ZOOM_KEY, String(n));
  }

  function resetWidths() {
    const next = defaultWidths();
    setWidths(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function startColumnResize(colKey, startX) {
    const col = COLUMN_DEFS.find((c) => c.key === colKey);
    if (!col) return;
    const startWidth = widths[colKey];

    function onMove(e) {
      const n = Math.min(
        col.max,
        Math.max(col.min, Math.round(startWidth + (e.clientX - startX)))
      );
      setWidths((prev) => {
        const next = { ...prev, [colKey]: n };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    }

    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.classList.remove("is-resizing-col");
    }

    document.body.classList.add("is-resizing-col");
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  return {
    widths,
    zoom,
    showCols,
    setShowCols,
    setWidth,
    setZoom: setZoomLevel,
    resetWidths,
    startColumnResize
  };
}
