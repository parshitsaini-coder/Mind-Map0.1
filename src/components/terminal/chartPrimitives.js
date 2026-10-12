// lightweight-charts "series primitives": custom canvas painters that live inside the chart,
// so they pan / zoom with it for free and never fall out of sync.
//   FillPrimitive      – shaded band between two lines (Bollinger) or a 2-colour cloud (Ichimoku)
//   DrawingsPrimitive  – every user drawing, rendered from a scene supplied on each frame
import { TEXT_H } from '../../lib/terminal/drawings'

const FONT = '600 11px system-ui, -apple-system, Segoe UI, sans-serif'

function makePrimitive(paint) {
  let chart = null
  let series = null
  let requestUpdate = null
  const view = { renderer: () => ({ draw: (target) => target.useMediaCoordinateSpace((scope) => paint(scope, { chart, series })) }), zOrder: () => 'top' }
  return {
    attached(p) { chart = p.chart; series = p.series; requestUpdate = p.requestUpdate },
    detached() { chart = null; series = null; requestUpdate = null },
    paneViews: () => [view],
    updateAllViews() {},
    refresh: () => requestUpdate && requestUpdate(),
  }
}

// data = { n, a: (number|null)[], b: (number|null)[], mode: 'band'|'cloud', color, up, down }
// a/b are indexed by logical bar index (0 = first candle); indexes ≥ candle count are the future.
export function createFillPrimitive() {
  let data = null
  const prim = makePrimitive(({ context: ctx }, { chart, series }) => {
    if (!data || !chart || !series) return
    const ts = chart.timeScale()
    const range = ts.getVisibleLogicalRange()
    if (!range) return
    const from = Math.max(0, Math.floor(range.from) - 1)
    const to = Math.min(data.n - 1, Math.ceil(range.to) + 1)
    const X = (i) => ts.logicalToCoordinate(i)
    const Y = (v) => series.priceToCoordinate(v)
    ctx.save()
    if (data.mode === 'band') {
      ctx.fillStyle = data.color
      let run = []
      const flush = () => {
        if (run.length > 1) {
          ctx.beginPath()
          run.forEach((q, k) => (k ? ctx.lineTo(q.x, q.ya) : ctx.moveTo(q.x, q.ya)))
          for (let k = run.length - 1; k >= 0; k--) ctx.lineTo(run[k].x, run[k].yb)
          ctx.closePath()
          ctx.fill()
        }
        run = []
      }
      for (let i = from; i <= to; i++) {
        const a = data.a[i]
        const b = data.b[i]
        if (a == null || b == null) { flush(); continue }
        const x = X(i)
        const ya = Y(a)
        const yb = Y(b)
        if (x == null || ya == null || yb == null) { flush(); continue }
        run.push({ x, ya, yb })
      }
      flush()
    } else {
      for (let i = Math.max(from, 0); i < to; i++) {
        const a0 = data.a[i], b0 = data.b[i], a1 = data.a[i + 1], b1 = data.b[i + 1]
        if (a0 == null || b0 == null || a1 == null || b1 == null) continue
        const x0 = X(i), x1 = X(i + 1)
        const ya0 = Y(a0), yb0 = Y(b0), ya1 = Y(a1), yb1 = Y(b1)
        if ([x0, x1, ya0, yb0, ya1, yb1].some((v) => v == null)) continue
        ctx.fillStyle = a0 + a1 >= b0 + b1 ? data.up : data.down
        ctx.beginPath()
        ctx.moveTo(x0, ya0); ctx.lineTo(x1, ya1); ctx.lineTo(x1, yb1); ctx.lineTo(x0, yb0)
        ctx.closePath()
        ctx.fill()
      }
    }
    ctx.restore()
  })
  return { prim, set: (d) => { data = d; prim.refresh() } }
}

// getScene({width,height}) -> { items: [{ d, lay, selected, ghost }] }
export function createDrawingsPrimitive(getScene) {
  const prim = makePrimitive(({ context: ctx, mediaSize }) => {
    const scene = getScene(mediaSize)
    if (!scene || !scene.items.length) return
    ctx.save()
    ctx.font = FONT
    ctx.textBaseline = 'middle'
    for (const { d, lay, selected, ghost } of scene.items) {
      ctx.globalAlpha = ghost ? 0.85 : 1
      const color = d.type === 'measure' ? (lay.labels[0]?.up === false ? '#ef4444' : '#38bdf8') : d.color
      for (const f of lay.fills) {
        if (!f.alpha) continue
        ctx.globalAlpha = f.alpha
        ctx.fillStyle = color
        ctx.beginPath()
        f.poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
        ctx.closePath()
        ctx.fill()
      }
      ctx.lineCap = 'round'
      for (const s of lay.segs) {
        ctx.globalAlpha = s.alpha ?? 1
        ctx.strokeStyle = color
        ctx.lineWidth = d.width || 2
        ctx.setLineDash(s.dash || d.dash ? [6, 4] : [])
        ctx.beginPath()
        ctx.moveTo(s.x1, s.y1)
        ctx.lineTo(s.x2, s.y2)
        ctx.stroke()
        if (s.arrow) {
          const ang = Math.atan2(s.y2 - s.y1, s.x2 - s.x1)
          ctx.setLineDash([])
          ctx.beginPath()
          ctx.moveTo(s.x2, s.y2)
          ctx.lineTo(s.x2 - 9 * Math.cos(ang - 0.4), s.y2 - 9 * Math.sin(ang - 0.4))
          ctx.moveTo(s.x2, s.y2)
          ctx.lineTo(s.x2 - 9 * Math.cos(ang + 0.4), s.y2 - 9 * Math.sin(ang + 0.4))
          ctx.stroke()
        }
      }
      ctx.setLineDash([])
      ctx.globalAlpha = 1
      for (const l of lay.labels) {
        if (l.plain) {
          ctx.fillStyle = color
          ctx.textAlign = l.align
          ctx.fillText(l.text, l.x, l.y)
        } else if (d.type === 'text') {
          ctx.fillStyle = 'rgba(17,24,39,0.88)'
          ctx.strokeStyle = color
          ctx.lineWidth = 1
          roundRect(ctx, l.x, l.y - TEXT_H / 2, l.bw, TEXT_H, 5)
          ctx.fill()
          ctx.stroke()
          ctx.fillStyle = color
          ctx.textAlign = 'left'
          ctx.fillText(l.text, l.x + 7, l.y)
        } else if (l.lines) {
          const bx = clampX(l.x - l.bw / 2, l.bw, mediaSize.width)
          const by = Math.max(2, Math.min(mediaSize.height - l.bh - 2, l.up ? l.y - l.bh : l.y))
          ctx.fillStyle = l.up ? 'rgba(14,116,144,0.92)' : 'rgba(185,28,28,0.92)'
          roundRect(ctx, bx, by, l.bw, l.bh, 5)
          ctx.fill()
          ctx.fillStyle = '#fff'
          ctx.textAlign = 'center'
          l.lines.forEach((t, i) => ctx.fillText(t, bx + l.bw / 2, by + 11 + i * 14))
        }
      }
      if (selected) {
        for (const h of lay.handles) {
          ctx.beginPath()
          ctx.arc(h.x, h.y, 5, 0, Math.PI * 2)
          ctx.fillStyle = '#0f1419'
          ctx.fill()
          ctx.lineWidth = 2
          ctx.strokeStyle = color
          ctx.stroke()
        }
      }
    }
    ctx.restore()
  })
  return prim
}

const clampX = (x, w, max) => Math.max(2, Math.min(max - w - 2, x))

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
