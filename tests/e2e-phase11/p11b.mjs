// interaction: menu, shortcuts, magnet, position tool -> order ticket, templates / defaults, favourites, hide/lock, tree, sync-safe reload
import { boot, OUT } from './lib.mjs'
import { TOOLS } from '../../src/lib/terminal/drawingTools.js'
const T = await boot()
const { page, check } = T
page.on('dialog', (d) => (d.type() === 'prompt' ? d.accept('Thick red') : d.accept()))
await page.locator('button[title="Drawing tools"]').click(); await page.waitForTimeout(300)
const H = await T.host()
const last = async () => { const d = await T.drawings(); return d[d.length - 1] }
async function tool(id) { await page.locator(`[data-testid="grp-${TOOLS[id].category}"]`).click(); await page.locator(`[data-testid="tool-${id}"]`).click() }
async function drag(id, x, y, dx = 130, dy = -45) { await tool(id); await page.mouse.move(H.x + x, H.y + y); await page.mouse.down(); await page.mouse.move(H.x + x + dx, H.y + y + dy, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(250) }
async function click(id, x, y) { await tool(id); await page.mouse.click(H.x + x, H.y + y); await page.waitForTimeout(250) }
const sel = () => page.evaluate(() => window.__terminalDraw.scene().find((i) => i.selected)?.id)

// ── trend + shortcuts ──
await drag('trend', 300, 300)
let d = await last(); const id1 = d.id
await page.keyboard.press('ArrowRight'); await page.waitForTimeout(100)
let d2 = await last()
check('arrow key nudges one bar right', d2.points[0].t > d.points[0].t)
await page.keyboard.press('ArrowUp'); await page.waitForTimeout(100)
d2 = await last(); check('arrow up nudges up (price rises)', d2.points[0].p > d.points[0].p)
await page.keyboard.press('Control+z'); await page.keyboard.press('Control+z'); await page.waitForTimeout(150)
d2 = await last(); check('Ctrl+Z x2 returns it to where it was', d2.points[0].t === d.points[0].t && d2.points[0].p === d.points[0].p)
await page.keyboard.press('Control+c'); await page.keyboard.press('Control+v'); await page.waitForTimeout(150)
check('Ctrl+C / Ctrl+V pastes a new copy on top', (await T.drawings()).length === 2 && (await last()).id !== id1 && (await last()).z > d.z)
await page.keyboard.press('Control+d'); await page.waitForTimeout(150)
check('Ctrl+D clones', (await T.drawings()).length === 3)
await page.keyboard.press('Delete'); await page.waitForTimeout(100)
check('Delete removes the selected one', (await T.drawings()).length === 2)
await page.keyboard.press('Control+z'); await page.waitForTimeout(100)
check('Ctrl+Z brings the deleted one back', (await T.drawings()).length === 3)

// ── right-click menu ──
const a = await T.xy(d.points[0].t, d.points[0].p), b = await T.xy(d.points[1].t, d.points[1].p)
const mx = H.x + (a.x + b.x) / 2, my = H.y + (a.y + b.y) / 2
await page.mouse.click(H.x + 40, H.y + 60) // deselect
await page.mouse.click(mx, my, { button: 'right' }); await page.waitForTimeout(200)
check('right-click on a drawing opens the drawing menu (not the order menu)', await page.locator('[data-testid="draw-menu"]').isVisible())
await page.screenshot({ path: OUT + '/11b-menu.png' })
await page.locator('[data-testid="draw-menu"] >> text=Lock').click(); await page.waitForTimeout(150)
check('menu: Lock', (await T.drawings()).some((x) => x.id === id1 && x.locked) || (await T.drawings()).filter((x) => x.locked).length === 1)
await page.mouse.click(mx, my, { button: 'right' }); await page.waitForTimeout(150)
await page.locator('[data-testid="draw-menu"] >> text=Hide').click(); await page.waitForTimeout(150)
check('menu: Hide', (await T.drawings()).filter((x) => x.hidden).length === 1)
check('hidden drawing is not in the scene', (await page.evaluate(() => window.__terminalDraw.scene())).length === 2)
await page.locator('[data-testid="tree-btn"]').click()
await page.locator('[data-testid="row-eye"]').first().waitFor()
check('object tree lists all 3 (hidden one dimmed)', (await page.locator('[data-testid="tree-row"]').count()) === 3)
await page.locator('[data-testid="tree-hideall"]').click(); await page.waitForTimeout(100)
check('tree: hide all', (await T.drawings()).every((x) => x.hidden))
await page.locator('[data-testid="tree-hideall"]').click()
check('tree: show all', (await T.drawings()).every((x) => !x.hidden))
await page.locator('[data-testid="tree-lockall"]').click(); await page.waitForTimeout(100)
check('tree: lock all', (await T.drawings()).every((x) => x.locked))
await page.locator('[data-testid="tree-lockall"]').click()
const row = page.locator('[data-testid="tree-row"] span').first()
await row.dblclick(); await page.keyboard.type('My line'); await page.keyboard.press('Enter'); await page.waitForTimeout(100)
check('tree: rename', (await T.drawings()).some((x) => x.name === 'My line'))
const zBefore = (await T.drawings()).map((x) => x.id + ':' + x.z).join()
await page.locator('[data-testid="tree-row"] [aria-label="Down"]').first().click(); await page.waitForTimeout(100)
check('tree: reorder changes z', (await T.drawings()).map((x) => x.id + ':' + x.z).join() !== zBefore)
await page.locator('[data-testid="tree-row"] [data-testid="row-del"]').first().click(); await page.waitForTimeout(100)
check('tree: delete a row', (await T.drawings()).length === 2)
await page.screenshot({ path: OUT + '/11b-tree.png' })
await page.locator('[data-testid="tree-btn"]').click()

// ── locked drawing cannot be dragged ──
await page.locator('[data-testid="tree-btn"]').click(); await page.locator('[data-testid="tree-lockall"]').click(); await page.locator('[data-testid="tree-btn"]').click()
const dd = (await T.drawings())[0]
const pa = await T.xy(dd.points[0].t, dd.points[0].p), pb = await T.xy(dd.points[1].t, dd.points[1].p)
await page.mouse.move(H.x + (pa.x + pb.x) / 2, H.y + (pa.y + pb.y) / 2); await page.mouse.down(); await page.mouse.move(H.x + (pa.x + pb.x) / 2 + 60, H.y + (pa.y + pb.y) / 2 + 60, { steps: 4 }); await page.mouse.up(); await page.waitForTimeout(150)
check('locked drawing does not move when dragged', JSON.stringify((await T.drawings())[0].points) === JSON.stringify(dd.points))
await page.locator('[data-testid="tree-btn"]').click(); await page.locator('[data-testid="tree-lockall"]').click(); await page.locator('[data-testid="tree-btn"]').click()

// ── magnet ──
await page.locator('[data-testid="tree-btn"]').click(); await page.locator('[data-testid="tree-removeall"]').click(); await page.locator('[data-testid="tree-btn"]').click()
await page.locator('[data-testid="magnet-btn"]').click(); await page.locator('[data-testid="magnet-btn"]').click() // off -> weak -> strong
check('magnet button cycles to strong', (await page.locator('[data-testid="magnet-btn"]').innerText()).includes('strong'))
await click('hline', 400, 330)
d = await last()
const bar = await page.evaluate((t) => (window.__terminalCandles() || []).find((c) => c.time === t) || null, d.points[0].t)
check('strong magnet: the line lands exactly on an O/H/L/C value of its bar', !!bar && [bar.open, bar.high, bar.low, bar.close].some((v) => Math.abs(v - d.points[0].p) < 1e-9), JSON.stringify([d.points[0], bar]))
await page.locator('[data-testid="magnet-btn"]').click() // off
await page.keyboard.press('Delete')

// ── position tool -> Place order ──
await click('long', 500, 330)
d = await last()
check('long position: 4 anchors, stop below entry, target above', d.points.length === 4 && d.points[2].p < d.points[0].p && d.points[3].p > d.points[0].p)
await page.screenshot({ path: OUT + '/11b-long.png' })
const sc = (await page.evaluate(() => window.__terminalDraw.scene())).find((i) => i.type === 'long')
check('long position labels: target, stop, R:R', sc.labels.some((l) => Array.isArray(l) && /Target/.test(l[0])) && sc.labels.some((l) => Array.isArray(l) && /Stop/.test(l[0])) && sc.labels.some((l) => typeof l === 'string' && /R:R/.test(l)))
await page.locator('[data-testid="draw-bar"] [aria-label="Place this order"]').click(); await page.waitForTimeout(400)
const vals = await page.locator('input[placeholder="None"]').evaluateAll((els) => els.map((e) => e.value))
check('"Place this order" fills the ticket SL and TP from the drawing', Math.abs(parseFloat(vals[0]) - d.points[2].p) < 0.011 && Math.abs(parseFloat(vals[1]) - d.points[3].p) < 0.011, JSON.stringify(vals))
const tabsActive = await page.evaluate(() => [...document.querySelectorAll('button')].filter((b) => /^(Market|Limit|Stop)$/.test(b.textContent.trim())).map((b) => b.textContent.trim() + ':' + b.className.includes('bg-')).join())
console.log('ticket tabs', tabsActive)
await page.screenshot({ path: OUT + '/11b-place-order.png' })
check('no order was placed by that click (only prefilled)', (await T.state()).positions.length === 0 && (await T.state()).orders.length === 0)
await page.keyboard.press('Delete')

// ── per-tool default + templates ──
await drag('trend', 300, 320); d = await last()
await page.locator('[data-testid="draw-bar"] [aria-label="Settings"]').click()
await page.locator('[data-testid="in-color"]').evaluate((e) => { const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; s.call(e, '#ff00aa'); e.dispatchEvent(new Event('input', { bubbles: true })) })
await page.locator('[data-testid="in-width"]').selectOption('5')
await page.locator('[data-testid="tpl-btn"]').click(); await page.locator('[data-testid="tpl-default"]').click()
await page.locator('[data-testid="tpl-btn"]').click(); await page.locator('text=Save as…').click(); await page.waitForTimeout(150)
await page.locator('[data-testid="dlg-ok"]').click(); await page.waitForTimeout(150)
await drag('trend', 300, 380); d = await last()
check('next trend line uses the last style set as default (colour + width)', d.color === '#ff00aa' && d.width === 5, d.color + ' ' + d.width)
await drag('rect', 600, 380); d = await last()
check('another tool is not affected by that default', d.color !== '#ff00aa')
const st = await T.state()
check('templates + defaults are saved (and go to the cloud snapshot)', st.drawDefaults?.trend?.color === '#ff00aa' && st.drawTemplates?.trend?.[0]?.name === 'Thick red', JSON.stringify(st.drawTemplates))
await drag('trend', 400, 250); d = await last()
await page.locator('[data-testid="draw-bar"] [aria-label="Settings"]').click()
await page.locator('[data-testid="in-color"]').evaluate((e) => { const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; s.call(e, '#00ff00'); e.dispatchEvent(new Event('input', { bubbles: true })) })
await page.locator('[data-testid="tpl-btn"]').click(); await page.locator('[data-testid="tpl-menu"] >> text=Thick red').click(); await page.waitForTimeout(150)
d = await last(); check('apply template restores colour + width', d.color === '#ff00aa' && d.width === 5)
await page.locator('[data-testid="dlg-ok"]').click()

// ── favourites ──
await page.locator('[data-testid="grp-Shapes"]').click()
await page.locator('[aria-label="Pin Ellipse"]').click(); await page.keyboard.press('Escape')
await page.waitForTimeout(150)
check('starred tool appears in the strip', await page.locator('button[aria-label="Ellipse"]').count() === 1 && (await T.state()).drawFavs.includes('ellipse'))
await page.screenshot({ path: OUT + '/11b-toolbar.png' })

// ── arrow marker dir, callout text, ray, extline ──
await click('arrowmark', 300, 200); d = await last()
await page.locator('[data-testid="draw-bar"] [aria-label="Settings"]').click()
await page.locator('[data-testid="in-dir"]').selectOption('down'); d = await last()
check('arrow marker: direction', d.dir === 'down')
await page.locator('[data-testid="dlg-ok"]').click()
await drag('callout', 700, 250, 80, -30)
await page.waitForTimeout(150)
await page.keyboard.type('Hi'); await page.keyboard.press('Enter'); await page.waitForTimeout(150)
d = await last(); check('callout: text typed on creation', d.type === 'callout' && d.text === 'Hi', d.text)
await page.screenshot({ path: OUT + '/11b-callout.png' })

// ── Esc cancels a half-made drawing ──
const n0 = (await T.drawings()).length
await tool('triangle'); await page.mouse.click(H.x + 200, H.y + 200); await page.mouse.click(H.x + 260, H.y + 160); await page.keyboard.press('Escape'); await page.mouse.click(H.x + 320, H.y + 220); await page.waitForTimeout(150)
check('Esc cancels a half-made drawing (nothing saved)', (await T.drawings()).length === n0)

// ── reload keeps all of it ──
await page.reload({ waitUntil: 'load' }); await page.waitForSelector('.tm-root', { timeout: 8000 }); await page.waitForTimeout(1200)
const after = await T.state()
check('reload: drawings, defaults, templates, favourites all persisted', after.drawings.XAUUSD.length === n0 && after.drawDefaults.trend && after.drawTemplates.trend.length === 1 && after.drawFavs.includes('ellipse'))
await T.done()
