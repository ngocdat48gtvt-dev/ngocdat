import { useState } from "react";

/** Cột bảng App hiện trường — bề rộng mặc định tối ưu màn hình máy tính. */
export const HIEN_TRUONG_DISPATCH_COLS = [
  { key: "check", defaultWidth: 40, min: 36, max: 56, fixed: true },
  { key: "road", defaultWidth: 64, min: 48, max: 140 },
  { key: "km", defaultWidth: 92, min: 72, max: 140 },
  { key: "side", defaultWidth: 56, min: 44, max: 100 },
  { key: "type", defaultWidth: 152, min: 80, max: 320 },
  { key: "dai", defaultWidth: 50, min: 40, max: 90 },
  { key: "rong", defaultWidth: 50, min: 40, max: 90 },
  { key: "cao", defaultWidth: 50, min: 40, max: 90 },
  { key: "unit", defaultWidth: 44, min: 36, max: 72 },
  { key: "volDat", defaultWidth: 68, min: 52, max: 110 },
  { key: "volDa", defaultWidth: 68, min: 52, max: 110 },
  { key: "vol", defaultWidth: 76, min: 56, max: 120 },
  { key: "note", defaultWidth: 140, min: 72, max: 360 },
  { key: "progress", defaultWidth: 112, min: 88, max: 180 },
  { key: "date", defaultWidth: 92, min: 76, max: 130 },
  { key: "completedDate", defaultWidth: 92, min: 76, max: 130 },
  { key: "section", defaultWidth: 108, min: 72, max: 200 },
  { key: "imported", defaultWidth: 92, min: 72, max: 140 },
  { key: "actions", defaultWidth: 108, min: 96, max: 150, fixed: true }
];

const STORAGE_KEY = "hientruong-dispatch-col-widths-v1";

function defaultWidths() {
  return Object.fromEntries(HIEN_TRUONG_DISPATCH_COLS.map((c) => [c.key, c.defaultWidth]));
}

function loadWidths() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || typeof saved !== "object") return defaultWidths();
    const base = defaultWidths();
    for (const col of HIEN_TRUONG_DISPATCH_COLS) {
      const v = Number(saved[col.key]);
      if (v >= col.min && v <= col.max) base[col.key] = v;
    }
    return base;
  } catch {
    return defaultWidths();
  }
}

export function useHienTruongDispatchColWidths() {
  const [widths, setWidths] = useState(loadWidths);

  function startColumnResize(colKey, startX) {
    const col = HIEN_TRUONG_DISPATCH_COLS.find((c) => c.key === colKey);
    if (!col || col.fixed) return;
    const startWidth = widths[colKey];

    function onMove(e) {
      const n = Math.min(col.max, Math.max(col.min, Math.round(startWidth + (e.clientX - startX))));
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

  const tableWidth = HIEN_TRUONG_DISPATCH_COLS.reduce((sum, c) => sum + (widths[c.key] ?? c.defaultWidth), 0);

  return { widths, tableWidth, startColumnResize };
}
