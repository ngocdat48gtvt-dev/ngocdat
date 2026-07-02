import { useEffect, useMemo, useState } from "react";
import {
  loadCongRegistry,
  saveCongRegistry,
  setCongRegistry,
  congScope,
  makeEmptyCongRows,
  parseCongPaste
} from "../utils/congRegistryStore";
import { fetchAllCong, pushManyCong } from "../services/congRegistryService";
import { formatKmCell } from "../utils/matDuongFormat";
import { useAuth } from "../context/AuthContext";
import { useRoadWorkspace } from "../context/RoadWorkspaceContext";

const SIDEBAR_WIDTH = 340;

/** Nhập số (vd 369100) → hiển thị Km369+100. */
function formatKm(value) {
  const v = String(value ?? "").trim();
  if (!v) return "";
  return formatKmCell(v) || v;
}

export default function HoSoCong() {
  const { profile } = useAuth();
  const { roads, activeRoad, activeRoadId } = useRoadWorkspace();
  const uid = profile?.uid || "";
  const roadsKey = roads.map((r) => r.id).join(",");

  const roadName = (id) => {
    const r = roads.find((x) => x.id === id);
    return (r?.roadName || r?.label || "").trim();
  };

  const [rows, setRows] = useState(() => makeEmptyCongRows(8));
  const [pasteText, setPasteText] = useState("");
  const [countInput, setCountInput] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  // Nạp cống của TẤT CẢ các đường vào 1 bảng (có cột Đường).
  useEffect(() => {
    let cancelled = false;
    async function build() {
      // Đường nào máy chưa có dữ liệu thì thử lấy từ cloud.
      const anyEmpty = roads.some(
        (r) => loadCongRegistry(congScope(uid, r.id)).length === 0
      );
      if (uid && anyEmpty) {
        const cloud = await fetchAllCong(uid);
        if (cancelled) return;
        for (const r of roads) {
          const scope = congScope(uid, r.id);
          if (loadCongRegistry(scope).length === 0) {
            const list = cloud[roadName(r.id)];
            if (list && list.length) setCongRegistry(scope, list);
          }
        }
      }
      if (cancelled) return;
      const all = [];
      for (const r of roads) {
        const list = loadCongRegistry(congScope(uid, r.id));
        for (const item of list) {
          all.push({ ...item, roadId: r.id, km: formatKm(item.km) });
        }
      }
      setRows(
        all.length
          ? all
          : makeEmptyCongRows(8).map((x) => ({ ...x, roadId: activeRoadId }))
      );
    }
    build();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, roadsKey, activeRoadId]);

  const filledCount = useMemo(
    () => rows.filter((r) => String(r.km || "").trim()).length,
    [rows]
  );

  function updateRow(id, field, value) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
    setMessage("");
  }

  function deleteRow(id) {
    setRows((prev) => prev.filter((r) => r.id !== id));
    setMessage("");
  }

  function addRows() {
    setRows((prev) => [
      ...prev,
      ...makeEmptyCongRows(5).map((x) => ({ ...x, roadId: activeRoadId }))
    ]);
  }

  function generateRows() {
    const n = parseInt(countInput, 10);
    if (!Number.isFinite(n) || n < 1) {
      setMessage("Nhập số lượng cống hợp lệ (≥ 1).");
      return;
    }
    if (n > 1000) {
      setMessage("Tối đa 1000 cống mỗi lần tạo.");
      return;
    }
    // Nối tiếp vào danh sách hiện có (theo đường đang chọn), không xoá đường khác.
    setRows((prev) => [
      ...prev,
      ...makeEmptyCongRows(n).map((x) => ({ ...x, roadId: activeRoadId }))
    ]);
    setCountInput("");
    setMessage(
      `Đã thêm ${n} dòng trống cho đường "${roadName(activeRoadId) || "?"}". Dán/nhập rồi bấm "Lưu hồ sơ".`
    );
  }

  function importPaste() {
    const parsed = parseCongPaste(pasteText);
    if (!parsed.length) {
      setMessage("Không đọc được dòng nào. Mỗi dòng: Lý trình [tab] Loại cống [tab] Chiều dài.");
      return;
    }
    const formatted = parsed.map((r) => ({
      ...r,
      km: formatKm(r.km),
      roadId: activeRoadId
    }));
    setRows((prev) => {
      const keep = prev.filter(
        (r) => String(r.km || "").trim() || String(r.type || "").trim()
      );
      return [...keep, ...formatted];
    });
    setPasteText("");
    setMessage(
      `Đã nạp ${parsed.length} cống (đường "${roadName(activeRoadId) || "?"}"). Kiểm tra rồi bấm "Lưu hồ sơ".`
    );
  }

  async function handleSave() {
    if (!roads.length) {
      setMessage("Chưa có đường nào. Tạo đường trong 'Đổi hạt' trước khi lưu.");
      return;
    }
    // Gom theo đường (bỏ qua dòng trống & dòng chưa chọn đường).
    const grouped = {};
    for (const r of rows) {
      const rid = r.roadId || activeRoadId;
      if (!rid) continue;
      if (!String(r.km || "").trim() && !String(r.type || "").trim() && !String(r.length || "").trim()) {
        continue;
      }
      (grouped[rid] = grouped[rid] || []).push(r);
    }

    let total = 0;
    const updatesByName = {};
    for (const road of roads) {
      const list = grouped[road.id] || [];
      const clean = saveCongRegistry(congScope(uid, road.id), list);
      total += clean.length;
      const name = roadName(road.id);
      if (name) updatesByName[name] = clean;
    }

    // Dựng lại bảng từ storage cho gọn.
    const rebuilt = [];
    for (const r of roads) {
      for (const item of loadCongRegistry(congScope(uid, r.id))) {
        rebuilt.push({ ...item, roadId: r.id, km: formatKm(item.km) });
      }
    }
    setRows(
      rebuilt.length
        ? rebuilt
        : makeEmptyCongRows(8).map((x) => ({ ...x, roadId: activeRoadId }))
    );

    if (!uid) {
      setMessage(`Đã lưu ${total} cống trên máy (chưa đăng nhập nên không đẩy cloud).`);
      return;
    }
    setSaving(true);
    setMessage(`Đã lưu ${total} cống. Đang đẩy lên cloud...`);
    try {
      await pushManyCong(uid, updatesByName);
      setMessage(`Đã lưu & đồng bộ ${total} cống cho ${Object.keys(updatesByName).length} đường. App điện thoại sẽ gợi ý lý trình theo hồ sơ này.`);
    } catch (err) {
      setMessage(`Đã lưu trên máy nhưng đẩy cloud lỗi: ${err?.message || err}. Thử lại khi có mạng.`);
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(""), 5000);
    }
  }

  async function handleClear() {
    if (!window.confirm("Xoá toàn bộ hồ sơ cống của MỌI đường?")) return;
    for (const r of roads) {
      saveCongRegistry(congScope(uid, r.id), []);
    }
    setRows(makeEmptyCongRows(8).map((x) => ({ ...x, roadId: activeRoadId })));
    if (uid && roads.length) {
      const updates = {};
      for (const r of roads) {
        const name = roadName(r.id);
        if (name) updates[name] = [];
      }
      try {
        await pushManyCong(uid, updates);
      } catch {
        /* vẫn xoá trên máy */
      }
    }
    setMessage("Đã xoá hồ sơ cống của mọi đường.");
    setTimeout(() => setMessage(""), 3500);
  }

  return (
    <div className="nhaplieu-workspace sonhatky-workspace">
      <aside
        className="nhaplieu-sidebar sonhatky-sidebar"
        style={{ width: SIDEBAR_WIDTH, minWidth: SIDEBAR_WIDTH, maxWidth: SIDEBAR_WIDTH }}
      >
        <div className="sidebar-sticky-head">
          <h2 className="sidebar-title">Hồ sơ cống</h2>
          <p className="sonhatky-day-summary">
            {roads.length} đường · {filledCount} cống
          </p>
          <p className="sidebar-subtitle">
            Khai báo danh sách cống theo <strong>hồ sơ quản lý đường</strong> (lý trình,
            loại cống, chiều dài). Mỗi dòng chọn <strong>đường</strong> ở cột đầu; lưu
            <strong> riêng theo từng đường</strong> và đẩy lên cloud để{" "}
            <strong>app điện thoại</strong> gợi ý lý trình cống khi nhập sự cố. Đường đang
            chọn: <strong>{roadName(activeRoadId) || "—"}</strong>.
          </p>
          {message && <p className="save-ok">{message}</p>}
          <label className="sidebar-field">
            <span className="sidebar-field-label">Số lượng cống → tạo thêm dòng (đường đang chọn)</span>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                type="number"
                min="1"
                className="sidebar-input"
                style={{ flex: 1 }}
                value={countInput}
                onChange={(e) => setCountInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    generateRows();
                  }
                }}
                placeholder="VD: 30"
              />
              <button type="button" className="btn-secondary" onClick={generateRows}>
                Tạo dòng
              </button>
            </div>
          </label>
          <label className="sidebar-field">
            <span className="sidebar-field-label">Dán từ Excel (Lý trình ⇥ Loại cống ⇥ Chiều dài)</span>
            <textarea
              className="sidebar-input"
              rows={5}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={"369100\tCống tròn D100\t12\n366050\tCống bản\t8"}
            />
          </label>
          <div className="danhmuc-bd-actions">
            <button type="button" className="btn-secondary" onClick={importPaste}>
              Nạp vào bảng (đường đang chọn)
            </button>
          </div>
          <div className="danhmuc-bd-actions">
            <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? "Đang lưu..." : "Lưu hồ sơ"}
            </button>
            <button type="button" className="btn-secondary" onClick={handleClear} disabled={saving}>
              Xoá hết
            </button>
          </div>
        </div>
      </aside>

      <main className="nhaplieu-review-pane">
        <div className="danhmuc-bd-pane" style={{ maxWidth: 1000 }}>
          <div className="danhmuc-bd-add">
            <button type="button" className="btn-secondary" onClick={addRows}>
              + 5 dòng
            </button>
          </div>

          <div className="danhmuc-bd-scroll">
            <table className="danhmuc-bd-table" style={{ minWidth: 760 }}>
              <colgroup>
                <col style={{ width: "44px" }} />
                <col style={{ width: "190px" }} />
                <col style={{ width: "180px" }} />
                <col style={{ width: "auto" }} />
                <col style={{ width: "110px" }} />
                <col style={{ width: "60px" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>STT</th>
                  <th>Đường</th>
                  <th>Lý trình</th>
                  <th>Loại cống</th>
                  <th>Chiều dài (m)</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={row.id}>
                    <td className="danhmuc-bd-stt">{idx + 1}</td>
                    <td>
                      <select
                        value={row.roadId || activeRoadId || ""}
                        onChange={(e) => updateRow(row.id, "roadId", e.target.value)}
                        className="danhmuc-bd-input"
                        aria-label={`Đường dòng ${idx + 1}`}
                      >
                        {roads.length === 0 && <option value="">(chưa có đường)</option>}
                        {roads.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.roadName || r.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.km}
                        onChange={(e) => updateRow(row.id, "km", e.target.value)}
                        onBlur={(e) => updateRow(row.id, "km", formatKm(e.target.value))}
                        className="danhmuc-bd-input"
                        placeholder="Nhập số: 369100 → Km369+100"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.type}
                        onChange={(e) => updateRow(row.id, "type", e.target.value)}
                        className="danhmuc-bd-input"
                        placeholder="VD: Cống tròn D100"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.length}
                        onChange={(e) => updateRow(row.id, "length", e.target.value)}
                        className="danhmuc-bd-input danhmuc-bd-center"
                        placeholder="m"
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="danhmuc-bd-del"
                        onClick={() => deleteRow(row.id)}
                        title="Xoá cống này"
                      >
                        Xoá
                      </button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="danhmuc-bd-empty">
                      Chưa có cống nào. Dán từ Excel hoặc bấm “+ 5 dòng”.
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
