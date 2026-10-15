// Phase 13 — chart effects. Pure: which effects an event produces, a capped queue, and canvas drawing
// functions that take a 2D context. The React layer (ChartFx.jsx) owns the canvas and the rAF loop.
import { EVENTS_BY_ID } from './eventCatalog.js'
import { money } from './popupModel.js'

export const MAX_FX = 6 // concurrent effects
const GREEN = '#22c55e', RED = '#ef4444', AMBER = '#f59e0b', BLUE = '#38bdf8', GREY = '#94a3b8'

export const FX_KINDS = ['sweep', 'ring', 'rings', 'pulse', 'shockwave', 'crack', 'sparkle', 'fade', 'flash', 'badge', 'vignette', 'border', 'shake']

const sideColor = (s) => (s === 'sell' ? RED : GREEN)

// Effects for one event. `flags` is motionFlags(): fx / particles / shake / vignette / reduced.
// Returns [] when the event has no chart effect (or effects are off).
export function fxSpecs(id, d = {}, flags = { fx: true, particles: true, shake: true, vignette: true, reduced: false }) {
  if (!EVENTS_BY_ID[id] || !flags.fx) return []
  const p = d.price
  const at = Number.isFinite(p)
  const out = []
  const add = (s) => out.push({ symbol: d.symbol || null, price: at ? p : null, ...s })
  const badge = (text, color, dur = 1500, count = null) => add({ kind: 'badge', text, color, dur, count })
  if (flags.reduced) {
    // reduced motion: one short fade of the line / badge, nothing travels, no particles
    const label = BADGE_TEXT[id]?.(d)
    if (id === 'account.margin.warning') add({ kind: 'border', color: AMBER, dur: 1200 })
    else if (at) add({ kind: 'flash', color: COLOR_OF[id] || BLUE, dur: 240 })
    if (label && at) badge(label.text, label.color, 1200, label.count)
    return out
  }
  switch (id) {
    case 'order.buy.filled':
    case 'order.sell.filled':
      if (at) { add({ kind: 'sweep', color: sideColor(d.side), dur: 300 }); add({ kind: 'ring', color: sideColor(d.side), dur: 700 }) }
      break
    case 'order.pending.placed':
      if (at) add({ kind: 'sweep', color: BLUE, dur: 300 })
      break
    case 'order.pending.triggered':
      if (at) { add({ kind: 'pulse', color: sideColor(d.side), dur: 900 }); add({ kind: 'ring', color: sideColor(d.side), dur: 800 }); badge(BADGE_TEXT[id](d).text, sideColor(d.side)) }
      break
    case 'order.cancelled':
      if (at) add({ kind: 'fade', color: GREY, dur: 450 })
      break
    case 'order.rejected':
      if (flags.shake) add({ kind: 'shake', dur: 300 })
      break
    case 'order.modified':
      if (at) add({ kind: 'flash', color: BLUE, dur: 300 })
      break
    case 'position.tp.hit':
      if (at) { add({ kind: 'shockwave', color: GREEN, dur: 900 }); if (flags.particles) add({ kind: 'sparkle', color: GREEN, dur: 1000, up: true }); const b = BADGE_TEXT[id](d); badge(b.text, b.color, 1800, b.count) }
      break
    case 'position.sl.hit':
      if (at) { add({ kind: 'crack', color: RED, dur: 450 }); const b = BADGE_TEXT[id](d); badge(b.text, b.color, 1800, b.count) }
      if (flags.shake) add({ kind: 'shake', dur: 250 })
      break
    case 'position.closed.win':
      if (at) { if (flags.particles) add({ kind: 'sparkle', color: GREEN, dur: 900 }); add({ kind: 'ring', color: GREEN, dur: 600 }); const b = BADGE_TEXT[id](d); badge(b.text, b.color, 1500, b.count) }
      break
    case 'position.closed.loss':
      if (at) { add({ kind: 'fade', color: RED, dur: 700 }); const b = BADGE_TEXT[id](d); badge(b.text, b.color, 1500, b.count) }
      break
    case 'position.closed.flat':
      if (at) { add({ kind: 'fade', color: GREY, dur: 500 }); badge('CLOSED FLAT', GREY, 1200) }
      break
    case 'position.partial':
      if (at) { add({ kind: 'ring', color: BLUE, dur: 600 }); const b = BADGE_TEXT[id](d); badge(b.text, b.color, 1400, b.count) }
      break
    case 'position.reversed':
      if (at) { add({ kind: 'ring', color: sideColor(d.side), dur: 600 }); add({ kind: 'sweep', color: sideColor(d.side), dur: 300 }); badge(`REVERSED → ${String(d.side || '').toUpperCase()}`, sideColor(d.side), 1400) }
      break
    case 'account.margin.warning':
      add({ kind: 'border', color: AMBER, dur: 4000 })
      break
    case 'account.stopout':
      if (flags.vignette) add({ kind: 'vignette', color: RED, dur: 400 })
      if (at) add({ kind: 'crack', color: RED, dur: 450 })
      if (flags.shake) add({ kind: 'shake', dur: 250 })
      break
    case 'alert.price':
      if (at) { add({ kind: 'rings', color: AMBER, dur: 1400 }); badge('🔔 PRICE ALERT', AMBER, 1600) }
      break
    default: break
  }
  return out
}

const COLOR_OF = { 'position.tp.hit': GREEN, 'position.sl.hit': RED, 'position.closed.win': GREEN, 'position.closed.loss': RED, 'account.stopout': RED, 'order.buy.filled': GREEN, 'order.sell.filled': RED }
const BADGE_TEXT = {
  'order.pending.triggered': (d) => ({ text: d.orderType === 'stop' || d.orderType === 'stoplimit' ? 'STOP TRIGGERED' : 'LIMIT FILLED', color: d.side === 'sell' ? RED : GREEN }),
  'position.tp.hit': (d) => ({ text: 'TARGET HIT', color: GREEN, count: Number.isFinite(d.pnl) ? d.pnl : null }),
  'position.sl.hit': (d) => ({ text: 'STOPPED OUT', color: RED, count: Number.isFinite(d.pnl) ? d.pnl : null }),
  'position.closed.win': (d) => ({ text: 'CLOSED', color: GREEN, count: Number.isFinite(d.pnl) ? d.pnl : null }),
  'position.closed.loss': (d) => ({ text: 'CLOSED', color: RED, count: Number.isFinite(d.pnl) ? d.pnl : null }),
  'position.partial': (d) => ({ text: 'PARTIAL', color: BLUE, count: Number.isFinite(d.pnl) ? d.pnl : null }),
  'account.stopout': (d) => ({ text: `STOP-OUT${d.marginLevel != null ? ` — margin level ${Math.round(d.marginLevel)} %` : ''}`, color: RED }),
}

// Does this event produce ANY visible chart effect with full motion? (used by the "every event is visible" test)
export const hasChartFx = (id, d = { price: 1, side: 'buy', pnl: 1 }) => fxSpecs(id, d, { fx: true, particles: true, shake: true, vignette: true, reduced: false }).length > 0

// ── capped queue ──
export function createFxQueue(cap = MAX_FX) {
  let items = []
  return {
    add(spec, now) {
      items.push({ ...spec, t0: now, seed: (Math.imul(items.length + 1, 2654435761) ^ Math.floor(now)) >>> 0 })
      while (items.length > cap) items.shift() // oldest goes first
      return items.length
    },
    prune(now) { items = items.filter((i) => now - i.t0 < i.dur); return items.length },
    list: () => items,
    size: () => items.length,
    clear() { items = [] },
  }
}
export const progress = (it, now) => Math.min(1, Math.max(0, (now - it.t0) / it.dur))

// ── drawing ──  geom = { w, h, y(price) -> px|null, plotW }
const rng = (seed) => { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296 } }
const ease = (t) => 1 - Math.pow(1 - t, 3)

export function drawFx(g, it, now, geom) {
  const t = progress(it, now)
  const y = it.price != null ? geom.y(it.price) : null
  const W = geom.plotW ?? geom.w
  g.save()
  try {
    switch (it.kind) {
      case 'sweep': { // a bright line drawn left → right
        if (y == null) break
        g.globalAlpha = 1 - t * 0.6
        g.strokeStyle = it.color; g.lineWidth = 2.5
        g.beginPath(); g.moveTo(0, y); g.lineTo(W * ease(t), y); g.stroke()
        break
      }
      case 'ring': case 'rings': {
        if (y == null) break
        const n = it.kind === 'rings' ? 3 : 1
        for (let i = 0; i < n; i++) {
          const tt = Math.min(1, Math.max(0, t * (n === 1 ? 1 : 1.5) - i * 0.25))
          if (tt <= 0) continue
          g.globalAlpha = (1 - tt) * 0.9
          g.strokeStyle = it.color; g.lineWidth = 2
          g.beginPath(); g.arc(W - 40, y, 6 + ease(tt) * 46, 0, Math.PI * 2); g.stroke()
        }
        break
      }
      case 'pulse': { // glow pulse on the line
        if (y == null) break
        const k = Math.sin(t * Math.PI * 3) * (1 - t)
        g.globalAlpha = Math.max(0, 0.15 + 0.6 * Math.abs(k))
        g.strokeStyle = it.color; g.lineWidth = 6 + 6 * Math.abs(k)
        g.shadowColor = it.color; g.shadowBlur = 14
        g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke()
        break
      }
      case 'shockwave': {
        if (y == null) break
        g.globalAlpha = (1 - t) * 0.8
        g.strokeStyle = it.color; g.lineWidth = 3
        g.beginPath(); g.ellipse(W - 40, y, 10 + ease(t) * Math.min(160, W * 0.4), 4 + ease(t) * 26, 0, 0, Math.PI * 2); g.stroke()
        g.globalAlpha = (1 - t) * 0.5
        g.lineWidth = 2
        g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke()
        break
      }
      case 'crack': { // a short jagged horizontal line that flashes
        if (y == null && it.price != null) break
        const yy = y ?? geom.h / 2
        g.globalAlpha = 1 - t
        g.strokeStyle = it.color; g.lineWidth = 2.5
        g.beginPath(); g.moveTo(0, yy)
        const r = rng(it.seed), steps = 24
        for (let i = 1; i <= steps; i++) g.lineTo((W / steps) * i * Math.min(1, t * 3 + 0.15), yy + (r() - 0.5) * 12 * (1 - t))
        g.stroke()
        break
      }
      case 'sparkle': { // particles drifting up (or out)
        if (y == null) break
        const r = rng(it.seed)
        g.fillStyle = it.color
        for (let i = 0; i < 18; i++) {
          const a = r() * Math.PI * 2, sp = 20 + r() * 70, life = 0.5 + r() * 0.5
          if (t > life) continue
          const k = t / life
          const dx = it.up ? (r() - 0.5) * 60 : Math.cos(a) * sp * k
          const dy = it.up ? -sp * 1.4 * k : Math.sin(a) * sp * k
          g.globalAlpha = (1 - k) * 0.9
          g.beginPath(); g.arc(W - 40 + dx, y + dy, 2.2 * (1 - k * 0.5), 0, Math.PI * 2); g.fill()
        }
        break
      }
      case 'fade': { // the line dissolves
        if (y == null) break
        g.globalAlpha = (1 - t) * 0.8
        g.strokeStyle = it.color; g.lineWidth = 2; g.setLineDash?.([6, 5])
        g.beginPath(); g.moveTo(0, y + t * 10); g.lineTo(W * (1 - t * 0.3), y + t * 10); g.stroke()
        break
      }
      case 'flash': {
        if (y == null) break
        g.globalAlpha = (1 - t) * 0.9
        g.strokeStyle = it.color; g.lineWidth = 3
        g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke()
        break
      }
      case 'badge': {
        if (y == null && it.symbol != null && it.price != null) break
        const yy = (y ?? 36) - 16
        const fadeIn = Math.min(1, t * 8), fadeOut = t > 0.8 ? 1 - (t - 0.8) / 0.2 : 1
        g.globalAlpha = Math.max(0, Math.min(fadeIn, fadeOut))
        const val = it.count != null ? ` ${money(countTo(it.count, Math.min(1, t * 2.5)))}` : ''
        const text = `${it.text}${val}`
        g.font = '700 12px system-ui, sans-serif'
        const w = (g.measureText ? g.measureText(text).width : text.length * 7) + 18
        const x = W - w - 10, by = Math.max(4, yy - 14 * (1 - Math.min(1, t * 6)) - (t > 0.5 ? (t - 0.5) * 20 : 0))
        g.fillStyle = it.color
        g.fillRect(x, by, w, 22)
        g.fillStyle = '#fff'
        g.textBaseline = 'middle'
        g.fillText(text, x + 9, by + 11)
        break
      }
      case 'vignette': {
        const grad = g.createRadialGradient(geom.w / 2, geom.h / 2, Math.min(geom.w, geom.h) * 0.25, geom.w / 2, geom.h / 2, Math.max(geom.w, geom.h) * 0.7)
        grad.addColorStop(0, 'rgba(239,68,68,0)'); grad.addColorStop(1, 'rgba(239,68,68,0.55)')
        g.globalAlpha = Math.sin(Math.min(1, t) * Math.PI)
        g.fillStyle = grad; g.fillRect(0, 0, geom.w, geom.h)
        break
      }
      case 'border': { // amber border pulsing at 1 Hz
        const on = (Math.sin((now - it.t0) / 1000 * Math.PI * 2 - Math.PI / 2) + 1) / 2
        g.globalAlpha = (0.25 + 0.55 * on) * (t > 0.85 ? 1 - (t - 0.85) / 0.15 : 1)
        g.strokeStyle = it.color; g.lineWidth = 4
        g.strokeRect(2, 2, geom.w - 4, geom.h - 4)
        break
      }
      default: break // 'shake' is applied to the chart element by the component, not drawn
    }
  } catch { /* a bad draw call never breaks the chart */ }
  g.restore()
}
const countTo = (to, t) => (t >= 1 ? to : Math.round(to * ease(t) * 100) / 100)

// ── fan-out from the event bus to every mounted chart ──
const listeners = new Set()
export function onChartEvent(fn) { listeners.add(fn); return () => listeners.delete(fn) }
export function dispatchChartEvent(e) { for (const fn of listeners) { try { fn(e) } catch { /* ignore */ } } }
