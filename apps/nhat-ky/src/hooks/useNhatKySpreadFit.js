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

/**
 * Tự chọn bố cục ngang / xếp dọc và tỉ lệ hiển thị theo vùng xem.
 * Ưu tiên đọc được trên màn hình phổ thông (1366–1920px) mà vẫn giữ mẫu in.
 */
export function useNhatKySpreadFit(leftW, rightW, userZoomPercent) {
  const canvasRef = useRef(null);
  const [state, setState] = useState({ layout: "spread", scale: userZoomPercent / 100 });

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    const measure = () => {
      const available = Math.max(320, el.clientWidth - CANVAS_PAD);
      const spreadW = spreadNaturalWidth(leftW, rightW);
      const maxPageW = Math.max(pageNaturalWidth(leftW), pageNaturalWidth(rightW));
      const userScale = Math.min(1.5, Math.max(0.7, userZoomPercent / 100));

      if (available >= spreadW * userScale) {
        setState({ layout: "spread", scale: userScale });
        return;
      }

      if (available >= spreadW) {
        setState({ layout: "spread", scale: available / spreadW });
        return;
      }

      if (available >= maxPageW * userScale) {
        setState({ layout: "stacked", scale: userScale });
        return;
      }

      setState({ layout: "stacked", scale: Math.max(0.55, available / maxPageW) });
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [leftW, rightW, userZoomPercent]);

  return { canvasRef, ...state };
}
