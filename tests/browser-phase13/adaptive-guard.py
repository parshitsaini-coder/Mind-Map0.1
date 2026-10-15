import json
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width':1440,'height':900})
    ctx.add_init_script("localStorage.setItem('terminal-debug','1');localStorage.setItem('mindmap-terminal-storage', %s)" % json.dumps(json.dumps({'version':0,'state':{'isOpen':True}})))
    pg = ctx.new_page(); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:5199/', wait_until='networkidle'); pg.wait_for_selector('[data-testid="chart-fx"]'); pg.wait_for_timeout(1000)
    cdp = ctx.new_cdp_session(pg); cdp.send('Emulation.setCPUThrottlingRate', {'rate': 25})
    for i in range(3):
        pg.evaluate("window.__terminalEmit('position.tp.hit')"); pg.wait_for_timeout(1700)
        if any('reduced' in t for t in pg.locator('[data-testid="toast"]').all_inner_texts()): print('toast seen at round', i); break
    print('stats', pg.evaluate('window.__fxStats'))
    print('attr after slow run:', pg.eval_on_selector('.tm-root','e=>e.dataset.anim'))
    print('toast says:', [t for t in pg.locator('[data-testid="toast"]').all_inner_texts() if 'reduced' in t])
    cdp.send('Emulation.setCPUThrottlingRate', {'rate': 1})
    pg.evaluate("window.__terminalEmit('position.tp.hit')"); pg.wait_for_timeout(300)
    print('next popup mode:', pg.get_attribute('[data-testid="order-popup"]','data-mode'), errs)
    b.close()
