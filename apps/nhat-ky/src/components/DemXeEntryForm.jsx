import { formatDisplayDate } from "../utils/nhatKyFormat";

/** Trạng thái chưa chọn chiều đếm trên ngày đã có sẵn 2 chiều. */
export default function DemXeEntryForm({ date }) {
  return (
    <div className="demxe-empty-form">
      <p className="demxe-empty-form-title">
        Ngày <strong>{formatDisplayDate(date)}</strong>
      </p>
      <p className="demxe-empty-form-hint">
        Mỗi ngày có sẵn <strong>Chiều đi</strong> và <strong>Chiều về</strong>. Chọn chiều ở cột trái để nhập
        liệu.
      </p>
    </div>
  );
}
