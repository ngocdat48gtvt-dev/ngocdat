import { VEHICLE_TYPES, DIRECTION_LABEL, weekdayVN, splitDisplayDate } from "../utils/demXeConstants";
import { sumCounts, parseCount } from "../utils/demXeCompute";

function ExcelInput({ value, onChange, type = "text", inputMode, align = "left", readOnly, ariaLabel }) {
  if (readOnly) {
    return <span className="demxe-xcell-readonly">{value || ""}</span>;
  }
  return (
    <input
      type={type}
      inputMode={inputMode}
      className={`demxe-xcell-input demxe-xcell-input--${align}`}
      value={value ?? ""}
      onChange={(e) => onChange?.(e.target.value)}
      aria-label={ariaLabel}
    />
  );
}

function InfoRow({ leftLabel, leftValue, leftEdit, rightLabel, rightValue, rightEdit, editable }) {
  return (
    <tr>
      <td className="demxe-info-label">{leftLabel}</td>
      <td className={`demxe-xcell${editable && leftEdit ? " demxe-xcell--edit" : ""}`}>
        {editable && leftEdit ? (
          leftEdit
        ) : (
          <span>{leftValue || ""}</span>
        )}
      </td>
      <td className="demxe-info-label">{rightLabel}</td>
      <td className={`demxe-xcell${editable && rightEdit ? " demxe-xcell--edit" : ""}`}>
        {editable && rightEdit ? (
          rightEdit
        ) : (
          <span>{rightValue || ""}</span>
        )}
      </td>
    </tr>
  );
}

export default function DemXeCountSheet({
  date,
  direction,
  cover = {},
  editable = false,
  onChange,
  onDuplicate
}) {
  if (!direction) return null;
  const total = sumCounts(direction.counts);
  const { day, month, year } = splitDisplayDate(date);
  const weekday = weekdayVN(date);

  function setField(field, value) {
    onChange?.({ ...direction, [field]: value });
  }

  function setCount(key, value) {
    const counts = { ...(direction.counts || {}), [key]: value.replace(/[^\d]/g, "") };
    onChange?.({ ...direction, counts });
  }

  const hatLine = [cover.tenHat, direction.lyTrinh ? `lý trình đếm xe: ${direction.lyTrinh}` : ""]
    .filter(Boolean)
    .join(", ");

  return (
    <div
      className={`demxe-sheet demxe-sheet--form demxe-count-sheet--a4 demxe-print-section${editable ? " demxe-count-sheet--editable" : ""}`}
      data-print-section="form"
      data-print-date={date}
      data-print-dir={direction.id}
    >
      {editable && onDuplicate && (
        <div className="demxe-form-toolbar no-print">
          <span className="demxe-form-toolbar-hint">
            {DIRECTION_LABEL[direction.directionType]} · {day}/{month}/{year}
          </span>
          <button type="button" className="btn-secondary btn-primary--compact" onClick={onDuplicate}>
            Nhân bản chiều
          </button>
        </div>
      )}

      <p className="demxe-form-ref">Biểu mẫu báo cáo: (cho 1 trạm)</p>
      <p className="demxe-form-ref demxe-form-ref--center">Bảng số 01</p>
      <h2 className="demxe-form-title">ĐẾM THEO PHÂN LOẠI PHƯƠNG TIỆN</h2>

      <p className="demxe-form-subline">
        Tên đường: {cover.tenDuong || direction.roadName || "…………"}
        {hatLine ? ` · Tên Hạt: ${hatLine}` : ""}
      </p>
      <p className="demxe-form-subline demxe-form-subline--center">
        Ngày {day || "…"} tháng {month || "…"} năm {year || "…"}
        {!editable && ` · ${DIRECTION_LABEL[direction.directionType]}`}
      </p>

      <table className="demxe-info-table demxe-grid-table">
        <tbody>
          <InfoRow
            editable={editable}
            leftLabel="Đường:"
            rightLabel="Lý trình:"
            leftValue={direction.roadName}
            rightValue={direction.lyTrinh}
            leftEdit={
              <ExcelInput
                value={direction.roadName}
                onChange={(v) => setField("roadName", v)}
                ariaLabel="Đường"
              />
            }
            rightEdit={
              <ExcelInput
                value={direction.lyTrinh}
                onChange={(v) => setField("lyTrinh", v)}
                ariaLabel="Lý trình"
              />
            }
          />
          <InfoRow
            editable={editable}
            leftLabel="Hướng xe chạy từ:"
            rightLabel="Đến:"
            leftValue={direction.from}
            rightValue={direction.to}
            leftEdit={
              <ExcelInput value={direction.from} onChange={(v) => setField("from", v)} ariaLabel="Từ" />
            }
            rightEdit={<ExcelInput value={direction.to} onChange={(v) => setField("to", v)} ariaLabel="Đến" />}
          />
          <InfoRow
            editable={editable}
            leftLabel="Ngày…..tháng…..năm……."
            rightLabel="Ngày trong tuần:"
            leftValue={`${day}/${month}/${year}`}
            rightValue={weekday}
          />
          <InfoRow
            editable={editable}
            leftLabel="Thời gian bắt đầu đếm:"
            rightLabel="Thời gian kết thúc đếm:"
            leftValue={direction.startTime}
            rightValue={direction.endTime}
            leftEdit={
              <ExcelInput
                type="time"
                value={direction.startTime}
                onChange={(v) => setField("startTime", v)}
                ariaLabel="Thời gian bắt đầu"
              />
            }
            rightEdit={
              <ExcelInput
                type="time"
                value={direction.endTime}
                onChange={(v) => setField("endTime", v)}
                ariaLabel="Thời gian kết thúc"
              />
            }
          />
        </tbody>
      </table>

      <table className="demxe-official-table demxe-grid-table demxe-data-table">
        <thead>
          <tr>
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
              <tr key={v.key}>
                <td className="demxe-col-type">{v.label}</td>
                <td className={`demxe-xcell demxe-col-count${editable ? " demxe-xcell--edit" : ""}`}>
                  {editable ? (
                    <ExcelInput
                      value={val}
                      onChange={(n) => setCount(v.key, n)}
                      inputMode="numeric"
                      align="center"
                      ariaLabel={`Số lượng ${v.label}`}
                    />
                  ) : (
                    display
                  )}
                </td>
                <td className="demxe-col-sum demxe-xcell demxe-xcell--readonly">{display}</td>
              </tr>
            );
          })}
          <tr className="demxe-grand-total-row">
            <td className="demxe-col-type"><strong>CỘNG</strong></td>
            <td className="demxe-col-count" />
            <td className="demxe-col-sum demxe-xcell demxe-xcell--readonly">
              <strong>{total || ""}</strong>
            </td>
          </tr>
        </tbody>
      </table>

      <div className="demxe-sign-row">
        <div>
          <strong>NGƯỜI GIÁM SÁT</strong>
        </div>
        <div>
          <strong>TỔ TRƯỞNG TỔ ĐẾM XE</strong>
        </div>
      </div>
    </div>
  );
}
