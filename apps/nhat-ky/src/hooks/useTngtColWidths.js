import { useState } from "react";

/** 14 cột theo mẫu TCVN 14182:2024 — Phụ lục 04. */
export const TNGT_COLS = [
  { key: "tg1", label: "TT", defaultWidth: 26, min: 22, max: 40 },
  { key: "tg2", label: "Vị trí, Lý trình", defaultWidth: 88, min: 64, max: 130 },
  { key: "tg3", label: "Ngày TN", defaultWidth: 62, min: 52, max: 84 },
  { key: "tg4", label: "Ô tô", defaultWidth: 52, min: 40, max: 80 },
  { key: "tg5", label: "Xe máy", defaultWidth: 34, min: 28, max: 48 },
  { key: "tg6", label: "Xe đạp", defaultWidth: 34, min: 28, max: 48 },
  { key: "tg7", label: "Do đường", defaultWidth: 38, min: 30, max: 52 },
  { key: "tg8", label: "Do người", defaultWidth: 38, min: 30, max: 52 },
  { key: "tg9", label: "Do PT", defaultWidth: 38, min: 30, max: 52 },
  { key: "tg10", label: "Chết", defaultWidth: 30, min: 26, max: 44 },
  { key: "tg11", label: "Bị thương", defaultWidth: 38, min: 30, max: 52 },
  { key: "tg12", label: "Cầu đường", defaultWidth: 42, min: 34, max: 60 },
  { key: "tg13", label: "Phương tiện", defaultWidth: 42, min: 34, max: 60 },
  { key: "tg14", label: "Ghi chú", defaultWidth: 100, min: 72, max: 200 }
];

const STORAGE_KEY = "tngt-col-widths-v2";

/** Độ rộng cột form nhập — rộng hơn sổ in để gõ thoải mái, vẫn đúng tỷ lệ 14 cột. */
export const TNGT_ENTRY_WIDTH_SCALE = 1.5;

export function tngtEntryColWidths(scale = TNGT_ENTRY_WIDTH_SCALE) {
  return Object.fromEntries(
    TNGT_COLS.map((c) => [c.key, Math.round(c.defaultWidth * scale)])
  );
}

export function tngtEntryTableMinWidth(scale = TNGT_ENTRY_WIDTH_SCALE) {
  return Object.values(tngtEntryColWidths(scale)).reduce((sum, w) => sum + w, 0);
}

function defaultWidths() {
  return Object.fromEntries(TNGT_COLS.map((c) => [c.key, c.defaultWidth]));
}

function loadWidths() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || typeof saved !== "object") return defaultWidths();
    const base = defaultWidths();
    for (const col of TNGT_COLS) {
      const v = Number(saved[col.key]);
      if (v >= col.min && v <= col.max) base[col.key] = v;
    }
    return base;
  } catch {
    return defaultWidths();
  }
}

export function useTngtColWidths() {
  const [widths, setWidths] = useState(loadWidths);

  function startColumnResize(colKey, startX) {
    const col = TNGT_COLS.find((c) => c.key === colKey);
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
