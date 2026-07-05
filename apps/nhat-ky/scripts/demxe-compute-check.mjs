import {
  computeSummaryByDirection,
  directionTotal,
  listActiveDates,
  parseCount,
  sumCounts
} from "../src/utils/demXeCompute.js";

const days = {
  "2026-07-05": {
    directions: [
      {
        id: "1",
        directionType: "di",
        from: "A",
        to: "B",
        counts: { xeCon: 2, xeTaiNhe: 1 }
      },
      {
        id: "2",
        directionType: "ve",
        from: "B",
        to: "A",
        counts: { xeCon: 3 }
      }
    ]
  },
  "2026-07-06": {
    directions: [
      {
        id: "3",
        directionType: "di",
        from: "A",
        to: "B",
        counts: { xeCon: 1 }
      }
    ]
  }
};

if (parseCount("12") !== 12) throw new Error("parseCount");
if (sumCounts({ xeCon: 2, xeTaiNhe: 1 }) !== 3) throw new Error("sumCounts");
if (listActiveDates(days).length !== 2) throw new Error("listActiveDates");

const { dates, rows } = computeSummaryByDirection(days);
if (dates.length !== 2) throw new Error("summary dates");
const xeConRow = rows.find((r) => r.vehicleKey === "xeCon" && r.from === "A");
if (!xeConRow || xeConRow.byDate["2026-07-05"] !== 2) throw new Error("summary xeCon");

console.log("demXeCompute self-test: OK");
