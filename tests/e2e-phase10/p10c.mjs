import { chromium } from 'playwright'
const OUT = './e2e-shots'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] })
const errors = []
const res = []
const check = (n, ok, x = '') => { res.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${n} ${ok ? '' : x}`) }
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] })
await ctx.addInitScript(() => { try { if (!localStorage.getItem('seeded')) { localStorage.setItem('seeded', '1'); localStorage.setItem('mindmap-terminal-storage', JSON.stringify({ version: 0, state: { isOpen: true, settings: { oneClick: true, lots: 0.1 } } })); } localStorage.setItem('terminal-debug', '1') } catch {} })
const page = await ctx.newPage()
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)) })
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'load' })
await page.waitForSelector('.tm-root', { timeout: 15000 })
await page.waitForTimeout(1500)
const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('mindmap-terminal-storage')).state)
const lines = () => page.evaluate(() => window.__terminalLines())
const ovRect = () => page.locator('[data-chart-overlay]').first().evaluate((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height } })
const yOf = (p) => page.evaluate((v) => window.__terminalPriceToY(v), p)
const settle = (ms = 600) => page.waitForTimeout(ms)
const clearToasts = () => page.waitForTimeout(5000)

await page.locator('button:has-text("BUY")').first().click(); await settle(900)
let pos = (await state()).positions[0]
const R = await ovRect()
const pill = page.locator('[data-pill="position"]').first()

// quick bracket (defaults 20 pips SL / 40 pips TP; gold pip = 0.1 -> $2 / $4)
await pill.locator('button[aria-label^="Quick bracket"]').click(); await settle()
pos = (await state()).positions[0]
check('quick bracket sets SL and TP from the default distances in ONE change', Math.abs(pos.entry - pos.sl - 2) < 0.011 && Math.abs(pos.tp - pos.entry - 4) < 0.011 && pos.log.length === 2, JSON.stringify([pos.entry, pos.sl, pos.tp]))
check('after both exist the +SL / +TP / bracket buttons are gone', await pill.locator('button:has-text("+SL")').count() === 0 && await pill.locator('button[aria-label^="Quick bracket"]').count() === 0)
await page.screenshot({ path: OUT + '/10-bracket.png' })

// menu
await pill.locator('button[aria-label="More actions"]').click()
const menu = page.locator('[role=menu][aria-label^="Position"]')
check('"…" menu lists the actions', (await menu.innerText()).includes('Close half') && (await menu.innerText()).includes('break-even') && (await menu.innerText()).includes('Trail') && (await menu.innerText()).includes('Copy ticket id'))
await page.screenshot({ path: OUT + '/11-pill-menu.png' })
await menu.locator('text=Move SL to break-even').click(); await settle()
check('break-even while not in profit is refused with a reason', await page.locator('text=Break-even needs price beyond your entry').count() > 0)
await pill.locator('button[aria-label="More actions"]').click()
await menu.locator('text=Trail SL').click()
await page.fill('#pm-' + pos.id, '12'); await page.keyboard.press('Enter'); await settle()
check('trail SL sets a 12-pip trailing stop', (await state()).positions[0].trail === 12)
await pill.locator('button[aria-label="More actions"]').click()
await menu.locator('text=Copy ticket id').click(); await settle(300)
check('copy ticket id puts the id on the clipboard', (await page.evaluate(() => navigator.clipboard.readText())) === pos.id)
await pill.locator('button[aria-label="More actions"]').click()
await menu.locator('text=Close half').click(); await settle()
let st = await state()
check('close half: 0.05 lots left and a history row of 0.05', st.positions[0].lots === 0.05 && st.history[0].lots === 0.05)
await pill.locator('button[aria-label="More actions"]').click()
await menu.locator('text=Close custom lots').click()
await page.fill('#pm-' + pos.id, '0.05'); await page.keyboard.press('Enter'); await settle(300)
check('custom close of the WHOLE position is refused with a reason', await page.locator('text=Use Close to close the whole position').count() > 0 && (await state()).positions[0].lots === 0.05)
await page.fill('#pm-' + pos.id, '0.02'); await page.keyboard.press('Enter'); await settle()
st = await state()
check('custom close: exactly 0.02 closed, 0.03 left', st.positions[0].lots === 0.03 && st.history[0].lots === 0.02)

// reverse
await pill.locator('button[aria-label="Reverse position"]').click(); await settle(900)
st = await state()
check('reverse: now a SELL of the same lots, the BUY is in history', st.positions.length === 1 && st.positions[0].side === 'sell' && st.positions[0].lots === 0.03 && st.history[0].reason === 'reverse')
await page.screenshot({ path: OUT + '/12-reversed.png' })

// right-click menu: place a limit (one-click ON -> placed directly)
await clearToasts()
let q = (await lines())
const entryY = q.find((l) => l.kind === 'entry').y
const belowY = await yOf(st.positions[0].entry - 12)
await page.mouse.click(R.x + 450, R.y + belowY, { button: 'right' }); await settle(250)
const cm = page.locator('[role=menu][aria-label="Chart menu"]')
check('right-click menu appears with a price and the order choices', await cm.isVisible() && /@ \d/.test(await cm.innerText()))
console.log('chart menu:', (await cm.innerText()).replace(/\n/g, ' | '))
await page.screenshot({ path: OUT + '/13-chart-menu.png' })
await cm.locator('button:has-text("limit here")').first().click(); await settle(700)
st = await state()
check('a pending order was placed at the clicked price', st.orders.length === 1 && Math.abs(st.orders[0].price - (st.positions[0].entry - 12)) < 1)
const ordPill = page.locator('[data-pill="order"]').first()
check('pending order pill with type / lots / price and a cancel button', await ordPill.isVisible() && /LIMIT/.test(await ordPill.innerText()) && await ordPill.locator('button[aria-label="Cancel order"]').isVisible())
await page.screenshot({ path: OUT + '/14-pending-pill.png' })
// drag the order line
const oid = st.orders[0].id, op0 = st.orders[0].price
const oy0 = (await lines()).find((l) => l.kind === 'order').y
const oy1 = await yOf(op0 - 4)
await page.mouse.move(R.x + 450, R.y + oy0); await page.mouse.down(); await page.mouse.move(R.x + 450, R.y + (oy0 + oy1) / 2, { steps: 3 }); await page.mouse.move(R.x + 450, R.y + oy1, { steps: 4 }); await page.mouse.up(); await settle()
st = await state()
check('dragging the pending order line moves its price', Math.abs(st.orders[0].price - (op0 - 4)) < 1 && st.orders[0].price !== op0, `${st.orders[0].price} vs ${op0 - 4}`)
await ordPill.locator('button[aria-label="Cancel order"]').click(); await settle()
check('cancel from the pill removes the order', (await state()).orders.length === 0)

// draw horizontal line from the menu
await clearToasts()
await page.mouse.click(R.x + 450, R.y + (await yOf(st.positions[0].entry + 6)), { button: 'right' }); await settle(250)
await cm.locator('text=Draw horizontal line').click(); await settle()
check('"Draw horizontal line" adds a drawing at that price', ((await state()).drawings?.XAUUSD || []).some((d) => d.type === 'hline'))

// hover "+" at the price scale
await page.mouse.move(R.x + R.w - 30, R.y + 250); await settle(200)
const plus = page.locator('button[aria-label="Order or line at this price"]')
check('hover over the price scale shows the "+"', await plus.isVisible())
await plus.click(); await settle(250)
check('the "+" opens the same menu', await cm.isVisible())
await page.keyboard.press('Escape')

// confirm close dialog
await page.evaluate(() => {})
page.once('dialog', (d) => { check('confirm dialog text for close from the pill', /Close SELL/.test(d.message()), d.message()); d.dismiss() })
await page.click('button:has-text("Terminal settings"), button[aria-label="Terminal settings"]'); await page.waitForSelector('[role=dialog][aria-label="Terminal settings"]')
await page.click('[role=tab]:has-text("Trading")'); await settle(200)
await page.screenshot({ path: OUT + '/15-settings-trading.png' })
await page.locator('text=Confirm before closing a position').locator('xpath=ancestor::*[self::label or self::div][1]').locator('input,button[role=switch]').first().click().catch(() => {})
console.log('settings text:', (await page.locator('[role=tabpanel]').innerText()).split('\n').filter((l) => /Stops|Snap|Default|Margin warning|Reverse|Extend|Position pill|R-multiple/.test(l)).join(' | '))
await page.keyboard.press('Escape')
console.log('RESULT', res.filter(Boolean).length + '/' + res.length, 'errors', JSON.stringify(errors))
await browser.close()
