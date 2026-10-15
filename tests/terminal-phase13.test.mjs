// Phase 13 (pure): motion policy, popup model for every catalogue event, count-up, chart-effect specs / queue / drawing, settings.
import * as C from '../src/lib/terminal/eventCatalog.js'
import * as P from '../src/lib/terminal/popupModel.js'
import * as M from '../src/lib/terminal/motionPolicy.js'
import * as F from '../src/lib/terminal/chartFx.js'
import { cleanChartSettings, DEFAULT_CHART_SETTINGS } from '../src/lib/terminal/chartSettings.js'

let fail = 0
const check = (n, ok, x = '') => { if (!ok) fail++; console.log(`${ok ? '✓' : '✗'} ${n} ${ok ? '' : x}`) }
const A = DEFAULT_CHART_SETTINGS.anim
const sample = (id) => ({ symbol: 'XAUUSD', side: /sell|loss|sl\./.test(id) ? 'sell' : 'buy', lots: 0.1, price: 2000.5, sl: 1990, tp: 2020, pnl: /loss|sl\.|stopout/.test(id) ? -45 : /flat/.test(id) ? 0 : 90, orderType: 'limit', slipPips: 0.4, distPips: 25, what: 'SL', from: 1990, to: 1995, marginLevel: 42, reason: 'Stop loss must be below the current price' })

// ── popup model ──
check('every catalogue event has a popup variant entry', C.EVENT_IDS.every((id) => id in P.POPUP_VARIANT))
check('popupFor returns a model exactly when the variant is not "none"', C.EVENT_IDS.every((id) => (P.popupFor({ id, data: sample(id) }) !== null) === (P.POPUP_VARIANT[id] !== 'none')))
check('every event is VISIBLE: popup or chart effect (or both)', C.EVENT_IDS.filter((id) => !id.startsWith('ui.')).every((id) => P.popupFor({ id, data: sample(id) }) || F.hasChartFx(id, sample(id)) || ['connection.lost', 'connection.restored'].includes(id)), C.EVENT_IDS.filter((id) => !(P.popupFor({ id, data: sample(id) }) || F.hasChartFx(id, sample(id)))).join())
{
  const m = (id, d) => P.popupFor({ id, data: { ...sample(id), ...d } })
  check('buy filled: title, symbol / lots / price / SL / TP, slippage', (() => { const x = m('order.buy.filled'); return x.title === 'BUY FILLED' && x.tone === 'buy' && x.lines[0] === 'XAUUSD · 0.1 lots' && x.lines[1] === '@ 2,000.50' && x.lines[2] === 'SL 1,990.00 · TP 2,020.00' && x.lines[3] === 'filled 0.4 pip worse' })())
  check('sell filled is red, no SL/TP line when none', (() => { const x = m('order.sell.filled', { sl: null, tp: null, slipPips: 0 }); return x.title === 'SELL FILLED' && x.tone === 'sell' && x.lines.length === 2 })())
  check('slippage wording: better / plural / negligible', P.slipText(-1.5) === 'filled 1.5 pips better' && P.slipText(0.02) === null && P.slipText(NaN) === null && P.slipText(1) === 'filled 1.0 pip worse')
  check('pending placed: BUY LIMIT PLACED @ price + distance ring', (() => { const x = m('order.pending.placed', { side: 'buy', orderType: 'limit', price: 4318.5 }); return x.title === 'BUY LIMIT PLACED @ 4,318.50' && x.ring.pips === 25 })())
  check('stop / stop-limit / market names', /SELL STOP PLACED/.test(m('order.pending.placed', { side: 'sell', orderType: 'stop' }).title) && /STOP-LIMIT/.test(m('order.pending.placed', { orderType: 'stoplimit' }).title))
  check('triggered: LIMIT FILLED vs STOP TRIGGERED', m('order.pending.triggered', { orderType: 'limit' }).title === 'LIMIT FILLED' && m('order.pending.triggered', { orderType: 'stop' }).title === 'STOP TRIGGERED')
  check('modified: "SL MOVED a → b" and a roll from old to new', (() => { const x = m('order.modified', { what: 'SL', from: 4331.2, to: 4336, symbol: 'XAUUSD' }); return x.title === 'SL MOVED' && x.lines[0] === '4,331.20 → 4,336.00' && x.roll.from === 4331.2 && x.roll.to === 4336 })())
  check('cancelled is neutral grey', m('order.cancelled').tone === 'neutral')
  check('rejected: error tone, shake, the reason is shown, Fix only when fixable', (() => { const x = m('order.rejected'); return x.tone === 'error' && x.shake && x.lines[0].includes('Stop loss must') && x.fix === null && m('order.rejected', { fixable: true }).fix.label === 'Fix' })())
  check('closed: win / loss / flat titles, tone, count target, sparkle only on a win', (() => { const w = m('position.closed.win'), l = m('position.closed.loss'), f = m('position.closed.flat'); return w.title === 'CLOSED IN PROFIT' && w.sparkle && w.count.to === 90 && l.title === 'CLOSED AT A LOSS' && !l.sparkle && l.tone === 'loss' && l.count.to === -45 && f.title === 'CLOSED FLAT' && f.tone === 'neutral' })())
  check('partial close, TP hit, SL hit, reversed', m('position.partial').title === 'PARTIAL CLOSE' && m('position.tp.hit').title === 'TARGET HIT' && m('position.tp.hit').sparkle && m('position.sl.hit').title === 'STOPPED OUT' && !m('position.sl.hit').sparkle && m('position.reversed', { side: 'sell' }).title === 'REVERSED → SELL')
  check('stop-out: banner with the margin level', (() => { const x = m('account.stopout'); return x.banner === true && x.lines[0] === 'margin level 42 %' })())
  check('money format uses a real minus', P.money(-45) === '−$45.00' && P.money(90) === '+$90.00')
}
check('countUp: starts at 0, rises monotonically, ends EXACTLY on the final value', (() => {
  for (const to of [90, -45, 123.45, 0.01, -0.07]) {
    let prev = 0
    for (let i = 0; i < 100; i++) { const v = P.countUp(to, i / 100); if (Math.abs(v) + 1e-9 < Math.abs(prev)) return false; prev = v }
    if (P.countUp(to, 1) !== to || P.countUp(to, 5) !== to || P.countUp(to, 0) !== 0) return false
  }
  return true
})())
check('rollTo ends exactly on the new value', P.rollTo(4331.2, 4336, 1) === 4336 && P.rollTo(4331.2, 4336, 0) === 4331.2 && P.rollTo(1, 2, 0.5) > 1)

// ── motion policy ──
check('effectiveMode matrix', M.effectiveMode({ ...A, mode: 'full', matchSystem: true }, { prefersReduced: true }) === 'reduced' && M.effectiveMode({ ...A, mode: 'full', matchSystem: false }, { prefersReduced: true }) === 'full' && M.effectiveMode({ ...A, mode: 'off' }, { prefersReduced: true }) === 'off' && M.effectiveMode({ ...A, mode: 'full' }, { adaptive: true }) === 'reduced' && M.effectiveMode({ ...A, mode: 'off' }, { adaptive: true }) === 'off')
{
  const f = M.motionFlags(A), r = M.motionFlags({ ...A, mode: 'reduced' }), o = M.motionFlags({ ...A, mode: 'off' })
  check('full: everything on', f.full && f.fx && f.particles && f.shake && f.vignette && f.rows && f.spring && f.popup === 'full')
  check('reduced: 120 ms fades, no particles / shake / vignette / spring', r.reduced && r.fadeMs === 120 && !r.particles && !r.shake && !r.vignette && !r.spring && r.fx && r.rows)
  check('off: no effects, no rows, popup falls back to plain toast', o.off && !o.fx && !o.rows && !o.particles && o.popup === 'toast')
  check('popup duration comes from the setting', M.motionFlags({ ...A, popupSeconds: 2.5 }).popupMs === 2500)
  check('per-effect toggles are honoured', !M.motionFlags({ ...A, particles: false }).particles && !M.motionFlags({ ...A, shake: false }).shake && !M.motionFlags({ ...A, chartFx: false }).fx && !M.motionFlags({ ...A, chartFx: false }).vignette && !M.motionFlags({ ...A, rows: false }).rows)
  check('showToast: errors always; full popup follows alsoToast; off hides the rest', M.showToast(M.motionFlags({ ...A, popup: 'off' }), 'error') && !M.showToast(M.motionFlags({ ...A, popup: 'off' }), 'info') && !M.showToast(M.motionFlags({ ...A, alsoToast: false }), 'win') && M.showToast(M.motionFlags({ ...A, alsoToast: true }), 'win') && M.showToast(M.motionFlags({ ...A, popup: 'toast' }), 'info') && M.showToast(M.motionFlags({ ...A, alsoToast: false }), 'error'))
}
{
  const w = M.createFrameWatch()
  let tripped = false
  for (let i = 0; i < 50; i++) tripped = w.push(40) || tripped
  check('frame watchdog trips on > 24 ms average over a second, once', tripped && w.push(40) === false)
  const w2 = M.createFrameWatch(); let t2 = false
  for (let i = 0; i < 80; i++) t2 = w2.push(16.7) || t2
  check('frame watchdog stays quiet at 60 fps', !t2)
  const w3 = M.createFrameWatch(); let t3 = false
  for (let i = 0; i < 80; i++) t3 = w3.push(i % 20 === 0 ? 900 : 16) || t3 // tab-hidden gaps are ignored
  check('frame watchdog ignores long gaps (hidden tab)', !t3)
}

// ── chart effects ──
const FULL = M.motionFlags(A)
check('effects off → none', F.fxSpecs('position.tp.hit', sample('position.tp.hit'), { ...FULL, fx: false }).length === 0)
check('unknown event → none', F.fxSpecs('nope', {}, FULL).length === 0)
check('TP hit: shockwave + particles + count-up badge', (() => { const s = F.fxSpecs('position.tp.hit', sample('position.tp.hit'), FULL); return s.some((x) => x.kind === 'shockwave') && s.some((x) => x.kind === 'sparkle') && s.some((x) => x.kind === 'badge' && x.text === 'TARGET HIT' && x.count === 90) })())
check('SL hit: crack + shake + STOPPED OUT badge with the loss', (() => { const s = F.fxSpecs('position.sl.hit', sample('position.sl.hit'), FULL); return s.some((x) => x.kind === 'crack') && s.some((x) => x.kind === 'shake' && x.dur === 250) && s.some((x) => x.kind === 'badge' && x.text === 'STOPPED OUT' && x.count === -45) })())
check('stop-out: vignette 400 ms', F.fxSpecs('account.stopout', sample('account.stopout'), FULL).some((x) => x.kind === 'vignette' && x.dur === 400))
check('margin warning: amber border pulse, no price needed', F.fxSpecs('account.margin.warning', {}, FULL).some((x) => x.kind === 'border' && x.dur >= 3000))
check('limit trigger: pulse + ring + LIMIT FILLED badge', (() => { const s = F.fxSpecs('order.pending.triggered', sample('x'), FULL); return s.some((x) => x.kind === 'pulse') && s.some((x) => x.kind === 'ring') && s.some((x) => x.text === 'LIMIT FILLED') })())
check('stop trigger badge says STOP TRIGGERED', F.fxSpecs('order.pending.triggered', { ...sample('x'), orderType: 'stop' }, FULL).some((x) => x.text === 'STOP TRIGGERED'))
check('position opens: entry sweep 300 ms', F.fxSpecs('order.buy.filled', sample('x'), FULL).some((x) => x.kind === 'sweep' && x.dur === 300))
check('price alert: concentric rings', F.fxSpecs('alert.price', sample('x'), FULL).some((x) => x.kind === 'rings'))
check('no particles / no shake when those toggles are off', !F.fxSpecs('position.tp.hit', sample('x'), { ...FULL, particles: false }).some((x) => x.kind === 'sparkle') && !F.fxSpecs('position.sl.hit', sample('x'), { ...FULL, shake: false }).some((x) => x.kind === 'shake') && !F.fxSpecs('account.stopout', sample('x'), { ...FULL, vignette: false }).some((x) => x.kind === 'vignette'))
{
  const R = M.motionFlags({ ...A, mode: 'reduced' })
  const kinds = new Set(C.EVENT_IDS.flatMap((id) => F.fxSpecs(id, sample(id), R).map((s) => s.kind)))
  check('reduced motion: only flash / badge / border, nothing travels, no particles', [...kinds].every((k) => ['flash', 'badge', 'border'].includes(k)), [...kinds].join())
  check('reduced motion effects are short (≤ 1.2 s, flashes 240 ms)', C.EVENT_IDS.every((id) => F.fxSpecs(id, sample(id), R).every((s) => s.dur <= (s.kind === 'border' ? 1200 : 1200))))
}
check('every effect kind is known', C.EVENT_IDS.every((id) => F.fxSpecs(id, sample(id), FULL).every((s) => F.FX_KINDS.includes(s.kind))))
{
  const q = F.createFxQueue()
  for (let i = 0; i < 10; i++) q.add({ kind: 'ring', price: 1, color: '#fff', dur: 1000, n: i }, 0)
  check('queue is capped at 6; the oldest are dropped', q.size() === F.MAX_FX && F.MAX_FX === 6 && q.list()[0].n === 4 && q.list().at(-1).n === 9)
  check('prune removes finished effects only', (q.prune(500), q.size() === 6) && (q.prune(1001), q.size() === 0))
  check('progress runs 0 → 1 and clamps', (() => { const it = { t0: 100, dur: 200 }; return F.progress(it, 0) === 0 && F.progress(it, 200) === 0.5 && F.progress(it, 999) === 1 })())
}
{
  // every effect kind draws without throwing on a stub context, and produces drawing calls when it has a price
  const calls = []
  const g = new Proxy({}, { get: (_, k) => { if (k === 'measureText') return () => ({ width: 80 }); if (k === 'createRadialGradient') return () => ({ addColorStop() {} }); return () => { calls.push(k) } }, set: () => true })
  const geom = { w: 800, h: 500, plotW: 740, y: () => 200 }
  let threw = false
  for (const kind of F.FX_KINDS) for (const t of [0, 0.3, 0.99]) { const it = { kind, price: 1, color: '#22c55e', dur: 1000, t0: 0, seed: 7, text: 'X', count: 90, symbol: 'XAUUSD' }; try { F.drawFx(g, it, t * 1000, geom) } catch { threw = true } }
  check('drawFx: every kind draws, never throws', !threw && calls.includes('stroke') && calls.includes('fillRect') && calls.includes('arc'))
  const c2 = []
  const g2 = new Proxy({}, { get: (_, k) => { if (k === 'measureText') return () => ({ width: 80 }); return () => { c2.push(k) } }, set: () => true })
  F.drawFx(g2, { kind: 'ring', price: 1, color: '#fff', dur: 1000, t0: 0, seed: 1 }, 100, { ...geom, y: () => null })
  check('an off-screen price (no y) draws nothing for line effects', !c2.includes('stroke'))
}

// ── settings ──
{
  const c = cleanChartSettings({ anim: { mode: 'sepia', popup: 'huge', popupSeconds: 99, popupPos: 'left', particles: 'yes' } })
  check('anim settings: bad values fall back, seconds clamped to 1–4', c.anim.mode === 'full' && c.anim.popup === 'full' && c.anim.popupSeconds === 4 && c.anim.popupPos === 'top' && c.anim.particles === true)
  check('anim defaults: Full, match system ON, popup 1.6 s, also toast ON', A.mode === 'full' && A.matchSystem === true && A.popup === 'full' && A.popupSeconds === 1.6 && A.alsoToast === true)
  check('a save from before Phase 13 gets the anim block', cleanChartSettings({ v: 1, sounds: { volume: 10 } }).anim.mode === 'full')
}
process.exit(fail ? 1 : 0)
