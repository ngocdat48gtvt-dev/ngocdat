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

/** Header 14 cột TCVN 14182:2024 — dùng chung cho sổ in và form nhập. */
export default function TngtTableHead({ resizable = false, onResizeStart }) {
  return (
    <>
      <tr className="tngt-header-row">
        <HeadCell colKey="tg1" rowSpan={2} resizable={resizable} onResizeStart={onResizeStart}>
          TT
          <span className="tngt-col-num">(1)</span>
        </HeadCell>
        <HeadCell colKey="tg2" rowSpan={2} resizable={resizable} onResizeStart={onResizeStart}>
          Vị trí, Lý trình
          <span className="tngt-col-num">(2)</span>
        </HeadCell>
        <HeadCell colKey="tg3" rowSpan={2} resizable={resizable} onResizeStart={onResizeStart}>
          Ngày xảy ra tai nạn
          <span className="tngt-col-num">(3)</span>
        </HeadCell>
        <th colSpan={3}>Phương tiện</th>
        <th colSpan={3}>Nguyên nhân</th>
        <th colSpan={2}>Thiệt hại — Số người</th>
        <th colSpan={2}>Thiệt hại — Giá trị (triệu đồng)</th>
        <HeadCell colKey="tg14" rowSpan={2} resizable={resizable} onResizeStart={onResizeStart}>
          Ghi chú
          <span className="tngt-col-num">(14)</span>
        </HeadCell>
      </tr>
      <tr className="tngt-header-sub">
        <HeadCell colKey="tg4" resizable={resizable} onResizeStart={onResizeStart}>
          Ô tô
          <span className="tngt-col-num">(4)</span>
        </HeadCell>
        <HeadCell colKey="tg5" resizable={resizable} onResizeStart={onResizeStart}>
          Xe máy
          <span className="tngt-col-num">(5)</span>
        </HeadCell>
        <HeadCell colKey="tg6" resizable={resizable} onResizeStart={onResizeStart}>
          Xe đạp
          <span className="tngt-col-num">(6)</span>
        </HeadCell>
        <HeadCell colKey="tg7" resizable={resizable} onResizeStart={onResizeStart}>
          Do đường
          <span className="tngt-col-num">(7)</span>
        </HeadCell>
        <HeadCell colKey="tg8" resizable={resizable} onResizeStart={onResizeStart}>
          Do người
          <span className="tngt-col-num">(8)</span>
        </HeadCell>
        <HeadCell colKey="tg9" resizable={resizable} onResizeStart={onResizeStart}>
          Do phương tiện
          <span className="tngt-col-num">(9)</span>
        </HeadCell>
        <HeadCell colKey="tg10" resizable={resizable} onResizeStart={onResizeStart}>
          Chết
          <span className="tngt-col-num">(10)</span>
        </HeadCell>
        <HeadCell colKey="tg11" resizable={resizable} onResizeStart={onResizeStart}>
          Bị thương
          <span className="tngt-col-num">(11)</span>
        </HeadCell>
        <HeadCell colKey="tg12" resizable={resizable} onResizeStart={onResizeStart}>
          Cầu đường
          <span className="tngt-col-num">(12)</span>
        </HeadCell>
        <HeadCell colKey="tg13" resizable={resizable} onResizeStart={onResizeStart}>
          Phương tiện
          <span className="tngt-col-num">(13)</span>
        </HeadCell>
      </tr>
    </>
  );
}
