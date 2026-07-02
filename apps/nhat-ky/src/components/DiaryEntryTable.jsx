import { OFFICIAL_HEADERS } from "../utils/nhatKyFormat";

/** Bảng nhật ký 4 cột — khung giống sổ tuần đường. */
export default function DiaryEntryTable({ col1, col2, col3, col4 }) {
  return (
    <div className="tngt-diary-table-wrap">
      <table className="nhatky-official-table tngt-diary-table">
        <colgroup>
          <col className="tngt-diary-col--1" />
          <col className="tngt-diary-col--2" />
          <col className="tngt-diary-col--3" />
          <col className="tngt-diary-col--4" />
        </colgroup>
        <thead>
          <tr className="nhatky-header-main">
            <th>
              <div className="th-inner">{OFFICIAL_HEADERS.col1}</div>
            </th>
            <th>
              <div className="th-inner">{OFFICIAL_HEADERS.col2}</div>
            </th>
            <th>
              <div className="th-inner">{OFFICIAL_HEADERS.col3}</div>
            </th>
            <th>
              <div className="th-inner">{OFFICIAL_HEADERS.col4}</div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr className="tngt-diary-data-row">
            <td className="nhatky-col-date">{col1}</td>
            <td className="nhatky-col-loc">{col2}</td>
            <td className="nhatky-col-content">{col3}</td>
            <td className="nhatky-col-resolved">{col4}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
