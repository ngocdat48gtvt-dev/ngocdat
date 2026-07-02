function ResizableTh({ colKey, children, onResizeStart, rowSpan, colSpan, className }) {
  return (
    <th rowSpan={rowSpan} colSpan={colSpan} className={className}>
      {children}
      <div
        className="col-resize-handle"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onResizeStart?.(colKey, e.clientX);
        }}
        title="Kéo để đổi độ rộng cột"
      />
    </th>
  );
}

function HeadCell({ colKey, resizable, onResizeStart, rowSpan, colSpan, children }) {
  if (resizable && colKey && onResizeStart) {
    return (
      <ResizableTh
        colKey={colKey}
        rowSpan={rowSpan}
        colSpan={colSpan}
        onResizeStart={onResizeStart}
      >
        {children}
      </ResizableTh>
    );
  }
  return (
    <th rowSpan={rowSpan} colSpan={colSpan}>
      {children}
    </th>
  );
}

/** Header — Phụ lục 09 QL37. variant="quick" đổi 2 cột cuối thành tiện ích nhập liệu. */
export default function MatDuongTableHead({
  resizable = false,
  onResizeStart,
  variant = "default",
  exportLabel = "Xuất sổ mặt đường",
  hasHeight = false,
  hasUnit = false,
  showExport = true,
  showResolved = true,
  volumeLabel = "Diện tích hư hỏng (m²)"
}) {
  const isQuick = variant === "quick";
  const sizeSpan = 2 + (hasHeight ? 1 : 0);
  const colCount =
    1 +
    2 +
    1 +
    sizeSpan +
    (hasUnit ? 1 : 0) +
    1 +
    1 +
    (showResolved ? 2 : 0) +
    (showExport ? 1 : 0) +
    1;
  const nums = Array.from({ length: colCount }, (_, i) => i + 1);
  return (
    <>
      <tr className="matduong-header-row">
        <HeadCell colKey="md1" rowSpan={2} resizable={resizable} onResizeStart={onResizeStart}>
          Ngày, tháng kiểm tra
        </HeadCell>
        <th colSpan={2}>Vị trí, lý trình hư hỏng</th>
        <HeadCell colKey="md4" rowSpan={2} resizable={resizable} onResizeStart={onResizeStart}>
          Trái/Phải/Giữa/Cả mặt
          <span className="matduong-header-side">(T/P/G/M)</span>
        </HeadCell>
        <th colSpan={sizeSpan}>Kích thước</th>
        {hasUnit && (
          <HeadCell colKey="mdUnit" rowSpan={2} resizable={resizable} onResizeStart={onResizeStart}>
            Đơn vị
          </HeadCell>
        )}
        <HeadCell colKey="md7" rowSpan={2} resizable={resizable} onResizeStart={onResizeStart}>
          {volumeLabel}
        </HeadCell>
        <HeadCell colKey="md8" rowSpan={2} resizable={resizable} onResizeStart={onResizeStart}>
          Loại sự cố
        </HeadCell>
        {showResolved && <th colSpan={2}>Đã giải quyết, xử lý và kết quả</th>}
        {showExport && (
          <HeadCell colKey="md11" rowSpan={2} resizable={resizable} onResizeStart={onResizeStart}>
            {isQuick ? exportLabel : "Người kiểm tra ký tên"}
          </HeadCell>
        )}
        <HeadCell colKey="md12" rowSpan={2} resizable={resizable} onResizeStart={onResizeStart}>
          {isQuick ? "Ngày xuất sổ BDTX" : "Ý kiến của tuần kiểm viên"}
        </HeadCell>
      </tr>
      <tr className="matduong-header-sub">
        <HeadCell colKey="md2" resizable={resizable} onResizeStart={onResizeStart}>
          Điểm đầu
        </HeadCell>
        <HeadCell colKey="md3" resizable={resizable} onResizeStart={onResizeStart}>
          Điểm cuối
        </HeadCell>
        <HeadCell colKey="md5" resizable={resizable} onResizeStart={onResizeStart}>
          Dài (m)
        </HeadCell>
        <HeadCell colKey="md6" resizable={resizable} onResizeStart={onResizeStart}>
          Rộng (m)
        </HeadCell>
        {hasHeight && (
          <HeadCell colKey="mdH" resizable={resizable} onResizeStart={onResizeStart}>
            Cao (m)
          </HeadCell>
        )}
        {showResolved && (
          <>
            <HeadCell colKey="md9" resizable={resizable} onResizeStart={onResizeStart}>
              Có
            </HeadCell>
            <HeadCell colKey="md10" resizable={resizable} onResizeStart={onResizeStart}>
              Chưa
            </HeadCell>
          </>
        )}
      </tr>
      <tr className="matduong-header-num">
        {nums.map((n) => (
          <th key={n}>({n})</th>
        ))}
      </tr>
    </>
  );
}
