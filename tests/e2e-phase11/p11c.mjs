// indicators: add Volume / StochRSI, legend (eye / gear / x / live values), dialog (Inputs / Style / Visibility), panes, reorder, status-line toggle
import { boot, OUT } from './lib.mjs'
const T = await boot()
const { page, check } = T
const ind = async () => (await T.state()).indicators
const panelOpen = () => page.locator('button[title="Indicators"]').getAttribute('aria-expanded').then((v) => v === 'true')
const closePanel = async () => { if (await panelOpen()) await page.locator('[role="dialog"][aria-label="Indicators"] [aria-label="Close"]').click() }
async function add(name) { if (!(await panelOpen())) await page.locator('button[title="Indicators"]').click(); await page.locator(`button[title]:has-text("${name}")`).first().click(); await page.waitForSelector('[data-testid="ind-dialog"]') }
const ok = async () => { await page.locator('[data-testid="idlg-ok"]').click(); await closePanel(); await page.waitForTimeout(200) }
const setIn = async (tid, v) => { const el = page.locator(`[data-testid="${tid}"]`); const info = await el.evaluate((e) => ({ tag: e.tagName, type: e.type })); if (info.tag === 'SELECT') await el.selectOption(String(v)); else if (info.type === 'checkbox') await el.setChecked(!!v); else if (info.type === 'color') await el.evaluate((e, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(e, v); e.dispatchEvent(new Event('input', { bubbles: true })) }, v); else await el.fill(String(v)); await page.waitForTimeout(150) }

await add('Volume')
check('adding an indicator opens its settings dialog', await page.locator('[data-testid="ind-dialog"]').isVisible())
await page.screenshot({ path: OUT + '/11c-volume-dialog.png' })
await setIn('ip-ma', 9)
check('Inputs: MA period changes the indicator', (await ind())[0].params.ma === 9)
await page.locator('[data-testid="itab-style"]').click()
await setIn('is-color-ma', '#ff0000'); await setIn('is-width-ma', 3); await setIn('is-ls-ma', 'dotted'); await setIn('is-panesize', 2)
let i0 = (await ind())[0]
check('Style: colour / width / line style / pane height', i0.colors.ma === '#ff0000' && i0.styles.ma.width === 3 && i0.styles.ma.lineStyle === 'dotted' && i0.paneSize === 2, JSON.stringify(i0))
await ok(); await page.waitForTimeout(500)
check('Volume pane exists below the price chart (chart has 2 panes)', (await page.evaluate(() => window.__terminalPanes())) === 2)
await page.screenshot({ path: OUT + '/11c-volume-pane.png' })
check('legend row shows the name + live value', await page.locator('[data-testid="ind-row"]').count() === 1 && (await page.locator('[data-testid="ind-val"]').count()) === 2)
const vals = await page.locator('[data-testid="ind-val"]').allInnerTexts()
check('legend values are numbers (not —) after the worker answers', vals.every((v) => v !== '—' && v.length > 0), JSON.stringify(vals))

await add('StochRSI')
check('StochRSI added (2 indicators)', (await ind()).length === 2)
await page.locator('[data-testid="itab-style"]').click()
await setIn('is-show-d', false)
check('Style: a single line can be hidden', (await ind())[1].styles.d.hidden === true)
await page.locator('[data-testid="itab-vis"]').click()
await setIn('iv-min', 'H1'); await setIn('iv-max', 'D1')
check('Visibility: timeframe range stored', (await ind())[1].visibility.tfMin === 'H1')
await page.locator('[data-testid="idlg-cancel"]').click(); await closePanel(); await page.waitForTimeout(200)
const s1 = (await ind())[1]
check('Cancel reverts the dialog (line shown again, range reset)', !s1.styles.d && s1.visibility.tfMin !== 'H1', JSON.stringify(s1))
await page.screenshot({ path: OUT + '/11c-two-panes.png' })

// timeframe visibility
await page.locator('[data-testid="ind-gear"]').nth(1).click()
await page.locator('[data-testid="itab-vis"]').click(); await setIn('iv-min', 'H1'); await ok(); await page.waitForTimeout(300)
const countOnM15 = await page.evaluate(() => document.querySelectorAll('[data-testid="ind-row"]').length)
check('legend still lists a time-hidden indicator and the chart really drops its pane on M15', countOnM15 === 2 && (await page.evaluate(() => window.__terminalPanes())) === 2)
await page.locator('button:has-text("1h")').first().click(); await page.waitForTimeout(1500)
check('on H1 the StochRSI pane comes back (3 panes)', (await page.evaluate(() => window.__terminalPanes())) === 3)
await page.locator('button:has-text("15m")').first().click(); await page.waitForTimeout(1200)
await page.locator('[data-testid="ind-eye"]').nth(1).click(); await page.waitForTimeout(150)
check('legend eye toggles visibility', (await ind())[1].visible === false)
await page.locator('[data-testid="ind-eye"]').nth(1).click()
await page.locator('[data-testid="ind-x"]').nth(1).click(); await page.waitForTimeout(150)
check('legend x removes the indicator', (await ind()).length === 1)

// reorder in the panel
await add('RSI'); await ok()
const before = (await ind()).map((x) => x.type).join()
await page.locator('button[title="Indicators"]').click()
await page.locator('[aria-label="Move up"]').nth(1).click(); await page.waitForTimeout(150)
check('panel: move up reorders panes', (await ind()).map((x) => x.type).join() !== before)
await closePanel()

// collapse pane
await page.locator('[data-testid="ind-gear"]').first().click(); await page.locator('[data-testid="itab-style"]').click(); await setIn('is-collapsed', true); await ok()
check('Collapse pane stored', (await ind())[0].collapsed === true)

// status line toggle
await page.evaluate(() => window.__terminalStore.getState().setChartSettings({ status: { indValues: false } })); await page.waitForTimeout(300)
check('status line: "Indicator values" off hides the numbers but keeps the names', (await page.locator('[data-testid="ind-val"]').count()) === 0 && (await page.locator('[data-testid="ind-row"]').count()) > 0)
await page.evaluate(() => window.__terminalStore.getState().setChartSettings({ status: { indValues: true } }))
await page.screenshot({ path: OUT + '/11c-final.png' })
await T.done()
