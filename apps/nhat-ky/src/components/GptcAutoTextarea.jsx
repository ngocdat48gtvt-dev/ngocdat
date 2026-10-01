import { useLayoutEffect, useRef } from "react";

/** Co giãn theo chữ; các ô cùng hàng cao bằng ô cao nhất (kiểu Excel). */
export function syncGptcAutogrowRows(root) {
  if (!root) return;
  const rowList = root.matches?.("tr")
    ? [root]
    : Array.from(root.querySelectorAll?.("tr") || []);
  rowList.forEach((tr) => {
    const areas = Array.from(tr.querySelectorAll("textarea.gptc-cell-input--autogrow"));
    if (!areas.length) return;
    areas.forEach((a) => {
      a.style.height = "0px";
      a.style.height = `${Math.max(a.scrollHeight, 28)}px`;
    });
    if (areas.length === 1) return;
    const maxH = Math.max(...areas.map((a) => a.offsetHeight), 28);
    areas.forEach((a) => {
      a.style.height = `${maxH}px`;
    });
  });
}

function resizeTextareaRow(el) {
  if (!el) return;
  const tr = el.closest("tr");
  if (tr) {
    syncGptcAutogrowRows(tr);
    return;
  }
  el.style.height = "0px";
  el.style.height = `${Math.max(el.scrollHeight, 28)}px`;
}

export default function GptcAutoTextarea({
  value,
  onChange,
  className = "",
  readOnly = false,
  onFocus,
  onPaste,
  placeholder = ""
}) {
  const ref = useRef(null);

  function resize() {
    resizeTextareaRow(ref.current);
  }

  useLayoutEffect(() => {
    resize();
  }, [value]);

  if (readOnly) {
    return <span className={`gptc-cell-text ${className}`.trim()}>{value || ""}</span>;
  }

  return (
    <textarea
      ref={ref}
      className={`gptc-cell-input gptc-cell-input--area gptc-cell-input--autogrow ${className}`.trim()}
      value={value || ""}
      placeholder={placeholder || undefined}
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
