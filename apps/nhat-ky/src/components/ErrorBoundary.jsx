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
      const message = String(this.state.error?.message || this.state.error);
      const quotaError = /quota|exceeded the quota|storage/i.test(message);
      return (
        <div className="nhatky-login">
          <div className="nhatky-login-card">
            <h1>Lỗi tải ứng dụng</h1>
            <p className="nhatky-login-error">{message}</p>
            <p className="nhatky-login-sub">
              {quotaError
                ? "Bộ nhớ trình duyệt đã đầy. Không xóa cache vì có thể còn dữ liệu chưa đồng bộ; hãy tải lại sau khi website được cập nhật."
                : "Thử Ctrl+F5 rồi mở lại "}
              {!quotaError && <a href="/nhat-ky">/nhat-ky</a>}
              {!quotaError && "."}
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
