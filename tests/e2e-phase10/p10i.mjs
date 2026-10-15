import { chromium } from 'playwright'
const OUT = './e2e-shots'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] })
const errors = [], res = []
const check = (n, ok, x = '') => { res.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${n} ${ok ? '' : x}`) }
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
await ctx.addInitScript(() => { try { if (!localStorage.getItem('seeded')) { localStorage.setItem('seeded', '1'); localStorage.setItem('mindmap-terminal-storage', JSON.stringify({ version: 0, state: { isOpen: true, settings: { oneClick: true, lots: 0.1 } } })); } localStorage.setItem('terminal-debug', '1') } catch {} })
const page = await ctx.newPage()
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)) })
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'load' })
await page.waitForSelector('.tm-root'); await page.waitForTimeout(1500)
const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('mindmap-terminal-storage')).state)
const lines = () => page.evaluate(() => window.__terminalLines())
const yOf = (p) => page.evaluate((v) => window.__terminalPriceToY(v), p)
const R = await page.locator('[data-chart-overlay]').first().evaluate((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y } })
// place a buy limit via right-click below price
const ask = await page.evaluate(() => 0)
await page.mouse.click(R.x + 450, R.y + 330, { button: 'right' }); await page.waitForTimeout(250)
await page.locator('[role=menu][aria-label="Chart menu"] button:has-text("limit here")').first().click(); await page.waitForTimeout(800)
let o = (await state()).orders[0]
check('limit placed', !!o, JSON.stringify(o))
const pill = page.locator('[data-pill="order"]').first()
check('order pill has +SL +TP and bracket', await pill.locator('button:has-text("+SL")').count() === 1 && await pill.locator('button:has-text("+TP")').count() === 1 && await pill.locator('button[aria-label^="Quick bracket"]').count() === 1)
// +SL place mode
await pill.locator('button:has-text("+SL")').click()
const dir = o.side === 'buy' ? -1 : 1
const y = await yOf(o.price + dir * 6)
await page.mouse.move(R.x + 450, R.y + y); await page.waitForTimeout(150)
console.log('ghost:', (await page.locator('[data-testid="place-layer"]').innerText()).replace(/\n/g, ' '))
await page.mouse.click(R.x + 450, R.y + y); await page.waitForTimeout(600)
o = (await state()).orders[0]
check('SL set on the pending order from the chart', o.sl != null && Math.abs(o.sl - (o.price + dir * 6)) < 1.2, String(o.sl))
const t1 = (await lines()).find((l) => l.kind === 'osl')
console.log('osl tag:', t1?.title)
check('order SL tag shows projected loss from the order price', /^SL −\$/.test(t1?.title || ''))
// bracket for the missing TP
await page.waitForTimeout(500)
await page.locator('[data-pill="order"] button[aria-label^="Quick bracket"]').click(); await page.waitForTimeout(600)
o = (await state()).orders[0]
check('quick bracket adds the missing TP (default 40 pips = $4)', o.tp != null && Math.abs(Math.abs(o.tp - o.price) - 4) < 0.011, String(o.tp))
check('buttons vanish when both exist', await page.locator('[data-pill="order"] button:has-text("+SL")').count() === 0)
await page.waitForTimeout(5000)
// drag the order's SL
const sl = (await lines()).find((l) => l.kind === 'osl'), before = o.sl
const y1 = await yOf(before + dir * 3)
await page.mouse.move(R.x + 450, R.y + sl.y); await page.mouse.down(); await page.mouse.move(R.x + 450, R.y + (sl.y + y1) / 2, { steps: 3 }); await page.mouse.move(R.x + 450, R.y + y1, { steps: 3 }); await page.mouse.up(); await page.waitForTimeout(500)
o = (await state()).orders[0]
check('dragging the order SL moves it', o.sl !== before && Math.abs(o.sl - (before + dir * 3)) < 1.2, `${o.sl} vs ${before}`)
await page.screenshot({ path: OUT + '/60-order-sltp.png' })
console.log('RESULT', res.filter(Boolean).length + '/' + res.length, 'errors', JSON.stringify(errors))
await browser.close()
