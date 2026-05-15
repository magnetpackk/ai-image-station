import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: '../backend/static',
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
      '/images': 'http://localhost:8080',
    },
  },
})
