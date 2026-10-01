import { useLayoutEffect, useRef } from "react";
import {
  formatNghiemThuPlaceDate,
  formatNghiemThuDanhXung,
  buildNghiemThuDoiTuong,
  buildNghiemThuDiaDiem,
  resolveNghiemThuCanCuFixed,
  buildNghiemThuCanCuHopDong,
  buildNghiemThuCanCuHoSo
} from "../utils/nghiemThuFormat";
import NhatKyMarginGuides from "./NhatKyMarginGuides";
import { NT_PAGE } from "../utils/nghiemThuPrint";

function fitNtTextarea(el, minPx = 22) {
  if (!el) return;
  el.style.height = "0px";
  el.style.height = `${Math.max(el.scrollHeight, minPx)}px`;
}

function CellEdit({ value, ariaLabel, readOnly, onChange }) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    fitNtTextarea(ref.current);
  }, [value]);

  if (readOnly || !onChange) {
    return <pre className="nt-pre">{value || ""}</pre>;
  }
  return (
    <textarea
      ref={ref}
      className="nt-cell-edit"
      rows={1}
      value={value || ""}
      aria-label={ariaLabel}
      onChange={(e) => {
        fitNtTextarea(e.target);
        onChange(e.target.value);
      }}
      onInput={(e) => fitNtTextarea(e.target)}
    />
  );
}

function AutoGrowTextarea({ value, ariaLabel, onChange }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    fitNtTextarea(ref.current, 28);
  }, [value]);
  return (
    <textarea
      ref={ref}
      className="nt-inline-edit"
      rows={2}
      value={value || ""}
      aria-label={ariaLabel}
      onChange={(e) => {
        fitNtTextarea(e.target, 28);
        onChange(e.target.value);
      }}
      onInput={(e) => fitNtTextarea(e.target, 28)}
    />
  );
}

function InlineField({ label, field, value, fallback, rows = 2, canEdit, onMetaChange, sameLine = false }) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    if (canEdit) fitNtTextarea(ref.current, sameLine ? 18 : 28);
  }, [value, canEdit, sameLine]);

  return (
    <p className={`nt-p nt-p--edit${sameLine ? " nt-p--edit-inline" : ""}`}>
      <strong className="nt-inline-label">{label}</strong>
      {canEdit ? (
        <textarea
          ref={ref}
          className={`nt-inline-edit${sameLine ? " nt-inline-edit--flow" : ""}`}
          rows={rows}
          value={value ?? ""}
          aria-label={label}
          onChange={(e) => {
            fitNtTextarea(e.target, sameLine ? 18 : 28);
            onMetaChange(field, e.target.value);
          }}
          onInput={(e) => fitNtTextarea(e.target, sameLine ? 18 : 28)}
        />
      ) : (
        <span className="nt-inline-value">{value || fallback || "…"}</span>
      )}
    </p>
  );
}

/** Giá trị ô sửa: undefined → mẫu; "" (đã xóa/đổi) giữ nguyên, không nhảy về mặc định. */
function editableMetaText(meta, key, fallback) {
  if (meta && Object.prototype.hasOwnProperty.call(meta, key) && meta[key] != null) {
    return String(meta[key]);
  }
  return fallback;
}

function QlTable({ rows, readOnly, onQlChange }) {
  return (
    <table className="nt-table nt-table--ql">
      <colgroup>
        <col style={{ width: "8%" }} />
        <col style={{ width: "22%" }} />
        <col style={{ width: "35%" }} />
        <col style={{ width: "35%" }} />
      </colgroup>
      <thead>
        <tr>
          <th>STT</th>
          <th>Hạng mục</th>
          <th>Nội dung kiểm tra</th>
          <th>Mức độ hoàn thành</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key}>
            <td className="nt-td-center">{r.stt}</td>
            <td>{r.hangMuc}</td>
            <td>{r.noiDung}</td>
            <td>
              <CellEdit
                value={r.mucDo}
                ariaLabel={`Mức độ — ${r.hangMuc}`}
                readOnly={readOnly}
                onChange={onQlChange ? (v) => onQlChange(r.key, v) : undefined}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function VolumeTable({ sections, readOnly, onVolChange }) {
  if (!sections?.length) {
    return <p className="nt-p nt-muted">Không có khối lượng BDTX trong ngày.</p>;
  }
  return sections.map((sec) => (
    <FragmentSection
      key={sec.groupKey || sec.key}
      sec={sec}
      readOnly={readOnly}
      onVolChange={onVolChange}
    />
  ));
}

function FragmentSection({ sec, readOnly, onVolChange }) {
  return (
    <div className="nt-vol-sec">
      <p className="nt-p nt-vol-sec-title">
        <strong>
          {sec.key}. {sec.title}
        </strong>
      </p>
      <table className="nt-table nt-table--vol">
        <colgroup>
          <col style={{ width: "6%" }} />
          <col style={{ width: "28%" }} />
          <col style={{ width: "22%" }} />
          <col style={{ width: "14%" }} />
          <col style={{ width: "30%" }} />
        </colgroup>
        <thead>
          <tr>
            <th>STT</th>
            <th>Hạng mục</th>
            <th>Lý trình</th>
            <th>Khối lượng</th>
            <th>Mức độ hoàn thành</th>
          </tr>
        </thead>
        <tbody>
          {sec.rows.map((r) => {
            const volKey = `${sec.groupKey || sec.key}-${r.stt}`;
            return (
              <tr key={volKey}>
                <td className="nt-td-center">{r.stt}</td>
                <td>{r.hangMuc}</td>
                <td>{r.lyTrinh}</td>
                <td>{r.khoiLuong}</td>
                <td>
                  <CellEdit
                    value={r.mucDo}
                    ariaLabel={`Mức độ — ${r.hangMuc}`}
                    readOnly={readOnly}
                    onChange={onVolChange ? (v) => onVolChange(volKey, v) : undefined}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function NghiemThuSheet({
  date,
  road,
  meta,
  qlRows,
  volumeSections,
  pageIndex = 0,
  pageCount = 1,
  readOnly = false,
  onMetaChange,
  onQlChange,
  onVolChange,
  margins = null,
  showGuides = false,
  onMarginsChange
}) {
  const placeDate = formatNghiemThuPlaceDate(date);
  const canEdit = Boolean(onMetaChange) && !readOnly;
  const canCuFixed = resolveNghiemThuCanCuFixed(meta);
  const pad = margins
    ? {
        paddingTop: `${margins.top}mm`,
        paddingRight: `${margins.right}mm`,
        paddingBottom: `${margins.bottom}mm`,
        paddingLeft: `${margins.left}mm`
      }
    : undefined;

  return (
    <section
      className={`nghiemthu-sheet${margins ? " nghiemthu-sheet--margined" : ""}`}
      style={pad}
      data-print-page={pageIndex + 1}
    >
      {showGuides && margins && onMarginsChange ? (
        <NhatKyMarginGuides
          margins={margins}
          onChange={onMarginsChange}
          pageWMm={NT_PAGE.wMm}
          pageHMm={NT_PAGE.hMm}
          minContentMm={100}
        />
      ) : null}
      <div className="nt-nation">CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
      <div className="nt-motto">Độc lập - Tự do - Hạnh phúc</div>
      <div className="nt-place-date">{placeDate}</div>

      <h1 className="nt-title">BIÊN BẢN NGHIỆM THU</h1>
      <h2 className="nt-subtitle">
        CÔNG VIỆC THỰC HIỆN QL, BDTX THEO TIÊU CHÍ CHẤT LƯỢNG
      </h2>

      <InlineField
        label="Gói thầu:"
        field="goiThau"
        value={meta.goiThau}
        canEdit={canEdit}
        onMetaChange={onMetaChange}
        rows={2}
      />
      <InlineField
        label="1. Đối tượng nghiệm thu:"
        field="doiTuong"
        value={editableMetaText(meta, "doiTuong", buildNghiemThuDoiTuong(road))}
        fallback={buildNghiemThuDoiTuong(road)}
        canEdit={canEdit}
        onMetaChange={onMetaChange}
        rows={2}
      />
      <p className="nt-p">
        <strong>2. Thành phần trực tiếp nghiệm thu:</strong>
      </p>
      <p className="nt-p">2.1 Ban Quản lý bảo trì đường bộ</p>
      <p className="nt-p nt-person-line">
        <span className="nt-person-name">
          + {formatNghiemThuDanhXung(meta.banQlbtDanhXung)}: {meta.banQlbtTen || "…"}
        </span>
        <span className="nt-person-role">Chức vụ: {meta.banQlbtChucVu || "…"}</span>
      </p>
      <p className="nt-p">
        2.2 Nhà thầu thực hiện QL, BDTX: {meta.nhaThauDonVi || "…"}
      </p>
      <p className="nt-p nt-person-line">
        <span className="nt-person-name">
          + {formatNghiemThuDanhXung(meta.nhaThauDanhXung)}: {meta.nhaThauTen || "…"}
        </span>
        <span className="nt-person-role">Chức vụ: {meta.nhaThauChucVu || "…"}</span>
      </p>
      <InlineField
        label="3. Thời gian nghiệm thu:"
        field="thoiGian"
        value={editableMetaText(meta, "thoiGian", meta.thoiGian || "")}
        canEdit={canEdit}
        onMetaChange={onMetaChange}
        rows={1}
        sameLine
      />
      <InlineField
        label="4. Địa điểm nghiệm thu:"
        field="diaDiem"
        value={editableMetaText(meta, "diaDiem", buildNghiemThuDiaDiem(road))}
        fallback={buildNghiemThuDiaDiem(road)}
        canEdit={canEdit}
        onMetaChange={onMetaChange}
        rows={1}
        sameLine
      />
      <p className="nt-p">
        <strong>5. Căn cứ nghiệm thu:</strong>
      </p>
      <ul className="nt-can-cu">
        <li className={canEdit ? "nt-can-cu-edit" : undefined}>
          {canEdit ? (
            <AutoGrowTextarea
              value={editableMetaText(meta, "canCuFixed1", canCuFixed[0])}
              ariaLabel="Căn cứ thông tư"
              onChange={(v) => onMetaChange("canCuFixed1", v)}
            />
          ) : (
            canCuFixed[0]
          )}
        </li>
        <li className={canEdit ? "nt-can-cu-edit" : undefined}>
          {canEdit ? (
            <AutoGrowTextarea
              value={editableMetaText(meta, "canCuFixed2", canCuFixed[1])}
              ariaLabel="Căn cứ TCVN"
              onChange={(v) => onMetaChange("canCuFixed2", v)}
            />
          ) : (
            canCuFixed[1]
          )}
        </li>
        <li className={canEdit ? "nt-can-cu-edit" : undefined}>
          {canEdit ? (
            <AutoGrowTextarea
              value={editableMetaText(meta, "canCuHopDong", buildNghiemThuCanCuHopDong())}
              ariaLabel="Căn cứ hợp đồng"
              onChange={(v) => onMetaChange("canCuHopDong", v)}
            />
          ) : (
            meta.canCuHopDong ?? buildNghiemThuCanCuHopDong()
          )}
        </li>
        <li className={canEdit ? "nt-can-cu-edit" : undefined}>
          {canEdit ? (
            <AutoGrowTextarea
              value={editableMetaText(meta, "canCuHoSo", buildNghiemThuCanCuHoSo(road))}
              ariaLabel="Căn cứ hồ sơ tuyến đường"
              onChange={(v) => onMetaChange("canCuHoSo", v)}
            />
          ) : (
            meta.canCuHoSo ?? buildNghiemThuCanCuHoSo(road)
          )}
        </li>
      </ul>

      <p className="nt-p">
        <strong>6. Về khối lượng, chất lượng thực hiện:</strong>
      </p>
      <p className="nt-p">
        <strong>6.1. Công tác quản lý</strong>
      </p>
      <QlTable rows={qlRows} readOnly={readOnly} onQlChange={onQlChange} />

      <p className="nt-p">
        <strong>6.2. Công tác khác</strong>
      </p>
      <VolumeTable
        sections={volumeSections}
        readOnly={readOnly}
        onVolChange={onVolChange}
      />

      <InlineField
        label="7. Các ý kiến khác:"
        field="yKienKhac"
        value={meta.yKienKhac ?? "Không"}
        canEdit={canEdit}
        onMetaChange={onMetaChange}
        rows={2}
      />
      <InlineField
        label="8. Kết luận:"
        field="ketLuan"
        value={
          meta.ketLuan ??
          "Đồng ý nghiệm thu khối lượng thực hiện hoàn thành nêu trên."
        }
        canEdit={canEdit}
        onMetaChange={onMetaChange}
        rows={2}
      />

      <div className="nt-sign">
        <div>
          <div className="nt-sign-role">NHÀ THẦU QL, BDTX</div>
          <div className="nt-sign-space" aria-hidden="true" />
          <div className="nt-sign-name">{meta.signNhaThau || meta.nhaThauTen || ""}</div>
        </div>
        <div>
          <div className="nt-sign-role">BAN QLBT ĐƯỜNG BỘ</div>
          <div className="nt-sign-space" aria-hidden="true" />
          <div className="nt-sign-name">{meta.signBanQlbt || meta.banQlbtTen || ""}</div>
        </div>
      </div>
    </section>
  );
}
