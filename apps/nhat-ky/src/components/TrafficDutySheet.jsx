import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  formatMonthTitle,
  formatTrafficDutyKmLine,
  entryToTrafficDutyRow,
  getTrafficDutyCellValue
} from "../utils/trafficDutyFormat";
import {
  TRAFFIC_DUTY_COLS,
  useTrafficDutyColWidths
} from "../hooks/useTrafficDutyColWidths";

const MIN_ROWS = 12;

const EDITABLE_COLS = [
  { key: "cause", field: "cause", entryField: "trafficCause", label: "Nguyên nhân", multiline: false },
  { key: "dutyPerson", field: "dutyPerson", entryField: "dutyPerson", label: "Người trực", multiline: false },
  { key: "reportRecipient", field: "reportRecipient", entryField: "leaderNote", label: "Người nhận BC", multiline: false },
  { key: "directives", field: "directives", entryField: "leaderNote", label: "Ý kiến chỉ đạo", multiline: true },
  { key: "restoredAt", field: "restoredAt", entryField: "trafficRestoredAt", label: "Thời gian thông xe", multiline: false },
  { key: "note", field: "note", entryField: "trafficNote", label: "Ghi chú", multiline: true }
];

function ResizableTh({ colKey, children, onResizeStart, rowSpan, colSpan }) {
  return (
    <th rowSpan={rowSpan} colSpan={colSpan}>
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

function fitTextarea(el) {
  if (!el) return;
  el.style.height = "0px";
  el.style.height = `${Math.max(el.scrollHeight, 20)}px`;
}

function EditableCell({ value, placeholder, onChange, onContextMenu }) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    fitTextarea(ref.current);
  }, [value]);

  return (
    <textarea
      ref={ref}
      className="traffic-duty-cell-input traffic-duty-cell-textarea"
      rows={1}
      value={value || ""}
      placeholder={placeholder || ""}
      onChange={(e) => {
        fitTextarea(e.target);
        onChange(e.target.value);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu?.(e, e.currentTarget.value);
      }}
    />
  );
}

function CellContextMenu({ menu, onApply, onClose }) {
  if (!menu) return null;

  return createPortal(
    <>
      <div
        className="traffic-duty-ctx-backdrop"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <div
        className="traffic-duty-ctx-menu"
        style={{ left: menu.x, top: menu.y }}
        role="menu"
        onContextMenu={(e) => e.preventDefault()}
      >
        <button
          type="button"
          className="traffic-duty-ctx-item"
          disabled={!menu.canApply}
          onClick={() => {
            onApply(menu);
            onClose();
          }}
        >
          Áp dụng cho {menu.sameDayCount} hàng cùng ngày
        </button>
        <p className="traffic-duty-ctx-hint">
          {menu.canApply
            ? `«${menu.preview}» → các sự cố ngày ${menu.dateLabel}`
            : "Nhập nội dung trước khi áp dụng"}
        </p>
      </div>
    </>,
    document.body
  );
}

function emptyRows(count) {
  return Array.from({ length: count }, (_, i) => (
    <tr key={`empty-${i}`} className="traffic-duty-data-row traffic-duty-data-row--empty">
      {TRAFFIC_DUTY_COLS.map((col) => (
        <td key={col.key} />
      ))}
    </tr>
  ));
}

function HeaderLabel({ lines }) {
  return (
    <span className="traffic-duty-th-lines">
      {lines.map((line, i) => (
        <span key={line}>
          {i > 0 && <br />}
          {line}
        </span>
      ))}
    </span>
  );
}

export default function TrafficDutySheet({
  yearMonth,
  reportMeta,
  rowItems,
  dayMetaMap,
  onCellChange,
  onApplySameDay
}) {
  const { widths, startColumnResize } = useTrafficDutyColWidths();
  const totalColWeight = TRAFFIC_DUTY_COLS.reduce((sum, col) => sum + widths[col.key], 0);
  const editable = Boolean(onCellChange);
  const [ctxMenu, setCtxMenu] = useState(null);

  useEffect(() => {
    if (!ctxMenu) return;
    function close() {
      setCtxMenu(null);
    }
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [ctxMenu]);

  function openCellMenu(e, liveValue, { entry, globalIndex }, col) {
    if (!editable) return;

    const sameDayCount = rowItems.filter((item) => item.entry.date === entry.date).length;
    const cellValue =
      liveValue ??
      getTrafficDutyCellValue(entry, col.field, dayMetaMap, reportMeta);
    const trimmed = String(cellValue || "").trim();
    const preview = trimmed.length > 28 ? `${trimmed.slice(0, 28)}…` : trimmed;

    setCtxMenu({
      x: e.clientX,
      y: e.clientY,
      globalIndex,
      field: col.field,
      value: cellValue,
      date: entry.date,
      dateLabel: entryToTrafficDutyRow(entry, dayMetaMap, reportMeta).dutyDate,
      sameDayCount,
      canApply: Boolean(trimmed) && sameDayCount > 1,
      preview: preview || "…"
    });
  }

  const rows = rowItems.map(({ entry, globalIndex }, idx) => {
    const r = entryToTrafficDutyRow(entry, dayMetaMap, reportMeta);

    return (
      <tr key={`${entry.date}-${entry.kmFrom}-${idx}`} className="traffic-duty-data-row">
        <td>{r.dutyDate}</td>
        <td className="traffic-duty-col-readonly">{r.weather}</td>
        <td className="traffic-duty-col-damage">{r.damageContent}</td>
        <td>{r.kmFrom}</td>
        <td>{r.kmTo}</td>
        <td>{r.side}</td>
        <td>{r.length}</td>
        <td>{r.width}</td>
        <td>{r.height}</td>
        <td>{r.quantity}</td>
        {EDITABLE_COLS.map((col) => (
          <td
            key={col.key}
            className="traffic-duty-col-editable"
            onContextMenu={(e) => {
              if (!editable) return;
              const input = e.currentTarget.querySelector("textarea");
              if (!input) return;
              e.preventDefault();
              openCellMenu(e, input.value, { entry, globalIndex }, col);
            }}
          >
            {editable ? (
              <EditableCell
                value={getTrafficDutyCellValue(entry, col.field, dayMetaMap, reportMeta)}
                placeholder={col.field === "cause" ? "Tự suy nếu trống" : ""}
                onChange={(value) => onCellChange(globalIndex, col.field, value)}
                onContextMenu={(e, liveValue) =>
                  openCellMenu(e, liveValue, { entry, globalIndex }, col)
                }
              />
            ) : (
              <CellDisplay value={r[col.key]} multiline={col.multiline} />
            )}
          </td>
        ))}
      </tr>
    );
  });

  const padCount = Math.max(0, MIN_ROWS - rows.length);

  return (
    <div className="traffic-duty-sheet-wrap">
      <div className={`traffic-duty-sheet traffic-duty-sheet--a4-landscape${editable ? " traffic-duty-sheet--editing" : ""}`}>
        <h1 className="traffic-duty-title">
          TỔNG HỢP KHỐI LƯỢNG THIỆT HẠI BÃO LŨ {formatMonthTitle(yearMonth)}
        </h1>
        <p className="traffic-duty-km-range">
          {formatTrafficDutyKmLine(reportMeta)}
        </p>

        <table className="traffic-duty-table">
          <colgroup>
            {TRAFFIC_DUTY_COLS.map((col) => (
              <col
                key={col.key}
                style={{ width: `${(widths[col.key] / totalColWeight) * 100}%` }}
              />
            ))}
          </colgroup>
          <thead>
            <tr className="traffic-duty-header-row">
              <ResizableTh colKey="td1" rowSpan={2} onResizeStart={startColumnResize}>
                Ngày trực
              </ResizableTh>
              <ResizableTh colKey="td2" rowSpan={2} onResizeStart={startColumnResize}>
                <HeaderLabel lines={["Tình hình", "thời tiết"]} />
              </ResizableTh>
              <ResizableTh colKey="td3" rowSpan={2} onResizeStart={startColumnResize}>
                Nội dung thiệt hại
              </ResizableTh>
              <th colSpan={2} className="traffic-duty-header-group">
                Lý trình
              </th>
              <ResizableTh colKey="td6" rowSpan={2} onResizeStart={startColumnResize}>
                Phía
              </ResizableTh>
              <th colSpan={3} className="traffic-duty-header-group">
                Kích thước
              </th>
              <ResizableTh colKey="td10" rowSpan={2} onResizeStart={startColumnResize}>
                Khối lượng
              </ResizableTh>
              <ResizableTh colKey="td11" rowSpan={2} onResizeStart={startColumnResize}>
                Nguyên nhân
              </ResizableTh>
              <ResizableTh colKey="td12" rowSpan={2} onResizeStart={startColumnResize}>
                Người trực
              </ResizableTh>
              <ResizableTh colKey="td13" rowSpan={2} onResizeStart={startColumnResize}>
                <HeaderLabel lines={["Người nhận", "báo cáo"]} />
              </ResizableTh>
              <ResizableTh colKey="td14" rowSpan={2} onResizeStart={startColumnResize}>
                <HeaderLabel lines={["Ý kiến", "chỉ đạo"]} />
              </ResizableTh>
              <ResizableTh colKey="td15" rowSpan={2} onResizeStart={startColumnResize}>
                <HeaderLabel lines={["Thời gian", "thông xe"]} />
              </ResizableTh>
              <ResizableTh colKey="td16" rowSpan={2} onResizeStart={startColumnResize}>
                Ghi chú
              </ResizableTh>
            </tr>
            <tr className="traffic-duty-header-sub">
              <ResizableTh colKey="td4" onResizeStart={startColumnResize}>
                Điểm đầu
              </ResizableTh>
              <ResizableTh colKey="td5" onResizeStart={startColumnResize}>
                Điểm cuối
              </ResizableTh>
              <ResizableTh colKey="td7" onResizeStart={startColumnResize}>
                Dài
              </ResizableTh>
              <ResizableTh colKey="td8" onResizeStart={startColumnResize}>
                Rộng
              </ResizableTh>
              <ResizableTh colKey="td9" onResizeStart={startColumnResize}>
                Cao
              </ResizableTh>
            </tr>
          </thead>
          <tbody>
            {rows}
            {emptyRows(padCount)}
          </tbody>
        </table>
      </div>

      <CellContextMenu
        menu={ctxMenu}
        onApply={(menu) => onApplySameDay?.(menu.globalIndex, menu.field, menu.value)}
        onClose={() => setCtxMenu(null)}
      />
    </div>
  );
}

function CellDisplay({ value, multiline }) {
  if (multiline && value) {
    return <pre className="traffic-duty-pre">{value}</pre>;
  }
  return value || "";
}

export { EDITABLE_COLS };
