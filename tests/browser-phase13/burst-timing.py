import json
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args=['--no-sandbox'])
    for W,H in ((1440,900),(360,740)):
        ctx = b.new_context(viewport={'width':W,'height':H})
        ctx.add_init_script("localStorage.setItem('terminal-debug','1');localStorage.setItem('mindmap-terminal-storage', %s)" % json.dumps(json.dumps({'version':0,'state':{'isOpen':True}})))
        pg = ctx.new_page(); pg.goto('http://127.0.0.1:5199/', wait_until='networkidle'); pg.wait_for_selector('[data-testid="chart-fx"]'); pg.wait_for_timeout(1500)
        # baseline: frame intervals with NO effect
        base = pg.evaluate("""() => new Promise(r => { const d=[]; let l=performance.now(); let n=0; const f=t=>{ d.push(t-l); l=t; if(++n<90) requestAnimationFrame(f); else r(d.slice(1)) }; requestAnimationFrame(f) })""")
        pg.evaluate("window.__fxStats=undefined")
        res = pg.evaluate("""() => new Promise(r => { const d=[]; let l=performance.now(); let n=0;
          for (const id of ['position.tp.hit','position.sl.hit','order.pending.triggered','alert.price','position.closed.win','account.stopout']) window.__terminalEmit(id);
          const f=t=>{ d.push(t-l); l=t; if(++n<100) requestAnimationFrame(f); else r(d.slice(1)) }; requestAnimationFrame(f) })""")
        st = lambda a: (round(sorted(a)[len(a)//2],1), round(sorted(a)[int(len(a)*0.95)],1), round(max(a),1))
        print(W, 'idle  median/p95/max ms', st(base)); print(W, 'burst median/p95/max ms', st(res), 'concurrent cap log', len(pg.evaluate('window.__fxLog')), pg.evaluate('window.__fxStats'))
        ctx.close()
    b.close()
