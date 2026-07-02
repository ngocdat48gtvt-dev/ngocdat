import { useState } from "react";

export const BAO_DUONG_COLS = [
  { key: "bd1", label: "STT", defaultWidth: 38, min: 30, max: 70 },
  { key: "bd2", label: "Công việc thực hiện", defaultWidth: 108, min: 80, max: 240 },
  { key: "bd3", label: "Ghi lý trình, vị trí", defaultWidth: 140, min: 90, max: 300 },
  { key: "bd4", label: "Tóm tắt biện pháp", defaultWidth: 135, min: 90, max: 300 },
  { key: "bd5", label: "Kết quả chủ yếu", defaultWidth: 258, min: 140, max: 420 }
];

const STORAGE_KEY = "baoduong-col-widths-v3";

function defaultWidths() {
  return Object.fromEntries(BAO_DUONG_COLS.map((c) => [c.key, c.defaultWidth]));
}

function loadWidths() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || typeof saved !== "object") return defaultWidths();
    const base = defaultWidths();
    for (const col of BAO_DUONG_COLS) {
      const v = Number(saved[col.key]);
      if (v >= col.min && v <= col.max) base[col.key] = v;
    }
    return base;
  } catch {
    return defaultWidths();
  }
}

export function useBaoDuongColWidths() {
  const [widths, setWidths] = useState(loadWidths);

  function startColumnResize(colKey, startX) {
    const col = BAO_DUONG_COLS.find((c) => c.key === colKey);
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
