import { useLayoutEffect, useMemo, useRef } from "react";
import {
  entryToHanhLangRow,
  formatHanhLangKmLine,
  formatHanhLangMonthTitle,
  computeHanhLangPadRows,
  packHanhLangEditPages,
  getHanhLangCellValue,
  HANH_LANG_SHEET_FIELDS,
  HANH_LANG_SHEET_LAYOUT,
  isHanhLangSheetRowFilled
} from "../utils/hanhLangFormat";
import { HANH_LANG_COLS, useHanhLangColWidths } from "../hooks/useHanhLangColWidths";
import { useRouteViewCtx } from "../hooks/useRouteDisplayBlocks";
import { buildRouteDisplayBlocks } from "../utils/roadsCatalog";
import HanhLangTableHead from "./HanhLangTableHead";
import RouteHeaderRow from "./RouteHeaderRow";

function fitTextarea(el, minPx) {
  if (!el) return;
  el.style.height = "0px";
  el.style.height = `${Math.max(el.scrollHeight, minPx)}px`;
}

/** Ô nhập full ngang ô; cao tối thiểu 1 dòng 12pt, tự giãn khi chữ tăng. */
function EditableCell({ value, onChange, ariaLabel, center, minHeightMm }) {
  const ref = useRef(null);
  const minPx = Math.round(((minHeightMm || HANH_LANG_SHEET_LAYOUT.dataRowMinMm) * 96) / 25.4);

  useLayoutEffect(() => {
    fitTextarea(ref.current, minPx);
  }, [value, minPx]);

  return (
    <textarea
      ref={ref}
      className={`hanh-lang-cell-input${center ? " hanh-lang-cell-input--center" : ""}`}
      rows={1}
      value={value || ""}
      aria-label={ariaLabel}
      style={{ minHeight: `${minHeightMm || HANH_LANG_SHEET_LAYOUT.dataRowMinMm}mm` }}
      onChange={(e) => {
        fitTextarea(e.target, minPx);
        onChange(e.target.value);
      }}
    />
  );
}

function emptyDisplayRows(count, rowHeightMm) {
  return Array.from({ length: count }, (_, i) => (
    <tr key={`empty-${i}`} className="hanh-lang-data-row hanh-lang-data-row--empty">
      {HANH_LANG_COLS.map((col) => (
        <td key={col.key} style={{ height: `${rowHeightMm}mm` }} />
      ))}
    </tr>
  ));
}

function SheetChrome({ reportMeta, yearMonth, children, pageIndex, pageCount, editing }) {
  const kmLine = formatHanhLangKmLine(reportMeta);
  const monthLabel = formatHanhLangMonthTitle(yearMonth);
  return (
    <div
      className={`hanh-lang-sheet hanh-lang-sheet--a4-landscape${
        editing ? " hanh-lang-sheet--editing" : ""
      }`}
    >
      {pageCount > 1 ? (
        <p className="hanh-lang-page-label no-print">
          Tờ {pageIndex + 1}/{pageCount}
        </p>
      ) : null}
      <div className="hanh-lang-sheet-top">
        <div className="hanh-lang-sheet-head">
          <div className="hanh-lang-head-left">
            <div className="hanh-lang-head-line hanh-lang-head-line--company">
              {reportMeta.company}
            </div>
            <div className="hanh-lang-head-line">Tên Hạt: {reportMeta.hat}</div>
            <div className="hanh-lang-head-line">Tên đường: {reportMeta.roadName}</div>
          </div>
          <div className="hanh-lang-head-right">
            <div className="hanh-lang-head-line">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
            <div className="hanh-lang-head-line hanh-lang-motto">Độc lập - Tự do - Hạnh phúc</div>
          </div>
        </div>
        <h1 className="hanh-lang-title">
          TỔNG HỢP VI PHẠM HÀNH LANG AN TOÀN GIAO THÔNG {monthLabel}
        </h1>
        <p className="hanh-lang-km-range">{kmLine || "… đoạn Km… - Km…"}</p>
      </div>
      {children}
    </div>
  );
}

function cellClassName(colKey) {
  if (colKey === "recordDate") return "hanh-lang-col-editable hanh-lang-col-date";
  if (colKey === "content") return "hanh-lang-col-editable hanh-lang-col-content";
  if (colKey === "process") return "hanh-lang-col-editable hanh-lang-col-process";
  return "hanh-lang-col-editable";
}

/**
 * Hàng nhập — key = absIndex cố định để gõ nhiều ký tự không bị unmount/nhảy hàng.
 */
function EditDataRow({
  absIndex,
  entry,
  stt,
  minHeightMm,
  onCellChange,
  emptyLook
}) {
  const filled = isHanhLangSheetRowFilled(entry);
  return (
    <tr
      className={`hanh-lang-data-row hanh-lang-data-row--edit${
        emptyLook || !filled ? " hanh-lang-data-row--empty-edit" : ""
      }`}
      style={{ minHeight: `${minHeightMm}mm` }}
    >
      <td className="hanh-lang-col-tt hanh-lang-col-tt--edit">{stt || ""}</td>
      {HANH_LANG_SHEET_FIELDS.map((col) => (
        <td key={col.key} className={cellClassName(col.key)}>
          <EditableCell
            value={getHanhLangCellValue(entry, col.key)}
            ariaLabel={`${col.label} dòng ${stt || absIndex + 1}`}
            center={col.key === "recordDate"}
            minHeightMm={minHeightMm}
            onChange={(value) => onCellChange(absIndex, col.key, value)}
          />
        </td>
      ))}
    </tr>
  );
}

function EditPage({
  page,
  pageCount,
  yearMonth,
  reportMeta,
  widths,
  startColumnResize,
  onCellChange,
  filledCount,
  allItems,
  sectionHeadingByAbs
}) {
  const rowH = page.rowHeightMm || HANH_LANG_SHEET_LAYOUT.emptyRowMm;

  let bodyRows;
  if (page.isLast) {
    const absIndices = [];
    const seen = new Set();
    page.rows.forEach(({ absIndex }) => {
      if (!seen.has(absIndex)) {
        seen.add(absIndex);
        absIndices.push(absIndex);
      }
    });
    for (let i = 0; i < page.emptyCount; i += 1) {
      const abs = page.emptyAbsStart + i;
      if (abs >= 0 && !seen.has(abs)) {
        seen.add(abs);
        absIndices.push(abs);
      }
    }
    absIndices.sort((a, b) => a - b);

    let stt = page.sttOffset;
    bodyRows = absIndices.flatMap((absIndex) => {
      const entry = allItems[absIndex]?.entry || {};
      const filled = isHanhLangSheetRowFilled(entry);
      const displayTt = filled ? String((stt += 1)) : "";
      const heading = sectionHeadingByAbs?.get(absIndex);
      const nodes = [];
      if (heading) {
        nodes.push(
          <RouteHeaderRow
            key={`hl-hdr-${absIndex}`}
            heading={heading}
            colSpan={HANH_LANG_COLS.length}
          />
        );
      }
      nodes.push(
        <EditDataRow
          key={`hl-abs-${absIndex}`}
          absIndex={absIndex}
          entry={entry}
          stt={displayTt}
          minHeightMm={filled ? HANH_LANG_SHEET_LAYOUT.dataRowMinMm : rowH}
          onCellChange={onCellChange}
          emptyLook={!filled}
        />
      );
      return nodes;
    });
  } else {
    bodyRows = (
      <>
        {page.rows.flatMap(({ item, absIndex }, idx) => {
          const stt = String(page.sttOffset + idx + 1);
          const heading = sectionHeadingByAbs?.get(absIndex);
          const nodes = [];
          if (heading) {
            nodes.push(
              <RouteHeaderRow
                key={`hl-hdr-${absIndex}`}
                heading={heading}
                colSpan={HANH_LANG_COLS.length}
              />
            );
          }
          nodes.push(
            <EditDataRow
              key={`hl-abs-${absIndex}`}
              absIndex={absIndex}
              entry={item.entry}
              stt={stt}
              minHeightMm={HANH_LANG_SHEET_LAYOUT.dataRowMinMm}
              onCellChange={onCellChange}
            />
          );
          return nodes;
        })}
        {Array.from({ length: page.emptyCount }, (_, i) => (
          <tr
            key={`hl-pad-visual-${page.pageIndex}-${i}`}
            className="hanh-lang-data-row hanh-lang-data-row--empty"
          >
            {HANH_LANG_COLS.map((col) => (
              <td key={col.key} style={{ height: `${rowH}mm` }} />
            ))}
          </tr>
        ))}
      </>
    );
  }

  return (
    <SheetChrome
      reportMeta={reportMeta}
      yearMonth={yearMonth}
      pageIndex={page.pageIndex}
      pageCount={pageCount}
      editing
    >
      <div className="hanh-lang-table-area">
        <table className="hanh-lang-table hanh-lang-table--fill">
          <colgroup>
            {HANH_LANG_COLS.map((col) => (
              <col key={col.key} style={{ width: `${widths[col.key]}px` }} />
            ))}
          </colgroup>
          <thead>
            <HanhLangTableHead resizable onResizeStart={startColumnResize} />
          </thead>
          <tbody>
            {bodyRows}
            {page.isLast ? (
              <tr className="hanh-lang-footer-row">
                <td colSpan={2} className="hanh-lang-footer-label">
                  TỔNG CỘNG
                </td>
                <td colSpan={8}>{filledCount > 0 ? filledCount : ""}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </SheetChrome>
  );
}

/** Tổng hợp vi phạm hành lang tháng — 10 cột Phụ lục 05 QL37. */
export default function HanhLangSheet({
  yearMonth,
  reportMeta,
  rowItems = null,
  entries,
  onCellChange,
  margins
}) {
  const { widths, startColumnResize } = useHanhLangColWidths();
  const editable = Boolean(onCellChange);

  const items =
    rowItems ||
    (entries || []).map((entry, idx) => ({
      entry,
      globalIndex: idx,
      draftKey: null
    }));
  // Chế độ read-only (ADMIN/VIEWER) vẫn nhận rowItems từ trang sổ.
  // Trước đây nhánh hiển thị chỉ đọc lại dùng prop entries nên bảng trống,
  // dù dữ liệu và bản xem trước in đã có đầy đủ.
  const displayEntries = rowItems
    ? rowItems
        .map((item) => item?.entry)
        .filter((entry) => isHanhLangSheetRowFilled(entry))
    : entries || [];

  const filledCount = items.filter((item) => isHanhLangSheetRowFilled(item.entry)).length;
  const viewCtx = useRouteViewCtx();
  const filledItems = useMemo(
    () => items.filter((it) => isHanhLangSheetRowFilled(it.entry)),
    [items]
  );
  const emptyItems = useMemo(
    () => items.filter((it) => !isHanhLangSheetRowFilled(it.entry)),
    [items]
  );
  const itemBlocks = useMemo(
    () =>
      buildRouteDisplayBlocks(filledItems, viewCtx.road, viewCtx, {
        orphanLabel: "Vi phạm khác",
        getEntry: (item) => item.entry
      }),
    [filledItems, viewCtx]
  );
  const orderedItems = useMemo(() => {
    const entryItems = itemBlocks.filter((b) => b.kind === "entry").map((b) => b.item);
    return [...entryItems, ...emptyItems];
  }, [itemBlocks, emptyItems]);
  const sectionHeadingByAbs = useMemo(() => {
    const map = new Map();
    orderedItems.forEach((item, absIndex) => {
      const block = itemBlocks.find(
        (b) => b.kind === "entry" && b.item === item && b.isSectionStart
      );
      if (block?.heading) map.set(absIndex, block.heading);
    });
    return map;
  }, [orderedItems, itemBlocks]);
  const blocks = useMemo(
    () =>
      buildRouteDisplayBlocks(displayEntries, viewCtx.road, viewCtx, {
        orphanLabel: "Vi phạm khác"
      }),
    [displayEntries, viewCtx]
  );
  const filledOrdered = useMemo(
    () => blocks.filter((b) => b.kind === "entry").length,
    [blocks]
  );

  if (editable) {
    const pages = packHanhLangEditPages(orderedItems, margins);
    return (
      <div className="hanh-lang-sheet-wrap hanh-lang-sheet-wrap--pages">
        {pages.map((page) => (
          <EditPage
            key={`hl-edit-p${page.pageIndex}`}
            page={page}
            pageCount={pages.length}
            yearMonth={yearMonth}
            reportMeta={reportMeta}
            widths={widths}
            startColumnResize={startColumnResize}
            onCellChange={onCellChange}
            filledCount={filledCount}
            allItems={orderedItems}
            sectionHeadingByAbs={sectionHeadingByAbs}
          />
        ))}
      </div>
    );
  }

  const { count: padCount, rowHeightMm } = computeHanhLangPadRows(displayEntries, margins);
  const dataRows = blocks.map((block) => {
    if (block.kind === "routeHeader") {
      return (
        <RouteHeaderRow
          key={block.key}
          heading={block.heading}
          colSpan={HANH_LANG_COLS.length}
        />
      );
    }
    const r = entryToHanhLangRow(block.entry, Math.max(0, (block.stt || 1) - 1));
    r.tt = block.stt;
    return (
      <tr key={block.key} className="hanh-lang-data-row">
        <td className="hanh-lang-col-tt">{r.tt}</td>
        <td>{r.recorder}</td>
        <td>{r.violator}</td>
        <td>{r.address}</td>
        <td>{r.location}</td>
        <td className="hanh-lang-col-date">{r.recordDate}</td>
        <td className="hanh-lang-col-content">{r.content}</td>
        <td>{r.area}</td>
        <td className="hanh-lang-col-process">{r.process}</td>
        <td>{r.note}</td>
      </tr>
    );
  });

  return (
    <div className="hanh-lang-sheet-wrap">
      <SheetChrome reportMeta={reportMeta} yearMonth={yearMonth} pageIndex={0} pageCount={1}>
        <div className="hanh-lang-table-area">
          <table className="hanh-lang-table hanh-lang-table--fill">
            <colgroup>
              {HANH_LANG_COLS.map((col) => (
                <col key={col.key} style={{ width: `${widths[col.key]}px` }} />
              ))}
            </colgroup>
            <thead>
              <HanhLangTableHead resizable onResizeStart={startColumnResize} />
            </thead>
            <tbody>
              {dataRows}
              {emptyDisplayRows(padCount, rowHeightMm)}
              <tr className="hanh-lang-footer-row">
                <td colSpan={2} className="hanh-lang-footer-label">
                  TỔNG CỘNG
                </td>
                <td colSpan={8}>{filledOrdered > 0 ? filledOrdered : ""}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </SheetChrome>
    </div>
  );
}
