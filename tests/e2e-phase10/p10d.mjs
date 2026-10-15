import { chromium } from 'playwright'
const OUT = './e2e-shots'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] })
const errors = []
const res = []
const check = (n, ok, x = '') => { res.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${n} ${ok ? '' : x}`) }
const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 })
await ctx.addInitScript(() => { try { if (!localStorage.getItem('seeded')) { localStorage.setItem('seeded', '1'); localStorage.setItem('mindmap-terminal-storage', JSON.stringify({ version: 0, state: { isOpen: true, settings: { oneClick: true, lots: 0.1 } } })); } localStorage.setItem('terminal-debug', '1') } catch {} })
const page = await ctx.newPage()
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)) })
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'load' })
await page.waitForSelector('.tm-root', { timeout: 15000 })
await page.waitForTimeout(1800)
await page.screenshot({ path: OUT + '/20-mobile-start.png' })
const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('mindmap-terminal-storage')).state)
const lines = () => page.evaluate(() => window.__terminalLines())
const ovRect = () => page.locator('[data-chart-overlay]').first().evaluate((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height } })
const yOf = (p) => page.evaluate((v) => window.__terminalPriceToY(v), p)
const cdp = await ctx.newCDPSession(page)
const touch = async (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] })

// BUY from the bottom bar
await page.locator('button:has-text("BUY")').first().tap(); await page.waitForTimeout(900)
await page.screenshot({ path: OUT + '/20b-mobile-sheet.png' })
await page.locator('button:has-text("BUY")').last().tap(); await page.waitForTimeout(1200)
let st = await state()
check('mobile: one-tap BUY opened a position', st.positions.length === 1)
const R = await ovRect()
const pill = page.locator('[data-pill="position"]').first()
check('mobile: pill visible', await pill.isVisible())
const pb = await pill.boundingBox()
console.log('pill box', JSON.stringify(pb))
check('mobile: pill fits inside the 360 px screen', pb.x >= 0 && pb.x + pb.width <= 360, JSON.stringify(pb))
const btns = await pill.locator('button').evaluateAll((els) => els.filter((e) => e.offsetParent).map((e) => { const r = e.getBoundingClientRect(); return [e.getAttribute('aria-label'), Math.round(r.width), Math.round(r.height)] }))
console.log('buttons', JSON.stringify(btns))
check('mobile: every pill button is >= 40 px', btns.every((b) => b[1] >= 40 && b[2] >= 40), JSON.stringify(btns))
check('mobile: no horizontal page scroll', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
await page.screenshot({ path: OUT + '/21-mobile-pill.png' })

// add SL through the menu + tap place mode
await pill.locator('button[aria-label="More actions"]').tap()
await page.locator('[role=menu] >> text=Add stop loss').tap(); await page.waitForTimeout(300)
check('mobile: place mode opens', await page.locator('[data-testid="place-layer"]').isVisible())
const entry = st.positions[0].entry
const y = await yOf(entry - 6)
await page.touchscreen.tap(R.x + 180, R.y + y); await page.waitForTimeout(700)
st = await state()
check('mobile: tap places the SL', st.positions[0].sl != null && Math.abs(st.positions[0].sl - (entry - 6)) < 1.5, String(st.positions[0].sl))
await page.screenshot({ path: OUT + '/22-mobile-sl.png' })

// touch drag SL (44 px band)
await page.waitForTimeout(5200)
const sl0 = st.positions[0].sl
const ly = (await lines()).find((l) => l.kind === 'sl').y
const ty = await yOf(sl0 - 4)
const gx = R.x + 200, gy = R.y + ly + 15 // 15 px off the line: inside the 22 px touch band
await touch('touchStart', gx, gy)
for (let i = 1; i <= 8; i++) await touch('touchMove', gx, gy + ((ty + 15 - ly) * i) / 8)
await page.waitForTimeout(500)
const lines0Title = (await lines()).find((l) => l.kind === 'sl').title
const mid = (await lines()).find((l) => l.kind === 'sl')
check('mobile: touch drag moves the ghost line and updates the tag', /SL/.test(mid.title) && mid.title !== (await lines0Title), JSON.stringify([mid.y, ty, mid.title]))
check('mobile: the page/chart did not scroll while dragging', await page.evaluate(() => window.scrollY === 0))
await page.screenshot({ path: OUT + '/23-mobile-dragging.png' })
await touch('touchEnd')
await page.waitForTimeout(600)
st = await state()
check('mobile: touch release commits the new SL', st.positions[0].sl !== sl0 && Math.abs(st.positions[0].sl - (sl0 - 4)) < 1.5, `${st.positions[0].sl} vs ${sl0 - 4}`)

// long-press menu
await page.waitForTimeout(5200)
const ry = await yOf(entry + 8)
await touch('touchStart', R.x + 120, R.y + ry)
await page.waitForTimeout(800)
await touch('touchEnd')
await page.waitForTimeout(300)
check('mobile: long-press opens the chart menu', await page.locator('[role=menu][aria-label="Chart menu"]').isVisible())
await page.screenshot({ path: OUT + '/24-mobile-menu.png' })
console.log('RESULT', res.filter(Boolean).length + '/' + res.length, 'errors', JSON.stringify(errors))
await browser.close()
