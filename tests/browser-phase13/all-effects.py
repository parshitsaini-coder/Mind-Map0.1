import sys
from playwright.sync_api import sync_playwright
W,H = int(sys.argv[1]), int(sys.argv[2]); tag=sys.argv[3]; mobile=W<500
EV = [('order.pending.triggered',[200,700]),('position.tp.hit',[150,500,1000]),('position.sl.hit',[120,400]),('account.stopout',[200,500]),('order.rejected',[150,400]),('position.closed.win',[300,800]),('alert.price',[300]),('order.modified',[250]),('order.pending.placed',[250])]
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width':W,'height':H}, has_touch=mobile, is_mobile=mobile)
    ctx.add_init_script("""localStorage.setItem('terminal-debug','1');
      if(!localStorage.getItem('mindmap-terminal-storage')) localStorage.setItem('mindmap-terminal-storage', JSON.stringify({version:0,state:{isOpen:true}}));""")
    pg = ctx.new_page(); errs=[]
    pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
    pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
    pg.goto('http://127.0.0.1:5199/', wait_until='networkidle')
    pg.wait_for_selector('[data-testid="chart-fx"]'); pg.wait_for_timeout(1500)
    for ev, times in EV:
        pg.evaluate(f"window.__terminalEmit('{ev}')")
        t0=0
        for t in times:
            pg.wait_for_timeout(t-t0); t0=t
            pg.screenshot(path=f'/tmp/shots/{tag}-{ev}-{t}.png')
        pg.wait_for_timeout(1800)
        # dismiss banner if any
        if pg.locator('[data-testid="stopout-banner"]').count(): pg.get_by_role('button', name='Dismiss stop-out banner').click(); pg.wait_for_timeout(300)
    print('fxlog', [(e['kind'], e['parts']) for e in pg.evaluate('window.__fxLog')])
    print('fxstats', pg.evaluate('window.__fxStats'))
    print('errors', errs[:5])
    b.close()
