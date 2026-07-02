import { useRef, useEffect, useCallback } from "react";

/** Textarea tự giãn chiều cao theo nội dung — giống ô đồng bộ cột 7. */
export default function HanhLangAutoTextarea({
  name,
  value,
  onChange,
  placeholder,
  rows = 2,
  className = "",
  readOnly = false
}) {
  const ref = useRef(null);
  const linePx = 22;

  const adjustHeight = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0";
    el.style.height = `${Math.max(el.scrollHeight, rows * linePx)}px`;
  }, [rows]);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  return (
    <textarea
      ref={ref}
      name={name}
      value={value || ""}
      placeholder={placeholder}
      rows={rows}
      readOnly={readOnly}
      className={`tngt-entry-input hanh-lang-entry-auto ${className}`.trim()}
      onChange={(e) => {
        onChange?.(e);
        adjustHeight();
      }}
    />
  );
}
