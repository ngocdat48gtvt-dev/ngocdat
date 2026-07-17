import { useEffect, useRef } from "react";

export default function GptcAutoTextarea({ value, onChange, className = "", readOnly = false, onFocus, onPaste }) {
  const ref = useRef(null);

  function resize() {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 28)}px`;
  }

  useEffect(() => {
    resize();
  }, [value]);

  if (readOnly) {
    return <span className={`gptc-cell-text ${className}`.trim()}>{value || ""}</span>;
  }

  return (
    <textarea
      ref={ref}
      className={`gptc-cell-input gptc-cell-input--area ${className}`.trim()}
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      onInput={resize}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onFocus={onFocus}
      onPaste={onPaste}
      rows={1}
    />
  );
}
