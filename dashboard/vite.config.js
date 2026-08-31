import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      // Proxy Node-RED HTTP endpoints — ARCHITECTURE.md §1
      '/api': {
        target: 'http://localhost:1880',
        changeOrigin: true,
      },
    },
  },
})
