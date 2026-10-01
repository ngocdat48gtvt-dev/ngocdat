import { useMemo, useRef, useState } from "react";
import { createAndDownloadOfficeBackup, materializeOfficeBackup, readOfficeBackup } from "../services/officeBackupService";

function entryText(entry) {
  return entry?.description || entry?.content || entry?.workContent || entry?.name || entry?.section || entry?.note || "—";
}

const BOOKS = [
  { id: "nhatky", label: "SỔ NHẬT KÝ", matches: () => true },
  { id: "matduong", label: "SỔ MẶT ĐƯỜNG", words: ["mat duong", "nen duong", "le duong", "taluy"] },
  { id: "baoduong", label: "SỔ BẢO DƯỠNG", words: ["bao duong", "sua chua", "cong, ranh", "cong ranh", "an toan giao thong"] },
  { id: "nghiemthu", label: "BB NGHIỆM THU", words: ["nghiem thu"] },
  { id: "tructraffic", label: "SỔ TRỰC ĐBGT", words: ["truc dbgt", "truc duong", "tuan duong"] },
  { id: "tngt", label: "SỔ TNGT", words: ["tngt", "tai nan giao thong"] },
  { id: "hanhlang", label: "SỔ HÀNH LANG", words: ["hanh lang"] },
  { id: "demxe", label: "SỔ ĐẾM XE", words: ["dem xe"] },
  { id: "gptc", label: "SỔ CẤP PHÉP TC", words: ["cap phep", "gptc", "thi cong"] }
];

function plainText(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
}

function belongsToBook(entry, book) {
  if (book.id === "nhatky") return true;
  const searchable = plainText([entry?.section, entry?.type, entry?.category, entry?.workType, entry?.description, entry?.content].filter(Boolean).join(" "));
  return book.words?.some((word) => searchable.includes(word));
}

export default function OfficeBackupDialog({ profile, onClose, onOpenInWebsite }) {
  const today = new Date().toISOString().slice(0, 10);
  const [mode, setMode] = useState("range");
  const [dateFrom, setDateFrom] = useState(`${today.slice(0, 8)}01`);
  const [dateTo, setDateTo] = useState(today);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [backup, setBackup] = useState(null);
  const [roadId, setRoadId] = useState("");
  const [viewDate, setViewDate] = useState("");
  const [bookId, setBookId] = useState("nhatky");
  const fileRef = useRef(null);

  const selectedRoad = useMemo(() => backup?.roads?.find((item) => item.road.id === roadId) || backup?.roads?.[0], [backup, roadId]);
  const dates = useMemo(() => (selectedRoad?.days || []).map((day) => day.date).sort(), [selectedRoad]);
  const selectedDay = selectedRoad?.days?.find((day) => day.date === viewDate) || selectedRoad?.days?.find((day) => day.date === dates[0]);
  const selectedBook = BOOKS.find((book) => book.id === bookId) || BOOKS[0];
  const visibleEntries = (selectedDay?.entries || []).filter((entry) => belongsToBook(entry, selectedBook));

  async function handleCreate() {
    setBusy(true); setError(""); setStatus("");
    try {
      const result = await createAndDownloadOfficeBackup({
        uid: profile?.uid,
        displayName: profile?.displayName || profile?.email,
        dateFrom: mode === "range" ? dateFrom : "",
        dateTo: mode === "range" ? dateTo : "",
        onProgress: setStatus
      });
      setStatus(`Đã lưu ${result.filename} (${result.roadCount} sổ, ${result.dayCount} ngày).`);
    } catch (err) { setError(err instanceof Error ? err.message : "Không tạo được bản backup."); }
    finally { setBusy(false); }
  }

  async function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    await openSelectedFile(file, null);
  }

  async function openSelectedFile(file, fileHandle) {
    setBusy(true); setError(""); setStatus("Đang kiểm tra file...");
    try {
      const payload = await readOfficeBackup(file);
      if (onOpenInWebsite) {
        onOpenInWebsite({ ...materializeOfficeBackup(payload), fileHandle });
        return;
      }
      setBackup(payload);
      const firstRoad = payload.roads?.[0];
      setRoadId(firstRoad?.road?.id || "");
      setViewDate(firstRoad?.days?.map((day) => day.date).sort()[0] || "");
      setStatus("File hợp lệ. Đang mở ở chế độ chỉ đọc; dữ liệu này không đồng bộ lên Firebase.");
    } catch (err) { setBackup(null); setError(err instanceof Error ? err.message : "Không mở được file."); }
    finally { setBusy(false); }
  }

  async function handleOpenBackup() {
    if (typeof window.showOpenFilePicker !== "function") {
      fileRef.current?.click();
      return;
    }
    try {
      const [handle] = await window.showOpenFilePicker({
        multiple: false,
        types: [{ description: "Backup Nhật ký", accept: { "application/json": [".qldbackup"] } }]
      });
      if (!handle) return;
      await openSelectedFile(await handle.getFile(), handle);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Không mở được file backup.");
    }
  }

  return (
    <div className="backup-overlay" role="dialog" aria-modal="true" aria-label="Sao lưu dữ liệu nhật ký">
      <div className="backup-dialog">
        <div className="backup-title"><h2>Sao lưu dữ liệu nhật ký</h2><button type="button" onClick={onClose}>×</button></div>
        <p className="backup-note">File lưu trên máy người dùng, không chứa phần sự cố và không tự ghi ngược lên hệ thống.</p>
        <div className="backup-options">
          <label><input type="radio" checked={mode === "range"} onChange={() => setMode("range")} /> Theo khoảng ngày</label>
          <label><input type="radio" checked={mode === "all"} onChange={() => setMode("all")} /> Toàn bộ lịch sử</label>
          {mode === "range" && <div className="backup-dates"><label>Từ ngày<input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></label><label>Đến ngày<input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></label></div>}
        </div>
        <div className="backup-actions">
          <button type="button" className="btn-primary" disabled={busy} onClick={handleCreate}>{busy ? "Đang xử lý..." : "Tạo và tải file backup"}</button>
          <button type="button" disabled={busy} onClick={() => void handleOpenBackup()}>Mở file backup</button>
          <input ref={fileRef} hidden type="file" accept=".qldbackup,application/json" onChange={handleFile} />
        </div>
        {status && <p className="backup-status">{status}</p>}
        {error && <p className="backup-error">{error}</p>}
        {backup && <div className="backup-viewer">
          <div className="backup-summary"><strong>Bản sao lưu: {backup.owner?.displayName || "Người dùng"}</strong><span>Tạo lúc {new Date(backup.createdAt).toLocaleString("vi-VN")}</span></div>
          <div className="backup-book-nav">{BOOKS.map((book) => <button type="button" key={book.id} className={bookId === book.id ? "active" : ""} onClick={() => setBookId(book.id)}>{book.label}</button>)}</div>
          <div className="backup-filters"><label>Sổ<select value={selectedRoad?.road?.id || ""} onChange={(e) => { setRoadId(e.target.value); const road = backup.roads.find((x) => x.road.id === e.target.value); setViewDate(road?.days?.map((d) => d.date).sort()[0] || ""); }}>{backup.roads.map((item) => <option key={item.road.id} value={item.road.id}>{item.road.roadName || item.road.label || item.road.id}</option>)}</select></label><label>Ngày<select value={selectedDay?.date || ""} onChange={(e) => setViewDate(e.target.value)}>{dates.map((date) => <option key={date}>{date}</option>)}</select></label></div>
          {!selectedDay ? <p>Không có dữ liệu trong khoảng ngày đã sao lưu.</p> : !visibleEntries.length ? <p className="backup-empty">Ngày này không có dữ liệu thuộc {selectedBook.label}.</p> : <div className="backup-table-wrap"><table><thead><tr><th>STT</th><th>Ngày</th><th>Đầu sổ</th><th>Nội dung</th><th>Lý trình</th><th>Ghi chú</th></tr></thead><tbody>{visibleEntries.map((entry, index) => <tr key={entry.id || index}><td>{index + 1}</td><td>{selectedDay.date}</td><td>{entry.section || entry.category || "Nhật ký"}</td><td>{entryText(entry)}</td><td>{entry.km || entry.location || entry.lyTrinh || "—"}</td><td>{entry.note || entry.notes || ""}</td></tr>)}</tbody></table></div>}
        </div>}
      </div>
    </div>
  );
}
