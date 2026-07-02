import DiaryEntryTable from "./DiaryEntryTable";
import TngtTableHead from "./TngtTableHead";
import {
  TNGT_COLS,
  tngtEntryColWidths,
  tngtEntryTableMinWidth
} from "../hooks/useTngtColWidths";
import { formatDisplayDate } from "../utils/nhatKyFormat";
import {
  TNGT_AUTO_OPTIONS,
  TNGT_CAUSE_OPTIONS,
  TNGT_SIDE_OPTIONS,
  formatTngtLocationCell
} from "../utils/tngtFormat";

/**
 * Form TNGT: trên = cột 1–3 sổ tuần đường; dưới = sổ TNGT (cột 2, 3 tự đồng bộ).
 */
export default function TngtEntryForm({ form, onChange, date }) {
  const entryWidths = tngtEntryColWidths();
  const tableMinWidth = tngtEntryTableMinWidth();
  const syncedLocation = formatTngtLocationCell(form);
  const syncedDate = formatDisplayDate(date);

  return (
    <div className="tngt-entry-form">
      <section className="tngt-entry-diary">
        <h3 className="tngt-entry-block-title">Nhật ký tuần đường</h3>
        <p className="section-guide section-guide--compact">
          Cột 2 tự sang sổ TNGT · Ngày theo ngày nhật ký đang chọn ({syncedDate || "—"}).
        </p>
        <DiaryEntryTable
          col1={
            <>
              <input
                id="tngt-entry-time"
                name="time"
                placeholder="8h30"
                value={form.time}
                onChange={onChange}
                className="nhatky-cell-input nhatky-cell-input--single"
                aria-label="Giờ phát hiện"
              />
              <span className="tngt-diary-date-hint">{syncedDate}</span>
            </>
          }
          col2={
            <div className="tngt-diary-loc">
              <div className="tngt-diary-km">
                <span className="tngt-km-prefix">Km</span>
                <input
                  id="tngt-entry-km"
                  name="kmFrom"
                  placeholder="372+400"
                  value={form.kmFrom}
                  onChange={onChange}
                  className="nhatky-cell-input nhatky-cell-input--single tngt-diary-km-input"
                  aria-label="Lý trình"
                />
              </div>
              <label className="tngt-diary-side-label">
                <span className="tngt-diary-side-text">Phía</span>
                <select
                  name="side"
                  value={form.side || "P"}
                  onChange={onChange}
                  className="nhatky-cell-input nhatky-cell-input--single tngt-diary-side"
                  title="Phía P/T/G"
                  aria-label="Phía"
                >
                  {TNGT_SIDE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.value}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          }
          col3={
            <textarea
              id="tngt-entry-causeDetail"
              name="tngtCauseDetail"
              placeholder="Xe ô tô BKS 26A-223.57 mất lái lao vào vườn nhà dân."
              value={form.tngtCauseDetail}
              onChange={onChange}
              className="nhatky-cell-input tngt-diary-field-fill"
              rows={3}
              aria-label="Diễn biến · nguyên nhân"
            />
          }
          col4={
            <textarea
              id="tngt-entry-resolved"
              name="resolved"
              placeholder="Đã thông xe, báo công ty…"
              value={form.resolved}
              onChange={onChange}
              className="nhatky-cell-input tngt-diary-field-fill"
              rows={3}
              aria-label="Đã xử lý"
            />
          }
        />
      </section>

      <section className="tngt-entry-book">
        <h3 className="tngt-entry-block-title">Sổ tổng hợp TNGT tháng</h3>
        <p className="section-guide section-guide--compact">
          Cột (2) và (3) lấy từ nhật ký — chỉ nhập các cột còn lại.
        </p>

        <div className="tngt-entry-table-wrap">
          <table
            className="tngt-table tngt-table--entry"
            style={{ minWidth: `${tableMinWidth}px` }}
          >
            <colgroup>
              {TNGT_COLS.map((col) => (
                <col key={col.key} style={{ width: `${entryWidths[col.key]}px` }} />
              ))}
            </colgroup>
            <thead>
              <TngtTableHead />
            </thead>
            <tbody>
              <tr className="tngt-entry-data-row">
                <td className="tngt-entry-td tngt-entry-td--tt" title="Tự đánh số khi xuất sổ">
                  —
                </td>
                <td className="tngt-entry-td tngt-entry-td--synced" title="Từ cột 2 nhật ký">
                  {syncedLocation || "—"}
                </td>
                <td className="tngt-entry-td tngt-entry-td--synced" title="Theo ngày nhật ký">
                  {syncedDate || "—"}
                </td>
                <td className="tngt-entry-td">
                  <input
                    name="vehicleAutoType"
                    list="tngt-auto-types-list"
                    placeholder="Xe tải"
                    value={form.vehicleAutoType}
                    onChange={onChange}
                    className="tngt-entry-input"
                  />
                  <datalist id="tngt-auto-types-list">
                    {TNGT_AUTO_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value} />
                    ))}
                  </datalist>
                </td>
                <td className="tngt-entry-td tngt-entry-td--mark">
                  <label className="tngt-mark-check" title="Có xe máy">
                    <input
                      type="checkbox"
                      name="vehicleMotoInvolved"
                      checked={Boolean(form.vehicleMotoInvolved)}
                      onChange={onChange}
                    />
                    <span>x</span>
                  </label>
                </td>
                <td className="tngt-entry-td tngt-entry-td--mark">
                  <label className="tngt-mark-check" title="Có xe đạp">
                    <input
                      type="checkbox"
                      name="vehicleBikeInvolved"
                      checked={Boolean(form.vehicleBikeInvolved)}
                      onChange={onChange}
                    />
                    <span>x</span>
                  </label>
                </td>
                {TNGT_CAUSE_OPTIONS.map((opt) => (
                  <td key={opt.field} className="tngt-entry-td tngt-entry-td--mark">
                    <label className="tngt-mark-check" title={opt.label}>
                      <input
                        type="checkbox"
                        name={opt.field}
                        checked={Boolean(form[opt.field])}
                        onChange={onChange}
                      />
                      <span>x</span>
                    </label>
                  </td>
                ))}
                <td className="tngt-entry-td">
                  <input
                    name="casualtyDead"
                    type="number"
                    min="0"
                    placeholder="0"
                    value={form.casualtyDead}
                    onChange={onChange}
                    className="tngt-entry-input tngt-entry-input--num"
                  />
                </td>
                <td className="tngt-entry-td">
                  <input
                    name="casualtyInjured"
                    type="number"
                    min="0"
                    placeholder="0"
                    value={form.casualtyInjured}
                    onChange={onChange}
                    className="tngt-entry-input tngt-entry-input--num"
                  />
                </td>
                <td className="tngt-entry-td">
                  <div className="tngt-entry-money">
                    <input
                      name="damageRoadMillion"
                      type="number"
                      min="0"
                      step="0.1"
                      placeholder="5"
                      value={form.damageRoadMillion}
                      onChange={onChange}
                      className="tngt-entry-input tngt-entry-input--num"
                      title="Thiệt hại cầu đường (triệu đồng)"
                    />
                    <span className="tngt-entry-money-suffix">triệu</span>
                  </div>
                </td>
                <td className="tngt-entry-td">
                  <div className="tngt-entry-money">
                    <input
                      name="damageVehicleMillion"
                      type="number"
                      min="0"
                      step="0.1"
                      placeholder="10"
                      value={form.damageVehicleMillion}
                      onChange={onChange}
                      className="tngt-entry-input tngt-entry-input--num"
                      title="Triệu đồng"
                    />
                    <span className="tngt-entry-money-suffix">triệu</span>
                  </div>
                </td>
                <td className="tngt-entry-td">
                  <input
                    name="tngtNote"
                    value={form.tngtNote}
                    onChange={onChange}
                    className="tngt-entry-input"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <label className="form-check-row tngt-entry-export">
          <input
            type="checkbox"
            name="exportTngt"
            checked={Boolean(form.exportTngt)}
            onChange={onChange}
          />
          <span>Xuất dòng này sang sổ tổng hợp TNGT tháng</span>
        </label>
      </section>
    </div>
  );
}
