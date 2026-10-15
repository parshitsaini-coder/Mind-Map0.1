import sys, json
from playwright.sync_api import sync_playwright
W,H = int(sys.argv[1]), int(sys.argv[2]); tag=sys.argv[3]
mobile = W<500
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width':W,'height':H}, has_touch=mobile, is_mobile=mobile)
    ctx.add_init_script("""localStorage.setItem('terminal-debug','1');
      if(!localStorage.getItem('mindmap-terminal-storage')) localStorage.setItem('mindmap-terminal-storage', JSON.stringify({version:0,state:{isOpen:true}}));""")
    pg = ctx.new_page(); errs=[]
    pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
    pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
    pg.goto('http://127.0.0.1:5199/', wait_until='networkidle')
    pg.wait_for_selector('[data-testid="chart-fx"]'); pg.wait_for_timeout(1200)
    if mobile:
        pg.get_by_role('button', name='Trade').first.click() if pg.get_by_role('button', name='Trade').count() else None
        pg.wait_for_timeout(400)
    # real market BUY
    pg.locator('button:has-text("BUY")').filter(has_not_text='Limit').first.click()
    pg.get_by_role('button', name='Confirm BUY').click()
    pg.wait_for_timeout(120)
    pg.screenshot(path=f'/tmp/shots/{tag}-10-buy-120ms.png')
    pg.wait_for_timeout(500)
    pg.screenshot(path=f'/tmp/shots/{tag}-11-buy-620ms.png')
    print('popup', pg.locator('[data-testid="order-popup"]').count(), pg.locator('[data-testid="order-popup"]').first.get_attribute('data-variant') if pg.locator('[data-testid="order-popup"]').count() else None)
    print('toasts', pg.locator('[data-testid="toast"]').count())
    pg.wait_for_timeout(2300)
    print('popup after 2.9s', pg.locator('[data-testid="order-popup"]').count())
    print('pill', pg.locator('[data-testid="position-pills"] button[aria-label^="Profit"]').count(), 'fxlog', pg.evaluate('window.__fxLog'))
    print('errors', errs[:5])
    b.close()
