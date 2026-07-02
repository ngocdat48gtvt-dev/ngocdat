import { Fragment, useEffect, useRef, useState } from "react";
import { formatStatsNumber } from "../utils/volumeStatsFormat";

const COL_KEYS = [
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
  section: 128,
  work: 200,
  unit: 60,
  done: 96,
  contract: 96,
  remaining: 96,
  percent: 60,
  status: 140,
  action: 92
};

const MIN_WIDTHS = {
  section: 80,
  work: 120,
  unit: 48,
  done: 72,
  contract: 72,
  remaining: 72,
  percent: 48,
  status: 100,
  action: 72
};

const HEADERS = [
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

const STORAGE_KEY = "nhatky_stats_result_col_widths";

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
  StatusBadge
}) {
  const [colWidths, setColWidths] = useState(loadWidths);
  const resizeRef = useRef(null);

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
    <div className="stats-table-wrap stats-table-wrap--excel">
      <table
        className="stats-table stats-table--excel"
        style={{ width: tableWidth, minWidth: "100%" }}
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
                {label}
                {key !== "action" && (
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
            return (
              <Fragment key={row.key}>
                <tr
                  className={`stats-row stats-row--${row.status}${expanded ? " is-expanded" : ""}`}
                >
                  <td>{row.section}</td>
                  <td>
                    <strong>{row.workType}</strong>
                    <div className="stats-sub">{row.entryCount} dòng NK</div>
                  </td>
                  <td className="stats-td-center">{row.unitLabel}</td>
                  <td className="stats-num">{formatStatsNumber(row.totalDone)}</td>
                  <td className="stats-num">
                    {row.contractQty != null ? formatStatsNumber(row.contractQty) : "—"}
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
                      "—"
                    )}
                  </td>
                  <td className="stats-num">
                    {row.percent != null ? `${formatStatsNumber(row.percent)}%` : "—"}
                  </td>
                  <td className="stats-td-center">
                    <StatusBadge row={row} />
                  </td>
                  <td className="stats-td-center">
                    {row.items.length > 0 && (
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
                    <td colSpan={9}>
                      <table className="stats-detail-table">
                        <thead>
                          <tr>
                            <th>Ngày NK</th>
                            <th>Lý trình</th>
                            <th className="stats-num">Khối lượng</th>
                            <th>Đã xử lý</th>
                          </tr>
                        </thead>
                        <tbody>
                          {row.items.map((item, idx) => (
                            <tr key={`${row.key}-${idx}`}>
                              <td>{item.dateLabel}</td>
                              <td>{item.kmLabel || "—"}</td>
                              <td className="stats-num">
                                {formatStatsNumber(item.quantity)} {row.unitLabel}
                              </td>
                              <td>
                                {item.resolvedStatus === "co"
                                  ? "Có"
                                  : item.resolvedStatus === "chua"
                                    ? "Chưa"
                                    : "—"}
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
