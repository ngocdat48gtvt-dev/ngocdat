import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  fetchMatDuongIncidentTypes,
  getCatalogOwnerUid
} from "../services/masterDataService";
import {
  loadQualityCatalog,
  saveQualityCatalog,
  resetQualityCatalog,
  DEFAULT_QUALITY_FALLBACK,
  BAO_DUONG_GROUPS,
  BAO_DUONG_UNITS,
  DEFAULT_DEADLINE_DAYS
} from "../utils/baoDuongQualityStore";

const SIDEBAR_WIDTH = 260;

const COLWIDTH_KEY = "danhmuc-bd-colwidths-v1";
const MIN_COL_WIDTH = 48;

/** Định nghĩa cột bảng danh mục (id, nhãn, bề rộng mặc định, có cho kéo chỉnh). */
const COL_DEFS = [
  { id: "stt", label: "STT", width: 44, fixed: true },
  { id: "inspection", label: "Công việc tuần đường", width: 210 },
  { id: "maintenance", label: "Công việc BDTX", width: 210 },
  { id: "group", label: "Nhóm công việc", width: 160 },
  { id: "unit", label: "Đơn vị", width: 80 },
  { id: "method", label: "Tóm tắt biện pháp thực hiện (cột 4)", width: 360 },
  { id: "result", label: "Nhận xét kết quả chủ yếu (cột 5)", width: 360 },
  { id: "actions", label: "", width: 60, fixed: true }
];

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
    if (key && !known.has(key)) {
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

export default function DanhMucBaoDuong() {
  const { profile } = useAuth();
  const [rows, setRows] = useState(() => catalogToRows(loadQualityCatalog()));
  const [newType, setNewType] = useState("");
  const [newGroup, setNewGroup] = useState(BAO_DUONG_GROUPS[0]);
  const [groupFilter, setGroupFilter] = useState("");
  const [message, setMessage] = useState("");
  const [colWidths, setColWidths] = useState(loadColWidths);
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
    const ownerUid = getCatalogOwnerUid(profile);
    if (!ownerUid) return;
    let cancelled = false;
    fetchMatDuongIncidentTypes(ownerUid).then((types) => {
      if (cancelled || !types.length) return;
      setRows((prev) => {
        const map = Object.fromEntries(prev.map((r) => [r.type, r]));
        const catalog = Object.fromEntries(prev.map((r) => [r.type, r]));
        return catalogToRows(catalog, types).map((r) => map[r.type] || r);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [profile?.uid, profile?.catalogOwnerUid, profile?.role]);

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

  function updateRow(index, field, value) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
    setMessage("");
  }

  function addType() {
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
    setRows((prev) => prev.filter((_, i) => i !== index));
    setMessage("");
  }

  function handleSave() {
    const catalog = {};
    let order = 0;
    rows.forEach((r) => {
      const type = (r.type || "").trim();
      if (!type) return;
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
        sortOrder: order++
      };
    });
    saveQualityCatalog(catalog);
    setMessage("Đã lưu danh mục. Sổ BDTX và form nhập liệu sẽ tự dùng nội dung này.");
    setTimeout(() => setMessage(""), 3500);
  }

  function handleReset() {
    if (!window.confirm("Khôi phục danh mục mặc định? Nội dung tự chỉnh sẽ bị xoá.")) {
      return;
    }
    resetQualityCatalog();
    setRows(catalogToRows(loadQualityCatalog()));
    setMessage("Đã khôi phục danh mục mặc định.");
    setTimeout(() => setMessage(""), 3500);
  }

  return (
    <div className="nhaplieu-workspace sonhatky-workspace">
      <aside
        className="nhaplieu-sidebar sonhatky-sidebar"
        style={{ width: SIDEBAR_WIDTH, minWidth: SIDEBAR_WIDTH, maxWidth: SIDEBAR_WIDTH }}
      >
        <div className="sidebar-sticky-head">
          <h2 className="sidebar-title">Dữ liệu BDTX</h2>
          <p className="sonhatky-day-summary">
            {rows.length} loại công việc · {filledCount} đã có nhận xét
          </p>
          <p className="sidebar-subtitle">
            Khai báo <strong>biện pháp thực hiện</strong> và <strong>nhận xét kết quả</strong>{" "}
            chuẩn cho từng loại công việc. Khi công việc đó xuất hiện trong sổ BDTX, hệ
            thống tự điền (nếu chưa nhập tay).
          </p>
          {message && <p className="save-ok">{message}</p>}
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
          <div className="danhmuc-bd-actions">
            <button type="button" className="btn-primary" onClick={handleSave}>
              Lưu danh mục
            </button>
            <button type="button" className="btn-secondary" onClick={handleReset}>
              Khôi phục mặc định
            </button>
          </div>
        </div>
      </aside>

      <main className="nhaplieu-review-pane">
        <div className="danhmuc-bd-pane">
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
              {visibleRows.map(({ row, idx }, ord) => (
                <tr key={row._rid}>
                  <td className="danhmuc-bd-stt">{ord + 1}</td>
                  <td>
                    <input
                      type="text"
                      value={row.type}
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
                      onChange={(e) => updateRow(idx, "maintenanceName", e.target.value)}
                      className="danhmuc-bd-input"
                      placeholder="Công việc xử lý (BDTX)"
                      title="Công việc bảo dưỡng thường xuyên"
                    />
                  </td>
                  <td>
                    <select
                      value={row.group || ""}
                      onChange={(e) => updateRow(idx, "group", e.target.value)}
                      className="danhmuc-bd-input danhmuc-bd-group-select"
                    >
                      <option value="">— Chưa phân nhóm —</option>
                      {BAO_DUONG_GROUPS.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={row.unit || ""}
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
                      onChange={(e) => updateRow(idx, "method", e.target.value)}
                      className="danhmuc-bd-input"
                      rows={2}
                      placeholder={DEFAULT_QUALITY_FALLBACK.method}
                    />
                  </td>
                  <td>
                    <textarea
                      value={row.result}
                      onChange={(e) => updateRow(idx, "result", e.target.value)}
                      className="danhmuc-bd-input"
                      rows={2}
                      placeholder={DEFAULT_QUALITY_FALLBACK.result}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="danhmuc-bd-del"
                      onClick={() => deleteRow(idx)}
                      title="Xoá loại này"
                    >
                      Xoá
                    </button>
                  </td>
                </tr>
              ))}
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
    </div>
  );
}
