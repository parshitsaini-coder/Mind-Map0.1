// Drawing-tool geometry, hit-testing and editing. Run: node tests/terminal-drawings.test.mjs
import * as D from '../src/lib/terminal/drawings.js'

let fail = 0
const check = (name, ok, extra = '') => { if (!ok) fail++; console.log(`${ok ? '✓' : '✗'} ${name} ${ok ? '' : extra}`) }
const near = (a, b, tol = 1e-6) => a != null && b != null && Math.abs(a - b) <= tol

// 100 candles, one per 60 s, starting at t=6000. 10 px per bar; price p ↔ y = 1000 − 10p.
const times = Array.from({ length: 100 }, (_, i) => 6000 + i * 60)
const tm = D.makeTimeMap(times, 60)
const conv = { logicalToX: (l) => l * 10, xToLogical: (x) => x / 10, priceToY: (p) => 1000 - p * 10, yToPrice: (y) => (1000 - y) / 10 }
const proj = D.makeProjector(tm, conv)
const view = { w: 1000, h: 800, fmt: (v) => v.toFixed(2) }
const T = (bar) => 6000 + bar * 60
const pt = (bar, p) => ({ t: T(bar), p })

// ── time map ──
check('time→logical on a bar', near(tm.toLogical(T(10)), 10))
check('time→logical between bars', near(tm.toLogical(T(10) + 30), 10.5))
check('logical→time round trip', near(tm.toTime(tm.toLogical(T(37) + 12)), T(37) + 12))
check('future time extrapolates', near(tm.toLogical(T(99) + 600), 109))
check('before the first bar extrapolates', near(tm.toLogical(T(0) - 120), -2))
check('logical→time past the end', near(tm.toTime(104), T(99) + 5 * 60))
{
  const gappy = D.makeTimeMap([0, 60, 120, 3720, 3780], 60) // a weekend-style gap between bar 2 and 3
  check('gap: logical is by bar, not by clock', near(gappy.toLogical(3720), 3) && near(gappy.toLogical(1920), 2.5))
  check('gap: round trip', near(gappy.toTime(gappy.toLogical(2000)), 2000))
}

// ── projector ──
check('projector x/y', near(proj.x(T(5)), 50) && near(proj.y(80), 200))
check('projector inverse', near(proj.t(50), T(5)) && near(proj.p(200), 80))

// ── factories ──
{
  const d = D.newDrawing('trend', [pt(1, 10), pt(2, 20)])
  check('new drawing has id/colour/width and is unlocked', d.id && d.color && d.width === 2 && d.locked === false)
  check('ids are unique', new Set(Array.from({ length: 200 }, () => D.newId())).size === 200)
  check('text drawing has default text', D.newDrawing('text', [pt(1, 1)]).text === 'Note')
  check('fib extends right by default', D.newDrawing('fib', [pt(1, 1), pt(2, 2)]).extend === true)
}

// ── layout + hit-testing per tool ──
const mk = (type, points, extra) => D.newDrawing(type, points, extra)
{
  const d = mk('trend', [pt(10, 50), pt(30, 70)]) // (100,500) → (300,300)
  const L = D.layoutOf(d, proj, view)
  check('trend: one segment between the anchors', L.segs.length === 1 && near(L.segs[0].x1, 100) && near(L.segs[0].y1, 500) && near(L.segs[0].x2, 300) && near(L.segs[0].y2, 300))
  check('trend: hit on the line (200,400)', D.hitTest(L, 200, 400)?.kind === 'body')
  check('trend: miss 30px away', D.hitTest(L, 200, 430) == null)
  check('trend: handle only when selected', D.hitTest(L, 100, 500, { selected: false })?.kind === 'body' && D.hitTest(L, 102, 502, { selected: true })?.kind === 'handle')
  check('trend: handle index', D.hitTest(L, 300, 300, { selected: true }).idx === 1)
  check('trend: not hit beyond the end', D.hitTest(L, 340, 260) == null)
}
{
  const d = mk('ray', [pt(10, 50), pt(30, 70)])
  const L = D.layoutOf(d, proj, view)
  check('ray: extends past the 2nd anchor until it leaves the view (top edge)', L.segs[0].x2 > 300 && L.segs[0].y2 < 0 && near(L.segs[0].x2 - 100, 500 - L.segs[0].y2 - 0, 1e-6) )
  check('ray: hit far along the extension', D.hitTest(L, 500, 100)?.kind === 'body') // slope −1: (500,100) is on the line
  check('ray: does NOT extend backwards', D.hitTest(L, 50, 550) == null)
  const e = D.extendRay(0, 0, 10, 0, 100, 100)
  check('extendRay horizontal reaches the right margin', e.y === 0 && e.x > 100)
  const same = D.extendRay(5, 5, 5, 5, 100, 100)
  check('extendRay with identical points does not blow up', same.x === 5 && same.y === 5)
}
{
  const d = mk('hline', [pt(10, 60)]) // y = 400
  const L = D.layoutOf(d, proj, view)
  check('hline: spans the whole width at the price', near(L.segs[0].y1, 400) && L.segs[0].x1 === 0 && L.segs[0].x2 === 1000)
  check('hline: price label', L.labels[0].text === '60.00')
  check('hline: hit anywhere along it', D.hitTest(L, 777, 403)?.kind === 'body' && D.hitTest(L, 777, 420) == null)
  const moved = D.movePoints(d, d.points, 15, 5, tm)
  check('hline: moves vertically only', moved[0].t === d.points[0].t && near(moved[0].p, 65))
  check('hline: handle drag changes price only', near(D.moveHandle(d, 0, T(50), 71, tm).points[0].p, 71) && D.moveHandle(d, 0, T(50), 71, tm).points[0].t === d.points[0].t)
}
{
  const d = mk('vline', [pt(40, 50)]) // x = 400
  const L = D.layoutOf(d, proj, view)
  check('vline: full height at the time', near(L.segs[0].x1, 400) && L.segs[0].y1 === 0 && L.segs[0].y2 === 800)
  check('vline: hit', D.hitTest(L, 403, 123)?.kind === 'body' && D.hitTest(L, 420, 123) == null)
  const moved = D.movePoints(d, d.points, 5, 9, tm)
  check('vline: moves horizontally only', near(tm.toLogical(moved[0].t), 45) && moved[0].p === 50)
}
{
  const d = mk('rect', [pt(10, 80), pt(30, 60)]) // (100,200) → (300,400)
  const L = D.layoutOf(d, proj, view)
  check('rect: 4 edges, 1 fill, 4 handles', L.segs.length === 4 && L.fills.length === 1 && L.handles.length === 4)
  check('rect: inside counts as a hit', D.hitTest(L, 200, 300)?.kind === 'body')
  check('rect: outside misses', D.hitTest(L, 500, 300) == null)
  check('rect: corner handle idx 2 = (x2, y1)', (() => { const h = L.handles.find((q) => q.idx === 2); return near(h.x, 300) && near(h.y, 200) })())
  const p2 = D.moveHandle(d, 2, T(40), 90, tm).points // drag top-right corner
  check('rect: dragging corner 2 moves p2.time and p1.price', near(tm.toLogical(p2[1].t), 40) && p2[1].p === 60 && p2[0].p === 90 && p2[0].t === d.points[0].t)
  const p3 = D.moveHandle(d, 3, T(5), 50, tm).points // bottom-left
  check('rect: dragging corner 3 moves p1.time and p2.price', near(tm.toLogical(p3[0].t), 5) && p3[0].p === 80 && p3[1].p === 50)
}
{
  const d = mk('fib', [pt(10, 100), pt(30, 200)]) // swing low 100 → swing high 200; 0 at 200, 1 at 100
  const L = D.layoutOf(d, proj, view)
  const lv = (x) => L.segs.find((s) => s.fibLevel === x)
  check('fib: 0 level at the 2nd anchor, 1 at the 1st', near(lv(0).y1, proj.y(200)) && near(lv(1).y1, proj.y(100)))
  check('fib: 0.5 is the midpoint (150)', near(lv(0.5).y1, proj.y(150)))
  check('fib: 0.618 retraces to 138.2', near(lv(0.618).y1, proj.y(200 - 0.618 * 100)))
  check('fib: 7 levels + the dashed guide', L.segs.length === 8 && L.segs.filter((s) => s.fibLevel != null).length === 7)
  check('fib: label shows level and price', L.labels.some((l) => l.text === '0.5 (150.00)'))
  check('fib: extends right by default', lv(0.5).x2 >= 1000)
  const L2 = D.layoutOf({ ...d, extend: false }, proj, view)
  check('fib: no-extend stops at the right anchor', near(L2.segs.find((s) => s.fibLevel === 0.5).x2, 300))
}
{
  const d = mk('channel', [pt(10, 50), pt(30, 60)], { offset: -20 })
  const L = D.layoutOf(d, proj, view)
  check('channel: 3 lines (base, parallel, dashed middle)', L.segs.length === 3 && L.segs[2].dash)
  check('channel: parallel is offset by exactly −20 in price', near(L.segs[1].y1 - L.segs[0].y1, 200) && near(L.segs[1].y2 - L.segs[0].y2, 200))
  check('channel: parallel keeps the same slope', near(L.segs[1].y2 - L.segs[1].y1, L.segs[0].y2 - L.segs[0].y1))
  check('channel: handle 2 sits mid-way on the parallel', (() => { const h = L.handles.find((q) => q.idx === 2); return near(h.x, 200) && near(h.y, (L.segs[1].y1 + L.segs[1].y2) / 2) })())
  check('channel: hit on the parallel', D.hitTest(L, 200, ((L.segs[1].y1 + L.segs[1].y2) / 2) + 2)?.kind === 'body')
  const third = D.channelOffset(d, tm, 20, 40) // base line at bar 20 = 55
  check('channelOffset: click at price 40 where the line is 55 → −15', near(third, -15))
  check('channelOffset: dragging handle 2 updates the offset', near(D.moveHandle(d, 2, T(20), 40, tm).offset, -15))
  check('channel: moving a base handle keeps the offset', D.moveHandle(d, 0, T(5), 45, tm).offset === undefined)
}
{
  const d = mk('text', [pt(20, 70)], { text: 'Support' })
  const L = D.layoutOf(d, proj, view)
  check('text: label + clickable box', L.labels[0].text === 'Support' && L.fills.length === 1)
  check('text: hit inside the box', D.hitTest(L, 220, 300)?.kind === 'body' && D.hitTest(L, 600, 300) == null)
}
{
  const d = mk('measure', [pt(10, 100), pt(30, 105)])
  const inst = { pipSize: 0.1 }
  const L = D.layoutOf(d, proj, { ...view, inst, timeMap: tm })
  const m = D.measureInfo(d.points[0], d.points[1], inst, tm)
  check('measure: Δ=+5, 50 pips, +5%, 20 bars, 20 min', near(m.dp, 5) && near(m.pips, 50) && near(m.pct, 5) && m.bars === 20 && m.secs === 1200)
  check('measure: label has 2 lines with the numbers', L.labels[0].lines[0].includes('+5.00') && L.labels[0].lines[1].includes('50.0 pips') && L.labels[0].lines[1].includes('20 bars'))
  const down = D.measureInfo(pt(30, 105), pt(10, 100), inst, tm)
  check('measure: backwards drag is negative in price and time', down.dp === -5 && down.bars === -20 && down.up === false)
  check('formatDuration', D.formatDuration(90) === '1m' && D.formatDuration(3 * 3600 + 120) === '3h 2m' && D.formatDuration(2 * 86400 + 5 * 3600) === '2d 5h')
}

// ── editing helpers ──
{
  const d = mk('trend', [pt(10, 50), pt(30, 70)])
  const mv = D.movePoints(d, d.points, 5.5, -3, tm)
  check('movePoints shifts both anchors by the same bars/price', near(tm.toLogical(mv[0].t), 15.5) && near(tm.toLogical(mv[1].t), 35.5) && near(mv[0].p, 47) && near(mv[1].p, 67))
  check('moveHandle replaces one anchor', (() => { const r = D.moveHandle(d, 1, T(50), 90, tm).points; return near(tm.toLogical(r[1].t), 50) && r[1].p === 90 && r[0].p === 50 })())
  check('moveHandle does not mutate the original', d.points[1].p === 70)
}

// ── safety: unprojectable / bad data ──
{
  const nullProj = { ...proj, x: () => null }
  check('layout returns null when coordinates are unavailable', D.layoutOf(mk('trend', [pt(1, 1), pt(2, 2)]), nullProj, view) == null)
  check('hitTest(null) is safe', D.hitTest(null, 1, 1) == null)
  check('zero-length segment hit-test does not NaN', Number.isFinite(D.distToSeg(5, 5, 3, 3, 3, 3)))
  const good = mk('trend', [pt(1, 1), pt(2, 2)])
  const clean = D.sanitizeDrawings([good, null, { type: 'nope' }, { id: 'x', type: 'trend', points: [{ t: 1 }] }, { ...good, id: 'y', points: [{ t: NaN, p: 1 }, pt(1, 1)] }, 'junk', { ...good, id: 'z', width: 99 }])
  check('sanitize keeps only valid drawings (and clamps width)', clean.length === 2 && clean[0].id === good.id && clean[1].width === 2)
  check('sanitize(non-array) = []', D.sanitizeDrawings(null).length === 0 && D.sanitizeDrawings({}).length === 0)
  check('measure is never persisted', D.sanitizeDrawings([mk('measure', [pt(1, 1), pt(2, 2)])]).length === 0)
  check('sanitize caps the count', D.sanitizeDrawings(Array.from({ length: 500 }, () => mk('hline', [pt(1, 1)]))).length === D.MAX_DRAWINGS_PER_SYMBOL)
  check('every tool has a spec & is in the toolbar order', D.DRAW_ORDER.every((t) => D.DRAW_TYPES[t]) && D.DRAW_ORDER.length === Object.keys(D.DRAW_TYPES).length)
}

console.log(fail ? `\n${fail} FAILED` : '\nALL PASSED')
process.exit(fail ? 1 : 0)
