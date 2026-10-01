import { useMemo, useState, useEffect } from "react";
import GptcSummarySheet from "../components/GptcSummarySheet";
import GptcDetailSheet from "../components/GptcDetailSheet";
import GptcPrintPages from "../components/GptcPrintPages";
import { useRoadWorkspace } from "../context/RoadWorkspaceContext";
import { useOfficePermissions } from "../hooks/useOfficePermissions";
import { useAuth } from "../context/AuthContext";
import RoutesViewSidebarControls from "../components/RoutesViewSidebarControls";
import { useGptcSync } from "../hooks/useGptcSync";
import { makeEmptyEntry, makeEmptyPermit, markEntryDeleted, markPermitDeleted, reindexPermits } from "../utils/gptcStore";
import { applyPermitUpdates, buildPasteUpdates, countFilledPermits, isPermitRowFilled, resolvePasteOrigin } from "../utils/gptcSummaryGrid";
import { packGptcDetailPages, packGptcSummaryPrintPages } from "../utils/gptcDetailFormat";
import { printGptcPages } from "../utils/gptcPrint";
import { exportGptcExcel } from "../utils/gptcExcel";
import {
  removeGptcLinksFromNhatKy,
  syncGptcLedgerToNhatKy
} from "../utils/gptcNhatKySync";

import SidebarResizer from "../components/SidebarResizer";
import { useResizableSidebar } from "../hooks/useResizableSidebar";
import { safeSetLocalStorage } from "../utils/nhatKyFormat";
const MARGIN_KEY = "gptc-print-margins-v1";
const DEFAULT_MARGINS = { top: 8, right: 10, bottom: 8, left: 10 };

function clampMm(v, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(40, Math.max(0, Math.round(n * 10) / 10));
}

function loadMargins() {
  try {
    const raw = JSON.parse(localStorage.getItem(MARGIN_KEY));
    if (!raw || typeof raw !== "object") return { ...DEFAULT_MARGINS };
    return {
      top: clampMm(raw.top, DEFAULT_MARGINS.top),
      right: clampMm(raw.right, DEFAULT_MARGINS.right),
      bottom: clampMm(raw.bottom, DEFAULT_MARGINS.bottom),
      left: clampMm(raw.left, DEFAULT_MARGINS.left)
    };
  } catch {
    return { ...DEFAULT_MARGINS };
  }
}

export default function SoCapPhepThiCong({
  readOnly = false,
  bootTarget = null,
  onBootConsumed
}) {
  const { activeRoad, activeRoadId, ownerUid, browseMode, offlineMode, storageKey } = useRoadWorkspace();
  const { profile } = useAuth();
  const { sidebarStyle, onResizeStart } = useResizableSidebar({ defaultWidth: 260 });
  const { canEditOfficeData } = useOfficePermissions();
  const roadName = (activeRoad?.roadName || activeRoad?.label || "").trim();
  const tenTuyen = roadName || "";
  const canPush = canEditOfficeData && !browseMode && !offlineMode && !readOnly;

  const { ledger, setLedger, ready, flushPush } = useGptcSync({
    uid: ownerUid,
    companyId: profile?.companyId || "",
    roadId: activeRoadId,
    roadName,
    tenTuyen,
    enabled: !!activeRoadId && !!ownerUid,
    canPush,
    browseMode,
    offlineMode,
    nhatKyStorageKey: storageKey
  });

  // Tuyến đường trên sổ = các đường đã chọn (Chọn đường), không nhập tay.
  // skipPush: chỉ gắn tên local, không đẩy sổ trống lên cloud.
  useEffect(() => {
    if (!ready || !ledger || !tenTuyen || readOnly || !canPush) return;
    if (String(ledger.tenTuyen || "").trim() === tenTuyen) return;
    setLedger((prev) => ({ ...prev, tenTuyen }), { skipPush: true });
  }, [ready, tenTuyen, ledger?.tenTuyen, readOnly, canPush, setLedger]);

  const [view, setView] = useState("summary");
  const [selectedId, setSelectedId] = useState("");
  const [selectedEntryId, setSelectedEntryId] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  /** summary | detail */
  const [printScope, setPrintScope] = useState("summary");
  const [margins, setMargins] = useState(loadMargins);
  const [exportingExcel, setExportingExcel] = useState(false);

  useEffect(() => {
    safeSetLocalStorage(MARGIN_KEY, margins);
  }, [margins]);

  // Tick đúp từ nhật ký → mở BM02 đúng công trình / dòng
  useEffect(() => {
    if (!ready || !ledger || !bootTarget?.permitId) return;
    const permitId = String(bootTarget.permitId).trim();
    const entryId = String(bootTarget.entryId || "").trim();
    const found = (ledger.permits || []).some((p) => p.id === permitId);
    if (!found) {
      setMessage("Không tìm thấy công trình cấp phép tương ứng.");
      setTimeout(() => setMessage(""), 3500);
      onBootConsumed?.();
      return;
    }
    setPrintOpen(false);
    setSelectedId(permitId);
    setSelectedEntryId(entryId);
    setView("detail");
    onBootConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy khi bootTarget đổi
  }, [ready, ledger, bootTarget]);

  const selectedPermit = useMemo(
    () => (ledger?.permits || []).find((p) => p.id === selectedId) || null,
    [ledger?.permits, selectedId]
  );

  const filledPermitCount = useMemo(
    () => countFilledPermits(ledger?.permits),
    [ledger?.permits]
  );

  const printPageCount = useMemo(() => {
    if (!ledger) return 0;
    if (printScope === "detail") {
      let n = 0;
      (ledger.permits || []).forEach((p) => {
        if (!isPermitRowFilled(p)) return;
        n += packGptcDetailPages(p.entries || [], margins).length;
      });
      return n;
    }
    return packGptcSummaryPrintPages(ledger.permits, margins).length;
  }, [ledger, margins, printScope]);

  const printScopeLabel = printScope === "detail" ? "BM02 · Chi tiết" : "BM01 · Tổng hợp";
  const printActionLabel = printScope === "detail" ? "In sổ chi tiết" : "In biểu tổng hợp";
  const excelActionLabel =
    printScope === "detail" ? "Xuất Excel chi tiết" : "Xuất Excel tổng hợp";

  async function handleExportExcel() {
    if (!ledger || exportingExcel) return;
    setExportingExcel(true);
    try {
      const { filename } = await exportGptcExcel(ledger, {
        scope: printScope,
        margins
      });
      flash(`Đã xuất ${filename}`);
    } catch (err) {
      console.error(err);
      window.alert(err?.message || "Không xuất được Excel. Thử lại.");
    } finally {
      setExportingExcel(false);
    }
  }

  function flash(msg) {
    setMessage(msg);
    setTimeout(() => setMessage(""), 3500);
  }

  function markDirty() {
    setDirty(true);
  }

  function updateMeta(field, value) {
    markDirty();
    setLedger((prev) => ({ ...prev, [field]: value }));
  }

  function updateColWidths(widths) {
    markDirty();
    setLedger((prev) => ({ ...prev, summaryColWidths: widths }));
  }

  function updateDetailColWidths(widths) {
    markDirty();
    setLedger((prev) => ({ ...prev, detailColWidths: widths }));
  }

  function handlePasteGrid(startRow, startCol, grid) {
    markDirty();
    const origin = resolvePasteOrigin(startRow, startCol, grid);
    setLedger((prev) => {
      const { updates, list } = buildPasteUpdates(
        prev.permits || [],
        origin.startRow,
        origin.startCol,
        origin.grid,
        makeEmptyPermit
      );
      const permits = reindexPermits(applyPermitUpdates(list, updates));
      return { ...prev, permits };
    });
    flash(`Đã dán ${grid.length} dòng từ Excel`);
  }

  function updatePermitField(id, field, value) {
    markDirty();
    setLedger((prev) => ({
      ...prev,
      permits: reindexPermits(
        (prev.permits || []).map((p) => (p.id === id ? { ...p, [field]: value } : p))
      )
    }));
  }

  function addPermit() {
    const permit = makeEmptyPermit();
    markDirty();
    setLedger((prev) => ({
      ...prev,
      permits: reindexPermits([...(prev.permits || []), permit])
    }));
    setSelectedId(permit.id);
    setView("summary");
    flash("Đã thêm dòng công trình — nhập trực tiếp trên bảng");
  }

  async function removePermit(permitId) {
    const id = String(permitId || "").trim();
    if (!id) {
      flash("Chọn dòng công trình (click một lần) rồi bấm Xóa");
      return;
    }
    if (
      !window.confirm(
        "Bạn có chắc chắn muốn xóa công trình này?\n• Biểu tổng hợp (BM01): xóa dòng công trình\n• Sổ chi tiết (BM02): xóa toàn bộ theo dõi\n• Sổ nhật ký: xóa các dòng liên quan"
      )
    ) {
      return;
    }
    markDirty();
    const entryIds = (ledger?.permits || [])
      .filter((p) => p.id === id)
      .flatMap((p) => (p.entries || []).map((e) => e.id).filter(Boolean));

    const nextLedger = markPermitDeleted(ledger, id, entryIds);

    // 1) Cập nhật sổ CPTC (BM01+BM02) + prune NK theo ledger mới
    setLedger(() => nextLedger);

    // 2) Xóa cứng mọi dòng NK gắn CT / dòng BM02 (phòng sót id)
    if (storageKey) {
      removeGptcLinksFromNhatKy(storageKey, { permitIds: [id], entryIds });
      try {
        syncGptcLedgerToNhatKy(nextLedger, storageKey);
      } catch (err) {
        console.warn("Prune NK sau xóa CT thất bại.", err);
      }
    }

    if (selectedId === id) {
      setSelectedId("");
      setSelectedEntryId("");
      if (view === "detail") setView("summary");
    }

    // 3) Đẩy cloud ngay — allowEmpty khi user chủ động xóa CT
    try {
      await flushPush?.({ allowEmpty: true });
      flash("Đã xóa công trình (BM01 + BM02 + nhật ký) và đồng bộ cloud");
    } catch {
      flash("Đã xóa cục bộ (BM01 + BM02 + nhật ký). Chưa đẩy được cloud — mở lại trang có thể hiện lại nếu cloud còn bản cũ.");
    }
  }

  function removeSelectedPermit() {
    void removePermit(selectedId);
  }

  function openDetail(id) {
    setSelectedId(id);
    setSelectedEntryId("");
    setView("detail");
  }

  function backToSummary() {
    setView("summary");
    setSelectedEntryId("");
  }

  /** Nhập ô Excel theo chỉ số dòng — tự tạo entry trống nếu cần (full trang / sang trang 2). */
  function updateEntrySlot(slotIndex, field, value) {
    if (!selectedId) return;
    markDirty();
    if (slotIndex === "__permit__") {
      updatePermitField(selectedId, field, value);
      return;
    }
    setLedger((prev) => ({
      ...prev,
      permits: (prev.permits || []).map((p) => {
        if (p.id !== selectedId) return p;
        const entries = [...(p.entries || [])];
        while (entries.length <= slotIndex) {
          entries.push(makeEmptyEntry());
        }
        entries[slotIndex] = { ...entries[slotIndex], [field]: value };
        return { ...p, entries };
      })
    }));
  }

  function addEntry() {
    if (!selectedId) return;
    const entry = makeEmptyEntry();
    markDirty();
    setLedger((prev) => ({
      ...prev,
      permits: (prev.permits || []).map((p) =>
        p.id === selectedId ? { ...p, entries: [...(p.entries || []), entry] } : p
      )
    }));
    setSelectedEntryId(entry.id);
    flash("Đã thêm dòng — nhập trực tiếp trên bảng");
  }

  async function removeSelectedEntry() {
    if (!selectedId) return;
    if (!selectedEntryId) {
      flash("Chọn dòng theo dõi (click một lần) rồi bấm Xóa dòng");
      return;
    }
    if (
      !window.confirm(
        "Xóa dòng theo dõi này?\nDòng tương ứng trên sổ nhật ký tuần đường (nếu có) cũng sẽ bị xóa."
      )
    ) {
      return;
    }
    markDirty();
    const entryId = selectedEntryId;
    const nextLedger = markEntryDeleted(ledger, selectedId, entryId);
    setLedger(() => nextLedger);
    if (storageKey) {
      removeGptcLinksFromNhatKy(storageKey, { entryIds: [entryId] });
      try {
        syncGptcLedgerToNhatKy(nextLedger, storageKey);
      } catch (err) {
        console.warn("Prune NK sau xóa dòng BM02 thất bại.", err);
      }
    }
    setSelectedEntryId("");
    try {
      await flushPush?.({ allowEmpty: true });
      flash("Đã xóa dòng (kèm nhật ký) và đồng bộ cloud");
    } catch {
      flash("Đã xóa dòng cục bộ (kèm nhật ký). Chưa đẩy được cloud.");
    }
  }

  async function saveAll() {
    setSaving(true);
    try {
      await flushPush();
      setDirty(false);
      flash("Đã lưu dữ liệu");
    } catch {
      flash("Đã lưu cục bộ (chưa đồng bộ cloud)");
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }

  if (!ready || !ledger) {
    return (
      <div className="nhaplieu-workspace">
        <p className="section-guide">Đang tải sổ cấp phép thi công...</p>
      </div>
    );
  }

  return (
    <div
      className={`nhaplieu-workspace sonhatky-workspace demxe-workspace gptc-workspace${
        printOpen ? " gptc-workspace--print" : ""
      }`}
    >
      <aside
        className="nhaplieu-sidebar sonhatky-sidebar demxe-sidebar no-print"
        style={sidebarStyle}
      >
        <div className="sidebar-sticky-head">
          <h2 className="sidebar-title">Cấp phép thi công</h2>
          <p className="sonhatky-day-summary">
            Năm {ledger.year}
            {ledger.tenTuyen ? ` · ${ledger.tenTuyen}` : ""}
          </p>
          {message && <p className="save-ok">{message}</p>}

          {!printOpen && (
            <div className="gptc-sidebar-meta">
              <label className="entry-form-label" htmlFor="gptc-year">
                Năm
              </label>
              <input
                id="gptc-year"
                className="sidebar-input"
                value={ledger.year}
                onChange={(e) => updateMeta("year", e.target.value)}
              />
            </div>
          )}

          <button
            type="button"
            className={`btn-secondary sonhatky-edit-btn${printOpen ? " active" : ""}`}
            style={{ marginTop: 10, width: "100%" }}
            onClick={() => {
              setPrintOpen((v) => !v);
              if (!printOpen) {
                setPrintScope(view === "detail" ? "detail" : "summary");
              }
            }}
          >
            {printOpen ? "Đóng xem trước in" : "Xem trước in"}
          </button>
          <RoutesViewSidebarControls />

          {printOpen ? (
            <div className="sidebar-scroll" style={{ marginTop: 8 }}>
              <div className="print-form-panel">
                <div className="print-form-label">Phạm vi in</div>
                <div className="gptc-print-scope-tabs">
                  <button
                    type="button"
                    className={printScope === "summary" ? "active" : ""}
                    onClick={() => setPrintScope("summary")}
                  >
                    BM01 tổng hợp
                  </button>
                  <button
                    type="button"
                    className={printScope === "detail" ? "active" : ""}
                    onClick={() => setPrintScope("detail")}
                  >
                    BM02 chi tiết
                  </button>
                </div>
                <ul className="print-form-tips">
                  <li>Khổ A4 ngang (297 × 210 mm)</li>
                  <li>
                    {printScope === "detail"
                      ? "Chỉ in các biểu theo dõi chi tiết (BM02)"
                      : "In biểu tổng hợp (BM01), hàng trống đến hết trang"}
                  </li>
                  <li>Kéo lề xanh trên tờ đầu bằng chuột</li>
                  <li>
                    {printPageCount} tờ · {printScopeLabel}
                  </li>
                  <li>Nút «Xuất Excel» tải file .xlsx theo phạm vi đang chọn</li>
                </ul>
              </div>
            </div>
          ) : null}
        </div>
      </aside>

      <SidebarResizer onMouseDown={onResizeStart} />

      <main className="nhaplieu-review-pane demxe-main">
        {printOpen ? (
          <div className="sonhatky-print-preview-pane landscape-print-preview-pane">
            <div className="sonhatky-print-toolbar print-toolbar no-print">
              <div className="print-toolbar-main">
                <div className="print-toolbar-kicker">Xem trước in · A4 ngang · {printScopeLabel}</div>
                <div className="print-toolbar-chips">
                  <span className="print-chip">Năm {ledger.year}</span>
                  <span className="print-chip">{filledPermitCount} CT</span>
                  <span className="print-chip">{printPageCount} tờ</span>
                  <span className="print-chip print-chip--muted">
                    Lề {margins.top}/{margins.right}/{margins.bottom}/{margins.left} mm
                  </span>
                </div>
              </div>
              <div className="print-toolbar-actions">
                <button
                  type="button"
                  className="btn-secondary btn-primary--compact print-toolbar-action"
                  disabled={exportingExcel}
                  onClick={() => void handleExportExcel()}
                >
                  {exportingExcel ? "Đang xuất…" : excelActionLabel}
                </button>
                <button
                  type="button"
                  className="btn-primary btn-primary--compact print-toolbar-action"
                  onClick={() => printGptcPages(margins, printScope)}
                >
                  {printActionLabel}
                </button>
              </div>
            </div>
            <GptcPrintPages
              ledger={ledger}
              margins={margins}
              onMarginsChange={setMargins}
              scope={printScope}
            />
          </div>
        ) : (
          <>
            <div className="demxe-toolbar no-print">
              <div className="demxe-tabs">
                <button
                  type="button"
                  className={view === "summary" ? "demxe-tab demxe-tab--active" : "demxe-tab"}
                  onClick={backToSummary}
                >
                  Biểu tổng hợp (BM01)
                </button>
                <button
                  type="button"
                  className={view === "detail" ? "demxe-tab demxe-tab--active" : "demxe-tab"}
                  onClick={() => selectedId && setView("detail")}
                  disabled={!selectedId}
                >
                  Sổ chi tiết (BM02)
                </button>
              </div>
            </div>

            <div className="gptc-action-bar no-print">
              {!readOnly && (view === "summary" ? (
                <>
                  <button type="button" className="btn-secondary btn-primary--compact" onClick={addPermit}>
                    + Thêm công trình
                  </button>
                  <button type="button" className="btn-secondary btn-primary--compact" onClick={removeSelectedPermit}>
                    Xóa công trình
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="btn-secondary btn-primary--compact" onClick={backToSummary}>
                    ← Biểu tổng hợp
                  </button>
                  <button type="button" className="btn-secondary btn-primary--compact" onClick={addEntry}>
                    + Thêm dòng
                  </button>
                  <button type="button" className="btn-secondary btn-primary--compact" onClick={removeSelectedEntry}>
                    Xóa dòng
                  </button>
                </>
              ))}
              {!readOnly && (
                <div className="gptc-action-bar__save">
                  {dirty && <span className="demxe-entry-unsaved">Chưa lưu</span>}
                  <button
                    type="button"
                    className="btn-primary btn-primary--compact"
                    disabled={saving}
                    onClick={() => void saveAll()}
                  >
                    {saving ? "Đang lưu..." : "Lưu dữ liệu"}
                  </button>
                </div>
              )}
              {readOnly && (
                <p className="section-guide danhmuc-bd-readonly-hint">
                  Chế độ chỉ xem. Chỉ tài khoản <strong>USER</strong> được sửa sổ cấp phép.
                </p>
              )}
            </div>

            <div className="demxe-pane gptc-pane">
              {view === "summary" ? (
                <GptcSummarySheet
                  ledger={ledger}
                  editable={!readOnly}
                  selectedId={selectedId}
                  colWidths={ledger.summaryColWidths}
                  onRowSelect={setSelectedId}
                  onOpenDetail={openDetail}
                  onDeletePermit={removePermit}
                  onChangePermit={updatePermitField}
                  onColWidthsChange={updateColWidths}
                  onPasteGrid={handlePasteGrid}
                />
              ) : (
                <GptcDetailSheet
                  permit={selectedPermit}
                  editable={!readOnly}
                  colWidths={ledger.detailColWidths}
                  selectedEntryId={selectedEntryId}
                  onRowSelect={setSelectedEntryId}
                  onChangeSlot={updateEntrySlot}
                  onColWidthsChange={updateDetailColWidths}
                />
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
