import { useMemo } from "react";
import DemXeCountSheet from "./DemXeCountSheet";
import DemXeSummarySheet from "./DemXeSummarySheet";
import NhatKyMarginGuides from "./NhatKyMarginGuides";
import { DIRECTION_LABEL } from "../utils/demXeConstants";
import { buildQuarterPrintPlan } from "../utils/demXeQuarterPrint";
import { formatDisplayDate } from "../utils/nhatKyFormat";

function PrintPageShell({
  children,
  pageIndex,
  pageCount,
  kicker,
  margins,
  showGuides,
  onMarginsChange
}) {
  const pad = {
    paddingTop: `${margins.top}mm`,
    paddingRight: `${margins.right}mm`,
    paddingBottom: `${margins.bottom}mm`,
    paddingLeft: `${margins.left}mm`
  };

  return (
    <section
      className="demxe-quarter-print-page"
      style={pad}
      data-print-page={pageIndex + 1}
    >
      {showGuides && onMarginsChange ? (
        <NhatKyMarginGuides
          margins={margins}
          onChange={onMarginsChange}
          pageWMm={210}
          pageHMm={297}
          minContentMm={100}
        />
      ) : null}
      {pageCount > 1 ? (
        <p className="demxe-quarter-print-kicker no-print">
          Tờ {pageIndex + 1}/{pageCount}
          {kicker ? ` · ${kicker}` : ""}
        </p>
      ) : null}
      <div className="demxe-quarter-print-inner">{children}</div>
    </section>
  );
}

/**
 * Xem trước / in sổ đếm xe theo quý:
 * tổng hợp → ngày 5 đi → ngày 5 về → ngày 6 đi → ngày 6 về → ngày 7 đi → ngày 7 về.
 * Kéo lề xanh trên tờ đầu (giống sổ mặt đường / bảo dưỡng).
 */
export default function DemXeQuarterPrintPages({
  quarter,
  days,
  cover = {},
  margins = { top: 12, right: 12, bottom: 12, left: 14 },
  onMarginsChange
}) {
  const plan = useMemo(
    () => buildQuarterPrintPlan(quarter, days, cover),
    [quarter, days, cover]
  );

  if (!quarter || !plan.length) {
    return (
      <div className="demxe-empty-form">
        Chọn quý ở cột trái để xem trước in.
      </div>
    );
  }

  const pageCount = plan.length;

  return (
    <div
      className="demxe-quarter-print-stack demxe-quarter-print-stack--preview"
      data-page-count={pageCount}
      data-quarter={quarter.key}
    >
      {plan.map((item, i) => {
        if (item.kind === "summary") {
          return (
            <PrintPageShell
              key={item.key}
              pageIndex={i}
              pageCount={pageCount}
              kicker={item.label}
              margins={margins}
              showGuides={i === 0}
              onMarginsChange={onMarginsChange}
            >
              <DemXeSummarySheet
                days={days}
                cover={cover}
                batchStarts={[quarter.startDate]}
              />
            </PrintPageShell>
          );
        }

        const dirLabel =
          item.directionLabel || DIRECTION_LABEL[item.directionType] || "";
        return (
          <PrintPageShell
            key={item.key}
            pageIndex={i}
            pageCount={pageCount}
            kicker={`${formatDisplayDate(item.date)} · ${dirLabel}`}
            margins={margins}
            showGuides={false}
            onMarginsChange={onMarginsChange}
          >
            <DemXeCountSheet
              date={item.date}
              direction={item.direction}
              cover={cover}
              editable={false}
            />
          </PrintPageShell>
        );
      })}
    </div>
  );
}
