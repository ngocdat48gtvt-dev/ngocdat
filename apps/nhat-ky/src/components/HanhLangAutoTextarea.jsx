import { useRef, useEffect, useCallback } from "react";

/** Textarea tự giãn chiều cao theo nội dung — form nhập hoặc ô bảng Excel. */
export default function HanhLangAutoTextarea({
  name,
  value,
  onChange,
  placeholder,
  rows = 2,
  className = "",
  readOnly = false,
  ariaLabel,
  variant = "form"
}) {
  const ref = useRef(null);
  const linePx = variant === "excel" ? 20 : 22;
  const minPx = variant === "excel" ? 28 : rows * linePx;

  const adjustHeight = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0";
    el.style.height = `${Math.max(el.scrollHeight, minPx)}px`;
  }, [minPx]);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  const baseClass =
    variant === "excel"
      ? "matduong-excel-auto"
      : "tngt-entry-input hanh-lang-entry-auto";

  return (
    <textarea
      ref={ref}
      name={name}
      value={value || ""}
      placeholder={placeholder}
      rows={variant === "excel" ? 1 : rows}
      readOnly={readOnly}
      aria-label={ariaLabel}
      className={`${baseClass} ${className}`.trim()}
      onChange={(e) => {
        onChange?.(e);
        adjustHeight();
      }}
    />
  );
}
