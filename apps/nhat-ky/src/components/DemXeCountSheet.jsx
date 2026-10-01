import { VEHICLE_TYPES, weekdayVN, splitDisplayDate } from "../utils/demXeConstants";
import { sumCounts, parseCount } from "../utils/demXeCompute";
import { formatDemXeTime, parseDemXeTime } from "../utils/demXeFormFormat";
import { countingHoursForDate } from "../utils/demXeQuarters";
import DemXeTallyMarks from "./DemXeTallyMarks";

function ExcelInput({
  value,
  onChange,
  type = "text",
  inputMode,
  align = "left",
  readOnly,
  ariaLabel,
  inline = false
}) {
  if (readOnly) {
    return <span className="demxe-xcell-readonly">{value || ""}</span>;
  }
  return (
    <input
      type={type}
      inputMode={inputMode}
      className={`demxe-xcell-input demxe-xcell-input--${align}${inline ? " demxe-xcell-input--inline" : ""}`}
      value={value ?? ""}
      onChange={(e) => onChange?.(e.target.value)}
      aria-label={ariaLabel}
    />
  );
}

function renderInfoCell(label, value, edit, editable) {
  return (
    <div className="demxe-info-cell__inner">
      <span className="demxe-info-cell__label">{label}</span>
      {editable && edit ? (
        <span className="demxe-info-cell__edit">{edit}</span>
      ) : (
        <span className="demxe-info-cell__value">{value || ""}</span>
      )}
    </div>
  );
}

function InfoRow({ leftLabel, leftValue, leftEdit, rightLabel, rightValue, rightEdit, editable }) {
  return (
    <tr>
      <td className="demxe-info-cell">
        {renderInfoCell(leftLabel, leftValue, leftEdit, editable)}
      </td>
      <td className="demxe-info-cell">
        {renderInfoCell(rightLabel, rightValue, rightEdit, editable)}
      </td>
    </tr>
  );
}

function TimeCell({ value, onChange, editable, ariaLabel }) {
  const display = formatDemXeTime(value);
  if (!editable) {
    return <span className="demxe-time-value">{display}</span>;
  }
  return (
    <ExcelInput
      value={display}
      onChange={(text) => onChange(parseDemXeTime(text))}
      align="left"
      inline
      ariaLabel={ariaLabel}
    />
  );
}

export default function DemXeCountSheet({
  date,
  direction,
  cover = {},
  editable = false,
  onChange
}) {
  if (!direction) return null;
  const total = sumCounts(direction.counts);
  const { day, month, year } = splitDisplayDate(date);
  const weekday = weekdayVN(date);
  const defaultHours = countingHoursForDate(date);
  const startTime = direction.startTime || defaultHours.startTime;
  const endTime = direction.endTime || defaultHours.endTime;

  function setField(field, value) {
    onChange?.({ ...direction, [field]: value });
  }

  function setCount(key, value) {
    const counts = { ...(direction.counts || {}), [key]: value.replace(/[^\d]/g, "") };
    onChange?.({ ...direction, counts });
  }

  const roadName = cover.tenDuong || direction.roadName || "…………";
  const hatName = cover.tenHat || "…………";
  const lyTrinh = direction.lyTrinh || cover.lyTrinhQuanLy || "…………";
  const dateHeader = `Ngày ${day || "….."} tháng ${month || "….."} năm ${year || "……"}`;

  return (
    <div
      className={`demxe-count-sheet--a4 demxe-print-section${editable ? " demxe-count-sheet--editable" : ""}`}
      data-print-section="form"
      data-print-date={date}
      data-print-dir={direction.id}
    >
      <header className="demxe-count-sheet__head">
        <p className="demxe-form-ref">Biểu mẫu báo cáo: (cho 1 trạm)</p>
        <p className="demxe-form-ref">Bảng số 01</p>
        <h2 className="demxe-form-title">ĐẾM THEO PHÂN LOẠI PHƯƠNG TIỆN</h2>
        <p className="demxe-form-subline demxe-form-subline--center">Tên đường: {roadName}</p>
        <p className="demxe-form-subline demxe-form-subline--center">
          Tên Hạt: {hatName}, lý trình đếm xe: {lyTrinh}
        </p>
        <p className="demxe-form-subline demxe-form-subline--center">{dateHeader}</p>
      </header>

      {/* Hình 2 — bảng thông tin */}
      <table className="demxe-official-table demxe-info-meta-table">
        <colgroup>
          <col style={{ width: "50%" }} />
          <col style={{ width: "50%" }} />
        </colgroup>
        <tbody>
          <InfoRow
            editable={editable}
            leftLabel="Đường:"
            rightLabel="Lý trình:"
            leftValue={roadName}
            rightValue={direction.lyTrinh || lyTrinh}
            rightEdit={
              <ExcelInput
                value={direction.lyTrinh}
                onChange={(v) => setField("lyTrinh", v)}
                ariaLabel="Lý trình"
                inline
              />
            }
          />
          {/* Hướng từ / Đến cùng 1 hàng — giống mẫu */}
          <InfoRow
            editable={editable}
            leftLabel="Hướng xe chạy từ:"
            rightLabel="Đến:"
            leftValue={direction.from}
            rightValue={direction.to}
            leftEdit={
              <ExcelInput
                value={direction.from}
                onChange={(v) => setField("from", v)}
                ariaLabel="Từ"
                inline
              />
            }
            rightEdit={
              <ExcelInput
                value={direction.to}
                onChange={(v) => setField("to", v)}
                ariaLabel="Đến"
                inline
              />
            }
          />
          <tr>
            <td className="demxe-info-cell">
              <div className="demxe-info-cell__inner">
                <span className="demxe-info-cell__value">
                  Ngày {day || "....."} tháng {month || "....."} năm {year || "......."}
                </span>
              </div>
            </td>
            <td className="demxe-info-cell">
              {renderInfoCell("Ngày trong tuần:", weekday, null, false)}
            </td>
          </tr>
          <InfoRow
            editable={editable}
            leftLabel="Thời gian bắt đầu đếm:"
            rightLabel="Thời gian kết thúc đếm:"
            leftValue={formatDemXeTime(startTime)}
            rightValue={formatDemXeTime(endTime)}
            leftEdit={
              <TimeCell
                value={startTime}
                editable
                onChange={(v) => setField("startTime", v)}
                ariaLabel="Thời gian bắt đầu"
              />
            }
            rightEdit={
              <TimeCell
                value={endTime}
                editable
                onChange={(v) => setField("endTime", v)}
                ariaLabel="Thời gian kết thúc"
              />
            }
          />
        </tbody>
      </table>

      {/* Hình 3 — bảng chủng loại xe; cột đếm = ô gạch (5 xe/ô, 15 ô/hàng) */}
      <table className="demxe-official-table demxe-count-data-table">
        <colgroup>
          <col style={{ width: "38%" }} />
          <col style={{ width: "52%" }} />
          <col style={{ width: "10%" }} />
        </colgroup>
        <thead>
          <tr className="demxe-data-header-row">
            <th className="demxe-col-type">CHỦNG LOẠI XE</th>
            <th className="demxe-col-count">SỐ LIỆU ĐẾM</th>
            <th className="demxe-col-sum">CỘNG</th>
          </tr>
        </thead>
        <tbody>
          {VEHICLE_TYPES.map((v) => {
            const raw = direction.counts?.[v.key];
            const val = raw === "" || raw == null ? "" : raw;
            const display = val === "" ? "" : String(parseCount(val) || val);
            return (
              <tr key={v.key} className="demxe-count-data-row">
                <td className="demxe-col-type">{v.label}</td>
                <td
                  className={`demxe-xcell demxe-col-count demxe-col-count--tally${
                    editable ? " demxe-xcell--edit" : ""
                  }`}
                >
                  <div className="demxe-count-cell">
                    <DemXeTallyMarks count={val} />
                    {editable ? (
                      <input
                        type="text"
                        inputMode="numeric"
                        className="demxe-count-num-input"
                        value={val}
                        onChange={(e) => setCount(v.key, e.target.value)}
                        aria-label={`Số lượng ${v.label}`}
                      />
                    ) : null}
                  </div>
                </td>
                <td className="demxe-col-sum demxe-xcell demxe-xcell--readonly">{display}</td>
              </tr>
            );
          })}
          <tr className="demxe-grand-total-row">
            <td className="demxe-col-type">
              <strong>CỘNG</strong>
            </td>
            <td className="demxe-col-count demxe-col-count--tally" />
            <td className="demxe-col-sum demxe-xcell demxe-xcell--readonly">
              <strong>{total || ""}</strong>
            </td>
          </tr>
        </tbody>
      </table>

      <div className="demxe-sign-row">
        <p>
          <strong>NGƯỜI GIÁM SÁT</strong>
        </p>
        <p>
          <strong>TỔ TRƯỞNG TỔ ĐẾM XE</strong>
        </p>
      </div>
    </div>
  );
}
