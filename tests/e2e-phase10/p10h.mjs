import { chromium } from 'playwright'
const OUT = './e2e-shots'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] })
const errors = [], res = []
const check = (n, ok, x = '') => { res.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${n} ${ok ? '' : x}`) }
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
await ctx.addInitScript(() => { try { if (!localStorage.getItem('seeded')) { localStorage.setItem('seeded', '1'); localStorage.setItem('mindmap-terminal-storage', JSON.stringify({ version: 0, state: { isOpen: true, settings: { oneClick: true, lots: 0.01 } } })); } localStorage.setItem('terminal-debug', '1') } catch {} })
const page = await ctx.newPage()
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)) })
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'load' })
await page.waitForSelector('.tm-root'); await page.waitForTimeout(1500)
await page.locator('button:has-text("BUY")').first().click(); await page.waitForTimeout(800)
await page.locator('button[aria-label*="ayout"], button[title*="ayout"]').nth(1).click().catch(async () => { await page.mouse.click(614, 55) })
await page.waitForTimeout(1500)
await page.screenshot({ path: OUT + '/50-multichart.png' })
const charts = await page.locator('[data-chart-overlay]').count()
console.log('overlays', charts, 'pills', await page.locator('[data-pill="position"]').count(), 'strips', await page.locator('[data-testid="chart-account-strip"]').count())
check('2-chart layout: pill only on the chart showing XAUUSD', charts >= 2 && await page.locator('[data-pill="position"]').count() === 1)
check('2-chart layout: one account strip (active chart)', await page.locator('[data-testid="chart-account-strip"]').count() === 1)
console.log('RESULT', res.filter(Boolean).length + '/' + res.length, 'errors', JSON.stringify(errors))
await browser.close()
