import { useRef, useEffect, useCallback } from "react";
import {
  useColumnWidths,
  LEFT_COLS,
  RIGHT_COLS,
  sumCols
} from "../hooks/useColumnWidths";
import { useNhatKySpreadFit, pageNaturalWidth } from "../hooks/useNhatKySpreadFit";
import {
  formatLocationCol,
  formatContentCol,
  formatDisplayDate,
  displayDayWeather,
  OFFICIAL_HEADERS,
  PART_LABELS,
  SECTIONS,
  compareEntriesByTypeAndKm
} from "../utils/nhatKyFormat";
import WeatherQuickPicker from "./WeatherQuickPicker";

const DATA_HEADERS = ["col1", "col2", "col3", "col4", "col5", "col6"];

const PAGE_PAD_OUTER = "12mm";
const PAGE_PAD_GUTTER = "8mm";
const PAGE_SPINE = "14mm";

function spreadGridColumns(leftW, rightW) {
  return `calc(${leftW}px + ${PAGE_PAD_OUTER} + ${PAGE_PAD_GUTTER}) ${PAGE_SPINE} calc(${rightW}px + ${PAGE_PAD_GUTTER} + ${PAGE_PAD_OUTER})`;
}

function spreadGridWidth(leftW, rightW) {
  return `calc(${leftW}px + ${PAGE_PAD_OUTER} + ${PAGE_PAD_GUTTER} + ${PAGE_SPINE} + ${rightW}px + ${PAGE_PAD_GUTTER} + ${PAGE_PAD_OUTER})`;
}

function emptyCols(label, labelClass) {
  return (
    <>
      <td className="nhatky-cell-blank" />
      <td className="nhatky-cell-blank" />
      <td className={labelClass}>{label}</td>
    </>
  );
}

function blankRightCells(extraClass = "") {
  const cls = `nhatky-cell-blank${extraClass ? ` ${extraClass}` : ""}`;
  return (
    <>
      <td className={cls} />
      <td className={cls} />
      <td className={cls} />
    </>
  );
}

function formatTimeCol(time) {
  return time || "";
}

function CellTextarea({ value, onChange, placeholder, readOnly = false, compact = true }) {
  const ref = useRef(null);

  const adjustHeight = useCallback(() => {
    const el = ref.current;
    if (!el || !compact) return;
    el.style.height = "0";
    el.style.height = `${Math.max(el.scrollHeight, 26)}px`;
  }, [compact]);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  return (
    <textarea
      ref={ref}
      className={`nhatky-cell-input${compact ? " nhatky-cell-input--compact" : ""}`}
      value={value || ""}
      rows={compact ? 1 : 2}
      onChange={(e) => {
        onChange?.(e.target.value);
        adjustHeight();
      }}
      placeholder={placeholder}
      readOnly={readOnly || !onChange}
    />
  );
}

function ResizableTh({ colKey, colIndex, rowClass, onResizeStart }) {
  const label =
    rowClass === "nhatky-header-main"
      ? OFFICIAL_HEADERS[DATA_HEADERS[colIndex]]
      : colIndex + 1;
  return (
    <th>
      <div className="th-inner">{label}</div>
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

function PageColgroup({ cols, widths }) {
  const total = sumCols(cols, widths);
  return (
    <colgroup>
      {cols.map((col) => (
        <col
          key={col.key}
          style={{ width: `${(widths[col.key] / total) * 100}%` }}
        />
      ))}
    </colgroup>
  );
}

function SyncedHeadGrid({ leftW, rightW, widths, onResizeStart, stacked = false }) {
  const gridStyle = stacked
    ? undefined
    : {
        gridTemplateColumns: spreadGridColumns(leftW, rightW),
        width: spreadGridWidth(leftW, rightW)
      };

  return (
    <div className="nhatky-head-grid" style={gridStyle}>
      <div className="nhatky-head-cell nhatky-head-cell--left nhatky-head-cell--top">
        <table className="nhatky-official-table nhatky-head-row-table">
          <PageColgroup cols={LEFT_COLS} widths={widths} />
          <tbody>
            <tr className="nhatky-header-main">
              {LEFT_COLS.map((col, i) => (
                <ResizableTh
                  key={col.key}
                  colKey={col.key}
                  colIndex={i}
                  rowClass="nhatky-header-main"
                  onResizeStart={onResizeStart}
                />
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <div className="nhatky-head-gap" aria-hidden="true" />
      <div className="nhatky-head-cell nhatky-head-cell--right nhatky-head-cell--top">
        <table className="nhatky-official-table nhatky-head-row-table">
          <PageColgroup cols={RIGHT_COLS} widths={widths} />
          <tbody>
            <tr className="nhatky-header-main">
              {RIGHT_COLS.map((col, i) => (
                <ResizableTh
                  key={col.key}
                  colKey={col.key}
                  colIndex={i + 3}
                  rowClass="nhatky-header-main"
                  onResizeStart={onResizeStart}
                />
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SyncedRowTable({ cols, widths, rowClass, children }) {
  return (
    <table className="nhatky-official-table nhatky-row-table">
      <PageColgroup cols={cols} widths={widths} />
      <tbody>
        <tr className={rowClass}>{children}</tr>
      </tbody>
    </table>
  );
}

export default function NhatKyReview({
  date,
  items,
  draftItem,
  dayMeta,
  alwaysShow = false,
  onItemFieldChange,
  onDraftFieldChange,
  onDayMetaChange
}) {
  const { widths, zoom, startColumnResize } = useColumnWidths();
  const editable = Boolean(onItemFieldChange);

  const leftW = sumCols(LEFT_COLS, widths);
  const rightW = sumCols(RIGHT_COLS, widths);
  const { canvasRef, layout, scale } = useNhatKySpreadFit(leftW, rightW, zoom);
  const stacked = layout === "stacked";
  const clusterMinWidth = stacked
    ? `${Math.max(pageNaturalWidth(leftW), pageNaturalWidth(rightW))}px`
    : spreadGridWidth(leftW, rightW);

  function itemFieldHandler(item, field) {
    if (item._draft) {
      return onDraftFieldChange ? (v) => onDraftFieldChange(field, v) : undefined;
    }
    return onItemFieldChange
      ? (v) => onItemFieldChange(item._globalIndex, field, v)
      : undefined;
  }

  const allItems = draftItem ? [...items, { ...draftItem, _draft: true }] : items;
  const hasEntries = allItems.length > 0;
  const hasDayInfo = Boolean(dayMeta?.weather);
  const showSheet = alwaysShow || hasEntries || hasDayInfo;

  function buildSyncRows() {
    const rows = [];

    rows.push({
      key: "day-weather",
      left: {
        className: "nhatky-day-weather",
        cells: (
          <>
            <td className="nhatky-col-date">{formatDisplayDate(date)}</td>
            <td className="nhatky-cell-blank" />
            <td className="nhatky-col-content nhatky-col-weather">
              {onDayMetaChange ? (
                <WeatherQuickPicker
                  value={dayMeta.weather}
                  onChange={(v) => onDayMetaChange({ weather: v })}
                />
              ) : (
                <pre className="nhatky-pre">{displayDayWeather(dayMeta.weather)}</pre>
              )}
            </td>
          </>
        )
      },
      right: {
        className: "nhatky-day-weather-right nhatky-right-align",
        cells: blankRightCells()
      }
    });

    for (const block of bodyBlocks) {
      if (block.type === "part") {
        rows.push({
          key: block.key,
          left: {
            className: "nhatky-part-row",
            cells: emptyCols(block.label, "nhatky-col-label nhatky-col-label--part")
          },
          right: {
            className: "nhatky-part-row nhatky-right-align",
            cells: blankRightCells()
          }
        });
        continue;
      }

      const label = `${block.section.num}. ${block.section.title}`;
      rows.push({
        key: `${block.key}-h`,
        left: {
          className: "nhatky-section-hdr",
          cells: emptyCols(label, "nhatky-col-label nhatky-col-label--section")
        },
        right: {
          className: "nhatky-section-hdr nhatky-right-align",
          cells: blankRightCells()
        }
      });

      if (block.rows.length === 0) {
        rows.push({
          key: `${block.key}-empty`,
          left: {
            className: "nhatky-section-empty",
            cells: (
              <>
                <td className="nhatky-cell-blank" />
                <td className="nhatky-cell-blank" />
                <td>
                  <em className="nhatky-no-issue">Không phát sinh</em>
                </td>
              </>
            )
          },
          right: {
            className: "nhatky-right-data nhatky-right-empty",
            cells: (
              <>
                <td className="nhatky-col-resolved nhatky-cell-blank" />
                <td className="nhatky-col-leader nhatky-cell-blank" />
                <td className="nhatky-col-note nhatky-cell-blank" />
              </>
            )
          }
        });
        continue;
      }

      block.rows.forEach((item, i) => {
        const draftClass = item._draft ? "nhatky-draft-row" : "";
        const resolved = item.resolved || item.solution || "";
        const leaderNote = item.leaderNote || "";
        const note = item.inspectorNote || item.note || "";

        rows.push({
          key: `${block.key}-${i}`,
          left: {
            className: draftClass,
            cells: (
              <>
                <td className="nhatky-col-date">
                  {formatTimeCol(item.time)}
                  {item._draft && <div className="nhatky-draft-tag">đang nhập</div>}
                </td>
                <td className="nhatky-col-loc">
                  <pre className="nhatky-pre">{formatLocationCol(item)}</pre>
                </td>
                <td className="nhatky-col-content">
                  <pre className="nhatky-pre">{formatContentCol(item, "")}</pre>
                </td>
              </>
            )
          },
          right: {
            className: `${draftClass} nhatky-right-editable`.trim(),
            cells: (
              <>
                <td className="nhatky-col-resolved">
                  {editable ? (
                    <CellTextarea
                      value={resolved}
                      onChange={itemFieldHandler(item, "resolved")}
                      placeholder="Xử lý tại chỗ, kết quả…"
                    />
                  ) : (
                    <pre className="nhatky-pre">{resolved}</pre>
                  )}
                </td>
                <td className="nhatky-col-leader">
                  {editable ? (
                    <CellTextarea
                      value={leaderNote}
                      onChange={itemFieldHandler(item, "leaderNote")}
                      placeholder="Nhận xét Hạt trưởng (cột 5)…"
                    />
                  ) : (
                    leaderNote
                  )}
                </td>
                <td className="nhatky-col-note">
                  {editable ? (
                    <CellTextarea
                      value={note}
                      onChange={itemFieldHandler(item, "inspectorNote")}
                      placeholder="Ghi chú (cột 6)…"
                    />
                  ) : (
                    note
                  )}
                </td>
              </>
            )
          }
        });
      });
    }

    return rows;
  }

  const bodyBlocks = ["I", "II"].flatMap((part) => {
    const sections = SECTIONS.filter((s) => s.part === part);
    return [
      { type: "part", key: `part-${part}`, label: PART_LABELS[part] },
      ...sections.map((section) => ({
        type: "section",
        key: section.key,
        section,
        rows: allItems
          .filter((x) => x.section === section.title)
          .sort(compareEntriesByTypeAndKm)
      }))
    ];
  });

  const syncRows = buildSyncRows();

  return (
    <div className="nhatky-review">
      {!showSheet ? (
        <div className="nhatky-review-canvas nhatky-review-canvas--empty">
          <div className="nhatky-review-empty">
            <p>Chưa có dữ liệu ngày {formatDisplayDate(date)}.</p>
            <p>Chọn hạng mục bên trái và thêm sự cố.</p>
          </div>
        </div>
      ) : (
        <div className="nhatky-review-canvas" ref={canvasRef}>
          <div className="nhatky-spread-wrap">
            <div
              className={`nhatky-spread-book${stacked ? " nhatky-spread--stacked" : ""}`}
              style={{ zoom: scale }}
            >
              <div
                className="nhatky-sticky-head-cluster"
                style={{ minWidth: clusterMinWidth }}
              >
                <SyncedHeadGrid
                  leftW={leftW}
                  rightW={rightW}
                  widths={widths}
                  onResizeStart={startColumnResize}
                  stacked={stacked}
                />
              </div>

              <div
                className="nhatky-body-grid"
                style={
                  stacked
                    ? undefined
                    : {
                        gridTemplateColumns: spreadGridColumns(leftW, rightW),
                        width: spreadGridWidth(leftW, rightW)
                      }
                }
              >
              {syncRows.flatMap((row) => [
                <div key={`${row.key}-l`} className="nhatky-body-cell nhatky-body-cell--left">
                  <SyncedRowTable
                    cols={LEFT_COLS}
                    widths={widths}
                    rowClass={row.left.className}
                  >
                    {row.left.cells}
                  </SyncedRowTable>
                </div>,
                <div key={`${row.key}-g`} className="nhatky-body-gap" aria-hidden="true" />,
                <div key={`${row.key}-r`} className="nhatky-body-cell nhatky-body-cell--right">
                  <SyncedRowTable
                    cols={RIGHT_COLS}
                    widths={widths}
                    rowClass={row.right.className}
                  >
                    {row.right.cells}
                  </SyncedRowTable>
                </div>
              ])}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
