import { useCallback, useEffect, useRef, useState } from "react";
import { formatDisplayDate } from "../utils/nhatKyFormat";
import { normalizeDetailColWidths } from "../utils/gptcSummaryGrid";
import GptcAutoTextarea from "./GptcAutoTextarea";

function formatEntryDate(iso) {
  if (!iso) return "";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(iso)) return iso;
  return formatDisplayDate(iso);
}

export default function GptcDetailSheet({
  permit,
  editable = false,
  colWidths = [],
  selectedEntryId,
  onRowSelect,
  onChangeEntry,
  onColWidthsChange
}) {
  const resizeRef = useRef(null);
  const [resizing, setResizing] = useState(false);
  const widths = colWidths?.length === 4 ? colWidths : normalizeDetailColWidths(colWidths);

  const startResize = useCallback(
    (colIndex, e) => {
      if (!editable || !onColWidthsChange) return;
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startW = widths[colIndex];
      resizeRef.current = { colIndex, startX, startW };
      setResizing(true);

      function onMove(ev) {
        if (!resizeRef.current) return;
        const delta = ev.clientX - resizeRef.current.startX;
        const next = [...widths];
        next[resizeRef.current.colIndex] = Math.max(36, resizeRef.current.startW + delta);
        onColWidthsChange(next);
      }

      function onUp() {
        resizeRef.current = null;
        setResizing(false);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      }

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [editable, onColWidthsChange, widths]
  );

  useEffect(() => {
    if (!resizing) return;
    document.body.classList.add("gptc-col-resizing");
    return () => document.body.classList.remove("gptc-col-resizing");
  }, [resizing]);

  if (!permit) {
    return (
      <div className="gptc-sheet gptc-sheet--landscape gptc-sheet--detail gptc-sheet--empty">
        <p className="section-guide">
          <strong>Double-click</strong> một dòng công trình ở biểu tổng hợp để mở sổ theo dõi chi tiết (BM02).
        </p>
      </div>
    );
  }

  const entries = permit.entries || [];
  const colLabels = [
    "Ngày/ tháng/ năm",
    "Diễn biến trong quá trình thi công",
    "Xác nhận, ý kiến chỉ đạo của hạt trưởng",
    "Ý kiến chỉ đạo của tuần kiểm"
  ];
  const colClasses = [
    "gptc-detail-col-date",
    "gptc-detail-col-progress",
    "gptc-detail-col-hat",
    "gptc-detail-col-tuan"
  ];

  return (
    <div
      className="gptc-sheet gptc-sheet--landscape gptc-sheet--detail gptc-print-section"
      data-print-section="gptc-detail"
      data-print-permit={permit.id}
    >
      <h2 className="gptc-sheet-title gptc-sheet-title--bm02">
        BIỂU THEO DÕI DIỄN BIẾN TRONG QUÁ TRÌNH THI CÔNG CÔNG TRÌNH CẤP PHÉP
      </h2>

      <div className="gptc-detail-project-line">
        <span className="gptc-detail-project-label">Công trình:</span>
        {editable ? (
          <div className="gptc-detail-project-input">
            <GptcAutoTextarea
              className="gptc-project-name-input"
              value={permit.tenCongTrinh || ""}
              onChange={(v) => onChangeEntry?.("__permit__", "tenCongTrinh", v)}
            />
          </div>
        ) : (
          <span className="gptc-detail-project-name">{permit.tenCongTrinh || "…………………………………………"}</span>
        )}
      </div>

      <div className="gptc-table-scroll">
        <table className="gptc-official-table gptc-detail-table">
          <colgroup>
            {widths.map((w, i) => (
              <col key={i} style={{ width: `${w}px` }} />
            ))}
          </colgroup>
          <thead>
            <tr className="gptc-head-labels">
              {colLabels.map((label, i) => (
                <th key={label} className={`gptc-th-resizable ${colClasses[i]}`}>
                  {label}
                  {editable && <span className="gptc-col-resizer" onMouseDown={(e) => startResize(i, e)} />}
                </th>
              ))}
            </tr>
            <tr className="gptc-head-nums">
              {[1, 2, 3, 4].map((n, i) => (
                <th key={n} className={`gptc-th-resizable ${colClasses[i]}`}>
                  ({n})
                  {editable && <span className="gptc-col-resizer" onMouseDown={(e) => startResize(i, e)} />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map((row) => {
              const active = selectedEntryId === row.id;
              return (
                <tr
                  key={row.id}
                  className={`gptc-detail-row${active ? " gptc-detail-row--active" : ""}`}
                  onClick={() => onRowSelect?.(row.id)}
                >
                  <td className="gptc-detail-col-date gptc-data-cell">
                    {editable ? (
                      <input
                        type="text"
                        className="gptc-cell-input"
                        value={row.ngay || ""}
                        placeholder="dd/mm/yyyy"
                        onChange={(e) => onChangeEntry?.(row.id, "ngay", e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                      />
                    ) : (
                      formatEntryDate(row.ngay)
                    )}
                  </td>
                  <td className="gptc-detail-col-progress gptc-data-cell">
                    <GptcAutoTextarea
                      readOnly={!editable}
                      value={row.dienBien}
                      onChange={(v) => onChangeEntry?.(row.id, "dienBien", v)}
                    />
                  </td>
                  <td className="gptc-detail-col-hat gptc-data-cell">
                    <GptcAutoTextarea
                      readOnly={!editable}
                      value={row.yKienHatTruong}
                      onChange={(v) => onChangeEntry?.(row.id, "yKienHatTruong", v)}
                    />
                  </td>
                  <td className="gptc-detail-col-tuan gptc-data-cell">
                    <GptcAutoTextarea
                      readOnly={!editable}
                      value={row.yKienTuanKiem}
                      onChange={(v) => onChangeEntry?.(row.id, "yKienTuanKiem", v)}
                    />
                  </td>
                </tr>
              );
            })}
            {!entries.length && (
              <tr>
                <td colSpan={4} className="gptc-empty-row">
                  Chưa có dòng theo dõi. Bấm &quot;Thêm dòng&quot; để ghi nhận diễn biến.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
