import { useMemo, useState } from "react";
import { EMPTY_REPORT_META } from "../utils/nhatKyFormat";
import {
  getRoadRoutes,
  groupRoadsByHat,
  normalizeRoute,
  uniquifyRouteIds,
  roadDisplayLabel
} from "../utils/roadsCatalog";
import { useRoadWorkspace } from "../context/RoadWorkspaceContext";
import { useOfficePermissions } from "../hooks/useOfficePermissions";
import PasswordConfirmModal from "../components/PasswordConfirmModal";
import RouteLabelLines from "../components/RouteLabelLines";

function emptyRoute() {
  return normalizeRoute({ roadName: "", kmFrom: "", kmTo: "" });
}

const EMPTY_FORM = {
  hat: "",
  company: EMPTY_REPORT_META.company,
  routes: [emptyRoute()]
};

export default function RoadSelectPage() {
  const { roads, selectRoad, createRoad, editRoad, deleteRoad } = useRoadWorkspace();
  const { canManageOfficeCatalog } = useOfficePermissions();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null);

  const grouped = useMemo(() => groupRoadsByHat(roads), [roads]);

  function openCreate(prefillHat = "") {
    setEditingId("");
    setForm({
      ...EMPTY_FORM,
      hat: prefillHat,
      routes: [emptyRoute()]
    });
    setShowForm(true);
    setError("");
  }

  function openEdit(road) {
    setEditingId(road.id);
    const routes = getRoadRoutes(road);
    setForm({
      hat: road.hat || "",
      company: road.company || EMPTY_REPORT_META.company,
      routes: routes.length ? routes.map((r) => ({ ...r })) : [emptyRoute()]
    });
    setShowForm(true);
    setError("");
  }

  function updateRoute(index, patch) {
    setForm((f) => ({
      ...f,
      routes: f.routes.map((r, i) => (i === index ? { ...r, ...patch } : r))
    }));
  }

  function addRouteRow() {
    setForm((f) => ({ ...f, routes: [...f.routes, emptyRoute()] }));
  }

  function removeRouteRow(index) {
    setForm((f) => {
      if (f.routes.length <= 1) return f;
      return { ...f, routes: f.routes.filter((_, i) => i !== index) };
    });
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!canManageOfficeCatalog) return;

    const hat = form.hat.trim();
    if (!hat) {
      setError("Vui lòng nhập tên hạt.");
      return;
    }

    const routes = uniquifyRouteIds(
      form.routes
        .map((r) =>
          normalizeRoute({
            ...r,
            roadName: String(r.roadName || "").trim(),
            kmFrom: String(r.kmFrom || "").trim(),
            kmTo: String(r.kmTo || "").trim()
          })
        )
        .filter((r) => r.roadName)
    );

    if (!routes.length) {
      setError("Cần ít nhất một đường/nhánh (tên đường).");
      return;
    }
    for (let i = 0; i < routes.length; i += 1) {
      if (!routes[i].kmFrom || !routes[i].kmTo) {
        setError(`Đường/nhánh ${i + 1}: nhập Km đầu và Km cuối.`);
        return;
      }
    }

    const payload = {
      hat,
      company: form.company,
      routes,
      roadName: routes[0].roadName,
      kmFrom: routes[0].kmFrom,
      kmTo: routes[0].kmTo
    };

    if (editingId) {
      editRoad(editingId, payload);
      setShowForm(false);
    } else {
      const road = createRoad(payload);
      if (road) selectRoad(road.id);
    }
    setForm(EMPTY_FORM);
    setEditingId("");
    setError("");
  }

  function handleDelete(road) {
    if (!canManageOfficeCatalog) return;
    setPendingDelete(road);
  }

  function confirmDeleteRoad() {
    if (!pendingDelete) return;
    deleteRoad(pendingDelete.id);
    setPendingDelete(null);
  }

  return (
    <div className="road-select-page">
      <div className="road-select-card road-select-card--wide">
        <h1>Chọn sổ tuần đường</h1>
        <p className="road-select-sub">
          Chọn sổ để làm việc. Sổ có nhiều đường/nhánh: trong từng sổ dùng{" "}
          <strong>Tách đường</strong> / <strong>Gộp đường</strong> (sidebar trái, dưới nút In) để
          tùy chỉnh tiêu đề.
        </p>
        {!canManageOfficeCatalog && (
          <p className="section-guide danhmuc-bd-readonly-hint">
            Danh mục sổ do <strong>ADMIN</strong> quản lý. Bạn chỉ chọn sổ được cấp để nhập liệu —
            không tự thêm, sửa hoặc xóa sổ.
          </p>
        )}

        {grouped.length > 0 && (
          <div className="road-select-groups">
            {grouped.map((group) => (
              <div key={group.hat} className="road-select-group">
                <div className="road-select-group-head">
                  <strong>Hạt: {group.hat}</strong>
                  {canManageOfficeCatalog && (
                    <button
                      type="button"
                      className="road-select-group-add"
                      onClick={() => openCreate(group.hat)}
                    >
                      + Thêm sổ
                    </button>
                  )}
                </div>
                <div className="road-select-list">
                  {group.books.map((road) => {
                    const routes = getRoadRoutes(road);
                    return (
                      <div key={road.id} className="road-select-item">
                        <button
                          type="button"
                          className="road-select-item-main"
                          onClick={() => selectRoad(road.id)}
                        >
                          <strong>
                            {routes.length > 1
                              ? `${routes.length} đường/nhánh`
                              : routes[0]?.roadName || road.roadName || "Sổ"}
                          </strong>
                          <span className="road-select-item-routes">
                            {routes.length ? (
                              routes.map((r) => (
                                <RouteLabelLines key={r.id} route={r} />
                              ))
                            ) : (
                              <span>{roadDisplayLabel(road)}</span>
                            )}
                          </span>
                        </button>
                        {canManageOfficeCatalog && (
                          <div className="road-select-item-actions">
                            <button
                              type="button"
                              className="road-select-mini-btn"
                              onClick={() => openEdit(road)}
                            >
                              Sửa
                            </button>
                            <button
                              type="button"
                              className="road-select-mini-btn road-select-mini-btn--danger"
                              onClick={() => handleDelete(road)}
                            >
                              Xóa
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {grouped.length === 0 && !showForm && (
          <p className="section-guide">
            {canManageOfficeCatalog
              ? "Chưa có sổ nào. Bấm nút bên dưới để tạo sổ tuần đường."
              : "Chưa có sổ được cấp. Liên hệ ADMIN để tạo sổ làm việc."}
          </p>
        )}

        {canManageOfficeCatalog && !showForm && (
          <button type="button" className="btn-primary road-select-add-btn" onClick={() => openCreate()}>
            + Thêm sổ tuần đường
          </button>
        )}

        {canManageOfficeCatalog && showForm && (
          <form className="road-select-form" onSubmit={handleSubmit}>
            <h2>{editingId ? "Sửa sổ tuần đường" : "Thêm sổ tuần đường"}</h2>

            <label className="entry-form-label" htmlFor="road-hat">
              Tên hạt *
            </label>
            <input
              id="road-hat"
              className="sidebar-input"
              value={form.hat}
              onChange={(e) => setForm((f) => ({ ...f, hat: e.target.value }))}
              placeholder="VD: Lưu Trọng Nghĩa"
              required
            />

            <label className="entry-form-label" htmlFor="road-company">
              Tên công ty (trên sổ)
            </label>
            <textarea
              id="road-company"
              className="sidebar-input sidebar-input--company"
              rows={3}
              value={form.company}
              onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
              placeholder={"VD:\nCÔNG TY CỔ PHẦN …\nTHƯƠNG MẠI SỐ 909"}
            />
            <p className="road-select-km-hint">
              Enter để xuống dòng đúng chỗ muốn — sổ không tự cắt giữa từ.
            </p>

            <div className="road-select-routes-head">
              <span className="entry-form-label">Đường / nhánh *</span>
              <button type="button" className="road-select-group-add" onClick={addRouteRow}>
                + Thêm đường/nhánh
              </button>
            </div>
            <p className="road-select-km-hint">
              Nhiều cung cùng tên (vd. QL.6C) nhưng khác km → thêm từng dòng để phân biệt. Chỉ gộp
              khi thật sự cùng một cung. Km dạng <code>0</code> / <code>13+200</code>.
            </p>

            {form.routes.map((route, idx) => (
              <div key={route.id || `route-${idx}`} className="road-select-route-card">
                <div className="road-select-route-card-head">
                  <strong>Đường {idx + 1}</strong>
                  {form.routes.length > 1 && (
                    <button
                      type="button"
                      className="road-select-mini-btn road-select-mini-btn--danger"
                      onClick={() => removeRouteRow(idx)}
                    >
                      Xóa
                    </button>
                  )}
                </div>
                <label className="entry-form-label">Tên đường / nhánh *</label>
                <input
                  className="sidebar-input"
                  value={route.roadName}
                  onChange={(e) => updateRoute(idx, { roadName: e.target.value })}
                  placeholder="VD: QL.6C (Tà Làng - Cò Nòi)"
                  required
                />
                <div className="road-select-km-row">
                  <label className="road-select-km-field">
                    <span className="entry-form-label">Km đầu *</span>
                    <input
                      className="sidebar-input"
                      value={route.kmFrom}
                      onChange={(e) => updateRoute(idx, { kmFrom: e.target.value })}
                      placeholder="0"
                      required
                    />
                  </label>
                  <label className="road-select-km-field">
                    <span className="entry-form-label">Km cuối *</span>
                    <input
                      className="sidebar-input"
                      value={route.kmTo}
                      onChange={(e) => updateRoute(idx, { kmTo: e.target.value })}
                      placeholder="22"
                      required
                    />
                  </label>
                </div>
              </div>
            ))}

            {error && <p className="road-select-error">{error}</p>}
            <div className="road-select-form-actions">
              <button type="submit" className="btn-primary">
                {editingId ? "Lưu thay đổi" : "Tạo và mở sổ"}
              </button>
              <button
                type="button"
                className="road-select-cancel-btn"
                onClick={() => {
                  setShowForm(false);
                  setEditingId("");
                  setError("");
                }}
              >
                Hủy
              </button>
            </div>
          </form>
        )}
      </div>

      <PasswordConfirmModal
        open={Boolean(pendingDelete)}
        title="Xóa sổ — nhập mật khẩu"
        description={
          pendingDelete
            ? `Bạn sắp xóa sổ «${roadDisplayLabel(pendingDelete)}».\n\nDữ liệu nhật ký của sổ này sẽ bị xóa khỏi máy. Nhập mật khẩu để xác nhận — tránh bấm nhầm.`
            : ""
        }
        confirmLabel="Xóa sổ"
        onCancel={() => setPendingDelete(null)}
        onConfirmed={confirmDeleteRoad}
      />
    </div>
  );
}
