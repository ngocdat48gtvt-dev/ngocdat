import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useRoadWorkspace } from "../context/RoadWorkspaceContext";
import { ViMonthInput } from "../components/ViDateInput";
import {
  loadCauRegistry,
  setCauRegistry,
  cauScope,
  CAU_REGISTRY_EVENT
} from "../utils/cauRegistryStore";
import { fetchAllCau } from "../services/cauRegistryService";
import { fetchCauInspections } from "../services/cauInspectionService";
import {
  loadCauInspectionSheet,
  saveCauInspectionSheet,
  refreshCauSheetPassedDays,
  applyPassedDaysDefaults,
  formatInspectionDate,
  syncCauInspectionsFromEntries,
  CAU_INSPECTION_EVENT,
  daysInMonth
} from "../utils/cauInspectionStore";
import { loadStorage } from "../utils/nhatKyFormat";
import {
  PHIEU_CAU_COL_KEYS,
  usePhieuCauColWidths
} from "../hooks/usePhieuCauColWidths";

const SIDEBAR_WIDTH = 340;

/** Chiều cao hàng body (mm) để bảng chiếm hết phần còn lại của A4 ngang. */
function rowHeightMm(hasTitleHeader, rowCount) {
  const pageH = 210;
  const pad = 14;
  const titleH = hasTitleHeader ? 30 : 0;
  const theadH = 13;
  const avail = pageH - pad - titleH - theadH;
  const n = Math.max(1, rowCount);
  return Math.max(7.2, Math.min(12.5, avail / n));
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
  const { activeRoad, activeRoadId, storageKey, ownerUid, browseMode } = useRoadWorkspace();
  const uid = ownerUid || profile?.uid || "";
  const roadLabel = (activeRoad?.roadName || activeRoad?.label || "").trim();
  const { widths: colWidths, startColumnResize } = usePhieuCauColWidths();

  const [bridges, setBridges] = useState([]);
  const [bridgeId, setBridgeId] = useState("");
  const [yearMonth, setYearMonth] = useState(currentYearMonth);
  const [sheet, setSheet] = useState(() => loadCauInspectionSheet("", "", "", ""));
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function reloadBridges() {
      if (!uid || !activeRoadId) {
        if (!cancelled) setBridges([]);
        return;
      }
      const scope = cauScope(uid, activeRoadId);
      let list = loadCauRegistry(scope);

      // ADMIN/VIEWER browse (hoặc local trống): lấy danh sách cầu từ cloud của user
      if (browseMode || !list.length) {
        try {
          const cloud = await fetchAllCau(uid);
          if (cancelled) return;
          const byName = cloud[roadLabel] || [];
          if (byName.length) {
            setCauRegistry(scope, byName);
            list = byName;
          }
        } catch {
          /* giữ list local */
        }
      }

      // Fallback: suy ra cầu từ phiếu đã lưu trên cloud
      if (!list.length) {
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
      setBridges(loadCauRegistry(cauScope(uid, activeRoadId)));
    }
    window.addEventListener(CAU_REGISTRY_EVENT, onRegistry);
    return () => {
      cancelled = true;
      window.removeEventListener(CAU_REGISTRY_EVENT, onRegistry);
    };
  }, [uid, activeRoadId, roadLabel, browseMode, storageTick]);

  useEffect(() => {
    if (!bridgeId && bridges[0]?.id) setBridgeId(bridges[0].id);
  }, [bridges, bridgeId]);

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
    const saved = saveCauInspectionSheet(uid, activeRoadId, bridgeId, yearMonth, {
      ...sheet,
      bridgeName: selected?.name || sheet.bridgeName,
      km: selected?.km || sheet.km
    });
    setSheet(refreshCauSheetPassedDays(uid, activeRoadId, bridgeId, yearMonth, saved));
    flash("Đã lưu phiếu kiểm tra cầu.");
  }

  function handlePrint() {
    document.body.classList.add("phieu-cau-printing");
    const cleanup = () => {
      document.body.classList.remove("phieu-cau-printing");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.setTimeout(() => window.print(), 50);
  }

  const dayCount = daysInMonth(yearMonth);
  const splitAt = Math.ceil(dayCount / 2);
  const page1Rows = (sheet.rows || []).slice(0, splitAt);
  const page2Rows = (sheet.rows || []).slice(splitAt);
  const page1RowH = rowHeightMm(true, page1Rows.length || 1);
  const page2RowH = rowHeightMm(false, page2Rows.length || 1);
  const sheetNo = Number(String(yearMonth || "").split("-")[1]) || "";

  return (
    <div className="phieu-cau-page">
      <aside
        className="phieu-cau-sidebar no-print"
        style={{ width: SIDEBAR_WIDTH, minWidth: SIDEBAR_WIDTH, maxWidth: SIDEBAR_WIDTH }}
      >
        <div className="sidebar-sticky-head">
          <h2 className="sidebar-title">Phiếu kiểm tra cầu</h2>
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

          <label className="hosocong-label">Đơn vị nhận quản lý duy tu bảo dưỡng</label>
          <input
            className="hosocong-input"
            value={sheet.unitName || ""}
            disabled={readOnly}
            onChange={(e) => updateMeta("unitName", e.target.value)}
            placeholder="Ví dụ: QL.37"
          />

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
              <button type="button" className="btn-primary btn-primary--compact" onClick={handleSave}>
                Lưu phiếu
              </button>
            )}
            <button type="button" className="btn-secondary btn-primary--compact" onClick={handlePrint}>
              In phiếu
            </button>
          </div>
          {message && <p className="hosocong-msg">{message}</p>}
        </div>
      </aside>

      <main className="phieu-cau-main">
        {!selected ? (
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
