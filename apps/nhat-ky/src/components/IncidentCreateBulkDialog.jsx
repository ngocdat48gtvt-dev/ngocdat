import { useEffect, useRef, useState } from "react";
import { createIncident } from "../services/incidentsService.js";
import { uploadAndAttachPhotos } from "../services/incidentImageService.js";
import { fetchMasterData, getCatalogOwnerUid } from "../services/masterDataService.js";
import {
  clampProgress,
  isBaoLuGroup,
  resolveCompletedDate,
  todayViDateString
} from "../utils/incidentUtils.js";
import { formatKmDisplay } from "../utils/kmUtils.js";

const DEFAULT_ROW_COUNT = 5;
const cellCls = "incident-bulk-cell";

const COLS = [
  { key: "idx", label: "#", def: 34, min: 28, fixed: true },
  { key: "road", label: "Tuyến", def: 108, min: 64 },
  { key: "km", label: "Lý trình", def: 88, min: 64 },
  { key: "group", label: "Nhóm", def: 112, min: 72 },
  { key: "type", label: "Loại sự cố", def: 140, min: 88 },
  { key: "pos", label: "Phía", def: 48, min: 36 },
  { key: "date", label: "Ngày xảy ra", def: 96, min: 80 },
  { key: "dai", label: "Dài", def: 52, min: 40 },
  { key: "rong", label: "Rộng", def: 52, min: 40 },
  { key: "cao", label: "Cao", def: 52, min: 40 },
  { key: "unit", label: "ĐV", def: 48, min: 38 },
  { key: "vol", label: "KL", def: 72, min: 56 },
  { key: "soil", label: "% Đất", def: 56, min: 44 },
  { key: "rock", label: "% Đá", def: 56, min: 44 },
  { key: "prog", label: "TĐ %", def: 48, min: 40 },
  { key: "done", label: "Ngày HT", def: 96, min: 80 },
  { key: "note", label: "Ghi chú", def: 140, min: 80 },
  { key: "before", label: "Ảnh HT", def: 116, min: 88 },
  { key: "after", label: "Ảnh XL", def: 116, min: 88 },
  { key: "del", label: "", def: 36, min: 30, fixed: true }
];

const COLW_STORAGE_KEY = "nhatky.incidentBulk.colW.v1";
const DEFAULT_COL_W = COLS.map((c) => c.def);

function loadColW() {
  try {
    const raw = localStorage.getItem(COLW_STORAGE_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length === COLS.length) {
        return arr.map((n, i) => Math.max(COLS[i].min, Number(n) || COLS[i].def));
      }
    }
  } catch {
    /* ignore */
  }
  return [...DEFAULT_COL_W];
}

function saveColW(w) {
  try {
    localStorage.setItem(COLW_STORAGE_KEY, JSON.stringify(w));
  } catch {
    /* ignore */
  }
}

function makeRow() {
  return {
    id: crypto.randomUUID(),
    road: "",
    km: "",
    groupName: "",
    type: "",
    position: "",
    date: todayViDateString(),
    dai: "",
    rong: "",
    cao: "",
    unit: "m3",
    soil: "",
    progress: 0,
    completedDate: "",
    note: "",
    before: [],
    after: []
  };
}

function makeRows(n) {
  return Array.from({ length: n }, () => makeRow());
}

function revokeRow(row) {
  row.before.forEach((p) => URL.revokeObjectURL(p.url));
  row.after.forEach((p) => URL.revokeObjectURL(p.url));
}

function rowVolume(r) {
  const d = Number(r.dai) || 0;
  const w = Number(r.rong) || 0;
  const h = Number(r.cao) || 0;
  if (d > 0 && w > 0 && h > 0) return d * w * h;
  if (d > 0 && w > 0) return d * w;
  if (d > 0) return d;
  return 0;
}

function fmtNum(n) {
  if (!n) return "";
  return Number(n.toFixed(2)).toString();
}

function isRowFilled(r) {
  return Boolean(r.road.trim() && r.type.trim() && r.km.trim());
}

function clampPercent(v) {
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}

export default function IncidentCreateBulkDialog({ open, onClose, onCreated, uid, profile }) {
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [roads, setRoads] = useState([]);
  const [groups, setGroups] = useState([]);
  const [typesByGroup, setTypesByGroup] = useState({});
  const [unitByType, setUnitByType] = useState({});
  const [rows, setRows] = useState(() => makeRows(DEFAULT_ROW_COUNT));
  const [colW, setColW] = useState(() => loadColW());
  const resizing = useRef(null);

  const tableW = colW.reduce((a, b) => a + b, 0);

  useEffect(() => {
    saveColW(colW);
  }, [colW]);

  useEffect(() => {
    if (!open) return;
    setRows((prev) => {
      prev.forEach(revokeRow);
      return makeRows(DEFAULT_ROW_COUNT);
    });
    setStatusMsg("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    void fetchMasterData(getCatalogOwnerUid(profile)).then((md) => {
      setRoads(md.roads || []);
      setGroups(md.groups || []);
      setTypesByGroup(md.typesByGroup || {});
      setUnitByType(md.unitByType || {});
    });
  }, [open, profile]);

  function updateRow(id, patch) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function startResize(e, i) {
    e.preventDefault();
    e.stopPropagation();
    resizing.current = { i, startX: e.clientX, startW: colW[i] };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function moveResize(e) {
    const st = resizing.current;
    if (!st) return;
    const next = colW.slice();
    next[st.i] = Math.max(COLS[st.i].min, Math.round(st.startW + (e.clientX - st.startX)));
    setColW(next);
  }

  function endResize(e) {
    if (!resizing.current) return;
    resizing.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }

  function setSoilPct(id, value) {
    if (String(value).trim() === "") {
      updateRow(id, { soil: "" });
      return;
    }
    updateRow(id, { soil: String(clampPercent(Number(value))) });
  }

  function setRockPct(id, value) {
    if (String(value).trim() === "") {
      updateRow(id, { soil: "" });
      return;
    }
    updateRow(id, { soil: String(100 - clampPercent(Number(value))) });
  }

  function addRows(n) {
    setRows((prev) => [...prev, ...makeRows(n)]);
  }

  function removeRow(id) {
    setRows((prev) => {
      const target = prev.find((r) => r.id === id);
      if (target) revokeRow(target);
      const next = prev.filter((r) => r.id !== id);
      return next.length > 0 ? next : makeRows(1);
    });
  }

  function addPhotos(id, kind, list) {
    if (!list) return;
    const items = Array.from(list)
      .filter((f) => f.type.startsWith("image/"))
      .map((file) => ({ file, url: URL.createObjectURL(file) }));
    if (!items.length) return;
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        return kind === "before"
          ? { ...r, before: [...r.before, ...items] }
          : { ...r, after: [...r.after, ...items] };
      })
    );
  }

  function removePhoto(id, kind, index) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const arr = kind === "before" ? r.before : r.after;
        const target = arr[index];
        if (target) URL.revokeObjectURL(target.url);
        const next = arr.filter((_, i) => i !== index);
        return kind === "before" ? { ...r, before: next } : { ...r, after: next };
      })
    );
  }

  function renderPhotoCell(r, kind) {
    const items = kind === "before" ? r.before : r.after;
    return (
      <div className="incident-bulk-photos">
        {items.map((it, idx) => (
          <div key={it.url} className="incident-bulk-photo">
            <img src={it.url} alt="" />
            {!saving && (
              <button type="button" onClick={() => removePhoto(r.id, kind, idx)} aria-label="Xoá ảnh">
                ✕
              </button>
            )}
          </div>
        ))}
        <label className="incident-bulk-photo-add">
          +
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={saving}
            onChange={(e) => {
              addPhotos(r.id, kind, e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      </div>
    );
  }

  async function handleCreate() {
    if (!uid) {
      window.alert("Chưa đăng nhập.");
      return;
    }
    const valid = rows.filter(isRowFilled);
    if (!valid.length) {
      window.alert("Cần ít nhất 1 dòng có Tuyến, Lý trình và Loại sự cố.");
      return;
    }
    const createdByName = profile?.displayName?.trim() || profile?.email?.trim() || "Hạt trưởng";
    const companyId = profile?.companyId?.trim() || "";
    setSaving(true);
    try {
      for (let i = 0; i < valid.length; i++) {
        const r = valid[i];
        setStatusMsg(`Đang lưu sự cố ${i + 1}/${valid.length}…`);
        const p = clampProgress(Number(r.progress));
        const soilPercent =
          isBaoLuGroup(r.groupName) && r.soil.trim() !== "" ? clampPercent(Number(r.soil)) : -1;
        const docId = await createIncident(uid, {
          road: r.road,
          groupName: r.groupName,
          type: r.type,
          km: formatKmDisplay(r.km),
          position: r.position,
          date: r.date,
          completedDate: resolveCompletedDate(p, r.completedDate),
          dai: Number(r.dai) || 0,
          rong: Number(r.rong) || 0,
          cao: Number(r.cao) || 0,
          unit: r.unit,
          soilPercent,
          progress: p,
          note: r.note,
          createdByName,
          companyId
        });
        if (r.before.length) {
          setStatusMsg(`Đang tải ảnh hiện trạng ${i + 1}/${valid.length}…`);
          await uploadAndAttachPhotos(uid, docId, docId, r.before.map((x) => x.file), "before");
        }
        if (r.after.length) {
          setStatusMsg(`Đang tải ảnh xử lý ${i + 1}/${valid.length}…`);
          await uploadAndAttachPhotos(uid, docId, docId, r.after.map((x) => x.file), "after");
        }
      }
      onCreated?.();
      onClose?.();
    } catch (e) {
      console.error(e);
      window.alert("Thêm sự cố thất bại. Kiểm tra mạng/quyền.");
    } finally {
      setSaving(false);
      setStatusMsg("");
    }
  }

  if (!open) return null;

  const filledCount = rows.filter(isRowFilled).length;

  return (
    <div className="incident-drawer-overlay">
      <div
        className="incident-drawer incident-bulk-modal"
        role="dialog"
        aria-modal="true"
        style={{ width: `min(${tableW + 48}px, 96vw)` }}
      >
        <div className="incident-drawer-head">
          <h3>Thêm sự cố mới</h3>
          <button type="button" className="incident-drawer-close" onClick={onClose} aria-label="Đóng">
            ×
          </button>
        </div>
        <div className="incident-form-body">
          <p className="section-guide">
            Nhập nhiều sự cố cùng lúc — mỗi dòng là một sự cố. Cần Tuyến, Lý trình, Loại sự cố.
            Khối lượng tự tính. % Đất/Đá chỉ cho nhóm Bão lũ.
          </p>
          <div className="incident-bulk-scroll">
            {roads.length > 0 && (
              <datalist id="incident-bulk-roads">
                {roads.map((x) => (
                  <option key={x} value={x} />
                ))}
              </datalist>
            )}
            {groups.length > 0 && (
              <datalist id="incident-bulk-groups">
                {groups.map((x) => (
                  <option key={x} value={x} />
                ))}
              </datalist>
            )}
            <table className="incident-bulk-table" style={{ width: tableW }}>
              <colgroup>
                {colW.map((w, i) => (
                  <col key={COLS[i].key} style={{ width: w }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  {COLS.map((c, i) => (
                    <th key={c.key}>
                      <span className="incident-bulk-th-label">{c.label}</span>
                      {!c.fixed ? (
                        <span
                          className="incident-bulk-col-resize"
                          onPointerDown={(e) => startResize(e, i)}
                          onPointerMove={moveResize}
                          onPointerUp={endResize}
                          onPointerCancel={endResize}
                          title="Kéo để chỉnh bề rộng cột"
                        />
                      ) : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => {
                  const rowTypes = typesByGroup[r.groupName] || [];
                  const baoLu = isBaoLuGroup(r.groupName);
                  const rockText = r.soil.trim() === "" ? "" : String(100 - Number(r.soil));
                  return (
                    <tr key={r.id}>
                      <td className="incident-bulk-idx">{idx + 1}</td>
                      <td>
                        <input
                          className={cellCls}
                          value={r.road}
                          list={roads.length ? "incident-bulk-roads" : undefined}
                          disabled={saving}
                          onChange={(e) => updateRow(r.id, { road: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          className={cellCls}
                          value={r.km}
                          placeholder="8+995"
                          disabled={saving}
                          onChange={(e) => updateRow(r.id, { km: e.target.value })}
                          onBlur={(e) => {
                            const formatted = formatKmDisplay(e.target.value);
                            if (formatted && formatted !== r.km) updateRow(r.id, { km: formatted });
                          }}
                        />
                      </td>
                      <td>
                        <input
                          className={cellCls}
                          value={r.groupName}
                          list={groups.length ? "incident-bulk-groups" : undefined}
                          disabled={saving}
                          onChange={(e) => updateRow(r.id, { groupName: e.target.value, type: "" })}
                        />
                      </td>
                      <td>
                        <input
                          className={cellCls}
                          value={r.type}
                          list={rowTypes.length ? `incident-bulk-types-${r.id}` : undefined}
                          disabled={saving}
                          onChange={(e) => updateRow(r.id, { type: e.target.value })}
                          onBlur={(e) => {
                            const t = e.target.value.trim();
                            if (t && unitByType[t]) updateRow(r.id, { type: t, unit: unitByType[t] });
                          }}
                        />
                        {rowTypes.length > 0 && (
                          <datalist id={`incident-bulk-types-${r.id}`}>
                            {rowTypes.map((x) => (
                              <option key={x} value={x} />
                            ))}
                          </datalist>
                        )}
                      </td>
                      <td><input className={cellCls} value={r.position} disabled={saving} onChange={(e) => updateRow(r.id, { position: e.target.value })} /></td>
                      <td><input className={cellCls} value={r.date} disabled={saving} onChange={(e) => updateRow(r.id, { date: e.target.value })} placeholder="dd/mm/yyyy" /></td>
                      <td><input className={cellCls} inputMode="decimal" value={r.dai} disabled={saving} onChange={(e) => updateRow(r.id, { dai: e.target.value })} /></td>
                      <td><input className={cellCls} inputMode="decimal" value={r.rong} disabled={saving} onChange={(e) => updateRow(r.id, { rong: e.target.value })} /></td>
                      <td><input className={cellCls} inputMode="decimal" value={r.cao} disabled={saving} onChange={(e) => updateRow(r.id, { cao: e.target.value })} /></td>
                      <td><input className={cellCls} value={r.unit} disabled={saving} onChange={(e) => updateRow(r.id, { unit: e.target.value })} /></td>
                      <td className="incident-bulk-vol">{fmtNum(rowVolume(r))}</td>
                      <td><input className={cellCls} inputMode="numeric" value={r.soil} disabled={saving || !baoLu} onChange={(e) => setSoilPct(r.id, e.target.value)} /></td>
                      <td><input className={cellCls} inputMode="numeric" value={rockText} disabled={saving || !baoLu} onChange={(e) => setRockPct(r.id, e.target.value)} /></td>
                      <td>
                        <input
                          className={cellCls}
                          inputMode="numeric"
                          value={r.progress}
                          disabled={saving}
                          onChange={(e) => {
                            const p = clampProgress(Number(e.target.value));
                            updateRow(r.id, { progress: p, completedDate: resolveCompletedDate(p, r.completedDate) });
                          }}
                        />
                      </td>
                      <td><input className={cellCls} value={r.completedDate} disabled={saving} onChange={(e) => updateRow(r.id, { completedDate: e.target.value })} placeholder="dd/mm/yyyy" /></td>
                      <td><input className={cellCls} value={r.note} disabled={saving} onChange={(e) => updateRow(r.id, { note: e.target.value })} /></td>
                      <td className="incident-bulk-photo-cell">{renderPhotoCell(r, "before")}</td>
                      <td className="incident-bulk-photo-cell">{renderPhotoCell(r, "after")}</td>
                      <td>
                        <button type="button" className="incident-bulk-del" disabled={saving} onClick={() => removeRow(r.id)} title="Xoá dòng">
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="incident-bulk-toolbar">
            <button type="button" className="btn-secondary btn-primary--compact" disabled={saving} onClick={() => addRows(1)}>+ Thêm dòng</button>
            <button type="button" className="btn-secondary btn-primary--compact" disabled={saving} onClick={() => addRows(5)}>+ 5 dòng</button>
            <span className="section-guide">{filledCount > 0 ? `${filledCount} dòng hợp lệ` : "Chưa có dòng hợp lệ"}</span>
            {statusMsg && <span className="hientruong-import-msg">{statusMsg}</span>}
          </div>
          <div className="incident-form-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Huỷ</button>
            <button type="button" className="btn-primary" disabled={saving} onClick={() => void handleCreate()}>
              {saving ? "Đang lưu…" : `Thêm ${filledCount || ""} sự cố`.trim()}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
