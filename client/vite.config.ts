import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  envDir: '../',  // Point to parent directory for .env files
  server: {
    allowedHosts: true,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
