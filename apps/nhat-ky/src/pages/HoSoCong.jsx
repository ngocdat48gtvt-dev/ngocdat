import { useEffect, useMemo, useRef, useState } from "react";
import {
  loadCongRegistryForRoute,
  replaceCongRegistryForRoute,
  resolveCongScope,
  makeEmptyCongRows,
  parseCongPaste,
  applyCongLengthByType,
  applyCongGridPaste,
  parseExcelClipboard,
  normalizeCongEntry,
  summarizeCongByType,
  CONG_LEN_FIELDS,
  CONG_GRID_FIELDS,
  CONG_GROUP_HIEN_TRANG,
  CONG_GROUP_HU_HONG,
  CONG_REGISTRY_EVENT
} from "../utils/congRegistryStore";
import { hydrateCongRegistriesFromCloud, pushManyCong } from "../services/congRegistryService";
import { formatKmCell } from "../utils/matDuongFormat";
import { useAuth } from "../context/AuthContext";
import { useRoadWorkspace } from "../context/RoadWorkspaceContext";
import {
  getRoadRoutes,
  pickActiveRoute,
  routeDisplayLabel,
  routeRegistryCloudKey
} from "../utils/roadsCatalog";
import { normalizeKmInput, loadStorage } from "../utils/nhatKyFormat";
import {
  CONG_OP_STATUS,
  indexCongDiaryStatus,
  congOpStatusLabel
} from "../utils/congDiaryStatus";
import PasswordConfirmModal from "../components/PasswordConfirmModal";
import EntryRoutePicker from "../components/EntryRoutePicker";
import SidebarResizer from "../components/SidebarResizer";
import CongStatusDrawer from "../components/CongStatusDrawer";
import { useResizableSidebar } from "../hooks/useResizableSidebar";

function formatKm(value) {
  const v = String(value ?? "").trim();
  if (!v) return "";
  return formatKmCell(v) || v;
}

function formatMeters(n) {
  if (!Number.isFinite(n) || n === 0) return "0";
  const r = Math.round(n * 100) / 100;
  return String(r).replace(".", ",");
}

const TEXT_FIELDS = [
  "km",
  "aperture",
  "body",
  "headUp",
  "headDown",
  "load",
  "yearBuilt",
  "condition"
];

export default function HoSoCong({ readOnly = false, storageTick = 0 }) {
  const { profile } = useAuth();
  const { sidebarStyle, onResizeStart } = useResizableSidebar({ defaultWidth: 320 });
  const {
    roads,
    activeRoadId,
    ownerUid,
    catalogRoad,
    activeRouteId,
    routes,
    storageKey
  } = useRoadWorkspace();
  const uid = ownerUid || profile?.uid || "";
  const focusRef = useRef({ row: 0, field: 0 });
  const reportOuterRef = useRef(null);
  const reportSheetRef = useRef(null);
  const reportHeadRef = useRef(null);
  const culvertTableRef = useRef(null);
  const [statusCongId, setStatusCongId] = useState("");

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
    () => resolveCongScope(uid, activeRoadId, activeRoute?.id || activeRouteId, routeList),
    [uid, activeRoadId, activeRoute?.id, activeRouteId, routeList]
  );

  const [rows, setRows] = useState(() => makeEmptyCongRows(12));
  const [pasteText, setPasteText] = useState("");
  const [countInput, setCountInput] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingClear, setPendingClear] = useState(false);
  const [skipSttColumn, setSkipSttColumn] = useState(true);
  const [pasteToast, setPasteToast] = useState("");
  const [pasteFlash, setPasteFlash] = useState(() => new Set());
  const pasteFlashTimer = useRef(null);
  const pasteToastTimer = useRef(null);

  useEffect(() => {
    return () => {
      if (pasteFlashTimer.current) clearTimeout(pasteFlashTimer.current);
      if (pasteToastTimer.current) clearTimeout(pasteToastTimer.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    function applyLocal() {
      if (!activeRoadId) {
        setRows(makeEmptyCongRows(12));
        return;
      }
      const list = loadCongRegistryForRoute(
        uid,
        activeRoadId,
        activeRoute,
        routeList
      ).map((item) => ({
        ...normalizeCongEntry(item),
        roadId: activeRoadId,
        routeId: activeRoute?.id || "",
        km: formatKm(item.km)
      }));
      setRows(
        list.length
          ? list
          : makeEmptyCongRows(12).map((x) => ({
              ...x,
              roadId: activeRoadId,
              routeId: activeRoute?.id || ""
            }))
      );
    }

    // Hiện local ngay, không chờ cloud.
    applyLocal();

    async function hydrateInBackground() {
      if (!uid || !activeRoad) return;
      try {
        await hydrateCongRegistriesFromCloud(uid, [activeRoad], {
          force: readOnly
        });
      } catch {
        /* giữ local */
      }
      if (!cancelled) applyLocal();
    }
    void hydrateInBackground();

    const onRegistry = () => {
      if (!cancelled) applyLocal();
    };
    window.addEventListener(CONG_REGISTRY_EVENT, onRegistry);

    return () => {
      cancelled = true;
      window.removeEventListener(CONG_REGISTRY_EVENT, onRegistry);
    };
  }, [uid, activeRoadId, activeRoad, activeRoute?.id, readScope, readOnly, routeList]);

  const dataRows = useMemo(
    () => rows.filter((r) => String(r.km || "").trim()),
    [rows]
  );
  const filledCount = dataRows.length;
  const hienTrangRows = useMemo(
    () => dataRows.filter((r) => r.group !== CONG_GROUP_HU_HONG),
    [dataRows]
  );
  const huHongRows = useMemo(
    () => dataRows.filter((r) => r.group === CONG_GROUP_HU_HONG),
    [dataRows]
  );
  const summaryAll = useMemo(() => summarizeCongByType(dataRows), [dataRows]);
  const summaryHien = useMemo(() => summarizeCongByType(hienTrangRows), [hienTrangRows]);
  const summaryHu = useMemo(() => summarizeCongByType(huHongRows), [huHongRows]);

  const diaryEntries = useMemo(() => {
    if (!storageKey) return [];
    return loadStorage(storageKey).entries || [];
  }, [storageKey, storageTick]);

  const statusByCongId = useMemo(
    () => indexCongDiaryStatus(dataRows, diaryEntries),
    [dataRows, diaryEntries]
  );

  const statusDrawerCong = useMemo(
    () => dataRows.find((r) => r.id === statusCongId) || null,
    [dataRows, statusCongId]
  );
  const statusDrawerInfo = statusDrawerCong
    ? statusByCongId.get(statusDrawerCong.id) || {
        status: CONG_OP_STATUS.BINH_THUONG,
        history: [],
        label: congOpStatusLabel(CONG_OP_STATUS.BINH_THUONG)
      }
    : null;

  const needRepairCount = useMemo(
    () =>
      dataRows.filter((r) => {
        const st = statusByCongId.get(r.id)?.status;
        if (st === CONG_OP_STATUS.HU_HONG || st === CONG_OP_STATUS.BO_SUNG) return true;
        return /hư\s*hỏng|kem|kém|cần\s*bổ\s*sung|sua chua|sửa chữa/i.test(
          `${r.condition || ""} ${r.group === CONG_GROUP_HU_HONG ? "hu hong" : ""}`
        );
      }).length,
    [dataRows, statusByCongId]
  );

  const segmentLabel = useMemo(() => {
    const range = String(activeRoute?.kmRange || activeRoad?.kmRange || "")
      .trim()
      .replace(/\s*[–→]\s*/g, " - ")
      .replace(/-/g, " - ");
    if (range) return `Từ đoạn ${range} Đường ${branchLabel}`;
    return `Đường ${branchLabel}`;
  }, [activeRoute?.kmRange, activeRoad?.kmRange, branchLabel]);

  const asOfLabel = useMemo(() => {
    const d = new Date();
    return `Tính đến ngày ${d.getDate()} tháng ${d.getMonth() + 1} năm ${d.getFullYear()}`;
  }, []);

  /* Sticky: đo chiều cao tiêu đề + 2 hàng thead — đặt SAU segmentLabel/asOfLabel */
  useEffect(() => {
    const sheet = reportSheetRef.current;
    const head = reportHeadRef.current;
    const table = culvertTableRef.current;
    if (!sheet || !head || !table) return;

    const applyOffsets = () => {
      const headH = Math.round(head.offsetHeight);
      sheet.style.setProperty("--report-header-height", `${headH}px`);
      const rowsEl = table.tHead?.rows;
      if (!rowsEl || rowsEl.length < 3) return;
      /* Dùng offsetTop giữa các hàng — khớp đúng vị trí sticky, tránh đè/mất kẻ */
      const y0 = rowsEl[0].offsetTop;
      const y1 = rowsEl[1].offsetTop;
      const y2 = rowsEl[2].offsetTop;
      const r1 = Math.max(1, Math.round(y1 - y0));
      const r2 = Math.max(1, Math.round(y2 - y1));
      sheet.style.setProperty("--culvert-thead-r1", `${r1}px`);
      sheet.style.setProperty("--culvert-thead-r2", `${r2}px`);
    };

    applyOffsets();
    const ro = new ResizeObserver(() => applyOffsets());
    ro.observe(head);
    if (table.tHead) ro.observe(table.tHead);
    window.addEventListener("resize", applyOffsets);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", applyOffsets);
    };
  }, [rows.length, segmentLabel, asOfLabel, readOnly]);

  function lenSummaryCells(summary) {
    return CONG_LEN_FIELDS.map(({ key }) => (
      <td key={key} className="culvert-num">
        {summary.byKey[key]?.count ? formatMeters(summary.byKey[key].meters) : ""}
      </td>
    ));
  }

  function updateRow(id, field, value) {
    if (readOnly) return;
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        if (CONG_LEN_FIELDS.some((f) => f.key === field)) {
          return applyCongLengthByType(r, field, value);
        }
        if (TEXT_FIELDS.includes(field)) {
          return normalizeCongEntry({ ...r, [field]: value });
        }
        return { ...r, [field]: value };
      })
    );
    setMessage("");
  }

  function deleteRow(id) {
    if (readOnly) return;
    if (!activeRoadId || !uid) {
      setRows((prev) => prev.filter((r) => r.id !== id));
      setMessage("");
      return;
    }
    const next = rows.filter((r) => r.id !== id);
    const data = next.filter((r) => String(r.km || "").trim());
    replaceCongRegistryForRoute(uid, activeRoadId, activeRoute, routeList, data);
    setRows(
      data.length
        ? data.map((item) => ({
            ...item,
            roadId: activeRoadId,
            routeId: activeRoute?.id || "",
            km: formatKm(item.km)
          }))
        : makeEmptyCongRows(12).map((x) => ({
            ...x,
            roadId: activeRoadId,
            routeId: activeRoute?.id || ""
          }))
    );
    setMessage("");
    if (uid && cloudKey) {
      void pushManyCong(uid, { [cloudKey]: data }).catch(() => {});
    }
  }

  function addRows(group = CONG_GROUP_HIEN_TRANG) {
    if (readOnly) return;
    setRows((prev) => [
      ...prev,
      ...makeEmptyCongRows(5).map((x) => ({
        ...x,
        group,
        roadId: activeRoadId,
        routeId: activeRoute?.id || ""
      }))
    ]);
  }

  function generateRows() {
    if (readOnly) return;
    const n = parseInt(countInput, 10);
    if (!Number.isFinite(n) || n < 1) {
      setMessage("Nhập số lượng cống hợp lệ (≥ 1).");
      return;
    }
    if (n > 1000) {
      setMessage("Tối đa 1000 cống mỗi lần tạo.");
      return;
    }
    setRows((prev) => [
      ...prev,
      ...makeEmptyCongRows(n).map((x) => ({
        ...x,
        roadId: activeRoadId,
        routeId: activeRoute?.id || ""
      }))
    ]);
    setCountInput("");
    setMessage(`Đã thêm ${n} dòng trống. Dán Excel (Ctrl+V) vào bảng rồi «Lưu hồ sơ».`);
  }

  function importPaste() {
    if (readOnly) return;
    if (!activeRoadId) {
      setMessage("Chưa chọn sổ đường. Vào «Đổi sổ» để chọn sổ trước.");
      return;
    }
    const parsed = parseCongPaste(pasteText);
    if (!parsed.length) {
      setMessage("Không đọc được dòng nào. Copy vùng dữ liệu từ Excel (có thể gồm STT).");
      return;
    }
    const formatted = parsed.map((r) => ({
      ...r,
      km: formatKm(r.km),
      roadId: activeRoadId,
      routeId: activeRoute?.id || ""
    }));
    setRows((prev) => {
      const keep = prev.filter((r) => String(r.km || "").trim());
      return [...keep, ...formatted];
    });
    setPasteText("");
    setMessage(`Đã nạp ${parsed.length} dòng từ Excel. Kiểm tra rồi bấm «Lưu hồ sơ».`);
  }

  function flashPasteCells(highlights) {
    const next = new Set(
      (highlights || []).map((h) => `${h.rowId || ""}:${h.field}`)
    );
    setPasteFlash(next);
    if (pasteFlashTimer.current) clearTimeout(pasteFlashTimer.current);
    pasteFlashTimer.current = setTimeout(() => setPasteFlash(new Set()), 1000);
  }

  function showPasteToast(text) {
    setPasteToast(text);
    setMessage(text);
    if (pasteToastTimer.current) clearTimeout(pasteToastTimer.current);
    pasteToastTimer.current = setTimeout(() => setPasteToast(""), 2800);
  }

  function handleTablePaste(e) {
    if (readOnly) return;
    const text = e.clipboardData?.getData("text/plain") || e.clipboardData?.getData("text");
    if (!text?.trim()) return;
    // 1 ô đơn (không tab/newline) → để trình duyệt dán bình thường
    const multi = text.includes("\t") || text.includes("\n");
    if (!multi) return;

    e.preventDefault();
    e.stopPropagation();

    let startRow = focusRef.current.row;
    let startField = focusRef.current.field;
    const active = document.activeElement;
    const cell = active?.closest?.("[data-cong-row]");
    if (cell) {
      const r = Number(cell.getAttribute("data-cong-row"));
      const f = Number(cell.getAttribute("data-cong-field"));
      if (Number.isFinite(r)) startRow = r;
      if (Number.isFinite(f)) startField = f;
    }

    const startEntry = rows[startRow];
    const sectionGroup = startEntry?.group || CONG_GROUP_HIEN_TRANG;
    const grid = parseExcelClipboard(text);
    const result = applyCongGridPaste(rows, startRow, startField, grid, {
      skipStt: skipSttColumn,
      defaultGroup: sectionGroup
    });

    setRows(
      result.rows.map((r) => ({
        ...r,
        roadId: activeRoadId,
        routeId: activeRoute?.id || "",
        km: r.km ? formatKm(r.km) : r.km
      }))
    );

    flashPasteCells(result.highlights);

    if (!result.applied) {
      showPasteToast("Không dán được dòng dữ liệu (có thể chỉ là tiêu đề).");
      return;
    }

    const sectionLabel =
      result.group === CONG_GROUP_HU_HONG ? "Mục II" : "Mục I";
    let msg = `Đã dán ${result.rowCount} dòng × ${result.colCount} cột từ Excel (${sectionLabel}, ${result.cellCount} ô).`;
    if (result.invalidCount) {
      msg += ` Có ${result.invalidCount} giá trị không hợp lệ.`;
    }
    msg += " Bấm «Lưu hồ sơ» để đồng bộ.";
    showPasteToast(msg);
  }

  function isPasteFlash(row, field) {
    return pasteFlash.has(`${row.id}:${field}`);
  }

  async function handleSave() {
    if (readOnly) return;
    if (!activeRoadId) {
      setMessage("Chưa chọn sổ đường. Vào «Đổi sổ» để chọn sổ trước khi lưu.");
      return;
    }
    if (routeList.length > 1 && !activeRoute?.id) {
      setMessage("Chọn đường/nhánh trước khi lưu.");
      return;
    }
    if (!uid) {
      setMessage("Chưa đăng nhập — không xác định được kho lưu theo tài khoản.");
      return;
    }

    const list = [];
    for (const r of rows) {
      const has =
        String(r.km || "").trim() ||
        String(r.type || "").trim() ||
        String(r.length || "").trim() ||
        String(r.aperture || "").trim() ||
        CONG_LEN_FIELDS.some((f) => String(r[f.key] || "").trim());
      if (!has) continue;
      const kmNorm = normalizeKmInput(r.km) || String(r.km || "").trim();
      list.push({
        ...r,
        roadId: activeRoadId,
        routeId: activeRoute?.id || "",
        km: kmNorm
      });
    }

    const clean = replaceCongRegistryForRoute(
      uid,
      activeRoadId,
      activeRoute,
      routeList,
      list
    );
    setRows(
      clean.length
        ? clean.map((item) => ({
            ...item,
            roadId: activeRoadId,
            routeId: activeRoute?.id || "",
            km: formatKm(item.km)
          }))
        : makeEmptyCongRows(12).map((x) => ({
            ...x,
            roadId: activeRoadId,
            routeId: activeRoute?.id || ""
          }))
    );

    setSaving(true);
    setMessage(`Đã lưu ${clean.length} cống. Đang đẩy lên cloud...`);
    try {
      if (cloudKey) {
        await pushManyCong(uid, { [cloudKey]: clean });
      }
      setMessage(
        `Đã lưu & đồng bộ ${clean.length} cống («${branchLabel}»). App tuần đường nhận lý trình / loại / chiều dài.`
      );
    } catch (err) {
      setMessage(`Đã lưu trên máy nhưng đẩy cloud lỗi: ${err?.message || err}.`);
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(""), 5000);
    }
  }

  function requestClear() {
    if (readOnly) return;
    if (!activeRoadId) {
      setMessage("Chưa chọn sổ đường.");
      return;
    }
    setPendingClear(true);
  }

  async function confirmClear() {
    setPendingClear(false);
    if (!activeRoadId) return;
    replaceCongRegistryForRoute(uid, activeRoadId, activeRoute, routeList, []);
    setRows(
      makeEmptyCongRows(12).map((x) => ({
        ...x,
        roadId: activeRoadId,
        routeId: activeRoute?.id || ""
      }))
    );
    if (uid && cloudKey) {
      try {
        await pushManyCong(uid, { [cloudKey]: [] });
      } catch {
        /* ignore */
      }
    }
    setMessage(`Đã xoá danh sách cống của «${branchLabel}».`);
    setTimeout(() => setMessage(""), 3500);
  }

  function cellProps(rowIndex, fieldIndex) {
    return {
      "data-cong-row": rowIndex,
      "data-cong-field": fieldIndex,
      onFocus: () => {
        focusRef.current = { row: rowIndex, field: fieldIndex };
      }
    };
  }

  function renderConditionField(row) {
    const info = statusByCongId.get(row.id);
    const opStatus = info?.status || CONG_OP_STATUS.BINH_THUONG;
    const opLabel = info?.label || congOpStatusLabel(opStatus);
    const histCount = info?.history?.length || 0;

    return (
      <button
        type="button"
        className={`culvert-op-status culvert-op-status--${opStatus}`}
        onClick={() => setStatusCongId(row.id)}
        title="Xem tình trạng và lịch sử sổ tuần đường"
      >
        <span className="culvert-op-status-label">{opLabel}</span>
        {histCount > 0 ? (
          <span className="culvert-op-status-count">{histCount}</span>
        ) : null}
      </button>
    );
  }

  function renderInput(row, rowIndex, field, extraClass = "") {
    const fieldIndex = CONG_GRID_FIELDS.indexOf(field);
    const isLen = CONG_LEN_FIELDS.some((f) => f.key === field);
    const flash = isPasteFlash(row, field);
    return (
      <input
        type="text"
        value={row[field] || ""}
        onChange={(e) => updateRow(row.id, field, e.target.value)}
        onBlur={
          field === "km"
            ? (e) => updateRow(row.id, "km", formatKm(e.target.value))
            : undefined
        }
        className={`hosocong-input${isLen || field === "aperture" || field === "load" || field === "yearBuilt" ? " hosocong-input--center" : ""}${flash ? " culvert-paste-flash" : ""}${extraClass ? ` ${extraClass}` : ""}`}
        readOnly={readOnly}
        {...cellProps(rowIndex, fieldIndex)}
      />
    );
  }

  return (
    <div className="nhaplieu-workspace sonhatky-workspace hosocong-workspace">
      <aside className="nhaplieu-sidebar sonhatky-sidebar no-print" style={sidebarStyle}>
        <div className="sidebar-sticky-head">
          <h2 className="sidebar-title">Danh sách cống</h2>
          <EntryRoutePicker label="Đường / nhánh" />
          <p className="sonhatky-day-summary">
            «{branchLabel}» · {filledCount} cống
            {needRepairCount ? ` · ${needRepairCount} cần theo dõi` : ""}
          </p>
          <p className="sidebar-subtitle">
            Bấm nhãn trạng thái để xem lịch sử sổ tuần đường. Form nhập: chọn xuất Hư hỏng /
            Sửa chữa / Bổ sung mới ghi lịch sử. Biểu thống kê — <strong>Ctrl+V</strong> dán Excel.
            Mục I = hiện trạng · Mục II = hư hỏng/bổ sung.
          </p>
          {message && <p className="save-ok">{message}</p>}
          {readOnly && (
            <p className="section-guide danhmuc-bd-readonly-hint">
              Chế độ chỉ xem. Chỉ tài khoản <strong>USER</strong> được sửa.
            </p>
          )}
          {!readOnly && (
            <>
              <label className="sidebar-field">
                <span className="sidebar-field-label">Thêm dòng trống</span>
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    type="number"
                    min="1"
                    className="sidebar-input"
                    style={{ flex: 1 }}
                    value={countInput}
                    onChange={(e) => setCountInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        generateRows();
                      }
                    }}
                    placeholder="VD: 30"
                  />
                  <button type="button" className="btn-secondary" onClick={generateRows}>
                    Tạo
                  </button>
                </div>
              </label>
              <label className="sidebar-field">
                <span className="sidebar-field-label">Hoặc dán khối Excel vào đây</span>
                <textarea
                  className="sidebar-input"
                  rows={4}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={"Copy từ Excel rồi dán vào đây\n(STT · Lý trình · Khẩu độ · …)"}
                />
              </label>
              <div className="danhmuc-bd-actions">
                <button type="button" className="btn-secondary" onClick={importPaste}>
                  Nạp vào bảng
                </button>
              </div>
              <div className="danhmuc-bd-actions">
                <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? "Đang lưu..." : "Lưu hồ sơ"}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={requestClear}
                  disabled={saving}
                >
                  Xoá hết
                </button>
              </div>
            </>
          )}
        </div>
      </aside>

      <SidebarResizer onMouseDown={onResizeStart} />

      <main className="nhaplieu-review-pane hosocong-review">
        <div className={`hosocong-bieu-pane${readOnly ? " danhmuc-bd-pane--readonly" : ""}`}>
          <div className="hosocong-bieu-toolbar no-print">
            {!readOnly && (
              <>
                <button type="button" className="btn-secondary" onClick={() => addRows()}>
                  + 5 dòng hiện trạng (I)
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => addRows(CONG_GROUP_HU_HONG)}
                >
                  + 5 dòng bổ sung (II)
                </button>
              </>
            )}
            <button type="button" className="btn-secondary" onClick={() => window.print()}>
              In biểu
            </button>
            {!readOnly && (
              <label className="hosocong-skip-stt">
                <input
                  type="checkbox"
                  checked={skipSttColumn}
                  onChange={(e) => setSkipSttColumn(e.target.checked)}
                />
                Bỏ qua cột STT khi dán Excel
              </label>
            )}
            <span className="hosocong-bieu-hint">
              Copy vùng từ Excel → chọn ô bắt đầu → Ctrl+V (tự thêm dòng trong cùng Mục I/II)
            </span>
            {pasteToast && <div className="culvert-paste-toast">{pasteToast}</div>}
          </div>

          <div className="hosocong-report-outer" ref={reportOuterRef}>
            <div
              className="hosocong-report-sheet"
              ref={reportSheetRef}
              onPasteCapture={readOnly ? undefined : handleTablePaste}
            >
              <header className="culvert-report-head" ref={reportHeadRef}>
                <div className="culvert-report-bangso">Bảng số 04</div>
                <h1 className="culvert-report-title">BẢNG THỐNG KÊ CỐNG CÁC LOẠI</h1>
                <p className="culvert-report-segment">{segmentLabel}</p>
                <p className="culvert-report-asof">{asOfLabel}</p>
              </header>

              <div className="culvert-table-wrap">
                <table className="culvert-table" ref={culvertTableRef}>
                  <colgroup>
                    <col className="c-stt" />
                    <col className="c-km" />
                    <col className="c-ap" />
                    <col className="c-body" />
                    <col className="c-head" />
                    <col className="c-head" />
                    <col className="c-len" />
                    <col className="c-len" />
                    <col className="c-len" />
                    <col className="c-len" />
                    <col className="c-len c-len-dakhan" />
                    <col className="c-len" />
                    <col className="c-load" />
                    <col className="c-year" />
                    <col className="c-cond" />
                    <col className="c-del" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th rowSpan={3}>STT</th>
                      <th rowSpan={3}>Lý trình</th>
                      <th rowSpan={3}>Khẩu độ</th>
                      <th colSpan={3}>Kết cấu cống</th>
                      <th colSpan={6}>Chiều dài cống</th>
                      <th rowSpan={3}>Tải trọng</th>
                      <th rowSpan={3}>
                        Năm xây
                        <br />
                        dựng
                      </th>
                      <th rowSpan={3}>Tình trạng hiện tại</th>
                      <th rowSpan={3} className="no-print culvert-th-action" />
                    </tr>
                    <tr>
                      <th rowSpan={2} className="c-body">Thân cống</th>
                      <th colSpan={2}>Đầu cống</th>
                      <th rowSpan={2} className="c-len">
                        Tròn
                        <br />
                        (m)
                      </th>
                      <th rowSpan={2} className="c-len">
                        Hộp
                        <br />
                        (m)
                      </th>
                      <th rowSpan={2} className="c-len">
                        Bản
                        <br />
                        (m)
                      </th>
                      <th rowSpan={2} className="c-len">
                        Vòm
                        <br />
                        (m)
                      </th>
                      <th rowSpan={2} className="c-len c-len-dakhan">
                        Đ. Khan
                        <br />
                        (m)
                      </th>
                      <th rowSpan={2} className="c-len">
                        Khác
                        <br />
                        (m)
                      </th>
                    </tr>
                    <tr>
                      <th className="c-head">T. Lưu</th>
                      <th className="c-head">H. Lưu</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="culvert-muc-row">
                      <td className="culvert-stt">I</td>
                      <td className="culvert-muc-label">Hiện trạng</td>
                      <td colSpan={4} />
                      {lenSummaryCells(summaryHien)}
                      <td colSpan={3} />
                      <td className="no-print culvert-action" />
                    </tr>

                    {rows
                      .map((row, rowIndex) => ({ row, rowIndex }))
                      .filter(({ row }) => row.group !== CONG_GROUP_HU_HONG)
                      .map(({ row, rowIndex }, i) => (
                        <tr key={row.id} className="culvert-data-row">
                          <td className="culvert-stt">{i + 1}</td>
                          <td className="culvert-cell--nowrap">{renderInput(row, rowIndex, "km")}</td>
                          <td>{renderInput(row, rowIndex, "aperture")}</td>
                          <td>{renderInput(row, rowIndex, "body")}</td>
                          <td>{renderInput(row, rowIndex, "headUp")}</td>
                          <td>{renderInput(row, rowIndex, "headDown")}</td>
                          {CONG_LEN_FIELDS.map(({ key }) => (
                            <td key={key}>{renderInput(row, rowIndex, key)}</td>
                          ))}
                          <td>{renderInput(row, rowIndex, "load")}</td>
                          <td>{renderInput(row, rowIndex, "yearBuilt")}</td>
                          <td className="culvert-cell--cond">
                            {renderConditionField(row)}
                          </td>
                          <td className="no-print culvert-action">
                            {!readOnly && (
                              <button
                                type="button"
                                className="culvert-del"
                                onClick={() => deleteRow(row.id)}
                                title="Xoá dòng"
                              >
                                ×
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}

                    <tr className="culvert-muc-row">
                      <td className="culvert-stt">II</td>
                      <td className="culvert-muc-label">Hư hỏng, bổ sung</td>
                      <td colSpan={4} />
                      {lenSummaryCells(summaryHu)}
                      <td colSpan={3} />
                      <td className="no-print culvert-action" />
                    </tr>

                    {rows
                      .map((row, rowIndex) => ({ row, rowIndex }))
                      .filter(({ row }) => row.group === CONG_GROUP_HU_HONG)
                      .map(({ row, rowIndex }, i) => (
                        <tr key={row.id} className="culvert-data-row culvert-data-row--ii">
                          <td className="culvert-stt">{i + 1}</td>
                          <td className="culvert-cell--nowrap">{renderInput(row, rowIndex, "km")}</td>
                          <td>{renderInput(row, rowIndex, "aperture")}</td>
                          <td>{renderInput(row, rowIndex, "body")}</td>
                          <td>{renderInput(row, rowIndex, "headUp")}</td>
                          <td>{renderInput(row, rowIndex, "headDown")}</td>
                          {CONG_LEN_FIELDS.map(({ key }) => (
                            <td key={key}>{renderInput(row, rowIndex, key)}</td>
                          ))}
                          <td>{renderInput(row, rowIndex, "load")}</td>
                          <td>{renderInput(row, rowIndex, "yearBuilt")}</td>
                          <td className="culvert-cell--cond">
                            {renderConditionField(row)}
                          </td>
                          <td className="no-print culvert-action">
                            {!readOnly && (
                              <button
                                type="button"
                                className="culvert-del"
                                onClick={() => deleteRow(row.id)}
                                title="Xoá dòng"
                              >
                                ×
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}

                    <tr className="culvert-muc-row culvert-muc-row--tong">
                      <td className="culvert-stt">III</td>
                      <td className="culvert-muc-label">
                        Tổng ({summaryAll.totalCount} cái)
                      </td>
                      <td colSpan={4} />
                      {lenSummaryCells(summaryAll)}
                      <td colSpan={3} />
                      <td className="no-print culvert-action" />
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="culvert-footer-sum">
                <div className="culvert-footer-sum-row culvert-footer-sum-row--total">
                  <span>Tổng cống:</span>
                  <span>{summaryAll.totalCount} Cái</span>
                  <span>{formatMeters(summaryAll.totalMeters)} md</span>
                </div>
                {CONG_LEN_FIELDS.map(({ key, summary }) => (
                  <div key={key} className="culvert-footer-sum-row">
                    <span>{summary}:</span>
                    <span>{summaryAll.byKey[key]?.count || 0} Cái</span>
                    <span>{formatMeters(summaryAll.byKey[key]?.meters || 0)} md</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      <PasswordConfirmModal
        open={pendingClear}
        title="Xoá hết danh sách cống"
        description={`Bạn sắp xoá toàn bộ danh sách cống của «${branchLabel}».\n\nThao tác này không hoàn tác được trên máy. Nhập mật khẩu tài khoản đang đăng nhập để xác nhận.`}
        confirmLabel="Xoá hết"
        onCancel={() => setPendingClear(false)}
        onConfirmed={() => void confirmClear()}
      />

      {statusDrawerCong && statusDrawerInfo ? (
        <CongStatusDrawer
          cong={statusDrawerCong}
          status={statusDrawerInfo.status}
          history={statusDrawerInfo.history}
          roadLabel={branchLabel}
          onClose={() => setStatusCongId("")}
        />
      ) : null}
    </div>
  );
}
