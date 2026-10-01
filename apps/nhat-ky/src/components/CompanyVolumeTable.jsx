import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  formatCompanyPercent,
  companyContractKey
} from "../utils/companyVolumeStats";
import { formatStatsNumber } from "../utils/volumeStatsFormat";
import { BAO_DUONG_GROUPS } from "../utils/baoDuongQualityStore";
import { toRomanUpper } from "../utils/roadsCatalog";

const COL_KEYS = [
  "pick",
  "stt",
  "hat",
  "road",
  "user",
  "work",
  "unit",
  "done",
  "contract",
  "remain",
  "pct",
  "status"
];

const DEFAULT_WIDTHS = {
  pick: 32,
  stt: 30,
  hat: 48,
  road: 150,
  user: 100,
  work: 160,
  unit: 44,
  done: 58,
  contract: 70,
  remain: 64,
  pct: 42,
  status: 78
};

const MIN_WIDTHS = {
  pick: 28,
  stt: 24,
  hat: 36,
  road: 80,
  user: 64,
  work: 90,
  unit: 34,
  done: 44,
  contract: 48,
  remain: 48,
  pct: 34,
  status: 56
};

const HEADERS = [
  ["pick", "", false],
  ["stt", "STT", true],
  ["hat", "Tuần đường", false],
  ["road", "Đường", false],
  ["user", "USER", false],
  ["work", "Đầu việc", false],
  ["unit", "ĐVT", true],
  ["done", "Đã làm", true],
  ["contract", "Hợp đồng", true],
  ["remain", "Còn thiếu", true],
  ["pct", "%", true],
  ["status", "Trạng thái", false]
];

const STORAGE_KEY = "nhatky_company_stats_col_widths_v5";

/** Gom đầu việc theo hạng mục — tiêu đề I. Mặt đường, II. Nền đường… */
export function buildCompanySectionBlocks(rows) {
  const bySection = new Map();
  for (const r of rows || []) {
    const sec = String(r.section || "").trim() || "Khác";
    if (!bySection.has(sec)) bySection.set(sec, []);
    bySection.get(sec).push(r);
  }

  const ordered = [];
  for (const g of BAO_DUONG_GROUPS) {
    if (bySection.has(g)) ordered.push(g);
  }
  for (const g of bySection.keys()) {
    if (!ordered.includes(g)) ordered.push(g);
  }

  return ordered.map((section, i) => ({
    section,
    roman: toRomanUpper(i + 1),
    label: `${toRomanUpper(i + 1)}. ${section}`,
    rows: bySection.get(section) || []
  }));
}

function loadWidths() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_WIDTHS };
    return { ...DEFAULT_WIDTHS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_WIDTHS };
  }
}

function looksLikeRawRoadId(value) {
  return /^road_[a-z0-9_]+$/i.test(String(value || "").trim());
}

function roadLabel(row) {
  const name = looksLikeRawRoadId(row.roadName) ? "Sổ chưa đặt tên" : row.roadName || "";
  const km = String(row.kmRange || "").trim();
  if (name && km) return `${name} ${km}`;
  return name || km || "—";
}

function statusText(row) {
  if (row.status === "ok") return "Đủ HĐ";
  if (row.status === "short") return `Thiếu ${formatStatsNumber(row.remaining)}`;
  if (row.status === "pending") return "Chưa làm";
  return "Chưa HĐ";
}

export default function CompanyVolumeTable({
  rows,
  onContractChange,
  editable = true,
  selectedKeys = [],
  onToggleSelect,
  onToggleSelectAll
}) {
  const [colWidths, setColWidths] = useState(loadWidths);
  const [drafts, setDrafts] = useState({});
  const resizeRef = useRef(null);

  const sectionBlocks = useMemo(() => buildCompanySectionBlocks(rows), [rows]);

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

  function draftValue(row) {
    const key = row.contractKey || companyContractKey(row);
    if (Object.prototype.hasOwnProperty.call(drafts, key)) return drafts[key];
    return row.contractInput ?? "";
  }

  function commitContract(row) {
    const key = row.contractKey || companyContractKey(row);
    const value = Object.prototype.hasOwnProperty.call(drafts, key)
      ? drafts[key]
      : row.contractInput ?? "";
    onContractChange?.(key, value);
    setDrafts((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, key)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  const tableWidth = COL_KEYS.reduce((sum, key) => sum + colWidths[key], 0);
  const colSpan = COL_KEYS.length;

  return (
    <div className="stats-company-table-wrap">
      <table
        className="stats-company-table stats-company-table--excel"
        style={{ width: tableWidth }}
      >
        <colgroup>
          {COL_KEYS.map((key) => (
            <col key={key} style={{ width: colWidths[key] }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {HEADERS.map(([key, label, isNum]) => (
              <th key={key} className={isNum ? "num" : key === "pick" ? "center" : undefined}>
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
                {key !== "pick" && (
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
          {sectionBlocks.map((block) => (
            <Fragment key={`sec-${block.section}`}>
              <tr className="stats-company-section-row">
                <td colSpan={colSpan}>
                  <span className="stats-company-section-label">{block.label}</span>
                </td>
              </tr>
              {block.rows.map((r, i) => {
                const key = r.contractKey || companyContractKey(r);
                const canPick = r.items?.length > 0;
                const picked = selectedSet.has(r.key);
                return (
                  <tr
                    key={r.key}
                    className={`${r.contractFromReport ? "is-hd-report" : ""}${picked ? " is-picked" : ""}`}
                  >
                    <td className="center">
                      {canPick && (
                        <input
                          type="checkbox"
                          className="stats-pick-check"
                          checked={picked}
                          onChange={() => onToggleSelect?.(r.key)}
                          title="Chọn để xem / xuất chi tiết"
                          aria-label={`Chọn ${r.workType}`}
                        />
                      )}
                    </td>
                    <td className="num">{i + 1}</td>
                    <td>{r.hat}</td>
                    <td title={roadLabel(r)}>{roadLabel(r)}</td>
                    <td title={r.userName}>{r.userName}</td>
                    <td>{r.workType}</td>
                    <td className="center">{r.unitLabel || r.unit}</td>
                    <td className="num">{formatStatsNumber(r.totalDone)}</td>
                    <td className="num stats-company-td-contract">
                      {editable ? (
                        <input
                          type="text"
                          inputMode="decimal"
                          className="stats-company-hd-input"
                          value={draftValue(r)}
                          placeholder="—"
                          title={
                            r.contractFromReport
                              ? "HĐ nhập trên Báo cáo"
                              : "HĐ từ sổ USER — sửa để ghi đè trên Báo cáo"
                          }
                          onChange={(e) => {
                            const v = e.target.value;
                            setDrafts((prev) => ({ ...prev, [key]: v }));
                          }}
                          onBlur={() => commitContract(r)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.currentTarget.blur();
                          }}
                        />
                      ) : r.contractQty != null ? (
                        formatStatsNumber(r.contractQty)
                      ) : (
                        ""
                      )}
                    </td>
                    <td className="num">
                      {r.remaining != null ? formatStatsNumber(r.remaining) : ""}
                    </td>
                    <td className="num">{formatCompanyPercent(r.percent)}</td>
                    <td>{statusText(r)}</td>
                  </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
