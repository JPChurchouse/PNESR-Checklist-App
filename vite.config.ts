import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Installable app that works with no signal: every page, script and photo is cached on the
    // device the first time it's opened, and updated in the background when online.
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Palmerston North Esplanade Scenic Railway',
        short_name: 'PNESR',
        description: 'Pre-operation safety checks and ticket sales sheets.',
        lang: 'en-NZ',
        theme_color: '#2b3314',
        background_color: '#f5f6ec',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
          { src: 'brand/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'brand/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webp,ico}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
    }),
  ],
  // Relative asset paths, so the build works from any folder (GitHub Pages, a Pi, etc.).
  base: './',
  // The app bundle (React, router, IndexedDB, all screens) is ~530 kB, ~160 kB gzipped. The PDF
  // library is loaded separately, only when a PDF is made.
  build: { chunkSizeWarningLimit: 700 },
})
