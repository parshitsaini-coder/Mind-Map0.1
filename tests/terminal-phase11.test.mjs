// Phase 11 (pure): drawing schema v2 + migration, every tool's layout / hit-test / handles, styles, clone / paste,
// z-order, visibility by timeframe, templates / defaults, magnet, anchors (typed coordinates), fib + position maths.
import './fixtures/legacyInstruments.js'
import * as D from '../src/lib/terminal/drawings.js'
import * as E from '../src/lib/terminal/engine.js'
import { INSTRUMENTS } from '../src/lib/terminal/instruments.js'

let fail = 0
const check = (n, ok, x = '') => { if (!ok) fail++; console.log(`${ok ? '✓' : '✗'} ${n} ${ok ? '' : x}`) }
const near = (a, b, t = 1e-6) => a != null && b != null && Math.abs(a - b) <= t

const times = Array.from({ length: 100 }, (_, i) => 6000 + i * 60)
const tm = D.makeTimeMap(times, 60)
const conv = { logicalToX: (l) => l * 10, xToLogical: (x) => x / 10, priceToY: (p) => 1000 - p * 10, yToPrice: (y) => (1000 - y) / 10 }
const proj = D.makeProjector(tm, conv)
const inst = INSTRUMENTS.EURUSD
const view = { w: 1000, h: 800, fmt: (v) => v.toFixed(2), inst: { ...inst, pipSize: 0.1, digits: 2 }, timeMap: tm, lots: 1 }
const T = (bar) => 6000 + bar * 60
const pt = (bar, p) => ({ t: T(bar), p })
const mk = (type, points, extra) => D.newDrawing(type, points, extra)
const lay = (d, v = view) => D.layoutOf(d, proj, v)

// ── registry ──
check('every tool is in the toolbar order and has a category / icon / tabs', D.DRAW_ORDER.every((t) => D.TOOLS[t].category && D.TOOLS[t].icon && Array.isArray(D.TOOLS[t].tabs)) && D.DRAW_ORDER.length === Object.keys(D.TOOLS).length)
check('22 tools: the 9 old + new ones', D.DRAW_ORDER.length >= 22, String(D.DRAW_ORDER.length))
for (const old of ['trend', 'ray', 'hline', 'vline', 'rect', 'fib', 'channel', 'text', 'measure']) check(`old tool "${old}" still exists`, !!D.TOOLS[old])
check('categories cover every tool', D.DRAW_ORDER.every((t) => D.CATEGORIES.includes(D.TOOLS[t].category)))

// ── schema v2 / migration ──
const old1 = { id: 'a1', type: 'trend', points: [pt(1, 10), pt(5, 20)], color: '#38bdf8', width: 3, dash: true, locked: true }
const [m1] = D.cleanDrawings([old1])
check('schema-1 record: dash:true becomes style.lineStyle dashed; lock / width / colour kept', m1.style.lineStyle === 'dashed' && m1.locked === true && m1.width === 3 && m1.color === '#38bdf8' && m1.dash === undefined)
check('schema-1 record gets every new field with defaults', m1.hidden === false && typeof m1.z === 'number' && m1.visibility.tfMin === 'M1' && m1.visibility.tfMax === 'W1' && m1.textStyle.size === 12 && m1.name === '' && m1.createdAt === 0 && m1.style.opacity === 1)
const [oldFib] = D.cleanDrawings([{ id: 'f', type: 'fib', points: [pt(1, 10), pt(5, 20)], color: '#f59e0b', width: 2, extend: false }])
check('old fib: extend flag kept, default 7 levels added', oldFib.extend === false && oldFib.levels.length === 7 && oldFib.levels.every((l) => l.on))
const [oldText] = D.cleanDrawings([{ id: 't', type: 'text', points: [pt(2, 5)], text: 'hi', color: '#e5e7eb', width: 2 }])
check('old text note keeps its text', oldText.text === 'hi')
const bad = D.cleanDrawings([
  { id: 'x', type: 'nope', points: [pt(1, 1)] }, { id: 'y', type: 'trend', points: [pt(1, 1)] }, null, 'junk', { type: 'trend', points: [pt(1, 1), pt(2, 2)] },
  { id: 'ok', type: 'rect', points: [pt(1, 1), pt(2, 2)], color: 'red', width: 99, style: { lineStyle: 'wavy', opacity: 9, fillOpacity: -3, arrowEnd: 'rocket', fillColor: 'x' }, textStyle: { size: 999, align: 'diagonal' }, visibility: { tfMin: 'W1', tfMax: 'M5' }, z: 'a', name: 'n'.repeat(99) },
])
check('unknown tools / missing ids / short point lists are dropped', bad.length === 1 && bad[0].id === 'ok')
const ok = bad[0]
check('junk style values fall back / clamp', ok.color === '#38bdf8' && ok.width === 2 && ok.style.lineStyle === 'solid' && ok.style.opacity === 1 && ok.style.fillOpacity === 0.02 && ok.style.arrowEnd === 'none' && ok.style.fillColor === '' && ok.textStyle.size === 40 && ok.textStyle.align === 'left')
check('visibility min > max is swapped; name is cut; z falls back to a number', ok.visibility.tfMin === 'M5' && ok.visibility.tfMax === 'W1' && ok.name.length === 40 && typeof ok.z === 'number')
check('cleanDrawings is idempotent', JSON.stringify(D.cleanDrawings(D.cleanDrawings([old1, ok]))) === JSON.stringify(D.cleanDrawings([old1, ok])))
check('measure is never persisted; count is capped', D.cleanDrawings([mk('measure', [pt(1, 1), pt(2, 2)])]).length === 0 && D.cleanDrawings(Array.from({ length: 400 }, () => mk('hline', [pt(1, 1)]))).length === D.MAX_DRAWINGS_PER_SYMBOL)
check('tool defaults: rectangle fills, arrow has an arrow end, ray extends right', mk('rect', [pt(1, 1), pt(2, 2)]).style.fill === true && mk('arrow', [pt(1, 1), pt(2, 2)]).style.arrowEnd === 'arrow' && mk('ray', [pt(1, 1), pt(2, 2)]).style.extendRight === true)

// ── layouts + hit-tests of the NEW tools ──
{
  const d = mk('trend', [pt(10, 50), pt(30, 70)], { style: { extendRight: true } })
  const L = lay(d)
  check('trend + extendRight: line leaves the view', L.segs[0].x2 > 300 && D.hitTest(L, 500, 100)?.kind === 'body')
  const Lb = lay(mk('trend', [pt(10, 50), pt(30, 70)], { style: { extendLeft: true } }))
  check('trend + extendLeft: line starts before the first anchor and hit-tests there', Lb.segs[0].x1 < 100 && D.hitTest(Lb, 50, 550)?.kind === 'body')
  const Ls = lay(mk('trend', [pt(10, 50), pt(30, 70)], { style: { stats: true } }))
  check('trend + stats: a stats box appears (pips / % / bars)', Ls.labels.some((l) => l.lines && /pips/.test(l.lines[1]) && /bars/.test(l.lines[1])))
  check('trend without stats has no box', lay(mk('trend', [pt(10, 50), pt(30, 70)])).labels.length === 0)
}
{
  const L = lay(mk('extline', [pt(10, 50), pt(30, 70)]))
  check('extended line: both ends leave the view; hit far on both sides', L.segs[0].x1 < 0 + 1 && L.segs[0].x2 > 300 && D.hitTest(L, 500, 100)?.kind === 'body' && D.hitTest(L, 20, 580)?.kind === 'body')
  const A = lay(mk('arrow', [pt(10, 50), pt(30, 70)]))
  check('arrow: segment carries the arrow end', A.segs[0].arrowEnd === 'arrow')
  const H = lay(mk('hray', [pt(10, 50)]))
  check('horizontal ray: starts at the anchor, goes to the right edge, hit on it but not behind', H.segs[0].x1 === 100 && H.segs[0].x2 === 1000 && D.hitTest(H, 600, 500)?.kind === 'body' && D.hitTest(H, 40, 500) == null)
  const noLabel = lay(mk('hline', [pt(10, 50)], { style: { labels: false } }))
  check('hline price label can be turned off', noLabel.labels.length === 0 && lay(mk('hline', [pt(10, 50)])).labels.length === 1)
}
{
  const E1 = lay(mk('ellipse', [pt(10, 50), pt(30, 70)])) // box 100..300 × 300..500, centre (200,400)
  check('ellipse: hit on the ring (right-most point) and inside, miss at a corner and far outside', D.hitTest(E1, 300, 400)?.kind === 'body' && D.hitTest(E1, 200, 400)?.kind === 'body' && D.hitTest(E1, 108, 308) == null && D.hitTest(E1, 600, 400) == null)
  check('ellipse: 4 handles like a rectangle', E1.handles.length === 4)
  const Tr = lay(mk('triangle', [pt(10, 50), pt(30, 50), pt(20, 80)]))
  check('triangle: 3 sides, 3 handles, inside is a hit', Tr.segs.length === 3 && Tr.handles.length === 3 && D.hitTest(Tr, 200, 420)?.kind === 'body' && D.hitTest(Tr, 50, 420) == null)
  const Am = lay(mk('arrowmark', [pt(10, 50)]))
  check('arrow marker: an arrow shape you can hit', D.hitTest(Am, 100, 515)?.kind === 'body' && Am.handles.length === 1)
  const Ad = lay(mk('arrowmark', [pt(10, 50)], { dir: 'down' }))
  check('arrow marker down points the other way', Ad.fills[0].poly[1][1] < 500 && Am.fills[0].poly[1][1] > 500)
  const Co = lay(mk('callout', [pt(10, 50), pt(40, 70)], { text: 'Look here' }))
  check('callout: pointer line from the anchor to the box, two handles, box is hit', Co.segs.length === 1 && Co.handles.length === 2 && D.hitTest(Co, 410, 300)?.kind === 'body' && Co.labels[0].note)
}
{
  const P = lay(mk('prange', [pt(10, 50), pt(30, 70)]))
  check('price range: arrow between the prices + stats box', P.segs[0].arrowStart === 'arrow' && P.labels.length === 1 && /pips/.test(P.labels[0].lines[1]) && P.handles.length === 4)
  const Dr = lay(mk('drange', [pt(10, 50), pt(30, 70)]))
  check('date range: two vertical guides, bars + duration', Dr.segs.filter((s) => s.x1 === s.x2).length === 2 && /20 bars/.test(Dr.labels[0].lines[0]) && /20m/.test(Dr.labels[0].lines[1]))
  const Dp = lay(mk('dprange', [pt(10, 50), pt(30, 70)]))
  check('date and price range: box + diagonal + full stats', Dp.segs.length === 5 && /\+/.test(Dp.labels[0].lines[0]) && /bars/.test(Dp.labels[0].lines[1]))
  const noStats = lay(mk('prange', [pt(10, 50), pt(30, 70)], { style: { stats: false } }))
  check('range stats can be turned off', noStats.labels.length === 0)
}

// ── fib: levels, options, math ──
{
  const a = pt(10, 100), b = pt(30, 80)
  check('fibPrice: 0 at the 2nd anchor, 1 at the 1st, 0.5 in the middle', near(D.fibPrice(a, b, 0), 80) && near(D.fibPrice(a, b, 1), 100) && near(D.fibPrice(a, b, 0.5), 90) && near(D.fibPrice(a, b, 0.618), 92.36))
  const f = mk('fib', [a, b])
  const L = lay(f)
  check('fib: price labels use that math', L.labels.some((l) => /0\.618 \(92\.36\)/.test(l.text)))
  const hide = D.cleanDrawings([{ ...f, levels: f.levels.map((l) => (l.v === 0.5 ? { ...l, on: false } : l)) }])[0]
  check('fib: a hidden level is not drawn', lay(hide).segs.filter((s) => s.fibLevel != null).length === 6)
  const custom = D.cleanDrawings([{ ...f, levels: [{ v: 1.618, on: true, color: '#ff0000', style: 'dashed' }, { v: 0, on: true }] }])[0]
  const Lc = lay(custom)
  check('fib: custom level value / colour / style', Lc.segs.filter((s) => s.fibLevel != null).length === 2 && Lc.segs.find((s) => s.fibLevel === 1.618).color === '#ff0000' && Lc.segs.find((s) => s.fibLevel === 1.618).dash === true)
  check('fib: percent labels', lay(D.cleanDrawings([{ ...f, style: { fibPercent: true } }])[0]).labels.some((l) => /61\.8% \(/.test(l.text)))
  check('fib: prices off / levels off', lay(D.cleanDrawings([{ ...f, style: { fibPrices: false } }])[0]).labels.every((l) => !/\(/.test(l.text)) && lay(D.cleanDrawings([{ ...f, style: { fibLevels: false } }])[0]).labels.every((l) => /^\(/.test(l.text)))
  check('fib: reverse swaps which anchor is 0', near(lay(D.cleanDrawings([{ ...f, style: { fibReverse: true } }])[0]).segs.find((s) => s.fibLevel === 0).y1, 1000 - 100 * 10))
  check('fib: trend line + background can be turned off', lay(D.cleanDrawings([{ ...f, style: { fibTrend: false } }])[0]).segs.length === 7 && lay(D.cleanDrawings([{ ...f, style: { fibBg: false } }])[0]).fills.length === 0)
  const ext = mk('fibext', [pt(10, 100), pt(20, 110), pt(30, 105)])
  check('fib extension defaults 0 / 0.618 / 1 / 1.618 / 2.618', ext.levels.map((l) => l.v).join() === '0,0.618,1,1.618,2.618')
  check('fibExtPrice: C + (B−A)·level', near(D.fibExtPrice(...ext.points, 1.618), 105 + 10 * 1.618) && near(D.fibExtPrice(...ext.points, 0), 105))
  const Le = lay(ext)
  check('fib extension: 5 levels + 2 guides, 3 handles, label math', Le.segs.length === 7 && Le.handles.length === 3 && Le.labels.some((l) => /1\.618 \(121\.18\)/.test(l.text)))
}

// ── long / short position tools ──
{
  const inst2 = INSTRUMENTS.EURUSD
  const pts = D.buildPosition('long', { t: T(10), p: 1.16 }, { inst: inst2, tfSec: 60, slPips: 20, tpPips: 40 })
  check('buildPosition long: stop below, target above, 20 bars wide', pts[2].p === 1.158 && pts[3].p === 1.164 && pts[1].t === T(10) + 1200 && pts[1].p === 1.16)
  const sp = D.buildPosition('short', { t: T(10), p: 1.16 }, { inst: inst2, tfSec: 60 })
  check('buildPosition short mirrors it', sp[2].p === 1.162 && sp[3].p === 1.156)
  for (const [sym, entry, risk, reward, type] of [['EURUSD', 1.16, 0.0020, 0.0040, 'long'], ['XAUUSD', 4350, 5, 12, 'long'], ['USDJPY', 150, 0.4, 0.9, 'short'], ['NIFTY50', 22500, 40, 90, 'short']]) {
    const ins = INSTRUMENTS[sym]
    const dir = type === 'long' ? 1 : -1
    const d = mk(type, [{ t: T(10), p: entry }, { t: T(30), p: entry }, { t: T(10), p: entry - dir * risk }, { t: T(10), p: entry + dir * reward }])
    const s = D.positionStats(d, ins, 0.37)
    const side = type === 'long' ? 'buy' : 'sell'
    check(`position maths == engine.pnl: ${sym} ${type}`, near(s.moneyTarget, E.roundMoney(E.pnl(side, 0.37, entry, entry + dir * reward, ins))) && near(s.moneyStop, E.roundMoney(E.pnl(side, 0.37, entry, entry - dir * risk, ins))) && s.moneyTarget > 0 && s.moneyStop < 0 && near(s.rr, reward / risk, 1e-9) && s.valid)
  }
  const wrong = mk('long', [{ t: T(10), p: 10 }, { t: T(30), p: 10 }, { t: T(10), p: 12 }, { t: T(10), p: 9 }])
  check('a long with stop above / target below is flagged invalid', D.positionStats(wrong, inst2, 1).valid === false)
  const L = lay(mk('long', [{ t: T(10), p: 50 }, { t: T(30), p: 50 }, { t: T(10), p: 48 }, { t: T(10), p: 54 }]))
  check('position tool layout: target box above, stop box below, 4 handles, R:R label', L.fills.length === 2 && L.handles.length === 4 && L.labels.some((l) => /R:R 2\.00/.test(l.text)) && D.hitTest(L, 150, 480)?.kind === 'body')
  const mv = D.moveHandle(mk('long', [{ t: T(10), p: 50 }, { t: T(30), p: 50 }, { t: T(10), p: 48 }, { t: T(10), p: 54 }]), 3, T(99), 60, tm).points
  check('dragging the target handle changes only its price', mv[3].p === 60 && mv[3].t === T(10) && mv[0].p === 50)
  const me = D.moveHandle(mk('long', [{ t: T(10), p: 50 }, { t: T(30), p: 50 }, { t: T(10), p: 48 }, { t: T(10), p: 54 }]), 0, T(20), 52, tm).points
  check('dragging the entry keeps the right edge level and stop / target on the same bar', me[0].p === 52 && me[1].p === 52 && me[2].t === T(20) && me[3].t === T(20))
}

// ── moving / handles ──
{
  const e = mk('ellipse', [pt(10, 50), pt(30, 70)])
  const p = D.moveHandle(e, 2, T(40), 90, tm).points
  check('ellipse handles behave like a rectangle', near(tm.toLogical(p[1].t), 40) && p[0].p === 90)
  const tri = mk('triangle', [pt(10, 50), pt(30, 50), pt(20, 80)])
  check('triangle: a handle moves one corner', D.moveHandle(tri, 2, T(25), 85, tm).points[2].p === 85 && D.moveHandle(tri, 2, T(25), 85, tm).points[0].p === 50)
  const long = mk('long', [{ t: T(10), p: 50 }, { t: T(30), p: 50 }, { t: T(10), p: 48 }, { t: T(10), p: 54 }])
  const moved = D.movePoints(long, long.points, 5, 3, tm)
  check('moving a position tool moves all four anchors', moved.every((q, i) => near(tm.toLogical(q.t), tm.toLogical(long.points[i].t) + 5) && near(q.p, long.points[i].p + 3)))
}

// ── typed coordinates ──
{
  const d = mk('trend', [pt(10, 50.123), pt(30, 70)])
  const pa = D.setAnchor(d, 0, { t: T(12), p: 51.4567 }, { digits: 2 })
  check('setAnchor: price is snapped to the tick, time kept as typed', pa.points[0].p === 51.46 && pa.points[0].t === T(12) && pa.points[1].p === 70)
  check('setAnchor ignores NaN / negative prices', D.setAnchor(d, 0, { t: NaN, p: -5 }, { digits: 2 }).points[0].p === 50.123)
  const h = mk('hline', [pt(10, 50)])
  check('hline: only the price is editable; vline: only the time', D.editableFields(h, 0).t === false && D.editableFields(h, 0).p === true && D.editableFields(mk('vline', [pt(10, 50)]), 0).p === false)
  const lg = mk('long', [{ t: T(10), p: 50 }, { t: T(30), p: 50 }, { t: T(10), p: 48 }, { t: T(10), p: 54 }])
  const e2 = D.setAnchor(lg, 0, { t: T(15), p: 51 }, { digits: 2 })
  check('position anchors stay consistent after typing the entry', e2.points[1].p === 51 && e2.points[2].t === T(15) && e2.points[3].t === T(15))
  check('position: stop / target accept only a price', D.editableFields(lg, 2).t === false && D.editableFields(lg, 1).p === false)
  check('fmtDT / parseDT round trip, with a time-zone offset', D.fmtDT(1700000000, 19800) === '2023-11-15 03:43' && D.parseDT('2023-11-15 03:43', 19800) === 1699999980 && D.parseDT('2023-13-40 99:99') === null && D.parseDT('nonsense') === null && D.parseDT('2023-02-30 10:00') === null)
  check('pointName: friendly names for special tools', D.pointName(lg, 2) === 'Stop' && D.pointName(mk('trend', [pt(1, 1), pt(2, 2)]), 1) === 'Point 2' && D.pointName(mk('hline', [pt(1, 1)]), 0) === 'Point')
}

// ── visibility by timeframe ──
{
  const d = D.cleanDrawings([{ ...mk('trend', [pt(1, 1), pt(2, 2)]), visibility: { tfMin: 'M5', tfMax: 'H1' } }])[0]
  check('visible on M5..H1 only', ['M5', 'M15', 'M30', 'H1'].every((t) => D.visibleOn(d, t)) && ['M1', 'H4', 'D1', 'W1'].every((t) => !D.visibleOn(d, t)))
  check('default visibility = every timeframe; unknown timeframe is visible', D.TF_IDS.every((t) => D.visibleOn(mk('trend', [pt(1, 1), pt(2, 2)]), t)) && D.visibleOn(d, 'X9'))
}

// ── z-order / clone / paste ──
{
  const base = ['a', 'b', 'c', 'd'].map((id, i) => ({ ...mk('hline', [pt(1, i + 1)]), id, z: i }))
  const ids = (l) => D.byZ(l).map((d) => d.id).join('')
  check('send to back / bring to front', ids(D.reorder(base, 'c', 'back')) === 'cabd' && ids(D.reorder(base, 'a', 'front')) === 'bcda')
  check('one step up / down; edges are safe', ids(D.reorder(base, 'a', 'up')) === 'bacd' && ids(D.reorder(base, 'd', 'down')) === 'abdc' && ids(D.reorder(base, 'd', 'up')) === 'abcd' && ids(D.reorder(base, 'a', 'down')) === 'abcd')
  check('z is renumbered 0..n−1 and unknown id changes nothing', D.reorder(base, 'b', 'front').map((d) => d.z).sort().join() === '0,1,2,3' && D.reorder(base, 'zzz', 'front') === base)
  check('nextZ is above every z', D.nextZ(base) === 4 && D.nextZ([]) === 0)
  const t = mk('trend', [pt(10, 50), pt(30, 70)], { color: '#ff0000' })
  t.locked = true
  const c = D.cloneDrawing(t, { dBars: 3, dPrice: -2 }, tm, 7)
  check('clone: new id, on top (z), offset, unlocked, style kept, original untouched', c.id !== t.id && c.z === 7 && near(tm.toLogical(c.points[0].t), 13) && near(c.points[0].p, 48) && c.locked === false && c.color === '#ff0000' && t.points[0].p === 50 && t.locked === true)
  check('clone is a deep copy (editing it does not touch the original)', (() => { c.style.lineStyle = 'dotted'; c.points[0].p = 1; return t.style.lineStyle === 'solid' && t.points[0].p === 50 })())
  check('clone of a horizontal line only moves in price', near(tm.toLogical(D.cloneDrawing(mk('hline', [pt(10, 50)]), { dBars: 3, dPrice: 1 }, tm).points[0].t), 10))
  const nu = D.nudgePoints(t, 1, -2, 0.01, tm)
  check('arrow-key nudge: one bar right, two ticks down', near(tm.toLogical(nu[0].t), 11) && near(nu[0].p, 49.98))
}

// ── templates / defaults ──
{
  const d = mk('trend', [pt(1, 1), pt(2, 2)], { color: '#ff00ff', style: { lineStyle: 'dotted', arrowEnd: 'circle', opacity: 0.5 } })
  d.width = 4
  const tpl = D.styleOf(d)
  const fresh = D.applyStyle(mk('trend', [pt(5, 5), pt(6, 6)]), tpl)
  check('applyStyle copies colour / width / style and keeps the geometry', fresh.color === '#ff00ff' && fresh.width === 4 && fresh.style.lineStyle === 'dotted' && fresh.style.arrowEnd === 'circle' && fresh.style.opacity === 0.5 && fresh.points[0].p === 5)
  check('applyStyle(null) is a no-op; junk template values are cleaned', D.applyStyle(fresh, null) === fresh && D.applyStyle(fresh, { color: 'x', width: 99, style: { lineStyle: 'zig' } }).style.lineStyle === 'solid')
  const map = D.cleanTemplateMap({ trend: [{ name: 'Mine', ...tpl }, { name: '' }, null], nope: [{ name: 'x' }], rect: 'junk' })
  check('template map: unknown tools / nameless / junk dropped, entries cleaned', Object.keys(map).join() === 'trend' && map.trend.length === 1 && map.trend[0].color === '#ff00ff')
  const def = D.cleanDefaultsMap({ trend: tpl, nope: tpl, rect: 5 })
  check('defaults map keeps only valid tools', Object.keys(def).join() === 'trend' && def.trend.style.lineStyle === 'dotted')
  check('defaults for a tool do not leak another tool\'s style keys', D.applyStyle(mk('rect', [pt(1, 1), pt(2, 2)]), { style: { fill: false } }).style.fill === false)
}

// ── magnet ──
{
  const candles = Array.from({ length: 10 }, (_, i) => ({ time: 6000 + i * 60, open: 10 + i, high: 12 + i, low: 9 + i, close: 11 + i }))
  const p = { t: 6000 + 3 * 60 + 20, p: 12.4, l: 3.33 }
  check('magnet off leaves the point', D.magnetSnap(p, candles, 'off', 1) === p)
  const weak = D.magnetSnap(p, candles, 'weak', 0.5)
  check('weak magnet: snaps to the nearest OHLC (nearest of O13 H15 L12 C14 to 12.4 is the low 12)', weak.p === 12 && weak.l === 3 && weak.t === candles[3].time, JSON.stringify(weak))
  check('weak magnet: does nothing when far', D.magnetSnap({ ...p, p: 30 }, candles, 'weak', 0.5).p === 30)
  check('strong magnet: always snaps (to the nearest of O/H/L/C)', D.magnetSnap({ ...p, p: 30 }, candles, 'strong').p === 15)
  check('magnet clamps the bar index to the data', D.magnetSnap({ t: 1, p: 11, l: -5 }, candles, 'strong').l === 0 && D.magnetSnap({ t: 1, p: 11, l: 99 }, candles, 'strong').l === 9)
}

// ── indicators added in Phase 11 ──
{
  const I = await import('../src/lib/terminal/indicators.js')
  const cs = Array.from({ length: 60 }, (_, i) => ({ time: 1000 + i * 60, open: 100 + Math.sin(i / 3) * 5, high: 106 + Math.sin(i / 3) * 5, low: 96 + Math.sin(i / 3) * 5, close: 100 + Math.sin(i / 3 + 0.4) * 5, volume: 100 + (i % 7) * 10 }))
  const v = I.computeIndicator('volume', cs, { ma: 5 })
  check('volume: histogram equals the bar volume, MA is the SMA', v.lines.vol.length === 60 && v.lines.vol[3] === cs[3].volume && Math.abs(v.lines.ma[10] - cs.slice(6, 11).reduce((a, c) => a + c.volume, 0) / 5) < 1e-9 && v.lines.ma[3] == null)
  const sr = I.computeIndicator('stochrsi', cs, {})
  const k = sr.lines.k.filter((x) => x != null)
  check('stochrsi: %K and %D stay in 0..100 and start after the warm-up', k.length > 20 && k.every((x) => x >= -1e-9 && x <= 100 + 1e-9) && sr.lines.d.filter((x) => x != null).length > 10 && sr.lines.k[10] == null)
  const flat = I.computeIndicator('stochrsi', cs.map((c) => ({ ...c, close: 100 })), {})
  check('stochrsi: flat prices do not produce NaN', flat.lines.k.every((x) => x == null || Number.isFinite(x)))
  check('14 indicators now (12 old + Volume + StochRSI)', I.INDICATOR_TYPES.length === 14 && I.INDICATOR_TYPES.includes('volume') && I.INDICATOR_TYPES.includes('stochrsi'))
  const CS = await import('../src/lib/terminal/cloudSync.js')
  const clean = CS.sanitizeIndicators([{ id: 'a', type: 'rsi', params: {}, styles: { rsi: { width: 3, lineStyle: 'dotted', hidden: true }, nope: { width: 9 } }, visibility: { tfMin: 'H1', tfMax: 'M5' }, paneSize: 7 }, { id: 'old', type: 'sma' }])
  check('sanitize: unknown line dropped, bad values fixed, order of tfMin/tfMax repaired', clean[0].styles.rsi.width === 3 && clean[0].styles.rsi.hidden === true && !clean[0].styles.nope && clean[0].paneSize === 1 && D.TF_IDS.indexOf(clean[0].visibility.tfMin) <= D.TF_IDS.indexOf(clean[0].visibility.tfMax))
  check('sanitize: an old save (no styles / visibility) gets defaults', clean[1].visible === true && clean[1].collapsed === false && clean[1].visibility.tfMin === D.TF_IDS[0])
}

process.exit(fail ? 1 : 0)
