import ViDateInput from "./ViDateInput";
import { formatDisplayDate } from "../utils/nhatKyFormat";

function CoverInlineText({ value, readOnly, onChange, placeholder = "……………………", className = "" }) {
  if (readOnly) {
    return <span className={`demxe-cover-inline-value ${className}`.trim()}>{value || placeholder}</span>;
  }
  return (
    <input
      type="text"
      className={`demxe-cover-inline-input ${className}`.trim()}
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function CoverInlineDate({ value, readOnly, onChange }) {
  if (readOnly) {
    return <span className="demxe-cover-inline-value">{formatCoverDateLabel(value)}</span>;
  }
  return (
    <span className="demxe-cover-date-wrap">
      <ViDateInput
        value={value || ""}
        onChange={onChange}
        className="demxe-cover-inline-input demxe-cover-date"
        placeholder="..../..../...."
      />
    </span>
  );
}

export default function DemXeCoverSheet({ cover, onChange, readOnly = false }) {
  const handle = (key) => (val) => onChange?.(key, val);

  return (
    <div className="demxe-sheet demxe-sheet--cover demxe-cover-sheet demxe-print-section" data-print-section="cover">
      <div className="demxe-cover-header">
        <p className="demxe-cover-country">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
        <p className="demxe-cover-motto">Độc lập - Tự do - Hạnh phúc</p>
      </div>
      <h1 className="demxe-cover-title">SỔ THEO DÕI ĐẾM XE</h1>
      <div className="demxe-cover-body">
        <p className="demxe-cover-line">
          <span className="demxe-cover-label">Đơn vị quản lý, bảo dưỡng thường xuyên:</span>{" "}
          <CoverInlineText
            value={cover.donVi}
            readOnly={readOnly}
            onChange={handle("donVi")}
            className="demxe-cover-inline-input--full"
          />
        </p>
        <p className="demxe-cover-line demxe-cover-line--split">
          <span>
            <span className="demxe-cover-label">Tên Hạt:</span>{" "}
            <CoverInlineText
              value={cover.tenHat}
              readOnly={readOnly}
              onChange={handle("tenHat")}
              className="demxe-cover-inline-input--hat"
            />
          </span>
          <span>
            <span className="demxe-cover-label">Lý trình quản lý:</span>{" "}
            <CoverInlineText
              value={cover.lyTrinhQuanLy}
              readOnly={readOnly}
              onChange={handle("lyTrinhQuanLy")}
              className="demxe-cover-inline-input--km"
            />
          </span>
        </p>
        <p className="demxe-cover-line">
          <span className="demxe-cover-label">Tên đường:</span>{" "}
          <CoverInlineText
            value={cover.tenDuong}
            readOnly={readOnly}
            onChange={handle("tenDuong")}
            className="demxe-cover-inline-input--full"
          />
        </p>
        <p className="demxe-cover-line">
          <span className="demxe-cover-label">Bắt đầu ngày:</span>{" "}
          <CoverInlineDate value={cover.ngayBatDau} readOnly={readOnly} onChange={handle("ngayBatDau")} />
        </p>
        <p className="demxe-cover-line">
          <span className="demxe-cover-label">Hết quyển ngày:</span>{" "}
          <CoverInlineDate value={cover.ngayKetThuc} readOnly={readOnly} onChange={handle("ngayKetThuc")} />
        </p>
      </div>
      <p className="demxe-cover-footer">
        *
        <CoverInlineText
          value={cover.noiKy}
          readOnly={readOnly}
          onChange={handle("noiKy")}
          placeholder="…………"
          className="demxe-cover-inline-input--footer"
        />
        , năm{" "}
        <CoverInlineText
          value={cover.nam}
          readOnly={readOnly}
          onChange={handle("nam")}
          placeholder="...."
          className="demxe-cover-inline-input--year"
        />
        *
      </p>
    </div>
  );
}

export function DemXeCoverReadonly({ cover }) {
  return <DemXeCoverSheet cover={cover} readOnly />;
}

export function formatCoverDateLabel(iso) {
  if (!iso) return "..../..../....";
  return formatDisplayDate(iso);
}
