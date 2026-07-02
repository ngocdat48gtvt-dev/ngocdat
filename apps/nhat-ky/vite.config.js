import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** App chạy dưới đường dẫn /nhat-ky/ (cả dev lẫn deploy vào website/nhat-ky).
 *  Có thể override bằng VITE_DEPLOY_BASE khi cần. */
const deployBase = process.env.VITE_DEPLOY_BASE || '/nhat-ky/'

export default defineConfig({
  base: deployBase,
  plugins: [react()],
  resolve: {
    alias: {
      '@quanlysuco/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5176,
    strictPort: false,
    open: true,
  },
})
