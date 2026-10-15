import { chromium } from 'playwright'
const OUT = './e2e-shots'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] })
const errors = [], res = []
const check = (n, ok, x = '') => { res.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${n} ${ok ? '' : x}`) }
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
await ctx.addInitScript(() => { try { if (!localStorage.getItem('seeded')) { localStorage.setItem('seeded', '1'); localStorage.setItem('mindmap-terminal-storage', JSON.stringify({ version: 0, state: { isOpen: true, settings: { oneClick: true, lots: 0.01 }, chartSettings: { theme: 'light', trading: { marginWarn: 1000 } } } })); } localStorage.setItem('terminal-debug', '1') } catch {} })
const page = await ctx.newPage()
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)) })
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'load' })
await page.waitForSelector('.tm-root'); await page.waitForTimeout(1500)
const buy = page.locator('button:has-text("BUY")').first()
for (let i = 0; i < 10; i++) { await buy.click(); await page.waitForTimeout(150) }
await page.waitForTimeout(800)
const n = (await page.evaluate(() => JSON.parse(localStorage.getItem('mindmap-terminal-storage')).state.positions.length))
check('10 positions open', n === 10, String(n))
check('10 pills rendered', await page.locator('[data-pill="position"]').count() === 10)
const boxes = await page.locator('[data-pill="position"]').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).filter((r) => r.width).map((r) => [Math.round(r.top), Math.round(r.bottom)]).sort((a, b) => a[0] - b[0]))
let overlap = 0; for (let i = 1; i < boxes.length; i++) if (boxes[i][0] < boxes[i - 1][1] - 1) overlap++
check('pills do not overlap each other', overlap === 0, JSON.stringify(boxes))
check('strip shows the amber warning state when margin < warn level', (await page.locator('[data-testid="chart-account-strip"]').getAttribute('data-margin-state')) === 'warn' && /low/.test(await page.locator('[data-testid="strip-margin"]').innerText()))
await page.screenshot({ path: OUT + '/40-light-10pos.png' })
// frame rate while panning the chart with 10 positions
const R = await page.locator('[data-chart-overlay]').first().evaluate((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y } })
await page.evaluate(() => { window.__fr = []; let last = performance.now(); const f = (t) => { window.__fr.push(t - last); last = t; if (window.__fr.length < 400) requestAnimationFrame(f) }; requestAnimationFrame(f) })
await page.mouse.move(R.x + 700, R.y + 400); await page.mouse.down()
for (let i = 0; i < 60; i++) await page.mouse.move(R.x + 700 - i * 6, R.y + 400 + (i % 2 ? 5 : -5))
await page.mouse.up()
await page.waitForTimeout(500)
const fr = await page.evaluate(() => window.__fr)
const avg = fr.reduce((a, b) => a + b, 0) / fr.length, worst = Math.max(...fr)
console.log('avg frame ms', avg.toFixed(1), 'worst', worst.toFixed(0), 'frames', fr.length)
check('panning with 10 positions averages under 20 ms/frame (headless software render)', avg < 20, avg.toFixed(1))
console.log('RESULT', res.filter(Boolean).length + '/' + res.length, 'errors', JSON.stringify(errors))
await browser.close()
