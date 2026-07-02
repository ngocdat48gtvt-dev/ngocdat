import { useEffect, useMemo, useState } from "react";
import { parseViDate } from "../utils/incidentFilters.js";
import {
  buildBaoCaoAnhFilename,
  exportIncidentsWord,
  matchesWordVolumeFilter
} from "../services/incidentExportService.js";

function formatViDate(d) {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${d.getFullYear()}`;
}

function incidentDateRange(items) {
  let min = null;
  let max = null;
  for (const inc of items) {
    const d = inc.date ? parseViDate(inc.date) : null;
    if (!d) continue;
    if (!min || d < min) min = d;
    if (!max || d > max) max = d;
  }
  return {
    start: min ? formatViDate(min) : "",
    end: max ? formatViDate(max) : ""
  };
}

export default function WordExportDialog({ open, onClose, items, filters }) {
  const defaults = useMemo(() => {
    const first = items[0];
    const road = first?.road ?? "";
    const type = first?.type ?? "";
    const { start, end } = incidentDateRange(items);
    return {
      title1: `ẢNH ${type.toUpperCase()} TRÊN ${road}`.trim(),
      title2:
        start && end
          ? `(Do ảnh hưởng của các đợt mưa, lũ từ ngày ${start} đến ngày ${end})`
          : ""
    };
  }, [items]);

  const [title1, setTitle1] = useState(defaults.title1);
  const [title2, setTitle2] = useState(defaults.title2);
  const [under100, setUnder100] = useState(true);
  const [over100, setOver100] = useState(true);
  const [showStt, setShowStt] = useState(true);
  const [startStt, setStartStt] = useState("1");
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    if (!open) return;
    setTitle1(defaults.title1);
    setTitle2(defaults.title2);
    setUnder100(true);
    setOver100(true);
    setShowStt(true);
    setStartStt("1");
    setProgress(null);
  }, [open, defaults]);

  const finalList = useMemo(
    () => items.filter((inc) => matchesWordVolumeFilter(inc, under100, over100)),
    [items, under100, over100]
  );

  async function handleExport() {
    if (finalList.length === 0) {
      window.alert("Không có sự cố nào khớp bộ lọc khối lượng.");
      return;
    }
    setExporting(true);
    setProgress({ done: 0, total: finalList.length });
    try {
      const filterSuffix =
        under100 && !over100 ? " (dưới 100m3)" : !under100 && over100 ? " (trên 100m3)" : "";
      const failed = await exportIncidentsWord(
        finalList,
        buildBaoCaoAnhFilename(finalList, filters),
        {
          title1: title1 + filterSuffix,
          title2,
          showStt,
          startStt: Number(startStt) || 1
        },
        (done, total) => setProgress({ done, total })
      );
      if (failed > 0) {
        window.alert(`Đã xuất Word, nhưng ${failed} ảnh không tải được.`);
      }
      onClose();
    } catch {
      window.alert("Không xuất được file Word.");
    } finally {
      setExporting(false);
      setProgress(null);
    }
  }

  if (!open) return null;

  return (
    <div className="incident-drawer-overlay" onClick={onClose}>
      <div
        className="incident-drawer incident-word-export"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="incident-drawer-head">
          <h3>Ghép báo cáo Word</h3>
          <button type="button" className="incident-drawer-close" onClick={onClose} aria-label="Đóng">
            ×
          </button>
        </div>
        <div className="incident-form-body">
          <label className="incident-form-field incident-form-field--full">
            <span className="entry-form-label">Tiêu đề dòng 1</span>
            <input className="sidebar-input" value={title1} onChange={(e) => setTitle1(e.target.value)} disabled={exporting} />
          </label>
          <label className="incident-form-field incident-form-field--full">
            <span className="entry-form-label">Tiêu đề dòng 2</span>
            <input className="sidebar-input" value={title2} onChange={(e) => setTitle2(e.target.value)} disabled={exporting} />
          </label>
          <div className="incident-word-filter-box">
            <p className="entry-form-label">Lọc theo khối lượng (chỉ áp cho m³)</p>
            <label>
              <input type="checkbox" checked={under100} onChange={(e) => setUnder100(e.target.checked)} disabled={exporting} />
              {" "}Dưới (≤) 100 m³
            </label>
            <label>
              <input type="checkbox" checked={over100} onChange={(e) => setOver100(e.target.checked)} disabled={exporting} />
              {" "}Trên (&gt;) 100 m³
            </label>
          </div>
          <div className="incident-word-stt-row">
            <label>
              <input type="checkbox" checked={showStt} onChange={(e) => setShowStt(e.target.checked)} disabled={exporting} />
              {" "}Đánh số thứ tự
            </label>
            <label>
              STT bắt đầu{" "}
              <input
                type="number"
                min="1"
                className="sidebar-input incident-word-stt-input"
                value={startStt}
                onChange={(e) => setStartStt(e.target.value)}
                disabled={exporting || !showStt}
              />
            </label>
          </div>
          <p className="section-guide">
            {finalList.length} sự cố sẽ được ghép · mỗi sự cố 1 trang (ảnh hiện trạng | sau xử lý).
          </p>
          {progress && (
            <p className="hientruong-import-msg">
              Đang xử lý ảnh {progress.done}/{progress.total}…
            </p>
          )}
          <div className="incident-form-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={exporting}>
              Huỷ
            </button>
            <button type="button" className="btn-primary" onClick={() => void handleExport()} disabled={exporting}>
              {exporting ? "Đang xuất…" : "Ghép báo cáo"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
