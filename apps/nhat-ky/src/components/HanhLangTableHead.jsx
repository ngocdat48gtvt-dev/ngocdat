export const HANH_LANG_HEADERS = [
  { key: "hl1", num: 1, label: "TT" },
  { key: "hl2", num: 2, label: "Người lập biên bản" },
  { key: "hl3", num: 3, label: "Tổ chức (Cá nhân) vi phạm" },
  { key: "hl4", num: 4, label: "Địa chỉ" },
  { key: "hl5", num: 5, label: "Lý trình" },
  { key: "hl6", num: 6, label: "Ngày lập biên bản" },
  { key: "hl7", num: 7, label: "Nội dung vi phạm" },
  { key: "hl8", num: 8, label: "Diện tích vi phạm (dài*rộng)" },
  { key: "hl9", num: 9, label: "Theo dõi nội dung xử lý vi phạm" },
  { key: "hl10", num: 10, label: "Ghi chú" }
];

function ResizableTh({ colKey, children, onResizeStart, className }) {
  return (
    <th className={className}>
      {children}
      <div
        className="col-resize-handle"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onResizeStart(colKey, e.clientX);
        }}
        title="Kéo để đổi độ rộng cột"
      />
    </th>
  );
}

function HeadCell({ colKey, resizable, onResizeStart, className, children }) {
  if (resizable && colKey && onResizeStart) {
    return (
      <ResizableTh colKey={colKey} onResizeStart={onResizeStart} className={className}>
        {children}
      </ResizableTh>
    );
  }
  return <th className={className}>{children}</th>;
}

/** Header 10 cột — 2 hàng: tên cột + số thứ tự (1)…(10) theo mẫu Phụ lục 05. */
export default function HanhLangTableHead({ resizable = false, onResizeStart }) {
  return (
    <>
      <tr className="hanh-lang-header-row">
        {HANH_LANG_HEADERS.map((h) => (
          <HeadCell
            key={h.key}
            colKey={h.key}
            resizable={resizable}
            onResizeStart={onResizeStart}
          >
            {h.label}
          </HeadCell>
        ))}
      </tr>
      <tr className="hanh-lang-header-num">
        {HANH_LANG_HEADERS.map((h) => (
          <th key={`${h.key}-num`}>({h.num})</th>
        ))}
      </tr>
    </>
  );
}
