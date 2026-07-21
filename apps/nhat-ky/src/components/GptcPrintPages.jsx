import { useMemo } from "react";
import NhatKyMarginGuides from "./NhatKyMarginGuides";
import GptcSummarySheet from "./GptcSummarySheet";
import {
  GPTC_DETAIL_LAYOUT,
  GPTC_SUMMARY_LAYOUT,
  packGptcDetailPages,
  packGptcSummaryPrintPages
} from "../utils/gptcDetailFormat";
import { normalizeDetailColWidths, isPermitRowFilled } from "../utils/gptcSummaryGrid";
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
      className="gptc-print-page landscape-print-page"
      style={{ ...pad, "--gptc-row-h": `${GPTC_DETAIL_LAYOUT.rowMm}mm` }}
      data-print-page={pageIndex + 1}
    >
      {showGuides && onMarginsChange ? (
        <NhatKyMarginGuides
          margins={margins}
          onChange={onMarginsChange}
          pageWMm={297}
          pageHMm={210}
          minContentMm={100}
        />
      ) : null}
      {pageCount > 1 ? (
        <p className="landscape-print-page-num no-print">
          Tờ {pageIndex + 1}/{pageCount}
          {kicker ? ` · ${kicker}` : ""}
        </p>
      ) : null}
      <div className="gptc-print-inner">{children}</div>
    </section>
  );
}

const COL_LABELS = [
  "Ngày/ tháng/ năm",
  "Diễn biến trong quá trình thi công",
  "Xác nhận, ý kiến chỉ đạo của hạt trưởng",
  "Ý kiến chỉ đạo của tuần kiểm"
];

function formatEntryDate(iso) {
  if (!iso) return "";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(iso)) return iso;
  return formatDisplayDate(iso);
}

/** Một tờ BM02 in (header + R dòng pad). */
function GptcDetailPrintPage({ permit, pageRows, widths }) {
  return (
    <div className="gptc-sheet gptc-sheet--print-embed">
      <h2 className="gptc-sheet-title gptc-sheet-title--bm02">
        BIỂU THEO DÕI DIỄN BIẾN TRONG QUÁ TRÌNH THI CÔNG CÔNG TRÌNH CẤP PHÉP
      </h2>
      <div className="gptc-detail-project-line">
        <span className="gptc-detail-project-label">Công trình:</span>
        <span className="gptc-detail-project-name">
          {permit.tenCongTrinh || "…………………………………………"}
        </span>
      </div>
      <table className="gptc-official-table gptc-detail-table gptc-detail-table--excel">
        <colgroup>
          {widths.map((w, i) => (
            <col key={i} style={{ width: `${w}px` }} />
          ))}
        </colgroup>
        <thead>
          <tr className="gptc-head-labels">
            {COL_LABELS.map((label) => (
              <th key={label}>{label}</th>
            ))}
          </tr>
          <tr className="gptc-head-nums">
            {[1, 2, 3, 4].map((n) => (
              <th key={n}>({n})</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pageRows.map((row, i) => (
            <tr key={row?.id || `empty-${i}`} className="gptc-detail-row">
              <td className="gptc-data-cell gptc-detail-col-date">
                <span className="gptc-cell-text">{formatEntryDate(row?.ngay)}</span>
              </td>
              <td className="gptc-data-cell gptc-detail-col-progress">
                <span className="gptc-cell-text">{row?.dienBien || ""}</span>
              </td>
              <td className="gptc-data-cell gptc-detail-col-hat">
                <span className="gptc-cell-text">{row?.yKienHatTruong || ""}</span>
              </td>
              <td className="gptc-data-cell gptc-detail-col-tuan">
                <span className="gptc-cell-text">{row?.yKienTuanKiem || ""}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Xem trước in: BM01 → từng BM02 (mỗi công trình có thể nhiều tờ full dòng).
 */
export default function GptcPrintPages({
  ledger,
  margins = { top: 8, right: 10, bottom: 8, left: 10 },
  onMarginsChange
}) {
  const plan = useMemo(() => {
    if (!ledger) return [];
    const items = [];
    const summaryPages = packGptcSummaryPrintPages(ledger.permits, margins);
    summaryPages.forEach((pageRows, si) => {
      items.push({
        key: `bm01-${si}`,
        kind: "summary",
        pageRows,
        kicker:
          summaryPages.length > 1
            ? `BM01 · Tổng hợp · tờ ${si + 1}/${summaryPages.length}`
            : "BM01 · Tổng hợp"
      });
    });
    const widths = normalizeDetailColWidths(ledger.detailColWidths);
    (ledger.permits || []).forEach((p) => {
      if (!isPermitRowFilled(p)) return;
      const detailPages = packGptcDetailPages(p.entries || [], margins);
      detailPages.forEach((pageRows, di) => {
        items.push({
          key: `bm02-${p.id}-${di}`,
          kind: "detail",
          permit: p,
          pageRows,
          widths,
          kicker: `BM02 · ${p.tenCongTrinh || `CT ${p.stt}`}${
            detailPages.length > 1 ? ` · tờ ${di + 1}` : ""
          }`
        });
      });
    });
    return items;
  }, [ledger, margins]);

  if (!ledger) {
    return <div className="demxe-empty-form">Chưa có dữ liệu sổ cấp phép.</div>;
  }

  const pageCount = plan.length;

  return (
    <div
      className="gptc-print-stack--preview landscape-print-stack--preview"
      data-page-count={pageCount}
    >
      {plan.map((page, i) => (
        <PrintPageShell
          key={page.key}
          pageIndex={i}
          pageCount={pageCount}
          kicker={page.kicker}
          margins={margins}
          showGuides={i === 0}
          onMarginsChange={onMarginsChange}
        >
          {page.kind === "summary" ? (
            <GptcSummarySheet
              ledger={ledger}
              editable={false}
              selectedId=""
              colWidths={ledger.summaryColWidths}
              printMode
              pageRows={page.pageRows}
              rowHMm={GPTC_SUMMARY_LAYOUT.rowMm}
            />
          ) : (
            <GptcDetailPrintPage
              permit={page.permit}
              pageRows={page.pageRows}
              widths={page.widths}
            />
          )}
        </PrintPageShell>
      ))}
    </div>
  );
}
