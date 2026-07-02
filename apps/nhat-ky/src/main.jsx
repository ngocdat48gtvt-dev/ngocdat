import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { ErrorBoundary } from "./components/ErrorBoundary.jsx";

function showBootError(message) {
  const root = document.getElementById("root");
  if (!root) return;
  root.innerHTML = `
    <div class="nhatky-login">
      <div class="nhatky-login-card">
        <h1>Không tải được ứng dụng</h1>
        <p class="nhatky-login-error">${message}</p>
        <p class="nhatky-login-sub">Thử Ctrl+Shift+R hoặc mở tab ẩn danh.</p>
      </div>
    </div>`;
}

window.addEventListener("error", (event) => {
  console.error(event.error || event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error(event.reason);
});

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("Missing #root");
}

try {
  createRoot(rootEl).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>
  );
} catch (err) {
  showBootError(String(err?.message || err));
}
