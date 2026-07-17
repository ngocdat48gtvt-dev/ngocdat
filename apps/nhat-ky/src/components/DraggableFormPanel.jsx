import { useLayoutEffect, useRef } from "react";
import { useDraggable } from "../hooks/useDraggable";

function estimatePanelSize({ wide, tngt }) {
  if (typeof window === "undefined") return { w: 420, h: 480 };
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (tngt) {
    return {
      w: Math.min(vw * 0.99, 1680),
      h: Math.min(vh * 0.92, 940)
    };
  }
  if (wide) {
    return {
      w: Math.min(Math.max(520, vw * 0.5), 780),
      h: Math.min(vh - 80, 640)
    };
  }
  return {
    w: Math.min(420, vw - 32),
    h: Math.min(vh - 80, 520)
  };
}

function centeredPos({ wide, tngt, defaultX, defaultY }) {
  if (typeof defaultX === "number" && typeof defaultY === "number") {
    return { x: defaultX, y: defaultY };
  }
  const { w, h } = estimatePanelSize({ wide, tngt });
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  return {
    x: Math.max(8, Math.round((vw - w) / 2)),
    y: Math.max(8, Math.round((vh - h) / 2))
  };
}

export default function DraggableFormPanel({
  title,
  onClose,
  children,
  defaultX,
  defaultY,
  wide = false,
  tngt = false,
  /** Mặc định căn giữa màn hình khi mở. */
  center = true
}) {
  const panelRef = useRef(null);
  const { pos, setPos, onDragStart, dragging } = useDraggable(
    center
      ? centeredPos({ wide, tngt })
      : centeredPos({ wide, tngt, defaultX, defaultY })
  );

  useLayoutEffect(() => {
    if (!center) return;
    const el = panelRef.current;
    if (!el || typeof window === "undefined") return;
    const w = el.offsetWidth || estimatePanelSize({ wide, tngt }).w;
    const h = el.offsetHeight || estimatePanelSize({ wide, tngt }).h;
    setPos({
      x: Math.max(8, Math.round((window.innerWidth - w) / 2)),
      y: Math.max(8, Math.round((window.innerHeight - h) / 2))
    });
    // Chỉ căn giữa lần mở panel (remount theo key section).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={panelRef}
      className={`draggable-form-panel${wide ? " draggable-form-panel--wide" : ""}${tngt ? " draggable-form-panel--tngt" : ""}${dragging ? " is-dragging" : ""}`}
      style={{ left: pos.x, top: pos.y }}
      role="dialog"
      aria-label={title}
    >
      <div className="draggable-form-header" onMouseDown={onDragStart}>
        <span className="draggable-form-grip" title="Kéo để di chuyển">
          ⠿
        </span>
        <span className="draggable-form-title">{title}</span>
        <button type="button" className="draggable-form-close" onClick={onClose} title="Đóng">
          ×
        </button>
      </div>
      <div className="draggable-form-body">{children}</div>
    </div>
  );
}
