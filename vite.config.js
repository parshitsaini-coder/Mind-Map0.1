import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// GitHub Pages project-page base path — must match the repo name exactly.
// Repo: https://github.com/parshitsaini-coder/Mind-Map0.1
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/Mind-Map0.1/',
})
