import { useMemo } from "react";
import { OFFICIAL_HEADERS } from "../utils/nhatKyFormat";
import { buildNhatKyPrintRows } from "../utils/nhatKyPrintRows";
import { getNhatKyColWidths, sumCols } from "../hooks/useColumnWidths";
import NhatKyMarginGuides from "./NhatKyMarginGuides";

const LEFT_COLS = [
  { key: "c1", header: OFFICIAL_HEADERS.col1, num: 1 },
  { key: "c2", header: OFFICIAL_HEADERS.col2, num: 2 },
  { key: "c3", header: OFFICIAL_HEADERS.col3, num: 3 }
];

const RIGHT_COLS = [
  { key: "c4", header: OFFICIAL_HEADERS.col4, num: 4 },
  { key: "c5", header: OFFICIAL_HEADERS.col5, num: 5 },
  { key: "c6", header: OFFICIAL_HEADERS.col6, num: 6 }
];

const MM_TO_PX = 96 / 25.4;
const A4_H_MM = 297;
const THEAD_PX = 56;
const FILLER_ROW_PX = 28;

function bodyMaxPx(margins) {
  const pad = (Number(margins?.top) || 0) + (Number(margins?.bottom) || 0);
  return Math.max(400, Math.floor((A4_H_MM - pad) * MM_TO_PX - THEAD_PX - 20));
}

function cellText(row, key) {
  if (row.kind === "filler") return "";
  if (key === "c3" && row.kind === "empty") return null;
  return row[key] || "";
}

/** Chiều cao hàng — dùng chung trang trái/phải để ghép A3. */
export function estimateRowHeightPx(row) {
  if (row.kind === "filler") return FILLER_ROW_PX;
  if (row.kind === "part") return 32;
  if (row.kind === "section") return 30;
  if (row.kind === "empty") return 26;
  if (row.kind === "weather") return 40;

  const chunks = [row.c1, row.c2, row.c3, row.c4, row.c5, row.c6].map((t) =>
    String(t || "")
  );
  let lines = 1;
  chunks.forEach((text) => {
    if (!text) return;
    let n = 0;
    text.split("\n").forEach((line) => {
      n += Math.max(1, Math.ceil(line.length / 36));
    });
    lines = Math.max(lines, n);
  });
  return Math.min(200, Math.max(26, 14 + lines * 15));
}

function makeFiller(i) {
  return {
    kind: "filler",
    key: `filler-${i}`,
    c1: "",
    c2: "",
    c3: "",
    c4: "",
    c5: "",
    c6: ""
  };
}

export function packRowsForA4(rows, maxBodyPx) {
  const list = rows || [];
  if (!list.length) return [[makeFiller(0)]];

  const packed = [];
  let bucket = [];
  let used = 0;

  list.forEach((row) => {
    const h = estimateRowHeightPx(row);
    if (bucket.length > 0 && used + h > maxBodyPx) {
      packed.push(padChunk(bucket, used, maxBodyPx));
      bucket = [];
      used = 0;
    }
    bucket.push(row);
    used += h;
  });
  if (bucket.length) packed.push(padChunk(bucket, used, maxBodyPx));
  return packed.length ? packed : [list];
}

function padChunk(bucket, used, maxBodyPx) {
  const out = [...bucket];
  let u = used;
  let i = 0;
  while (u + FILLER_ROW_PX <= maxBodyPx - 4) {
    out.push(makeFiller(i++));
    u += FILLER_ROW_PX;
  }
  return out;
}

function PrintHalfPage({
  side,
  cols,
  rows,
  margins,
  widths,
  showGuides,
  onMarginsChange
}) {
  const pad = {
    paddingTop: `${margins.top}mm`,
    paddingRight: `${margins.right}mm`,
    paddingBottom: `${margins.bottom}mm`,
    paddingLeft: `${margins.left}mm`
  };
  const total = sumCols(cols, widths) || 1;

  return (
    <section
      className={`nhatky-print-page nhatky-print-page--${side}`}
      data-print-side={side}
      style={pad}
    >
      {showGuides && onMarginsChange ? (
        <NhatKyMarginGuides margins={margins} onChange={onMarginsChange} />
      ) : null}
      <table className="nhatky-print-table nhatky-print-table--half">
        <colgroup>
          {cols.map((c) => (
            <col
              key={c.key}
              className={`nhatky-print-col nhatky-print-col--${c.num}`}
              style={{ width: `${(widths[c.key] / total) * 100}%` }}
            />
          ))}
        </colgroup>
        <thead>
          <tr className="nhatky-print-head-main">
            {cols.map((c) => (
              <th key={c.key}>{c.header}</th>
            ))}
          </tr>
          <tr className="nhatky-print-head-num">
            {cols.map((c) => (
              <th key={c.key}>({c.num})</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const h = estimateRowHeightPx(row);
            return (
              <tr
                key={`${side}-${row.key}`}
                className={`nhatky-print-row nhatky-print-row--${row.kind}`}
                style={{ height: h, minHeight: h }}
              >
                {cols.map((c) => {
                  const text = cellText(row, c.key);
                  return (
                    <td
                      key={c.key}
                      className={`nhatky-print-td nhatky-print-td--${c.num}`}
                      style={{ height: h }}
                    >
                      {text === null ? (
                        <em className="nhatky-print-empty">Không phát sinh</em>
                      ) : text ? (
                        <pre className="nhatky-print-pre">{text}</pre>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

/**
 * Trang 1 = cột 1–3 → Trang 2 = cột 4–6 → Trang 3/4 nếu dài.
 * Bề rộng cột = đúng tỷ lệ đã kéo chỉnh ở trang nhập liệu.
 */
export default function NhatKyPrintDay({
  date,
  items,
  dayMeta,
  margins = { top: 8, right: 8, bottom: 8, left: 8 },
  onMarginsChange,
  widths: widthsProp
}) {
  const widths = widthsProp || getNhatKyColWidths();

  const rows = useMemo(
    () => buildNhatKyPrintRows(date, items, dayMeta),
    [date, items, dayMeta]
  );

  const maxBody = bodyMaxPx(margins);
  const chunks = useMemo(() => packRowsForA4(rows, maxBody), [rows, maxBody]);

  const printPages = useMemo(() => {
    const list = [];
    chunks.forEach((chunk, sheetIndex) => {
      list.push({
        side: "left",
        cols: LEFT_COLS,
        rows: chunk,
        pageNum: sheetIndex * 2 + 1
      });
      list.push({
        side: "right",
        cols: RIGHT_COLS,
        rows: chunk,
        pageNum: sheetIndex * 2 + 2
      });
    });
    return list;
  }, [chunks]);

  return (
    <div className="nhatky-print-day" data-print-date={date}>
      {printPages.map((page, index) => (
        <PrintHalfPage
          key={`${date}-p${page.pageNum}`}
          side={page.side}
          cols={page.cols}
          rows={page.rows}
          margins={margins}
          widths={widths}
          showGuides={index === 0}
          onMarginsChange={onMarginsChange}
        />
      ))}
    </div>
  );
}
