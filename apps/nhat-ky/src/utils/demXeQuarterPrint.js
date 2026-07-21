import { DIRECTION_DI, DIRECTION_VE, DIRECTION_LABEL } from "./demXeConstants";
import { ensureDayDirections } from "./demXeStore";

/**
 * Danh sách tờ in 1 quý:
 * 1) Bảng tổng hợp
 * 2–7) Phiếu đếm ngày 5/6/7 × chiều đi / chiều về
 */
export function buildQuarterPrintPlan(quarter, days, cover = {}) {
  if (!quarter?.dates?.length) return [];
  const seed = {
    roadName: cover?.tenDuong || "",
    lyTrinh: "",
    from: "",
    to: ""
  };
  const plan = [
    {
      kind: "summary",
      key: `summary-${quarter.key}`,
      label: `Tổng hợp ${quarter.label}`
    }
  ];

  quarter.dates.forEach((date) => {
    const day = ensureDayDirections(days?.[date] || { directions: [] }, seed);
    [DIRECTION_DI, DIRECTION_VE].forEach((type) => {
      const direction =
        day.directions.find((d) => d.directionType === type) || day.directions[0];
      plan.push({
        kind: "form",
        key: `form-${date}-${type}`,
        date,
        directionType: type,
        directionLabel: DIRECTION_LABEL[type] || type,
        direction,
        label: `${date} · ${DIRECTION_LABEL[type] || type}`
      });
    });
  });

  return plan;
}

export function quarterPrintPageCount(quarter) {
  if (!quarter?.dates?.length) return 0;
  return 1 + quarter.dates.length * 2;
}
