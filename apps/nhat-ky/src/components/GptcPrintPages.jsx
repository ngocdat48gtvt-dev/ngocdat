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
import { permitBm02Title } from "../utils/gptcStore";
import { formatDisplayDate } from "../utils/nhatKyFormat";

function PrintPageShell({
  children,
  pageIndex,
  pageCount,
  kicker,
  margins,
  showGuides,
  onMarginsChange,
  rowHMm
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
      style={{ ...pad, "--gptc-row-h": `${rowHMm || GPTC_DETAIL_LAYOUT.rowMm}mm` }}
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

/** Một tờ BM02 in (header + dòng co/giãn theo chữ). */
function GptcDetailPrintPage({ permit, pageRows, widths, rowHMm, rowHeightsMm }) {
  return (
    <div
      className="gptc-sheet gptc-sheet--print-embed"
      style={{ "--gptc-row-h": `${rowHMm || GPTC_DETAIL_LAYOUT.rowMm}mm` }}
    >
      <h2 className="gptc-sheet-title gptc-sheet-title--bm02">
        BIỂU THEO DÕI DIỄN BIẾN TRONG QUÁ TRÌNH THI CÔNG CÔNG TRÌNH CẤP PHÉP
      </h2>
      <div className="gptc-detail-project-line">
        <span className="gptc-detail-project-name">
          {permitBm02Title(permit) || "…………………………………………"}
        </span>
      </div>
      <table className="gptc-official-table gptc-detail-table gptc-detail-table--excel gptc-detail-table--print-fit">
        <colgroup>
          {(() => {
            const sum = widths.reduce((a, b) => a + (Number(b) || 0), 0) || 1;
            return widths.map((w, i) => (
              <col key={i} style={{ width: `${((Number(w) || 0) / sum) * 100}%` }} />
            ));
          })()}
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
          {pageRows.map((row, i) => {
            const hMm =
              Array.isArray(rowHeightsMm) && rowHeightsMm[i] != null
                ? rowHeightsMm[i]
                : rowHMm || GPTC_DETAIL_LAYOUT.rowMm;
            const cellStyle = {
              height: `${hMm}mm`,
              minHeight: `${hMm}mm`,
              maxHeight: `${hMm}mm`
            };
            return (
              <tr
                key={row?.id || `empty-${i}`}
                className="gptc-detail-row"
                style={{ height: `${hMm}mm` }}
              >
                <td className="gptc-data-cell gptc-detail-col-date" style={cellStyle}>
                  <span className="gptc-cell-text">{formatEntryDate(row?.ngay)}</span>
                </td>
                <td className="gptc-data-cell gptc-detail-col-progress" style={cellStyle}>
                  <span className="gptc-cell-text">{row?.dienBien || ""}</span>
                </td>
                <td className="gptc-data-cell gptc-detail-col-hat" style={cellStyle}>
                  <span className="gptc-cell-text">{row?.yKienHatTruong || ""}</span>
                </td>
                <td className="gptc-data-cell gptc-detail-col-tuan" style={cellStyle}>
                  <span className="gptc-cell-text">{row?.yKienTuanKiem || ""}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Xem trước in theo phạm vi:
 * - summary: chỉ BM01
 * - detail: chỉ BM02
 * - all: BM01 + BM02
 */
export default function GptcPrintPages({
  ledger,
  margins = { top: 8, right: 10, bottom: 8, left: 10 },
  onMarginsChange,
  scope = "all"
}) {
  const plan = useMemo(() => {
    if (!ledger) return [];
    const items = [];
    const wantSummary = scope === "summary" || scope === "all";
    const wantDetail = scope === "detail" || scope === "all";

    if (wantSummary) {
      const summaryPages = packGptcSummaryPrintPages(ledger.permits, margins);
      summaryPages.forEach((page, si) => {
        items.push({
          key: `bm01-${si}`,
          kind: "summary",
          pageRows: page.rows,
          rowHeightMm: page.rowHeightMm,
          rowHeightsMm: page.rowHeightsMm,
          kicker:
            summaryPages.length > 1
              ? `BM01 · Tổng hợp · tờ ${si + 1}/${summaryPages.length}`
              : "BM01 · Tổng hợp"
        });
      });
    }

    if (wantDetail) {
      const widths = normalizeDetailColWidths(ledger.detailColWidths);
      (ledger.permits || []).forEach((p) => {
        if (!isPermitRowFilled(p)) return;
        const detailPages = packGptcDetailPages(p.entries || [], margins);
        const title = permitBm02Title(p) || `CT ${p.stt}`;
        detailPages.forEach((page, di) => {
          items.push({
            key: `bm02-${p.id}-${di}`,
            kind: "detail",
            permit: p,
            pageRows: page.rows,
            rowHeightMm: page.rowHeightMm,
            rowHeightsMm: page.rowHeightsMm,
            widths,
            kicker: `BM02 · ${title}${detailPages.length > 1 ? ` · tờ ${di + 1}` : ""}`
          });
        });
      });
    }
    return items;
  }, [ledger, margins, scope]);

  if (!ledger) {
    return <div className="demxe-empty-form">Chưa có dữ liệu sổ cấp phép.</div>;
  }

  const pageCount = plan.length;
  if (!pageCount) {
    return (
      <div className="demxe-empty-form">
        {scope === "summary"
          ? "Chưa có dữ liệu biểu tổng hợp để in."
          : scope === "detail"
            ? "Chưa có công trình / sổ chi tiết để in."
            : "Chưa có tờ in."}
      </div>
    );
  }

  return (
    <div
      className="gptc-print-stack--preview landscape-print-stack--preview"
      data-page-count={pageCount}
      data-print-scope={scope}
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
          rowHMm={page.rowHeightMm}
        >
          {page.kind === "summary" ? (
            <GptcSummarySheet
              ledger={ledger}
              editable={false}
              selectedId=""
              colWidths={ledger.summaryColWidths}
              printMode
              pageRows={page.pageRows}
              rowHMm={page.rowHeightMm || GPTC_SUMMARY_LAYOUT.rowMm}
              rowHeightsMm={page.rowHeightsMm}
            />
          ) : (
            <GptcDetailPrintPage
              permit={page.permit}
              pageRows={page.pageRows}
              widths={page.widths}
              rowHMm={page.rowHeightMm}
              rowHeightsMm={page.rowHeightsMm}
            />
          )}
        </PrintPageShell>
      ))}
    </div>
  );
}
