import { formatDisplayDate } from "../utils/nhatKyFormat";

const SIDE_OPTIONS = [
  { value: "P", label: "P — Phải" },
  { value: "T", label: "T — Trái" },
  { value: "M", label: "M — Giữa" },
  { value: "C", label: "C — Cả hai" }
];

function formatArea(length, width) {
  const l = Number(String(length || "").replace(",", ".")) || 0;
  const w = Number(String(width || "").replace(",", ".")) || 0;
  if (!l || !w) return "";
  const area = l * w;
  return Number.isInteger(area) ? `${area} m²` : `${area.toFixed(2)} m²`;
}

/** Form hành lang — 1 khung gọn, ghi 1 lần cho cả nhật ký & sổ theo dõi (Phụ lục 05 QL37). */
export default function HanhLangEntryForm({ form, onChange, date }) {
  const syncedDate = formatDisplayDate(date);
  const area = formatArea(form.length, form.width);

  return (
    <div className="entry-form">
      <p className="section-guide section-guide--compact">
        Ghi một lần — tự dùng cho cả nhật ký tuần đường và sổ theo dõi hành lang. Ngày
        lập biên bản theo ngày đang chọn ({syncedDate || "—"}).
      </p>

      <div className="entry-form-section">
        <div className="entry-form-section-title">Thời gian · vị trí</div>
        <div className="entry-form-grid entry-form-grid--4">
          <div className="entry-form-field">
            <label className="entry-form-label" htmlFor="hl-entry-time">
              Giờ phát hiện
            </label>
            <input
              id="hl-entry-time"
              name="time"
              placeholder="8h30"
              value={form.time}
              onChange={onChange}
              className="sidebar-input"
            />
          </div>
          <div className="entry-form-field">
            <label className="entry-form-label" htmlFor="hl-entry-kmFrom">
              Lý trình đầu
            </label>
            <input
              id="hl-entry-kmFrom"
              name="kmFrom"
              placeholder="372+400"
              value={form.kmFrom}
              onChange={onChange}
              className="sidebar-input"
            />
          </div>
          <div className="entry-form-field">
            <label className="entry-form-label" htmlFor="hl-entry-kmTo">
              Lý trình cuối
            </label>
            <input
              id="hl-entry-kmTo"
              name="kmTo"
              placeholder="372+500"
              value={form.kmTo}
              onChange={onChange}
              className="sidebar-input"
            />
          </div>
          <div className="entry-form-field">
            <label className="entry-form-label" htmlFor="hl-entry-side">
              Phía
            </label>
            <select
              id="hl-entry-side"
              name="side"
              value={form.side || "P"}
              onChange={onChange}
              className="sidebar-input"
            >
              {SIDE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="entry-form-section">
        <div className="entry-form-section-title">Thông tin vi phạm</div>
        <div className="entry-form-grid entry-form-grid--3">
          <div className="entry-form-field">
            <label className="entry-form-label" htmlFor="hl-entry-recorder">
              Người lập biên bản
            </label>
            <input
              id="hl-entry-recorder"
              name="hlRecorder"
              placeholder="Họ tên tuần đường"
              value={form.hlRecorder}
              onChange={onChange}
              className="sidebar-input"
            />
          </div>
          <div className="entry-form-field">
            <label className="entry-form-label" htmlFor="hl-entry-violator">
              Tổ chức / cá nhân vi phạm
            </label>
            <input
              id="hl-entry-violator"
              name="hlViolator"
              placeholder="Tên tổ chức / cá nhân"
              value={form.hlViolator}
              onChange={onChange}
              className="sidebar-input"
            />
          </div>
          <div className="entry-form-field">
            <label className="entry-form-label" htmlFor="hl-entry-address">
              Địa chỉ
            </label>
            <input
              id="hl-entry-address"
              name="hlAddress"
              placeholder="Bản…, xã…, huyện…"
              value={form.hlAddress}
              onChange={onChange}
              className="sidebar-input"
            />
          </div>
        </div>

        <div className="entry-form-field entry-form-field--full">
          <label className="entry-form-label" htmlFor="hl-entry-content">
            Nội dung vi phạm
          </label>
          <textarea
            id="hl-entry-content"
            name="content"
            placeholder="Nội dung vi phạm, hiện trạng, diễn biến…"
            value={form.content}
            onChange={onChange}
            className="sidebar-textarea"
            rows={3}
          />
        </div>

        <div className="entry-form-grid entry-form-grid--3">
          <div className="entry-form-field">
            <label className="entry-form-label" htmlFor="hl-entry-length">
              Dài (m)
            </label>
            <input
              id="hl-entry-length"
              name="length"
              value={form.length}
              onChange={onChange}
              className="sidebar-input"
            />
          </div>
          <div className="entry-form-field">
            <label className="entry-form-label" htmlFor="hl-entry-width">
              Rộng (m)
            </label>
            <input
              id="hl-entry-width"
              name="width"
              value={form.width}
              onChange={onChange}
              className="sidebar-input"
            />
          </div>
          <div className="entry-form-field">
            <label className="entry-form-label" htmlFor="hl-entry-area">
              Diện tích vi phạm
            </label>
            <input
              id="hl-entry-area"
              value={area}
              readOnly
              placeholder="Tự tính"
              className="sidebar-input sidebar-input-readonly"
            />
          </div>
        </div>
      </div>

      <div className="entry-form-section">
        <div className="entry-form-section-title">Xử lý</div>
        <div className="entry-form-field entry-form-field--full">
          <label className="entry-form-label" htmlFor="hl-entry-resolved">
            Đã xử lý tại chỗ · theo dõi diễn biến
          </label>
          <textarea
            id="hl-entry-resolved"
            name="resolved"
            placeholder="Đã dọn, đã báo công ty, lập biên bản…"
            value={form.resolved}
            onChange={onChange}
            className="sidebar-textarea"
            rows={3}
          />
        </div>
        <div className="entry-form-field entry-form-field--full">
          <label className="entry-form-label" htmlFor="hl-entry-note">
            Ghi chú
          </label>
          <input
            id="hl-entry-note"
            name="hlNote"
            placeholder="Nếu có"
            value={form.hlNote}
            onChange={onChange}
            className="sidebar-input"
          />
        </div>
      </div>

      <label className="form-check-row">
        <input
          type="checkbox"
          name="exportHanhLang"
          checked={Boolean(form.exportHanhLang)}
          onChange={onChange}
        />
        <span>Xuất dòng này sang sổ theo dõi hành lang tháng</span>
      </label>
    </div>
  );
}
