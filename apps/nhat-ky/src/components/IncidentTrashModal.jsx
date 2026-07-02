import { useEffect, useState } from "react";
import {
  permanentlyDeleteIncident,
  restoreIncident,
  subscribeTrashIncidents
} from "../services/incidentsService";
import { positionLabel } from "../utils/incidentUtils";

function formatDeletedAt(ms) {
  if (!ms) return "—";
  try {
    return new Date(ms).toLocaleString("vi-VN");
  } catch {
    return "—";
  }
}

export default function IncidentTrashModal({ open, uid, onClose, onChanged }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    if (!open || !uid) return undefined;
    setLoading(true);
    const unsub = subscribeTrashIncidents(
      uid,
      (data) => {
        setItems(data);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [open, uid]);

  async function handleRestore(inc) {
    if (busyId) return;
    setBusyId(inc.id);
    try {
      await restoreIncident(uid, inc.id);
      onChanged?.();
    } catch {
      window.alert("Không khôi phục được. Kiểm tra mạng/quyền.");
    } finally {
      setBusyId("");
    }
  }

  async function handleDelete(inc) {
    if (busyId) return;
    if (!window.confirm("Xoá vĩnh viễn sự cố này? Không thể khôi phục.")) return;
    setBusyId(inc.id);
    try {
      await permanentlyDeleteIncident(uid, inc.id);
      onChanged?.();
    } catch {
      window.alert("Không xoá được. Kiểm tra mạng/quyền.");
    } finally {
      setBusyId("");
    }
  }

  if (!open) return null;

  return (
    <div className="incident-drawer-overlay" onClick={onClose}>
      <div
        className="incident-drawer incident-trash-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="incident-drawer-head">
          <h3>Thùng rác ({items.length})</h3>
          <button type="button" className="incident-drawer-close" onClick={onClose} aria-label="Đóng">
            ×
          </button>
        </div>

        <div className="incident-trash-body">
          {loading && <p className="section-guide">Đang tải thùng rác...</p>}
          {!loading && items.length === 0 && (
            <p className="section-guide">Thùng rác trống.</p>
          )}

          {!loading && items.length > 0 && (
            <table className="hientruong-table">
              <thead>
                <tr>
                  <th>Tuyến</th>
                  <th>Lý trình</th>
                  <th>Phía</th>
                  <th>Loại</th>
                  <th>Ngày xoá</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {items.map((inc) => (
                  <tr key={inc.id}>
                    <td>{inc.road}</td>
                    <td>{inc.km}</td>
                    <td>{positionLabel(inc.position)}</td>
                    <td>{inc.type}</td>
                    <td>{formatDeletedAt(inc.deletedAtMs)}</td>
                    <td className="hientruong-actions">
                      <button
                        type="button"
                        className="btn-secondary btn-primary--compact"
                        disabled={busyId === inc.id}
                        onClick={() => handleRestore(inc)}
                      >
                        Khôi phục
                      </button>
                      <button
                        type="button"
                        className="btn-danger btn-primary--compact"
                        disabled={busyId === inc.id}
                        onClick={() => handleDelete(inc)}
                      >
                        Xoá hẳn
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
