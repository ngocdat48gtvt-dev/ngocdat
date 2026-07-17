import { useState } from "react";

/** 10 cột lá của phiếu KT cầu (TT → Ghi chú). */
export const PHIEU_CAU_COLS = [
  { key: "stt", label: "TT", defaultWidth: 36, min: 28, max: 56 },
  { key: "date", label: "Ngày kiểm tra", defaultWidth: 88, min: 64, max: 140 },
  { key: "tdName", label: "Họ tên tuần đường", defaultWidth: 120, min: 80, max: 220 },
  { key: "tdSign", label: "Chữ ký TD", defaultWidth: 48, min: 36, max: 90 },
  { key: "damage", label: "Tình trạng hư hỏng", defaultWidth: 150, min: 90, max: 340 },
  { key: "proposal", label: "Đề xuất TD", defaultWidth: 110, min: 70, max: 240 },
  { key: "tkName", label: "Họ tên tuần kiểm", defaultWidth: 120, min: 80, max: 220 },
  { key: "tkSign", label: "Chữ ký TK", defaultWidth: 48, min: 36, max: 90 },
  { key: "tkProposal", label: "Đề xuất TK", defaultWidth: 110, min: 70, max: 240 },
  { key: "note", label: "Ghi chú", defaultWidth: 80, min: 50, max: 200 }
];

export const PHIEU_CAU_COL_KEYS = PHIEU_CAU_COLS.map((c) => c.key);

const STORAGE_KEY = "phieu-cau-col-widths-v2";

function defaultWidths() {
  return Object.fromEntries(PHIEU_CAU_COLS.map((c) => [c.key, c.defaultWidth]));
}

function loadWidths() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || typeof saved !== "object") return defaultWidths();
    const base = defaultWidths();
    for (const col of PHIEU_CAU_COLS) {
      const v = Number(saved[col.key]);
      if (v >= col.min && v <= col.max) base[col.key] = v;
    }
    return base;
  } catch {
    return defaultWidths();
  }
}

export function usePhieuCauColWidths() {
  const [widths, setWidths] = useState(loadWidths);

  function startColumnResize(colKey, startX) {
    const col = PHIEU_CAU_COLS.find((c) => c.key === colKey);
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
