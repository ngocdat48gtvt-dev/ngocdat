import { Component } from "react";

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("NhatKy app error:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="nhatky-login">
          <div className="nhatky-login-card">
            <h1>Lỗi tải ứng dụng</h1>
            <p className="nhatky-login-error">{String(this.state.error?.message || this.state.error)}</p>
            <p className="nhatky-login-sub">
              Thử Ctrl+F5 hoặc xóa cache trình duyệt cho trang này, rồi mở lại{" "}
              <a href="/nhat-ky">/nhat-ky</a>.
            </p>
            <button
              type="button"
              className="btn-primary nhatky-login-btn"
              onClick={() => window.location.reload()}
            >
              Tải lại trang
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
