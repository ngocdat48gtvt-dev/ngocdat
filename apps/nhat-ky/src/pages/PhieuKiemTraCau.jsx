import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useRoadWorkspace } from "../context/RoadWorkspaceContext";
import { ViMonthInput } from "../components/ViDateInput";
import EntryRoutePicker from "../components/EntryRoutePicker";
import PhieuCauPrintPages from "../components/PhieuCauPrintPages";
import {
  loadCauRegistryForRoute,
  resolveCauScope,
  writeCauScope,
  CAU_REGISTRY_EVENT
} from "../utils/cauRegistryStore";
import { hydrateCauRegistriesFromCloud } from "../services/cauRegistryService";
import { fetchCauInspections } from "../services/cauInspectionService";
import { pickActiveRoute, getRoadRoutes, routeDisplayLabel } from "../utils/roadsCatalog";
import {
  loadCauInspectionSheet,
  saveCauInspectionSheet,
  refreshCauSheetPassedDays,
  applyPassedDaysDefaults,
  formatInspectionDate,
  syncCauInspectionsFromEntries,
  persistCauRoadUnitName,
  CAU_INSPECTION_EVENT,
  daysInMonth
} from "../utils/cauInspectionStore";
import { loadStorage, formatYearMonthVN, safeSetLocalStorage } from "../utils/nhatKyFormat";
import {
  PHIEU_CAU_COL_KEYS,
  getPhieuCauColWidths,
  usePhieuCauColWidths
} from "../hooks/usePhieuCauColWidths";
import { printPhieuCauPages } from "../utils/phieuCauPrint";
import SidebarResizer from "../components/SidebarResizer";
import { useResizableSidebar } from "../hooks/useResizableSidebar";

const MARGIN_KEY = "phieu-cau-print-margins-v1";
const DEFAULT_MARGINS = { top: 5, right: 6, bottom: 5, left: 6 };

function clampMm(v, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(40, Math.max(0, Math.round(n * 10) / 10));
}

function loadMargins() {
  try {
    const saved = JSON.parse(localStorage.getItem(MARGIN_KEY));
    if (!saved || typeof saved !== "object") return { ...DEFAULT_MARGINS };
    return {
      top: clampMm(saved.top, DEFAULT_MARGINS.top),
      right: clampMm(saved.right, DEFAULT_MARGINS.right),
      bottom: clampMm(saved.bottom, DEFAULT_MARGINS.bottom),
      left: clampMm(saved.left, DEFAULT_MARGINS.left)
    };
  } catch {
    return { ...DEFAULT_MARGINS };
  }
}

/** Chiều cao hàng body (mm) — chừa chỗ nét đáy khỏi bị cắt ở lề cuối. */
function rowHeightMm(hasTitleHeader, rowCount) {
  const pageH = 210;
  const pad = 11; // khớp padding sheet 5mm + 6mm
  const titleH = hasTitleHeader ? 32 : 0;
  const theadH = 17;
  const bottomLine = 1.2;
  const avail = pageH - pad - titleH - theadH - bottomLine;
  const n = Math.max(1, rowCount);
  return Math.max(6, Math.min(11, avail / n));
}

function currentYearMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function shiftYearMonth(yearMonth, delta) {
  const [y, m] = String(yearMonth || "").split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function ResizableTh({ colKey, children, onResizeStart, rowSpan, colSpan, className }) {
  return (
    <th rowSpan={rowSpan} colSpan={colSpan} className={className}>
      {children}
      {colKey && onResizeStart ? (
        <div
          className="col-resize-handle"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onResizeStart(colKey, e.clientX);
          }}
          title="Kéo để đổi độ rộng cột"
        />
      ) : null}
    </th>
  );
}

function CauTableHead({ onResizeStart }) {
  return (
    <thead>
      <tr>
        <ResizableTh colKey="stt" rowSpan={2} onResizeStart={onResizeStart}>
          TT
        </ResizableTh>
        <ResizableTh colKey="date" rowSpan={2} onResizeStart={onResizeStart}>
          Ngày kiểm tra
        </ResizableTh>
        <th colSpan={4}>Tuần đường</th>
        <th colSpan={3}>Tuần kiểm</th>
        <ResizableTh colKey="note" rowSpan={2} onResizeStart={onResizeStart}>
          Ghi chú
        </ResizableTh>
      </tr>
      <tr>
        <ResizableTh colKey="tdName" onResizeStart={onResizeStart}>
          Họ và tên
        </ResizableTh>
        <ResizableTh colKey="tdSign" onResizeStart={onResizeStart}>
          Chữ ký
        </ResizableTh>
        <ResizableTh colKey="damage" onResizeStart={onResizeStart}>
          Tình trạng hư hỏng
        </ResizableTh>
        <ResizableTh colKey="proposal" onResizeStart={onResizeStart}>
          Đề xuất - Kiến nghị
        </ResizableTh>
        <ResizableTh colKey="tkName" onResizeStart={onResizeStart}>
          Họ và tên
        </ResizableTh>
        <ResizableTh colKey="tkSign" onResizeStart={onResizeStart}>
          Chữ ký
        </ResizableTh>
        <ResizableTh colKey="tkProposal" onResizeStart={onResizeStart}>
          Đề xuất - Kiến nghị
        </ResizableTh>
      </tr>
    </thead>
  );
}

function CauColGroup({ widths }) {
  return (
    <colgroup>
      {PHIEU_CAU_COL_KEYS.map((key) => (
        <col key={key} style={{ width: widths[key] }} />
      ))}
    </colgroup>
  );
}

function CauTableBody({ rows, rowOffset, readOnly, updateRow }) {
  return (
    <tbody>
      {rows.map((row, i) => {
        const idx = rowOffset + i;
        return (
          <tr key={row.date || idx}>
            <td className="phieu-cau-stt">{idx + 1}</td>
            <td className="phieu-cau-date-cell">{formatInspectionDate(row.date)}</td>
            <td>
              {readOnly ? (
                row.tuanDuongName
              ) : (
                <input
                  className="phieu-cau-cell-input"
                  value={row.tuanDuongName}
                  onChange={(e) => updateRow(idx, { tuanDuongName: e.target.value })}
                />
              )}
            </td>
            <td className="phieu-cau-sign" />
            <td className="phieu-cau-damage">
              {readOnly ? (
                row.damageStatus
              ) : (
                <textarea
                  className="phieu-cau-cell-input phieu-cau-textarea"
                  rows={1}
                  value={row.damageStatus}
                  onChange={(e) => updateRow(idx, { damageStatus: e.target.value })}
                />
              )}
            </td>
            <td>
              {readOnly ? (
                row.proposal
              ) : (
                <textarea
                  className="phieu-cau-cell-input phieu-cau-textarea"
                  rows={1}
                  value={row.proposal}
                  onChange={(e) => updateRow(idx, { proposal: e.target.value })}
                />
              )}
            </td>
            <td>
              {readOnly ? (
                row.tuanKiemName
              ) : (
                <input
                  className="phieu-cau-cell-input"
                  value={row.tuanKiemName}
                  onChange={(e) => updateRow(idx, { tuanKiemName: e.target.value })}
                />
              )}
            </td>
            <td className="phieu-cau-sign" />
            <td>
              {readOnly ? (
                row.tuanKiemProposal
              ) : (
                <textarea
                  className="phieu-cau-cell-input phieu-cau-textarea"
                  rows={1}
                  value={row.tuanKiemProposal}
                  onChange={(e) => updateRow(idx, { tuanKiemProposal: e.target.value })}
                />
              )}
            </td>
            <td>
              {readOnly ? (
                row.note
              ) : (
                <input
                  className="phieu-cau-cell-input"
                  value={row.note}
                  onChange={(e) => updateRow(idx, { note: e.target.value })}
                />
              )}
            </td>
          </tr>
        );
      })}
    </tbody>
  );
}

function CauSheetTable({
  rows,
  rowOffset,
  readOnly,
  updateRow,
  widths,
  onResizeStart,
  rowHMm
}) {
  return (
    <div className="phieu-cau-table-wrap">
      <table
        className="phieu-cau-table phieu-cau-table--excel"
        style={{ "--phieu-row-h": `${rowHMm}mm` }}
      >
        <CauColGroup widths={widths} />
        <CauTableHead onResizeStart={onResizeStart} />
        <CauTableBody
          rows={rows}
          rowOffset={rowOffset}
          readOnly={readOnly}
          updateRow={updateRow}
        />
      </table>
    </div>
  );
}

/** Phiếu kiểm tra cầu — A4 ngang, 2 trang; form trái gọn kiểu sổ trực ĐBGT. */
export default function PhieuKiemTraCau({ readOnly = false, storageTick = 0 }) {
  const { profile } = useAuth();
  const {
    activeRoad,
    activeRoadId,
    storageKey,
    ownerUid,
    browseMode,
    activeRouteId,
    routes,
    catalogRoad
  } = useRoadWorkspace();
  const uid = ownerUid || profile?.uid || "";
  const roadLabel = (activeRoad?.roadName || activeRoad?.label || "").trim();
  const routeList = useMemo(
    () => (routes?.length ? routes : getRoadRoutes(catalogRoad || activeRoad)),
    [routes, catalogRoad, activeRoad]
  );
  const activeRoute = useMemo(
    () => pickActiveRoute(routeList, activeRouteId),
    [routeList, activeRouteId]
  );
  const routeId = activeRoute?.id || activeRouteId || "";
  const multiRoute = routeList.length > 1;
  /** Scope đọc danh sách cầu theo nhánh (sau hydrate ưu tiên key nhánh). */
  const cauListScope = useMemo(() => {
    if (!uid || !activeRoadId) return "";
    if (multiRoute && routeId) {
      return writeCauScope(uid, activeRoadId, routeId, routeList);
    }
    return resolveCauScope(uid, activeRoadId, routeId, routeList);
  }, [uid, activeRoadId, routeId, multiRoute, routeList]);

  const { sidebarStyle, onResizeStart } = useResizableSidebar({ defaultWidth: 340 });
  const { widths: colWidths, startColumnResize } = usePhieuCauColWidths();

  const [bridges, setBridges] = useState([]);
  const [bridgeId, setBridgeId] = useState("");
  const [yearMonth, setYearMonth] = useState(currentYearMonth);
  const [sheet, setSheet] = useState(() => loadCauInspectionSheet("", "", "", ""));
  const [message, setMessage] = useState("");
  const [printOpen, setPrintOpen] = useState(false);
  /** "one" = cầu đang chọn · "all" = tất cả cầu trong tháng */
  const [printScope, setPrintScope] = useState("one");
  const [margins, setMargins] = useState(loadMargins);
  const [printColWidths, setPrintColWidths] = useState(getPhieuCauColWidths);

  useEffect(() => {
    safeSetLocalStorage(MARGIN_KEY, margins);
  }, [margins]);

  useEffect(() => {
    if (printOpen) setPrintColWidths(getPhieuCauColWidths());
  }, [printOpen]);

  useEffect(() => {
    // Đổi nhánh → xóa list cũ ngay, tránh hiện cầu nhánh trước
    setBridges([]);
    setBridgeId("");
  }, [cauListScope]);

  useEffect(() => {
    let cancelled = false;

    async function reloadBridges() {
      if (!uid || !activeRoadId) {
        if (!cancelled) setBridges([]);
        return;
      }

      // Hydrate theo catalog (đủ routes) — không dùng activeRoad gộp
      const roadForHydrate = catalogRoad || activeRoad;
      if (roadForHydrate) {
        try {
          await hydrateCauRegistriesFromCloud(uid, [roadForHydrate], {
            force: browseMode
          });
        } catch {
          /* giữ list local */
        }
      }
      if (cancelled) return;

      let list = loadCauRegistryForRoute(uid, activeRoadId, activeRoute, routeList);

      // Chỉ sổ 1 nhánh mới suy cầu từ phiếu cloud (tránh lẫn cầu mọi nhánh)
      if (!list.length && !multiRoute) {
        try {
          const sheets = await fetchCauInspections(uid, activeRoadId);
          if (cancelled) return;
          const byId = new Map();
          Object.entries(sheets || {}).forEach(([id, s]) => {
            const bid = String(s?.bridgeId || id.split("__")[0] || "").trim();
            if (!bid || byId.has(bid)) return;
            byId.set(bid, {
              id: bid,
              name: String(s?.bridgeName || "").trim() || bid,
              km: String(s?.km || "").trim()
            });
          });
          list = [...byId.values()];
        } catch {
          /* ignore */
        }
      }

      if (!cancelled) setBridges(list);
    }

    void reloadBridges();
    function onRegistry() {
      if (!uid || !activeRoadId) return;
      setBridges(loadCauRegistryForRoute(uid, activeRoadId, activeRoute, routeList));
    }
    window.addEventListener(CAU_REGISTRY_EVENT, onRegistry);
    return () => {
      cancelled = true;
      window.removeEventListener(CAU_REGISTRY_EVENT, onRegistry);
    };
  }, [
    uid,
    activeRoadId,
    catalogRoad,
    activeRoad,
    browseMode,
    storageTick,
    cauListScope,
    multiRoute,
    routeId,
    routeList,
    activeRoute
  ]);

  useEffect(() => {
    if (!bridges.length) {
      if (bridgeId) setBridgeId("");
      return;
    }
    if (!bridges.some((b) => b.id === bridgeId)) {
      setBridgeId(bridges[0].id);
    }
  }, [bridges, bridgeId]);

  const branchLabel = useMemo(() => {
    if (routeList.length > 1 && activeRoute) {
      return routeDisplayLabel(activeRoute) || activeRoute.roadName || "—";
    }
    return roadLabel || "—";
  }, [routeList.length, activeRoute, roadLabel]);

  const selected = useMemo(
    () => bridges.find((b) => b.id === bridgeId) || null,
    [bridges, bridgeId]
  );

  useEffect(() => {
    // Chỉ USER mới đồng bộ hư hỏng từ nhật ký → phiếu (tránh admin ghi đè)
    if (readOnly || browseMode) return;
    if (!uid || !activeRoadId || !storageKey || !bridges.length) return;
    const { entries } = loadStorage(storageKey);
    const name = profile?.displayName || profile?.email || "";
    syncCauInspectionsFromEntries(uid, activeRoadId, bridges, entries, name);
  }, [
    uid,
    activeRoadId,
    storageKey,
    storageTick,
    bridges,
    profile?.displayName,
    profile?.email,
    readOnly,
    browseMode
  ]);

  useEffect(() => {
    if (!uid || !activeRoadId || !bridgeId || !yearMonth) {
      setSheet(loadCauInspectionSheet("", "", "", ""));
      return;
    }
    let s = loadCauInspectionSheet(uid, activeRoadId, bridgeId, yearMonth);
    if (!s.unitName && roadLabel) s = { ...s, unitName: roadLabel };
    const patch = {
      ...s,
      bridgeName: selected?.name || s.bridgeName,
      km: selected?.km || s.km
    };
    if (readOnly || browseMode) {
      setSheet(applyPassedDaysDefaults(patch));
      return;
    }
    setSheet(refreshCauSheetPassedDays(uid, activeRoadId, bridgeId, yearMonth, patch));
  }, [
    uid,
    activeRoadId,
    bridgeId,
    yearMonth,
    storageTick,
    selected?.name,
    selected?.km,
    roadLabel,
    readOnly,
    browseMode
  ]);

  useEffect(() => {
    function onChanged() {
      if (!uid || !activeRoadId || !bridgeId || !yearMonth) return;
      const loaded = loadCauInspectionSheet(uid, activeRoadId, bridgeId, yearMonth);
      setSheet(applyPassedDaysDefaults(loaded));
    }
    window.addEventListener(CAU_INSPECTION_EVENT, onChanged);
    return () => window.removeEventListener(CAU_INSPECTION_EVENT, onChanged);
  }, [uid, activeRoadId, bridgeId, yearMonth]);

  function flash(msg) {
    setMessage(msg);
    window.setTimeout(() => setMessage(""), 2200);
  }

  function updateMeta(field, value) {
    if (readOnly) return;
    // Không trim/save mỗi lần gõ — giữ khoảng trắng khi nhập họ tên / đơn vị
    if (field === "tuanDuongDefault" || field === "tuanKiemDefault") {
      setSheet((prev) =>
        applyPassedDaysDefaults({
          ...prev,
          [field]: value,
          bridgeName: selected?.name || prev.bridgeName,
          km: selected?.km || prev.km
        })
      );
      return;
    }
    setSheet((prev) => ({ ...prev, [field]: value }));
  }

  /** Đơn vị QL: lưu chung sổ (mọi cầu / mọi tháng) ngay khi rời ô hoặc bấm Lưu. */
  function commitUnitName(raw) {
    if (readOnly || !uid || !activeRoadId) return;
    const name = persistCauRoadUnitName(uid, activeRoadId, raw);
    setSheet((prev) => ({ ...prev, unitName: name }));
  }

  function updateRow(index, patch) {
    if (readOnly) return;
    setSheet((prev) => ({
      ...prev,
      rows: prev.rows.map((r, i) => {
        if (i !== index) return r;
        const next = { ...r, ...patch };
        if (patch.damageStatus != null) next.autoNoDamage = false;
        return next;
      })
    }));
  }

  function handleSave() {
    if (readOnly || !uid || !activeRoadId || !bridgeId) return;
    commitUnitName(sheet.unitName);
    const saved = saveCauInspectionSheet(uid, activeRoadId, bridgeId, yearMonth, {
      ...sheet,
      bridgeName: selected?.name || sheet.bridgeName,
      km: selected?.km || sheet.km
    });
    setSheet(refreshCauSheetPassedDays(uid, activeRoadId, bridgeId, yearMonth, saved));
    flash("Đã lưu phiếu kiểm tra cầu (đơn vị QL dùng chung mọi tháng).");
  }

  const printItems = useMemo(() => {
    if (!printOpen || !bridges.length || !uid || !activeRoadId || !yearMonth) {
      return [];
    }
    const list =
      printScope === "all"
        ? bridges
        : bridges.filter((b) => b.id === bridgeId);
    return list.map((b) => {
      let s = loadCauInspectionSheet(uid, activeRoadId, b.id, yearMonth);
      if (!s.unitName && roadLabel) s = { ...s, unitName: roadLabel };
      return {
        bridge: b,
        sheet: applyPassedDaysDefaults({
          ...s,
          bridgeName: b.name || s.bridgeName,
          km: b.km || s.km
        })
      };
    });
  }, [
    printOpen,
    printScope,
    bridges,
    bridgeId,
    uid,
    activeRoadId,
    yearMonth,
    roadLabel,
    storageTick
  ]);

  const printPageCount = printItems.length * 2;

  const dayCount = daysInMonth(yearMonth);
  const splitAt = Math.ceil(dayCount / 2);
  const page1Rows = (sheet.rows || []).slice(0, splitAt);
  const page2Rows = (sheet.rows || []).slice(splitAt);
  const page1RowH = rowHeightMm(true, page1Rows.length || 1);
  const page2RowH = rowHeightMm(false, page2Rows.length || 1);
  const sheetNo = Number(String(yearMonth || "").split("-")[1]) || "";

  return (
    <div className={`phieu-cau-page${printOpen ? " phieu-cau-page--print" : ""}`}>
      <aside
        className="phieu-cau-sidebar no-print"
        style={sidebarStyle}
      >
        <div className="sidebar-sticky-head">
          <h2 className="sidebar-title">Phiếu kiểm tra cầu</h2>
          <EntryRoutePicker label="Đường / nhánh" />
          {routeList.length > 1 ? (
            <p className="section-guide section-guide--compact">
              Danh sách cầu theo nhánh: <strong>{branchLabel}</strong>
            </p>
          ) : null}
          <div className="sonhatky-date-toolbar phieu-cau-date-toolbar">
            <div className="sonhatky-day-buttons">
              <button
                type="button"
                className="btn-primary btn-primary--compact sonhatky-nav-btn"
                title="Tháng trước"
                onClick={() => setYearMonth((ym) => shiftYearMonth(ym, -1))}
              >
                ◀
              </button>
              <button
                type="button"
                className="btn-primary btn-primary--compact sonhatky-nav-btn"
                title="Tháng sau"
                onClick={() => setYearMonth((ym) => shiftYearMonth(ym, 1))}
              >
                ▶
              </button>
            </div>
            <ViMonthInput
              value={yearMonth}
              onChange={setYearMonth}
              className="sidebar-input sidebar-input--date"
              aria-label="Chọn tháng"
            />
          </div>

          {!printOpen && (
            <>
              <label className="hosocong-label">Đơn vị nhận quản lý duy tu bảo dưỡng</label>
              <input
                className="hosocong-input"
                value={sheet.unitName || ""}
                disabled={readOnly}
                onChange={(e) => updateMeta("unitName", e.target.value)}
                onBlur={(e) => commitUnitName(e.target.value)}
                placeholder="VD: Hạt 1.37 Công ty CP QLSC…"
              />
              <p className="sidebar-hint" style={{ marginTop: 4, fontSize: "0.8rem" }}>
                Lưu chung cả sổ — mọi cầu, mọi tháng (Firebase).
              </p>

              <label className="hosocong-label">Cầu</label>
              <select
                className="hosocong-input"
                value={bridgeId}
                onChange={(e) => setBridgeId(e.target.value)}
              >
                {!bridges.length && <option value="">— Chưa có cầu —</option>}
                {bridges.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name || "—"} ({b.km || "chưa LT"})
                  </option>
                ))}
              </select>

              <label className="hosocong-label">Họ tên tuần đường</label>
              <input
                className="hosocong-input"
                value={sheet.tuanDuongDefault || ""}
                disabled={readOnly}
                onChange={(e) => updateMeta("tuanDuongDefault", e.target.value)}
                placeholder="Nhập họ tên"
              />

              <label className="hosocong-label">Họ tên tuần kiểm</label>
              <input
                className="hosocong-input"
                value={sheet.tuanKiemDefault || ""}
                disabled={readOnly}
                onChange={(e) => updateMeta("tuanKiemDefault", e.target.value)}
                placeholder="Nhập họ tên"
              />

              <div className="hosocong-actions" style={{ marginTop: 10 }}>
                {!readOnly && (
                  <button
                    type="button"
                    className="btn-primary btn-primary--compact"
                    onClick={handleSave}
                  >
                    Lưu phiếu
                  </button>
                )}
              </div>
              {message && <p className="hosocong-msg">{message}</p>}
            </>
          )}

          <button
            type="button"
            className={`btn-secondary sonhatky-edit-btn${printOpen ? " active" : ""}`}
            style={{ marginTop: 10, width: "100%" }}
            onClick={() => setPrintOpen((v) => !v)}
            disabled={!bridges.length}
          >
            {printOpen ? "Đóng xem trước in" : "Xem trước in theo tháng"}
          </button>
        </div>

        {printOpen && (
          <div className="sidebar-scroll">
            <div className="print-form-panel">
              <div className="print-form-label">In theo tháng</div>
              <label className="hosocong-label">Phạm vi in</label>
              <select
                className="hosocong-input"
                value={printScope}
                onChange={(e) => setPrintScope(e.target.value)}
              >
                <option value="one">
                  Từng cầu — {selected?.name || "cầu đang chọn"}
                </option>
                <option value="all">Tất cả các cầu ({bridges.length})</option>
              </select>
              {printScope === "one" && (
                <>
                  <label className="hosocong-label">Cầu in</label>
                  <select
                    className="hosocong-input"
                    value={bridgeId}
                    onChange={(e) => setBridgeId(e.target.value)}
                  >
                    {bridges.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name || "—"} ({b.km || "chưa LT"})
                      </option>
                    ))}
                  </select>
                </>
              )}
              <ul className="print-form-tips">
                <li>Khổ A4 ngang (297 × 210 mm)</li>
                <li>Mỗi cầu = 2 tờ (nửa tháng / tờ)</li>
                <li>Kéo lề xanh trên tờ đầu bằng chuột</li>
                <li>
                  {printScope === "all"
                    ? `${bridges.length} cầu · ${printPageCount} tờ`
                    : `1 cầu · ${printPageCount} tờ`}
                </li>
              </ul>
            </div>
          </div>
        )}
      </aside>

      <SidebarResizer onMouseDown={onResizeStart} />

      <main className="phieu-cau-main">
        {printOpen ? (
          <div className="sonhatky-print-preview-pane landscape-print-preview-pane">
            <div className="sonhatky-print-toolbar print-toolbar no-print">
              <div className="print-toolbar-main">
                <div className="print-toolbar-kicker">Xem trước in · A4 ngang</div>
                <div className="print-toolbar-chips">
                  <span className="print-chip">{formatYearMonthVN(yearMonth)}</span>
                  <span className="print-chip">
                    {printScope === "all"
                      ? `${printItems.length} cầu`
                      : selected?.name || "1 cầu"}
                  </span>
                  <span className="print-chip">{printPageCount} tờ</span>
                  <span className="print-chip print-chip--muted">
                    Lề {margins.top}/{margins.right}/{margins.bottom}/{margins.left} mm
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="btn-primary btn-primary--compact print-toolbar-action"
                onClick={() => printPhieuCauPages(margins, printColWidths)}
                disabled={!printItems.length}
              >
                {printScope === "all" ? "In tất cả cầu" : "In cầu này"}
              </button>
            </div>
            <PhieuCauPrintPages
              items={printItems}
              yearMonth={yearMonth}
              margins={margins}
              onMarginsChange={setMargins}
              widths={printColWidths}
            />
          </div>
        ) : !selected ? (
          <p className="section-guide">Chọn cầu hoặc thêm cầu ở tab Danh sách cầu.</p>
        ) : (
          <div className="phieu-cau-a4 phieu-cau-a4--landscape">
            <div className="phieu-cau-sheet phieu-cau-sheet--landscape phieu-cau-sheet--page1">
              <div className="phieu-cau-header">
                <div className="phieu-cau-org">SỞ XÂY DỰNG</div>
                <div className="phieu-cau-org">BAN QUẢN LÝ BẢO TRÌ ĐƯỜNG BỘ</div>
                <h1 className="phieu-cau-title">
                  PHIẾU KIỂM TRA THƯỜNG XUYÊN CẦU TỜ SỐ {sheetNo || "…"}
                </h1>
                <p className="phieu-cau-meta phieu-cau-meta--unit">
                  <span className="phieu-cau-meta-label">
                    Đơn vị nhận quản lý duy tu bảo dưỡng:{" "}
                  </span>
                  {readOnly ? (
                    <strong className="phieu-cau-unit-value">
                      {sheet.unitName || roadLabel || "……………………"}
                    </strong>
                  ) : (
                    <input
                      className="phieu-cau-inline-input phieu-cau-inline-input--full"
                      value={sheet.unitName || ""}
                      onChange={(e) => updateMeta("unitName", e.target.value)}
                      onBlur={(e) => commitUnitName(e.target.value)}
                    />
                  )}
                </p>
                <p className="phieu-cau-meta">
                  Tên cầu: <strong>{selected.name || "—"}</strong>
                  {" · "}
                  Lý trình: <strong>{selected.km || "—"}</strong>
                </p>
              </div>
              <CauSheetTable
                rows={page1Rows}
                rowOffset={0}
                readOnly={readOnly}
                updateRow={updateRow}
                widths={colWidths}
                onResizeStart={readOnly ? undefined : startColumnResize}
                rowHMm={page1RowH}
              />
            </div>

            <div className="phieu-cau-sheet phieu-cau-sheet--landscape phieu-cau-sheet--page2">
              <CauSheetTable
                rows={page2Rows}
                rowOffset={splitAt}
                readOnly={readOnly}
                updateRow={updateRow}
                widths={colWidths}
                onResizeStart={readOnly ? undefined : startColumnResize}
                rowHMm={page2RowH}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
