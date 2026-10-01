import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useOfficeBrowse } from "../context/OfficeBrowseContext";
import { useOfficePermissions } from "../hooks/useOfficePermissions";
import {
  fallbackCompaniesFromIds,
  fetchCompaniesByIds,
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
import { getRoadRoutes, groupRoadsByHat, normalizeRoute, uniquifyRouteIds, roadDisplayLabel } from "../utils/roadsCatalog";
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

export default function OfficeBrowseSelectPage() {
  const { profile } = useAuth();
  const { isAdmin, isViewer, isSoXd, canManageOfficeCatalog } = useOfficePermissions();
  const { selectedCompany, selectedUser, selectedRoadId, pickCompany, pickUser, pickRoad, clearAll } =
    useOfficeBrowse();

  const [companies, setCompanies] = useState([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const soXdCompanyIdsKey = (profile?.soXdAccess?.companyIds || []).join("|");
  const [users, setUsers] = useState([]);
  const [roads, setRoads] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingRoads, setLoadingRoads] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

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
      const msg = String(err?.message || "");
      setError(
        /permission|insufficient/i.test(msg)
          ? "Không đọc được danh mục sổ của USER này (quyền Firestore)."
          : msg || "Không tải được danh sách tuần đường."
      );
    } finally {
      setLoadingRoads(false);
    }
  }, [selectedUser?.uid]);

  useEffect(() => {
    if (!isSoXd) {
      setCompanies([]);
      setLoadingCompanies(false);
      return undefined;
    }
    let cancelled = false;
    const fallback = fallbackCompaniesFromIds(soXdCompanyIdsKey.split("|").filter(Boolean));
    if (!fallback.length) setLoadingCompanies(true);
    else {
      setLoadingCompanies(false);
      setCompanies((prev) => (prev.length ? prev : fallback));
    }
    void fetchCompaniesByIds(fallback.map((c) => c.companyId))
      .then((list) => {
        if (cancelled) return;
        setError("");
        setCompanies(list.length ? list : fallback);
      })
      .catch((err) => {
        if (!cancelled) {
          setCompanies(fallback);
          if (!fallback.length) {
            setError(err?.message || "Không tải được danh sách công ty.");
          }
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingCompanies(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isSoXd, soXdCompanyIdsKey]);

  useEffect(() => {
    if (!isSoXd || selectedCompany || companies.length !== 1) return;
    pickCompany(companies[0]);
  }, [isSoXd, selectedCompany, companies, pickCompany]);

  const browseCompanyId = isSoXd ? selectedCompany?.companyId : profile?.companyId;

  useEffect(() => {
    let cancelled = false;
    if (isSoXd && !browseCompanyId) {
      setUsers([]);
      setLoadingUsers(false);
      return undefined;
    }
    setLoadingUsers(true);
    setError("");
    void fetchCompanyOfficeUsers(browseCompanyId)
      .then((all) => {
        if (cancelled) return;
        const list =
          isAdmin || isSoXd ? all : filterUsersForViewer(all, profile?.viewerAccess);
        setUsers(list);
        if (list.length === 1) {
          pickUser(list[0]);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const msg = String(err?.message || "");
          setError(
            /permission|insufficient/i.test(msg)
              ? "Chưa có quyền đọc sổ công ty. Deploy Firestore rules rồi đăng nhập lại."
              : msg || "Không tải được danh sách USER."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingUsers(false);
      });
    return () => {
      cancelled = true;
    };
  }, [browseCompanyId, profile?.viewerAccess, isAdmin, isSoXd, pickUser]);

  useEffect(() => {
    void reloadRoads();
  }, [reloadRoads]);

  const grouped = useMemo(() => groupRoadsByHat(roads), [roads]);
  const showUserStep = users.length !== 1;

  function openCreate(prefillHat = "") {
    setEditingId("");
    setForm({ ...EMPTY_FORM, hat: prefillHat, routes: [emptyRoute()] });
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

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canManageOfficeCatalog || !selectedUser?.uid) return;

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
      setError("Cần ít nhất một đường/nhánh.");
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
      company: String(form.company || "").trim(),
      routes,
      roadName: routes[0].roadName,
      kmFrom: routes[0].kmFrom,
      kmTo: routes[0].kmTo
    };
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

  function handleDelete(road) {
    if (!canManageOfficeCatalog || !selectedUser?.uid) return;
    setPendingDelete(road);
  }

  async function confirmDeleteRoad() {
    if (!pendingDelete || !selectedUser?.uid) return;
    setSaving(true);
    setError("");
    try {
      await adminRemoveRoadFromCatalog(selectedUser.uid, pendingDelete.id);
      setPendingDelete(null);
      await reloadRoads();
    } catch (err) {
      setError(err?.message || "Không xóa được sổ.");
      // Giữ modal mở — PasswordConfirmModal sẽ hiện lỗi nếu throw
      throw new Error(err?.message || "Không xóa được sổ.");
    } finally {
      setSaving(false);
    }
  }

  if (isSoXd && loadingCompanies && !selectedCompany) {
    return (
      <div className="road-select-page">
        <div className="road-select-card road-select-card--wide">
          <p className="section-guide">Đang tải danh sách công ty...</p>
        </div>
      </div>
    );
  }

  if (isSoXd && !selectedCompany) {
    return (
      <div className="road-select-page">
        <div className="road-select-card road-select-card--wide">
          <h1>Chọn công ty</h1>
          <p className="road-select-sub">
            Sở Xây dựng xem sổ nội nghiệp (chỉ xem, không sửa) của công ty được cấp.
          </p>
          {error && <p className="road-select-error">{error}</p>}
          {!companies.length ? (
            <p className="section-guide">
              Tài khoản chưa được cấp công ty nào. Liên hệ người quản lý license.
            </p>
          ) : (
            <div className="road-select-list office-browse-user-list">
              {companies.map((c) => (
                <div key={c.companyId} className="road-select-item">
                  <button
                    type="button"
                    className="road-select-item-main"
                    onClick={() => pickCompany(c)}
                  >
                    <strong>{c.companyName}</strong>
                    <span className="office-browse-user-id">{c.companyId}</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (loadingUsers && !selectedUser) {
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
            {isSoXd
              ? "Công ty này chưa có USER hoạt động."
              : isViewer
                ? "Tài khoản VIEWER chưa được cấp quyền xem USER nào. Liên hệ ADMIN."
                : "Chưa có USER hoạt động trong công ty."}
          </p>
          {isSoXd && companies.length > 1 && (
            <button
              type="button"
              className="road-select-cancel-btn office-browse-back"
              onClick={() => pickCompany(null)}
            >
              ← Đổi công ty
            </button>
          )}
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
            {isSoXd
              ? `Công ty: ${selectedCompany?.companyName || browseCompanyId}. Chỉ xem sổ, không sửa.`
              : isAdmin
                ? "ADMIN quản lý danh mục sổ và xem sổ của mọi USER trong công ty."
                : "Chọn USER được cấp quyền xem."}
          </p>
          {isSoXd && companies.length > 1 && (
            <button
              type="button"
              className="road-select-cancel-btn office-browse-back"
              onClick={() => pickCompany(null)}
            >
              ← Đổi công ty
            </button>
          )}
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
        <h1>{canManageOfficeCatalog ? "Quản lý & chọn sổ" : "Chọn tuần đường / đoạn làm việc"}</h1>
        <p className="road-select-sub">
          {canManageOfficeCatalog ? (
            <>
              Đang quản lý sổ cho <strong>{selectedUser?.displayName}</strong>. Chỉ ADMIN được
              thêm, sửa, xóa danh mục tuần đường. Tách/Gộp đường chỉnh trong từng sổ sau khi mở.
            </>
          ) : (
            <>
              Đang xem sổ của <strong>{selectedUser?.displayName}</strong>
              {isSoXd && selectedCompany?.companyName
                ? ` · ${selectedCompany.companyName}`
                : ""}
              . Bấm sổ để mở (chỉ xem).
            </>
          )}
        </p>
        {showUserStep && (
          <button type="button" className="road-select-cancel-btn office-browse-back" onClick={clearAll}>
            ← Đổi nhân viên
          </button>
        )}
        {isSoXd && companies.length > 1 && (
          <button
            type="button"
            className="road-select-cancel-btn office-browse-back"
            onClick={() => pickCompany(null)}
          >
            ← Đổi công ty
          </button>
        )}
        {error && <p className="road-select-error">{error}</p>}
        {selectedRoadId ? (
          <p className="section-guide">Đang mở sổ tuần đường...</p>
        ) : null}
        {loadingRoads ? (
          <p className="section-guide">Đang tải danh sách tuần đường...</p>
        ) : grouped.length === 0 && !showForm ? (
          <p className="section-guide">
            {canManageOfficeCatalog
              ? "USER này chưa có sổ. Bấm «+ Thêm sổ tuần đường» để tạo."
              : "USER này chưa có sổ trên hệ thống."}
          </p>
        ) : (
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
                      disabled={saving}
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
                          onClick={() => pickRoad(road.id)}
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
                    );
                  })}
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
            + Thêm sổ tuần đường
          </button>
        )}

        {canManageOfficeCatalog && showForm && (
          <form className="road-select-form" onSubmit={(e) => void handleSubmit(e)}>
            <h2>{editingId ? "Sửa sổ tuần đường" : "Thêm sổ tuần đường cho USER"}</h2>
            <label className="entry-form-label" htmlFor="admin-road-hat">
              Tên hạt *
            </label>
            <input
              id="admin-road-hat"
              className="sidebar-input"
              value={form.hat}
              onChange={(e) => setForm((f) => ({ ...f, hat: e.target.value }))}
              placeholder="VD: Lưu Trọng Nghĩa"
              required
            />
            <label className="entry-form-label" htmlFor="admin-road-company">
              Tên công ty (trên đầu sổ)
            </label>
            <textarea
              id="admin-road-company"
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
              Nhiều cung cùng tên nhưng khác km → thêm từng dòng để phân biệt. Km dạng{" "}
              <code>0</code> / <code>13+200</code>.
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

      <PasswordConfirmModal
        open={Boolean(pendingDelete)}
        title="Xóa sổ — nhập mật khẩu"
        description={
          pendingDelete
            ? `Bạn sắp xóa sổ «${roadDisplayLabel(pendingDelete)}» khỏi danh mục của ${
                selectedUser?.displayName || "USER"
              }. Dữ liệu nhập trên máy USER không bị xóa tự động. Nhập mật khẩu để xác nhận.`
            : ""
        }
        confirmLabel="Xóa sổ"
        onCancel={() => setPendingDelete(null)}
        onConfirmed={() => confirmDeleteRoad()}
      />
    </div>
  );
}
