import MatDuongTableHead from "./MatDuongTableHead";
import HanhLangAutoTextarea from "./HanhLangAutoTextarea";
import ViDateInput from "./ViDateInput";
import WorkTypeCombo from "./WorkTypeCombo";
import {
  MAT_DUONG_ENTRY_COLS,
  matDuongEntryColWidths,
  matDuongEntryTableMinWidth
} from "../hooks/useMatDuongColWidths";
import { formatDisplayDate } from "../utils/nhatKyFormat";
import {
  calcAreaM2,
  defaultExportMatDuong,
  entryToMatDuongRow,
  formatKmCell,
  resolveEntryKmTo
} from "../utils/matDuongFormat";
import {
  BAO_DUONG_MAX_DAYS,
  maxPlannedRepairDate
} from "../utils/baoDuongFormat";

const SIDE_OPTIONS = [
  { value: "T", label: "T" },
  { value: "P", label: "P" },
  { value: "G", label: "G" },
  { value: "M", label: "M" },
  { value: "C", label: "C" }
];

function EntryCell({ children, synced = false, className = "" }) {
  return (
    <td
      className={`tngt-entry-td matduong-entry-cell-wrap${synced ? " tngt-entry-td--synced matduong-sync-cell" : ""} ${className}`.trim()}
    >
      <div className={`matduong-entry-cell${synced ? " matduong-sync-inner" : ""}`}>
        {children}
      </div>
    </td>
  );
}

/** Form mặt đường: nhật ký 4 cột + sổ theo dõi 12 cột (Phụ lục 09 QL37). */
export default function MatDuongEntryForm({ form, onChange, date, types }) {
  const syncedDate = formatDisplayDate(date);
  const entryWidths = matDuongEntryColWidths();
  const tableMinWidth = matDuongEntryTableMinWidth();
  const preview = entryToMatDuongRow({ ...form, date });
  const area = calcAreaM2(form);
  const kmToDisplay = formatKmCell(resolveEntryKmTo(form)) || "—";

  return (
    <div className="tngt-entry-form">
      <section className="tngt-entry-book">
        <h3 className="tngt-entry-block-title">Sửa dòng — Sổ theo dõi mặt đường</h3>

        <div className="tngt-entry-table-wrap">
          <table
            className="tngt-table tngt-table--entry matduong-table matduong-table--entry"
            style={{ minWidth: `${tableMinWidth}px` }}
          >
            <colgroup>
              {MAT_DUONG_ENTRY_COLS.map((col) => (
                <col key={col.key} style={{ width: `${entryWidths[col.key]}px` }} />
              ))}
            </colgroup>
            <thead>
              <MatDuongTableHead />
            </thead>
            <tbody>
              <tr className="tngt-entry-data-row matduong-entry-data-row">
                <EntryCell synced className="matduong-sync-date">
                  {syncedDate || "—"}
                </EntryCell>
                <EntryCell>
                  <HanhLangAutoTextarea
                    name="kmFrom"
                    placeholder="Km đầu"
                    value={form.kmFrom}
                    onChange={onChange}
                    rows={2}
                    className="hanh-lang-entry-auto--num"
                  />
                </EntryCell>
                <EntryCell synced>
                  {preview.kmTo || kmToDisplay}
                </EntryCell>
                <EntryCell>
                  <select
                    name="side"
                    value={form.side || "P"}
                    onChange={onChange}
                    className="nhatky-cell-input nhatky-cell-input--single"
                    aria-label="T/P/G/M"
                  >
                    {SIDE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </EntryCell>
                <EntryCell>
                  <HanhLangAutoTextarea
                    name="length"
                    placeholder="Dài"
                    value={form.length}
                    onChange={onChange}
                    rows={1}
                    className="hanh-lang-entry-auto--num"
                  />
                </EntryCell>
                <EntryCell>
                  <HanhLangAutoTextarea
                    name="width"
                    placeholder="Rộng"
                    value={form.width}
                    onChange={onChange}
                    rows={1}
                    className="hanh-lang-entry-auto--num"
                  />
                </EntryCell>
                <EntryCell synced>
                  {area || preview.area || "—"}
                </EntryCell>
                <EntryCell className="matduong-sync-damage">
                  <WorkTypeCombo
                    value={form.type || ""}
                    onChange={(val) =>
                      onChange({ target: { name: "type", value: val } })
                    }
                    options={types}
                    controlClassName="nhatky-cell-input nhatky-cell-input--single"
                    ariaLabel="Loại sự cố"
                  />
                </EntryCell>
                <EntryCell>
                  <label className="matduong-status-pick">
                    <input
                      type="radio"
                      name="resolvedStatus"
                      value="co"
                      checked={form.resolvedStatus === "co"}
                      onChange={onChange}
                    />
                    <span>Có</span>
                  </label>
                </EntryCell>
                <EntryCell>
                  <label className="matduong-status-pick">
                    <input
                      type="radio"
                      name="resolvedStatus"
                      value="chua"
                      checked={form.resolvedStatus === "chua" || !form.resolvedStatus}
                      onChange={onChange}
                    />
                    <span>Chưa</span>
                  </label>
                </EntryCell>
                <EntryCell>
                  <HanhLangAutoTextarea
                    name="inspectorSign"
                    placeholder="Ký tên"
                    value={form.inspectorSign}
                    onChange={onChange}
                    rows={2}
                  />
                </EntryCell>
                <EntryCell>
                  <HanhLangAutoTextarea
                    name="inspectorNote"
                    placeholder="Ý kiến tuần kiểm viên"
                    value={form.inspectorNote}
                    onChange={onChange}
                    rows={2}
                  />
                </EntryCell>
              </tr>
            </tbody>
          </table>
        </div>

        <label className="form-check-row tngt-entry-export">
          <input
            type="checkbox"
            name="exportMatDuong"
            checked={Boolean(form.exportMatDuong)}
            onChange={onChange}
          />
          <span>Xuất dòng này sang sổ theo dõi mặt đường tháng</span>
        </label>
      </section>

      {form.exportMatDuong && defaultExportMatDuong(form.type) && (
        <section className="matduong-baoduong-section">
          <h3 className="tngt-entry-block-title">Sổ bảo dưỡng thường xuyên</h3>
          <p className="section-guide section-guide--compact">
            Ngày dự kiến sửa chữa (tối đa {BAO_DUONG_MAX_DAYS} ngày sau phát hiện).
          </p>
          <div className="entry-form-grid">
            <div className="entry-form-field">
              <label className="entry-form-label" htmlFor="md-entry-plannedRepairDate">
                Ngày dự kiến sửa chữa
              </label>
              <ViDateInput
                id="md-entry-plannedRepairDate"
                value={form.plannedRepairDate}
                min={date}
                max={maxPlannedRepairDate(date)}
                onChange={(iso) =>
                  onChange({ target: { name: "plannedRepairDate", value: iso, type: "text" } })
                }
                className="sidebar-input"
                aria-label="Ngày dự kiến sửa chữa"
              />
            </div>
            <div className="entry-form-field">
              <label className="entry-form-label" htmlFor="md-entry-measureSummary">
                Tóm tắt biện pháp
              </label>
              <input
                id="md-entry-measureSummary"
                name="measureSummary"
                placeholder="VD: Sử dụng nhân công"
                value={form.measureSummary}
                onChange={onChange}
                className="sidebar-input"
              />
            </div>
            <div className="entry-form-field entry-form-field--full">
              <label className="entry-form-label" htmlFor="md-entry-mainResult">
                Kết quả chủ yếu
              </label>
              <textarea
                id="md-entry-mainResult"
                name="mainResult"
                placeholder="Để trống sẽ tự lấy khối lượng và kết quả xử lý"
                value={form.mainResult}
                onChange={onChange}
                className="sidebar-textarea"
                rows={2}
              />
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
