import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// Deploying on Vercel (root domain) — no base path needed.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/',
})
