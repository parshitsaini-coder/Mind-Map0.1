// Fake /api/* for the browser test (the sandbox has no network / key). Same JSON shapes as api/*.js.
const STEP = { M1: 60, M5: 300, M15: 900, M30: 1800, H1: 3600, D1: 86400, W1: 604800 }
export const walk = (t) => 4350 + Math.sin(t / 5400) * 18 + Math.sin(t / 700) * 3
export function candlesFor(tf, limit, nowSec) {
  const step = STEP[tf] || 60
  const end = Math.floor(nowSec / step) * step
  const out = []
  for (let i = Math.min(limit, 1500) - 1; i >= 0; i--) {
    const t = end - i * step
    const o = walk(t), c = walk(t + step), h = Math.max(o, c) + 1.2, l = Math.min(o, c) - 1.2
    out.push({ time: t, open: +o.toFixed(2), high: +h.toFixed(2), low: +l.toFixed(2), close: +c.toFixed(2), volume: 100 })
  }
  return out
}
export async function mockApi(context, { nowMs, fail = () => null, log = [] } = {}) {
  await context.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    log.push(url.pathname + url.search)
    const f = fail(url)
    if (f) return route.fulfill({ status: f.status, contentType: 'application/json', body: JSON.stringify({ error: { code: f.code, message: f.message } }) })
    const now = Math.floor((nowMs ?? Date.now()) / 1000)
    if (url.pathname.endsWith('/quote')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ symbol: 'XAUUSD', provider: 'Twelve Data', last: +walk(now).toFixed(2), prevClose: 4338.4, isOpen: null, ts: now - 4, serverTime: now }) })
    if (url.pathname.endsWith('/candles')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ symbol: 'XAUUSD', tf: url.searchParams.get('tf'), provider: 'Twelve Data', candles: candlesFor(url.searchParams.get('tf'), Number(url.searchParams.get('limit') || 500), now), serverTime: now }) })
    return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' })
  })
}
