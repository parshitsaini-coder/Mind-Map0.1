import json
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width':1440,'height':900})
    ctx.add_init_script("localStorage.setItem('terminal-debug','1');localStorage.setItem('mindmap-terminal-storage', %s)" % json.dumps(json.dumps({'version':0,'state':{'isOpen':True,'chartSettings':{'trading':{'marginWarn':1000}}}})))
    pg = ctx.new_page(); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:5199/', wait_until='networkidle'); pg.wait_for_selector('[data-testid="chart-fx"]'); pg.wait_for_timeout(1000)
    pg.locator('input[value="0.01"]').first.fill('0.5')
    pg.locator('button:has-text("BUY")').filter(has_not_text='Limit').first.click(); pg.get_by_role('button', name='Confirm BUY').click(); pg.wait_for_timeout(900)
    print('margin pulse', pg.locator('[data-testid="margin-pulse"]').count(), 'strip pulse', pg.locator('[data-testid="strip-pulse"]').count(), 'popup', pg.locator('[data-variant="margin"]').count(), pg.evaluate("document.querySelector('[data-testid=\"order-popup\"]')?.dataset.variant"))
    pg.screenshot(path='/tmp/shots/p-margin.png')
    # pulse is 1 Hz: opacity changes between samples
    ops=[pg.eval_on_selector('[data-testid="margin-pulse"]','e=>getComputedStyle(e).opacity') for _ in range(1)]
    pg.wait_for_timeout(500); ops.append(pg.eval_on_selector('[data-testid="margin-pulse"]','e=>getComputedStyle(e).opacity'))
    print('pulse opacity samples', ops, errs)
    b.close()
