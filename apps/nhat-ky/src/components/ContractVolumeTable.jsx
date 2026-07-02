import { useEffect, useMemo, useRef, useState } from "react";
import { SECTIONS } from "../utils/nhatKyFormat";
import {
  BAO_DUONG_QUALITY_EVENT,
  getTypesByGroup,
  listTypesForGroup
} from "../utils/baoDuongQualityStore";
import { normalizeWorkType } from "../utils/volumeStatsFormat";

const COL_KEYS = ["section", "work", "qty", "unit", "del"];
const DEFAULT_WIDTHS = {
  section: 140,
  work: 260,
  qty: 88,
  unit: 64,
  del: 36
};
const MIN_WIDTHS = {
  section: 80,
  work: 100,
  qty: 56,
  unit: 48,
  del: 32
};
const STORAGE_KEY = "nhatky_stats_contract_col_widths";

function loadWidths() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_WIDTHS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_WIDTHS, ...parsed };
  } catch {
    return { ...DEFAULT_WIDTHS };
  }
}

/** Re-render khi danh mục BDTX (loại công việc) thay đổi ở tab "Dữ liệu BDTX". */
function useCatalogVersion() {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const handler = () => setVersion((v) => v + 1);
    window.addEventListener(BAO_DUONG_QUALITY_EVENT, handler);
    return () => window.removeEventListener(BAO_DUONG_QUALITY_EVENT, handler);
  }, []);
  return version;
}

/**
 * Ô "Đầu việc" lấy theo danh mục loại công việc BDTX, lọc theo hạng mục đã chọn.
 * Combobox có ô gõ để tìm kiếm (không phân biệt dấu); panel dùng position: fixed
 * để không bị cắt bởi vùng cuộn của bảng.
 */
function WorkTypeSelect({ section, value, onChange, catalogVersion }) {
  const current = String(value || "").trim();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [rect, setRect] = useState(null);
  const controlRef = useRef(null);
  const panelRef = useRef(null);
  const inputRef = useRef(null);

  const flatTypes = useMemo(
    () => (section ? listTypesForGroup(section) : null),
    [section, catalogVersion]
  );
  const grouped = useMemo(
    () => (section ? null : getTypesByGroup()),
    [section, catalogVersion]
  );

  const knownTypes = flatTypes || Object.values(grouped || {}).flat();
  const hasCurrent = !current || knownTypes.includes(current);

  const nq = normalizeWorkType(query);
  const match = (t) => !nq || normalizeWorkType(t).includes(nq);
  const filteredFlat = flatTypes ? flatTypes.filter(match) : null;
  const filteredGroups = grouped
    ? Object.entries(grouped)
        .map(([g, types]) => [g, types.filter(match)])
        .filter(([, types]) => types.length > 0)
    : null;
  const noResult =
    (filteredFlat && filteredFlat.length === 0) ||
    (filteredGroups && filteredGroups.length === 0);

  useEffect(() => {
    if (!open) return undefined;
    const updateRect = () => {
      const el = controlRef.current;
      if (el) setRect(el.getBoundingClientRect());
    };
    updateRect();
    const onDown = (e) => {
      if (controlRef.current?.contains(e.target)) return;
      if (panelRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("scroll", updateRect, true);
    window.addEventListener("resize", updateRect);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    const focusId = setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("resize", updateRect);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      clearTimeout(focusId);
    };
  }, [open]);

  function choose(val) {
    onChange(val);
    setQuery("");
    setOpen(false);
  }

  function renderItem(t) {
    return (
      <button
        key={t}
        type="button"
        className={`stats-contract-combo-item${t === current ? " is-active" : ""}`}
        title={t}
        onClick={() => choose(t)}
      >
        {t}
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        ref={controlRef}
        className="stats-contract-cell-input stats-contract-combo-control"
        title={current || "Chọn đầu việc theo danh mục"}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={current ? "" : "stats-contract-combo-placeholder"}>
          {current || "—"}
        </span>
        <span className="stats-contract-combo-caret" aria-hidden="true">
          ▾
        </span>
      </button>

      {open && rect && (
        <div
          ref={panelRef}
          className="stats-contract-combo-panel"
          style={{
            top: rect.bottom + 2,
            left: rect.left,
            width: Math.max(rect.width, 240)
          }}
        >
          <div className="stats-contract-combo-search">
            <input
              ref={inputRef}
              type="text"
              className="stats-contract-combo-search-input"
              placeholder="Gõ để tìm đầu việc…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="stats-contract-combo-list">
            <button
              type="button"
              className={`stats-contract-combo-item${current ? "" : " is-active"}`}
              onClick={() => choose("")}
            >
              —
            </button>
            {!hasCurrent && current && (
              <button
                type="button"
                className="stats-contract-combo-item is-active"
                onClick={() => choose(current)}
              >
                {current}
                <span className="stats-contract-combo-tag"> (tự nhập)</span>
              </button>
            )}
            {filteredFlat
              ? filteredFlat.map(renderItem)
              : filteredGroups.map(([group, types]) => (
                  <div key={group} className="stats-contract-combo-group">
                    <div className="stats-contract-combo-group-label">{group}</div>
                    {types.map(renderItem)}
                  </div>
                ))}
            {noResult && (
              <div className="stats-contract-combo-empty">Không có kết quả</div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default function ContractVolumeTable({ rows, onUpdate, onRemove }) {
  const [colWidths, setColWidths] = useState(loadWidths);
  const resizeRef = useRef(null);
  const catalogVersion = useCatalogVersion();

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

  const tableWidth =
    colWidths.section + colWidths.work + colWidths.qty + colWidths.unit + colWidths.del;

  return (
    <div className="stats-contract-table-wrap stats-contract-table-wrap--excel">
      <table
        className="stats-contract-table stats-contract-table--excel"
        style={{ width: tableWidth, minWidth: "100%" }}
      >
        <colgroup>
          {COL_KEYS.map((key) => (
            <col key={key} style={{ width: colWidths[key] }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {[
              ["section", "Hạng mục"],
              ["work", "Đầu việc"],
              ["qty", "KL HĐ"],
              ["unit", "ĐVT"],
              ["del", ""]
            ].map(([key, label]) => (
              <th key={key} className={`stats-contract-th stats-contract-th--${key}`}>
                {label}
                {key !== "del" && (
                  <span
                    className="stats-contract-resize-handle"
                    onMouseDown={(e) => startResize(key, e)}
                    title="Kéo để đổi độ rộng cột"
                  />
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <select
                  className="stats-contract-cell-input stats-contract-cell-input--select"
                  value={row.section}
                  title={row.section || "Chọn hạng mục"}
                  onChange={(e) => onUpdate(row.id, { section: e.target.value })}
                >
                  <option value="">—</option>
                  {SECTIONS.map((s) => (
                    <option key={s.key} value={s.title} title={s.title}>
                      {s.num}. {s.title}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <WorkTypeSelect
                  section={row.section}
                  value={row.workType}
                  catalogVersion={catalogVersion}
                  onChange={(value) => onUpdate(row.id, { workType: value })}
                />
              </td>
              <td>
                <input
                  type="number"
                  min="0"
                  step="any"
                  className="stats-contract-cell-input stats-contract-cell-input--num"
                  placeholder="0"
                  value={row.contractQty}
                  onChange={(e) => onUpdate(row.id, { contractQty: e.target.value })}
                />
              </td>
              <td>
                <select
                  className="stats-contract-cell-input stats-contract-cell-input--select stats-contract-cell-input--unit"
                  value={row.unit}
                  onChange={(e) => onUpdate(row.id, { unit: e.target.value })}
                >
                  <option value="m3">m³</option>
                  <option value="m2">m²</option>
                  <option value="m">m</option>
                </select>
              </td>
              <td className="stats-contract-td-del">
                <button
                  type="button"
                  className="stats-remove-btn stats-remove-btn--table"
                  title="Xóa dòng HĐ"
                  onClick={() => onRemove(row.id)}
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
