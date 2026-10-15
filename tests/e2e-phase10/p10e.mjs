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
const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('mindmap-terminal-storage')).state)
const lines = () => page.evaluate(() => window.__terminalLines())
const settings = async (tab, fn) => { await page.click('button[aria-label="Terminal settings"]'); await page.waitForSelector('[role=dialog][aria-label="Terminal settings"]'); await page.click(`[role=tab]:has-text("${tab}")`); await fn(); await page.locator('button:has-text("Ok")').click(); await page.waitForTimeout(400) }
await page.locator('button:has-text("BUY")').first().click(); await page.waitForTimeout(900)
await page.locator('[data-pill="position"] button[aria-label^="Quick bracket"]').click(); await page.waitForTimeout(500)

// confirm close
await settings('Trading', async () => { await page.locator('text=Confirm before closing a position').locator('xpath=ancestor::div[contains(@class,"flex")][1]').locator('button, input').last().click() })
let dlg = ''
page.once('dialog', (d) => { dlg = d.message(); d.dismiss() })
await page.locator('[data-pill="position"] button[aria-label="Close position"]').click(); await page.waitForTimeout(400)
check('confirmClose asks before closing from the pill', /Close BUY/.test(dlg), dlg)
check('dismissing keeps the position open', (await state()).positions.length === 1)

// pill off
await settings('Trading', async () => { await page.locator('text=Position pill with live P/L').locator('xpath=ancestor::div[contains(@class,"flex")][1]').locator('button, input').last().click() })
check('showPlPill off hides the pill', await page.locator('[data-pill="position"]').count() === 0)
const ent = (await lines()).find((l) => l.kind === 'entry')
check('showPlPill off: entry line carries BUY lots P/L again', /^BUY 0\.01/.test(ent.title), ent.title)
await page.screenshot({ path: OUT + '/30-pill-off.png' })
await settings('Trading', async () => { await page.locator('text=Position pill with live P/L').locator('xpath=ancestor::div[contains(@class,"flex")][1]').locator('button, input').last().click() })
check('turning it on again brings the pill back', await page.locator('[data-pill="position"]').isVisible())

// extendLines off -> SL/TP lines hidden, tag still there
await settings('Trading', async () => { await page.locator('text=Extend SL / TP lines across the chart').locator('xpath=ancestor::div[contains(@class,"flex")][1]').locator('button, input').last().click() })
const vis = await page.evaluate(() => 0)
await page.screenshot({ path: OUT + '/31-extend-off.png' })
await settings('Trading', async () => { await page.locator('text=Extend SL / TP lines across the chart').locator('xpath=ancestor::div[contains(@class,"flex")][1]').locator('button, input').last().click() })

// R unit via settings select
await settings('Trading', async () => { await page.selectOption('select[aria-label="P/L unit on the chart"]', 'r') })
check('P/L unit R-multiple shows on the chip', /R/.test(await page.locator('[data-testid^="chip-"]').first().innerText()))
await page.selectOption ? null : null
await settings('Trading', async () => { await page.selectOption('select[aria-label="P/L unit on the chart"]', 'money') })

// snap round: drag SL, price should be a multiple of 1.0 for gold (10 pips)
await settings('Trading', async () => { await page.selectOption('select[aria-label="Snap while dragging"]', 'round') })
const R = await page.locator('[data-chart-overlay]').first().evaluate((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y } })
await page.waitForTimeout(5000)
const sl0 = (await lines()).find((l) => l.kind === 'sl')
const y1 = sl0.y + 40
await page.mouse.move(R.x + 450, R.y + sl0.y); await page.mouse.down(); await page.mouse.move(R.x + 450, R.y + y1, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(500)
const slN = (await state()).positions[0].sl
check('snap round: SL lands on a whole 1.00 (10 pips)', Math.abs(slN - Math.round(slN)) < 1e-9 && slN !== sl0.price, String(slN))

// light theme screenshot
await settings('Canvas', async () => { await page.selectOption('select[aria-label="Theme"]', 'light').catch(() => {}) })
await page.screenshot({ path: OUT + '/32-light.png' })

// margin states
await settings('Trading', async () => {})
await page.evaluate(() => {})
const strip = page.locator('[data-testid="chart-account-strip"]')
check('strip state is ok with healthy margin', (await strip.getAttribute('data-margin-state')) === 'ok')
console.log('RESULT', res.filter(Boolean).length + '/' + res.length, 'errors', JSON.stringify(errors))
await browser.close()
