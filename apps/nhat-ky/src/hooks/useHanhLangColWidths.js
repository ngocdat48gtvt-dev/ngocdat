import { useState } from "react";

/** 10 cột — Phụ lục 05 QL37. */
export const HANH_LANG_COLS = [
  { key: "hl1", label: "TT", defaultWidth: 26, min: 22, max: 40 },
  { key: "hl2", label: "Người lập BB", defaultWidth: 82, min: 64, max: 140 },
  { key: "hl3", label: "Vi phạm", defaultWidth: 96, min: 72, max: 150 },
  { key: "hl4", label: "Địa chỉ", defaultWidth: 96, min: 72, max: 160 },
  { key: "hl5", label: "Lý trình", defaultWidth: 68, min: 56, max: 120 },
  { key: "hl6", label: "Ngày lập BB", defaultWidth: 68, min: 56, max: 90 },
  { key: "hl7", label: "Nội dung", defaultWidth: 175, min: 120, max: 280 },
  { key: "hl8", label: "Diện tích", defaultWidth: 78, min: 56, max: 120 },
  { key: "hl9", label: "Theo dõi xử lý", defaultWidth: 165, min: 110, max: 220 },
  { key: "hl10", label: "Ghi chú", defaultWidth: 82, min: 64, max: 140 }
];

export const HANH_LANG_ENTRY_WIDTH_SCALE = 1.65;

/** Độ rộng riêng cho form nhập — rộng hơn sổ in để tránh chữ tràn cột. */
export const HANH_LANG_ENTRY_COLS = [
  { key: "hl1", defaultWidth: 32 },
  { key: "hl2", defaultWidth: 100 },
  { key: "hl3", defaultWidth: 118 },
  { key: "hl4", defaultWidth: 118 },
  { key: "hl5", defaultWidth: 88 },
  { key: "hl6", defaultWidth: 82 },
  { key: "hl7", defaultWidth: 210 },
  { key: "hl8", defaultWidth: 88 },
  { key: "hl9", defaultWidth: 200 },
  { key: "hl10", defaultWidth: 100 }
];

const STORAGE_KEY = "hanh-lang-col-widths-v1";

function defaultWidths() {
  return Object.fromEntries(HANH_LANG_COLS.map((c) => [c.key, c.defaultWidth]));
}

function loadWidths() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || typeof saved !== "object") return defaultWidths();
    const base = defaultWidths();
    for (const col of HANH_LANG_COLS) {
      const v = Number(saved[col.key]);
      if (v >= col.min && v <= col.max) base[col.key] = v;
    }
    return base;
  } catch {
    return defaultWidths();
  }
}

export function hanhLangEntryColWidths() {
  return Object.fromEntries(
    HANH_LANG_ENTRY_COLS.map((c) => [c.key, c.defaultWidth])
  );
}

export function hanhLangEntryTableMinWidth() {
  return Object.values(hanhLangEntryColWidths()).reduce((sum, w) => sum + w, 0);
}

export function useHanhLangColWidths() {
  const [widths, setWidths] = useState(loadWidths);

  function startColumnResize(colKey, startX) {
    const col = HANH_LANG_COLS.find((c) => c.key === colKey);
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
