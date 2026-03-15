import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://script.google.com/macros/s/AKfycbwzC2goIEcAoABpaLC_uD951UhANP2jGCziKTKHxKVSujKyiM7gjDDTo8z94wLdh5Aqdw/exec',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        followRedirects: true
      }
    }
  }
})
