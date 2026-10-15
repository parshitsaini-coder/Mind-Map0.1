import { boot, OUT } from '../e2e-phase11/lib.mjs'
const W = Number(process.env.W || 1440), Hh = Number(process.env.H || 900)
const T = await boot({ width: W, height: Hh, touch: W < 500, seed: { settings: { oneClick: true, sound: false } } })
const { page, check } = T
const tag = W < 500 ? 'm' : 'd'
const store = (fn, arg) => page.evaluate(([fn, arg]) => { const s = window.__terminalStore.getState(); return s[fn](...(arg || [])) }, [fn, arg])
const quotes = () => page.evaluate(async () => (await import('/src/lib/terminal/quoteHub.js')).getSnapshot())
const emit = (id, data) => page.evaluate(async ([id, data]) => { const q = (await import('/src/lib/terminal/quoteHub.js')).getSnapshot()?.XAUUSD; const mid = q ? (q.bid + q.ask) / 2 : 1; (await import('/src/lib/terminal/effects.js')).emitTerminalEvent({ id, data: { symbol: 'XAUUSD', side: 'buy', lots: 0.1, price: mid, pnl: 90, orderType: 'limit', ...data } }) }, [id, data || {}])
const popup = () => page.locator('[data-testid="order-popup"]')
const wait = (ms) => page.waitForTimeout(ms)
const setAnim = (p) => page.evaluate((p) => window.__terminalStore.getState().setChartSettings({ anim: p }), p)
const fxPixels = () => page.evaluate(() => { const c = document.querySelector('[data-testid="chart-fx"]'); const g = c.getContext('2d'); const d = g.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 20) n++; return n })

await wait(800)
// 1. market buy → popup + toast; entrance time
const t0 = Date.now()
await page.evaluate(async () => { const q = (await import('/src/lib/terminal/quoteHub.js')).getSnapshot(); window.__terminalStore.getState().openPosition({ symbol: 'XAUUSD', side: 'buy', lots: 0.1 }, q) })
await popup().waitFor({ state: 'visible', timeout: 2000 })
const entrance = Date.now() - t0
check('popup appears for a market buy', await popup().getAttribute('data-variant') === 'filled')
const fillPx = await fxPixels()
check(`popup entrance is fast (${entrance} ms incl. page eval)`, entrance < 600)
await wait(120)
await page.screenshot({ path: OUT + `/13-${tag}-buy-120ms.png` })
await wait(400)
await page.screenshot({ path: OUT + `/13-${tag}-buy-520ms.png` })
check('the toast is shown too and has an icon', (await page.locator('[data-testid="toast"] svg').count()) >= 1)
check(`chart effect canvas drew the entry sweep / ring (${fillPx} px)`, fillPx > 20)
await wait(1500)
check('popup is gone after its time (≈1.6 s)', (await popup().count()) === 0)

// 2. dismiss early: click, Esc, swipe
await emit('order.pending.placed', { orderType: 'limit' })
await popup().waitFor({ state: 'visible' })
await popup().click(); await wait(400)
check('click dismisses early', (await popup().count()) === 0)
await emit('order.cancelled'); await popup().waitFor({ state: 'visible' })
await page.keyboard.press('Escape'); await wait(400)
check('Esc dismisses the popup (and does not close the terminal)', (await popup().count()) === 0 && (await page.locator('.tm-root').count()) === 1)

// 3. variants
for (const [id, title, extra] of [
  ['order.sell.filled', 'SELL FILLED', { side: 'sell' }], ['order.pending.placed', 'BUY LIMIT PLACED', {}], ['order.pending.triggered', 'LIMIT FILLED', {}],
  ['order.modified', 'SL MOVED', { what: 'SL', from: 4331.2, to: 4336 }], ['order.cancelled', 'ORDER CANCELLED', {}], ['order.rejected', 'ORDER REJECTED', { reason: 'Stop loss must be below the price' }],
  ['position.closed.win', 'CLOSED IN PROFIT', {}], ['position.closed.loss', 'CLOSED AT A LOSS', { pnl: -45 }], ['position.tp.hit', 'TARGET HIT', {}], ['position.sl.hit', 'STOPPED OUT', { pnl: -45, side: 'sell' }],
  ['position.reversed', 'REVERSED', {}], ['position.partial', 'PARTIAL CLOSE', {}]]) {
  await emit(id, extra)
  await popup().waitFor({ state: 'visible' })
  const txt = await page.locator('[data-testid="popup-title"]').innerText()
  check(`variant ${id}: "${txt}"`, txt.startsWith(title))
  if (id === 'position.tp.hit' || id === 'order.rejected') { await wait(350); await page.screenshot({ path: OUT + `/13-${tag}-${id}.png` }) }
  await page.keyboard.press('Escape'); await wait(250)
}

// 4. count-up ends exactly on the final value
await emit('position.closed.win', { pnl: 90 })
await wait(1000)
const pnlTxt = await page.locator('[data-testid="popup-pnl"]').innerText()
check(`P/L count-up ends on +$90.00 (${pnlTxt})`, pnlTxt === '+$90.00')
await page.keyboard.press('Escape'); await wait(250)

// 5. chart effects: TP shockwave draws something on the fx canvas, cap of 6
await emit('position.tp.hit'); await wait(250)
const px = await fxPixels()
check(`TP hit draws on the chart effects canvas (${px} px)`, px > 50)
await page.screenshot({ path: OUT + `/13-${tag}-tp-chart.png` })
await wait(1800)
check('the canvas is clean again after the effects end', (await fxPixels()) === 0)
await page.evaluate(async () => { const m = await import('/src/lib/terminal/effects.js'); const q = (await import('/src/lib/terminal/quoteHub.js')).getSnapshot().XAUUSD; for (let i = 0; i < 12; i++) m.emitTerminalEvent({ id: i % 2 ? 'position.tp.hit' : 'order.buy.filled', data: { symbol: 'XAUUSD', side: 'buy', price: (q.bid + q.ask) / 2, pnl: 90 } }) })
await wait(100)
const live = Number(await page.locator('[data-testid="chart-fx"]').first().getAttribute('data-fx'))
check(`12 events at once keep at most 6 effects alive (${live})`, live <= 6)

// 6. frame timings during a 6-effect burst
const frames = await page.evaluate(() => new Promise((res) => {
  const ts = []
  let n = 0
  const f = (t) => { ts.push(t); if (++n < 90) requestAnimationFrame(f); else { const d = ts.slice(1).map((x, i) => x - ts[i]); d.sort((a, b) => a - b); res({ avg: d.reduce((a, b) => a + b, 0) / d.length, p95: d[Math.floor(d.length * 0.95)] }) } }
  window.__terminalFire = null
  import('/src/lib/terminal/effects.js').then(async (m) => { const q = (await import('/src/lib/terminal/quoteHub.js')).getSnapshot().XAUUSD; for (let i = 0; i < 6; i++) m.emitTerminalEvent({ id: ['position.tp.hit', 'order.buy.filled', 'order.pending.triggered', 'position.closed.win', 'alert.price', 'position.reversed'][i], data: { symbol: 'XAUUSD', side: 'buy', price: (q.bid + q.ask) / 2 + i, pnl: 90 } }) ; requestAnimationFrame(f) })
}))
console.log(`frame timing during a 6-effect burst: avg ${frames.avg.toFixed(1)} ms, p95 ${frames.p95.toFixed(1)} ms`)
check('burst frame time recorded (headless software rendering, informational)', frames.avg > 0)
const adaptiveAfter = await page.evaluate(() => window.__terminalStore.getState().adaptive)
console.log('adaptive downgrade triggered during burst:', adaptiveAfter)
await page.evaluate(() => window.__terminalStore.getState().setAdaptive(false))
await wait(2000)

// 7. stop-out banner
await emit('account.stopout', { marginLevel: 42, pnl: -300, side: 'buy' })
await page.locator('[data-testid="stopout-banner"]').waitFor({ state: 'visible' })
await wait(450)
await page.screenshot({ path: OUT + `/13-${tag}-stopout.png` })
check('stop-out banner shows the margin level', /margin level 42 %/.test(await page.locator('[data-testid="stopout-banner"]').innerText()))
await wait(2500)
check('banner stays until dismissed', await page.locator('[data-testid="stopout-banner"]').isVisible())
await page.locator('[data-testid="stopout-dismiss"]').click(); await wait(400)
check('dismiss works', (await page.locator('[data-testid="stopout-banner"]').count()) === 0)

// 8. real SL hit + limit trigger through the store tick (end-to-end data path)
await page.evaluate(async () => { const s = window.__terminalStore.getState(); const q = (await import('/src/lib/terminal/quoteHub.js')).getSnapshot(); for (const p of s.positions) s.closePosition(p.id, q) })
await wait(300)
const info = await page.evaluate(async () => {
  const s = () => window.__terminalStore.getState()
  const q = (await import('/src/lib/terminal/quoteHub.js')).getSnapshot().XAUUSD
  s().dismissPopup()
  s().openPosition({ symbol: 'XAUUSD', side: 'buy', lots: 0.1 }, { XAUUSD: q })
  const p = s().positions[0]
  s().modifyPosition(p.id, { sl: p.entry - 5 }, { XAUUSD: q })
  s().dismissPopup()
  s().tick({ XAUUSD: { bid: p.entry - 6, ask: p.entry - 5.7 } })
  return { title: s().popup?.title, pnl: s().popup?.count?.to }
})
check(`SL hit through the engine: popup "${info.title}" with a loss`, info.title === 'STOPPED OUT' && info.pnl < 0)
await wait(300)
await page.screenshot({ path: OUT + `/13-${tag}-sl-engine.png` })

// 9. Settings → Animations tab
await page.keyboard.press('Escape'); await wait(200)
await page.locator('button[aria-label="Terminal settings"]').click()
await page.getByRole('tab', { name: 'Animations' }).click(); await wait(300)
check('Animations tab exists with mode / popup controls', (await page.getByRole('radio', { name: 'Reduced' }).count()) === 1 && (await page.locator('select[aria-label="Order popup"]').count()) === 1)
await page.screenshot({ path: OUT + `/13-${tag}-settings.png` })
await page.getByRole('radio', { name: 'Off' }).click(); await wait(200)
check('mode Off sets data-motion=off on the root', (await page.locator('.tm-root').getAttribute('data-motion')) === 'off')
await page.locator('button:has-text("Ok")').first().click(); await wait(300)
await page.evaluate(() => window.__terminalStore.getState().dismissPopup())
await emit('order.buy.filled')
await wait(400)
check('Animations Off: no animated popup, plain toast instead', (await popup().count()) === 0 && (await page.locator('[data-testid="toast"]').count()) >= 1)
await setAnim({ mode: 'full' })

// 10. system reduced motion
await page.emulateMedia({ reducedMotion: 'reduce' })
await wait(300)
check('prefers-reduced-motion → data-motion=reduced (match system ON)', (await page.locator('.tm-root').getAttribute('data-motion')) === 'reduced')
await emit('position.tp.hit'); await wait(200)
await page.screenshot({ path: OUT + `/13-${tag}-reduced.png` })
await setAnim({ matchSystem: false }); await wait(200)
check('match system OFF → stays full', (await page.locator('.tm-root').getAttribute('data-motion')) === 'full')
await page.emulateMedia({ reducedMotion: 'no-preference' })
await setAnim({ matchSystem: true })

// 11. toasts: stack max 4, pause on hover, swipe/dismiss
await page.evaluate(() => { const s = window.__terminalStore.getState(); s.setChartSettings({ anim: { popup: 'toast' } }); for (let i = 0; i < 7; i++) s.notify('Toast ' + i, 'info') })
await wait(500)
check('toast stack shows at most 4', (await page.locator('[data-testid="toast"]').count()) <= 4)
await page.screenshot({ path: OUT + `/13-${tag}-toasts.png` })
await T.done()
