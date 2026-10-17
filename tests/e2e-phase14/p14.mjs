import { boot, OUT } from '../e2e-phase11/lib.mjs'
import { mockApi } from './mock.mjs'

let code = 0
const WED = new Date('2026-10-14T13:05:00Z') // market open
const SAT = new Date('2026-10-17T12:00:00Z') // market closed
const run = async (name, opts, body) => {
  console.log(`\n── ${name}`)
  const log = []
  const T = await boot({ ...opts, setup: async (ctx, page) => { await page.clock.setFixedTime(opts.at); await mockApi(ctx, { nowMs: opts.at.getTime(), fail: opts.fail, log }) } })
  T.log = log
  await body(T)
  const errs = T.errors.filter((e) => !(opts.expectError && opts.expectError.test(e)))
  const bad = T.res.filter((x) => !x).length
  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no page errors', `\n${T.res.length - bad}/${T.res.length} passed`)
  if (bad || errs.length) code = 1
  await T.browser.close()
}
const wrap = (p) => p.catch((e) => { console.log('FAIL (exception)', e.message); code = 1 })

// 1. open market, desktop
await wrap(run('open market (Wed 13:05 UTC), 1440 px', { at: WED, seed: { settings: { oneClick: false, sound: false } } }, async (T) => {
  const { page, check } = T
  await page.waitForTimeout(1500)
  check('badge says Live', (await page.locator('[data-testid="feed-badge"]').getAttribute('data-state')) === 'live')
  check('only the XAUUSD chip, no other symbols anywhere', (await page.locator('[data-testid="symbol-chip"]').innerText()) === 'XAUUSD' && !/EURUSD|GBPUSD|USDJPY|GBPJPY|NIFTY/.test(await page.locator('.tm-root').innerText()))
  check('chart canvas drawn, skeleton gone', (await page.locator('.tm-root canvas').count()) > 0 && (await page.locator('[data-testid="chart-skeleton"]').count()) === 0)
  const txt = await page.locator('.tm-root').innerText()
  check('footer names the provider and says prices are indicative', /Twelve Data/.test(txt) && /Prices are indicative, for practice only/.test(txt))
  check('no "simulated prices" wording on screen', !/simulated prices/i.test(txt))
  check('market dot says Open', /Open/.test(await page.locator('[data-testid="market-dot"]').innerText().catch(() => 'Open')))
  check('no market-closed strip', (await page.locator('[data-testid="market-closed-strip"]').count()) === 0)
  const reqs = T.log
  check(`network: only same-origin /api/* (${reqs.length} calls, e.g. ${reqs[0]})`, reqs.length > 0 && reqs.every((u) => u.startsWith('/api/')))
  // buy through the real ticket
  const before = (await T.state()).positions.length
  await page.getByRole('button', { name: /^BUY/i }).first().click().catch(() => {})
  await page.waitForTimeout(600)
  const confirm = page.getByRole('button', { name: /confirm|buy .* xauusd/i }).first()
  if (await confirm.isVisible().catch(() => false)) await confirm.click()
  await page.waitForTimeout(800)
  const after = (await T.state()).positions
  check('BUY works on live prices; position tagged source:live', after.length === before + 1 && after[after.length - 1].source === 'live', JSON.stringify(after.slice(-1)))
  await page.screenshot({ path: OUT + '/14-live-desktop.png' })
  // tooltip text
  const tip = await page.locator('[data-testid="feed-badge"]').getAttribute('title')
  check('badge tooltip: provider, last update, reason line', /Twelve Data/.test(tip) && /Last update/.test(tip))
  // other multi-chart layout shows XAUUSD on other timeframes
  await page.evaluate(() => window.__terminalStore.getState().setLayout(4)); await page.waitForTimeout(2500)
  const labels = await page.locator('.tm-root').innerText()
  check('4-chart layout: XAUUSD on four timeframes', (labels.match(/XAUUSD · /g) || []).length >= 4, (labels.match(/XAUUSD · \w+/g) || []).join(','))
  await page.screenshot({ path: OUT + '/14-live-4charts.png' })
}))

// 2. closed market
await wrap(run('closed market (Sat), 1440 px', { at: SAT, seed: { settings: { oneClick: false, sound: false } } }, async (T) => {
  const { page, check } = T
  await page.waitForTimeout(1500)
  check('badge says Market closed', (await page.locator('[data-testid="feed-badge"]').getAttribute('data-state')) === 'closed')
  const strip = await page.locator('[data-testid="market-closed-strip"]').innerText()
  check(`strip shows the countdown ("${strip.slice(0, 40)}…")`, /Market closed — opens in 1d 10h/.test(strip))
  const r = await page.evaluate(() => window.__terminalStore.getState().openPosition({ symbol: 'XAUUSD', side: 'buy', lots: 0.1 }, { XAUUSD: { bid: 4350, ask: 4350.3 } }))
  check('market order refused with the same message, nothing opened', r.ok === false && /Market closed — opens in 1d 10h/.test(r.error) && (await T.state()).positions.length === 0, JSON.stringify(r))
  await page.screenshot({ path: OUT + '/14-closed.png' })
}))

// 3. error state with Retry
{
  let failing = true
  await wrap(run('provider quota error -> error state -> Retry', { at: WED, expectError: /429/, fail: (u) => (failing && u.pathname.endsWith('/candles') ? { status: 429, code: 'QUOTA', message: 'Data provider quota reached — try again later' } : null) }, async (T) => {
    const { page, check } = T
    await page.waitForSelector('[data-testid="chart-error"]', { timeout: 8000 })
    const t = await page.locator('[data-testid="chart-error"]').innerText()
    check('friendly error with the real reason + Retry button', /Couldn’t load gold prices/.test(t) && /quota/i.test(t))
    await page.screenshot({ path: OUT + '/14-error.png' })
    failing = false
    await page.locator('[data-testid="chart-retry"]').click()
    await page.waitForTimeout(1500)
    check('Retry loads the chart', (await page.locator('[data-testid="chart-error"]').count()) === 0 && (await page.locator('[data-testid="chart-skeleton"]').count()) === 0)
  }))
}

// 4. migration dialog for an old simulated account
await wrap(run('old simulated account -> migration dialog', {
  at: WED,
  seed: { account: { balance: 10250, startBalance: 10000, currency: 'USD', leverage: 100, createdAt: 1 }, positions: [{ id: 'p1', symbol: 'EURUSD', side: 'buy', lots: 0.5, entry: 1.1, openTime: 5, leverage: 100 }], orders: [], history: [{ id: 'h1', symbol: 'GBPUSD', side: 'buy', lots: 1, entry: 1.3, exit: 1.31, pnl: 25, closeTime: 9, openTime: 1, reason: 'manual' }], nextId: 12 },
}, async (T) => {
  const { page, check } = T
  await page.waitForTimeout(1200)
  check('dialog is shown', await page.locator('[data-testid="migration-dialog"]').isVisible())
  const t = await page.locator('[data-testid="migration-dialog"]').innerText()
  check('wording: "Live data is on" + old trades used simulated prices', /Live data is on/.test(t) && /simulated prices/.test(t))
  await page.screenshot({ path: OUT + '/14-migration.png' })
  await page.locator('[data-testid="mig-keep"]').click(); await page.waitForTimeout(500)
  const s = await T.state()
  check('Keep history: dialog gone, balance unchanged, old open trade closed flat, tagged simulated', !(await page.locator('[data-testid="migration-dialog"]').count()) && s.account.balance === 10250 && s.positions.length === 0 && s.history.every((h) => h.source === 'simulated') && s.history.find((h) => h.positionId === 'p1').pnl === 0, JSON.stringify(s.history))
  await page.reload({ waitUntil: 'load' }); await page.waitForSelector('.tm-root'); await page.waitForTimeout(1200)
  check('after a reload the dialog does not come back (idempotent)', (await page.locator('[data-testid="migration-dialog"]').count()) === 0)
}))

// 5. phone width
await wrap(run('open market, 360 px phone', { at: WED, width: 360, height: 740, touch: true, seed: { settings: { sound: false } } }, async (T) => {
  const { page, check } = T
  await page.waitForTimeout(1500)
  const b = await page.locator('[data-testid="feed-badge"]').boundingBox()
  check('badge visible inside the screen', !!b && b.x >= 0 && b.x + b.width <= 360 + 1, JSON.stringify(b))
  check('no horizontal page scroll', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
  await page.screenshot({ path: OUT + '/14-live-mobile.png' })
}))
process.exit(code)
