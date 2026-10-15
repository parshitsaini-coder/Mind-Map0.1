import sys, json
from playwright.sync_api import sync_playwright
def mk(p, W, H, state, reduce=None):
    b = p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width':W,'height':H}, reduced_motion=reduce)
    ctx.add_init_script("localStorage.setItem('terminal-debug','1');localStorage.setItem('mindmap-terminal-storage', %s)" % json.dumps(json.dumps({'version':0,'state':state})))
    pg = ctx.new_page(); pg.errs=[]
    pg.on('console', lambda m: pg.errs.append(m.text) if m.type=='error' else None)
    pg.on('pageerror', lambda e: pg.errs.append('PAGEERR '+str(e)))
    pg.goto('http://127.0.0.1:5199/', wait_until='networkidle'); pg.wait_for_selector('[data-testid="chart-fx"]'); pg.wait_for_timeout(1200)
    return b, pg
with sync_playwright() as p:
    # 1 settings tab, light theme
    b,pg = mk(p,1440,900,{'isOpen':True,'chartSettings':{'theme':'light'}})
    pg.get_by_role('button', name='Settings').first.click() if pg.get_by_role('button', name='Settings').count() else pg.keyboard.press('Alt+,')
    pg.wait_for_timeout(400)
    pg.get_by_role('tab', name='Animations').click(); pg.wait_for_timeout(400)
    pg.screenshot(path='/tmp/shots/s-anim-tab-light.png')
    print('effective', pg.inner_text('[data-testid="anim-effective"]'))
    # toggle Off via the segmented control, check live attr
    pg.get_by_role('radio', name='Off').first.click(); pg.wait_for_timeout(200)
    print('mode off attr', pg.eval_on_selector('.tm-root','e=>e.dataset.anim'), pg.inner_text('[data-testid="anim-effective"]'))
    pg.get_by_role('button', name='Cancel', exact=True).click(); pg.wait_for_timeout(300)
    print('after cancel attr (reverts)', pg.eval_on_selector('.tm-root','e=>e.dataset.anim'))
    print('errs', pg.errs); b.close()
    # 2 OS reduced motion -> reduced
    b,pg = mk(p,1440,900,{'isOpen':True},reduce='reduce')
    print('reduce-motion attr', pg.eval_on_selector('.tm-root','e=>e.dataset.anim'))
    pg.evaluate("window.__terminalEmit('position.tp.hit')"); pg.wait_for_timeout(250)
    pg.screenshot(path='/tmp/shots/r-tp-reduced.png')
    print('popup mode', pg.get_attribute('[data-testid="order-popup"]','data-mode'), 'fxlog', pg.evaluate('window.__fxLog'))
    print('errs', pg.errs); b.close()
    # 3 Off: plain toast, no popup, no effect
    b,pg = mk(p,1440,900,{'isOpen':True,'chartSettings':{'anim':{'mode':'off'}}})
    pg.evaluate("window.__terminalEmit('position.tp.hit')"); pg.wait_for_timeout(300)
    print('off: popup', pg.locator('[data-testid="order-popup"]').count(), 'toast', pg.locator('[data-testid="toast"]').count(), 'bar', pg.locator('.tm-toast-bar').count(), 'fxlog', pg.evaluate('window.__fxLog'))
    pg.screenshot(path='/tmp/shots/o-tp-off.png')
    print('errs', pg.errs); b.close()
    # 4 margin pulse + one warning event
    b,pg = mk(p,1440,900,{'isOpen':True,'chartSettings':{'trading':{'marginWarn':100000}}})
    pg.locator('button:has-text("BUY")').filter(has_not_text='Limit').first.click(); pg.get_by_role('button', name='Confirm BUY').click(); pg.wait_for_timeout(1500)
    print('margin pulse', pg.locator('[data-testid="margin-pulse"]').count(), 'strip pulse', pg.locator('[data-testid="strip-pulse"]').count())
    print('margin popup events', pg.locator('[data-variant="margin"]').count())
    pg.screenshot(path='/tmp/shots/p-margin.png')
    print('errs', pg.errs); b.close()
