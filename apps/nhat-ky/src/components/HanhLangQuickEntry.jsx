import { useMemo } from "react";
import { formatDisplayDate } from "../utils/nhatKyFormat";
import {
  buildHanhLangEntriesFromRows,
  makeEmptyHanhLangRows
} from "../utils/hanhLangFormat";

const SIDE_OPTIONS = ["", "T", "P", "M", "C"];

const COLS = [
  { key: "date", label: "Ngày", width: 84 },
  { key: "time", label: "Giờ", width: 58 },
  { key: "kmFrom", label: "Lý trình đầu", width: 86 },
  { key: "kmTo", label: "Lý trình cuối", width: 86 },
  { key: "side", label: "Phía", width: 52 },
  { key: "hlRecorder", label: "Người lập biên bản", width: 130 },
  { key: "hlViolator", label: "Tổ chức / cá nhân vi phạm", width: 150 },
  { key: "hlAddress", label: "Địa chỉ", width: 150 },
  { key: "content", label: "Nội dung vi phạm", width: 220 },
  { key: "length", label: "Dài (m)", width: 56 },
  { key: "width", label: "Rộng (m)", width: 56 },
  { key: "area", label: "Diện tích (m²)", width: 76 },
  { key: "resolved", label: "Đã xử lý · theo dõi", width: 180 },
  { key: "hlNote", label: "Ghi chú", width: 120 },
  { key: "exportHanhLang", label: "Xuất sổ hành lang", width: 90 }
];

const TABLE_MIN_WIDTH = COLS.reduce((s, c) => s + c.width, 0);

function rowHasData(row) {
  return [
    row?.kmFrom,
    row?.content,
    row?.hlViolator,
    row?.hlRecorder,
    row?.hlAddress,
    row?.length
  ].some((v) => String(v ?? "").trim());
}

function formatArea(length, width) {
  const l = Number(String(length ?? "").replace(",", ".")) || 0;
  const w = Number(String(width ?? "").replace(",", ".")) || 0;
  if (!l || !w) return "";
  const area = l * w;
  return Number.isInteger(area) ? String(area) : area.toFixed(2);
}

/** Bảng nhập nhanh hành lang ATGT — nhập nhiều dòng, dùng chung nhật ký + sổ theo dõi. */
export default function HanhLangQuickEntry({ date, rows, onRowsChange, onImport }) {
  const displayDate = formatDisplayDate(date);
  const validCount = useMemo(() => rows.filter(rowHasData).length, [rows]);
  const editCount = useMemo(
    () => rows.filter((r) => Number.isInteger(r._editIndex) && rowHasData(r)).length,
    [rows]
  );

  function updateRow(index, field, value) {
    onRowsChange(rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  function addEmptyRows() {
    onRowsChange([...rows, ...makeEmptyHanhLangRows(3)]);
  }

  function clearGrid() {
    onRowsChange(makeEmptyHanhLangRows(6));
  }

  function handleImport() {
    const { entries, errors } = buildHanhLangEntriesFromRows(rows, date);
    onImport(entries, errors);
  }

  return (
    <div className="matduong-quick-entry">
      <div className="matduong-quick-actions">
        <button
          type="button"
          className="btn-primary matduong-quick-actions-main"
          disabled={validCount === 0}
          onClick={handleImport}
        >
          {validCount === 0
            ? "Thêm vào nhật ký"
            : editCount > 0
            ? `Lưu ${validCount} dòng (${editCount} sửa)`
            : `Thêm ${validCount} dòng vào nhật ký`}
        </button>
        <button type="button" className="btn-secondary btn-secondary--compact" onClick={addEmptyRows}>
          + 3 dòng
        </button>
        <button type="button" className="btn-secondary btn-secondary--compact" onClick={clearGrid}>
          Xóa bảng
        </button>
      </div>

      <p className="section-guide section-guide--compact matduong-quick-hint">
        Ghi 1 hay nhiều vi phạm — tự dùng cho cả nhật ký tuần đường và sổ theo dõi hành
        lang. Bấm vi phạm ở danh sách bên trái để nạp dòng <strong>✎ sửa</strong>. Ngày:{" "}
        {displayDate || "—"}.
      </p>

      <div className="matduong-quick-sheet-scroll">
        <table
          className="matduong-table matduong-table--entry matduong-table--quick"
          style={{ minWidth: `${TABLE_MIN_WIDTH}px` }}
        >
          <colgroup>
            {COLS.map((col) => (
              <col key={col.key} style={{ width: `${col.width}px` }} />
            ))}
          </colgroup>
          <thead>
            <tr className="matduong-header-row">
              {COLS.map((col) => (
                <th key={col.key}>{col.label}</th>
              ))}
            </tr>
            <tr className="matduong-header-num">
              {COLS.map((col, i) => (
                <th key={col.key}>({i + 1})</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const isEdit = Number.isInteger(row._editIndex);
              return (
                <tr
                  key={idx}
                  className={`matduong-quick-data-row${isEdit ? " is-edit" : ""}`}
                >
                  <td className="matduong-cell-readonly matduong-col-date">
                    {isEdit ? "✎ " : ""}
                    {displayDate || "—"}
                  </td>
                  <td>
                    <input
                      value={row.time || ""}
                      onChange={(e) => updateRow(idx, "time", e.target.value)}
                      className="matduong-excel-cell"
                      aria-label={`Giờ dòng ${idx + 1}`}
                    />
                  </td>
                  <td>
                    <input
                      value={row.kmFrom || ""}
                      onChange={(e) => updateRow(idx, "kmFrom", e.target.value)}
                      className="matduong-excel-cell"
                      aria-label={`Lý trình đầu dòng ${idx + 1}`}
                    />
                  </td>
                  <td>
                    <input
                      value={row.kmTo || ""}
                      onChange={(e) => updateRow(idx, "kmTo", e.target.value)}
                      className="matduong-excel-cell"
                      aria-label={`Lý trình cuối dòng ${idx + 1}`}
                    />
                  </td>
                  <td>
                    <select
                      value={row.side || "P"}
                      onChange={(e) => updateRow(idx, "side", e.target.value)}
                      className="matduong-excel-cell matduong-excel-cell--side"
                      aria-label={`Phía dòng ${idx + 1}`}
                    >
                      {SIDE_OPTIONS.map((v) => (
                        <option key={v || "default"} value={v}>
                          {v || "—"}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      value={row.hlRecorder || ""}
                      onChange={(e) => updateRow(idx, "hlRecorder", e.target.value)}
                      className="matduong-excel-cell"
                      aria-label={`Người lập biên bản dòng ${idx + 1}`}
                    />
                  </td>
                  <td>
                    <input
                      value={row.hlViolator || ""}
                      onChange={(e) => updateRow(idx, "hlViolator", e.target.value)}
                      className="matduong-excel-cell"
                      aria-label={`Tổ chức / cá nhân vi phạm dòng ${idx + 1}`}
                    />
                  </td>
                  <td>
                    <input
                      value={row.hlAddress || ""}
                      onChange={(e) => updateRow(idx, "hlAddress", e.target.value)}
                      className="matduong-excel-cell"
                      aria-label={`Địa chỉ dòng ${idx + 1}`}
                    />
                  </td>
                  <td>
                    <input
                      value={row.content || ""}
                      onChange={(e) => updateRow(idx, "content", e.target.value)}
                      className="matduong-excel-cell"
                      aria-label={`Nội dung vi phạm dòng ${idx + 1}`}
                    />
                  </td>
                  <td>
                    <input
                      value={row.length || ""}
                      onChange={(e) => updateRow(idx, "length", e.target.value)}
                      className="matduong-excel-cell matduong-excel-cell--num"
                      aria-label={`Dài dòng ${idx + 1}`}
                    />
                  </td>
                  <td>
                    <input
                      value={row.width || ""}
                      onChange={(e) => updateRow(idx, "width", e.target.value)}
                      className="matduong-excel-cell matduong-excel-cell--num"
                      aria-label={`Rộng dòng ${idx + 1}`}
                    />
                  </td>
                  <td className="matduong-cell-readonly">
                    {formatArea(row.length, row.width)}
                  </td>
                  <td>
                    <input
                      value={row.resolved || ""}
                      onChange={(e) => updateRow(idx, "resolved", e.target.value)}
                      className="matduong-excel-cell"
                      aria-label={`Đã xử lý dòng ${idx + 1}`}
                    />
                  </td>
                  <td>
                    <input
                      value={row.hlNote || ""}
                      onChange={(e) => updateRow(idx, "hlNote", e.target.value)}
                      className="matduong-excel-cell"
                      aria-label={`Ghi chú dòng ${idx + 1}`}
                    />
                  </td>
                  <td className="matduong-col-export">
                    <input
                      type="checkbox"
                      checked={row.exportHanhLang !== false}
                      onChange={(e) => updateRow(idx, "exportHanhLang", e.target.checked)}
                      aria-label={`Xuất sổ hành lang dòng ${idx + 1}`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
