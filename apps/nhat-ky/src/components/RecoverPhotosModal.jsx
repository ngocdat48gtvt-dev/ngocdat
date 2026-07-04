import { useEffect, useRef, useState } from "react";
import { recoverPhotosFromStorage } from "../services/photoRecoverService";

export default function RecoverPhotosModal({ open, uid, incidents, onClose, onDone }) {
  const [phase, setPhase] = useState("confirm");
  const [progress, setProgress] = useState("");
  const cancelRef = useRef(false);

  useEffect(() => {
    if (!open) {
      setPhase("confirm");
      setProgress("");
      cancelRef.current = false;
    }
  }, [open]);

  if (!open) return null;

  async function startRecover() {
    if (!uid) return;
    setPhase("running");
    cancelRef.current = false;
    let recovered = 0;
    let error = null;
    try {
      recovered = await recoverPhotosFromStorage(uid, incidents, {
        onProgress: (cur, total) => setProgress(`Đang quét sự cố ${cur}/${total}…`),
        shouldCancel: () => cancelRef.current
      });
    } catch (e) {
      error = e?.message || String(e);
    }
    onDone?.({
      recovered,
      cancelled: cancelRef.current,
      error
    });
    onClose?.();
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Khôi phục ảnh từ cloud">
      <div className="modal-card modal-card--narrow">
        {phase === "confirm" ? (
          <>
            <h2 className="modal-title">Khôi phục ảnh từ cloud</h2>
            <p className="modal-text">
              Quét Firebase Storage để bổ sung lại các ảnh bị thiếu vào từng sự cố.
              Thao tác này chỉ <strong>thêm</strong> ảnh, không xóa ảnh nào.
            </p>
            <p className="modal-text modal-text--muted">
              Sẽ quét <strong>{incidents.length}</strong> sự cố. Nên dùng trên máy tính có mạng ổn định.
            </p>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={onClose}>
                Huỷ
              </button>
              <button type="button" className="btn-primary" onClick={() => void startRecover()}>
                Khôi phục
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="modal-title">Đang khôi phục…</h2>
            <p className="modal-text">{progress || "Đang chuẩn bị…"}</p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  cancelRef.current = true;
                }}
              >
                Dừng
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
