function ResizableTh({ colKey, children, onResizeStart, rowSpan, colSpan, className }) {
  return (
    <th rowSpan={rowSpan} colSpan={colSpan} className={className}>
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

function HeadCell({ colKey, resizable, onResizeStart, rowSpan, colSpan, className, children }) {
  if (resizable && colKey && onResizeStart) {
    return (
      <ResizableTh
        colKey={colKey}
        rowSpan={rowSpan}
        colSpan={colSpan}
        className={className}
        onResizeStart={onResizeStart}
      >
        {children}
      </ResizableTh>
    );
  }
  return (
    <th rowSpan={rowSpan} colSpan={colSpan} className={className}>
      {children}
    </th>
  );
}

/** Header 14 cột — 3 hàng tên cột + 1 hàng số (1)…(14). */
export default function TngtTableHead({ resizable = false, onResizeStart }) {
  return (
    <>
      <tr className="tngt-header-row">
        <HeadCell colKey="tg1" rowSpan={3} resizable={resizable} onResizeStart={onResizeStart}>
          TT
        </HeadCell>
        <HeadCell colKey="tg2" rowSpan={3} resizable={resizable} onResizeStart={onResizeStart}>
          Vị trí, Lý trình
        </HeadCell>
        <HeadCell colKey="tg3" rowSpan={3} resizable={resizable} onResizeStart={onResizeStart}>
          Ngày xảy ra tai nạn
        </HeadCell>
        <th colSpan={3}>Phương tiện</th>
        <th colSpan={3}>Nguyên nhân</th>
        <th colSpan={4}>Thiệt hại</th>
        <HeadCell colKey="tg14" rowSpan={3} resizable={resizable} onResizeStart={onResizeStart}>
          Ghi chú
        </HeadCell>
      </tr>
      <tr className="tngt-header-mid">
        <HeadCell colKey="tg4" rowSpan={2} resizable={resizable} onResizeStart={onResizeStart}>
          Ô tô
        </HeadCell>
        <HeadCell colKey="tg5" rowSpan={2} resizable={resizable} onResizeStart={onResizeStart}>
          Xe máy
        </HeadCell>
        <HeadCell colKey="tg6" rowSpan={2} resizable={resizable} onResizeStart={onResizeStart}>
          Xe đạp
        </HeadCell>
        <HeadCell colKey="tg7" rowSpan={2} resizable={resizable} onResizeStart={onResizeStart}>
          Do đường
        </HeadCell>
        <HeadCell colKey="tg8" rowSpan={2} resizable={resizable} onResizeStart={onResizeStart}>
          Do người
        </HeadCell>
        <HeadCell colKey="tg9" rowSpan={2} resizable={resizable} onResizeStart={onResizeStart}>
          Do phương tiện
        </HeadCell>
        <th colSpan={2}>Số người</th>
        <th colSpan={2}>Giá trị (triệu đồng)</th>
      </tr>
      <tr className="tngt-header-sub">
        <HeadCell colKey="tg10" resizable={resizable} onResizeStart={onResizeStart}>
          Chết
        </HeadCell>
        <HeadCell colKey="tg11" resizable={resizable} onResizeStart={onResizeStart}>
          Bị thương
        </HeadCell>
        <HeadCell colKey="tg12" resizable={resizable} onResizeStart={onResizeStart}>
          Cầu đường
        </HeadCell>
        <HeadCell colKey="tg13" resizable={resizable} onResizeStart={onResizeStart}>
          Phương tiện
        </HeadCell>
      </tr>
      <tr className="tngt-header-num">
        {Array.from({ length: 14 }, (_, i) => (
          <th key={`tg-num-${i + 1}`}>({i + 1})</th>
        ))}
      </tr>
    </>
  );
}
