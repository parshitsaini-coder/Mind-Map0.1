import { boot, OUT } from '../e2e-phase11/lib.mjs'
const T = await boot({ width: 360, height: 740, touch: true })
const { page, check } = T
await page.goto('http://127.0.0.1:5173/?lab=1', { waitUntil: 'load' })
await page.waitForSelector('.tm-root'); await page.waitForTimeout(1200)
check('?lab=1 opens the playground in a dev build', await page.locator('[data-testid="effects-lab"]').isVisible())
await page.locator('button[aria-label="Close playground"]').click()
await page.locator('button[aria-label="Terminal settings"]').click()
await page.getByRole('tab', { name: 'Sounds' }).click()
await page.waitForTimeout(300)
const overflow = await page.evaluate(() => { const d = document.querySelector('[role="dialog"]'); const el = d || document.body; return el.scrollWidth > el.clientWidth + 2 })
check('360 px: no horizontal overflow in the Sounds tab', !overflow)
await page.screenshot({ path: OUT + '/12-sounds-360.png' })
await T.done()
