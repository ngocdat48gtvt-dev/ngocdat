import { useMemo, useState, useEffect } from "react";
import GptcSummarySheet from "../components/GptcSummarySheet";
import GptcDetailSheet from "../components/GptcDetailSheet";
import { useRoadWorkspace } from "../context/RoadWorkspaceContext";
import { useOfficePermissions } from "../hooks/useOfficePermissions";
import { useGptcSync } from "../hooks/useGptcSync";
import { makeEmptyEntry, makeEmptyPermit, reindexPermits } from "../utils/gptcStore";
import { applyPermitUpdates, buildPasteUpdates, resolvePasteOrigin } from "../utils/gptcSummaryGrid";

const SIDEBAR_WIDTH = 260;

function clearGptcPrintMode() {
  document.body.classList.remove("gptc-print-summary", "gptc-print-detail", "gptc-print-all");
  document.querySelectorAll(".gptc-print-section").forEach((el) => el.classList.remove("gptc-print-hidden"));
  document.querySelectorAll("[data-print-permit]").forEach((el) => el.classList.remove("gptc-print-hidden"));
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

  useEffect(() => {
    clearGptcPrintMode();
    return () => clearGptcPrintMode();
  }, []);

  const selectedPermit = useMemo(
    () => (ledger?.permits || []).find((p) => p.id === selectedId) || null,
    [ledger?.permits, selectedId]
  );

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

  function updateEntry(entryId, field, value) {
    if (!selectedId) return;
    markDirty();
    if (entryId === "__permit__") {
      updatePermitField(selectedId, field, value);
      return;
    }
    setLedger((prev) => ({
      ...prev,
      permits: (prev.permits || []).map((p) => {
        if (p.id !== selectedId) return p;
        return {
          ...p,
          entries: (p.entries || []).map((e) => (e.id === entryId ? { ...e, [field]: value } : e))
        };
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
    flash("Đã thêm dòng — nhập nội dung bên dưới");
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

  function handlePrint(mode) {
    document.body.classList.remove("gptc-print-summary", "gptc-print-detail", "gptc-print-all");
    document.querySelectorAll(".gptc-print-section").forEach((el) => el.classList.remove("gptc-print-hidden"));
    document.querySelectorAll("[data-print-permit]").forEach((el) => el.classList.remove("gptc-print-hidden"));

    if (mode === "summary") {
      document.body.classList.add("gptc-print-summary");
    } else if (mode === "detail" && selectedId) {
      document.body.classList.add("gptc-print-detail");
      document.querySelectorAll("[data-print-permit]").forEach((el) => {
        if (el.getAttribute("data-print-permit") !== selectedId) {
          el.classList.add("gptc-print-hidden");
        }
      });
    } else if (mode === "all") {
      document.body.classList.add("gptc-print-all");
    }

    const cleanup = () => {
      clearGptcPrintMode();
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
    setTimeout(cleanup, 1000);
  }

  if (!ready || !ledger) {
    return (
      <div className="nhaplieu-workspace">
        <p className="section-guide">Đang tải sổ cấp phép thi công...</p>
      </div>
    );
  }

  return (
    <div className="nhaplieu-workspace sonhatky-workspace demxe-workspace gptc-workspace">
      <aside
        className="nhaplieu-sidebar sonhatky-sidebar demxe-sidebar"
        style={{ width: SIDEBAR_WIDTH, minWidth: SIDEBAR_WIDTH, maxWidth: SIDEBAR_WIDTH }}
      >
        <div className="sidebar-sticky-head">
          <h2 className="sidebar-title">Cấp phép thi công</h2>
          <p className="sonhatky-day-summary">
            Năm {ledger.year}
            {ledger.tenTuyen ? ` · ${ledger.tenTuyen}` : ""}
          </p>
          {message && <p className="save-ok">{message}</p>}

          <div className="gptc-sidebar-meta no-print">
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

          <p className="gptc-sidebar-hint no-print">
            BM01: click ô để nhập
            <br />
            Double-click dòng → BM02
          </p>
        </div>
      </aside>

      <main className="nhaplieu-review-pane demxe-main">
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
          <div className="demxe-toolbar-actions">
            <button type="button" className="btn-secondary btn-primary--compact" onClick={() => handlePrint("summary")}>
              In BM01
            </button>
            <button
              type="button"
              className="btn-secondary btn-primary--compact"
              disabled={!selectedId}
              onClick={() => handlePrint("detail")}
            >
              In BM02
            </button>
            <button type="button" className="btn-secondary btn-primary--compact" onClick={() => handlePrint("all")}>
              In toàn sổ
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
              <span className="gptc-action-hint">Click ô để nhập · Double-click dòng để mở sổ chi tiết</span>
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
              <span className="gptc-action-hint">Click ô để nhập · Click dòng rồi Xóa dòng để xóa</span>
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
              onChangeEntry={updateEntry}
              onColWidthsChange={updateDetailColWidths}
            />
          )}
        </div>

        <div className="gptc-print-stack" aria-hidden="true">
          <GptcSummarySheet ledger={ledger} selectedId={selectedId} />
          {(ledger.permits || []).map((p) => (
            <GptcDetailSheet key={p.id} permit={p} colWidths={ledger.detailColWidths} />
          ))}
        </div>
      </main>
    </div>
  );
}
