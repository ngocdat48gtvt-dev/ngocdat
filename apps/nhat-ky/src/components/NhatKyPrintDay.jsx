import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { OFFICIAL_HEADERS } from "../utils/nhatKyFormat";
import {
  buildNhatKyPrintRows,
  SIGN_NAME_GAP_ROWS,
  SIGN_CELL_CSS_PX
} from "../utils/nhatKyPrintRows";
import { getNhatKyColWidths, sumCols } from "../hooks/useColumnWidths";
import { useRoadWorkspace } from "../context/RoadWorkspaceContext";
import { isMergedMultiRouteView } from "../utils/roadsCatalog";
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
/** 2 hàng tiêu đề (chữ dài xuống dòng) — ước lượng đóng trang trước khi đo DOM. */
const THEAD_PX = 92;
/** Tăng chiều cao hàng ×1.15 ×1.15 ×1.1 ×1.2 so với bản gốc 20px. */
const ROW_HEIGHT_SCALE = 1.15 * 1.15 * 1.1 * 1.2;
const NORMAL_ROW_PX = Math.round(20 * ROW_HEIGHT_SCALE);
/** Khi sync/in: chiều cao hàng dữ liệu. Hiện tại = 1.2 × 0.85 × 0.9⁴. */
const BODY_ROW_HEIGHT_SCALE = 1.2 * 0.85 * 0.9 * 0.9 * 0.9 * 0.9;
/** Ô ký cao ≈ chức danh + khoảng cố định + tên */
const SIGN_CELL_PX = Math.max(
  SIGN_CELL_CSS_PX,
  Math.round(NORMAL_ROW_PX * (2 + SIGN_NAME_GAP_ROWS))
);

export { SIGN_CELL_PX, NORMAL_ROW_PX, BODY_ROW_HEIGHT_SCALE };

/** Hệ số chiều cao hàng khách chỉnh (1 = mặc định). */
export function clampRowHeightScale(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.min(1.8, Math.max(0.6, Math.round(n * 20) / 20));
}

function scaleBodyPx(px, scale) {
  const s = clampRowHeightScale(scale);
  if (s === 1) return px;
  return Math.max(10, Math.round(Number(px) * s));
}

function rowHeightScaleFromEl(el) {
  const host =
    el?.closest?.("[data-row-height-scale]") ||
    el?.querySelector?.("[data-row-height-scale]");
  return clampRowHeightScale(host?.getAttribute?.("data-row-height-scale"));
}
const HEIGHT_SAFETY = 1;
const PART_ROW_PX = Math.round(18 * ROW_HEIGHT_SCALE);
const WEATHER_ROW_PX = Math.round(22 * ROW_HEIGHT_SCALE);
const LINE_PX = 12 * ROW_HEIGHT_SCALE;

const DEFAULT_WIDTHS = {
  c1: 22,
  c2: 30,
  c3: 48,
  c4: 22,
  c5: 30,
  c6: 48
};

function bodyMaxPx(margins) {
  const pad = (Number(margins?.top) || 0) + (Number(margins?.bottom) || 0);
  return Math.max(
    320,
    Math.floor((A4_H_MM - pad) * MM_TO_PX - THEAD_PX)
  );
}

/** Cạnh trên của lề dưới (đường xanh) — hàng không được đè xuống dưới. */
function pageInnerBottom(page) {
  if (!page) return 0;
  const rect = page.getBoundingClientRect();
  const padB = parseFloat(getComputedStyle(page).paddingBottom) || 0;
  return rect.bottom - padB;
}

function isFillerRowEl(tr) {
  return (
    tr?.classList.contains("nhatky-print-row--filler") ||
    tr?.classList.contains("nhatky-print-row--sign-gap") ||
    tr?.getAttribute("data-sign-gap") === "1"
  );
}

/**
 * Hàng dữ liệu đầu tiên bị đường lề dưới cắt (không phải hàng đầu trang).
 * Hàng đó phải nhảy nguyên sang cặp trang sau.
 */
function overflowBreakKey(spreadEl) {
  if (!spreadEl) return null;
  const pages = [
    spreadEl.querySelector(".nhatky-print-page--left"),
    spreadEl.querySelector(".nhatky-print-page--right")
  ].filter(Boolean);
  const hits = [];
  for (let p = 0; p < pages.length; p += 1) {
    const page = pages[p];
    const limit = pageInnerBottom(page);
    const trs = Array.from(page.querySelectorAll("tbody tr"));
    const contentTrs = trs.filter(
      (tr) => !isSignRowEl(tr) && !isFillerRowEl(tr)
    );
    if (!contentTrs.length) continue;
    const firstKey = contentTrs[0].getAttribute("data-row-key");
    for (let i = 0; i < trs.length; i += 1) {
      const tr = trs[i];
      if (rowPaintBottom(tr) <= limit) continue;
      let key = tr.getAttribute("data-row-key");
      if (isSignRowEl(tr) || isFillerRowEl(tr)) {
        if (contentTrs.length < 2) break;
        key = contentTrs[contentTrs.length - 1].getAttribute("data-row-key");
      }
      if (!key || key === firstKey) continue;
      hits.push({ key, top: tr.getBoundingClientRect().top });
      break;
    }
  }
  if (!hits.length) return null;
  hits.sort((a, b) => a.top - b.top);
  return hits[0].key;
}

function rowPaintBottom(tr) {
  if (!tr) return 0;
  let bottom = tr.getBoundingClientRect().bottom;
  tr.querySelectorAll(".nhatky-print-pre, .nhatky-print-empty").forEach((el) => {
    const b = el.getBoundingClientRect().bottom;
    if (b > bottom) bottom = b;
  });
  return bottom;
}

function peelChunk(chunk) {
  const list = chunk || [];
  return {
    data: list.filter((r) => !isSignKind(r?.kind)),
    signs: list.filter((r) => isSignKind(r?.kind))
  };
}

function attachSignsToLast(chunks, signRows) {
  const next = (chunks || [])
    .map((c) => (c || []).filter((r) => !isSignKind(r?.kind)))
    .filter((c) => c.length);
  if (!next.length) next.push([]);
  const signs = (signRows || []).filter((r) => isSignKind(r?.kind));
  next[next.length - 1] = [...next[next.length - 1], ...signs];
  return next;
}

/** Chuyển hàng (và mọi hàng sau) sang cặp trang sau nếu đè lề dưới. */
function splitFirstOverflow(chunks, dayEl) {
  if (!dayEl) return null;
  const spreads = Array.from(dayEl.querySelectorAll(".nhatky-print-spread"));
  const signRows = takeSignRows((chunks || []).flat());
  for (let i = 0; i < spreads.length; i += 1) {
    const key = overflowBreakKey(spreads[i]);
    if (!key) continue;
    const data = peelChunk(chunks[i]).data;
    let idx = data.findIndex((r) => String(r?.key) === String(key));
    if (idx < 0) {
      const trs = Array.from(
        spreads[i].querySelectorAll(".nhatky-print-page--left tbody tr")
      ).filter((tr) => !isSignRowEl(tr) && !isFillerRowEl(tr));
      idx = trs.findIndex((tr) => tr.getAttribute("data-row-key") === key);
    }
    if (idx <= 0) continue;
    const keep = data.slice(0, idx);
    const move = data.slice(idx);
    if (!keep.length || !move.length) continue;
    const nextData = (chunks || []).map((c) => peelChunk(c).data);
    nextData[i] = keep;
    if (nextData[i + 1]) nextData[i + 1] = [...move, ...nextData[i + 1]];
    else nextData.push(move);
    return attachSignsToLast(nextData, signRows);
  }
  return null;
}

function escapeRowKey(key) {
  const s = String(key || "");
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(s);
  }
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function rowHeightOnSpread(spreadEl, key) {
  if (!spreadEl || !key) return 0;
  let h = 0;
  spreadEl
    .querySelectorAll(`tbody tr[data-row-key="${escapeRowKey(key)}"]`)
    .forEach((tr) => {
      const box = tr.getBoundingClientRect();
      h = Math.max(
        h,
        Math.ceil(box.height),
        Math.ceil(rowPaintBottom(tr) - box.top)
      );
    });
  return h;
}

function contentGapToMarginPx(spreadEl) {
  const pages = [
    spreadEl?.querySelector(".nhatky-print-page--left"),
    spreadEl?.querySelector(".nhatky-print-page--right")
  ].filter(Boolean);
  let gap = Infinity;
  pages.forEach((page) => {
    const contentTrs = Array.from(page.querySelectorAll("tbody tr")).filter(
      (tr) => !isSignRowEl(tr) && !isFillerRowEl(tr)
    );
    if (!contentTrs.length) return;
    const last = contentTrs[contentTrs.length - 1];
    const g = pageInnerBottom(page) - rowPaintBottom(last);
    if (g < gap) gap = g;
  });
  return Number.isFinite(gap) ? gap : 0;
}

/** Kéo 1 hàng từ cặp trang sau lên khi còn chỗ trước lề dưới. */
function pullFirstRowIfFits(chunks, dayEl) {
  if (!dayEl) return null;
  const spreads = Array.from(dayEl.querySelectorAll(".nhatky-print-spread"));
  const signRows = takeSignRows((chunks || []).flat());
  const nextData = (chunks || []).map((c) => peelChunk(c).data);
  for (let i = 0; i < spreads.length - 1; i += 1) {
    if (overflowBreakKey(spreads[i])) continue;
    const gap = contentGapToMarginPx(spreads[i]);
    if (!(gap > 0)) continue;
    const nxt = nextData[i + 1];
    if (!nxt || !nxt.length) continue;
    const h = rowHeightOnSpread(spreads[i + 1], nxt[0]?.key);
    if (!(h > 0) || h > gap) continue;
    nextData[i].push(nxt.shift());
    return attachSignsToLast(nextData, signRows);
  }
  return null;
}

function sameChunkKeys(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const ka = (a[i] || []).map((r) => r?.key).join("\n");
    const kb = (b[i] || []).map((r) => r?.key).join("\n");
    if (ka !== kb) return false;
  }
  return true;
}

function isSignRowEl(tr) {
  return (
    tr?.classList.contains("nhatky-print-row--sign-pair") ||
    tr?.classList.contains("nhatky-print-row--sign-hat") ||
    tr?.classList.contains("nhatky-print-row--sign-tuan")
  );
}

function cellText(row, key) {
  if (!row || String(row.kind || "").startsWith("sign")) return "";
  if (row.kind === "filler") return "";
  if (key === "c3" && row.kind === "empty") return null;
  return row[key] || "";
}

function linesForText(text, charsPerLine) {
  const cpl = Math.max(6, charsPerLine || 36);
  let n = 0;
  String(text || "")
    .split("\n")
    .forEach((line) => {
      n += Math.max(1, Math.ceil(Math.max(String(line).length, 1) / cpl));
    });
  return Math.max(1, n);
}

function estimateSideLines(row, keys, widths, halfTotal) {
  const total = halfTotal || 1;
  const HALF_CHARS = 50;
  let lines = 1;
  keys.forEach((key) => {
    const text = row?.[key];
    if (!text && text !== 0) return;
    const share = (Number(widths?.[key]) || 0) / total;
    const cpl = Math.max(8, Math.floor(HALF_CHARS * Math.max(share, 0.12)));
    lines = Math.max(lines, linesForText(text, cpl));
  });
  return lines;
}

function isSignKind(kind) {
  return String(kind || "").startsWith("sign");
}

export function estimateRowHeightPx(row, widthsProp, rowHeightScale = 1) {
  const s = clampRowHeightScale(rowHeightScale);
  if (!row) return scaleBodyPx(NORMAL_ROW_PX, s);
  if (row.kind === "sign-pair" || row.kind === "sign-hat" || row.kind === "sign-tuan") {
    return SIGN_CELL_PX;
  }
  if (row.kind === "sign-gap" || row.kind === "filler") return scaleBodyPx(NORMAL_ROW_PX, s);
  if (isSignKind(row.kind)) return SIGN_CELL_PX;
  if (row.kind === "part") return scaleBodyPx(PART_ROW_PX, s);
  if (row.kind === "section") return scaleBodyPx(PART_ROW_PX, s);
  if (row.kind === "empty") return scaleBodyPx(NORMAL_ROW_PX, s);
  if (row.kind === "weather") return scaleBodyPx(WEATHER_ROW_PX, s);

  const widths = widthsProp || DEFAULT_WIDTHS;
  const leftTotal =
    (Number(widths.c1) || 0) + (Number(widths.c2) || 0) + (Number(widths.c3) || 0) || 1;
  const rightTotal =
    (Number(widths.c4) || 0) + (Number(widths.c5) || 0) + (Number(widths.c6) || 0) || 1;

  const lines = Math.max(
    estimateSideLines(row, ["c1", "c2", "c3"], widths, leftTotal),
    estimateSideLines(row, ["c4", "c5", "c6"], widths, rightTotal)
  );
  const raw = Math.max(LINE_PX + 4, 2 + lines * LINE_PX);
  return Math.ceil(raw * HEIGHT_SAFETY * s);
}

function resolveRowHeightPx(row, widthsProp, heightByKey, rowHeightScale = 1) {
  const key = row?.key;
  if (key && heightByKey && Number(heightByKey[key]) > 0) {
    return Math.ceil(Number(heightByKey[key]));
  }
  return estimateRowHeightPx(row, widthsProp, rowHeightScale);
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

function isContentRow(row) {
  return Boolean(row && row.kind !== "filler" && !isSignKind(row.kind));
}

function sumRowHeights(rows, widths, heightByKey, rowHeightScale = 1) {
  return (rows || []).reduce(
    (acc, r) => acc + resolveRowHeightPx(r, widths, heightByKey, rowHeightScale),
    0
  );
}

function isSignBlockStart(row) {
  return row?.kind === "sign-pair";
}

function isSignBlockPart(row) {
  const k = String(row?.kind || "");
  return k === "sign-pair" || k === "sign-gap" || k === "sign-hat" || k === "sign-tuan";
}

/** Gom nguyên khối ký (gap…name) để không tách trang giữa chừng. */
function packUnits(rows) {
  const list = rows || [];
  const units = [];
  for (let i = 0; i < list.length; i += 1) {
    const row = list[i];
    if (isSignBlockStart(row)) {
      const block = [row];
      let j = i + 1;
      while (j < list.length && isSignBlockPart(list[j]) && list[j].kind !== "sign-gap") {
        block.push(list[j]);
        j += 1;
      }
      // Đủ gap + role + blanks + name
      units.push(block);
      i = j - 1;
    } else {
      units.push([row]);
    }
  }
  return units;
}

function stripSignRows(rows) {
  return (rows || []).filter((r) => !isSignKind(r?.kind));
}

function takeSignRows(rows) {
  const signs = (rows || []).filter((r) => {
    const k = String(r?.kind || "");
    // Bỏ sign-gap cũ — ký sát hàng dữ liệu cuối.
    return isSignKind(k) && k !== "sign-gap";
  });
  if (signs.length) return signs;
  return [
    {
      kind: "sign-pair",
      key: "sign-pair",
      c1: "",
      c2: "",
      c3: "",
      c4: "",
      c5: "",
      c6: ""
    }
  ];
}

/**
 * Kéo hàng từ trang sau lên trang trước khi còn chỗ — giảm khoảng hở cuối trang.
 */
function tightenPackedPages(packed) {
  return (packed || []).filter((p) => p.length > 0);
}

/**
 * Gắn khối ký sát hàng dữ liệu cuối (không hàng trống phía trên).
 */
function padLastPageWithSign(packed, maxBodyPx, widths, signRows, heightByKey, rowHeightScale = 1) {
  if (!packed.length) packed.push([]);
  const signH = sumRowHeights(signRows, widths, heightByKey, rowHeightScale);
  let last = packed[packed.length - 1];
  let lastUsed = sumRowHeights(last, widths, heightByKey, rowHeightScale);

  // Không đủ chỗ → tách dữ liệu lên trang mới trước khi gắn ký
  if (lastUsed + signH > maxBodyPx) {
    const moved = [];
    while (last.length > 0 && lastUsed + signH > maxBodyPx) {
      const row = last.pop();
      moved.unshift(row);
      lastUsed -= resolveRowHeightPx(row, widths, heightByKey, rowHeightScale);
    }
    if (!moved.some(isContentRow) && last.length > 0) {
      for (let i = last.length - 1; i >= 0; i -= 1) {
        if (isContentRow(last[i])) {
          const [row] = last.splice(i, 1);
          moved.unshift(row);
          lastUsed = sumRowHeights(last, widths, heightByKey, rowHeightScale);
          break;
        }
      }
    }
    if (last.length === 0) packed.pop();
    if (moved.length) packed.push(moved);
    last = packed[packed.length - 1];
  }

  packed[packed.length - 1] = [...last, ...signRows];
  return packed;
}

/**
 * Đóng trang A4: mỗi chunk = 1 cặp (trang lẻ cột 1–3, trang chẵn cột 4–6).
 * Dữ liệu dài → trang 3–4, 5–6… Ký chỉ gắn trang cuối.
 * maxBodyPx <= 0: không tách trang (xuất Excel gom cả ngày).
 */
export function packRowsForA4(
  rows,
  maxBodyPx,
  _signReservePx = 0,
  widths,
  heightByKey,
  rowHeightScale = 1,
  breakBefore
) {
  const content = stripSignRows(rows);
  const signRows = takeSignRows(rows);
  const mustBreak = breakBefore instanceof Set ? breakBefore : new Set();
  if (!(Number(maxBodyPx) > 0)) {
    return [[...content, ...signRows]];
  }
  const units = packUnits(content);
  if (!units.length) {
    return padLastPageWithSign(
      [[]],
      maxBodyPx,
      widths,
      signRows,
      heightByKey,
      rowHeightScale
    );
  }

  const packed = [];
  let bucket = [];
  let used = 0;

  units.forEach((unit) => {
    const h = sumRowHeights(unit, widths, heightByKey, rowHeightScale);
    const unitKey = unit[0]?.key;
    const forceBreak = bucket.length > 0 && unitKey && mustBreak.has(unitKey);
    if (bucket.length > 0 && (forceBreak || used + h > maxBodyPx)) {
      packed.push(bucket);
      bucket = [];
      used = 0;
    }
    bucket.push(...unit);
    used += h;
  });
  if (bucket.length) packed.push(bucket);
  if (!packed.length) packed.push([]);

  const tight = tightenPackedPages(packed);
  return padLastPageWithSign(
    tight,
    maxBodyPx,
    widths,
    signRows,
    heightByKey,
    rowHeightScale
  );
}

function buildSyncedLayout(rows) {
  return (rows || []).map((row) => {
    if (isSignKind(row.kind) || row.kind === "filler") {
      return { kind: row.kind, key: row.key, row };
    }
    return { kind: "data", row };
  });
}

function SignBlock({ role, name }) {
  const display = String(name || "").trim();
  return (
    <div className="nhatky-sign-block">
      <div className="nhatky-sign-role">{role}</div>
      <div className="nhatky-sign-space" aria-hidden="true" />
      <div className="nhatky-sign-name">{display}</div>
    </div>
  );
}

function CellBox({ children }) {
  return <div className="nhatky-print-cellbox">{children}</div>;
}

function blankCells(cols, h) {
  const style = h ? { height: h, minHeight: h } : undefined;
  return cols.map((c) => (
    <td
      key={c.key}
      className={`nhatky-print-td nhatky-print-td--${c.num}`}
      style={style}
    >
      <CellBox />
    </td>
  ));
}

function renderSignPairCells(side, signTuanDuong, signHatTruong, signHatRole) {
  const h = SIGN_CELL_PX;
  const style = { height: h, minHeight: h };
  if (side === "left") {
    return (
      <>
        <td className="nhatky-print-td nhatky-print-td--1" style={style}>
          <CellBox />
        </td>
        <td className="nhatky-print-td nhatky-print-td--2" style={style}>
          <CellBox />
        </td>
        <td className="nhatky-print-td nhatky-print-td--3" style={style}>
          <CellBox>
            <SignBlock role="Tuần đường" name={signTuanDuong} />
          </CellBox>
        </td>
      </>
    );
  }
  return (
    <>
      <td className="nhatky-print-td nhatky-print-td--4" style={style}>
        <CellBox />
      </td>
      <td className="nhatky-print-td nhatky-print-td--5" style={style}>
        <CellBox>
          <SignBlock role={signHatRole || "Hạt trưởng"} name={signHatTruong} />
        </CellBox>
      </td>
      <td className="nhatky-print-td nhatky-print-td--6" style={style}>
        <CellBox />
      </td>
    </>
  );
}

function renderLayoutRows(
  side,
  layout,
  cols,
  widths,
  signTuanDuong,
  signHatTruong,
  signHatRole,
  rowHeightScale = 1
) {
  const s = clampRowHeightScale(rowHeightScale);
  return layout.map((item, idx) => {
    const kind = item.kind;

    if (kind === "filler" || kind === "sign-gap") {
      const h = scaleBodyPx(NORMAL_ROW_PX, s);
      const rowKey = item.key || `${kind}-${idx}`;
      return (
        <tr
          key={`${side}-${rowKey}`}
          className={`nhatky-print-row nhatky-print-row--${kind}`}
          style={{ height: h, minHeight: h }}
          data-row-key={rowKey}
          data-sign-gap={kind === "sign-gap" ? "1" : undefined}
        >
          {blankCells(cols, h)}
        </tr>
      );
    }

    if (kind === "sign-pair") {
      const h = SIGN_CELL_PX;
      const rowKey = item.key || `sign-pair-${idx}`;
      return (
        <tr
          key={`${side}-${rowKey}`}
          className="nhatky-print-row nhatky-print-row--sign nhatky-print-row--sign-pair"
          style={{ height: h, minHeight: h }}
          data-row-key={rowKey}
        >
          {renderSignPairCells(side, signTuanDuong, signHatTruong, signHatRole)}
        </tr>
      );
    }

    if (kind === "sign-hat" || kind === "sign-tuan") {
      const h = SIGN_CELL_PX;
      const rowKey = item.key || `${kind}-${idx}`;
      return (
        <tr
          key={`${side}-${rowKey}`}
          className={`nhatky-print-row nhatky-print-row--sign nhatky-print-row--${kind}`}
          style={{ height: h, minHeight: h }}
          data-row-key={rowKey}
        >
          {renderSignPairCells(side, signTuanDuong, signHatTruong, signHatRole)}
        </tr>
      );
    }

    const row = item.row || makeFiller(idx);
    const rowKey = row.key || `row-${idx}`;
    const h = estimateRowHeightPx(row, widths, s);
    return (
      <tr
        key={`${side}-${rowKey}`}
        className={`nhatky-print-row nhatky-print-row--${row.kind}`}
        style={{ minHeight: h }}
        data-row-key={rowKey}
      >
        {cols.map((c) => {
          if (c.key === "c5" && row.c5Skip) return null;
          const text = cellText(row, c.key);
          const rowspan =
            c.key === "c5" && Number(row.c5Rowspan) > 1 ? Number(row.c5Rowspan) : undefined;
          return (
            <td
              key={c.key}
              className={`nhatky-print-td nhatky-print-td--${c.num}`}
              rowSpan={rowspan}
              style={rowspan ? undefined : { minHeight: h }}
            >
              <CellBox>
                {text === null ? (
                  <em className="nhatky-print-empty">Không phát sinh</em>
                ) : text ? (
                  <pre className="nhatky-print-pre">{text}</pre>
                ) : null}
              </CellBox>
            </td>
          );
        })}
      </tr>
    );
  });
}

function collectMeasuredHeights(dayEl) {
  const map = {};
  if (!dayEl) return map;
  dayEl.querySelectorAll(".nhatky-print-page tbody tr[data-row-key]").forEach((tr) => {
    const key = tr.getAttribute("data-row-key");
    if (!key) return;
    const h = Math.ceil(tr.offsetHeight || tr.getBoundingClientRect().height);
    if (h > 0) map[key] = Math.max(map[key] || 0, h);
  });
  return map;
}

function heightsMapsDiffer(a, b) {
  const left = a || {};
  const right = b || {};
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const k of keys) {
    if (Math.abs(Number(left[k] || 0) - Number(right[k] || 0)) > 1) return true;
  }
  return false;
}

function rowLayoutH(tr) {
  if (!tr) return 0;
  let h = Math.ceil(tr.getBoundingClientRect?.().height || tr.offsetHeight || 0);
  tr.querySelectorAll("th, td").forEach((cell) => {
    if (cell.rowSpan > 1) return;
    const box = cell.querySelector(".nhatky-print-cellbox");
    const pre = cell.querySelector(".nhatky-print-pre, .nhatky-print-empty");
    const ch = Math.ceil(
      Math.max(
        pre?.scrollHeight || 0,
        box?.scrollHeight || 0,
        cell.scrollHeight || 0,
        cell.offsetHeight || 0
      )
    );
    if (ch > h) h = ch;
  });
  return h;
}

function clearRowForceHeight(tr) {
  if (!tr) return;
  tr.style.height = "";
  tr.style.minHeight = "";
  tr.style.maxHeight = "";
  tr.querySelectorAll("th, td").forEach((cell) => {
    cell.style.height = "";
    cell.style.minHeight = "";
    cell.style.maxHeight = "";
  });
  tr.querySelectorAll(".nhatky-print-cellbox").forEach((box) => {
    box.style.minHeight = "";
    box.style.height = "";
  });
}

function applyRowHeight(tr, h) {
  if (!tr || !(h > 0)) return;
  const px = `${h}px`;
  tr.style.height = px;
  tr.style.minHeight = px;
  tr.querySelectorAll("th, td").forEach((cell) => {
    if (cell.rowSpan > 1) return;
    cell.style.height = px;
    cell.style.minHeight = px;
  });
  tr.querySelectorAll(".nhatky-print-cellbox").forEach((box) => {
    const cell = box.closest("th, td");
    if (cell && cell.rowSpan > 1) return;
    box.style.minHeight = px;
    box.style.height = px;
  });
}

function pairRowsByKey(leftList, rightList) {
  const left = Array.from(leftList || []);
  const right = Array.from(rightList || []);
  const rightByKey = new Map();
  right.forEach((tr, i) => {
    const k = tr.getAttribute("data-row-key") || `__i${i}`;
    rightByKey.set(k, tr);
  });
  const used = new Set();
  const pairs = [];
  left.forEach((lr, i) => {
    const k = lr.getAttribute("data-row-key") || `__i${i}`;
    const rr = rightByKey.get(k) || right[i];
    if (!rr || used.has(rr)) return;
    used.add(rr);
    pairs.push([lr, rr]);
  });
  return pairs;
}

/**
 * Ánh xạ chiều cao từng hàng trang 1 ↔ trang 2: cùng key thì cùng cao (max hai bên).
 */
export function syncSpreadRowHeights(spreadEl) {
  if (!spreadEl) return;
  const s = rowHeightScaleFromEl(spreadEl);

  const syncPairs = (leftRows, rightRows, floorFor) => {
    const pairs = pairRowsByKey(leftRows, rightRows);
    pairs.forEach(([lr, rr]) => {
      clearRowForceHeight(lr);
      clearRowForceHeight(rr);
    });
    pairs.forEach(([lr, rr]) => {
      const floor = typeof floorFor === "function" ? floorFor(lr, s) : 0;
      const forceSign =
        lr.classList.contains("nhatky-print-row--sign-pair") ||
        lr.classList.contains("nhatky-print-row--sign-hat") ||
        lr.classList.contains("nhatky-print-row--sign-tuan");
      const isHead = Boolean(lr.closest("thead"));
      let h = Math.max(rowLayoutH(lr), rowLayoutH(rr), floor);
      if (!(h > 0)) return;
      if (!forceSign && !isHead) h = scaleBodyPx(h, s);
      applyRowHeight(lr, h);
      applyRowHeight(rr, h);
    });
    // Lần 2: lấy max hai bên sau khi đã gán — giữ hệ số chiều cao hàng.
    pairs.forEach(([lr, rr]) => {
      const h = Math.max(
        Math.ceil(lr.getBoundingClientRect().height || 0),
        Math.ceil(rr.getBoundingClientRect().height || 0)
      );
      if (!(h > 0)) return;
      applyRowHeight(lr, h);
      applyRowHeight(rr, h);
    });
  };

  syncPairs(
    spreadEl.querySelectorAll(".nhatky-print-page--left thead tr"),
    spreadEl.querySelectorAll(".nhatky-print-page--right thead tr")
  );

  syncPairs(
    spreadEl.querySelectorAll(".nhatky-print-page--left tbody tr"),
    spreadEl.querySelectorAll(".nhatky-print-page--right tbody tr"),
    (lr, scale) => {
      const forceGap =
        lr.classList.contains("nhatky-print-row--sign-gap") ||
        lr.classList.contains("nhatky-print-row--filler") ||
        lr.getAttribute("data-sign-gap") === "1";
      if (isSignRowEl(lr)) return SIGN_CELL_PX;
      if (forceGap) return scaleBodyPx(NORMAL_ROW_PX, scale);
      return 0;
    }
  );
}

export function layoutSpreadForPrint(spreadEl) {
  syncSpreadRowHeights(spreadEl);
}

function PrintHalfPage({
  side,
  cols,
  layout,
  margins,
  widths,
  showGuides,
  onMarginsChange,
  signTuanDuong = "",
  signHatTruong = "",
  signHatRole = "Hạt trưởng",
  rowHeightScale = 1,
  showFolio = false
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
      {showFolio ? <div className="nk-print-folio" aria-hidden="true" /> : null}
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
          <tr className="nhatky-print-head-main" data-row-key="head-main">
            {cols.map((c) => (
              <th key={c.key}>
                <CellBox>{c.header}</CellBox>
              </th>
            ))}
          </tr>
          <tr className="nhatky-print-head-num" data-row-key="head-num">
            {cols.map((c) => (
              <th key={c.key}>
                <CellBox>({c.num})</CellBox>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {renderLayoutRows(
            side,
            layout,
            cols,
            widths,
            signTuanDuong,
            signHatTruong,
            signHatRole,
            rowHeightScale
          )}
        </tbody>
      </table>
    </section>
  );
}

function PrintSpread({
  sheetIndex,
  layout,
  margins,
  widths,
  showGuides,
  onMarginsChange,
  signTuanDuong,
  signHatTruong,
  signHatRole,
  rowHeightScale = 1,
  showFolio = false
}) {
  return (
    <div
      className="nhatky-print-spread"
      data-print-spread={sheetIndex + 1}
      data-row-height-scale={clampRowHeightScale(rowHeightScale)}
      style={{ ["--nk-row-scale"]: String(clampRowHeightScale(rowHeightScale)) }}
    >
      <PrintHalfPage
        side="left"
        cols={LEFT_COLS}
        layout={layout}
        margins={margins}
        widths={widths}
        showGuides={showGuides}
        onMarginsChange={onMarginsChange}
        signTuanDuong={signTuanDuong}
        signHatTruong={signHatTruong}
        signHatRole={signHatRole}
        rowHeightScale={rowHeightScale}
        showFolio={showFolio}
      />
      <PrintHalfPage
        side="right"
        cols={RIGHT_COLS}
        layout={layout}
        margins={margins}
        widths={widths}
        showGuides={false}
        onMarginsChange={undefined}
        signTuanDuong={signTuanDuong}
        signHatTruong={signHatTruong}
        signHatRole={signHatRole}
        rowHeightScale={rowHeightScale}
        showFolio={showFolio}
      />
    </div>
  );
}

export default function NhatKyPrintDay({
  date,
  items,
  dayMeta,
  margins = { top: 8, right: 8, bottom: 8, left: 8 },
  onMarginsChange,
  widths: widthsProp,
  signTuanDuong = "",
  signHatTruong = "",
  signHatRole = "Hạt trưởng",
  rowHeightScale = 1,
  preciseBreak = true,
  showFolio = false
}) {
  const widths = widthsProp || getNhatKyColWidths();
  const dayRef = useRef(null);
  const rempackPassRef = useRef(0);
  const [measure, setMeasure] = useState({ sig: "", map: null });
  const { catalogRoad, routesViewMode, activeRouteId, titleRouteIds } =
    useRoadWorkspace();

  const locationCtx = useMemo(() => {
    const viewOpts = { routesViewMode, activeRouteId, titleRouteIds };
    return {
      mergedMulti: isMergedMultiRouteView(catalogRoad, viewOpts),
      catalogRoad,
      viewOpts
    };
  }, [catalogRoad, routesViewMode, activeRouteId, titleRouteIds]);

  const rows = useMemo(
    () => buildNhatKyPrintRows(date, items, dayMeta, locationCtx),
    [date, items, dayMeta, locationCtx]
  );

  const formulaMax = bodyMaxPx(margins);
  const heightScale = clampRowHeightScale(rowHeightScale);
  const packSig = `${date}|${formulaMax}|${heightScale}|${(rows || []).map((r) => r.key).join("|")}`;
  const packSigRef = useRef(packSig);
  const heightByKey = measure.sig === packSig ? measure.map : null;
  const packed = useMemo(
    () => packRowsForA4(rows, formulaMax, 0, widths, heightByKey, heightScale),
    [rows, formulaMax, widths, heightByKey, heightScale]
  );
  const chunks = packed;

  useLayoutEffect(() => {
    const el = dayRef.current;
    if (!el) return undefined;
    if (packSigRef.current !== packSig) {
      packSigRef.current = packSig;
      rempackPassRef.current = 0;
    }
    const spreads = el.querySelectorAll(".nhatky-print-spread");
    spreads.forEach((spread) => {
      syncSpreadRowHeights(spread);
    });
    if (!preciseBreak) {
      el.setAttribute("data-nk-layout-ready", "1");
      return undefined;
    }
    const measured = collectMeasuredHeights(el);
    if (
      rempackPassRef.current < 2 &&
      Object.keys(measured).length > 0 &&
      heightsMapsDiffer(heightByKey, measured)
    ) {
      rempackPassRef.current += 1;
      el.setAttribute("data-nk-layout-ready", "0");
      setMeasure({ sig: packSig, map: measured });
      return undefined;
    }
    el.setAttribute("data-nk-layout-ready", "1");
    return undefined;
  }, [
    packed,
    preciseBreak,
    packSig,
    widths,
    heightByKey,
    heightScale,
    signTuanDuong,
    signHatTruong,
    signHatRole,
    formulaMax
  ]);

  return (
    <div
      className="nhatky-print-day"
      data-print-date={date}
      data-row-height-scale={heightScale}
      style={{ ["--nk-row-scale"]: String(heightScale) }}
      ref={dayRef}
    >
      {chunks.map((chunk, sheetIndex) => {
        const layout = buildSyncedLayout(chunk);
        return (
          <PrintSpread
            key={`${date}-spread-${sheetIndex}-${chunk[0]?.key || "x"}-${chunk.length}-${chunk[chunk.length - 1]?.key || "y"}`}
            sheetIndex={sheetIndex}
            layout={layout}
            margins={margins}
            widths={widths}
            showGuides={sheetIndex === 0}
            onMarginsChange={onMarginsChange}
            signTuanDuong={signTuanDuong}
            signHatTruong={signHatTruong}
            signHatRole={signHatRole}
            rowHeightScale={heightScale}
            showFolio={showFolio}
          />
        );
      })}
    </div>
  );
}
