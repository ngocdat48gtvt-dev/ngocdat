import { useMemo } from "react";
import NhatKyMarginGuides from "./NhatKyMarginGuides";
import { PHIEU_CAU_COL_KEYS } from "../hooks/usePhieuCauColWidths";
import { formatInspectionDate, daysInMonth } from "../utils/cauInspectionStore";

/** Chiều cao hàng body (mm) theo lề + có/không header — chừa chỗ nét đáy khỏi bị cắt. */
function rowHeightMm(hasTitleHeader, rowCount, margins) {
  const pageH = 210;
  const pad =
    (Number(margins?.top) || 0) + (Number(margins?.bottom) || 0);
  const titleH = hasTitleHeader ? 32 : 0;
  const theadH = 17;
  const bottomLine = 1.2;
  const avail = pageH - pad - titleH - theadH - bottomLine;
  const n = Math.max(1, rowCount);
  return Math.max(6, Math.min(11, avail / n));
}

function CauColGroup({ widths }) {
  return (
    <colgroup>
      {PHIEU_CAU_COL_KEYS.map((key) => (
        <col key={key} style={{ width: widths[key] }} />
      ))}
    </colgroup>
  );
}

function CauTableHead() {
  return (
    <thead>
      <tr>
        <th rowSpan={2}>TT</th>
        <th rowSpan={2}>Ngày kiểm tra</th>
        <th colSpan={4}>Tuần đường</th>
        <th colSpan={3}>Tuần kiểm</th>
        <th rowSpan={2}>Ghi chú</th>
      </tr>
      <tr>
        <th>Họ và tên</th>
        <th>Chữ ký</th>
        <th>Tình trạng hư hỏng</th>
        <th>Đề xuất - Kiến nghị</th>
        <th>Họ và tên</th>
        <th>Chữ ký</th>
        <th>Đề xuất - Kiến nghị</th>
      </tr>
    </thead>
  );
}

function CauTableBody({ rows, rowOffset }) {
  return (
    <tbody>
      {rows.map((row, i) => {
        const idx = rowOffset + i;
        return (
          <tr key={row.date || idx}>
            <td className="phieu-cau-stt">{idx + 1}</td>
            <td className="phieu-cau-date-cell">
              {formatInspectionDate(row.date)}
            </td>
            <td>{row.tuanDuongName}</td>
            <td className="phieu-cau-sign" />
            <td className="phieu-cau-damage">{row.damageStatus}</td>
            <td>{row.proposal}</td>
            <td>{row.tuanKiemName}</td>
            <td className="phieu-cau-sign" />
            <td>{row.tuanKiemProposal}</td>
            <td>{row.note}</td>
          </tr>
        );
      })}
    </tbody>
  );
}

function SheetTable({ rows, rowOffset, widths, rowHMm }) {
  return (
    <div className="phieu-cau-table-wrap">
      <table
        className="phieu-cau-table phieu-cau-table--excel"
        style={{ "--phieu-row-h": `${rowHMm}mm` }}
      >
        <CauColGroup widths={widths} />
        <CauTableHead />
        <CauTableBody rows={rows} rowOffset={rowOffset} />
      </table>
    </div>
  );
}

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
      className="phieu-cau-print-page landscape-print-page"
      style={pad}
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
      <div className="phieu-cau-print-inner">{children}</div>
    </section>
  );
}

/**
 * Xem trước in phiếu KT cầu theo tháng.
 * Mỗi cầu = 2 tờ A4 ngang (nửa tháng / tờ). Kéo lề xanh trên tờ đầu.
 */
export default function PhieuCauPrintPages({
  items = [],
  yearMonth,
  margins = { top: 5, right: 6, bottom: 5, left: 6 },
  onMarginsChange,
  widths
}) {
  const pages = useMemo(() => {
    const dayCount = daysInMonth(yearMonth);
    const splitAt = Math.ceil(dayCount / 2);
    const sheetNo = Number(String(yearMonth || "").split("-")[1]) || "";
    const out = [];

    items.forEach((item) => {
      const bridge = item.bridge || {};
      const sheet = item.sheet || {};
      const rows = sheet.rows || [];
      const page1Rows = rows.slice(0, splitAt);
      const page2Rows = rows.slice(splitAt);
      const name = bridge.name || sheet.bridgeName || "—";
      const km = bridge.km || sheet.km || "—";
      const unit = sheet.unitName || "……………………";

      out.push({
        key: `${bridge.id || name}-p1`,
        kicker: `${name} · trang 1`,
        hasHeader: true,
        rows: page1Rows,
        rowOffset: 0,
        sheetNo,
        name,
        km,
        unit
      });
      out.push({
        key: `${bridge.id || name}-p2`,
        kicker: `${name} · trang 2`,
        hasHeader: false,
        rows: page2Rows,
        rowOffset: splitAt,
        sheetNo,
        name,
        km,
        unit
      });
    });

    return out;
  }, [items, yearMonth]);

  if (!pages.length) {
    return (
      <div className="demxe-empty-form">
        Chọn cầu và tháng để xem trước in.
      </div>
    );
  }

  const pageCount = pages.length;

  return (
    <div
      className="phieu-cau-print-stack landscape-print-stack--preview phieu-cau-print-stack--preview"
      data-page-count={pageCount}
    >
      {pages.map((page, i) => {
        const rowH = rowHeightMm(page.hasHeader, page.rows.length || 1, margins);
        return (
          <PrintPageShell
            key={page.key}
            pageIndex={i}
            pageCount={pageCount}
            kicker={page.kicker}
            margins={margins}
            showGuides={i === 0}
            onMarginsChange={onMarginsChange}
          >
            {page.hasHeader ? (
              <div className="phieu-cau-header">
                <div className="phieu-cau-org">SỞ XÂY DỰNG</div>
                <div className="phieu-cau-org">BAN QUẢN LÝ BẢO TRÌ ĐƯỜNG BỘ</div>
                <h1 className="phieu-cau-title">
                  PHIẾU KIỂM TRA THƯỜNG XUYÊN CẦU TỜ SỐ {page.sheetNo || "…"}
                </h1>
                <p className="phieu-cau-meta phieu-cau-meta--unit">
                  <span className="phieu-cau-meta-label">
                    Đơn vị nhận quản lý duy tu bảo dưỡng:{" "}
                  </span>
                  <strong className="phieu-cau-unit-value">{page.unit}</strong>
                </p>
                <p className="phieu-cau-meta">
                  Tên cầu: <strong>{page.name}</strong>
                  {" · "}
                  Lý trình: <strong>{page.km}</strong>
                </p>
              </div>
            ) : null}
            <SheetTable
              rows={page.rows}
              rowOffset={page.rowOffset}
              widths={widths}
              rowHMm={rowH}
            />
          </PrintPageShell>
        );
      })}
    </div>
  );
}
