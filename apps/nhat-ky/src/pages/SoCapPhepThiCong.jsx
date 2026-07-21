import { useMemo, useState, useEffect } from "react";
import GptcSummarySheet from "../components/GptcSummarySheet";
import GptcDetailSheet from "../components/GptcDetailSheet";
import GptcPrintPages from "../components/GptcPrintPages";
import { useRoadWorkspace } from "../context/RoadWorkspaceContext";
import { useOfficePermissions } from "../hooks/useOfficePermissions";
import { useGptcSync } from "../hooks/useGptcSync";
import { makeEmptyEntry, makeEmptyPermit, reindexPermits } from "../utils/gptcStore";
import { applyPermitUpdates, buildPasteUpdates, countFilledPermits, isPermitRowFilled, resolvePasteOrigin } from "../utils/gptcSummaryGrid";
import { packGptcDetailPages, packGptcSummaryPrintPages } from "../utils/gptcDetailFormat";
import { printGptcPages } from "../utils/gptcPrint";

const SIDEBAR_WIDTH = 260;
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

export default function SoCapPhepThiCong({ readOnly = false }) {
  const { activeRoad, activeRoadId, ownerUid, browseMode } = useRoadWorkspace();
  const { canEditOfficeData } = useOfficePermissions();
  const roadName = (activeRoad?.roadName || activeRoad?.label || "").trim();
  const tenTuyen = roadName || "";
  const canPush = canEditOfficeData && !browseMode && !readOnly;

  const { ledger, setLedger, ready, flushPush } = useGptcSync({
    uid: ownerUid,
    roadId: activeRoadId,
    roadName,
    tenTuyen,
    enabled: !!activeRoadId && !!ownerUid,
    canPush,
    browseMode
  });

  const [view, setView] = useState("summary");
  const [selectedId, setSelectedId] = useState("");
  const [selectedEntryId, setSelectedEntryId] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [margins, setMargins] = useState(loadMargins);

  useEffect(() => {
    localStorage.setItem(MARGIN_KEY, JSON.stringify(margins));
  }, [margins]);

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
    let n = packGptcSummaryPrintPages(ledger.permits, margins).length;
    (ledger.permits || []).forEach((p) => {
      if (!isPermitRowFilled(p)) return;
      n += packGptcDetailPages(p.entries || [], margins).length;
    });
    return n;
  }, [ledger, margins]);

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

  function removeSelectedPermit() {
    if (!selectedId) {
      flash("Chọn dòng công trình (click một lần) rồi bấm Xóa");
      return;
    }
    if (!window.confirm("Xóa công trình này và toàn bộ sổ chi tiết?")) return;
    markDirty();
    const id = selectedId;
    setLedger((prev) => ({
      ...prev,
      permits: reindexPermits((prev.permits || []).filter((p) => p.id !== id))
    }));
    setSelectedId("");
    setSelectedEntryId("");
    if (view === "detail") {
      setView("summary");
    }
    flash("Đã xóa công trình");
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

  function removeSelectedEntry() {
    if (!selectedId) return;
    if (!selectedEntryId) {
      flash("Chọn dòng theo dõi (click một lần) rồi bấm Xóa dòng");
      return;
    }
    if (!window.confirm("Xóa dòng theo dõi này?")) return;
    markDirty();
    const entryId = selectedEntryId;
    setLedger((prev) => ({
      ...prev,
      permits: (prev.permits || []).map((p) =>
        p.id === selectedId ? { ...p, entries: (p.entries || []).filter((e) => e.id !== entryId) } : p
      )
    }));
    setSelectedEntryId("");
    flash("Đã xóa dòng");
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
        style={{ width: SIDEBAR_WIDTH, minWidth: SIDEBAR_WIDTH, maxWidth: SIDEBAR_WIDTH }}
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
              <label className="entry-form-label" htmlFor="gptc-road">
                Tuyến đường
              </label>
              <input
                id="gptc-road"
                className="sidebar-input"
                value={ledger.tenTuyen}
                onChange={(e) => updateMeta("tenTuyen", e.target.value)}
              />
            </div>
          )}

          <button
            type="button"
            className={`btn-secondary sonhatky-edit-btn${printOpen ? " active" : ""}`}
            style={{ marginTop: 10, width: "100%" }}
            onClick={() => setPrintOpen((v) => !v)}
          >
            {printOpen ? "Đóng xem trước in" : "Xem trước in toàn sổ"}
          </button>

          {printOpen ? (
            <div className="sidebar-scroll" style={{ marginTop: 8 }}>
              <div className="print-form-panel">
                <div className="print-form-label">In sổ cấp phép</div>
                <ul className="print-form-tips">
                  <li>Khổ A4 ngang (297 × 210 mm)</li>
                  <li>Tờ 1: BM01 bảng tổng hợp</li>
                  <li>Tiếp theo: BM02 từng công trình</li>
                  <li>Kéo lề xanh trên tờ đầu bằng chuột</li>
                  <li>{printPageCount} tờ in</li>
                </ul>
              </div>
            </div>
          ) : (
            <p className="gptc-sidebar-hint">
              BM01: click ô để nhập
              <br />
              Double-click dòng → BM02
            </p>
          )}
        </div>
      </aside>

      <main className="nhaplieu-review-pane demxe-main">
        {printOpen ? (
          <div className="sonhatky-print-preview-pane landscape-print-preview-pane">
            <div className="sonhatky-print-toolbar print-toolbar no-print">
              <div className="print-toolbar-main">
                <div className="print-toolbar-kicker">Xem trước in · A4 ngang</div>
                <div className="print-toolbar-chips">
                  <span className="print-chip">Năm {ledger.year}</span>
                  <span className="print-chip">{filledPermitCount} CT</span>
                  <span className="print-chip">{printPageCount} tờ</span>
                  <span className="print-chip print-chip--muted">
                    Lề {margins.top}/{margins.right}/{margins.bottom}/{margins.left} mm
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="btn-primary btn-primary--compact print-toolbar-action"
                onClick={() => printGptcPages(margins)}
              >
                In toàn sổ
              </button>
            </div>
            <GptcPrintPages
              ledger={ledger}
              margins={margins}
              onMarginsChange={setMargins}
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
                  <span className="gptc-action-hint">
                    Click ô để nhập · Double-click dòng để mở sổ chi tiết
                  </span>
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
                  <span className="gptc-action-hint">
                    Click ô để nhập (Excel) · Đủ trang sẽ tự thêm trang mới
                  </span>
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
