import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../app/static',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/chat': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
      '/user-by-email': 'http://localhost:8000',
      '/onboard': 'http://localhost:8000',
      '/profile': 'http://localhost:8000',
      '/symptoms': 'http://localhost:8000',
      '/medications': 'http://localhost:8000',
      '/medication-info': 'http://localhost:8000',
      '/appointments': 'http://localhost:8000',
      '/summaries': 'http://localhost:8000',
      '/upload-discharge': 'http://localhost:8000',
      '/auth': 'http://localhost:8000',
    },
  },
})
