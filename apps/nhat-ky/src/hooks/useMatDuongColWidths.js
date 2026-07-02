import { useState } from "react";

export const MAT_DUONG_COLS = [
  { key: "md1", label: "Cột 1", defaultWidth: 78, min: 50, max: 140 },
  { key: "md2", label: "Cột 2", defaultWidth: 92, min: 60, max: 160 },
  { key: "md3", label: "Cột 3", defaultWidth: 92, min: 60, max: 160 },
  { key: "md4", label: "Cột 4", defaultWidth: 44, min: 32, max: 80 },
  { key: "md5", label: "Cột 5", defaultWidth: 52, min: 40, max: 100 },
  { key: "md6", label: "Cột 6", defaultWidth: 52, min: 40, max: 100 },
  { key: "md7", label: "Cột 7", defaultWidth: 62, min: 44, max: 110 },
  { key: "md8", label: "Cột 8", defaultWidth: 200, min: 100, max: 420 },
  { key: "md9", label: "Cột 9", defaultWidth: 38, min: 32, max: 70 },
  { key: "md10", label: "Cột 10", defaultWidth: 42, min: 32, max: 70 },
  { key: "md11", label: "Cột 11", defaultWidth: 88, min: 60, max: 160 },
  { key: "md12", label: "Cột 12", defaultWidth: 150, min: 80, max: 320 }
];

/** Độ rộng riêng cho form nhập — rộng hơn sổ in. */
export const MAT_DUONG_ENTRY_COLS = [
  { key: "md1", defaultWidth: 82 },
  { key: "md2", defaultWidth: 90 },
  { key: "md3", defaultWidth: 90 },
  { key: "md4", defaultWidth: 54 },
  { key: "md5", defaultWidth: 58 },
  { key: "md6", defaultWidth: 58 },
  { key: "md7", defaultWidth: 66 },
  { key: "md8", defaultWidth: 230 },
  { key: "md9", defaultWidth: 50 },
  { key: "md10", defaultWidth: 54 },
  { key: "md11", defaultWidth: 104 },
  { key: "md12", defaultWidth: 180 }
];

export function matDuongEntryColWidths() {
  return Object.fromEntries(
    MAT_DUONG_ENTRY_COLS.map((c) => [c.key, c.defaultWidth])
  );
}

export function matDuongEntryTableMinWidth() {
  return Object.values(matDuongEntryColWidths()).reduce((sum, w) => sum + w, 0);
}

const STORAGE_KEY = "matduong-col-widths-v1";

function defaultWidths() {
  return Object.fromEntries(MAT_DUONG_COLS.map((c) => [c.key, c.defaultWidth]));
}

function loadWidths() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || typeof saved !== "object") return defaultWidths();
    const base = defaultWidths();
    for (const col of MAT_DUONG_COLS) {
      const v = Number(saved[col.key]);
      if (v >= col.min && v <= col.max) base[col.key] = v;
    }
    return base;
  } catch {
    return defaultWidths();
  }
}

export function sumMatDuongCols(widths) {
  return MAT_DUONG_COLS.reduce((s, c) => s + widths[c.key], 0);
}

export function useMatDuongColWidths() {
  const [widths, setWidths] = useState(loadWidths);

  function startColumnResize(colKey, startX) {
    const col = MAT_DUONG_COLS.find((c) => c.key === colKey);
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

  return { widths, startColumnResize };
}
