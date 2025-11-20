import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',   // Thay vì '/', dùng './' để relative path
  plugins: [react()]
})
