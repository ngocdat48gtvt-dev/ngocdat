import { useState } from "react";
import { auditOfficeBooks } from "../services/officeBooksAuditService";
import { downloadBlob } from "../utils/downloadBlob";

export default function OfficeBooksAuditDialog({ profile, onClose }) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [uid, setUid] = useState("");
  async function scan() {
    setBusy(true); setError(""); setReport(null);
    try { setReport(await auditOfficeBooks(profile, setProgress)); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); setProgress(""); }
  }
  return <div className="backup-overlay" role="dialog" aria-modal="true" aria-label="Rà soát toàn bộ sổ">
    <div className="backup-dialog">
      <div className="backup-title"><h2>Rà soát toàn bộ sổ</h2><button type="button" disabled={busy} onClick={onClose}>×</button></div>
      <p>Đọc tất cả ngày và sổ trên Firebase. Admin rà soát các user trong công ty; user rà soát dữ liệu của mình. Chỉ lập báo cáo, chưa khôi phục hay xóa dữ liệu.</p>
      <button type="button" disabled={busy} onClick={() => void scan()}>{busy ? "Đang rà soát…" : "Bắt đầu rà soát"}</button>
      {progress && <p>{progress}</p>}{error && <p>{error}</p>}
      {report && <>
        <p>Đã đọc {report.users.length} tài khoản, {report.users.reduce((n, user) => n + user.books, 0)} sổ, {report.users.reduce((n, user) => n + user.days, 0)} ngày. {report.errors.length ? `Có ${report.errors.length} lỗi đọc; báo cáo chưa đầy đủ.` : "Không có lỗi đọc."}</p>
        <p>Dấu xóa có thể do thao tác chủ động hoặc lỗi đồng bộ. Các dòng có nhiều phiên bản bị xóa lặp cần đối chiếu trước khi khôi phục.</p>
        <button type="button" onClick={() => void downloadBlob(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }), `Ra-soat-so-${new Date().toISOString().slice(0, 10)}.json`)}>Tải báo cáo đối chiếu</button>
        <div className="backup-table-wrap"><table><thead><tr><th>Tài khoản</th><th>Sổ</th><th>Ngày đã đọc</th><th>Dòng đang dùng</th><th>Dòng có dấu xóa</th><th>Ngày có dấu xóa</th></tr></thead><tbody>{report.users.map((user) => <tr key={user.uid}><td>{user.name}</td><td>{user.books}</td><td>{user.days}</td><td>{user.liveRows}</td><td>{user.deletedRows}</td><td>{user.affectedDays}</td></tr>)}</tbody></table></div>
        <label>Lọc tài khoản<select value={uid} onChange={(event) => setUid(event.target.value)}><option value="">Tất cả</option>{report.users.map((user) => <option key={user.uid} value={user.uid}>{user.name}</option>)}</select></label>
        <div className="backup-table-wrap"><table><thead><tr><th>Tài khoản</th><th>Sổ</th><th>Ngày</th><th>Đang dùng</th><th>Nội dung cần đối chiếu</th></tr></thead><tbody>{report.days.filter((day) => (!uid || day.uid === uid) && day.rows.length).map((day) => <tr key={`${day.uid}/${day.roadId}/${day.date}`}><td>{day.name}</td><td>{day.roadName}</td><td>{day.date}</td><td>{day.liveRows}</td><td>{day.rows.map((row) => <p key={row.recordId}>{row.section}: {row.type}, {row.kmFrom} → {row.kmTo}; {row.versions} bản, {row.deleteBatches} lần xóa{row.hasDeleteConflict ? "; có xung đột xóa" : ""}; gần nhất {row.deletedAt}</p>)}</td></tr>)}</tbody></table></div>
        {report.errors.map((item, i) => <p key={i}>Lỗi đọc {item.uid}/{item.roadId}: {item.message}</p>)}
      </>}
    </div>
  </div>;
}
