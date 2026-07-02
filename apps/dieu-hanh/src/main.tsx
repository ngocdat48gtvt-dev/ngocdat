import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.tsx'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { firebaseConfig } from '@/firebase/firebase'
import './index.css'

const root = document.getElementById('root')!

function showBootError(message: string) {
  root.innerHTML = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;margin:3rem auto;padding:1.5rem;line-height:1.6;color:#111">
      <h1 style="font-size:1.25rem;margin:0 0 1rem">Không khởi động được cổng điều hành</h1>
      <p>${message}</p>
      <p style="margin-top:1rem"><a href="/san-pham.html">← Về trang sản phẩm</a></p>
    </div>
  `
}

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  showBootError(
    'Thiếu cấu hình Firebase. Kiểm tra file <code>firebase-config.js</code> trong thư mục dieu-hanh.',
  )
} else {
  try {
    createRoot(root).render(
      <StrictMode>
        <HashRouter>
          <ErrorBoundary title="Lỗi cổng điều hành">
            <App />
          </ErrorBoundary>
        </HashRouter>
      </StrictMode>,
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    showBootError(msg)
    console.error(e)
  }
}
