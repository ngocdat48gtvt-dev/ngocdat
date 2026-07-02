import { formatDisplayDate } from "../utils/nhatKyFormat";
import { entryToBaoDuongRow } from "../utils/baoDuongFormat";
import { BAO_DUONG_COLS, useBaoDuongColWidths } from "../hooks/useBaoDuongColWidths";

const MIN_ROWS = 8;

function ResizableTh({ colKey, children, onResizeStart }) {
  return (
    <th>
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

function emptyRows(count) {
  return Array.from({ length: count }, (_, i) => (
    <tr key={`empty-${i}`} className="baoduong-data-row baoduong-data-row--empty">
      {BAO_DUONG_COLS.map((col) => (
        <td key={col.key} />
      ))}
    </tr>
  ));
}

export default function BaoDuongSheet({ execDate, entries }) {
  const { widths, startColumnResize } = useBaoDuongColWidths();

  const rows = entries.map((entry, idx) => {
    const r = entryToBaoDuongRow(entry, idx);
    return (
      <tr key={`${entry.date}-${entry.kmFrom}-${idx}`} className="baoduong-data-row">
        <td className="baoduong-col-stt">{r.stt}</td>
        <td className="baoduong-col-work">{r.work}</td>
        <td className="baoduong-col-vitri">
          <pre className="baoduong-pre">{r.viTri}</pre>
        </td>
        <td className="baoduong-col-measure">
          <pre className="baoduong-pre">{r.measureSummary}</pre>
        </td>
        <td className="baoduong-col-result">
          <pre className="baoduong-pre">{r.mainResult}</pre>
        </td>
      </tr>
    );
  });

  const padCount = Math.max(0, MIN_ROWS - rows.length);

  return (
    <div className="baoduong-sheet-wrap">
      <div className="baoduong-sheet baoduong-sheet--a4-portrait">
        <h1 className="baoduong-title">
          GHI CHÉP KẾT QUẢ BẢO DƯỠNG THƯỜNG XUYÊN THEO CHẤT LƯỢNG THỰC HIỆN
        </h1>

        <p className="baoduong-period">
          1. Thời gian thực hiện: <strong>{formatDisplayDate(execDate)}</strong>
        </p>
        <p className="baoduong-intro">
          Các công việc thực hiện trong thời gian trên ghi vào bảng sau:
        </p>

        <table className="baoduong-table">
          <colgroup>
            {BAO_DUONG_COLS.map((col) => (
              <col key={col.key} style={{ width: `${widths[col.key]}px` }} />
            ))}
          </colgroup>
          <thead>
            <tr className="baoduong-header-row">
              <ResizableTh colKey="bd1" onResizeStart={startColumnResize}>
                Số thứ tự
              </ResizableTh>
              <ResizableTh colKey="bd2" onResizeStart={startColumnResize}>
                Công việc thực hiện
              </ResizableTh>
              <ResizableTh colKey="bd3" onResizeStart={startColumnResize}>
                Ghi lý trình, vị trí công việc được thực hiện
              </ResizableTh>
              <ResizableTh colKey="bd4" onResizeStart={startColumnResize}>
                Tóm tắt biện pháp thực hiện
              </ResizableTh>
              <ResizableTh colKey="bd5" onResizeStart={startColumnResize}>
                Kết quả chủ yếu
              </ResizableTh>
            </tr>
            <tr className="baoduong-header-num">
              <th>(1)</th>
              <th>(2)</th>
              <th>(3)</th>
              <th>(4)</th>
              <th>(5)</th>
            </tr>
          </thead>
          <tbody>
            {rows}
            {emptyRows(padCount)}
          </tbody>
        </table>

        <div className="baoduong-sign">
          <div className="baoduong-sign-box">
            <div className="baoduong-sign-role">Hạt trưởng</div>
            <div className="baoduong-sign-hint">(Ký, ghi rõ họ tên)</div>
          </div>
        </div>
      </div>
    </div>
  );
}
