import { useEffect, useMemo, useState } from "react";
import {
  loadCauRegistry,
  saveCauRegistry,
  setCauRegistry,
  cauScope,
  makeEmptyCauRows,
  parseCauPaste,
  CAU_REGISTRY_EVENT
} from "../utils/cauRegistryStore";
import { fetchAllCau, pushManyCau } from "../services/cauRegistryService";
import { formatKmCell } from "../utils/matDuongFormat";
import { useAuth } from "../context/AuthContext";
import { useRoadWorkspace } from "../context/RoadWorkspaceContext";

const SIDEBAR_WIDTH = 340;

function formatKm(value) {
  const v = String(value ?? "").trim();
  if (!v) return "";
  return formatKmCell(v) || v;
}

/** Danh sách cầu theo sổ hạt (đường) của user. */
export default function DanhSachCau({ readOnly = false }) {
  const { profile } = useAuth();
  const { roads, activeRoadId, ownerUid } = useRoadWorkspace();
  const uid = ownerUid || profile?.uid || "";
  const roadsKey = roads.map((r) => r.id).join(",");

  const roadName = (id) => {
    const r = roads.find((x) => x.id === id);
    return (r?.roadName || r?.label || "").trim();
  };

  const [rows, setRows] = useState(() => makeEmptyCauRows(8));
  const [pasteText, setPasteText] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function build() {
      const anyEmpty = roads.some(
        (r) => loadCauRegistry(cauScope(uid, r.id)).length === 0
      );
      // ADMIN/VIEWER (readOnly) luôn đọc cloud của user đang browse
      if (uid && (anyEmpty || readOnly)) {
        const cloud = await fetchAllCau(uid);
        if (cancelled) return;
        for (const r of roads) {
          const scope = cauScope(uid, r.id);
          const list = cloud[roadName(r.id)];
          if (list?.length && (readOnly || loadCauRegistry(scope).length === 0)) {
            setCauRegistry(scope, list);
          }
        }
      }
      if (cancelled) return;
      const all = [];
      for (const r of roads) {
        for (const item of loadCauRegistry(cauScope(uid, r.id))) {
          all.push({ ...item, roadId: r.id, km: formatKm(item.km) });
        }
      }
      setRows(
        all.length
          ? all
          : makeEmptyCauRows(8).map((x) => ({ ...x, roadId: activeRoadId }))
      );
    }
    void build();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, roadsKey, activeRoadId, readOnly]);

  function flash(msg) {
    setMessage(msg);
    setTimeout(() => setMessage(""), 3500);
  }

  function updateRow(index, patch) {
    if (readOnly) return;
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addRows() {
    if (readOnly) return;
    setRows((prev) => [
      ...prev,
      ...makeEmptyCauRows(5).map((x) => ({ ...x, roadId: activeRoadId }))
    ]);
  }

  function applyPaste() {
    if (readOnly) return;
    const parsed = parseCauPaste(pasteText);
    if (!parsed.length) {
      flash("Không đọc được dòng nào từ vùng dán.");
      return;
    }
    setRows(
      parsed.map((p) => ({
        ...p,
        km: formatKm(p.km),
        roadId: activeRoadId
      }))
    );
    setPasteText("");
    flash(`Đã nạp ${parsed.length} cầu — kiểm tra rồi bấm Lưu.`);
  }

  async function handleSave() {
    if (readOnly) return;
    setSaving(true);
    try {
      const byRoadId = {};
      rows.forEach((r) => {
        const rid = r.roadId || activeRoadId;
        if (!rid) return;
        if (!byRoadId[rid]) byRoadId[rid] = [];
        const name = String(r.name || "").trim();
        const km = formatKm(r.km);
        if (!name && !km) return;
        byRoadId[rid].push({ id: r.id, name, km });
      });

      const updatesByRoad = {};
      for (const r of roads) {
        const list = byRoadId[r.id] || [];
        saveCauRegistry(cauScope(uid, r.id), list);
        const rn = roadName(r.id);
        if (rn) updatesByRoad[rn] = list;
      }

      if (uid && Object.keys(updatesByRoad).length) {
        await pushManyCau(uid, updatesByRoad);
      }
      window.dispatchEvent(new CustomEvent(CAU_REGISTRY_EVENT));
      flash("Đã lưu danh sách cầu.");
    } catch (err) {
      console.warn(err);
      flash("Đã lưu cục bộ (chưa đồng bộ cloud).");
    } finally {
      setSaving(false);
    }
  }

  const roadOptions = useMemo(
    () => roads.map((r) => ({ id: r.id, label: roadName(r.id) || r.id })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [roadsKey]
  );

  return (
    <div className="hosocong-page">
      <aside className="hosocong-sidebar" style={{ width: SIDEBAR_WIDTH, minWidth: SIDEBAR_WIDTH }}>
        <h2 className="hosocong-title">Danh sách cầu</h2>
        <p className="section-guide section-guide--compact">
          Theo sổ hạt đang quản lý. Mỗi cầu: <strong>tên</strong> + <strong>một lý trình</strong>.
          {activeRoadId && (
            <>
              {" "}
              Đường chọn: <strong>{roadName(activeRoadId) || "—"}</strong>.
            </>
          )}
        </p>
        {readOnly && (
          <p className="section-guide">Chỉ xem — ADMIN/VIEWER không sửa danh sách cầu.</p>
        )}
        {!readOnly && (
          <>
            <label className="hosocong-label">Dán từ Excel (Tên cầu · Lý trình)</label>
            <textarea
              className="hosocong-paste"
              rows={5}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={"Cầu Sông Cầu\t435+200\nCầu Km 440\t440+000"}
            />
            <div className="hosocong-actions">
              <button type="button" className="btn-secondary btn-secondary--compact" onClick={applyPaste}>
                Nạp từ vùng dán
              </button>
              <button type="button" className="btn-secondary btn-secondary--compact" onClick={addRows}>
                + 5 dòng
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={saving}
                onClick={() => void handleSave()}
              >
                {saving ? "Đang lưu…" : "Lưu danh sách cầu"}
              </button>
            </div>
          </>
        )}
        {message && <p className="hosocong-msg">{message}</p>}
      </aside>

      <main className="hosocong-main">
        <div className="hosocong-table-wrap hosocong-table-wrap--cau">
          <table className="hosocong-table hosocong-table--cau">
            <colgroup>
              <col style={{ width: 44 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 220 }} />
              <col style={{ width: 120 }} />
              {!readOnly && <col style={{ width: 40 }} />}
            </colgroup>
            <thead>
              <tr>
                <th>STT</th>
                <th>Đường / Hạt</th>
                <th>Tên cầu</th>
                <th>Lý trình</th>
                {!readOnly && <th />}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={row.id || idx}>
                  <td className="hosocong-stt">{idx + 1}</td>
                  <td>
                    <select
                      className="hosocong-input"
                      value={row.roadId || activeRoadId || ""}
                      disabled={readOnly}
                      onChange={(e) => updateRow(idx, { roadId: e.target.value })}
                    >
                      {roadOptions.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      className="hosocong-input"
                      value={row.name || ""}
                      disabled={readOnly}
                      onChange={(e) => updateRow(idx, { name: e.target.value })}
                      placeholder="Tên cầu"
                    />
                  </td>
                  <td>
                    <input
                      className="hosocong-input"
                      value={row.km || ""}
                      disabled={readOnly}
                      onChange={(e) => updateRow(idx, { km: e.target.value })}
                      onBlur={(e) => {
                        const f = formatKm(e.target.value);
                        if (f !== e.target.value) updateRow(idx, { km: f });
                      }}
                      placeholder="Km435+000"
                    />
                  </td>
                  {!readOnly && (
                    <td>
                      <button
                        type="button"
                        className="hosocong-del"
                        onClick={() => setRows((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        ×
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
