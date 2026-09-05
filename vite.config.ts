import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react(), tailwind()],
  resolve: {
    alias: { '~': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    proxy: {
      // Everything the browser sees is same-origin, so CORS never enters the
      // picture and nothing permissive can be left switched on by accident. It
      // also mirrors how this is meant to be deployed - one reverse proxy in
      // front of both, which is what nfr.md's single instance implies.
      //
      // The backend already assumes it: app.base-url is http://localhost:5173,
      // so verification and ticket links in emails point back here.
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
    },
  },
})
