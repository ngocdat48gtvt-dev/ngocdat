import { useCallback, useRef } from "react";

const MIN_MM = 0;
const MAX_MM = 40;

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Kéo đường lề trên trang preview (giống Excel Page Layout).
 * margins: { top, right, bottom, left } đơn vị mm.
 * pageWMm / pageHMm: khổ trang (mặc định A4 dọc).
 */
export default function NhatKyMarginGuides({
  margins,
  onChange,
  pageWMm = 210,
  pageHMm = 297,
  minContentMm
}) {
  const boxRef = useRef(null);
  const minContent = minContentMm ?? Math.min(80, pageWMm * 0.4, pageHMm * 0.4);

  const startDrag = useCallback(
    (edge, e) => {
      e.preventDefault();
      e.stopPropagation();
      const box = boxRef.current?.parentElement;
      if (!box) return;
      const rect = box.getBoundingClientRect();

      function onMove(ev) {
        const x = ev.clientX - rect.left;
        const y = ev.clientY - rect.top;
        const xMm = (x / rect.width) * pageWMm;
        const yMm = (y / rect.height) * pageHMm;

        onChange((prev) => {
          const next = { ...prev };
          if (edge === "left") {
            next.left = clamp(
              xMm,
              MIN_MM,
              Math.min(MAX_MM, pageWMm - prev.right - minContent)
            );
          } else if (edge === "right") {
            next.right = clamp(
              pageWMm - xMm,
              MIN_MM,
              Math.min(MAX_MM, pageWMm - prev.left - minContent)
            );
          } else if (edge === "top") {
            next.top = clamp(
              yMm,
              MIN_MM,
              Math.min(MAX_MM, pageHMm - prev.bottom - minContent)
            );
          } else if (edge === "bottom") {
            next.bottom = clamp(
              pageHMm - yMm,
              MIN_MM,
              Math.min(MAX_MM, pageHMm - prev.top - minContent)
            );
          }
          return {
            top: Math.round(next.top * 10) / 10,
            right: Math.round(next.right * 10) / 10,
            bottom: Math.round(next.bottom * 10) / 10,
            left: Math.round(next.left * 10) / 10
          };
        });
      }

      function onUp() {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      }

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [onChange, pageWMm, pageHMm, minContent]
  );

  const { top, right, bottom, left } = margins;

  return (
    <div className="nhatky-margin-guides no-print" ref={boxRef} aria-hidden="true">
      <div
        className="nhatky-margin-shade nhatky-margin-shade--top"
        style={{ height: `${top}mm` }}
      />
      <div
        className="nhatky-margin-shade nhatky-margin-shade--bottom"
        style={{ height: `${bottom}mm` }}
      />
      <div
        className="nhatky-margin-shade nhatky-margin-shade--left"
        style={{ width: `${left}mm`, top: `${top}mm`, bottom: `${bottom}mm` }}
      />
      <div
        className="nhatky-margin-shade nhatky-margin-shade--right"
        style={{ width: `${right}mm`, top: `${top}mm`, bottom: `${bottom}mm` }}
      />

      <div
        className="nhatky-margin-line nhatky-margin-line--top"
        style={{ top: `${top}mm` }}
        onMouseDown={(e) => startDrag("top", e)}
        title={`Lề trên ${top} mm — kéo để chỉnh`}
      >
        <span className="nhatky-margin-line-label">{top}</span>
      </div>
      <div
        className="nhatky-margin-line nhatky-margin-line--bottom"
        style={{ bottom: `${bottom}mm` }}
        onMouseDown={(e) => startDrag("bottom", e)}
        title={`Lề dưới ${bottom} mm — kéo để chỉnh`}
      >
        <span className="nhatky-margin-line-label">{bottom}</span>
      </div>
      <div
        className="nhatky-margin-line nhatky-margin-line--left"
        style={{ left: `${left}mm` }}
        onMouseDown={(e) => startDrag("left", e)}
        title={`Lề trái ${left} mm — kéo để chỉnh`}
      >
        <span className="nhatky-margin-line-label">{left}</span>
      </div>
      <div
        className="nhatky-margin-line nhatky-margin-line--right"
        style={{ right: `${right}mm` }}
        onMouseDown={(e) => startDrag("right", e)}
        title={`Lề phải ${right} mm — kéo để chỉnh`}
      >
        <span className="nhatky-margin-line-label">{right}</span>
      </div>
    </div>
  );
}
