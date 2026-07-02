import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** App chạy dưới đường dẫn /nhat-ky/ (cả dev lẫn deploy vào website/nhat-ky).
 *  Có thể override bằng VITE_DEPLOY_BASE khi cần. */
const deployBase = process.env.VITE_DEPLOY_BASE || '/nhat-ky/'

export default defineConfig({
  base: deployBase,
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5176,
    strictPort: false,
    open: true,
  },
})
