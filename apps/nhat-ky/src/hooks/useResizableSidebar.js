import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "nhatky-control-sidebar-width";
const DEFAULT_MIN = 220;
const DEFAULT_MAX = 640;
const DEFAULT_WIDTH = 320;

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function readStored(fallback) {
  try {
    const n = Number(localStorage.getItem(STORAGE_KEY));
    if (Number.isFinite(n) && n > 0) return n;
  } catch {
    /* ignore */
  }
  return fallback;
}

/**
 * Kéo chỉnh bề rộng menu điều khiển trái — nhớ localStorage dùng chung mọi trang.
 */
export function useResizableSidebar({
  defaultWidth = DEFAULT_WIDTH,
  min = DEFAULT_MIN,
  max = DEFAULT_MAX
} = {}) {
  const [width, setWidth] = useState(() => clamp(readStored(defaultWidth), min, max));

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(width));
    } catch {
      /* ignore */
    }
  }, [width]);

  useEffect(() => {
    function onStorage(e) {
      if (e.key !== STORAGE_KEY) return;
      const n = Number(e.newValue);
      if (Number.isFinite(n) && n > 0) setWidth(clamp(n, min, max));
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [min, max]);

  const onResizeStart = useCallback(
    (e) => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = width;
      document.body.classList.add("is-resizing-sidebar");
      function onMove(ev) {
        setWidth(clamp(startW + ev.clientX - startX, min, max));
      }
      function onUp() {
        document.body.classList.remove("is-resizing-sidebar");
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      }
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [width, min, max]
  );

  return {
    width,
    onResizeStart,
    sidebarStyle: { width, minWidth: width, maxWidth: width }
  };
}
