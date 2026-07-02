import { useState } from "react";

export const TRAFFIC_DUTY_COLS = [
  { key: "td1", label: "Ngày trực", defaultWidth: 52, min: 40, max: 80 },
  { key: "td2", label: "Thời tiết", defaultWidth: 40, min: 32, max: 64 },
  { key: "td3", label: "Nội dung TH", defaultWidth: 68, min: 52, max: 120 },
  { key: "td4", label: "Điểm đầu", defaultWidth: 58, min: 48, max: 90 },
  { key: "td5", label: "Điểm cuối", defaultWidth: 58, min: 48, max: 90 },
  { key: "td6", label: "Phía", defaultWidth: 26, min: 22, max: 40 },
  { key: "td7", label: "Dài", defaultWidth: 32, min: 26, max: 52 },
  { key: "td8", label: "Rộng", defaultWidth: 32, min: 26, max: 52 },
  { key: "td9", label: "Cao", defaultWidth: 32, min: 26, max: 52 },
  { key: "td10", label: "KL", defaultWidth: 36, min: 28, max: 56 },
  { key: "td11", label: "Nguyên nhân", defaultWidth: 44, min: 36, max: 72 },
  { key: "td12", label: "Người trực", defaultWidth: 56, min: 44, max: 96 },
  { key: "td13", label: "Nhận BC", defaultWidth: 56, min: 44, max: 96 },
  { key: "td14", label: "Chỉ đạo", defaultWidth: 72, min: 56, max: 120 },
  { key: "td15", label: "Thông xe", defaultWidth: 48, min: 40, max: 80 },
  { key: "td16", label: "Ghi chú", defaultWidth: 56, min: 44, max: 96 }
];

const STORAGE_KEY = "traffic-duty-col-widths-v2-a4";

function defaultWidths() {
  return Object.fromEntries(TRAFFIC_DUTY_COLS.map((c) => [c.key, c.defaultWidth]));
}

function loadWidths() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || typeof saved !== "object") return defaultWidths();
    const base = defaultWidths();
    for (const col of TRAFFIC_DUTY_COLS) {
      const v = Number(saved[col.key]);
      if (v >= col.min && v <= col.max) base[col.key] = v;
    }
    return base;
  } catch {
    return defaultWidths();
  }
}

export function useTrafficDutyColWidths() {
  const [widths, setWidths] = useState(loadWidths);

  function startColumnResize(colKey, startX) {
    const col = TRAFFIC_DUTY_COLS.find((c) => c.key === colKey);
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
