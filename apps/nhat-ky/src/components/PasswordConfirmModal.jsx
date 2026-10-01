import { useEffect, useRef, useState } from "react";
import { reauthenticateCurrentUser } from "../utils/reauthenticate";
import { useAuth } from "../context/AuthContext";

/**
 * Modal nhập mật khẩu tài khoản hiện tại trước khi thực hiện thao tác nguy hiểm.
 * @param {{
 *   open: boolean,
 *   title?: string,
 *   description?: string,
 *   confirmLabel?: string,
 *   onCancel: () => void,
 *   onConfirmed: () => void | Promise<void>
 * }} props
 */
export default function PasswordConfirmModal({
  open,
  title = "Xác nhận bằng mật khẩu",
  description = "Nhập mật khẩu tài khoản đang đăng nhập để tiếp tục.",
  confirmLabel = "Xác nhận",
  onCancel,
  onConfirmed
}) {
  const { profile, user } = useAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  const email = user?.email || profile?.email || "";

  useEffect(() => {
    if (!open) return undefined;
    setPassword("");
    setError("");
    setBusy(false);
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await reauthenticateCurrentUser(password);
      await onConfirmed?.();
    } catch (err) {
      setError(err?.message || "Không xác thực được.");
      setBusy(false);
      return;
    }
    setBusy(false);
  }

  return (
    <div
      className="hientruong-modal-overlay password-confirm-overlay"
      onClick={() => {
        if (!busy) onCancel?.();
      }}
    >
      <div
        className="hientruong-modal password-confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="password-confirm-title"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="hientruong-modal-head">
          <h3 id="password-confirm-title">{title}</h3>
          <button
            type="button"
            className="draggable-form-close"
            disabled={busy}
            onClick={onCancel}
            aria-label="Đóng"
          >
            ×
          </button>
        </div>

        <form className="hientruong-modal-body" onSubmit={(e) => void handleSubmit(e)}>
          <p className="hientruong-modal-hint password-confirm-desc">{description}</p>
          {email ? (
            <p className="password-confirm-account">
              Tài khoản: <strong>{email}</strong>
            </p>
          ) : null}

          <label className="entry-form-label" htmlFor="password-confirm-input">
            Mật khẩu
          </label>
          <input
            ref={inputRef}
            id="password-confirm-input"
            type="password"
            className="sidebar-input"
            autoComplete="current-password"
            value={password}
            disabled={busy}
            onChange={(ev) => setPassword(ev.target.value)}
            placeholder="Nhập mật khẩu đăng nhập"
          />

          {error ? <p className="password-confirm-error">{error}</p> : null}

          <div className="hientruong-modal-actions password-confirm-actions">
            <button type="button" className="btn-secondary" disabled={busy} onClick={onCancel}>
              Hủy
            </button>
            <button type="submit" className="btn-primary password-confirm-danger" disabled={busy || !password}>
              {busy ? "Đang xác nhận…" : confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
