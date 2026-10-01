import { printViaIframe } from "./printViaIframe";
import {
  buildNghiemThuDiaDiem,
  buildNghiemThuDoiTuong,
  formatNghiemThuPlaceDate,
  formatNghiemThuDanhXung,
  listNghiemThuCanCu
} from "./nghiemThuFormat";

/** Lề biên bản NT — khớp preview. */
export const NT_PAGE = {
  wMm: 210,
  hMm: 297,
  padTopMm: 22.2,
  padRightMm: 14,
  padBottomMm: 15.6,
  padLeftMm: 30.8
};

export const NT_DEFAULT_MARGINS = {
  top: NT_PAGE.padTopMm,
  right: NT_PAGE.padRightMm,
  bottom: NT_PAGE.padBottomMm,
  left: NT_PAGE.padLeftMm
};

export function resolveNtMargins(margins) {
  const m = margins && typeof margins === "object" ? margins : {};
  return {
    top: Number.isFinite(Number(m.top)) ? Number(m.top) : NT_DEFAULT_MARGINS.top,
    right: Number.isFinite(Number(m.right))
      ? Number(m.right)
      : NT_DEFAULT_MARGINS.right,
    bottom: Number.isFinite(Number(m.bottom))
      ? Number(m.bottom)
      : NT_DEFAULT_MARGINS.bottom,
    left: Number.isFinite(Number(m.left)) ? Number(m.left) : NT_DEFAULT_MARGINS.left
  };
}

/** Chừa chỗ số trang + sai số đo (tránh cắt giữa hàng). */
const SAFETY_MM = 2;

function mmToPx(mm) {
  return (Number(mm) * 96) / 25.4;
}

/** CSS in A4 dọc — cỡ chữ khớp bản xem trước. */
export function buildNghiemThuPrintCss(margins) {
  const P = NT_PAGE;
  const m = resolveNtMargins(margins);
  return `
@page { size: A4 portrait; margin: 0; }
* { box-sizing: border-box; }
html, body {
  margin: 0; padding: 0; background: #fff; color: #000;
  font-family: "Times New Roman", Times, serif;
  font-size: 12.5pt; line-height: 1.25;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.sheet {
  width: ${P.wMm}mm;
  height: ${P.hMm}mm;
  max-height: ${P.hMm}mm;
  min-height: ${P.hMm}mm;
  padding: ${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm;
  overflow: hidden;
  position: relative;
  page-break-after: always;
  break-after: page;
  page-break-inside: avoid;
  break-inside: avoid;
  box-sizing: border-box;
}
.sheet:last-child { page-break-after: auto; break-after: auto; }
.sheet-body {
  width: 100%;
  overflow: visible;
}
.nt-nation { text-align: center; font-weight: 700; text-transform: uppercase; font-size: 12.5pt; }
.nt-motto {
  text-align: center; font-weight: 700; font-style: normal;
  text-decoration: underline; text-underline-offset: calc(3px + 1mm);
  margin-bottom: 5px; font-size: 12.5pt;
}
.nt-place-date { text-align: right; font-style: italic; margin: 7px 0 10px; font-size: 12.5pt; }
.nt-title {
  text-align: center; font-weight: 700; text-transform: uppercase;
  margin: 3px 0 2px; font-size: 12.5pt;
}
.nt-subtitle {
  text-align: center; font-weight: 700; text-transform: uppercase;
  margin: 3px 0 10px; font-size: 12.5pt;
}
.nt-p { margin: 4px 0; text-align: justify; font-size: 12.5pt; line-height: 1.23; }
.nt-p strong { font-weight: 700; }
.nt-can-cu {
  margin: 5px 0 10px 0;
  padding: 0;
  list-style: none;
}
.nt-can-cu li { margin: 4px 0; padding-left: 1.15em; text-align: justify; font-size: 12.5pt; line-height: 1.23; position: relative; }
.nt-can-cu li::before { content: "-"; position: absolute; left: 0; }
.nt-person-line {
  display: grid;
  grid-template-columns: 9.5cm 1fr;
  column-gap: 0.4cm;
  align-items: baseline;
  text-align: left;
  padding: 1px 0;
}
.nt-person-name { min-width: 0; }
.nt-person-role { min-width: 0; }
.nt-table {
  width: 100%; border-collapse: collapse; table-layout: fixed;
  margin: 2px 0 3px; font-size: 12.5pt; line-height: 1.2;
}
.nt-table--continued {
  margin-top: 2px;
}
.nt-table th, .nt-table td {
  border: 0.5pt solid #000; padding: 1px 3px; vertical-align: middle;
  text-align: left !important;
  font-size: 12.5pt;
}
.nt-table th { text-align: center !important; font-weight: 700; background: #f3f4f6; }
.nt-table .num { text-align: center !important; width: 28px; }
.nt-table .nt-qty { text-align: left !important; }
.nt-table .sec-row td { font-weight: 700; background: #f8fafc; }
.nt-table--ql { margin: 7px 0 3px; line-height: 1.23; }
.nt-table--ql th, .nt-table--ql td { padding: 4px 3px; }
.nt-table thead { display: table-header-group; }
.nt-table tr { break-inside: avoid; page-break-inside: avoid; }
.nt-sign {
  display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
  margin-top: 18px; text-align: center; font-size: 12.5pt;
}
.nt-sign-role { font-weight: 700; text-transform: uppercase; }
.nt-sign-space { height: 25.92mm; }
.nt-sign-name { font-weight: 700; }
.nt-closing { page-break-inside: avoid; break-inside: avoid; }
.nt-pre { margin: 0; white-space: pre-wrap; font-family: inherit; font-size: inherit; text-align: left !important; }
`;
}

/** CSS đo — cùng rule với bản in (không absolute page-num). */
function buildMeasureCss(margins) {
  return buildNghiemThuPrintCss(margins)
    .replace(/\.sheet\s*\{[^}]+\}/g, "")
    .replace(/\.sheet:last-child[^}]+\}/g, "");
}

function prepareSheetClone(sheetEl) {
  const clone = sheetEl.cloneNode(true);
  const srcAreas = sheetEl.querySelectorAll("textarea.nt-inline-edit, textarea.nt-cell-edit");
  clone.querySelectorAll("textarea.nt-inline-edit, textarea.nt-cell-edit").forEach((ta, i) => {
    const span = document.createElement("span");
    span.className = ta.classList.contains("nt-cell-edit") ? "nt-pre" : "";
    span.style.whiteSpace = "pre-wrap";
    span.textContent = srcAreas[i]?.value || ta.value || "…";
    ta.replaceWith(span);
  });
  clone.querySelectorAll(".nt-page-num, .no-print, .nhatky-margin-guides").forEach((n) => n.remove());
  return clone;
}

function createMeasureHost(margins) {
  const P = NT_PAGE;
  const m = resolveNtMargins(margins);
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = [
    "position:fixed",
    "left:-14000px",
    "top:0",
    `width:${P.wMm - m.left - m.right}mm`,
    "pointer-events:none",
    "visibility:hidden",
    "z-index:-1"
  ].join(";");

  const style = document.createElement("style");
  style.textContent = buildMeasureCss(margins);
  host.appendChild(style);

  const frame = document.createElement("div");
  frame.className = "nt-measure-frame";
  frame.style.cssText = "width:100%;";
  host.appendChild(frame);

  document.body.appendChild(host);
  return { host, frame };
}

/** Đo chiều cao thực khi ghép các block vào 1 trang. */
function measureBlocks(frame, blocks) {
  frame.innerHTML = "";
  const body = document.createElement("div");
  body.className = "sheet-body";
  blocks.forEach((b) => body.appendChild(b.cloneNode(true)));
  frame.appendChild(body);
  const h = body.getBoundingClientRect().height;
  frame.innerHTML = "";
  return h;
}

function isTable(el) {
  return el?.tagName === "TABLE";
}

function tableBodyRows(table) {
  return Array.from(table?.querySelectorAll("tbody > tr") || []);
}

function flattenNtBlocks(nodes) {
  const out = [];
  for (const n of nodes) {
    if (n.nodeType !== 1) continue;
    if (n.classList.contains("nt-page-num")) continue;
    if (n.classList.contains("nt-vol-sec")) {
      for (const c of n.children) {
        if (c.nodeType === 1) out.push(c);
      }
    } else {
      out.push(n);
    }
  }
  return out;
}

function ntBlockKind(el) {
  if (!el || el.nodeType !== 1) return "other";
  if (el.classList.contains("nt-sign")) return "sign";
  if (el.classList.contains("nt-vol-sec-title")) return "volTitle";
  if (el.tagName === "TABLE") return "table";
  const label = (
    el.querySelector?.("strong, .nt-inline-label")?.textContent ||
    el.textContent ||
    ""
  )
    .replace(/\s+/g, " ")
    .trim();
  if (/^7[.)\s]/.test(label)) return "item7";
  if (/^8[.)\s]/.test(label)) return "item8";
  return "other";
}

function makeTableChunk(sourceTable, rows, { continued = false } = {}) {
  const t = document.createElement("table");
  t.className = sourceTable.className;
  if (continued) t.classList.add("nt-table--continued");
  const colgroup = sourceTable.querySelector("colgroup");
  const thead = sourceTable.querySelector("thead");
  if (colgroup) t.appendChild(colgroup.cloneNode(true));
  // Trang tiếp cũng lặp tiêu đề cột (giống Word tableHeader).
  if (thead) t.appendChild(thead.cloneNode(true));
  const tb = document.createElement("tbody");
  rows.forEach((r) => tb.appendChild(r.cloneNode(true)));
  t.appendChild(tb);
  return t;
}

function countPageDataRows(page) {
  let n = 0;
  for (const b of page) {
    if (isTable(b)) n += tableBodyRows(b).length;
  }
  return n;
}

/** Cắt hàng dữ liệu cuối (kèm tiêu đề mục nếu hàng đó là hàng duy nhất). */
function takeLastRowGroup(page) {
  for (let i = page.length - 1; i >= 0; i--) {
    const b = page[i];
    if (!isTable(b)) continue;
    const rows = tableBodyRows(b);
    if (!rows.length) continue;
    const continued = b.classList.contains("nt-table--continued");
    if (rows.length === 1) {
      const group = page.splice(i, 1);
      if (i > 0 && ntBlockKind(page[i - 1]) === "volTitle") {
        group.unshift(page.splice(i - 1, 1)[0]);
      }
      return group;
    }
    page[i] = makeTableChunk(b, rows.slice(0, -1), { continued });
    return [makeTableChunk(b, [rows[rows.length - 1]], { continued: true })];
  }
  return [];
}

function putRowGroupBack(page, group) {
  if (!group.length) return;
  const last = page[page.length - 1];
  const first = group[0];
  if (isTable(last) && isTable(first) && group.length === 1) {
    const continued = last.classList.contains("nt-table--continued");
    page[page.length - 1] = makeTableChunk(last, [
      ...tableBodyRows(last),
      ...tableBodyRows(first)
    ], { continued });
    return;
  }
  page.push(...group);
}

/**
 * Chữ ký sang tờ mới → kéo theo mục 7, 8 và 1 hàng dữ liệu (tránh tờ cuối trống).
 */
function keepNtFooterTogether(pages, frame, budgetPx) {
  if (pages.length < 2) return;
  let signIdx = -1;
  for (let i = pages.length - 1; i >= 0; i--) {
    if (pages[i].some((b) => ntBlockKind(b) === "sign")) {
      signIdx = i;
      break;
    }
  }
  if (signIdx < 0) return;

  for (let i = signIdx - 1; i >= 0; i--) {
    const page = pages[i];
    while (page.length) {
      const kind = ntBlockKind(page[page.length - 1]);
      if (kind === "item7" || kind === "item8") {
        pages[signIdx].unshift(page.pop());
      } else break;
    }
  }

  if (countPageDataRows(pages[signIdx]) < 1) {
    for (let i = signIdx - 1; i >= 0; i--) {
      const stolen = takeLastRowGroup(pages[i]);
      if (!stolen.length) continue;
      const trial = [...stolen, ...pages[signIdx]];
      if (measureBlocks(frame, trial) <= budgetPx + 0.5) {
        pages[signIdx] = trial;
        break;
      }
      putRowGroupBack(pages[i], stolen);
      break;
    }
  }

  for (let i = pages.length - 1; i >= 0; i--) {
    if (!pages[i].length) pages.splice(i, 1);
  }
}

/**
 * Tách 1 tờ dài thành nhiều trang A4 dọc — cắt đúng biên hàng bảng.
 */
function paginateNghiemThuSheet(sheetEl, margins) {
  const P = NT_PAGE;
  const m = resolveNtMargins(margins);
  const budgetPx = mmToPx(P.hMm - m.top - m.bottom - SAFETY_MM);
  const prepared = prepareSheetClone(sheetEl);
  const blocks = flattenNtBlocks(prepared.children);

  const { host, frame } = createMeasureHost(margins);
  const pages = [];
  let current = [];

  function flush() {
    if (!current.length) return;
    pages.push(current);
    current = [];
  }

  function fits(extraBlocks) {
    return measureBlocks(frame, [...current, ...extraBlocks]) <= budgetPx + 0.5;
  }

  function packTable(block) {
    const bodyRows = tableBodyRows(block);
    if (!bodyRows.length) {
      if (current.length && !fits([block])) flush();
      current.push(block);
      return;
    }

    let start = 0;
    /** Chỉ số hàng đầu của chunk bảng trên trang hiện tại (cùng `block`). */
    let lastChunkStart = -1;

    while (start < bodyRows.length) {
      let lo = start + 1;
      let hi = bodyRows.length;
      let best = start;
      const extendExisting =
        lastChunkStart >= 0 &&
        current.length > 0 &&
        isTable(current[current.length - 1]);

      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        let ok;
        if (extendExisting) {
          const combined = makeTableChunk(
            block,
            bodyRows.slice(lastChunkStart, mid),
            { continued: lastChunkStart > 0 }
          );
          ok =
            measureBlocks(frame, [...current.slice(0, -1), combined]) <=
            budgetPx + 0.5;
        } else {
          const chunk = makeTableChunk(block, bodyRows.slice(start, mid), {
            continued: start > 0
          });
          ok = fits([chunk]);
        }
        if (ok) {
          best = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }

      if (best === start) {
        if (current.length) {
          const forced = extendExisting
            ? makeTableChunk(block, bodyRows.slice(lastChunkStart, start + 1), {
                continued: lastChunkStart > 0
              })
            : makeTableChunk(block, bodyRows.slice(start, start + 1), {
                continued: start > 0
              });
          const forcedBlocks = extendExisting
            ? [...current.slice(0, -1), forced]
            : [...current, forced];
          if (measureBlocks(frame, forcedBlocks) <= budgetPx + 0.5) {
            if (extendExisting) current.pop();
            current.push(forced);
            if (!extendExisting) lastChunkStart = start;
            start += 1;
            continue;
          }
          if (ntBlockKind(current[current.length - 1]) === "volTitle") {
            const title = current.pop();
            flush();
            current.push(title);
            lastChunkStart = -1;
            continue;
          }
          flush();
          lastChunkStart = -1;
          continue;
        }
        best = start + 1;
      }

      if (extendExisting) {
        current.pop();
        current.push(
          makeTableChunk(block, bodyRows.slice(lastChunkStart, best), {
            continued: lastChunkStart > 0
          })
        );
        start = best;
        continue;
      }

      lastChunkStart = start;
      current.push(
        makeTableChunk(block, bodyRows.slice(start, best), {
          continued: start > 0
        })
      );
      start = best;
    }
  }

  try {
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const kind = ntBlockKind(block);

      if (kind === "item7") {
        const footer = blocks.slice(i);
        if (current.length && !fits(footer)) flush();
        if (current.length && !fits(footer)) flush();
        footer.forEach((b) => current.push(b));
        break;
      }

      if (isTable(block)) {
        packTable(block);
        continue;
      }

      if (kind === "volTitle") {
        const next = blocks[i + 1];
        if (isTable(next)) {
          const rows = tableBodyRows(next);
          if (rows.length) {
            const first = makeTableChunk(next, [rows[0]], { continued: false });
            if (current.length && !fits([block, first])) flush();
          }
        }
      }

      if (current.length && !fits([block])) flush();
      current.push(block);
    }
    flush();
    keepNtFooterTogether(pages, frame, budgetPx);
  } finally {
    host.remove();
  }

  if (!pages.length) pages.push([]);
  return pages;
}

function pagesToHtml(pages) {
  return pages
    .map((blocks) => {
      const body = blocks.map((b) => b.outerHTML).join("\n");
      return `<div class="sheet"><div class="sheet-body">${body}</div></div>`;
    })
    .join("\n");
}

export function printNghiemThuPages(margins) {
  const root = document.querySelector(".nghiemthu-print-stack");
  if (!root) {
    window.alert("Chưa có bản xem trước để in.");
    return;
  }
  const sheets = [...root.querySelectorAll(".nghiemthu-sheet")];
  if (!sheets.length) {
    window.alert("Chưa có tờ biên bản để in.");
    return;
  }

  const allPages = [];
  sheets.forEach((sheet) => {
    const pages = paginateNghiemThuSheet(sheet, margins);
    if (pages.length) allPages.push(...pages);
    else allPages.push([]);
  });

  const sheetsHtml = pagesToHtml(allPages);

  printViaIframe({
    title: "",
    blankDocumentTitle: true,
    css: buildNghiemThuPrintCss(margins),
    sheetsHtml,
    pageWMm: NT_PAGE.wMm,
    pageHMm: NT_PAGE.hMm
  });
}

function escNt(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function nlNt(s) {
  return escNt(s).replace(/\n/g, "<br/>");
}

/** CSS khoảng dài — chảy trang, không đo DOM từng tờ. */
export function buildNghiemThuRangePrintCss(margins) {
  const m = resolveNtMargins(margins);
  return `
@page { size: A4 portrait; margin: ${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm; }
* { box-sizing: border-box; }
html, body {
  margin: 0; padding: 0; background: #fff; color: #000;
  font-family: "Times New Roman", Times, serif;
  font-size: 12.5pt; line-height: 1.25;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.nt-report { page-break-after: always; break-after: page; }
.nt-report:last-child { page-break-after: auto; break-after: auto; }
.nt-nation { text-align: center; font-weight: 700; text-transform: uppercase; font-size: 12.5pt; }
.nt-motto {
  text-align: center; font-weight: 700; font-style: normal;
  text-decoration: underline; text-underline-offset: calc(3px + 1mm);
  margin-bottom: 5px; font-size: 12.5pt;
}
.nt-place-date { text-align: right; font-style: italic; margin: 7px 0 10px; font-size: 12.5pt; }
.nt-title {
  text-align: center; font-weight: 700; text-transform: uppercase;
  margin: 3px 0 2px; font-size: 12.5pt;
}
.nt-subtitle {
  text-align: center; font-weight: 700; text-transform: uppercase;
  margin: 3px 0 10px; font-size: 12.5pt;
}
.nt-p { margin: 4px 0; text-align: justify; font-size: 12.5pt; line-height: 1.23; }
.nt-p strong { font-weight: 700; }
.nt-can-cu {
  margin: 5px 0 10px 0;
  padding: 0;
  list-style: none;
}
.nt-can-cu li { margin: 4px 0; padding-left: 1.15em; text-align: justify; font-size: 12.5pt; line-height: 1.23; position: relative; }
.nt-can-cu li::before { content: "-"; position: absolute; left: 0; }
.nt-person-line {
  display: grid;
  grid-template-columns: 9.5cm 1fr;
  column-gap: 0.4cm;
  align-items: baseline;
  text-align: left;
  padding: 1px 0;
}
.nt-person-name { min-width: 0; }
.nt-person-role { min-width: 0; }
.nt-table {
  width: 100%; border-collapse: collapse; table-layout: fixed;
  margin: 2px 0 3px; font-size: 12.5pt; line-height: 1.2;
}
.nt-table th, .nt-table td {
  border: 0.5pt solid #000; padding: 1px 3px; vertical-align: middle;
  text-align: left !important;
  font-size: 12.5pt;
}
.nt-table th { text-align: center !important; font-weight: 700; background: #f3f4f6; }
.nt-table .num { text-align: center !important; width: 28px; }
.nt-table .nt-qty { text-align: left !important; }
.nt-table .sec-row td { font-weight: 700; background: #f8fafc; }
.nt-table--ql { margin: 7px 0 3px; line-height: 1.23; }
.nt-table--ql th, .nt-table--ql td { padding: 4px 3px; }
.nt-table thead { display: table-header-group; }
.nt-table tr { break-inside: avoid; page-break-inside: avoid; }
.nt-sign {
  display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
  margin-top: 18px; text-align: center; font-size: 12.5pt;
}
.nt-sign-role { font-weight: 700; text-transform: uppercase; }
.nt-sign-space { height: 25.92mm; }
.nt-sign-name { font-weight: 700; }
.nt-closing { page-break-inside: avoid; break-inside: avoid; }
`;
}

export function reportToNghiemThuPrintHtml(report) {
  const meta = report?.meta || {};
  const road = report?.road;
  const placeDate = formatNghiemThuPlaceDate(report?.date);
  const doiTuong = meta.doiTuong || buildNghiemThuDoiTuong(road);
  const diaDiem = meta.diaDiem || buildNghiemThuDiaDiem(road);
  const canCuItems = listNghiemThuCanCu(meta, road);
  const qlRows = Array.isArray(report?.qlRows) ? report.qlRows : [];
  const sections = Array.isArray(report?.volumeSections) ? report.volumeSections : [];

  const qlBody = qlRows
    .map(
      (r) => `<tr>
      <td class="num" style="text-align:center">${escNt(r.stt)}</td>
      <td style="text-align:left">${escNt(r.hangMuc)}</td>
      <td style="text-align:left">${escNt(r.noiDung)}</td>
      <td style="text-align:left">${nlNt(r.mucDo)}</td>
    </tr>`
    )
    .join("");

  let volHtml;
  if (!sections.length) {
    volHtml =
      '<p class="nt-p nt-muted">Chưa có khối lượng BDTX trong ngày để nghiệm thu (mục 6.2).</p>';
  } else {
    const volBody = sections
      .map((sec) => {
        const head = `<tr class="sec-row"><td class="num" style="text-align:center">${escNt(sec.key)}</td><td colspan="4" style="text-align:left">${escNt(sec.title)}</td></tr>`;
        const rows = (sec.rows || [])
          .map(
            (r) => `<tr>
            <td class="num" style="text-align:center">${escNt(r.stt)}</td>
            <td style="text-align:left">${escNt(r.hangMuc)}</td>
            <td style="text-align:left">${escNt(r.lyTrinh)}</td>
            <td class="nt-qty" style="text-align:left">${escNt(r.khoiLuong)}</td>
            <td style="text-align:left">${nlNt(r.mucDo)}</td>
          </tr>`
          )
          .join("");
        return head + rows;
      })
      .join("");
    volHtml = `<table class="nt-table nt-table--vol">
      <colgroup>
        <col style="width:6%" /><col style="width:21%" /><col style="width:19%" />
        <col style="width:14%" /><col style="width:40%" />
      </colgroup>
      <thead><tr>
        <th>STT</th><th>Hạng mục</th><th>Lý trình nghiệm thu</th>
        <th>Khối lượng nghiệm thu</th><th>Mức độ đáp ứng</th>
      </tr></thead>
      <tbody>${volBody}</tbody>
    </table>`;
  }

  return `
    <div class="nt-nation">CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
    <div class="nt-motto">Độc lập - Tự do - Hạnh phúc</div>
    <div class="nt-place-date">${escNt(placeDate)}</div>
    <h1 class="nt-title">BIÊN BẢN NGHIỆM THU</h1>
    <h2 class="nt-subtitle">CÔNG VIỆC THỰC HIỆN QL, BDTX THEO TIÊU CHÍ CHẤT LƯỢNG</h2>
    <p class="nt-p"><strong>Gói thầu:</strong> ${nlNt(meta.goiThau || "…")}</p>
    <p class="nt-p"><strong>1. Đối tượng nghiệm thu:</strong> ${escNt(doiTuong)}</p>
    <p class="nt-p"><strong>2. Thành phần trực tiếp nghiệm thu:</strong></p>
    <p class="nt-p">2.1 Ban Quản lý bảo trì đường bộ</p>
    <p class="nt-p nt-person-line">
      <span class="nt-person-name">+ ${escNt(formatNghiemThuDanhXung(meta.banQlbtDanhXung))}: ${escNt(meta.banQlbtTen || "…")}</span>
      <span class="nt-person-role">Chức vụ: ${escNt(meta.banQlbtChucVu || "…")}</span>
    </p>
    <p class="nt-p">2.2 Nhà thầu thực hiện QL, BDTX: ${escNt(meta.nhaThauDonVi || "…")}</p>
    <p class="nt-p nt-person-line">
      <span class="nt-person-name">+ ${escNt(formatNghiemThuDanhXung(meta.nhaThauDanhXung))}: ${escNt(meta.nhaThauTen || "…")}</span>
      <span class="nt-person-role">Chức vụ: ${escNt(meta.nhaThauChucVu || "…")}</span>
    </p>
    <p class="nt-p"><strong>3. Thời gian nghiệm thu:</strong> ${escNt(meta.thoiGian || "…")}</p>
    <p class="nt-p"><strong>4. Địa điểm nghiệm thu:</strong> ${escNt(diaDiem)}</p>
    <p class="nt-p"><strong>5. Căn cứ nghiệm thu:</strong></p>
    <ul class="nt-can-cu">${canCuItems.map((line) => `<li>${escNt(line)}</li>`).join("")}</ul>
    <p class="nt-p"><strong>6. Về khối lượng, chất lượng thực hiện:</strong></p>
    <p class="nt-p"><strong>6.1. Công tác quản lý</strong></p>
    <table class="nt-table nt-table--ql">
      <colgroup>
        <col style="width:8%" /><col style="width:22%" />
        <col style="width:30%" /><col style="width:40%" />
      </colgroup>
      <thead><tr>
        <th>STT</th><th>Hạng mục</th>
        <th>Nội dung kiểm tra nghiệm thu</th><th>Mức độ đáp ứng</th>
      </tr></thead>
      <tbody>${qlBody}</tbody>
    </table>
    <p class="nt-p"><strong>6.2. Công tác khác</strong></p>
    ${volHtml}
    <div class="nt-closing">
    <p class="nt-p"><strong>7. Các ý kiến khác:</strong> ${nlNt(meta.yKienKhac || "Không")}</p>
    <p class="nt-p"><strong>8. Kết luận:</strong> ${nlNt(
      meta.ketLuan ||
        "Đồng ý nghiệm thu khối lượng thực hiện hoàn thành nêu trên."
    )}</p>
    <div class="nt-sign">
      <div>
        <div class="nt-sign-role">NHÀ THẦU QL, BDTX</div>
        <div class="nt-sign-space" aria-hidden="true"></div>
        <div class="nt-sign-name">${escNt(meta.signNhaThau || meta.nhaThauTen || "")}</div>
      </div>
      <div>
        <div class="nt-sign-role">BAN QLBT ĐƯỜNG BỘ</div>
        <div class="nt-sign-space" aria-hidden="true"></div>
        <div class="nt-sign-name">${escNt(meta.signBanQlbt || meta.banQlbtTen || "")}</div>
      </div>
    </div>
    </div>`;
}

/** In khoảng ngày: HTML từ dữ liệu, không mount React / đo từng tờ. */
export async function printNghiemThuReports(reports, margins, opts = {}) {
  const list = Array.isArray(reports) ? reports.filter(Boolean) : [];
  if (!list.length) {
    window.alert("Chưa có biên bản để in.");
    return;
  }
  const parts = [];
  const yieldEvery = Math.max(1, Number(opts.yieldEvery) || 8);
  for (let i = 0; i < list.length; i++) {
    parts.push(
      `<div class="nt-report">${reportToNghiemThuPrintHtml(list[i])}</div>`
    );
    if ((i + 1) % yieldEvery === 0) {
      opts.onProgress?.({ done: i + 1, total: list.length });
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  opts.onProgress?.({ done: list.length, total: list.length });
  printViaIframe({
    title: "",
    blankDocumentTitle: true,
    css: buildNghiemThuRangePrintCss(margins),
    sheetsHtml: parts.join("\n"),
    pageWMm: NT_PAGE.wMm,
    pageHMm: NT_PAGE.hMm,
    printDelayMs: list.length > 40 ? 600 : 280
  });
}
