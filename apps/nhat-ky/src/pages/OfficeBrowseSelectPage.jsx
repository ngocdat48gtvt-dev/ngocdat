import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useOfficeBrowse } from "../context/OfficeBrowseContext";
import { useOfficePermissions } from "../hooks/useOfficePermissions";
import {
  fetchCompanyOfficeUsers,
  filterUsersForViewer
} from "../services/officeBrowseService";
import {
  adminAddRoadToCatalog,
  adminRemoveRoadFromCatalog,
  adminUpdateRoadInCatalog,
  fetchOfficeRoadsCatalog
} from "../services/officeRoadsCatalogService";
import { EMPTY_REPORT_META } from "../utils/nhatKyFormat";
import { formatKmDisplay, groupRoadsByName, roadDisplayLabel } from "../utils/roadsCatalog";

const EMPTY_FORM = {
  roadName: "",
  hat: "",
  kmFrom: "",
  kmTo: "",
  company: EMPTY_REPORT_META.company
};

export default function OfficeBrowseSelectPage() {
  const { profile } = useAuth();
  const { isAdmin, isViewer, canManageOfficeCatalog } = useOfficePermissions();
  const { selectedUser, pickUser, pickRoad, clearAll } = useOfficeBrowse();

  const [users, setUsers] = useState([]);
  const [roads, setRoads] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingRoads, setLoadingRoads] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const reloadRoads = useCallback(async () => {
    if (!selectedUser?.uid) {
      setRoads([]);
      return;
    }
    setLoadingRoads(true);
    try {
      const catalog = await fetchOfficeRoadsCatalog(selectedUser.uid);
      setRoads(catalog.roads || []);
    } catch (err) {
      setError(err?.message || "Không tải được danh sách hạt.");
      setRoads([]);
    } finally {
      setLoadingRoads(false);
    }
  }, [selectedUser?.uid]);

  useEffect(() => {
    let cancelled = false;
    setLoadingUsers(true);
    setError("");
    void fetchCompanyOfficeUsers(profile?.companyId)
      .then((all) => {
        if (cancelled) return;
        const list = isAdmin
          ? all
          : filterUsersForViewer(all, profile?.viewerAccess);
        setUsers(list);
        if (list.length === 1 && !selectedUser) {
          pickUser(list[0]);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.message || "Không tải được danh sách USER.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingUsers(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profile?.companyId, profile?.viewerAccess, isAdmin, pickUser, selectedUser]);

  useEffect(() => {
    void reloadRoads();
  }, [reloadRoads]);

  const grouped = useMemo(() => groupRoadsByName(roads), [roads]);
  const showUserStep = users.length !== 1;

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

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canManageOfficeCatalog || !selectedUser?.uid) return;

    const roadName = form.roadName.trim();
    const hat = form.hat.trim();
    const kmFrom = form.kmFrom.trim();
    const kmTo = form.kmTo.trim();

    if (!roadName || !hat || !kmFrom || !kmTo) {
      setError("Vui lòng nhập đủ tên đường, hạt và lý trình Km đầu/cuối.");
      return;
    }

    const payload = { ...form, roadName, hat, kmFrom, kmTo };
    setSaving(true);
    setError("");
    try {
      if (editingId) {
        await adminUpdateRoadInCatalog(selectedUser.uid, editingId, payload);
      } else {
        await adminAddRoadToCatalog(selectedUser.uid, payload);
      }
      setShowForm(false);
      setEditingId("");
      setForm(EMPTY_FORM);
      await reloadRoads();
    } catch (err) {
      setError(err?.message || "Không lưu được danh mục sổ.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(road) {
    if (!canManageOfficeCatalog || !selectedUser?.uid) return;
    if (
      !window.confirm(
        `Xóa sổ «${roadDisplayLabel(road)}» khỏi danh mục của ${selectedUser.displayName}?\n\nDữ liệu nhập trên máy USER không bị xóa tự động.`
      )
    ) {
      return;
    }
    setSaving(true);
    setError("");
    try {
      await adminRemoveRoadFromCatalog(selectedUser.uid, road.id);
      await reloadRoads();
    } catch (err) {
      setError(err?.message || "Không xóa được sổ.");
    } finally {
      setSaving(false);
    }
  }

  if (loadingUsers) {
    return (
      <div className="road-select-page">
        <div className="road-select-card road-select-card--wide">
          <p className="section-guide">Đang tải danh sách nhân viên...</p>
        </div>
      </div>
    );
  }

  if (!users.length) {
    return (
      <div className="road-select-page">
        <div className="road-select-card road-select-card--wide">
          <h1>Tra cứu sổ nội nghiệp</h1>
          <p className="road-select-sub">
            {isViewer
              ? "Tài khoản VIEWER chưa được cấp quyền xem USER nào. Liên hệ ADMIN."
              : "Chưa có USER hoạt động trong công ty."}
          </p>
        </div>
      </div>
    );
  }

  if (showUserStep && !selectedUser) {
    return (
      <div className="road-select-page">
        <div className="road-select-card road-select-card--wide">
          <h1>Chọn nhân viên</h1>
          <p className="road-select-sub">
            {isAdmin
              ? "ADMIN quản lý danh mục sổ và xem sổ của mọi USER trong công ty."
              : "Chọn USER được cấp quyền xem."}
          </p>
          {error && <p className="road-select-error">{error}</p>}
          <div className="road-select-list office-browse-user-list">
            {users.map((user) => (
              <div key={user.uid} className="road-select-item">
                <button
                  type="button"
                  className="road-select-item-main"
                  onClick={() => pickUser(user)}
                >
                  <strong>{user.displayName}</strong>
                  <span className="office-browse-user-id">{user.uid.slice(0, 8)}…</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="road-select-page">
      <div className="road-select-card road-select-card--wide">
        <h1>{canManageOfficeCatalog ? "Quản lý & chọn sổ" : "Chọn hạt / đoạn làm việc"}</h1>
        <p className="road-select-sub">
          {canManageOfficeCatalog ? (
            <>
              Đang quản lý sổ cho <strong>{selectedUser?.displayName}</strong>. Chỉ ADMIN được
              thêm, sửa, xóa danh mục hạt.
            </>
          ) : (
            <>
              Đang xem sổ của <strong>{selectedUser?.displayName}</strong>. Bấm hạt để mở sổ
              (chỉ xem).
            </>
          )}
        </p>
        {showUserStep && (
          <button type="button" className="road-select-cancel-btn office-browse-back" onClick={clearAll}>
            ← Đổi nhân viên
          </button>
        )}
        {error && <p className="road-select-error">{error}</p>}
        {loadingRoads ? (
          <p className="section-guide">Đang tải danh sách hạt...</p>
        ) : grouped.length === 0 && !showForm ? (
          <p className="section-guide">
            {canManageOfficeCatalog
              ? "USER này chưa có sổ. Bấm «+ Thêm đường / hạt mới» để tạo."
              : "USER này chưa có sổ trên hệ thống."}
          </p>
        ) : (
          <div className="road-select-groups">
            {grouped.map((group) => (
              <div key={group.roadName} className="road-select-group">
                <div className="road-select-group-head">
                  <strong>{group.roadName}</strong>
                  {canManageOfficeCatalog && (
                    <button
                      type="button"
                      className="road-select-group-add"
                      onClick={() => openCreate(group.roadName)}
                      disabled={saving}
                    >
                      + Thêm hạt
                    </button>
                  )}
                </div>
                <div className="road-select-list">
                  {group.segments.map((road) => (
                    <div key={road.id} className="road-select-item">
                      <button
                        type="button"
                        className="road-select-item-main"
                        onClick={() => pickRoad(road.id)}
                      >
                        <strong>Hạt {road.hat}</strong>
                        <span>
                          {road.kmFrom || road.kmTo
                            ? `${road.kmFrom ? formatKmDisplay(road.kmFrom) : "…"} → ${road.kmTo ? formatKmDisplay(road.kmTo) : "…"}`
                            : road.kmRange}
                        </span>
                      </button>
                      {canManageOfficeCatalog && (
                        <div className="road-select-item-actions">
                          <button
                            type="button"
                            className="road-select-mini-btn"
                            onClick={() => openEdit(road)}
                            disabled={saving}
                          >
                            Sửa
                          </button>
                          <button
                            type="button"
                            className="road-select-mini-btn road-select-mini-btn--danger"
                            onClick={() => void handleDelete(road)}
                            disabled={saving}
                          >
                            Xóa
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {canManageOfficeCatalog && !showForm && (
          <button
            type="button"
            className="btn-primary road-select-add-btn"
            onClick={() => openCreate()}
            disabled={saving}
          >
            + Thêm đường / hạt mới
          </button>
        )}

        {canManageOfficeCatalog && showForm && (
          <form className="road-select-form" onSubmit={(e) => void handleSubmit(e)}>
            <h2>{editingId ? "Sửa hạt / đoạn" : "Thêm hạt / đoạn cho USER"}</h2>
            <label className="entry-form-label" htmlFor="admin-road-name">
              Tên đường *
            </label>
            <input
              id="admin-road-name"
              className="sidebar-input"
              value={form.roadName}
              onChange={(e) => setForm((f) => ({ ...f, roadName: e.target.value }))}
              placeholder="VD: QL.37"
              required
            />
            <label className="entry-form-label" htmlFor="admin-road-hat">
              Tên Hạt *
            </label>
            <input
              id="admin-road-hat"
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
            <div className="road-select-form-actions">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? "Đang lưu..." : editingId ? "Lưu thay đổi" : "Tạo sổ"}
              </button>
              <button
                type="button"
                className="road-select-cancel-btn"
                onClick={() => {
                  setShowForm(false);
                  setEditingId("");
                  setError("");
                }}
                disabled={saving}
              >
                Hủy
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
