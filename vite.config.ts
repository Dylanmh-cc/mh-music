import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    host: true,
    proxy: {
      // In production `/api/*` is served by the Netlify function (or by the
      // bundled accounts server when self-hosted). In dev nothing sits in front
      // of Vite, so the same paths are proxied to the local server when it runs
      // — `node server/auth-server.mjs`. With no server running the request just
      // fails and the client falls through to its other candidates.
      '/api': {
        target: process.env.MH_API_TARGET || 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1500,
    target: 'es2020',
  },
})
