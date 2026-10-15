import { chromium } from 'playwright'
const OUT = './e2e-shots'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] })
const errors = []
const res = []
const check = (n, ok, x = '') => { res.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${n} ${ok ? '' : x}`) }
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
await ctx.addInitScript(() => { try { if (!localStorage.getItem('seeded')) { localStorage.setItem('seeded', '1'); localStorage.setItem('mindmap-terminal-storage', JSON.stringify({ version: 0, state: { isOpen: true, settings: { oneClick: true } } })); } localStorage.setItem('terminal-debug', '1') } catch {} })
const page = await ctx.newPage()
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)) })
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'load' })
await page.waitForSelector('.tm-root', { timeout: 15000 })
await page.waitForTimeout(1500)
await page.locator('button:has-text("BUY")').first().click()
await page.waitForTimeout(1000)

const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('mindmap-terminal-storage')).state)
const lines = () => page.evaluate(() => window.__terminalLines())
const ovRect = async () => page.locator('[data-chart-overlay]').first().evaluate((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height } })
const yOf = (price) => page.evaluate((p) => window.__terminalPriceToY(p), price)
let pos = (await state()).positions[0]
const inst = { pip: 0.1, d: 2 }
console.log('position', pos.id, pos.side, pos.entry)

// 1) +SL place mode
await page.locator('[data-pill="position"] button:has-text("+SL")').click()
check('place layer opens', await page.locator('[data-testid="place-layer"]').isVisible())
let R = await ovRect()
const slPrice = +(pos.entry - 15).toFixed(2)
let y = await yOf(slPrice)
await page.mouse.move(R.x + 400, R.y + y)
await page.waitForTimeout(150)
await page.screenshot({ path: OUT + '/02-place-sl-ghost.png' })
const ghost = await page.locator('[data-testid="place-layer"]').innerText()
check('ghost tag shows projected SL loss', /SL .*\$/.test(ghost), ghost)
await page.mouse.click(R.x + 400, R.y + y)
await page.waitForTimeout(500)
pos = (await state()).positions[0]
check('SL placed from the chart (persisted)', pos.sl != null && Math.abs(pos.sl - slPrice) < 1.2, JSON.stringify(pos.sl))
let L = await lines()
const slLine = L.find((l) => l.kind === 'sl')
check('SL line has a P/L tag', slLine && /^SL −\$/.test(slLine.title), slLine?.title)
console.log('SL title:', slLine?.title)
check('log records the SL', pos.log?.length === 1 && pos.log[0].ev === 'sl')
check('toast says what changed and offers Undo', await page.locator('button:has-text("Undo")').count() > 0)
await page.screenshot({ path: OUT + '/03-sl-placed.png' })

// 2) place TP via quick bracket? use +TP place mode
await page.locator('[data-pill="position"] button:has-text("+TP")').click()
const tpPrice = +(pos.entry + 12).toFixed(2)
y = await yOf(tpPrice)
await page.mouse.click(R.x + 400, R.y + y)
await page.waitForTimeout(500)
pos = (await state()).positions[0]
check('TP placed from the chart', pos.tp != null && Math.abs(pos.tp - tpPrice) < 1.2)
L = await lines()
console.log('TP title:', L.find((l) => l.kind === 'tp')?.title)
check('TP tag has R multiple', /R \d/.test(L.find((l) => l.kind === 'tp')?.title || ''))

// 3) drag SL live
const dragTo = async (kind, toPrice, { release = true, mods = [] } = {}) => {
  const L0 = await lines(); const ln = L0.find((l) => l.kind === kind)
  const y0 = ln.y; const y1 = await yOf(toPrice)
  await page.mouse.move(R.x + 450, R.y + y0)
  await page.mouse.down()
  await page.mouse.move(R.x + 450, R.y + (y0 + y1) / 2, { steps: 4 })
  await page.mouse.move(R.x + 450, R.y + y1, { steps: 4 })
  await page.waitForTimeout(100)
  const mid = (await lines()).find((l) => l.kind === kind)
  if (release) { await page.mouse.up(); await page.waitForTimeout(500) }
  return { before: ln, mid }
}
const before = (await state()).positions[0]
let d = await dragTo('sl', before.entry - 25, { release: false })
check('while dragging, the tag changes live', d.mid.title !== d.before.title && /SL/.test(d.mid.title), d.mid.title)
check('while dragging, the order is NOT changed yet', (await state()).positions[0].sl === before.sl)
await page.screenshot({ path: OUT + '/04-dragging-sl.png' })
await page.mouse.up(); await page.waitForTimeout(500)
pos = (await state()).positions[0]
check('release commits the new SL once', Math.abs(pos.sl - (before.entry - 25)) < 1.2 && pos.sl !== before.sl, `${pos.sl} vs ${before.entry - 25}`)
check('log has 3 entries (sl,tp,sl)', pos.log.length === 3)

// 4) invalid drag springs back
const keep = pos.sl
d = await dragTo('sl', pos.entry + 8, { release: false })
const bad = await lines()
check('invalid drag shows the reason in the tag', /must be below/.test(bad.find((l) => l.kind === 'sl').title), bad.find((l) => l.kind === 'sl').title)
await page.screenshot({ path: OUT + '/05-invalid-drag.png' })
await page.mouse.up(); await page.waitForTimeout(600)
pos = (await state()).positions[0]
check('invalid release: SL unchanged and the line is back', pos.sl === keep && Math.abs((await lines()).find((l) => l.kind === 'sl').price - keep) < 1e-9)
check('an error toast explains', await page.locator('text=line put back').count() > 0)

// 5) break-even magnet: drag SL to ~0.5 pip from entry (needs price beyond entry? engine: SL must be < bid for buy → entry maybe above bid)
// 6) TP drag
const tpBefore = pos.tp
await dragTo('tp', tpBefore + 5)
pos = (await state()).positions[0]
check('TP drag commits', Math.abs(pos.tp - (tpBefore + 5)) < 1.2 && pos.tp !== tpBefore)

// 7) Ctrl+Z undoes the last move
await page.mouse.move(R.x + 300, R.y + 300)
await page.keyboard.press('Control+z')
await page.waitForTimeout(400)
pos = (await state()).positions[0]
check('Ctrl+Z restores the previous TP', Math.abs(pos.tp - tpBefore) < 1e-9, `${pos.tp} vs ${tpBefore}`)

// 8) reload persistence
await page.reload({ waitUntil: 'load' }); await page.waitForSelector('.tm-root'); await page.waitForTimeout(1800)
const after = (await state()).positions[0]
check('after reload SL / TP are the same', after.sl === pos.sl && after.tp === pos.tp)
check('after reload the pill and lines are back', await page.locator('[data-pill="position"]').isVisible() && (await lines()).some((l) => l.kind === 'sl'))

// 9) chip cycles units; equals the Positions panel (money)
const chip = page.locator('[data-testid^="chip-"]').first()
const money = await chip.innerText()
const panel = await page.locator('text=/[−-]\\$\\d/').allInnerTexts()
console.log('chip', money, '| panel sample', panel.slice(0, 3))
const seen = [money]
for (let i = 0; i < 3; i++) { await chip.click(); await page.waitForTimeout(150); seen.push(await chip.innerText()) }
console.log('cycle:', seen.join(' → '))
check('chip cycles money → pips → % → R', /\$/.test(seen[0]) && /pips/.test(seen[1]) && /%/.test(seen[2]) && /R/.test(seen[3]))
await chip.click(); await page.waitForTimeout(150)
check('chip is back to money after 4 clicks', /\$/.test(await chip.innerText()))
await page.screenshot({ path: OUT + '/06-pill-units.png' })

console.log('RESULT', res.filter(Boolean).length + '/' + res.length, 'errors', JSON.stringify(errors))
await browser.close()
