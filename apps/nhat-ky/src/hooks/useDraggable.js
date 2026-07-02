import { useState, useCallback, useEffect } from "react";

export function useDraggable(initial = { x: 24, y: 80 }) {
  const [pos, setPos] = useState(initial);
  const [dragging, setDragging] = useState(false);

  const onDragStart = useCallback((e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const origin = { ...pos };
    setDragging(true);

    function onMove(ev) {
      setPos({
        x: Math.max(8, origin.x + ev.clientX - startX),
        y: Math.max(8, origin.y + ev.clientY - startY)
      });
    }

    function onUp() {
      setDragging(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [pos]);

  useEffect(() => {
    if (dragging) document.body.classList.add("is-dragging-panel");
    else document.body.classList.remove("is-dragging-panel");
    return () => document.body.classList.remove("is-dragging-panel");
  }, [dragging]);

  return { pos, setPos, onDragStart, dragging };
}
