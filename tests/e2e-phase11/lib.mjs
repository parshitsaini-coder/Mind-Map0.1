import { chromium } from 'playwright'
export const OUT = './e2e-shots'
export async function boot({ width = 1440, height = 900, touch = false, seed = {}, args = [] } = {}) {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', ...args], ...(args.length ? { ignoreDefaultArgs: ['--autoplay-policy=no-user-gesture-required'] } : {}) })
  const errors = []
  const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch })
  await ctx.addInitScript((seed) => { try { if (!localStorage.getItem('seeded')) { localStorage.setItem('seeded', '1'); localStorage.setItem('mindmap-terminal-storage', JSON.stringify({ version: 0, state: { isOpen: true, settings: { oneClick: true }, ...seed } })) } localStorage.setItem('terminal-debug', '1') } catch {} }, seed)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)) })
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'load' })
  await page.waitForSelector('.tm-root', { timeout: 15000 })
  await page.waitForTimeout(1500)
  const res = []
  const check = (n, ok, x = '') => { res.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${n} ${ok ? '' : x}`) }
  const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('mindmap-terminal-storage')).state)
  const drawings = async (sym = 'XAUUSD') => ((await state()).drawings || {})[sym] || []
  const host = () => page.locator('[data-chart-overlay]').first().evaluate((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height } })
  const xy = (t, p) => page.evaluate(([t, p]) => window.__terminalDraw.toXY(t, p), [t, p])
  const size = () => page.evaluate(() => window.__terminalDraw.size())
  // pixel colour at a page point (composited from the chart canvases)
  // most saturated pixel in a (2r+1)² window around a page point (composited from the chart canvases)
  const pixel = (x, y, r = 4) => page.evaluate(([x, y, r]) => {
    const n = 2 * r + 1
    const c = document.createElement('canvas'); c.width = n; c.height = n
    const g = c.getContext('2d', { willReadFrequently: true })
    for (const cv of document.querySelectorAll('.tm-root canvas')) {
      const b = cv.getBoundingClientRect()
      if (x + r < b.left || x - r > b.right || y + r < b.top || y - r > b.bottom) continue
      const kx = cv.width / b.width, ky = cv.height / b.height
      try { g.drawImage(cv, (x - r - b.left) * kx, (y - r - b.top) * ky, n * kx, n * ky, 0, 0, n, n) } catch {}
    }
    const d = g.getImageData(0, 0, n, n).data
    let best = [0, 0, 0, 0], bs = -1
    for (let i = 0; i < d.length; i += 4) { const sat = Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]); if (sat > bs) { bs = sat; best = [d[i], d[i + 1], d[i + 2], d[i + 3]] } }
    return best
  }, [x, y, r])
  return { browser, page, errors, res, check, state, drawings, host, xy, size, pixel, done: async () => { const bad = res.filter((x) => !x).length; console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors'); console.log(`${res.length - bad}/${res.length} passed`); await browser.close(); process.exit(bad || errors.length ? 1 : 0) } }
}
