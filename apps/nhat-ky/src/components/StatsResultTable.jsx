import { Fragment, useEffect, useRef, useState } from "react";
import { formatStatsNumber } from "../utils/volumeStatsFormat";

const COL_KEYS = [
  "pick",
  "section",
  "work",
  "unit",
  "done",
  "contract",
  "remaining",
  "percent",
  "status",
  "action"
];

const DEFAULT_WIDTHS = {
  pick: 32,
  section: 92,
  work: 132,
  unit: 40,
  done: 56,
  contract: 56,
  remaining: 56,
  percent: 36,
  status: 72,
  action: 64
};

const MIN_WIDTHS = {
  pick: 28,
  section: 72,
  work: 96,
  unit: 36,
  done: 48,
  contract: 48,
  remaining: 48,
  percent: 32,
  status: 60,
  action: 56
};

const HEADERS = [
  ["pick", "", false],
  ["section", "Hạng mục", false],
  ["work", "Đầu việc", false],
  ["unit", "ĐVT", false],
  ["done", "Đã làm", true],
  ["contract", "Hợp đồng", true],
  ["remaining", "Còn thiếu", true],
  ["percent", "%", true],
  ["status", "Trạng thái", false],
  ["action", "", false]
];

const STORAGE_KEY = "nhatky_stats_result_col_widths_v3";

function loadWidths() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_WIDTHS };
    return { ...DEFAULT_WIDTHS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_WIDTHS };
  }
}

export default function StatsResultTable({
  rows,
  expandedKey,
  onToggleExpand,
  StatusBadge,
  selectedKeys = [],
  onToggleSelect,
  onToggleSelectAll
}) {
  const [colWidths, setColWidths] = useState(loadWidths);
  const resizeRef = useRef(null);

  const selectableRows = rows.filter((r) => r.items?.length > 0);
  const selectedSet = new Set(selectedKeys);
  const allSelected =
    selectableRows.length > 0 && selectableRows.every((r) => selectedSet.has(r.key));
  const someSelected = selectableRows.some((r) => selectedSet.has(r.key));

  useEffect(() => {
    return () => {
      if (resizeRef.current) {
        window.removeEventListener("mousemove", resizeRef.current.onMove);
        window.removeEventListener("mouseup", resizeRef.current.onUp);
      }
    };
  }, []);

  function startResize(col, event) {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startW = colWidths[col];

    function onMove(ev) {
      const delta = ev.clientX - startX;
      const nextW = Math.max(MIN_WIDTHS[col], startW + delta);
      setColWidths((prev) => ({ ...prev, [col]: nextW }));
    }

    function onUp() {
      setColWidths((prev) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(prev));
        return prev;
      });
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.classList.remove("stats-col-resizing");
      resizeRef.current = null;
    }

    document.body.classList.add("stats-col-resizing");
    resizeRef.current = { onMove, onUp };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  const tableWidth = COL_KEYS.reduce((sum, key) => sum + colWidths[key], 0);

  return (
    <div className="stats-table-wrap stats-table-wrap--excel stats-table-wrap--compact">
      <table
        className="stats-table stats-table--excel stats-table--compact"
        style={{ width: tableWidth, maxWidth: "100%" }}
      >
        <colgroup>
          {COL_KEYS.map((key) => (
            <col key={key} style={{ width: colWidths[key] }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {HEADERS.map(([key, label, isNum]) => (
              <th
                key={key}
                className={isNum ? "stats-table-th stats-num" : "stats-table-th"}
              >
                {key === "pick" ? (
                  <input
                    type="checkbox"
                    className="stats-pick-check"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = !allSelected && someSelected;
                    }}
                    onChange={() => onToggleSelectAll?.(!allSelected)}
                    title="Chọn tất cả đầu việc có chi tiết"
                    aria-label="Chọn tất cả"
                  />
                ) : (
                  label
                )}
                {key !== "action" && key !== "pick" && (
                  <span
                    className="stats-table-resize-handle"
                    onMouseDown={(e) => startResize(key, e)}
                    title="Kéo để đổi độ rộng cột"
                  />
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const expanded = expandedKey === row.key;
            const canPick = row.items?.length > 0;
            const picked = selectedSet.has(row.key);
            return (
              <Fragment key={row.key}>
                <tr
                  className={`stats-row stats-row--${row.status}${expanded ? " is-expanded" : ""}${picked ? " is-picked" : ""}`}
                >
                  <td className="stats-td-center">
                    {canPick && (
                      <input
                        type="checkbox"
                        className="stats-pick-check"
                        checked={picked}
                        onChange={() => onToggleSelect?.(row.key)}
                        title="Chọn để xuất khối lượng chi tiết"
                        aria-label={`Chọn ${row.workType}`}
                      />
                    )}
                  </td>
                  <td>{row.section}</td>
                  <td>
                    <strong>{row.workType}</strong>
                    <div className="stats-sub">{row.entryCount} dòng</div>
                  </td>
                  <td className="stats-td-center">{row.unitLabel}</td>
                  <td className="stats-num">{formatStatsNumber(row.totalDone)}</td>
                  <td className="stats-num">
                    {row.contractQty != null ? formatStatsNumber(row.contractQty) : ""}
                  </td>
                  <td className="stats-num">
                    {row.remaining != null ? (
                      <span
                        className={
                          row.remaining > 0 ? "stats-remaining--short" : "stats-remaining--ok"
                        }
                      >
                        {row.remaining > 0 ? formatStatsNumber(row.remaining) : "0"}
                      </span>
                    ) : (
                      ""
                    )}
                  </td>
                  <td className="stats-num">
                    {row.percent != null ? `${formatStatsNumber(row.percent)}%` : ""}
                  </td>
                  <td className="stats-td-center">
                    <StatusBadge row={row} />
                  </td>
                  <td className="stats-td-center">
                    {canPick && (
                      <button
                        type="button"
                        className="stats-detail-btn"
                        onClick={() => onToggleExpand(row.key)}
                      >
                        {expanded ? "Thu gọn" : "Chi tiết"}
                      </button>
                    )}
                  </td>
                </tr>
                {expanded && row.items.length > 0 && (
                  <tr className="stats-detail-row">
                    <td colSpan={10}>
                      <table className="stats-detail-table">
                        <thead>
                          <tr>
                            <th>Ngày</th>
                            <th>LT đầu</th>
                            <th>LT cuối</th>
                            <th>Phía</th>
                            <th>ĐVT</th>
                            <th className="stats-num">Dài</th>
                            <th className="stats-num">Rộng</th>
                            <th className="stats-num">Cao</th>
                            <th className="stats-num">Khối lượng</th>
                          </tr>
                        </thead>
                        <tbody>
                          {row.items.map((item, idx) => (
                            <tr key={`${row.key}-${idx}`}>
                              <td>{item.dateLabel}</td>
                              <td>{item.kmFromLabel || ""}</td>
                              <td>{item.kmToLabel || ""}</td>
                              <td>{item.side || ""}</td>
                              <td>{item.unitLabel || row.unitLabel}</td>
                              <td className="stats-num">{item.length || ""}</td>
                              <td className="stats-num">{item.width || ""}</td>
                              <td className="stats-num">{item.height || ""}</td>
                              <td className="stats-num">
                                {formatStatsNumber(item.quantity)}{" "}
                                {item.unitLabel || row.unitLabel}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
