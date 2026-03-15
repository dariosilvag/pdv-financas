import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://script.google.com/macros/s/AKfycbwbLwqG_OXcMTiKUXV9wNwU1QpiIQPZvl968ROvhiBrIDDbeTyGLhM-uQcllqxsi8jE6A/exec',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        followRedirects: true
      }
    }
  }
})
