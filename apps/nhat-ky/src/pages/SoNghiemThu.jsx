import { useEffect, useMemo, useState } from "react";
import ViDateInput from "../components/ViDateInput";
import NghiemThuSheet from "../components/NghiemThuSheet";
import RoutesViewSidebarControls from "../components/RoutesViewSidebarControls";
import { useAuth } from "../context/AuthContext";
import { useRoadWorkspace } from "../context/RoadWorkspaceContext";
import { formatDisplayDate, loadStorage, safeSetLocalStorage } from "../utils/nhatKyFormat";
import {
  buildNghiemThuQlRows,
  buildNghiemThuVolumeSections,
  buildNghiemThuQlAutoByKey,
  buildNghiemThuReportsInRange,
  buildNghiemThuReportsInRangeAsync,
  countNghiemThuJobs,
  indexNghiemThuJobDates,
  defaultNghiemThuMeta,
  formatNghiemThuDanhXung,
  loadNghiemThuDayState,
  loadNghiemThuBookDefaults,
  saveNghiemThuDayState,
  materializeNghiemThuMeta,
  resolveNghiemThuDoiTuong,
  resolveNghiemThuDiaDiem,
  resolveNghiemThuCanCu
} from "../utils/nghiemThuFormat";
import {
  NT_DEFAULT_MARGINS,
  printNghiemThuPages,
  printNghiemThuReports
} from "../utils/nghiemThuPrint";
import { downloadNghiemThuWord } from "../lib/nghiemThuWordBuilder";
import { exportNghiemThuExcel } from "../utils/nghiemThuExcel";
import { DEMXE_CHANGED_EVENT, loadDemXeLedger, resolveDemXeScope } from "../utils/demXeStore";
import { getRoadRoutes } from "../utils/roadsCatalog";
import { eachIsoDateInclusive } from "../utils/nhatKyPrintRows";

import SidebarResizer from "../components/SidebarResizer";
import { useResizableSidebar } from "../hooks/useResizableSidebar";

const MARGIN_KEY = "nghiemthu-print-margins-v2";

function DanhXungToggle({ value, disabled, onChange }) {
  const current = formatNghiemThuDanhXung(value);
  return (
    <div className="print-scope-seg" role="tablist" aria-label="Danh xưng">
      {["Ông", "Bà"].map((label) => (
        <button
          key={label}
          type="button"
          role="tab"
          aria-selected={current === label}
          className={`print-scope-seg__btn${current === label ? " is-active" : ""}`}
          disabled={disabled}
          onClick={() => onChange(label)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function clampMm(v, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(40, Math.max(0, Math.round(n * 10) / 10));
}

function loadMargins() {
  try {
    const raw = JSON.parse(localStorage.getItem(MARGIN_KEY));
    if (!raw || typeof raw !== "object") return { ...NT_DEFAULT_MARGINS };
    return {
      top: clampMm(raw.top, NT_DEFAULT_MARGINS.top),
      right: clampMm(raw.right, NT_DEFAULT_MARGINS.right),
      bottom: clampMm(raw.bottom, NT_DEFAULT_MARGINS.bottom),
      left: clampMm(raw.left, NT_DEFAULT_MARGINS.left)
    };
  } catch {
    return { ...NT_DEFAULT_MARGINS };
  }
}

export default function SoNghiemThu({
  date,
  onDateChange,
  onGoEdit,
  storageTick = 0,
  readOnly = false
}) {
  const { profile } = useAuth();
  const {
    storageKey,
    activeRoad,
    activeRoadId,
    activeRouteId,
    routes,
    catalogRoad,
    ownerUid,
    filterByRouteView
  } = useRoadWorkspace();
  const { sidebarStyle, onResizeStart } = useResizableSidebar({ defaultWidth: 300 });
  const [meta, setMeta] = useState(() =>
    loadNghiemThuDayState(storageKey, date, activeRoad).meta
  );
  const [qlOverrides, setQlOverrides] = useState({});
  const [volOverrides, setVolOverrides] = useState({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [demXeTick, setDemXeTick] = useState(0);
  const [exportScope, setExportScope] = useState("day"); // day | range
  const [printOpen, setPrintOpen] = useState(false);
  const [rangeFrom, setRangeFrom] = useState(date);
  const [rangeTo, setRangeTo] = useState(date);
  const [margins, setMargins] = useState(loadMargins);
  const [exportingWord, setExportingWord] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [debouncedRange, setDebouncedRange] = useState(() => ({
    from: date,
    to: date
  }));

  const { entries } = useMemo(
    () => loadStorage(storageKey),
    [storageKey, storageTick]
  );

  useEffect(() => {
    const onChange = () => setDemXeTick((t) => t + 1);
    window.addEventListener(DEMXE_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(DEMXE_CHANGED_EVENT, onChange);
  }, []);

  useEffect(() => {
    if (!rangeFrom) setRangeFrom(date);
    if (!rangeTo) setRangeTo(date);
  }, [date, rangeFrom, rangeTo]);

  const demXeLedger = useMemo(() => {
    const uid = ownerUid || profile?.uid || "";
    if (!uid || !activeRoadId) return null;
    const routeList = routes?.length ? routes : getRoadRoutes(catalogRoad || activeRoad);
    const scope = resolveDemXeScope(
      uid,
      activeRoadId,
      activeRouteId || routeList[0]?.id || "",
      routeList
    );
    return loadDemXeLedger(scope);
  }, [
    ownerUid,
    profile?.uid,
    activeRoadId,
    activeRouteId,
    routes,
    catalogRoad,
    activeRoad,
    demXeTick,
    storageTick
  ]);

  useEffect(() => {
    if (!storageKey) return;
    const loaded = loadNghiemThuDayState(storageKey, date, activeRoad);
    setMeta(loaded.meta);
    setQlOverrides(loaded.qlOverrides || {});
    setVolOverrides(loaded.volOverrides || {});
    setDirty(false);
    setSaveMsg("");
  }, [storageKey, activeRoad, date, storageTick]);

  // Đảm bảo nhân sự luôn lấy từ mặc định sổ (không kẹt bản theo ngày cũ).
  useEffect(() => {
    if (!storageKey) return;
    const book = loadNghiemThuBookDefaults(storageKey);
    if (!Object.keys(book).length) return;
    setMeta((prev) => {
      const next = { ...prev, ...book };
      const same = [
        "goiThau",
        "canCuHopDong",
        "banQlbtDanhXung",
        "banQlbtTen",
        "banQlbtChucVu",
        "nhaThauDanhXung",
        "nhaThauTen",
        "nhaThauChucVu",
        "nhaThauDonVi"
      ].every((k) => String(prev?.[k] ?? "") === String(next?.[k] ?? ""));
      return same ? prev : next;
    });
  }, [storageKey, date, storageTick]);

  const volumeSections = useMemo(() => {
    const base = buildNghiemThuVolumeSections(entries, date, filterByRouteView);
    if (!Object.keys(volOverrides).length) return base;
    return base.map((sec) => ({
      ...sec,
      rows: sec.rows.map((r) => {
        const k = `${sec.groupKey || sec.key}-${r.stt}`;
        return Object.prototype.hasOwnProperty.call(volOverrides, k)
          ? { ...r, mucDo: volOverrides[k] }
          : r;
      })
    }));
  }, [entries, date, filterByRouteView, volOverrides]);

  const jobCount = useMemo(
    () => countNghiemThuJobs(entries, date, filterByRouteView),
    [entries, date, filterByRouteView]
  );

  const qlAutoByKey = useMemo(
    () => buildNghiemThuQlAutoByKey(entries, date, filterByRouteView, demXeLedger),
    [entries, date, filterByRouteView, demXeLedger]
  );

  const qlRows = useMemo(
    () => buildNghiemThuQlRows(qlOverrides, qlAutoByKey),
    [qlOverrides, qlAutoByKey]
  );

  const rangeStart =
    rangeFrom && rangeTo && rangeFrom > rangeTo ? rangeTo : rangeFrom;
  const rangeEnd =
    rangeFrom && rangeTo && rangeFrom > rangeTo ? rangeFrom : rangeTo;

  const rangeDates = useMemo(
    () => eachIsoDateInclusive(rangeStart, rangeEnd),
    [rangeStart, rangeEnd]
  );

  const jobDateSet = useMemo(
    () => indexNghiemThuJobDates(entries, filterByRouteView),
    [entries, filterByRouteView]
  );

  const rangeJobDays = useMemo(
    () => rangeDates.filter((d) => jobDateSet.has(d)),
    [rangeDates, jobDateSet]
  );

  const longRange = rangeDates.length >= 28;

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedRange({ from: rangeStart, to: rangeEnd });
    }, longRange ? 280 : 80);
    return () => window.clearTimeout(t);
  }, [rangeStart, rangeEnd, longRange]);

  useEffect(() => {
    safeSetLocalStorage(MARGIN_KEY, margins);
  }, [margins]);

  function shiftDay(delta) {
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() + delta);
    handleDateChange(d.toISOString().split("T")[0]);
  }

  function handleDateChange(next) {
    if (next === date) return;
    // Đổi ngày: tự lưu biên bản đang sửa để không mất nội dung.
    if (!readOnly && dirty && storageKey) {
      const result = saveNghiemThuDayState(storageKey, date, {
        meta,
        qlOverrides,
        volOverrides,
        road: activeRoad
      });
      if (!result.ok) {
        if (
          !window.confirm(
            `${result.msg || "Không lưu được biên bản."}\nVẫn đổi ngày (có thể mất nội dung chưa lưu)?`
          )
        ) {
          return;
        }
      } else {
        setDirty(false);
        if (result.meta) setMeta(result.meta);
      }
    }
    onDateChange(next);
  }

  function updateMeta(field, value) {
    if (readOnly) return;
    setMeta((prev) => ({ ...prev, [field]: value }));
    setDirty(true);
    setSaveMsg("");
  }

  function updateQl(key, value) {
    if (readOnly) return;
    setQlOverrides((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
    setSaveMsg("");
  }

  function updateVol(key, value) {
    if (readOnly) return;
    setVolOverrides((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
    setSaveMsg("");
  }

  function resetMeta() {
    if (readOnly) return;
    setMeta(defaultNghiemThuMeta(activeRoad, date, storageKey));
    setQlOverrides({});
    setVolOverrides({});
    setDirty(true);
    setSaveMsg("");
  }

  function handleSave() {
    if (readOnly || !storageKey) return;
    setSaving(true);
    const result = saveNghiemThuDayState(storageKey, date, {
      meta,
      qlOverrides,
      volOverrides,
      road: activeRoad
    });
    setSaving(false);
    if (result.ok) {
      if (result.meta) setMeta(result.meta);
      else {
        const book = loadNghiemThuBookDefaults(storageKey);
        setMeta((prev) => ({ ...prev, ...book, ...materializeNghiemThuMeta(prev, activeRoad, date) }));
      }
      setDirty(false);
      setSaveMsg("Đã lưu biên bản — giữ nguyên khi đổi ngày / mở lại.");
    } else {
      setSaveMsg(result.msg || "Lưu thất bại.");
    }
  }

  const sheetMeta = useMemo(
    () => ({
      ...meta,
      thoiGian:
        String(meta.thoiGian || "").trim() ||
        (formatDisplayDate(date) ? `Ngày ${formatDisplayDate(date)}` : ""),
      doiTuong: resolveNghiemThuDoiTuong(meta, activeRoad),
      diaDiem: resolveNghiemThuDiaDiem(meta, activeRoad),
      canCu: resolveNghiemThuCanCu(meta, activeRoad)
    }),
    [meta, date, activeRoad]
  );

  const currentDayReport = useMemo(
    () => ({
      date,
      road: activeRoad,
      meta: sheetMeta,
      qlRows,
      volumeSections,
      jobCount
    }),
    [date, activeRoad, sheetMeta, qlRows, volumeSections, jobCount]
  );

  const rangeSettled =
    debouncedRange.from === rangeStart && debouncedRange.to === rangeEnd;
  const buildRangePreview =
    printOpen &&
    exportScope === "range" &&
    rangeJobDays.length > 0 &&
    rangeSettled &&
    !longRange;

  const rangeReports = useMemo(() => {
    if (!buildRangePreview) return [];
    return buildNghiemThuReportsInRange({
      storageKey,
      dateFrom: rangeStart,
      dateTo: rangeEnd,
      road: activeRoad,
      entries,
      filterByRouteView,
      demXeLedger,
      includeEmptyDays: false
    });
  }, [
    buildRangePreview,
    storageKey,
    rangeStart,
    rangeEnd,
    activeRoad,
    entries,
    filterByRouteView,
    demXeLedger
  ]);

  const previewReports =
    exportScope === "range" ? rangeReports : [currentDayReport];

  const periodFrom = exportScope === "range" ? rangeStart : date;
  const periodTo = exportScope === "range" ? rangeEnd : date;

  function collectExportReports() {
    if (exportScope === "range") {
      return buildNghiemThuReportsInRange({
        storageKey,
        dateFrom: rangeStart,
        dateTo: rangeEnd,
        road: activeRoad,
        entries,
        filterByRouteView,
        demXeLedger,
        includeEmptyDays: false
      });
    }
    return [
      {
        date,
        road: activeRoad,
        meta: {
          ...meta,
          thoiGian:
            String(meta.thoiGian || "").trim() ||
            (formatDisplayDate(date) ? `Ngày ${formatDisplayDate(date)}` : ""),
          doiTuong: resolveNghiemThuDoiTuong(meta, activeRoad),
          diaDiem: resolveNghiemThuDiaDiem(meta, activeRoad),
          canCu: resolveNghiemThuCanCu(meta, activeRoad)
        },
        qlRows,
        volumeSections
      }
    ];
  }

  async function handleExportWord() {
    if (exportingWord || exportingExcel) return;
    if (
      dirty &&
      !window.confirm("Biên bản ngày hiện tại chưa lưu. Xuất vẫn tiếp tục?")
    ) {
      return;
    }
    if (exportScope === "range" && !rangeJobDays.length) {
      window.alert("Không có ngày nào có khối lượng BDTX trong khoảng đã chọn.");
      return;
    }
    setExportingWord(true);
    setSaveMsg(
      exportScope === "range"
        ? `Đang tạo ${rangeJobDays.length} biên bản Word…`
        : ""
    );
    try {
      const reports =
        exportScope === "range"
          ? await buildNghiemThuReportsInRangeAsync({
              storageKey,
              dateFrom: rangeStart,
              dateTo: rangeEnd,
              road: activeRoad,
              entries,
              filterByRouteView,
              demXeLedger,
              includeEmptyDays: false,
              yieldEvery: 6,
              onProgress: ({ done, total }) => {
                setSaveMsg(`Đang tạo Word ${done}/${total}…`);
              }
            })
          : collectExportReports();
      if (!reports.length) {
        window.alert("Không có biên bản để xuất.");
        return;
      }
      const name =
        periodFrom === periodTo
          ? `Bien_ban_NT_${periodFrom}.docx`
          : `Bien_ban_NT_${periodFrom}_den_${periodTo}.docx`;
      await downloadNghiemThuWord(reports, name, margins);
      setSaveMsg(`Đã xuất Word · ${reports.length} biên bản.`);
    } catch (err) {
      console.error(err);
      window.alert(err?.message || "Không xuất được file Word.");
    } finally {
      setExportingWord(false);
    }
  }

  async function handleExportExcel() {
    if (exportingWord || exportingExcel) return;
    if (
      dirty &&
      !window.confirm("Biên bản ngày hiện tại chưa lưu. Xuất vẫn tiếp tục?")
    ) {
      return;
    }
    if (exportScope === "range" && !rangeJobDays.length) {
      window.alert("Không có ngày nào có khối lượng BDTX trong khoảng đã chọn.");
      return;
    }
    setExportingExcel(true);
    setSaveMsg(
      exportScope === "range"
        ? `Đang tạo ${rangeJobDays.length} biên bản Excel…`
        : ""
    );
    try {
      const reports =
        exportScope === "range"
          ? await buildNghiemThuReportsInRangeAsync({
              storageKey,
              dateFrom: rangeStart,
              dateTo: rangeEnd,
              road: activeRoad,
              entries,
              filterByRouteView,
              demXeLedger,
              includeEmptyDays: false,
              yieldEvery: 6,
              onProgress: ({ done, total }) => {
                setSaveMsg(`Đang tạo Excel ${done}/${total}…`);
              }
            })
          : collectExportReports();
      if (!reports.length) {
        window.alert("Không có biên bản để xuất.");
        return;
      }
      await exportNghiemThuExcel(reports, {
        dateFrom: periodFrom,
        dateTo: periodTo
      });
      setSaveMsg(`Đã xuất Excel · ${reports.length} biên bản.`);
    } catch (err) {
      console.error(err);
      window.alert(err?.message || "Không xuất được file Excel.");
    } finally {
      setExportingExcel(false);
    }
  }

  async function handlePrint() {
    if (exportScope === "range" && !rangeJobDays.length) {
      window.alert("Không có ngày nào có khối lượng BDTX trong khoảng đã chọn.");
      return;
    }
    if (
      dirty &&
      !window.confirm("Biên bản ngày hiện tại chưa lưu. In vẫn tiếp tục?")
    ) {
      return;
    }
    if (exportScope !== "range") {
      printNghiemThuPages(margins);
      return;
    }
    setPrinting(true);
    setSaveMsg(`Đang tạo ${rangeJobDays.length} biên bản…`);
    try {
      const reports = await buildNghiemThuReportsInRangeAsync({
        storageKey,
        dateFrom: rangeStart,
        dateTo: rangeEnd,
        road: activeRoad,
        entries,
        filterByRouteView,
        demXeLedger,
        includeEmptyDays: false,
        yieldEvery: 6,
        onProgress: ({ done, total }) => {
          setSaveMsg(`Đang tạo ${done}/${total} biên bản…`);
        }
      });
      if (!reports.length) {
        window.alert("Không có biên bản để in.");
        return;
      }
      setSaveMsg(`Đang chuẩn bị in ${reports.length} biên bản…`);
      await printNghiemThuReports(reports, margins, {
        onProgress: ({ done, total }) => {
          setSaveMsg(`Đang chuẩn bị in ${done}/${total}…`);
        }
      });
      setSaveMsg(
        `Đã gửi in ${reports.length} biên bản. Trong hộp thoại in chọn «Save as PDF» nếu cần một file.`
      );
    } catch (err) {
      console.error(err);
      window.alert(err?.message || "Không in được PDF. Thử Xuất Word.");
    } finally {
      setPrinting(false);
    }
  }

  return (
    <div
      className={`nhaplieu-workspace sonhatky-workspace songhiemthu-workspace${
        printOpen ? " songhiemthu-workspace--print" : ""
      }`}
    >
      <aside
        className="nhaplieu-sidebar sonhatky-sidebar no-print"
        style={sidebarStyle}
      >
        <div className="sidebar-sticky-head">
          <h2 className="sidebar-title">Biên bản NT CVXD</h2>
          <div className="sonhatky-date-toolbar">
            <div className="sonhatky-day-buttons">
              <button
                type="button"
                onClick={() => shiftDay(-1)}
                className="btn-primary btn-primary--compact sonhatky-nav-btn"
                title="Ngày trước"
              >
                ◀
              </button>
              <button
                type="button"
                onClick={() => shiftDay(1)}
                className="btn-primary btn-primary--compact sonhatky-nav-btn"
                title="Ngày sau"
              >
                ▶
              </button>
            </div>
            <ViDateInput
              value={date}
              onChange={handleDateChange}
              className="sidebar-input sidebar-input--date"
              aria-label="Chọn ngày nghiệm thu"
            />
          </div>
          <p className="sonhatky-day-summary">
            {formatDisplayDate(date)}
            {jobCount > 0
              ? ` · ${jobCount} hạng mục BDTX`
              : " · Chưa có khối lượng BDTX"}
            {dirty ? " · Chưa lưu" : ""}
          </p>
          <RoutesViewSidebarControls />
          <div className="sonhatky-print-actions">
            {!readOnly && (
              <button
                type="button"
                className="btn-primary"
                disabled={saving || !dirty}
                onClick={handleSave}
              >
                {saving ? "Đang lưu…" : "Lưu biên bản"}
              </button>
            )}
            {onGoEdit && !readOnly && (
              <button type="button" className="btn-secondary" onClick={onGoEdit}>
                Thêm / sửa dữ liệu sổ
              </button>
            )}
            <button
              type="button"
              className={`btn-secondary sonhatky-edit-btn sonhatky-edit-btn--sub${
                printOpen ? " active" : ""
              }`}
              onClick={() => setPrintOpen((v) => !v)}
            >
              {printOpen ? "Đóng xem trước in" : "In biên bản"}
            </button>
            {saveMsg ? <p className="traffic-duty-save-msg">{saveMsg}</p> : null}
          </div>

          {printOpen ? (
            <>
              <div className="print-form-label">Phạm vi xuất / in</div>
              <div
                className="print-scope-seg"
                role="tablist"
                aria-label="Phạm vi xuất"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={exportScope === "day"}
                  className={`print-scope-seg__btn${
                    exportScope === "day" ? " is-active" : ""
                  }`}
                  onClick={() => setExportScope("day")}
                >
                  Ngày hiện tại
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={exportScope === "range"}
                  className={`print-scope-seg__btn${
                    exportScope === "range" ? " is-active" : ""
                  }`}
                  onClick={() => setExportScope("range")}
                >
                  Khoảng ngày
                </button>
              </div>

              {exportScope === "range" && (
                <div className="print-range-card print-range-card--compact">
                  <div className="print-range-fields-row">
                    <label className="print-range-field">
                      <span>Từ ngày</span>
                      <ViDateInput
                        value={rangeFrom}
                        onChange={setRangeFrom}
                        className="sidebar-input sidebar-input--date"
                        aria-label="Từ ngày xuất"
                      />
                    </label>
                    <label className="print-range-field">
                      <span>Đến ngày</span>
                      <ViDateInput
                        value={rangeTo}
                        onChange={setRangeTo}
                        className="sidebar-input sidebar-input--date"
                        aria-label="Đến ngày xuất"
                      />
                    </label>
                  </div>
                  <div
                    className={`print-range-stat${
                      rangeDates.length === 0 || rangeJobDays.length === 0
                        ? " print-range-stat--warn"
                        : ""
                    }`}
                  >
                    {rangeDates.length === 0
                      ? "Khoảng ngày không hợp lệ"
                      : rangeJobDays.length > 0
                        ? `${rangeJobDays.length} ngày có KL BDTX · ${rangeDates.length} ngày (A→B)`
                        : "Không có ngày nào có khối lượng BDTX trong A→B"}
                  </div>
                  <p className="print-range-hint">
                    In theo <strong>ngày thực hiện BDTX</strong> (ngày dự kiến sửa
                    trên sổ), từ ngày nhỏ đến ngày lớn dù chọn ngược.
                  </p>
                </div>
              )}
              <ul className="print-form-tips">
                <li>Kéo đường lề xanh trên tờ đầu để căn lề</li>
                <li>Khoảng dài: In / PDF gom một lần (đủ 6 tháng)</li>
                <li>
                  PDF có chữ đầu/chân trang (ngày, URL…): trong hộp thoại in, tắt{" "}
                  <strong>Headers and footers</strong> /{" "}
                  <strong>Đầu trang và chân trang</strong> (More settings)
                </li>
              </ul>
            </>
          ) : null}
        </div>

        <div className="sidebar-scroll">
          <label className="field-label">Ban QLBT — Danh xưng</label>
          <DanhXungToggle
            value={meta.banQlbtDanhXung}
            disabled={readOnly}
            onChange={(v) => updateMeta("banQlbtDanhXung", v)}
          />
          <label className="field-label">Ban QLBT — Họ tên</label>
          <input
            className="sidebar-input"
            value={meta.banQlbtTen || ""}
            disabled={readOnly}
            onChange={(e) => updateMeta("banQlbtTen", e.target.value)}
          />
          <label className="field-label">Ban QLBT — Chức vụ</label>
          <input
            className="sidebar-input"
            value={meta.banQlbtChucVu || ""}
            disabled={readOnly}
            onChange={(e) => updateMeta("banQlbtChucVu", e.target.value)}
          />

          <label className="field-label">Nhà thầu — Đơn vị</label>
          <input
            className="sidebar-input"
            value={meta.nhaThauDonVi || ""}
            disabled={readOnly}
            onChange={(e) => updateMeta("nhaThauDonVi", e.target.value)}
          />
          <label className="field-label">Nhà thầu — Danh xưng</label>
          <DanhXungToggle
            value={meta.nhaThauDanhXung}
            disabled={readOnly}
            onChange={(v) => updateMeta("nhaThauDanhXung", v)}
          />
          <label className="field-label">Nhà thầu — Họ tên</label>
          <input
            className="sidebar-input"
            value={meta.nhaThauTen || ""}
            disabled={readOnly}
            onChange={(e) => updateMeta("nhaThauTen", e.target.value)}
          />
          <label className="field-label">Nhà thầu — Chức vụ</label>
          <input
            className="sidebar-input"
            value={meta.nhaThauChucVu || ""}
            disabled={readOnly}
            onChange={(e) => updateMeta("nhaThauChucVu", e.target.value)}
          />

          {!readOnly && (
            <button type="button" className="btn-secondary" onClick={resetMeta}>
              Đặt lại thông tin mẫu
            </button>
          )}
        </div>
      </aside>

      <SidebarResizer onMouseDown={onResizeStart} />

      <main className="nhaplieu-review-pane songhiemthu-preview-pane">
        {!printOpen ? (
          <div className="sonhatky-screen-preview">
            <div className="nghiemthu-print-stack nghiemthu-print-stack--edit">
              <NghiemThuSheet
                date={date}
                road={activeRoad}
                meta={sheetMeta}
                qlRows={qlRows}
                volumeSections={volumeSections}
                readOnly={readOnly}
                onMetaChange={updateMeta}
                onQlChange={updateQl}
                onVolChange={updateVol}
              />
            </div>
          </div>
        ) : (
          <>
            <div className="sonhatky-print-toolbar print-toolbar no-print">
              <div className="print-toolbar-main">
                <div className="print-toolbar-kicker">Xuất / in biên bản</div>
                <div className="print-toolbar-chips">
                  <span className="print-chip">
                    {periodFrom === periodTo
                      ? formatDisplayDate(periodFrom)
                      : `${formatDisplayDate(periodFrom)} → ${formatDisplayDate(periodTo)}`}
                  </span>
                  <span className="print-chip">
                    {exportScope === "range"
                      ? `${rangeJobDays.length} biên bản`
                      : jobCount > 0
                        ? `${jobCount} hạng mục BDTX`
                        : "Chưa có KL BDTX"}
                  </span>
                  <span className="print-chip print-chip--muted">
                    Lề {margins.top}/{margins.right}/{margins.bottom}/{margins.left}{" "}
                    mm
                  </span>
                </div>
              </div>
              <div className="print-toolbar-actions">
                <button
                  type="button"
                  className="btn-secondary btn-secondary--compact print-toolbar-action"
                  disabled={
                    exportingExcel ||
                    exportingWord ||
                    (exportScope === "range" && rangeJobDays.length === 0)
                  }
                  onClick={() => void handleExportExcel()}
                >
                  {exportingExcel ? "Đang xuất…" : "Xuất Excel"}
                </button>
                <button
                  type="button"
                  className="btn-secondary btn-secondary--compact print-toolbar-action"
                  disabled={
                    exportingExcel ||
                    exportingWord ||
                    (exportScope === "range" && rangeJobDays.length === 0)
                  }
                  onClick={() => void handleExportWord()}
                >
                  {exportingWord ? "Đang xuất…" : "Xuất Word"}
                </button>
                <button
                  type="button"
                  className="btn-primary btn-primary--compact print-toolbar-action"
                  disabled={
                    printing ||
                    (exportScope === "range" && rangeJobDays.length === 0)
                  }
                  onClick={() => void handlePrint()}
                  title="In máy in hoặc chọn «Microsoft Print to PDF» / «Save as PDF». Khoảng dài gom một hộp thoại in."
                >
                  {printing ? "Đang in…" : "In / PDF"}
                </button>
              </div>
            </div>

            <div className="nghiemthu-print-stack">
              {exportScope === "day" ? (
                <NghiemThuSheet
                  date={date}
                  road={activeRoad}
                  meta={sheetMeta}
                  qlRows={qlRows}
                  volumeSections={volumeSections}
                  readOnly={readOnly}
                  onMetaChange={updateMeta}
                  onQlChange={updateQl}
                  onVolChange={updateVol}
                  margins={margins}
                  showGuides
                  onMarginsChange={setMargins}
                />
              ) : rangeJobDays.length === 0 ? (
                <p className="stats-empty-hint" style={{ padding: 24 }}>
                  Không có ngày nào có khối lượng BDTX trong khoảng đã chọn.
                </p>
              ) : previewReports.length === 0 ? (
                <div className="stats-empty-hint" style={{ padding: 24 }}>
                  <p>
                    <strong>{rangeJobDays.length}</strong> ngày có khối lượng
                    BDTX trong {rangeDates.length} ngày đã chọn.
                  </p>
                  <p>
                    Khoảng từ 1 tháng trở lên không dựng trước toàn bộ tờ (để
                    chọn lịch nhanh). Bấm <strong>In / PDF</strong> — một hộp
                    thoại in đủ cả khoảng. Muốn file Word/Excel:{" "}
                    <strong>Xuất Word / Excel</strong>.
                  </p>
                  <p style={{ marginTop: 12 }}>
                    {rangeJobDays.slice(0, 20).map(formatDisplayDate).join(" · ")}
                    {rangeJobDays.length > 20
                      ? ` · … (+${rangeJobDays.length - 20} ngày)`
                      : ""}
                  </p>
                </div>
              ) : (
                previewReports.map((rep, i) => (
                  <NghiemThuSheet
                    key={rep.date}
                    date={rep.date}
                    road={rep.road}
                    meta={rep.meta}
                    qlRows={rep.qlRows}
                    volumeSections={rep.volumeSections}
                    readOnly
                    margins={margins}
                    showGuides={i === 0}
                    onMarginsChange={i === 0 ? setMargins : undefined}
                  />
                ))
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
