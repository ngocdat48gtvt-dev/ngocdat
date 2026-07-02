import { useDraggable } from "../hooks/useDraggable";

export default function DraggableFormPanel({ title, onClose, children, defaultX, defaultY, wide = false, tngt = false }) {
  const { pos, onDragStart, dragging } = useDraggable({
    x: defaultX ?? 24,
    y: defaultY ?? 100
  });

  return (
    <div
      className={`draggable-form-panel${wide ? " draggable-form-panel--wide" : ""}${tngt ? " draggable-form-panel--tngt" : ""}${dragging ? " is-dragging" : ""}`}
      style={{ left: pos.x, top: pos.y }}
      role="dialog"
      aria-label={title}
    >
      <div className="draggable-form-header" onMouseDown={onDragStart}>
        <span className="draggable-form-grip" title="Kéo để di chuyển">⠿</span>
        <span className="draggable-form-title">{title}</span>
        <button type="button" className="draggable-form-close" onClick={onClose} title="Đóng">
          ×
        </button>
      </div>
      <div className="draggable-form-body">{children}</div>
    </div>
  );
}
