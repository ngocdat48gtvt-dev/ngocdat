import { useEffect, useRef, useState } from "react";

const MM = (mm) => (mm * 96) / 25.4;
const OUTER_MM = 12;
const GUTTER_MM = 8;
const SPINE_MM = 14;
const CANVAS_PAD = 28;

/** Chiều rộng 2 trang mở — khớp spreadGridWidth trong NhatKyReview. */
export function spreadNaturalWidth(leftW, rightW) {
  return (
    leftW +
    MM(OUTER_MM) +
    MM(GUTTER_MM) +
    MM(SPINE_MM) +
    rightW +
    MM(GUTTER_MM) +
    MM(OUTER_MM)
  );
}

/** Một nửa sổ (3 cột + lề trang). */
export function pageNaturalWidth(pageW) {
  return pageW + MM(OUTER_MM) + MM(GUTTER_MM);
}

/** Bù browser zoom để quyết định bố cục ổn định khi Ctrl +/-. */
function layoutViewportWidth(el) {
  const vv = window.visualViewport;
  if (vv) return Math.round(vv.width * vv.scale);
  return el.clientWidth;
}

/**
 * Giữ sổ ở bố cục ngang trên desktop để khi phóng to chỉ cuộn ngang,
 * không tự nhảy sang bố cục dọc làm người dùng cảm giác bị vỡ.
 */
export function useNhatKySpreadFit(leftW, rightW, userZoomPercent) {
  const canvasRef = useRef(null);
  const userScale = Math.min(1.5, Math.max(0.7, userZoomPercent / 100));
  const [layout, setLayout] = useState("spread");

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    const measure = () => {
      const viewportWidth = layoutViewportWidth(el);
      const available = Math.max(320, viewportWidth - CANVAS_PAD);
      const spreadW = spreadNaturalWidth(leftW, rightW);

      // Chỉ xếp dọc ở màn hình thực sự hẹp; browser zoom trên desktop vẫn giữ ngang.
      if (viewportWidth <= 900 && available < spreadW) {
        setLayout("stacked");
        return;
      }

      setLayout("spread");
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
      vv?.removeEventListener("resize", measure);
    };
  }, [leftW, rightW]);

  return { canvasRef, layout, scale: userScale };
}
