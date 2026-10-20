import {
  TrendingUp, TrendingDown, Slash, MoveUpRight, Info, Minus, ArrowRight, GripVertical, Plus, Columns2, Activity, Waypoints, Spline,
  ChartNoAxesGantt, Triangle, Square, Circle, Type, MessageSquare, StickyNote, Table, Flag, Pencil, Highlighter, Hash,
  Waves, Clock, Target, Orbit, GitBranch, ChartBar, ChartCandlestick, Ghost, Layers, Pentagon, Hexagon, Rotate3d,
  Mountain, Milestone, ArrowBigUp, ArrowBigDown, MapPin, Tag, MessageCircle, MoveVertical, MoveHorizontal, Scan, Grid3x3, Grid2x2, Radar, Fan,
  Rainbow, ArrowUpRight, Repeat, Infinity as InfinityIcon, ChartSpline, ChartLine, Radius, Shell, Sunrise,
} from 'lucide-react'

// ──────────────────────────────────────────────────────────────────────────
// Whiteboard drawing-tool registry (TradingView-style left toolbar).
//
// Every tool is a pure geometry function: given the clicked board-space
// points it returns SVG children. `ShapeElement.jsx` renders them twice — a
// visible pass and a transparent, fat-stroked "hit" pass so thin lines are
// easy to grab. Nothing here touches the DOM or the store.
// ──────────────────────────────────────────────────────────────────────────

const EXT = 5000
const LV_COLORS = ['#787b86', '#f23645', '#ff9800', '#4caf50', '#089981', '#00bcd4', '#787b86', '#2962ff', '#e91e63', '#9c27b0', '#673ab7', '#ff5252', '#00897b']
const GREEN = '#089981'
const RED = '#f23645'

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y })
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y })
const mul = (a, s) => ({ x: a.x * s, y: a.y * s })
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
const len = (a) => Math.hypot(a.x, a.y)
const dist = (a, b) => len(sub(a, b))
const unit = (a) => {
  const l = len(a) || 1
  return { x: a.x / l, y: a.y / l }
}
const along = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
const rayEnd = (a, b, far = EXT) => add(a, mul(unit(sub(b, a)), far))
const angleDeg = (a, b) => (-Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
const r1 = (n) => Math.round(n * 10) / 10
const r2 = (n) => Math.round(n * 100) / 100
const seeded = (seed) => () => {
  seed = (seed * 16807) % 2147483647
  return (seed - 1) / 2147483646
}
const ink = (hex) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '')
  if (!m) return '#ffffff'
  const n = parseInt(m[1], 16)
  const l = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)
  return l > 150 ? '#242423' : '#ffffff'
}

function lineIntersect(p1, p2, p3, p4) {
  const d = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x)
  if (Math.abs(d) < 1e-6) return null
  const a = p1.x * p2.y - p1.y * p2.x
  const b = p3.x * p4.y - p3.y * p4.x
  return { x: (a * (p3.x - p4.x) - (p1.x - p2.x) * b) / d, y: (a * (p3.y - p4.y) - (p1.y - p2.y) * b) / d }
}

const M = (p) => {
  const r = {}
  if (p) for (const k of Object.keys(p)) if (p[k] !== undefined) r[k] = p[k]
  return r
}

// ── tiny SVG builder ──────────────────────────────────────────────────────
// `o` = { c color, w stroke width, dash, fill (bool), fo fill opacity, text, fs font size, emoji, hit }
export function build(o, fn) {
  const out = []
  let k = 0
  const hit = !!o.hit
  const base = hit
    ? { stroke: 'transparent', strokeWidth: Math.max(o.w, 12), fill: 'none', pointerEvents: 'stroke', strokeLinecap: 'round', strokeLinejoin: 'round' }
    : { stroke: o.c, strokeWidth: o.w, fill: 'none', strokeDasharray: o.dash, strokeLinecap: 'round', strokeLinejoin: 'round', pointerEvents: 'none' }
  const fs = o.fs || 12
  const fillP = (color) => (hit ? { fill: 'transparent', pointerEvents: 'all' } : { fill: color || o.fc || o.c, fillOpacity: o.fo, pointerEvents: 'none' })
  const H = {
    o,
    fs,
    fillP,
    line: (a, b, p) => out.push(<line key={k++} x1={a.x} y1={a.y} x2={b.x} y2={b.y} {...base} {...M(p)} />),
    poly: (ps, p, closed) => {
      const s = ps.map((q) => `${q.x},${q.y}`).join(' ')
      out.push(closed ? <polygon key={k++} points={s} {...base} {...M(p)} /> : <polyline key={k++} points={s} {...base} {...M(p)} />)
    },
    path: (d, p) => out.push(<path key={k++} d={d} {...base} {...M(p)} />),
    ellipse: (cx, cy, rx, ry, p) => out.push(<ellipse key={k++} cx={cx} cy={cy} rx={Math.max(0.1, rx)} ry={Math.max(0.1, ry)} {...base} {...M(p)} />),
    dot: (a, r = 3, p) => out.push(<circle key={k++} cx={a.x} cy={a.y} r={r} {...base} {...(hit ? { fill: 'transparent', pointerEvents: 'all' } : { fill: o.c, stroke: 'none' })} {...M(p)} />),
    rect: (a, b, p) =>
      out.push(<rect key={k++} x={Math.min(a.x, b.x)} y={Math.min(a.y, b.y)} width={Math.abs(b.x - a.x)} height={Math.abs(b.y - a.y)} {...base} {...M(p)} />),
    // Plain text (no background).
    text: (x, y, s, p) =>
      out.push(
        <text
          key={k++}
          x={x}
          y={y}
          fontSize={fs}
          fontFamily="system-ui, sans-serif"
          fontWeight={600}
          {...(hit ? { fill: 'transparent', pointerEvents: 'all' } : { fill: o.c, stroke: 'none', pointerEvents: 'none' })}
          style={{ userSelect: 'none' }}
          {...M(p)}
        >
          {s}
        </text>
      ),
    // Solid coloured tag with contrasting text. Returns the box so callers can attach tails.
    tag: (x, y, str, opts = {}) => {
      const lines = String(str).split('\n')
      const tw = Math.max(...lines.map((l) => l.length), 3) * fs * 0.58 + 14
      const th = lines.length * fs * 1.25 + 8
      const anchor = opts.anchor || 'middle'
      const x0 = anchor === 'start' ? x : anchor === 'end' ? x - tw : x - tw / 2
      const y0 = opts.top ? y : y - th / 2
      out.push(
        <rect key={k++} x={x0} y={y0} width={tw} height={th} rx={4} {...base} {...(hit ? { fill: 'transparent', pointerEvents: 'all', stroke: 'none' } : { fill: opts.bg || o.c, stroke: 'none' })} />
      )
      out.push(
        <text
          key={k++}
          x={x0 + tw / 2}
          y={y0 + 4 + fs}
          textAnchor="middle"
          fontSize={fs}
          fontFamily="system-ui, sans-serif"
          fontWeight={600}
          {...(hit ? { fill: 'transparent', pointerEvents: 'none' } : { fill: opts.fg || ink(opts.bg || o.c), stroke: 'none', pointerEvents: 'none' })}
          style={{ userSelect: 'none' }}
        >
          {lines.map((l, i) => (
            <tspan key={i} x={x0 + tw / 2} dy={i === 0 ? 0 : fs * 1.25}>
              {l || ' '}
            </tspan>
          ))}
        </text>
      )
      return { x0, y0, w: tw, h: th }
    },
    // Label placed above or below a vertex depending on whether it's a local high or low.
    vlabel: (pts, i, str) => {
      const q = pts[i]
      const prev = pts[i - 1] || pts[i + 1] || q
      const next = pts[i + 1] || pts[i - 1] || q
      const up = q.y <= Math.min(prev.y, next.y)
      out.push(
        <text
          key={k++}
          x={q.x}
          y={up ? q.y - 8 : q.y + fs + 6}
          textAnchor="middle"
          fontSize={fs}
          fontFamily="system-ui, sans-serif"
          fontWeight={700}
          {...(hit ? { fill: 'transparent', pointerEvents: 'none' } : { fill: o.c, stroke: 'none', pointerEvents: 'none' })}
          style={{ userSelect: 'none' }}
        >
          {str}
        </text>
      )
    },
    arrowHead: (from, to, p) => {
      const ang = Math.atan2(to.y - from.y, to.x - from.x)
      const hl = 8 + o.w * 1.6
      const a1 = { x: to.x - hl * Math.cos(ang - 0.45), y: to.y - hl * Math.sin(ang - 0.45) }
      const a2 = { x: to.x - hl * Math.cos(ang + 0.45), y: to.y - hl * Math.sin(ang + 0.45) }
      out.push(<polyline key={k++} points={`${a1.x},${a1.y} ${to.x},${to.y} ${a2.x},${a2.y}`} {...base} strokeDasharray={undefined} {...M(p)} />)
    },
  }
  fn(H)
  return out
}

const faint = { opacity: 0.55 }
const dashed = { strokeDasharray: '5 5' }

// ── pitchfork family ───────────────────────────────────────────────────────
function pitchfork(p, H, origin, inside) {
  const a = origin
  const b = p[1]
  const c = p[2]
  const m = mid(b, c)
  const dir = unit(sub(m, a))
  const far = dist(a, m) * 2.5 + 300
  const tail = (q) => add(q, mul(dir, far))
  if (H.o.fill) {
    H.poly([b, tail(b), tail(c), c], { ...H.fillP(), stroke: 'none', opacity: 0.7 }, true)
  }
  H.line(a, tail(a))
  H.line(b, tail(b))
  H.line(c, tail(c))
  H.line(b, c, { ...faint })
  if (inside) {
    const q1 = along(m, b, 0.5)
    const q2 = along(m, c, 0.5)
    H.line(q1, tail(q1), { ...dashed, ...faint })
    H.line(q2, tail(q2), { ...dashed, ...faint })
  }
}

// ── fib helpers ─────────────────────────────────────────────────────────────
const FIB = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]
const FIB_EXT = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.272, 1.618, 2, 2.618, 3.618, 4.236]

function horizontalLevels(H, x0, x1, ys, levels) {
  levels.forEach((l, i) => {
    const col = LV_COLORS[i % LV_COLORS.length]
    H.line({ x: x0, y: ys[i] }, { x: x1, y: ys[i] }, { stroke: H.o.hit ? undefined : col })
    H.text(x0 - 6, ys[i] + 4, String(l), { textAnchor: 'end', fill: H.o.hit ? undefined : col })
  })
  if (H.o.fill) {
    for (let i = 0; i < levels.length - 1; i++) {
      H.poly(
        [{ x: x0, y: ys[i] }, { x: x1, y: ys[i] }, { x: x1, y: ys[i + 1] }, { x: x0, y: ys[i + 1] }],
        { ...H.fillP(LV_COLORS[(i + 1) % LV_COLORS.length]), fillOpacity: 0.1, stroke: 'none' },
        true
      )
    }
  }
}

function arcPath(c, r, a0, a1) {
  // angles in radians, screen space (y down). Draws from a0 to a1 along the shorter way.
  let d = a1 - a0
  while (d > Math.PI) d -= 2 * Math.PI
  while (d < -Math.PI) d += 2 * Math.PI
  const s = { x: c.x + r * Math.cos(a0), y: c.y + r * Math.sin(a0) }
  const e = { x: c.x + r * Math.cos(a0 + d), y: c.y + r * Math.sin(a0 + d) }
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${Math.abs(d) > Math.PI ? 1 : 0} ${d > 0 ? 1 : 0} ${e.x} ${e.y}`
}

function gridBox(H, a, b, divs, diagonals) {
  const x0 = Math.min(a.x, b.x)
  const x1 = Math.max(a.x, b.x)
  const y0 = Math.min(a.y, b.y)
  const y1 = Math.max(a.y, b.y)
  if (H.o.fill) H.rect(a, b, { ...H.fillP(), stroke: 'none' })
  H.rect(a, b)
  divs.forEach((d) => {
    if (d <= 0 || d >= 1) return
    H.line({ x: x0 + (x1 - x0) * d, y: y0 }, { x: x0 + (x1 - x0) * d, y: y1 }, faint)
    H.line({ x: x0, y: y0 + (y1 - y0) * d }, { x: x1, y: y0 + (y1 - y0) * d }, faint)
  })
  if (diagonals) {
    H.line({ x: x0, y: y0 }, { x: x1, y: y1 }, faint)
    H.line({ x: x1, y: y0 }, { x: x0, y: y1 }, faint)
  }
}

// ── elliott / labelled polylines ─────────────────────────────────────────
const labelled = (labels, extra) => (p, H) => {
  const pts = p.slice(0, labels.length)
  H.poly(pts, undefined, false)
  pts.forEach((q, i) => {
    H.dot(q, 3)
    H.vlabel(pts, i, labels[i])
  })
  if (extra) extra(pts, H)
}

// ── trading positions ───────────────────────────────────────────────────
const position = (kind) => (p, H) => {
  const a = p[0]
  const b = p[1]
  const x0 = Math.min(a.x, b.x)
  const x1 = Math.max(Math.max(a.x, b.x), x0 + 80)
  const target = b.y
  const stop = a.y - (b.y - a.y) / 2
  const g = H.o.hit ? { stroke: 'transparent' } : {}
  H.poly([{ x: x0, y: a.y }, { x: x1, y: a.y }, { x: x1, y: target }, { x: x0, y: target }], { ...H.fillP(GREEN), fillOpacity: 0.2, stroke: H.o.hit ? undefined : GREEN }, true)
  H.poly([{ x: x0, y: a.y }, { x: x1, y: a.y }, { x: x1, y: stop }, { x: x0, y: stop }], { ...H.fillP(RED), fillOpacity: 0.2, stroke: H.o.hit ? undefined : RED }, true)
  H.line({ x: x0, y: a.y }, { x: x1, y: a.y }, { ...g, stroke: H.o.hit ? undefined : '#787b86' })
  const tD = Math.abs(target - a.y)
  const sD = Math.abs(stop - a.y)
  H.tag((x0 + x1) / 2, target + (target < a.y ? -14 : 14), `Target: ${r1(tD)}`, { bg: GREEN, fg: '#fff' })
  H.tag((x0 + x1) / 2, stop + (stop < a.y ? -14 : 14), `Stop: ${r1(sD)}`, { bg: RED, fg: '#fff' })
  H.tag((x0 + x1) / 2, a.y, `${kind === 'long' ? 'Long' : 'Short'} · R:R ${sD ? r2(tD / sD) : '–'}`, { bg: '#2a2e39', fg: '#fff' })
}

const textShape = (fn) => (p, H) => fn(p, H, H.o.text || 'Text')

// ──────────────────────────────────────────────────────────────────────────
// Registry
// ──────────────────────────────────────────────────────────────────────────
// n      — points needed (0 = open-ended: click points, double-click / Enter to finish)
// fill   — new shapes start with the fill switched on
// text   — shape carries editable text (opened right after placing, or by double-click)
// textAt — where the text editor sits
// native — not a shape: maps onto an existing board tool ({tool, penKind})
export const TOOLS = {
  // ── Lines ───────────────────────────────────────────────────────────────
  trend: { name: 'Trend line', icon: TrendingUp, n: 2, lineLike: true, render: (p, H) => H.line(p[0], p[1]) },
  ray: { name: 'Ray', icon: MoveUpRight, n: 2, render: (p, H) => H.line(p[0], rayEnd(p[0], p[1])) },
  info: {
    name: 'Info line', icon: Info, n: 2, lineLike: true,
    render: (p, H) => {
      H.line(p[0], p[1])
      const d = sub(p[1], p[0])
      H.tag((p[0].x + p[1].x) / 2, (p[0].y + p[1].y) / 2 - 20, `Δx ${r1(d.x)}  Δy ${r1(-d.y)}\n${r1(len(d))} px · ${r1(angleDeg(p[0], p[1]))}°`)
    },
  },
  extline: {
    name: 'Extended line', icon: Slash, n: 2,
    render: (p, H) => {
      const u = unit(sub(p[1], p[0]))
      H.line(add(p[0], mul(u, -EXT)), add(p[0], mul(u, EXT)))
    },
  },
  trendangle: {
    name: 'Trend angle', icon: Radius, n: 2,
    render: (p, H) => {
      const [a, b] = p
      const l = dist(a, b)
      H.line(a, b)
      H.line(a, { x: a.x + Math.max(l, 60), y: a.y }, { ...dashed, ...faint })
      const th = Math.atan2(a.y - b.y, b.x - a.x)
      const r = Math.min(46, Math.max(14, l * 0.4))
      H.path(`M ${a.x + r} ${a.y} A ${r} ${r} 0 0 ${th >= 0 ? 0 : 1} ${a.x + r * Math.cos(th)} ${a.y - r * Math.sin(th)}`)
      H.text(a.x + r + 8, a.y - 6, `${Math.round((th * 180) / Math.PI)}°`)
    },
  },
  arrow: {
    name: 'Arrow', icon: ArrowUpRight, n: 2, lineLike: true,
    render: (p, H) => {
      H.line(p[0], p[1])
      H.arrowHead(p[0], p[1])
    },
  },
  hline: { name: 'Horizontal line', icon: Minus, n: 1, render: (p, H) => H.line({ x: p[0].x - EXT, y: p[0].y }, { x: p[0].x + EXT, y: p[0].y }) },
  hray: { name: 'Horizontal ray', icon: ArrowRight, n: 1, render: (p, H) => { H.line(p[0], { x: p[0].x + EXT, y: p[0].y }); H.dot(p[0], 3) } },
  vline: { name: 'Vertical line', icon: GripVertical, n: 1, render: (p, H) => H.line({ x: p[0].x, y: p[0].y - EXT }, { x: p[0].x, y: p[0].y + EXT }) },
  crossline: {
    name: 'Cross line', icon: Plus, n: 1,
    render: (p, H) => {
      H.line({ x: p[0].x - EXT, y: p[0].y }, { x: p[0].x + EXT, y: p[0].y })
      H.line({ x: p[0].x, y: p[0].y - EXT }, { x: p[0].x, y: p[0].y + EXT })
    },
  },
  // Channels
  channel: {
    name: 'Parallel channel', icon: Columns2, n: 3, fill: true,
    render: (p, H) => {
      const d = sub(p[1], p[0])
      const c2 = add(p[2], d)
      if (H.o.fill) H.poly([p[0], p[1], c2, p[2]], { ...H.fillP(), stroke: 'none' }, true)
      H.line(p[0], p[1])
      H.line(p[2], c2)
      H.line(mid(p[0], p[2]), mid(p[1], c2), { ...dashed, ...faint })
    },
  },
  regression: {
    name: 'Regression trend', icon: Activity, n: 2, fill: true,
    render: (p, H) => {
      const d = sub(p[1], p[0])
      const nrm = mul(unit({ x: -d.y, y: d.x }), len(d) * 0.18)
      const up = [add(p[0], nrm), add(p[1], nrm)]
      const dn = [sub(p[0], nrm), sub(p[1], nrm)]
      if (H.o.fill) H.poly([up[0], up[1], dn[1], dn[0]], { ...H.fillP(), stroke: 'none' }, true)
      H.line(up[0], up[1])
      H.line(dn[0], dn[1])
      H.line(p[0], p[1], dashed)
    },
  },
  flattb: {
    name: 'Flat top / bottom', icon: ChartNoAxesGantt, n: 3, fill: true,
    render: (p, H) => {
      const fl = { y: p[2].y }
      if (H.o.fill) H.poly([p[0], p[1], { x: p[1].x, y: fl.y }, { x: p[0].x, y: fl.y }], { ...H.fillP(), stroke: 'none' }, true)
      H.line(p[0], p[1])
      H.line({ x: p[0].x, y: fl.y }, { x: p[1].x, y: fl.y })
    },
  },
  disjoint: {
    name: 'Disjoint channel', icon: Columns2, n: 4, fill: true,
    render: (p, H) => {
      if (H.o.fill) H.poly([p[0], p[1], p[3], p[2]], { ...H.fillP(), stroke: 'none' }, true)
      H.line(p[0], p[1])
      H.line(p[2], p[3])
    },
  },
  // Pitchforks
  pitchfork: { name: 'Pitchfork', icon: GitBranch, n: 3, fill: true, render: (p, H) => pitchfork(p, H, p[0], false) },
  schiff: {
    name: 'Schiff pitchfork', icon: GitBranch, n: 3, fill: true,
    render: (p, H) => {
      H.line(p[0], { x: p[0].x, y: (p[0].y + p[1].y) / 2 }, { ...dashed, ...faint })
      pitchfork(p, H, { x: p[0].x, y: (p[0].y + p[1].y) / 2 }, false)
    },
  },
  modschiff: {
    name: 'Modified Schiff pitchfork', icon: GitBranch, n: 3, fill: true,
    render: (p, H) => {
      H.line(p[0], mid(p[0], p[1]), { ...dashed, ...faint })
      pitchfork(p, H, mid(p[0], p[1]), false)
    },
  },
  insidepitchfork: { name: 'Inside pitchfork', icon: GitBranch, n: 3, fill: true, render: (p, H) => pitchfork(p, H, p[0], true) },

  // ── Fibonacci & Gann ─────────────────────────────────────────────────────
  fib: {
    name: 'Fib retracement', icon: Waypoints, n: 2, fill: true,
    render: (p, H) => {
      const [a, b] = p
      const x0 = Math.min(a.x, b.x)
      const x1 = Math.max(Math.max(a.x, b.x), x0 + 80)
      horizontalLevels(H, x0, x1, FIB.map((l) => b.y + (a.y - b.y) * l), FIB)
      H.line(a, b, { ...dashed, ...faint })
    },
  },
  fibext: {
    name: 'Trend-based fib extension', icon: ChartNoAxesGantt, n: 3, fill: true,
    render: (p, H) => {
      const [a, b, c] = p
      const x0 = Math.min(a.x, b.x, c.x)
      const x1 = Math.max(Math.max(a.x, b.x, c.x), x0 + 160)
      horizontalLevels(H, x0, x1, FIB_EXT.map((l) => c.y + (b.y - a.y) * l), FIB_EXT)
      H.line(a, b, { ...dashed, ...faint })
      H.line(b, c, { ...dashed, ...faint })
    },
  },
  fibchannel: {
    name: 'Fib channel', icon: Columns2, n: 3,
    render: (p, H) => {
      const [a, b, c] = p
      const d = sub(b, a)
      const nrm = unit({ x: -d.y, y: d.x })
      const off = mul(nrm, (c.x - a.x) * nrm.x + (c.y - a.y) * nrm.y)
      const lv = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618, 2.618]
      lv.forEach((l, i) => {
        const o2 = mul(off, l)
        const col = LV_COLORS[i % LV_COLORS.length]
        H.line(add(a, o2), add(b, o2), { stroke: H.o.hit ? undefined : col })
        H.text(b.x + o2.x + 6, b.y + o2.y + 4, String(l), { fill: H.o.hit ? undefined : col })
      })
    },
  },
  fibtimezone: {
    name: 'Fib time zone', icon: Clock, n: 2,
    render: (p, H) => {
      const d = p[1].x - p[0].x || 40
      ;[0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89].forEach((n, i) => {
        const x = p[0].x + n * d
        H.line({ x, y: p[0].y - 1500 }, { x, y: p[0].y + 1500 }, { stroke: H.o.hit ? undefined : LV_COLORS[i % LV_COLORS.length] })
        H.text(x + 4, p[0].y - 6, String(n))
      })
    },
  },
  fibfan: {
    name: 'Fib speed resistance fan', icon: Fan, n: 2,
    render: (p, H) => {
      const [a, b] = p
      H.line({ x: b.x, y: a.y }, b, { ...dashed, ...faint })
      H.line(a, { x: b.x, y: a.y }, { ...dashed, ...faint })
      ;[0.25, 0.382, 0.5, 0.618, 0.75, 1].forEach((l, i) => {
        const t = { x: b.x, y: a.y + (b.y - a.y) * l }
        H.line(a, rayEnd(a, t, 1800), { stroke: H.o.hit ? undefined : LV_COLORS[(i + 1) % LV_COLORS.length] })
        H.text(t.x + 6, t.y + 4, String(l))
      })
    },
  },
  fibtimeext: {
    name: 'Trend-based fib time', icon: Clock, n: 3,
    render: (p, H) => {
      const [a, b, c] = p
      const d = b.x - a.x || 40
      ;[0, 0.382, 0.5, 0.618, 1, 1.382, 1.618, 2, 2.618].forEach((l, i) => {
        const x = c.x + l * d
        H.line({ x, y: c.y - 1500 }, { x, y: c.y + 1500 }, { stroke: H.o.hit ? undefined : LV_COLORS[i % LV_COLORS.length] })
        H.text(x + 4, c.y - 6, String(l))
      })
      H.line(a, b, { ...dashed, ...faint })
      H.line(b, c, { ...dashed, ...faint })
    },
  },
  fibcircles: {
    name: 'Fib circles', icon: Target, n: 2,
    render: (p, H) => {
      const r = dist(p[0], p[1])
      ;[0.236, 0.382, 0.5, 0.618, 0.786, 1].forEach((l, i) => {
        H.ellipse(p[0].x, p[0].y, r * l, r * l, { stroke: H.o.hit ? undefined : LV_COLORS[(i + 1) % LV_COLORS.length], ...(H.o.fill && i === 5 ? H.fillP() : {}) })
      })
      H.line(p[0], p[1], { ...dashed, ...faint })
    },
  },
  fibspiral: {
    name: 'Fib spiral', icon: Shell, n: 2,
    render: (p, H) => {
      const r = dist(p[0], p[1]) || 1
      const a0 = Math.atan2(p[1].y - p[0].y, p[1].x - p[0].x)
      const phi = 1.618034
      const bk = Math.log(phi) / (Math.PI / 2)
      const pts = []
      for (let t = 0; t <= 4 * Math.PI; t += 0.1) {
        const rr = r * Math.exp(-bk * t)
        pts.push({ x: p[0].x + rr * Math.cos(a0 + t), y: p[0].y + rr * Math.sin(a0 + t) })
      }
      H.poly(pts)
      H.line(p[0], p[1], { ...dashed, ...faint })
    },
  },
  fibarcs: {
    name: 'Fib speed resistance arcs', icon: Rainbow, n: 2,
    render: (p, H) => {
      const [a, b] = p
      const l = dist(a, b)
      const th = Math.atan2(a.y - b.y, a.x - b.x)
      ;[0.236, 0.382, 0.5, 0.618, 0.786, 1].forEach((f, i) => {
        H.path(arcPath(b, l * f, th - Math.PI / 2, th + Math.PI / 2), { stroke: H.o.hit ? undefined : LV_COLORS[(i + 1) % LV_COLORS.length] })
      })
      H.line(a, b, { ...dashed, ...faint })
    },
  },
  fibwedge: {
    name: 'Fib wedge', icon: Radar, n: 3,
    render: (p, H) => {
      const [a, b, c] = p
      const r = dist(a, b)
      const t1 = Math.atan2(b.y - a.y, b.x - a.x)
      const t2 = Math.atan2(c.y - a.y, c.x - a.x)
      H.line(a, rayEnd(a, b, r * 1.7))
      H.line(a, rayEnd(a, c, r * 1.7))
      ;[0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618].forEach((f, i) => {
        H.path(arcPath(a, r * f, t1, t2), { stroke: H.o.hit ? undefined : LV_COLORS[(i + 1) % LV_COLORS.length] })
      })
    },
  },
  pitchfan: {
    name: 'Pitchfan', icon: Fan, n: 3, fill: true,
    render: (p, H) => {
      const [a, b, c] = p
      const far = dist(a, mid(b, c)) * 2.5 + 300
      const ends = [0, 0.25, 0.382, 0.5, 0.618, 0.75, 1].map((l) => rayEnd(a, along(b, c, l), far))
      if (H.o.fill) H.poly([a, ends[0], ends[ends.length - 1]], { ...H.fillP(), stroke: 'none' }, true)
      ends.forEach((e, i) => H.line(a, e, { stroke: H.o.hit ? undefined : LV_COLORS[i % LV_COLORS.length] }))
      H.line(b, c, faint)
    },
  },
  gannbox: {
    name: 'Gann box', icon: Grid3x3, n: 2, fill: true,
    render: (p, H) => gridBox(H, p[0], p[1], [0.25, 0.382, 0.5, 0.618, 0.75], true),
  },
  gannsqfixed: {
    name: 'Gann square fixed', icon: Grid2x2, n: 2, fill: true,
    render: (p, H) => {
      const s = Math.max(Math.abs(p[1].x - p[0].x), Math.abs(p[1].y - p[0].y))
      const b = { x: p[0].x + Math.sign(p[1].x - p[0].x || 1) * s, y: p[0].y + Math.sign(p[1].y - p[0].y || 1) * s }
      gridBox(H, p[0], b, [1, 2, 3, 4, 5, 6, 7].map((k) => k / 8), true)
    },
  },
  gannsq: {
    name: 'Gann square', icon: Grid3x3, n: 2, fill: true,
    render: (p, H) => gridBox(H, p[0], p[1], [1, 2, 3, 4, 5, 6, 7].map((k) => k / 8), true),
  },
  gannfan: {
    name: 'Gann fan', icon: Fan, n: 2,
    render: (p, H) => {
      const [a, b] = p
      const dx = b.x - a.x || 40
      const dy = b.y - a.y || -40
      ;[[1 / 8, '1×8'], [1 / 4, '1×4'], [1 / 3, '1×3'], [1 / 2, '1×2'], [1, '1×1'], [2, '2×1'], [3, '3×1'], [4, '4×1'], [8, '8×1']].forEach(([k, lbl], i) => {
        const d = { x: dx, y: dy * k }
        H.line(a, add(a, mul(unit(d), 2200)), { stroke: H.o.hit ? undefined : LV_COLORS[i % LV_COLORS.length] })
        const lab = add(a, mul(unit(d), Math.min(len(d), 280)))
        H.text(lab.x + 4, lab.y - 4, lbl)
      })
    },
  },

  // ── Patterns ───────────────────────────────────────────────────────────────
  xabcd: {
    name: 'XABCD pattern', icon: Hash, n: 5, fill: true,
    render: (p, H) => {
      if (H.o.fill) {
        H.poly([p[0], p[1], p[2]], { ...H.fillP(), stroke: 'none' }, true)
        H.poly([p[2], p[3], p[4]], { ...H.fillP(), stroke: 'none' }, true)
      }
      labelled(['X', 'A', 'B', 'C', 'D'], (q) => {
        H.line(q[0], q[2], { ...dashed, ...faint })
        H.line(q[1], q[3], { ...dashed, ...faint })
        H.line(q[2], q[4], { ...dashed, ...faint })
        H.line(q[0], q[4], { ...dashed, ...faint })
      })(p, H)
    },
  },
  cypher: {
    name: 'Cypher pattern', icon: Hash, n: 5, fill: true,
    render: (p, H) => {
      if (H.o.fill) {
        H.poly([p[0], p[1], p[2]], { ...H.fillP(), stroke: 'none' }, true)
        H.poly([p[2], p[3], p[4]], { ...H.fillP(), stroke: 'none' }, true)
      }
      labelled(['X', 'A', 'B', 'C', 'D'], (q) => {
        H.line(q[0], q[2], { ...dashed, ...faint })
        H.line(q[2], q[4], { ...dashed, ...faint })
        H.line(q[0], q[3], { ...dashed, ...faint })
      })(p, H)
    },
  },
  headshoulders: {
    name: 'Head and shoulders', icon: Mountain, n: 7, fill: true,
    render: (p, H) => {
      if (H.o.fill) H.poly([p[2], p[3], p[4]], { ...H.fillP(), stroke: 'none' }, true)
      H.poly(p, undefined, false)
      const nl = unit(sub(p[4], p[2]))
      H.line(add(p[2], mul(nl, -60)), add(p[4], mul(nl, 60)), { ...dashed })
      H.vlabel(p, 1, 'Left Shoulder')
      H.vlabel(p, 3, 'Head')
      H.vlabel(p, 5, 'Right Shoulder')
    },
  },
  abcd: {
    name: 'ABCD pattern', icon: Hash, n: 4, fill: true,
    render: (p, H) => {
      if (H.o.fill) {
        H.poly([p[0], p[1], p[2]], { ...H.fillP(), stroke: 'none' }, true)
        H.poly([p[1], p[2], p[3]], { ...H.fillP(), stroke: 'none' }, true)
      }
      labelled(['A', 'B', 'C', 'D'], (q) => {
        H.line(q[0], q[2], { ...dashed, ...faint })
        H.line(q[1], q[3], { ...dashed, ...faint })
      })(p, H)
    },
  },
  trianglepattern: {
    name: 'Triangle pattern', icon: Triangle, n: 4, fill: true,
    render: (p, H) => {
      const ix = lineIntersect(p[0], p[2], p[1], p[3])
      const xr = Math.max(...p.map((q) => q.x))
      const tip = ix && ix.x > xr ? ix : null
      const e1 = tip || rayEnd(p[2], add(p[2], sub(p[2], p[0])), 80)
      const e2 = tip || rayEnd(p[3], add(p[3], sub(p[3], p[1])), 80)
      if (H.o.fill) H.poly([p[0], p[1], e2, e1].slice(0, 4), { ...H.fillP(), stroke: 'none' }, true)
      H.line(p[0], e1)
      H.line(p[1], e2)
      labelled(['A', 'B', 'C', 'D'])(p, H)
    },
  },
  threedrives: {
    name: 'Three drives pattern', icon: Waves, n: 7,
    render: labelled(['0', '1', '2', '3', '4', '5', '6'], (q, H) => {
      H.line(q[1], q[3], { ...dashed, ...faint })
      H.line(q[3], q[5], { ...dashed, ...faint })
      H.line(q[2], q[4], { ...dashed, ...faint })
      H.line(q[4], q[6], { ...dashed, ...faint })
    }),
  },
  elliottimpulse: { name: 'Elliott impulse wave (12345)', icon: Activity, n: 6, render: labelled(['(0)', '(1)', '(2)', '(3)', '(4)', '(5)']) },
  elliottcorrection: { name: 'Elliott correction wave (ABC)', icon: Activity, n: 4, render: labelled(['(0)', '(A)', '(B)', '(C)']) },
  elliotttriangle: { name: 'Elliott triangle wave (ABCDE)', icon: Activity, n: 6, render: labelled(['(0)', '(A)', '(B)', '(C)', '(D)', '(E)']) },
  elliottdouble: { name: 'Elliott double combo wave (WXY)', icon: Activity, n: 4, render: labelled(['(0)', '(W)', '(X)', '(Y)']) },
  elliotttriple: { name: 'Elliott triple combo wave (WXYXZ)', icon: Activity, n: 6, render: labelled(['(0)', '(W)', '(X)', '(Y)', '(X)', '(Z)']) },
  cyclic: {
    name: 'Cyclic lines', icon: Repeat, n: 2,
    render: (p, H) => {
      const d = Math.abs(p[1].x - p[0].x) < 8 ? 60 : p[1].x - p[0].x
      for (let i = 0; i < 25; i++) H.line({ x: p[0].x + i * d, y: p[0].y - 1500 }, { x: p[0].x + i * d, y: p[0].y + 1500 }, i ? faint : undefined)
    },
  },
  timecycles: {
    name: 'Time cycles', icon: InfinityIcon, n: 2, fill: true,
    render: (p, H) => {
      const d = Math.abs(p[1].x - p[0].x) < 8 ? 60 : p[1].x - p[0].x
      const h = Math.max(16, Math.abs(p[1].y - p[0].y))
      const up = p[1].y <= p[0].y
      for (let i = 0; i < 10; i++) {
        const x0 = p[0].x + i * d
        const x1 = x0 + d
        const dp = `M ${x0} ${p[0].y} A ${Math.abs(d) / 2} ${h} 0 0 ${(d > 0) === up ? 1 : 0} ${x1} ${p[0].y}`
        H.path(H.o.fill ? `${dp} Z` : dp, H.o.fill ? { ...H.fillP() } : undefined)
      }
    },
  },
  sine: {
    name: 'Sine line', icon: ChartSpline, n: 2,
    render: (p, H) => {
      const D = Math.abs(p[1].x - p[0].x) < 10 ? 40 : p[1].x - p[0].x
      const A = p[1].y - p[0].y
      const pts = []
      for (let i = 0; i <= 240; i++) {
        const t = (i / 240) * 6
        pts.push({ x: p[0].x + t * D, y: p[0].y + A * Math.sin((Math.PI / 2) * t) })
      }
      H.poly(pts)
      H.dot(p[0], 3)
      H.dot(p[1], 3)
    },
  },

  // ── Forecasting & measuring ─────────────────────────────────────────────
  long: { name: 'Long position', icon: TrendingUp, n: 2, render: position('long') },
  short: { name: 'Short position', icon: TrendingDown, n: 2, render: position('short') },
  forecast: {
    name: 'Forecast', icon: Sunrise, n: 2,
    render: (p, H) => {
      H.dot(p[0], 4)
      H.line(p[0], p[1], dashed)
      H.arrowHead(p[0], p[1])
      const d = sub(p[1], p[0])
      H.tag(p[1].x + 6, p[1].y - (d.y > 0 ? -18 : 18), `${r1(-d.y)} (${r1(Math.abs(d.x))} →)`, { anchor: 'start' })
    },
  },
  barspattern: {
    name: 'Bars pattern', icon: ChartCandlestick, n: 2,
    render: (p, H) => {
      const x0 = Math.min(p[0].x, p[1].x)
      const x1 = Math.max(p[0].x, p[1].x)
      const y0 = Math.min(p[0].y, p[1].y)
      const y1 = Math.max(p[0].y, p[1].y)
      H.rect(p[0], p[1], { ...dashed, ...faint })
      const n = Math.max(5, Math.floor((x1 - x0) / 14))
      const rnd = seeded(7)
      let prev = 0.5
      for (let i = 0; i < n; i++) {
        const o1 = prev
        const c1 = Math.min(0.95, Math.max(0.05, o1 + (rnd() - 0.5) * 0.4))
        prev = c1
        const hi = Math.min(1, Math.max(o1, c1) + rnd() * 0.12)
        const lo = Math.max(0, Math.min(o1, c1) - rnd() * 0.12)
        const cx = x0 + ((i + 0.5) / n) * (x1 - x0)
        const yy = (v) => y1 - v * (y1 - y0)
        const col = c1 >= o1 ? GREEN : RED
        H.line({ x: cx, y: yy(hi) }, { x: cx, y: yy(lo) }, { stroke: H.o.hit ? undefined : col, strokeWidth: 1.2 })
        H.rect({ x: cx - 3.5, y: yy(o1) }, { x: cx + 3.5, y: yy(c1) }, { stroke: H.o.hit ? undefined : col, ...(H.o.hit ? {} : { fill: col }), strokeWidth: 1 })
      }
    },
  },
  ghostfeed: {
    name: 'Ghost feed', icon: Ghost, n: 2,
    render: (p, H) => {
      const l = dist(p[0], p[1])
      H.line(p[0], p[1], { ...dashed, ...faint })
      const n = Math.max(4, Math.floor(l / 14))
      const rnd = seeded(11)
      const amp = 10 + l * 0.05
      for (let i = 0; i <= n; i++) {
        const t = i / n
        const c = along(p[0], p[1], t)
        const o1 = c.y + (rnd() - 0.5) * amp
        const c1 = c.y + (rnd() - 0.5) * amp
        const col = c1 <= o1 ? GREEN : RED
        H.line({ x: c.x, y: Math.min(o1, c1) - rnd() * 6 }, { x: c.x, y: Math.max(o1, c1) + rnd() * 6 }, { stroke: H.o.hit ? undefined : col, strokeWidth: 1.2, opacity: 0.7 })
        H.rect({ x: c.x - 3.5, y: o1 }, { x: c.x + 3.5, y: c1 }, { stroke: H.o.hit ? undefined : col, ...(H.o.hit ? {} : { fill: col }), strokeWidth: 1, opacity: 0.6 })
      }
    },
  },
  projection: {
    name: 'Projection', icon: Layers, n: 3, fill: true,
    render: (p, H) => {
      const d = sub(p[1], p[0])
      const e = add(p[2], d)
      if (H.o.fill) {
        H.rect(p[0], p[1], { ...H.fillP(), stroke: 'none' })
        H.rect(p[2], e, { ...H.fillP(), stroke: 'none' })
      }
      H.line(p[0], p[1])
      H.arrowHead(p[0], p[1])
      H.line(p[1], p[2], { ...dashed, ...faint })
      H.line(p[2], e, dashed)
      H.arrowHead(p[2], e)
    },
  },
  vwap: {
    name: 'Anchored VWAP', icon: ChartLine, n: 1, fill: true,
    render: (p, H) => {
      const pts = []
      for (let t = 0; t <= 360; t += 6) pts.push({ x: p[0].x + t, y: p[0].y + 14 * Math.sin(t / 38) + t * 0.05 - 8 * Math.cos(t / 90) })
      const up = pts.map((q) => ({ x: q.x, y: q.y - 26 }))
      const dn = pts.map((q) => ({ x: q.x, y: q.y + 26 }))
      if (H.o.fill) H.poly([...up, ...dn.slice().reverse()], { ...H.fillP(), stroke: 'none' }, true)
      H.poly(up, { ...dashed, ...faint })
      H.poly(dn, { ...dashed, ...faint })
      H.poly(pts)
      H.dot(p[0], 4)
      H.tag(p[0].x, p[0].y - 24, 'VWAP')
    },
  },
  volumeprofile: {
    name: 'Fixed range volume profile', icon: ChartBar, n: 2, fill: true,
    render: (p, H) => {
      const x0 = Math.min(p[0].x, p[1].x)
      const w = Math.abs(p[1].x - p[0].x)
      const y0 = Math.min(p[0].y, p[1].y)
      const h = Math.abs(p[1].y - p[0].y)
      H.rect(p[0], p[1], { ...dashed, ...faint })
      const rows = Math.max(6, Math.min(40, Math.floor(h / 9)))
      const rnd = seeded(5)
      const midRow = rows * (0.35 + rnd() * 0.3)
      let best = 0
      let bestW = 0
      const ws = []
      for (let i = 0; i < rows; i++) {
        const bell = Math.exp(-(((i - midRow) / (rows / 3.2)) ** 2))
        const v = (0.18 + bell * 0.82) * (0.75 + rnd() * 0.25)
        ws.push(v)
        if (v > bestW) { bestW = v; best = i }
      }
      const rh = h / rows
      ws.forEach((v, i) => {
        const bw = v * w * 0.85
        const y = y0 + i * rh
        H.rect({ x: x0, y: y + 1 }, { x: x0 + bw, y: y + rh - 1 }, { stroke: 'none', ...H.fillP(i === best ? '#f59e0b' : undefined), fillOpacity: i === best ? 0.85 : 0.4 })
      })
      H.line({ x: x0, y: y0 + (best + 0.5) * rh }, { x: x0 + w, y: y0 + (best + 0.5) * rh }, { stroke: H.o.hit ? undefined : '#f59e0b', ...dashed })
    },
  },
  pricerange: {
    name: 'Price range', icon: MoveVertical, n: 2, fill: true,
    render: (p, H) => {
      const x0 = Math.min(p[0].x, p[1].x)
      const x1 = Math.max(Math.max(p[0].x, p[1].x), x0 + 60)
      const cx = (x0 + x1) / 2
      if (H.o.fill) H.rect({ x: x0, y: p[0].y }, { x: x1, y: p[1].y }, { ...H.fillP(), stroke: 'none' })
      H.line({ x: x0, y: p[0].y }, { x: x1, y: p[0].y }, faint)
      H.line({ x: x0, y: p[1].y }, { x: x1, y: p[1].y }, faint)
      H.line({ x: cx, y: p[0].y }, { x: cx, y: p[1].y })
      H.arrowHead({ x: cx, y: p[0].y }, { x: cx, y: p[1].y })
      H.tag(cx, p[1].y + (p[1].y > p[0].y ? 16 : -16), `${r1(Math.abs(p[1].y - p[0].y))} px`)
    },
  },
  daterange: {
    name: 'Date range', icon: MoveHorizontal, n: 2, fill: true,
    render: (p, H) => {
      const y0 = Math.min(p[0].y, p[1].y)
      const y1 = Math.max(Math.max(p[0].y, p[1].y), y0 + 50)
      const cy = (y0 + y1) / 2
      if (H.o.fill) H.rect({ x: p[0].x, y: y0 }, { x: p[1].x, y: y1 }, { ...H.fillP(), stroke: 'none' })
      H.line({ x: p[0].x, y: y0 }, { x: p[0].x, y: y1 }, faint)
      H.line({ x: p[1].x, y: y0 }, { x: p[1].x, y: y1 }, faint)
      H.line({ x: p[0].x, y: cy }, { x: p[1].x, y: cy })
      H.arrowHead({ x: p[0].x, y: cy }, { x: p[1].x, y: cy })
      H.tag((p[0].x + p[1].x) / 2, y0 - 14, `${r1(Math.abs(p[1].x - p[0].x))} px`)
    },
  },
  datepricerange: {
    name: 'Date and price range', icon: Scan, n: 2, fill: true,
    render: (p, H) => {
      const cx = (p[0].x + p[1].x) / 2
      const cy = (p[0].y + p[1].y) / 2
      if (H.o.fill) H.rect(p[0], p[1], { ...H.fillP(), stroke: 'none' })
      H.rect(p[0], p[1], faint)
      H.line({ x: p[0].x, y: cy }, { x: p[1].x, y: cy })
      H.arrowHead({ x: p[0].x, y: cy }, { x: p[1].x, y: cy })
      H.line({ x: cx, y: p[0].y }, { x: cx, y: p[1].y })
      H.arrowHead({ x: cx, y: p[0].y }, { x: cx, y: p[1].y })
      H.tag(cx, Math.min(p[0].y, p[1].y) - 18, `Δx ${r1(Math.abs(p[1].x - p[0].x))} · Δy ${r1(Math.abs(p[1].y - p[0].y))}`)
    },
  },

  // ── Brushes ────────────────────────────────────────────────────────────────
  brush: { name: 'Brush', icon: Pencil, native: { tool: 'pen', penKind: 'brush' } },
  highlighter: { name: 'Highlighter', icon: Highlighter, native: { tool: 'pen', penKind: 'highlighter' } },

  // ── Shapes ─────────────────────────────────────────────────────────────────
  rect: { name: 'Rectangle', icon: Square, n: 2, fill: true, render: (p, H) => H.rect(p[0], p[1], H.o.fill ? H.fillP() : undefined) },
  rotrect: {
    name: 'Rotated rectangle', icon: Rotate3d, n: 3, fill: true,
    render: (p, H) => {
      const d = sub(p[1], p[0])
      const nrm = unit({ x: -d.y, y: d.x })
      const t = (p[2].x - p[0].x) * nrm.x + (p[2].y - p[0].y) * nrm.y
      const o2 = mul(nrm, t)
      H.poly([p[0], p[1], add(p[1], o2), add(p[0], o2)], H.o.fill ? H.fillP() : undefined, true)
    },
  },
  path: {
    name: 'Path', icon: Milestone, n: 0,
    render: (p, H) => {
      H.poly(p, undefined, false)
      if (p.length > 1) H.arrowHead(p[p.length - 2], p[p.length - 1])
    },
  },
  circle: {
    name: 'Circle', icon: Circle, n: 2, fill: true,
    render: (p, H) => {
      const r = dist(p[0], p[1])
      H.ellipse(p[0].x, p[0].y, r, r, H.o.fill ? H.fillP() : undefined)
    },
  },
  ellipse: {
    name: 'Ellipse', icon: Orbit, n: 2, fill: true,
    render: (p, H) => H.ellipse((p[0].x + p[1].x) / 2, (p[0].y + p[1].y) / 2, Math.abs(p[1].x - p[0].x) / 2, Math.abs(p[1].y - p[0].y) / 2, H.o.fill ? H.fillP() : undefined),
  },
  polyline: {
    name: 'Polyline', icon: Pentagon, n: 0, fill: true,
    render: (p, H) => H.poly(p, H.o.fill ? H.fillP() : undefined, H.o.fill),
  },
  triangle: { name: 'Triangle', icon: Triangle, n: 3, fill: true, render: (p, H) => H.poly(p, H.o.fill ? H.fillP() : undefined, true) },
  arc: {
    name: 'Arc', icon: Hexagon, n: 3, fill: true,
    render: (p, H) => {
      const c = { x: 2 * p[2].x - (p[0].x + p[1].x) / 2, y: 2 * p[2].y - (p[0].y + p[1].y) / 2 }
      const d = `M ${p[0].x} ${p[0].y} Q ${c.x} ${c.y} ${p[1].x} ${p[1].y}`
      H.path(H.o.fill ? `${d} Z` : d, H.o.fill ? H.fillP() : undefined)
    },
  },
  curve: {
    name: 'Curve', icon: Spline, n: 2, lineLike: true,
    render: (p, H) => {
      const m = mid(p[0], p[1])
      const d = sub(p[1], p[0])
      const c = add(m, mul(unit({ x: -d.y, y: d.x }), len(d) * 0.25))
      H.path(`M ${p[0].x} ${p[0].y} Q ${c.x} ${c.y} ${p[1].x} ${p[1].y}`)
    },
  },
  doublecurve: {
    name: 'Double curve', icon: ChartSpline, n: 2, lineLike: true,
    render: (p, H) => {
      const mx = (p[0].x + p[1].x) / 2
      H.path(`M ${p[0].x} ${p[0].y} C ${mx} ${p[0].y} ${mx} ${p[1].y} ${p[1].x} ${p[1].y}`)
    },
  },

  // ── Text & notes ───────────────────────────────────────────────────────────
  text: { name: 'Text', icon: Type, native: { tool: 'text' } },
  note: { name: 'Note (sticky)', icon: StickyNote, native: { tool: 'sticky' } },
  arrowup: {
    name: 'Arrow mark up', icon: ArrowBigUp, n: 1, fill: true,
    render: (p, H) => H.poly([p[0], { x: p[0].x - 14, y: p[0].y + 16 }, { x: p[0].x - 6, y: p[0].y + 16 }, { x: p[0].x - 6, y: p[0].y + 38 }, { x: p[0].x + 6, y: p[0].y + 38 }, { x: p[0].x + 6, y: p[0].y + 16 }, { x: p[0].x + 14, y: p[0].y + 16 }], { ...H.fillP(), fillOpacity: 0.9 }, true),
  },
  arrowdown: {
    name: 'Arrow mark down', icon: ArrowBigDown, n: 1, fill: true,
    render: (p, H) => H.poly([p[0], { x: p[0].x - 14, y: p[0].y - 16 }, { x: p[0].x - 6, y: p[0].y - 16 }, { x: p[0].x - 6, y: p[0].y - 38 }, { x: p[0].x + 6, y: p[0].y - 38 }, { x: p[0].x + 6, y: p[0].y - 16 }, { x: p[0].x + 14, y: p[0].y - 16 }], { ...H.fillP(), fillOpacity: 0.9 }, true),
  },
  anchoredtext: {
    name: 'Anchored text', icon: Type, n: 1, text: true,
    render: textShape((p, H, s) => {
      H.dot(p[0], 4)
      H.tag(p[0].x + 10, p[0].y - 14, s, { anchor: 'start' })
    }),
  },
  pricenote: {
    name: 'Price note', icon: Tag, n: 2, text: true, textAt: (p) => p[1],
    render: textShape((p, H, s) => {
      H.dot(p[0], 3)
      H.line(p[0], p[1], dashed)
      H.tag(p[1].x, p[1].y, s, { anchor: 'start' })
    }),
  },
  pin: {
    name: 'Pin', icon: MapPin, n: 1, text: true,
    render: textShape((p, H, s) => {
      const t = p[0]
      H.path(`M ${t.x} ${t.y} C ${t.x - 16} ${t.y - 18} ${t.x - 13} ${t.y - 36} ${t.x} ${t.y - 36} C ${t.x + 13} ${t.y - 36} ${t.x + 16} ${t.y - 18} ${t.x} ${t.y} Z`, { ...H.fillP(), fillOpacity: 0.95 })
      H.dot({ x: t.x, y: t.y - 24 }, 4, H.o.hit ? undefined : { fill: '#fff' })
      H.tag(t.x + 18, t.y - 30, s, { anchor: 'start' })
    }),
  },
  table: {
    name: 'Table', icon: Table, n: 2, fill: true,
    render: (p, H) => {
      const x0 = Math.min(p[0].x, p[1].x)
      const x1 = Math.max(p[0].x, p[1].x)
      const y0 = Math.min(p[0].y, p[1].y)
      const y1 = Math.max(p[0].y, p[1].y)
      if (H.o.fill) H.rect({ x: x0, y: y0 }, { x: x1, y: y0 + (y1 - y0) / 4 }, { ...H.fillP(), stroke: 'none', fillOpacity: 0.3 })
      H.rect(p[0], p[1])
      for (let i = 1; i < 4; i++) H.line({ x: x0, y: y0 + ((y1 - y0) * i) / 4 }, { x: x1, y: y0 + ((y1 - y0) * i) / 4 }, faint)
      for (let i = 1; i < 3; i++) H.line({ x: x0 + ((x1 - x0) * i) / 3, y: y0 }, { x: x0 + ((x1 - x0) * i) / 3, y: y1 }, faint)
    },
  },
  callout: {
    name: 'Callout', icon: MessageSquare, n: 2, text: true, textAt: (p) => p[1],
    render: textShape((p, H, s) => {
      H.dot(p[0], 3)
      H.line(p[0], p[1])
      H.tag(p[1].x, p[1].y, s)
    }),
  },
  comment: {
    name: 'Comment', icon: MessageCircle, n: 1, text: true,
    render: textShape((p, H, s) => {
      const b = H.tag(p[0].x, p[0].y - 26, s, { anchor: 'start' })
      H.poly([{ x: b.x0 + 8, y: b.y0 + b.h - 1 }, { x: b.x0 + 24, y: b.y0 + b.h - 1 }, p[0]], { ...H.fillP(), fillOpacity: 1 }, true)
    }),
  },
  pricelabel: {
    name: 'Price label', icon: Tag, n: 1, text: true,
    render: textShape((p, H, s) => {
      H.poly([p[0], { x: p[0].x + 9, y: p[0].y - 12 }, { x: p[0].x + 9 + s.length * H.fs * 0.58 + 16, y: p[0].y - 12 }, { x: p[0].x + 9 + s.length * H.fs * 0.58 + 16, y: p[0].y + 12 }, { x: p[0].x + 9, y: p[0].y + 12 }], { ...H.fillP(), fillOpacity: 1 }, true)
      H.text(p[0].x + 16, p[0].y + H.fs / 2 - 2, s, H.o.hit ? undefined : { fill: ink(H.o.c) })
    }),
  },
  signpost: {
    name: 'Signpost', icon: Milestone, n: 1, text: true, textAt: (p) => ({ x: p[0].x, y: p[0].y - 78 }),
    render: textShape((p, H, s) => {
      H.line(p[0], { x: p[0].x, y: p[0].y - 70 })
      H.dot(p[0], 3)
      H.tag(p[0].x, p[0].y - 82, s)
    }),
  },
  flagnote: {
    name: 'Flag note', icon: Flag, n: 1, text: true,
    render: textShape((p, H, s) => {
      H.line(p[0], { x: p[0].x, y: p[0].y - 46 })
      H.dot(p[0], 3)
      H.tag(p[0].x, p[0].y - 46, s, { anchor: 'start', top: true })
    }),
  },

  // ── Icons / emoji / stickers (one glyph, placed with a click) ───────────────
  emoji: {
    name: 'Emoji / icon', icon: Rainbow, n: 1, glyph: true,
    render: (p, H) =>
      H.text(p[0].x, p[0].y, H.o.emoji || '😀', { fontSize: H.o.fs || 36, textAnchor: 'middle', dominantBaseline: 'central', fontWeight: 400 }),
  },
}

// ── Single candles (20: 10 bullish, 10 bearish). One click drops ONE candle — no label, no extras. ────────
// Prices are 0–100 units centred on 50; candle = [open, high, low, close].
const CANDLE_PATTERNS = [
  // bullish (close above open → green)
  { id: 'c_bull_full', name: 'Bullish candle', bull: true, k: [22, 80, 18, 78] },
  { id: 'c_bull_maru', name: 'Bullish marubozu', bull: true, k: [20, 80, 20, 80] },
  { id: 'c_bull_hammer', name: 'Hammer', bull: true, k: [62, 68, 14, 66] },
  { id: 'c_bull_invhammer', name: 'Inverted hammer', bull: true, k: [28, 86, 26, 36] },
  { id: 'c_bull_dragonfly', name: 'Dragonfly doji', bull: true, k: [66, 67, 14, 66.8] },
  { id: 'c_bull_longdoji', name: 'Long-legged doji', bull: true, k: [50, 86, 14, 50.8] },
  { id: 'c_bull_spinning', name: 'Spinning top', bull: true, k: [44, 72, 28, 56] },
  { id: 'c_bull_pin', name: 'Bullish pin bar', bull: true, k: [58, 66, 10, 64] },
  { id: 'c_bull_open', name: 'Opening marubozu', bull: true, k: [20, 84, 20, 76] },
  { id: 'c_bull_close', name: 'Closing marubozu', bull: true, k: [24, 80, 14, 80] },
  // bearish (close below open → red)
  { id: 'c_bear_full', name: 'Bearish candle', bull: false, k: [78, 82, 20, 22] },
  { id: 'c_bear_maru', name: 'Bearish marubozu', bull: false, k: [80, 80, 20, 20] },
  { id: 'c_bear_star', name: 'Shooting star', bull: false, k: [38, 86, 34, 32] },
  { id: 'c_bear_hanging', name: 'Hanging man', bull: false, k: [68, 70, 16, 62] },
  { id: 'c_bear_gravestone', name: 'Gravestone doji', bull: false, k: [34, 86, 33, 33.4] },
  { id: 'c_bear_longdoji', name: 'Long-legged doji', bull: false, k: [50, 86, 14, 49.2] },
  { id: 'c_bear_spinning', name: 'Spinning top', bull: false, k: [56, 72, 28, 44] },
  { id: 'c_bear_pin', name: 'Bearish pin bar', bull: false, k: [42, 92, 36, 36] },
  { id: 'c_bear_open', name: 'Opening marubozu', bull: false, k: [80, 80, 16, 24] },
  { id: 'c_bear_close', name: 'Closing marubozu', bull: false, k: [76, 86, 20, 20] },
]
const CANDLE_W = 11
const CANDLE_K = 1.05 // px per price unit (small, chart-sized candles)

// Toolbar/flyout icon: a tiny drawing of the actual candle shape.
function candleIcon(c) {
  const [o, hi, lo, cl] = c.k
  const col = cl >= o ? GREEN : RED
  return function CandleGlyph({ size = 14 }) {
    const sy = (v) => 23 - (v - 6) * (22 / 88) // price 6..94 -> y 22..2
    const top = Math.min(sy(o), sy(cl))
    const bh = Math.max(Math.abs(sy(o) - sy(cl)), 1.6)
    return (
      <svg width={size * 1.3} height={size * 1.3} viewBox="0 0 24 24" aria-hidden="true">
        <line x1="12" y1={sy(hi)} x2="12" y2={sy(lo)} stroke={col} strokeWidth="1.8" strokeLinecap="round" />
        <rect x="6.5" y={top} width="11" height={bh} rx="1" fill={col} stroke={col} strokeWidth="0.6" />
      </svg>
    )
  }
}

function candleTool(c) {
  return {
    name: c.name, icon: candleIcon(c), n: 1, candle: true,
    render: (p, H) => {
      const [o, hi, lo, cl] = c.k
      const col = cl >= o ? GREEN : RED
      const y = (price) => p[0].y + (50 - price) * CANDLE_K
      const x = p[0].x
      H.line({ x, y: y(hi) }, { x, y: y(lo) }, { stroke: H.o.hit ? undefined : col, strokeWidth: 1.6 })
      const top = Math.min(y(o), y(cl))
      const bot = Math.max(y(o), y(cl)) < top + 2 ? top + 2 : Math.max(y(o), y(cl))
      H.rect({ x: x - CANDLE_W / 2, y: top }, { x: x + CANDLE_W / 2, y: bot }, { stroke: H.o.hit ? undefined : col, ...(H.o.hit ? {} : { fill: col }), strokeWidth: 1, rx: 1.5 })
    },
  }
}
Object.assign(TOOLS, Object.fromEntries(CANDLE_PATTERNS.map((c) => [c.id, candleTool(c)])))

// ── Toolbar groups (what the flyouts list) ──────────────────────────────────
export const GROUPS = [
  {
    id: 'lines', name: 'Trend line tools', icon: TrendingUp,
    sections: [
      { title: 'Lines', tools: ['trend', 'ray', 'info', 'extline', 'trendangle', 'hline', 'hray', 'vline', 'crossline', 'arrow'] },
      { title: 'Channels', tools: ['channel', 'regression', 'flattb', 'disjoint'] },
      { title: 'Pitchforks', tools: ['pitchfork', 'schiff', 'modschiff', 'insidepitchfork'] },
    ],
  },
  {
    id: 'fib', name: 'Gann and Fibonacci tools', icon: Waypoints,
    sections: [
      { title: 'Fibonacci', tools: ['fib', 'fibext', 'fibchannel', 'fibtimezone', 'fibfan', 'fibtimeext', 'fibcircles', 'fibspiral', 'fibarcs', 'fibwedge', 'pitchfan'] },
      { title: 'Gann', tools: ['gannbox', 'gannsqfixed', 'gannsq', 'gannfan'] },
    ],
  },
  {
    id: 'patterns', name: 'Patterns', icon: Hash,
    sections: [
      { title: 'Chart patterns', tools: ['xabcd', 'cypher', 'headshoulders', 'abcd', 'trianglepattern', 'threedrives'] },
      { title: 'Elliott waves', tools: ['elliottimpulse', 'elliottcorrection', 'elliotttriangle', 'elliottdouble', 'elliotttriple'] },
      { title: 'Cycles', tools: ['cyclic', 'timecycles', 'sine'] },
    ],
  },
  {
    id: 'forecast', name: 'Forecasting and measurement tools', icon: Sunrise,
    sections: [
      { title: 'Forecasting', tools: ['long', 'short', 'forecast', 'barspattern', 'ghostfeed', 'projection'] },
      { title: 'Volume-based', tools: ['vwap', 'volumeprofile'] },
      { title: 'Measurer', tools: ['pricerange', 'daterange', 'datepricerange'] },
    ],
  },
  {
    id: 'shapes', name: 'Brushes and shapes', icon: Pencil,
    sections: [
      { title: 'Brushes', tools: ['brush', 'highlighter'] },
      { title: 'Shapes', tools: ['rect', 'rotrect', 'path', 'circle', 'ellipse', 'polyline', 'triangle', 'arc', 'curve', 'doublecurve'] },
    ],
  },
  {
    id: 'candles', name: 'Candles', icon: ChartCandlestick,
    sections: [
      { title: 'Bullish candles', tools: CANDLE_PATTERNS.filter((c) => c.bull).map((c) => c.id) },
      { title: 'Bearish (sell) candles', tools: CANDLE_PATTERNS.filter((c) => !c.bull).map((c) => c.id) },
    ],
  },
  {
    id: 'text', name: 'Text and notes', icon: Type,
    sections: [{ title: 'Text & notes', tools: ['text', 'note', 'arrowup', 'arrowdown', 'anchoredtext', 'pricenote', 'pin', 'table', 'callout', 'comment', 'pricelabel', 'signpost', 'flagnote'] }],
  },
]

export const DEFAULT_IN_GROUP = { lines: 'trend', fib: 'fib', patterns: 'xabcd', forecast: 'long', shapes: 'brush', candles: 'c_bull_full', text: 'text' }

// Emoji / sticker / icon palettes for the "Icons" panel.
export const GLYPHS = {
  Emojis: ['😀', '😂', '😍', '😎', '🤔', '😢', '😡', '😱', '👍', '👎', '👏', '🙏', '💪', '👀', '🧠', '❤️', '💔', '🔥', '⭐', '🌟', '✨', '⚡', '💡', '🎯', '✅', '❌', '⚠️', '❓', '❗', '💯', '🚀', '🎉', '💰', '💎', '📈', '📉', '🐂', '🐻', '🏆', '🔔', '🔒', '🔑', '🧲', '⏰', '📌', '📍', '🚩', '🏁'],
  Stickers: ['🟢', '🔴', '🟡', '🔵', '🟣', '🟠', '⚫', '⚪', '🟩', '🟥', '🟨', '🟦', '🔺', '🔻', '🔶', '🔷', '⬆️', '⬇️', '⬅️', '➡️', '↗️', '↘️', '↙️', '↖️', '🔄', '♻️', '💬', '💭', '🗯️', '📝', '📎', '📊', '🧾', '🗂️', '🔍', '🛑', '🚫', '⛔', '🆗', '🆕', '🔝', '🔜', '🏷️', '🎈', '🎁', '☀️', '🌙', '☁️'],
  Icons: ['★', '☆', '✔', '✖', '✚', '➜', '➤', '▲', '▼', '◀', '▶', '●', '○', '◆', '◇', '■', '□', '♠', '♣', '♥', '♦', '☑', '☒', '⚑', '⚐', '⌖', '⊕', '⊗', '∞', '≈', '≠', 'Δ', 'Σ', 'π', 'Ω', '€', '$', '£', '¥', '₹', '₿', '%', '#', '@', '&', '※', '☎', '✉'],
}

// Alt+key shortcuts (TradingView-style).
export const DRAW_SHORTCUTS = { KeyT: 'trend', KeyH: 'hline', KeyV: 'vline', KeyC: 'crossline', KeyF: 'fib', KeyP: 'pitchfork', KeyR: 'rect', KeyA: 'arrow' }

// Arrow heads / extensions chosen in the edit toolbar (line-like tools only).
export function lineExtras(el, pts, H) {
  if (pts.length < 2) return
  const a = pts[0]
  const b = pts[pts.length === 2 ? 1 : pts.length - 1]
  if (el.arrowEnd) H.arrowHead(pts[pts.length - 2], b)
  if (el.arrowStart) H.arrowHead(pts[1], a)
  const u = unit(sub(b, a))
  if (el.extendR) H.line(b, add(b, mul(u, EXT)), { opacity: 0.9 })
  if (el.extendL) H.line(a, add(a, mul(u, -EXT)), { opacity: 0.9 })
}

export function toolSpec(id) {
  return TOOLS[id]
}

// Geometry helpers shared with the board.
export function shapeBounds(el) {
  const pts = el.points || []
  if (!pts.length) return { x: el.x || 0, y: el.y || 0, width: 0, height: 0 }
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  let x = Math.min(...xs)
  let y = Math.min(...ys)
  let w = Math.max(...xs) - x
  let h = Math.max(...ys) - y
  if (el.tool === 'emoji') {
    const s = el.fontSize || 36
    x -= s / 2; y -= s / 2; w += s; h += s
  } else if (TOOLS[el.tool]?.candle) {
    x -= 12; y -= 58; w += 24; h += 116
  } else if (pts.length === 1) {
    x -= 14; y -= 40; w += 140; h += 50
  }
  return { x, y, width: w, height: h }
}
