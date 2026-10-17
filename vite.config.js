import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'

// Local development: serve the same /api/* functions Vercel runs in production (api/*.js), reading
// FEED_PROVIDER / TWELVEDATA_API_KEY / ALLOWED_ORIGIN from .env (never exposed to the browser bundle:
// only VITE_-prefixed variables are, and the provider key must NOT use that prefix).
const API = ['candles', 'quote', 'symbols', 'health']
function apiDev() {
  return {
    name: 'mm-api-dev',
    apply: 'serve',
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), '')
      for (const k of ['FEED_PROVIDER', 'TWELVEDATA_API_KEY', 'ALLOWED_ORIGIN']) if (env[k] && !process.env[k]) process.env[k] = env[k]
      server.middlewares.use(async (req, res, next) => {
        const m = /^\/api\/([a-z]+)(?:\?|$)/.exec(req.url || '')
        if (!m || !API.includes(m[1])) return next()
        try {
          const mod = await server.ssrLoadModule(`/api/${m[1]}.js`)
          await mod.default(req, res)
        } catch (e) {
          server.config.logger.error(`[api] ${m[1]} failed: ${e?.message}`) // never print env / keys
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: { code: 'UPSTREAM', message: 'Server error' } }))
        }
      })
    },
  }
}

// https://vite.dev/config/
// Deploying on Vercel (root domain) — no base path needed.
export default defineConfig({
  plugins: [react(), tailwindcss(), apiDev()],
  base: '/',
})
