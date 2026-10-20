import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_API || 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
