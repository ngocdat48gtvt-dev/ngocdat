import { useMemo, useState } from "react";
import { EMPTY_REPORT_META } from "../utils/nhatKyFormat";
import { groupRoadsByName, roadDisplayLabel } from "../utils/roadsCatalog";
import { useRoadWorkspace } from "../context/RoadWorkspaceContext";

const EMPTY_FORM = {
  roadName: "",
  hat: "",
  kmFrom: "",
  kmTo: "",
  company: EMPTY_REPORT_META.company
};

export default function RoadSelectPage() {
  const { roads, selectRoad, createRoad, editRoad, deleteRoad } = useRoadWorkspace();
  const [showForm, setShowForm] = useState(roads.length === 0);
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");

  const grouped = useMemo(() => groupRoadsByName(roads), [roads]);

  function openCreate(prefillRoadName = "") {
    setEditingId("");
    setForm({ ...EMPTY_FORM, roadName: prefillRoadName });
    setShowForm(true);
    setError("");
  }

  function openEdit(road) {
    setEditingId(road.id);
    setForm({
      roadName: road.roadName || road.label || "",
      hat: road.hat || "",
      kmFrom: road.kmFrom || "",
      kmTo: road.kmTo || "",
      company: road.company || EMPTY_REPORT_META.company
    });
    setShowForm(true);
    setError("");
  }

  function handleSubmit(e) {
    e.preventDefault();
    const roadName = form.roadName.trim();
    const hat = form.hat.trim();
    const kmFrom = form.kmFrom.trim();
    const kmTo = form.kmTo.trim();

    if (!roadName) {
      setError("Vui lòng nhập tên đường.");
      return;
    }
    if (!hat) {
      setError("Vui lòng nhập tên Hạt (mỗi đoạn quản lý một hạt).");
      return;
    }
    if (!kmFrom || !kmTo) {
      setError("Vui lòng nhập Km đầu và Km cuối của hạt này.");
      return;
    }

    const payload = { ...form, roadName, hat, kmFrom, kmTo };
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
    if (
      !window.confirm(
        `Xóa sổ «${roadDisplayLabel(road)}»?\n\nDữ liệu nhật ký của hạt này sẽ bị xóa khỏi máy.`
      )
    ) {
      return;
    }
    deleteRoad(road.id);
  }

  return (
    <div className="road-select-page">
      <div className="road-select-card road-select-card--wide">
        <h1>Chọn hạt / đoạn làm việc</h1>
        <p className="road-select-sub">
          Một tuyến đường có thể chia 2–3 hạt. Mỗi hạt là một sổ riêng với lý trình{" "}
          <strong>Km đầu → Km cuối</strong>.
        </p>

        {grouped.length > 0 && (
          <div className="road-select-groups">
            {grouped.map((group) => (
              <div key={group.roadName} className="road-select-group">
                <div className="road-select-group-head">
                  <strong>{group.roadName}</strong>
                  <button
                    type="button"
                    className="road-select-group-add"
                    onClick={() => openCreate(group.roadName)}
                  >
                    + Thêm hạt
                  </button>
                </div>
                <div className="road-select-list">
                  {group.segments.map((road) => (
                    <div key={road.id} className="road-select-item">
                      <button
                        type="button"
                        className="road-select-item-main"
                        onClick={() => selectRoad(road.id)}
                      >
                        <strong>Hạt {road.hat}</strong>
                        <span>
                          {road.kmFrom || road.kmTo
                            ? `${road.kmFrom ? `Km${road.kmFrom.replace(/^km/i, "")}` : "…"} → ${road.kmTo ? `Km${road.kmTo.replace(/^km/i, "")}` : "…"}`
                            : road.kmRange}
                        </span>
                      </button>
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
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {!showForm && (
          <button type="button" className="btn-primary road-select-add-btn" onClick={() => openCreate()}>
            + Thêm đường / hạt mới
          </button>
        )}

        {showForm && (
          <form className="road-select-form" onSubmit={handleSubmit}>
            <h2>{editingId ? "Sửa hạt / đoạn" : "Thêm hạt / đoạn mới"}</h2>
            <label className="entry-form-label" htmlFor="road-name">
              Tên đường *
            </label>
            <input
              id="road-name"
              className="sidebar-input"
              value={form.roadName}
              onChange={(e) => setForm((f) => ({ ...f, roadName: e.target.value }))}
              placeholder="VD: QL.37"
              required
            />
            <label className="entry-form-label" htmlFor="road-hat">
              Tên Hạt *
            </label>
            <input
              id="road-hat"
              className="sidebar-input"
              value={form.hat}
              onChange={(e) => setForm((f) => ({ ...f, hat: e.target.value }))}
              placeholder="VD: 1.37"
              required
            />
            <div className="road-select-km-row">
              <label className="road-select-km-field">
                <span className="entry-form-label">Km đầu *</span>
                <input
                  className="sidebar-input"
                  value={form.kmFrom}
                  onChange={(e) => setForm((f) => ({ ...f, kmFrom: e.target.value }))}
                  placeholder="356+700"
                  required
                />
              </label>
              <label className="road-select-km-field">
                <span className="entry-form-label">Km cuối *</span>
                <input
                  className="sidebar-input"
                  value={form.kmTo}
                  onChange={(e) => setForm((f) => ({ ...f, kmTo: e.target.value }))}
                  placeholder="380+000"
                  required
                />
              </label>
            </div>
            <p className="road-select-km-hint">
              Ghi dạng lý trình: <code>356+700</code> hoặc <code>Km356+700</code>. Mỗi hạt một khoảng km riêng.
            </p>
            <label className="entry-form-label" htmlFor="road-company">
              Tên công ty (trên sổ)
            </label>
            <input
              id="road-company"
              className="sidebar-input"
              value={form.company}
              onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
            />
            {error && <p className="road-select-error">{error}</p>}
            <div className="road-select-form-actions">
              <button type="submit" className="btn-primary">
                {editingId ? "Lưu thay đổi" : "Tạo và mở sổ"}
              </button>
              {roads.length > 0 && (
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
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
