import { VEHICLE_TYPES } from "../utils/demXeConstants";
import {
  DEMXE_GUIDE_COUNT_REFS,
  DEMXE_GUIDE_DOSSIER,
  DEMXE_GUIDE_LEGAL_BASES,
  DEMXE_GUIDE_PURPOSE,
  DEMXE_GUIDE_REQUIREMENTS,
  DEMXE_GUIDE_REQUIREMENTS_PAGE2,
  DEMXE_GUIDE_SUMMARY_REFS,
  DEMXE_GUIDE_SUPERVISOR,
  DEMXE_GUIDE_TEAM_LEADER
} from "../utils/demXeGuideContent";

function GuideLegalList() {
  return (
    <ul className="demxe-guide-legal">
      {DEMXE_GUIDE_LEGAL_BASES.map((item) => (
        <li key={item.slice(0, 24)}>{item}</li>
      ))}
    </ul>
  );
}

function GuideSummarySampleTable() {
  const emptyRows = 3;
  return (
    <div className="demxe-guide-sample-block">
      <p className="demxe-guide-table-title">BẢNG TỔNG HỢP LƯU LƯỢNG XE QUA LẠI / NGÀY</p>
      <p className="demxe-guide-table-subtitle">Tháng…. năm….</p>
      <table className="demxe-official-table demxe-guide-sample-table">
        <thead>
          <tr>
            <th rowSpan={2}>TT</th>
            <th rowSpan={2}>HƯỚNG XE CHẠY</th>
            <th rowSpan={2}>CHỦNG LOẠI XE</th>
            <th colSpan={3}>SỐ LƯỢNG</th>
            <th rowSpan={2}>GHI CHÚ</th>
          </tr>
          <tr>
            <th>Ngày …</th>
            <th>Ngày …</th>
            <th>Ngày ….</th>
          </tr>
          <tr className="demxe-guide-ref-row">
            <th>(01)</th>
            <th>(02)</th>
            <th>(03)</th>
            <th>(04)</th>
            <th>(05)</th>
            <th>(06)</th>
            <th>(07)</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: emptyRows }, (_, i) => (
            <tr key={i}>
              <td>&nbsp;</td>
              <td>&nbsp;</td>
              <td>&nbsp;</td>
              <td>&nbsp;</td>
              <td>&nbsp;</td>
              <td>&nbsp;</td>
              <td>&nbsp;</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GuideCountSampleForm() {
  return (
    <div className="demxe-guide-sample-block">
      <p className="demxe-guide-table-title">ĐẾM THEO PHÂN LOẠI PHƯƠNG TIỆN</p>
      <p className="demxe-guide-form-line">Tên đường: ………….</p>
      <p className="demxe-guide-form-line">Tên Hạt:………….., lý trình đếm xe:…………..</p>
      <p className="demxe-guide-form-line demxe-guide-form-line--center">
        Ngày ….. tháng ….. năm …………...
      </p>

      <table className="demxe-info-table demxe-grid-table demxe-guide-info-table">
        <tbody>
          <tr>
            <td className="demxe-info-label">Đường: (01)</td>
            <td className="demxe-xcell">&nbsp;</td>
            <td className="demxe-info-label">Lý trình: (02)</td>
            <td className="demxe-xcell">&nbsp;</td>
          </tr>
          <tr>
            <td className="demxe-info-label">Hướng xe chạy từ: (03)</td>
            <td className="demxe-xcell">&nbsp;</td>
            <td className="demxe-info-label">Đến: (04)</td>
            <td className="demxe-xcell">&nbsp;</td>
          </tr>
          <tr>
            <td className="demxe-info-label">Ngày…..tháng…..năm…….... (05)</td>
            <td className="demxe-xcell">&nbsp;</td>
            <td className="demxe-info-label">Ngày trong tuần: (06)</td>
            <td className="demxe-xcell">&nbsp;</td>
          </tr>
          <tr>
            <td className="demxe-info-label">Thời gian bắt đầu đếm: (07)</td>
            <td className="demxe-xcell">&nbsp;</td>
            <td className="demxe-info-label">Thời gian kết thúc đếm: (08)</td>
            <td className="demxe-xcell">&nbsp;</td>
          </tr>
        </tbody>
      </table>

      <table className="demxe-official-table demxe-grid-table demxe-data-table demxe-guide-sample-table">
        <thead>
          <tr>
            <th className="demxe-col-type">CHỦNG LOẠI XE</th>
            <th className="demxe-col-count">SỐ LIỆU ĐẾM (09)</th>
            <th className="demxe-col-sum">CỘNG (10)</th>
          </tr>
        </thead>
        <tbody>
          {VEHICLE_TYPES.map((v) => (
            <tr key={v.key}>
              <td className="demxe-col-type">{v.label}</td>
              <td className="demxe-col-count">&nbsp;</td>
              <td className="demxe-col-sum">&nbsp;</td>
            </tr>
          ))}
          <tr className="demxe-grand-total-row">
            <td className="demxe-col-type">
              <strong>CỘNG</strong>
            </td>
            <td className="demxe-col-count">&nbsp;</td>
            <td className="demxe-col-sum">&nbsp;</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function DemXeGuidePanel() {
  const req3 = DEMXE_GUIDE_REQUIREMENTS[2];

  return (
    <div className="demxe-guide-panel demxe-print-section" data-print-section="guide">
      <div className="demxe-guide-page">
        <p className="demxe-guide-appendix">Phụ lục số 03</p>
        <h2 className="demxe-guide-title">HƯỚNG DẪN LẬP, GHI CHÉP SỔ ĐẾM XE</h2>
        <GuideLegalList />

        <p className="demxe-guide-heading">I. MỤC ĐÍCH</p>
        <p className="demxe-guide-paragraph">{DEMXE_GUIDE_PURPOSE}</p>

        <p className="demxe-guide-heading">II. YÊU CẦU</p>
        <ol className="demxe-guide-num-list">
          {DEMXE_GUIDE_REQUIREMENTS.slice(0, 2).map((item) => (
            <li key={item.no}>
              <strong>{item.no}.</strong> {item.text}
            </li>
          ))}
          <li>
            <strong>{req3.no}.</strong> {req3.text}
            <ul className="demxe-guide-sublist">
              {req3.bullets.map((bullet) => (
                <li key={bullet.slice(0, 24)}>{bullet}</li>
              ))}
            </ul>
          </li>
        </ol>
      </div>

      <div className="demxe-guide-page">
        <p className="demxe-guide-paragraph demxe-guide-paragraph--dash">
          {DEMXE_GUIDE_REQUIREMENTS_PAGE2[0]}
        </p>
        <p className="demxe-guide-paragraph">
          <strong>4.</strong> {DEMXE_GUIDE_REQUIREMENTS_PAGE2[1]}
        </p>

        <p className="demxe-guide-heading">III. QUY CÁCH HỒ SƠ</p>
        <ol className="demxe-guide-num-list">
          {DEMXE_GUIDE_DOSSIER.map((item, idx) => (
            <li key={item.slice(0, 24)}>
              <strong>{idx + 1}.</strong> {item}
            </li>
          ))}
        </ol>

        <p className="demxe-guide-subheading">4.1 Hướng dẫn ghi Bảng tổng hợp lưu lượng xe qua lại/ngày</p>
        <ul className="demxe-guide-ref-list">
          {DEMXE_GUIDE_SUMMARY_REFS.map((item) => (
            <li key={item.slice(0, 6)}>{item}</li>
          ))}
        </ul>

        <p className="demxe-guide-paragraph">{DEMXE_GUIDE_SUPERVISOR}</p>
        <p className="demxe-guide-paragraph">{DEMXE_GUIDE_TEAM_LEADER}</p>

        <GuideSummarySampleTable />
      </div>

      <div className="demxe-guide-page">
        <p className="demxe-guide-subheading">
          4.2 Hướng dẫn ghi Đếm theo phân loại phương tiện (chiều đi, chiều về)
        </p>
        <ul className="demxe-guide-ref-list">
          {DEMXE_GUIDE_COUNT_REFS.map((item) => (
            <li key={item.slice(0, 6)}>{item}</li>
          ))}
        </ul>

        <GuideCountSampleForm />
      </div>
    </div>
  );
}
