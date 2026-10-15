// every tool can be created with the mouse; every dialog control changes the drawing (store + pixels)
import { boot, OUT } from './lib.mjs'
import { TOOLS, CATEGORIES } from '../../src/lib/terminal/drawingTools.js'
const T = await boot()
const { page, check } = T
await page.locator('button[title="Drawing tools"]').click()
await page.waitForTimeout(300)
const H = await T.host()

async function create(id, ox, oy) {
  const spec = TOOLS[id]
  await page.locator(`[data-testid="grp-${spec.category}"]`).click()
  await page.locator(`[data-testid="tool-${id}"]`).click()
  const p = (dx, dy) => [H.x + ox + dx, H.y + oy + dy]
  if (spec.position || (spec.points === 1)) { await page.mouse.click(...p(0, 0)) }
  else if (id === 'channel') { await page.mouse.move(...p(0, 0)); await page.mouse.down(); await page.mouse.move(...p(120, -30), { steps: 6 }); await page.mouse.up(); await page.mouse.click(...p(60, 40)) }
  else if (spec.points === 3) { await page.mouse.click(...p(0, 0)); await page.mouse.click(...p(80, -50)); await page.mouse.click(...p(150, 20)) }
  else { await page.mouse.move(...p(0, 0)); await page.mouse.down(); await page.mouse.move(...p(130, -45), { steps: 6 }); await page.mouse.up() }
  await page.waitForTimeout(250)
}
async function setVal(testid, v) {
  const el = page.locator(`[data-testid="${testid}"]`).first()
  const info = await el.evaluate((e) => ({ tag: e.tagName, type: e.type }))
  if (info.tag === 'SELECT') await el.selectOption(String(v))
  else if (info.type === 'checkbox') await el.setChecked(!!v)
  else if (info.type === 'color' || info.type === 'range') await el.evaluate((e, v) => { const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; s.call(e, String(v)); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })) }, v)
  else await el.fill(String(v))
  await page.waitForTimeout(80)
}
const last = async () => { const d = await T.drawings(); return d[d.length - 1] }
const openDlg = async () => { await page.locator('[data-testid="draw-bar"]').waitFor({ timeout: 4000 }).catch(async () => { await page.screenshot({ path: OUT + '/dbg-nobar.png' }); console.log(JSON.stringify((await T.state()).drawSel), 'tool', (await T.state()).drawTool) }); await page.locator('[data-testid="draw-bar"] [aria-label="Settings"]').click(); await page.waitForSelector('[data-testid="draw-dialog"]') }
const tab = async (t) => page.locator(`[data-testid="tab-${t}"]`).click()
const ok = async () => { await page.locator('[data-testid="dlg-ok"]').click(); await page.waitForTimeout(100) }

// 1) every tool can be created
const ids = Object.keys(TOOLS).filter((i) => !TOOLS[i].transient)
let row = 0
const created = {}
for (const id of ids) {
  const before = (await T.drawings()).length
  await create(id, 120 + (row % 5) * 190, 110 + Math.floor(row / 5) * 62)
  row++
  const d = await T.drawings()
  created[id] = d.length === before + 1 ? d[d.length - 1] : null
  check(`create: ${id}`, !!created[id] && created[id].type === id && created[id].points.length === TOOLS[id].points, `drawings ${before} -> ${d.length}`)
  await page.keyboard.press('Escape')
}
await page.screenshot({ path: OUT + '/11a-all-tools.png' })
check('measure (transient) draws but is never saved', await (async () => { const n = (await T.drawings()).length; await page.locator('[data-testid="grp-Measure"]').click(); await page.locator('[data-testid="tool-measure"]').click(); await page.mouse.move(H.x + 300, H.y + 450); await page.mouse.down(); await page.mouse.move(H.x + 420, H.y + 400, { steps: 5 }); await page.mouse.up(); await page.waitForTimeout(200); return (await T.drawings()).length === n })())
page.on('dialog', (d) => d.accept())

// fresh: wipe drawings through the tree for clean per-tool dialog tests
await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('mindmap-terminal-storage')); })
await page.reload({ waitUntil: 'load' }); await page.waitForSelector('.tm-root', { timeout: 8000 }).catch(async () => { console.log(T.errors.join('\n')); await page.screenshot({ path: OUT + '/dbg-reload.png' }); process.exit(2) }); await page.waitForTimeout(1200)
check('all drawings survive a reload', (await T.drawings()).length === ids.length, String((await T.drawings()).length))
await page.locator('[data-testid="tree-btn"]').isVisible().catch(() => {})
await page.locator('button[title="Drawing tools"]').click()
await page.locator('[data-testid="tree-btn"]').click()
await page.locator('[data-testid="tree-removeall"]').click()
await page.waitForTimeout(300)
check('object tree: remove all', (await T.drawings()).length === 0)
await page.locator('[data-testid="tree-btn"]').click()

// 2) trend line dialog: every control
await create('trend', 300, 330)
let d = await last()
const mid = async () => { const a = await T.xy(d.points[0].t, d.points[0].p); const b = await T.xy(d.points[1].t, d.points[1].p); return [H.x + (a.x + b.x) / 2, H.y + (a.y + b.y) / 2] }
await openDlg()
await setVal('in-color', '#ff0000'); d = await last()
check('trend: colour', d.color === '#ff0000')
let [mx, my] = await mid()
await page.waitForTimeout(150)
let px = await T.pixel(mx, my)
check('trend: colour is really painted (red pixel on the line)', px[0] > 200 && px[1] < 90 && px[2] < 90, JSON.stringify(px))
await setVal('in-width', 6); d = await last(); check('trend: width', d.width === 6)
await setVal('in-linestyle', 'dashed'); d = await last(); check('trend: line style', d.style.lineStyle === 'dashed')
await setVal('in-opacity', 40); d = await last(); check('trend: opacity', Math.abs(d.style.opacity - 0.4) < 0.01)
await setVal('in-extl', true); await setVal('in-extr', true); d = await last(); check('trend: extend left + right', d.style.extendLeft && d.style.extendRight)
await setVal('in-arrowstart', 'circle'); await setVal('in-arrowend', 'arrow'); d = await last(); check('trend: arrow ends', d.style.arrowStart === 'circle' && d.style.arrowEnd === 'arrow')
await setVal('in-stats', true); d = await last(); check('trend: stats', d.style.stats === true)
const sc = await page.evaluate(() => window.__terminalDraw.scene())
check('trend: stats box and extended segment are really laid out', sc.some((i) => i.type === 'trend' && i.labels.length > 0) && sc.find((i) => i.type === 'trend').segs[0].x2 >= 1000)
await page.screenshot({ path: OUT + '/11a-trend-dialog.png' })
await tab('coords')
const price = page.locator('input[aria-label="Point 1 price"]')
await price.fill('4375.5'); await price.press('Enter'); await page.waitForTimeout(100)
d = await last(); check('trend: coordinate typed (price)', Math.abs(d.points[0].p - 4375.5) < 0.01, String(d.points[0].p))
await price.fill('abc'); await price.press('Enter')
d = await last(); check('trend: bad price rejected, drawing unchanged', Math.abs(d.points[0].p - 4375.5) < 0.01)
const tinp = page.locator('input[aria-label="Point 2 time"]')
const oldT = d.points[1].t
await tinp.fill('2020-01-01 00:00'); await tinp.press('Enter'); await page.waitForTimeout(100)
d = await last(); check('trend: time typed', d.points[1].t !== oldT)
await tab('vis')
await setVal('in-tfmin', 'H1'); await setVal('in-tfmax', 'D1'); d = await last(); check('trend: visibility range', d.visibility.tfMin === 'H1' && d.visibility.tfMax === 'D1')
await page.locator('[data-testid="dlg-cancel"]').click(); await page.waitForTimeout(150)
d = await last()
check('Cancel reverts EVERY change made in the dialog', d.color === '#38bdf8' && d.width === 2 && d.style.lineStyle === 'solid' && d.visibility.tfMin !== 'H1' && !d.style.stats)
await openDlg(); await setVal('in-width', 5); await ok()
d = await last(); check('Ok keeps the changes', d.width === 5)
await page.keyboard.press('Control+z'); await page.waitForTimeout(150)
d = await last(); check('Ctrl+Z undoes the whole dialog in one step', d.width === 2)
await page.keyboard.press('Control+y'); await page.waitForTimeout(150)
d = await last(); check('Ctrl+Y redoes it', d.width === 5)

// 3) rect: fill controls
await create('rect', 700, 330); d = await last()
await openDlg()
await setVal('in-fill', true); await setVal('in-fillcolor', '#00ff00'); await setVal('in-fillopacity', 60); d = await last()
check('rect: fill on / colour / opacity', d.style.fill && d.style.fillColor === '#00ff00' && Math.abs(d.style.fillOpacity - 0.6) < 0.01)
await page.waitForTimeout(150)
const a = await T.xy(d.points[0].t, d.points[0].p), b = await T.xy(d.points[1].t, d.points[1].p)
px = await T.pixel(H.x + (a.x + b.x) / 2, H.y + (a.y + b.y) / 2)
check('rect: fill is painted green', px[1] > px[0] + 40 && px[1] > px[2] + 40, JSON.stringify(px))
await page.screenshot({ path: OUT + '/11a-rect-fill.png' })
await setVal('in-fill', false); await page.waitForTimeout(150)
const px2 = await T.pixel(H.x + (a.x + b.x) / 2, H.y + (a.y + b.y) / 2)
check('rect: fill off removes it', !(px2[1] > px2[0] + 40 && px2[1] > px2[2] + 40), JSON.stringify(px2))
await ok()

// 4) fib: levels + toggles
await create('fib', 450, 380); d = await last()
await openDlg()
const lvlBefore = (await page.evaluate(() => window.__terminalDraw.scene())).find((i) => i.type === 'fib').segs.filter((s) => s.fibLevel != null).length
await tab('levels')
await setVal('lv-on-1', false); await setVal('lv-v-2', 0.3); await setVal('lv-c-3', '#ff00ff'); await setVal('lv-s-4', 'dotted'); await page.locator('[data-testid="lv-add"]').click(); await page.waitForTimeout(100)
d = await last()
check('fib: level off / value / colour / style / add', d.levels[1].on === false && d.levels[2].v === 0.3 && d.levels[3].color === '#ff00ff' && d.levels[4].style === 'dotted' && d.levels.length === 8)
const fsc = (await page.evaluate(() => window.__terminalDraw.scene())).find((i) => i.type === 'fib')
check('fib: scene reflects the level changes', fsc.segs.filter((s) => s.fibLevel != null).length === lvlBefore, `${fsc.segs.filter((s) => s.fibLevel != null).length} vs ${lvlBefore}`)
await tab('style')
for (const [tid, key] of [['in-fiblevels', 'fibLevels'], ['in-fibpercent', 'fibPercent'], ['in-fibprices', 'fibPrices'], ['in-fibtrend', 'fibTrend'], ['in-fibbg', 'fibBg'], ['in-reverse', 'fibReverse']]) {
  const cur = (await last()).style[key]
  await setVal(tid, !cur); check(`fib: ${key}`, (await last()).style[key] === !cur)
}
await setVal('in-extend', false); check('fib: extend off', (await last()).extend === false)
await page.screenshot({ path: OUT + '/11a-fib-dialog.png' })
await ok()

// 5) text
await create('text', 800, 380)
await page.keyboard.press('Escape')
d = await last()
await page.locator('[data-testid="draw-bar"]').waitFor({ timeout: 2000 }).catch(() => {})
await page.mouse.click(H.x + 20, H.y + 20) // click empty area then re-select via tree
await page.locator('[data-testid="tree-btn"]').click()
await page.locator('[data-testid="tree-row"] span').first().click()
await openDlg(); await tab('text')
await setVal('in-text', 'Hello'); await setVal('in-size', 20); await setVal('in-bold', true); await setVal('in-italic', true); await setVal('in-textcolor', '#00ffff'); await setVal('in-align', 'center'); await setVal('in-bg', false); await setVal('in-border', false)
d = await last()
check('text: text / size / bold / italic / colour / align / bg / border', d.text === 'Hello' && d.textStyle.size === 20 && d.textStyle.bold && d.textStyle.italic && d.textStyle.color === '#00ffff' && d.textStyle.align === 'center' && d.textStyle.bg === false && d.textStyle.border === false, JSON.stringify(d.textStyle))
await page.screenshot({ path: OUT + '/11a-text-dialog.png' })
await ok()
await page.locator('[data-testid="tree-btn"]').click()
await T.done()
