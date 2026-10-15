import { boot, OUT } from '../e2e-phase11/lib.mjs'
const T = await boot({ seed: { settings: { oneClick: true, sound: true } } })
// headless Chromium never locks audio, so emulate the autoplay policy: the context stays 'suspended' until a real pointer/key event
await T.page.evaluate(() => { window.__gesture = false; window.addEventListener('pointerdown', () => { window.__gesture = true }, true); const P = (window.AudioContext).prototype; Object.defineProperty(P, 'state', { get() { return window.__gesture ? 'running' : 'suspended' }, configurable: true }); P.resume = function () { return Promise.resolve() } })
const { page, check } = T
// count oscillators the real AudioContext is asked to create
await page.evaluate(() => { window.__osc = 0; const P = (window.AudioContext || window.webkitAudioContext).prototype; const o = P.createOscillator; P.createOscillator = function () { window.__osc++; return o.apply(this, arguments) } })
const osc = () => page.evaluate(() => window.__osc)
const Q = { XAUUSD: { bid: 2000, ask: 2000.3 } }
const fire = (id) => page.evaluate((id) => window.__terminalFire(id), id)
await page.evaluate(() => { window.__terminalFire = async (id) => (await import('/src/lib/terminal/effects.js')).emitTerminalEvent(id) })

// 1. no gesture yet → a sound is due but the context is locked → chip
await fire('order.buy.filled')
await page.waitForTimeout(400)
const locked = await page.evaluate(() => { const c = document.querySelector('[data-testid="sound-chip"]'); return !!c })
check('before any gesture: "Tap to enable sound" chip shows', locked)
if (locked) { await page.screenshot({ path: OUT + '/12-chip.png' }); await page.locator('[data-testid="sound-chip"]').click(); await page.waitForTimeout(300) }
check('tapping the chip hides it', (await page.locator('[data-testid="sound-chip"]').count()) === 0)

// 2. Settings → Sounds tab
await page.locator('button[aria-label="Terminal settings"]').click()
await page.getByRole('tab', { name: 'Sounds' }).click()
await page.waitForTimeout(300)
check('Sounds tab lists rows for live events', (await page.locator('[data-testid^="snd-row-"]').count()) >= 14)
check('reserved events are hidden from the tab', (await page.locator('[data-testid="snd-row-alert.price"]').count()) === 0)
await page.screenshot({ path: OUT + '/12-sounds-tab.png' })

// 3. play real sounds
await page.evaluate(() => { window.__osc = 0 })
await page.locator('[data-testid="snd-play-order.buy.filled"]').click()
await page.waitForTimeout(200)
check('preview ▶ plays the buy chirp (2 notes)', (await osc()) === 2, String(await osc()))
await page.evaluate(() => { window.__osc = 0 })
await page.locator('[data-testid="snd-play-position.tp.hit"]').click()
await page.waitForTimeout(200)
check('preview take-profit plays the chime (5 notes)', (await osc()) === 5, String(await osc()))
await page.evaluate(() => { window.__osc = 0 })
await page.locator('[data-testid="snd-test-all"]').click()
await page.waitForTimeout(300)
check('Test all schedules every sound', (await osc()) > 30, String(await osc()))

// 4. coalescing + per-event switch + volume 0 via real store events
await page.evaluate(() => { window.__osc = 0 })
await page.evaluate(async () => { const { emitTerminalEvent: e } = await import('/src/lib/terminal/effects.js'); e('order.buy.filled'); e('position.tp.hit'); e('order.modified') })
await page.waitForTimeout(400)
check('3 events in 100 ms → one sound (the chime)', (await osc()) === 5, String(await osc()))
await page.locator('[data-testid="snd-on-position.tp.hit"]').click()
await page.evaluate(() => { window.__osc = 0 })
await fire('position.tp.hit'); await page.waitForTimeout(400)
check('take-profit switched off alone: silent', (await osc()) === 0)
await fire('position.sl.hit'); await page.waitForTimeout(400)
check('…while stop-loss still sounds', (await osc()) > 0)
await page.locator('[data-testid="snd-pack"]').selectOption('silentpro')
await page.evaluate(() => { window.__osc = 0 })
await fire('order.sell.filled'); await page.waitForTimeout(400)
check('Silent pro: a sell fill is silent', (await osc()) === 0)
await fire('account.stopout'); await page.waitForTimeout(400)
check('Silent pro: stop-out still sounds', (await osc()) > 0)
await page.locator('[data-testid="snd-pack"]').selectOption('classic')
await page.locator('input[aria-label="Master volume"]').fill('0')
await page.evaluate(() => { window.__osc = 0 })
await fire('account.stopout'); await page.waitForTimeout(400)
check('master volume 0 is silent', (await osc()) === 0)
await page.locator('[data-testid="snd-reset"]').click()
await page.evaluate(() => { window.__osc = 0 })
await fire('order.buy.filled'); await page.waitForTimeout(400)
check('Reset sounds restores defaults', (await osc()) === 2)
const st = await T.state()
check('sounds settings persisted', st.chartSettings.sounds.volume === 80 && st.settings.sound === true)

// 5. master off via the switch
await page.getByRole('switch', { name: 'Sounds', exact: true }).click()
await page.evaluate(() => { window.__osc = 0 })
await fire('account.stopout'); await page.waitForTimeout(400)
check('master off: silent', (await osc()) === 0 && (await T.state()).settings.sound === false)
await page.getByRole('switch', { name: 'Sounds', exact: true }).click()

// 6. hidden easter egg: tap version 5×
await page.getByRole('tab', { name: 'Alerts' }).click()
for (let i = 0; i < 5; i++) await page.locator('[data-testid="about-version"]').click()
await page.locator('button[aria-label="Close settings"], button:has-text("Ok")').first().click().catch(() => {})
await page.waitForTimeout(300)
check('tapping the version 5× opens the effects playground', await page.locator('[data-testid="effects-lab"]').isVisible())
await page.evaluate(() => { window.__osc = 0 })
await page.locator('[data-testid="lab-burst"]').click(); await page.waitForTimeout(400)
check('lab burst: one sound for 4 events', (await osc()) > 0 && (await osc()) <= 8, String(await osc()))
await page.locator('[data-testid="lab-order.cancelled"]').click()
await page.waitForTimeout(300)
check('lab button shows its toast and logs the event', /order\.cancelled/.test(await page.locator('[data-testid="lab-log"]').innerText()) && (await page.getByText('Order cancelled').count()) > 0)
await page.screenshot({ path: OUT + '/12-lab.png' })
await T.done()
