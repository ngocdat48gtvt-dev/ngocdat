import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

/** Khi deploy vào website/user: set VITE_DEPLOY_BASE=/user/ */
const deployBase = process.env.VITE_DEPLOY_BASE || './'

export default defineConfig({
  base: deployBase,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['firebase-config.js', 'banner2.png', 'favicon.svg'],
      manifest: {
        name: 'Quản lý sự cố đường bộ',
        short_name: 'Sự cố',
        description: 'Web hiện trường — Quản lý sự cố đường bộ',
        theme_color: '#1565c0',
        background_color: '#f5f5f5',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        lang: 'vi',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: 'index.html',
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5175,
    strictPort: false,
    open: true,
  },
})
