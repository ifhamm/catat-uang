import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Custom service worker source (src/sw.ts): we need our own fetch
      // handler to intercept the Web Share Target POST below, which the
      // generateSW strategy cannot do.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'maskable-icon-512x512.png'],
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest,woff,woff2}'],
      },
      manifest: {
        name: 'Catat Uang',
        short_name: 'Catat Uang',
        description: 'Catat keuangan harian dengan suara, ketik singkat, atau tangkapan layar.',
        lang: 'id',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f5f1e9',
        theme_color: '#f5f1e9',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Android Web Share Target: bagikan tangkapan layar mutasi/e-wallet
        // dari galeri atau aplikasi m-banking ke Catat Uang. POST ini
        // ditangani service worker (atau worker.js bila SW belum aktif),
        // lalu diarahkan (303) ke /?shared=1 untuk diproses aplikasi.
        share_target: {
          action: '/',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: {
            files: [
              { name: 'screenshot', accept: ['image/png', 'image/jpeg', 'image/webp'] },
            ],
          },
        },
      },
      devOptions: { enabled: false },
    }),
  ],
})
