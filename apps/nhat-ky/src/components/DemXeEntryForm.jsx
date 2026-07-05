import { formatDisplayDate } from "../utils/nhatKyFormat";

/** Trạng thái chưa có chiều đếm — chỉ hiện nút tạo chiều. */
export default function DemXeEntryForm({ date, onAddDi, onAddVe }) {
  return (
    <div className="demxe-empty-form">
      <p className="demxe-empty-form-title">
        Ngày <strong>{formatDisplayDate(date)}</strong> chưa có chiều đếm
      </p>
      <p className="demxe-empty-form-hint">Bấm một trong các nút dưới để mở biểu mẫu nhập liệu:</p>
      <div className="demxe-empty-form-actions">
        <button type="button" className="btn-primary" onClick={onAddDi}>
          + Chiều đi
        </button>
        <button type="button" className="btn-secondary" onClick={onAddVe}>
          + Chiều về
        </button>
      </div>
    </div>
  );
}
