import { useEffect, useMemo, useState } from "react";
import {
  loadCauRegistryForRoute,
  saveCauRegistry,
  resolveCauScope,
  writeCauScope,
  makeEmptyCauRows,
  parseCauPaste,
  CAU_REGISTRY_EVENT
} from "../utils/cauRegistryStore";
import { hydrateCauRegistriesFromCloud, pushManyCau } from "../services/cauRegistryService";
import { formatKmCell } from "../utils/matDuongFormat";
import { useAuth } from "../context/AuthContext";
import { useRoadWorkspace } from "../context/RoadWorkspaceContext";
import {
  getRoadRoutes,
  pickActiveRoute,
  routeDisplayLabel,
  routeRegistryCloudKey
} from "../utils/roadsCatalog";
import PasswordConfirmModal from "../components/PasswordConfirmModal";
import EntryRoutePicker from "../components/EntryRoutePicker";
import SidebarResizer from "../components/SidebarResizer";
import { useResizableSidebar } from "../hooks/useResizableSidebar";

function formatKm(value) {
  const v = String(value ?? "").trim();
  if (!v) return "";
  return formatKmCell(v) || v;
}

/** Danh sách cầu theo sổ đang chọn — nhiều nhánh thì chọn nhánh rồi lưu riêng. */
export default function DanhSachCau({ readOnly = false }) {
  const { profile } = useAuth();
  const { sidebarStyle, onResizeStart } = useResizableSidebar({ defaultWidth: 340 });
  const {
    roads,
    activeRoadId,
    ownerUid,
    catalogRoad,
    activeRouteId,
    routes
  } = useRoadWorkspace();
  const uid = ownerUid || profile?.uid || "";

  const activeRoad = useMemo(
    () => roads.find((r) => r.id === activeRoadId) || catalogRoad || null,
    [roads, activeRoadId, catalogRoad]
  );
  const routeList = useMemo(
    () => (routes?.length ? routes : getRoadRoutes(activeRoad)),
    [routes, activeRoad]
  );
  const activeRoute = useMemo(
    () => pickActiveRoute(routeList, activeRouteId),
    [routeList, activeRouteId]
  );
  const branchLabel = useMemo(() => {
    if (routeList.length > 1 && activeRoute) {
      return routeDisplayLabel(activeRoute) || activeRoute.roadName || "—";
    }
    return (activeRoad?.roadName || activeRoad?.label || "").trim() || "—";
  }, [routeList.length, activeRoute, activeRoad]);
  const cloudKey = useMemo(() => {
    if (routeList.length > 1 && activeRoute) {
      return routeRegistryCloudKey(activeRoute);
    }
    return (activeRoad?.roadName || activeRoad?.label || "").trim();
  }, [routeList.length, activeRoute, activeRoad]);

  const readScope = useMemo(
    () => resolveCauScope(uid, activeRoadId, activeRoute?.id || activeRouteId, routeList),
    [uid, activeRoadId, activeRoute?.id, activeRouteId, routeList]
  );
  const saveScope = useMemo(
    () => writeCauScope(uid, activeRoadId, activeRoute?.id || activeRouteId, routeList),
    [uid, activeRoadId, activeRoute?.id, activeRouteId, routeList]
  );

  const [rows, setRows] = useState(() => makeEmptyCauRows(8));
  const [pasteText, setPasteText] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingClear, setPendingClear] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function build() {
      if (!activeRoadId) {
        setRows(makeEmptyCauRows(8));
        return;
      }
      if (uid && activeRoad) {
        await hydrateCauRegistriesFromCloud(uid, [activeRoad], { force: readOnly });
      }
      if (cancelled) return;
      const list = loadCauRegistryForRoute(
        uid,
        activeRoadId,
        activeRoute,
        routeList
      ).map((item) => ({
        ...item,
        roadId: activeRoadId,
        routeId: activeRoute?.id || "",
        km: formatKm(item.km)
      }));
      setRows(
        list.length
          ? list
          : makeEmptyCauRows(8).map((x) => ({
              ...x,
              roadId: activeRoadId,
              routeId: activeRoute?.id || ""
            }))
      );
    }
    void build();
    return () => {
      cancelled = true;
    };
  }, [uid, activeRoadId, activeRoad, activeRoute?.id, readScope, readOnly, routeList]);

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
    if (!activeRoadId) {
      flash("Chưa chọn sổ đường.");
      return;
    }
    setRows((prev) => [
      ...prev,
      ...makeEmptyCauRows(5).map((x) => ({
        ...x,
        roadId: activeRoadId,
        routeId: activeRoute?.id || ""
      }))
    ]);
  }

  function applyPaste() {
    if (readOnly) return;
    if (!activeRoadId) {
      flash("Chưa chọn sổ đường. Vào «Đổi sổ» để chọn sổ trước.");
      return;
    }
    if (routeList.length > 1 && !activeRoute?.id) {
      flash("Chọn đường/nhánh trước khi nạp danh sách.");
      return;
    }
    const parsed = parseCauPaste(pasteText);
    if (!parsed.length) {
      flash(
        "Không đọc được dòng nào. VD: «Cầu Sông Cầu» [Tab] «435+200» hoặc «Cầu Sông Cầu 435+200»."
      );
      return;
    }
    const formatted = parsed.map((p) => ({
      ...p,
      km: formatKm(p.km),
      roadId: activeRoadId,
      routeId: activeRoute?.id || ""
    }));
    setRows((prev) => {
      const keep = prev.filter(
        (r) => String(r.name || "").trim() || String(r.km || "").trim()
      );
      return [...keep, ...formatted];
    });
    setPasteText("");
    flash(`Đã nạp ${parsed.length} cầu cho «${branchLabel}» — kiểm tra rồi bấm Lưu.`);
  }

  async function handleSave() {
    if (readOnly) return;
    if (!activeRoadId) {
      flash("Chưa chọn sổ đường.");
      return;
    }
    if (routeList.length > 1 && !activeRoute?.id) {
      flash("Chọn đường/nhánh trước khi lưu.");
      return;
    }
    setSaving(true);
    try {
      const list = [];
      rows.forEach((r) => {
        const name = String(r.name || "").trim();
        const km = formatKm(r.km);
        if (!name && !km) return;
        list.push({
          id: r.id,
          name,
          km,
          roadId: activeRoadId,
          routeId: activeRoute?.id || ""
        });
      });

      saveCauRegistry(saveScope, list);
      if (
        routeList.length > 1 &&
        activeRoute?.id &&
        readScope !== saveScope &&
        routeList[0]?.id === activeRoute.id
      ) {
        saveCauRegistry(readScope, []);
      }
      if (uid && cloudKey) {
        await pushManyCau(uid, { [cloudKey]: list });
      }
      window.dispatchEvent(new CustomEvent(CAU_REGISTRY_EVENT));
      flash(`Đã lưu danh sách cầu của «${branchLabel}».`);
    } catch (err) {
      console.warn(err);
      flash("Đã lưu cục bộ (chưa đồng bộ cloud).");
    } finally {
      setSaving(false);
    }
  }

  function requestClear() {
    if (readOnly) return;
    if (!activeRoadId) {
      flash("Chưa chọn sổ đường.");
      return;
    }
    setPendingClear(true);
  }

  async function confirmClear() {
    setPendingClear(false);
    if (!activeRoadId) return;
    saveCauRegistry(saveScope, []);
    setRows(
      makeEmptyCauRows(8).map((x) => ({
        ...x,
        roadId: activeRoadId,
        routeId: activeRoute?.id || ""
      }))
    );
    if (uid && cloudKey) {
      try {
        await pushManyCau(uid, { [cloudKey]: [] });
      } catch {
        /* vẫn xoá trên máy */
      }
    }
    window.dispatchEvent(new CustomEvent(CAU_REGISTRY_EVENT));
    flash(`Đã xoá danh sách cầu của «${branchLabel}».`);
  }

  return (
    <div className="hosocong-page">
      <aside className="hosocong-sidebar" style={sidebarStyle}>
        <h2 className="hosocong-title">Danh sách cầu</h2>
        <EntryRoutePicker label="Đường / nhánh" />
        <p className="section-guide section-guide--compact">
          {routeList.length > 1 ? (
            <>
              Chọn <strong>nhánh</strong> rồi nhập / lưu cầu riêng:{" "}
              <strong>{branchLabel}</strong>.
            </>
          ) : (
            <>
              Chỉ cầu của sổ đang chọn: <strong>{branchLabel}</strong>.
            </>
          )}{" "}
          Mỗi cầu: <strong>tên</strong> + <strong>một lý trình</strong>.
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
              placeholder={"Cầu Sông Cầu\t435+200\nCầu Bản Cơi\tKm316+900\nCầu Km 440 440+000"}
            />
            <div className="hosocong-actions">
              <button type="button" className="btn-secondary btn-secondary--compact" onClick={applyPaste}>
                Nạp vào bảng
              </button>
              <button type="button" className="btn-secondary btn-secondary--compact" onClick={addRows}>
                + 5 dòng
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={saving || !activeRoadId}
                onClick={() => void handleSave()}
              >
                {saving ? "Đang lưu…" : "Lưu danh sách cầu"}
              </button>
              <button
                type="button"
                className="btn-secondary btn-secondary--compact"
                disabled={saving || !activeRoadId}
                onClick={requestClear}
              >
                Xoá hết
              </button>
            </div>
          </>
        )}
        {message && <p className="hosocong-msg">{message}</p>}
      </aside>

      <SidebarResizer onMouseDown={onResizeStart} />

      <main className="hosocong-main">
        <div className="hosocong-table-wrap hosocong-table-wrap--cau">
          <table className="hosocong-table hosocong-table--cau">
            <colgroup>
              <col style={{ width: 44 }} />
              <col style={{ width: 260 }} />
              <col style={{ width: 140 }} />
              {!readOnly && <col style={{ width: 40 }} />}
            </colgroup>
            <thead>
              <tr>
                <th>STT</th>
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

      <PasswordConfirmModal
        open={pendingClear}
        title="Xoá hết danh sách cầu"
        description={`Bạn sắp xoá toàn bộ danh sách cầu của «${branchLabel}».\n\nThao tác này không hoàn tác được trên máy. Nhập mật khẩu tài khoản đang đăng nhập để xác nhận.`}
        confirmLabel="Xoá hết"
        onCancel={() => setPendingClear(false)}
        onConfirmed={() => void confirmClear()}
      />
    </div>
  );
}
