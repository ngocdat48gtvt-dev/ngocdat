import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useOfficePermissions } from "../hooks/useOfficePermissions";
import PasswordConfirmModal from "../components/PasswordConfirmModal";
import {
  getCatalogOwnerUid
} from "../services/masterDataService";
import {
  loadQualityCatalog,
  saveQualityCatalog,
  resetQualityCatalog,
  getQualityCatalogOverrides,
  withDeletedCatalogTombstones,
  isQualityTypeHidden,
  BAO_DUONG_QUALITY_EVENT,
  DEFAULT_QUALITY_FALLBACK,
  BAO_DUONG_GROUPS,
  BAO_DUONG_UNITS,
  DEFAULT_DEADLINE_DAYS,
  normalizeBaoDuongGroup,
  setQualityCatalogOwnerUid
} from "../utils/baoDuongQualityStore";
import { saveDataNoiNghiep } from "../services/dataNoiNghiepService";

import SidebarResizer from "../components/SidebarResizer";
import { useResizableSidebar } from "../hooks/useResizableSidebar";

const COLWIDTH_KEY = "danhmuc-bd-colwidths-v1";
const MIN_COL_WIDTH = 48;

/** Định nghĩa cột bảng danh mục (id, nhãn, bề rộng mặc định, có cho kéo chỉnh). */
const COL_DEFS = [
  { id: "stt", label: "STT", width: 44, fixed: true },
  { id: "inspection", label: "Công việc tuần đường", width: 240 },
  { id: "maintenance", label: "Công việc BDTX", width: 220 },
  { id: "unit", label: "Đơn vị", width: 80 },
  { id: "method", label: "Tóm tắt biện pháp thực hiện (cột 4)", width: 380 },
  { id: "result", label: "Nhận xét kết quả chủ yếu (cột 5)", width: 380 },
  { id: "actions", label: "", width: 60, fixed: true }
];

const ROMAN_NUMERALS = [
  "I",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
  "XI",
  "XII"
];

function toRomanNumeral(n) {
  return ROMAN_NUMERALS[n - 1] || String(n);
}

/** Gom dòng theo nhóm công việc — mục lục lớn + STT trong nhóm. */
function buildTableBlocks(visibleRows) {
  const byGroup = new Map();
  visibleRows.forEach((item) => {
    const g = normalizeBaoDuongGroup(item.row.group || "");
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g).push({ ...item, row: { ...item.row, group: g } });
  });

  const orderedGroups = [];
  BAO_DUONG_GROUPS.forEach((g) => {
    if (byGroup.get(g)?.length) orderedGroups.push(g);
  });
  // Nhóm lạ (sau alias) vẫn hiện cuối, tránh mất dòng master data.
  byGroup.forEach((_, g) => {
    if (g && !BAO_DUONG_GROUPS.includes(g) && !orderedGroups.includes(g)) {
      orderedGroups.push(g);
    }
  });
  if (byGroup.get("")?.length) orderedGroups.push("");

  const blocks = [];
  orderedGroups.forEach((groupKey, sectionIndex) => {
    const label = groupKey || "Chưa phân nhóm";
    blocks.push({
      kind: "section",
      key: `section-${groupKey || "none"}`,
      label,
      roman: toRomanNumeral(sectionIndex + 1)
    });
    byGroup.get(groupKey).forEach((item, i) => {
      blocks.push({
        kind: "row",
        key: item.row._rid,
        row: item.row,
        idx: item.idx,
        groupKey,
        numInGroup: i + 1
      });
    });
  });
  return blocks;
}

function loadColWidths() {
  const out = {};
  COL_DEFS.forEach((c) => {
    out[c.id] = c.width;
  });
  try {
    const saved = JSON.parse(localStorage.getItem(COLWIDTH_KEY));
    if (saved && typeof saved === "object") {
      COL_DEFS.forEach((c) => {
        const w = Number(saved[c.id]);
        if (Number.isFinite(w) && w >= MIN_COL_WIDTH) out[c.id] = w;
      });
    }
  } catch {
    /* dùng mặc định */
  }
  return out;
}

let ridSeq = 0;
function nextRid() {
  ridSeq += 1;
  return `rid_${ridSeq}`;
}

function catalogToRows(catalog, extraTypes = []) {
  const rows = Object.entries(catalog).map(([type, val]) => ({
    _rid: nextRid(),
    type,
    maintenanceName: val.maintenanceName || "",
    group: val.group || "",
    unit: val.unit || "",
    isNeedMaintenance: val.isNeedMaintenance !== false,
    deadlineDays:
      val.deadlineDays === undefined || val.deadlineDays === null
        ? DEFAULT_DEADLINE_DAYS
        : val.deadlineDays,
    priority: val.priority || "MEDIUM",
    method: val.method || "",
    result: val.result || "",
    sortOrder: val.sortOrder ?? 0,
    isActive: val.isActive !== false
  }));
  const known = new Set(rows.map((r) => r.type));
  extraTypes.forEach((t) => {
    const key = String(t || "").trim();
    if (key && !known.has(key) && !isQualityTypeHidden(key)) {
      rows.push({
        _rid: nextRid(),
        type: key,
        maintenanceName: "",
        group: "",
        unit: "",
        isNeedMaintenance: true,
        deadlineDays: DEFAULT_DEADLINE_DAYS,
        priority: "MEDIUM",
        method: "",
        result: "",
        sortOrder: 0,
        isActive: true
      });
      known.add(key);
    }
  });
  return rows.sort((a, b) => {
    const ga = a.group || "zzz";
    const gb = b.group || "zzz";
    if (ga !== gb) return ga.localeCompare(gb, "vi");
    const sa = a.sortOrder ?? 0;
    const sb = b.sortOrder ?? 0;
    if (sa !== sb) return sa - sb;
    return a.type.localeCompare(b.type, "vi");
  });
}

/** Đổi thứ tự 2 dòng trong cùng nhóm công việc. */
function reorderRowWithinGroup(rows, fromIdx, toIdx) {
  if (fromIdx === toIdx) return rows;
  const groupKey = rows[fromIdx]?.group ?? "";
  if (groupKey !== (rows[toIdx]?.group ?? "")) return rows;

  const byGroup = new Map();
  rows.forEach((r) => {
    const key = r.group || "";
    if (!byGroup.has(key)) byGroup.set(key, []);
    byGroup.get(key).push(r);
  });

  const groupList = byGroup.get(groupKey) || [];
  const fromRid = rows[fromIdx]._rid;
  const toRid = rows[toIdx]._rid;
  const fromLocal = groupList.findIndex((r) => r._rid === fromRid);
  const toLocal = groupList.findIndex((r) => r._rid === toRid);
  if (fromLocal < 0 || toLocal < 0) return rows;

  const nextGroup = [...groupList];
  const [moved] = nextGroup.splice(fromLocal, 1);
  nextGroup.splice(toLocal, 0, moved);
  const nextGroupWithOrder = nextGroup.map((r, i) => ({ ...r, sortOrder: i }));
  byGroup.set(groupKey, nextGroupWithOrder);

  const ordered = [];
  BAO_DUONG_GROUPS.forEach((gk) => {
    if (byGroup.get(gk)?.length) ordered.push(...byGroup.get(gk));
  });
  if (byGroup.get("")?.length) ordered.push(...byGroup.get(""));

  return ordered;
}

export default function DanhMucBaoDuong() {
  const { sidebarStyle, onResizeStart } = useResizableSidebar({ defaultWidth: 260 });
  const { profile } = useAuth();
  const { canEditMasterData } = useOfficePermissions();
  const canEditCatalog = canEditMasterData;
  const catalogOwnerUid = getCatalogOwnerUid(profile);
  if (catalogOwnerUid) setQualityCatalogOwnerUid(catalogOwnerUid);
  const [rows, setRows] = useState(() => catalogToRows(loadQualityCatalog()));
  const [newType, setNewType] = useState("");
  const [newGroup, setNewGroup] = useState(BAO_DUONG_GROUPS[0]);
  const [groupFilter, setGroupFilter] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [colWidths, setColWidths] = useState(loadColWidths);
  const [dragIdx, setDragIdx] = useState(null);
  const [dropIdx, setDropIdx] = useState(null);
  const resizingRef = useRef(false);

  function startColResize(e, id) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = colWidths[id] || MIN_COL_WIDTH;
    resizingRef.current = true;
    const onMove = (ev) => {
      const w = Math.max(MIN_COL_WIDTH, startW + (ev.clientX - startX));
      setColWidths((prev) => ({ ...prev, [id]: w }));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.classList.remove("col-resizing");
      resizingRef.current = false;
      setColWidths((prev) => {
        try {
          localStorage.setItem(COLWIDTH_KEY, JSON.stringify(prev));
        } catch {
          /* bỏ qua nếu không lưu được */
        }
        return prev;
      });
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    document.body.classList.add("col-resizing");
  }

  const tableWidth = useMemo(
    () => COL_DEFS.reduce((sum, c) => sum + (colWidths[c.id] || c.width), 0),
    [colWidths]
  );

  useEffect(() => {
    if (!catalogOwnerUid) return;
    setQualityCatalogOwnerUid(catalogOwnerUid);
    setRows(catalogToRows(loadQualityCatalog()));
  }, [catalogOwnerUid]);

  // Không trộn thêm types từ master_data/types (app sự cố) vào bảng MASTER DATA —
  // nguồn đúng là data_noi_nghiep (đã sync qua BAO_DUONG_QUALITY_EVENT).

  useEffect(() => {
    const onChange = () => setRows(catalogToRows(loadQualityCatalog()));
    window.addEventListener(BAO_DUONG_QUALITY_EVENT, onChange);
    return () => window.removeEventListener(BAO_DUONG_QUALITY_EVENT, onChange);
  }, []);

  const filledCount = useMemo(
    () => rows.filter((r) => r.method.trim() || r.result.trim()).length,
    [rows]
  );

  const visibleRows = useMemo(() => {
    if (!groupFilter) return rows.map((r, i) => ({ row: r, idx: i }));
    return rows
      .map((r, i) => ({ row: r, idx: i }))
      .filter(({ row }) => row.group === groupFilter);
  }, [rows, groupFilter]);

  const tableBlocks = useMemo(() => buildTableBlocks(visibleRows), [visibleRows]);

  function updateRow(index, field, value) {
    if (!canEditCatalog) return;
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
    setMessage("");
  }

  function addType() {
    if (!canEditCatalog) return;
    const key = newType.trim();
    if (!key) return;
    if (rows.some((r) => r.type === key)) {
      setMessage(`Loại "${key}" đã có trong danh mục.`);
      return;
    }
    setRows((prev) => [
      {
        _rid: nextRid(),
        type: key,
        maintenanceName: "",
        group: newGroup,
        unit: "",
        isNeedMaintenance: true,
        deadlineDays: DEFAULT_DEADLINE_DAYS,
        priority: "MEDIUM",
        method: "",
        result: "",
        sortOrder: 0,
        isActive: true
      },
      ...prev
    ]);
    setNewType("");
    setMessage(
      `Đã thêm loại "${key}" (nhóm ${newGroup}). Nhập biện pháp, nhận xét rồi bấm Lưu danh mục.`
    );
  }

  function deleteRow(index) {
    if (!canEditCatalog) return;
    setRows((prev) => prev.filter((_, i) => i !== index));
    setMessage("");
  }

  function handleRowDragStart(e, idx) {
    if (!canEditCatalog) return;
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(idx));
  }

  function handleRowDragOver(e, idx) {
    if (!canEditCatalog || dragIdx == null || dragIdx === idx) return;
    if ((rows[dragIdx]?.group || "") !== (rows[idx]?.group || "")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropIdx(idx);
  }

  function handleRowDrop(e, idx) {
    e.preventDefault();
    if (dragIdx == null || dragIdx === idx) {
      setDragIdx(null);
      setDropIdx(null);
      return;
    }
    setRows((prev) => reorderRowWithinGroup(prev, dragIdx, idx));
    setDragIdx(null);
    setDropIdx(null);
    setMessage("Đã đổi thứ tự trong nhóm. Bấm Lưu danh mục để ghi lại.");
  }

  function handleRowDragEnd() {
    setDragIdx(null);
    setDropIdx(null);
  }

  async function handleSave() {
    if (!canEditCatalog || saving) return;
    setSaving(true);
    setMessage("");
    try {
      const ownerUid = getCatalogOwnerUid(profile);
      if (ownerUid) setQualityCatalogOwnerUid(ownerUid);

      const catalog = {};
      const groupOrder = {};
      rows.forEach((r) => {
        const type = (r.type || "").trim();
        if (!type) return;
        const groupKey = (r.group || "").trim() || "_";
        if (!groupOrder[groupKey]) groupOrder[groupKey] = 0;
        const deadlineRaw = Number(r.deadlineDays);
        catalog[type] = {
          group: (r.group || "").trim(),
          unit: (r.unit || "").trim(),
          maintenanceName: (r.maintenanceName || "").trim(),
          method: (r.method || "").trim(),
          result: (r.result || "").trim(),
          priority: (r.priority || "MEDIUM").trim().toUpperCase(),
          deadlineDays: Number.isFinite(deadlineRaw) ? deadlineRaw : DEFAULT_DEADLINE_DAYS,
          isNeedMaintenance: r.isNeedMaintenance !== false,
          isActive: r.isActive !== false,
          sortOrder: groupOrder[groupKey]++
        };
      });
      const activeTypes = rows.map((r) => (r.type || "").trim()).filter(Boolean);
      saveQualityCatalog(withDeletedCatalogTombstones(catalog, activeTypes));
      try {
        await saveDataNoiNghiep(ownerUid, getQualityCatalogOverrides());
        setMessage("✓ Đã lưu danh mục thành công và đồng bộ lên cloud.");
      } catch {
        setMessage("✓ Đã lưu trên máy (chưa đồng bộ cloud).");
      }
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(""), 5000);
    }
  }

  function handleReset() {
    if (!canEditCatalog || saving) return;
    setResetConfirmOpen(true);
  }

  async function confirmResetCatalog() {
    setMessage("");
    resetQualityCatalog();
    setRows(catalogToRows(loadQualityCatalog()));
    const ownerUid = getCatalogOwnerUid(profile);
    try {
      await saveDataNoiNghiep(ownerUid, {});
      setMessage("✓ Đã khôi phục danh mục mặc định và đồng bộ lên cloud.");
    } catch {
      setMessage("✓ Đã khôi phục trên máy nhưng chưa đồng bộ lên cloud.");
    }
    setResetConfirmOpen(false);
    setTimeout(() => setMessage(""), 5000);
  }

  return (
    <div className="nhaplieu-workspace sonhatky-workspace">
      <aside
        className="nhaplieu-sidebar sonhatky-sidebar"
        style={sidebarStyle}
      >
        <div className="sidebar-sticky-head">
          <h2 className="sidebar-title">DANH MỤC CÔNG VIỆC</h2>
          <p className="sonhatky-day-summary">Dữ liệu chuẩn hệ thống · BDTX</p>
          <p className="sonhatky-day-summary">
            {rows.length} loại công việc · {filledCount} đã có nhận xét
          </p>
          <p className="sidebar-subtitle">
            Khai báo <strong>biện pháp thực hiện</strong> và <strong>nhận xét kết quả</strong>{" "}
            chuẩn cho từng loại công việc. Khi công việc đó xuất hiện trong sổ BDTX, hệ
            thống tự điền (nếu chưa nhập tay).
          </p>
          {!canEditCatalog && (
            <p className="section-guide danhmuc-bd-readonly-hint">
              Chế độ chỉ xem. Chỉ tài khoản <strong>ADMIN</strong> được thêm, sửa hoặc xóa danh mục công việc.
            </p>
          )}
          {canEditCatalog && (
            <p className="section-guide danhmuc-bd-dnd-hint">
              Kéo biểu tượng <strong>⠿</strong> ở cột STT để đổi thứ tự trong cùng nhóm.
            </p>
          )}
          <label className="sidebar-field">
            <span className="sidebar-field-label">Lọc theo nhóm công việc</span>
            <select
              className="sidebar-input"
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
            >
              <option value="">Tất cả nhóm</option>
              {BAO_DUONG_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
          {canEditCatalog && (
            <div className="danhmuc-bd-actions">
              <button
                type="button"
                className="btn-primary"
                disabled={saving}
                onClick={() => void handleSave()}
              >
                {saving ? "Đang lưu…" : "Lưu danh mục"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={saving}
                onClick={handleReset}
              >
                Khôi phục mặc định
              </button>
              {message ? <p className="save-ok danhmuc-bd-flash">{message}</p> : null}
            </div>
          )}
          {!canEditCatalog && message ? (
            <p className="save-ok danhmuc-bd-flash">{message}</p>
          ) : null}
        </div>
      </aside>

      <SidebarResizer onMouseDown={onResizeStart} />

      <main className="nhaplieu-review-pane">
        <div className={`danhmuc-bd-pane${canEditCatalog ? "" : " danhmuc-bd-pane--readonly"}`}>
          {canEditCatalog && (
          <div className="danhmuc-bd-add">
            <select
              value={newGroup}
              onChange={(e) => setNewGroup(e.target.value)}
              className="sidebar-input danhmuc-bd-add-group"
              title="Nhóm công việc"
            >
              {BAO_DUONG_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addType();
              }}
              placeholder="Thêm loại công việc mới (VD: Vệ sinh mặt đường)"
              className="sidebar-input danhmuc-bd-add-input"
            />
            <button type="button" className="btn-secondary" onClick={addType}>
              + Thêm loại
            </button>
          </div>
          )}

          <div className="danhmuc-bd-scroll">
          <table className="danhmuc-bd-table" style={{ width: tableWidth, minWidth: tableWidth }}>
            <colgroup>
              {COL_DEFS.map((c) => (
                <col key={c.id} style={{ width: colWidths[c.id] || c.width }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {COL_DEFS.map((c) => (
                  <th key={c.id}>
                    {c.label}
                    {!c.fixed && (
                      <span
                        className="danhmuc-bd-col-resizer"
                        onMouseDown={(e) => startColResize(e, c.id)}
                        title="Kéo để chỉnh bề rộng cột"
                      />
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableBlocks.map((block) => {
                if (block.kind === "section") {
                  return (
                    <tr key={block.key} className="danhmuc-bd-section-row">
                      <td colSpan={COL_DEFS.length}>
                        <span className="danhmuc-bd-section-label">
                          {block.roman}. {block.label}
                        </span>
                      </td>
                    </tr>
                  );
                }

                const { row, idx, numInGroup } = block;
                const isDragging = dragIdx === idx;
                const isDropTarget = dropIdx === idx && dragIdx !== idx;
                return (
                <tr
                  key={block.key}
                  className={`danhmuc-bd-data-row${isDragging ? " danhmuc-bd-row--dragging" : ""}${isDropTarget ? " danhmuc-bd-row--drop-target" : ""}`}
                  onDragOver={(e) => handleRowDragOver(e, idx)}
                  onDrop={(e) => handleRowDrop(e, idx)}
                  onDragEnd={handleRowDragEnd}
                >
                  <td className="danhmuc-bd-stt">
                    {canEditCatalog ? (
                      <span
                        className="danhmuc-bd-drag-handle"
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation();
                          handleRowDragStart(e, idx);
                        }}
                        title="Kéo để đổi thứ tự trong nhóm"
                        aria-label="Kéo để đổi thứ tự"
                      >
                        ⠿
                      </span>
                    ) : null}
                    <span className="danhmuc-bd-stt-num">{numInGroup}</span>
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.type}
                      readOnly={!canEditCatalog}
                      onChange={(e) => updateRow(idx, "type", e.target.value)}
                      className="danhmuc-bd-input"
                      placeholder="Hiện trạng phát hiện"
                      title="Công việc tuần đường (hiện trạng phát hiện)"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.maintenanceName}
                      readOnly={!canEditCatalog}
                      onChange={(e) => updateRow(idx, "maintenanceName", e.target.value)}
                      className="danhmuc-bd-input"
                      placeholder="Công việc xử lý (BDTX)"
                      title="Công việc bảo dưỡng thường xuyên"
                    />
                  </td>
                  <td>
                    <select
                      value={row.unit || ""}
                      disabled={!canEditCatalog}
                      onChange={(e) => updateRow(idx, "unit", e.target.value)}
                      className="danhmuc-bd-input danhmuc-bd-unit-select"
                      title="Đơn vị tính"
                    >
                      <option value="">—</option>
                      {BAO_DUONG_UNITS.map((u) => (
                        <option key={u.value} value={u.value}>
                          {u.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <textarea
                      value={row.method}
                      readOnly={!canEditCatalog}
                      onChange={(e) => updateRow(idx, "method", e.target.value)}
                      className="danhmuc-bd-input"
                      rows={2}
                      placeholder={DEFAULT_QUALITY_FALLBACK.method}
                    />
                  </td>
                  <td>
                    <textarea
                      value={row.result}
                      readOnly={!canEditCatalog}
                      onChange={(e) => updateRow(idx, "result", e.target.value)}
                      className="danhmuc-bd-input"
                      rows={2}
                      placeholder={DEFAULT_QUALITY_FALLBACK.result}
                    />
                  </td>
                  <td>
                    {canEditCatalog ? (
                    <button
                      type="button"
                      className="danhmuc-bd-del"
                      onClick={() => deleteRow(idx)}
                      title="Xoá loại này"
                    >
                      Xoá
                    </button>
                    ) : null}
                  </td>
                </tr>
                );
              })}
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={COL_DEFS.length} className="danhmuc-bd-empty">
                    {groupFilter
                      ? `Chưa có loại công việc nào thuộc nhóm "${groupFilter}".`
                      : "Chưa có loại công việc nào. Thêm loại ở ô phía trên."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      </main>

      <PasswordConfirmModal
        open={resetConfirmOpen}
        title="Khôi phục mặc định — nhập mật khẩu"
        description={
          "Bạn sắp khôi phục MASTER DATA về mặc định.\n\nToàn bộ nội dung đã chỉnh (biện pháp, nhận xét, loại tự thêm…) sẽ bị xoá và không hoàn tác được. Nhập mật khẩu ADMIN để xác nhận."
        }
        confirmLabel="Khôi phục mặc định"
        onCancel={() => setResetConfirmOpen(false)}
        onConfirmed={() => confirmResetCatalog()}
      />
    </div>
  );
}
