import { animate, motion, useInView, useMotionValue, useTransform } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Flame, CalendarDays, Clock, Compass, Sparkles, Activity, Shield, TrendingUp, Timer, Layers } from 'lucide-react'
import { outcomeOf, parseDate, dayKey, sortChrono, scorePct } from '../../utils/tradeAnalyticsPro'
import { POS, NEG } from '../trade-analysis/analysis/pro/format'

// Status-based ("did it hit target or SL") insight widgets for the shared
// Analysis tab. Deliberately NOT P&L-based: many journals only log the
// outcome, and those visitors saw a page of empty "needs P&L" cards. Every
// widget here animates in when it scrolls into view.

const AMBER = '#d97706'
const EASE = [0.16, 1, 0.3, 1]

/** Number that counts up from 0 when it enters the viewport. */
export function CountUp({ value, decimals = 0, suffix = '', className, style }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-20px' })
  const mv = useMotionValue(0)
  const text = useTransform(mv, (v) => `${v.toFixed(decimals)}${suffix}`)
  useEffect(() => {
    if (!inView || value == null) return
    const c = animate(mv, value, { duration: 0.9, ease: EASE })
    return () => c.stop()
  }, [inView, value, mv])
  return (
    <motion.span ref={ref} className={className} style={style}>
      {value == null ? '—' : text}
    </motion.span>
  )
}

function Card({ title, icon: Icon, span = 1, delay = 0, accent, children }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-30px' })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 18, scale: 0.97 }}
      animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
      whileHover={{ y: -3 }}
      transition={{ delay, duration: 0.45, ease: EASE }}
      className={`ta-pro-card relative flex flex-col gap-2 overflow-hidden ${span === 2 ? 'sm:col-span-2' : ''} ${span === 3 ? 'sm:col-span-2 xl:col-span-3' : ''}`}
    >
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full"
        style={{ background: `radial-gradient(circle, ${accent || 'var(--ta-accent)'} 0%, transparent 70%)`, opacity: 0.13 }}
        animate={{ scale: [1, 1.18, 1] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div className="relative flex items-center gap-1.5">
        {Icon && <Icon size={12} style={{ color: accent || 'var(--ta-accent)' }} />}
        <span className="font-bold uppercase tracking-wide" style={{ fontSize: 'var(--tad-label)', color: 'var(--ta-ink)' }}>
          {title}
        </span>
      </div>
      <div className="relative">{children}</div>
    </motion.div>
  )
}

const Empty = ({ children }) => (
  <div className="flex items-center justify-center py-6 text-center italic" style={{ fontSize: 'var(--tad-micro)', color: 'var(--ta-slate)' }}>
    {children}
  </div>
)

const pctOf = (w, l) => (w + l ? Math.round((w / (w + l)) * 100) : null)

/** Group trades by a key and tally win / loss / open. */
function tally(trades, keysOf) {
  const map = new Map()
  trades.forEach((t) => {
    const o = outcomeOf(t)
    keysOf(t).forEach((k) => {
      if (!k) return
      if (!map.has(k)) map.set(k, { key: k, win: 0, loss: 0, open: 0 })
      const r = map.get(k)
      if (o === 'win') r.win += 1
      else if (o === 'loss') r.loss += 1
      else r.open += 1
    })
  })
  return [...map.values()]
}

/** Horizontal stacked win/loss bars that grow in one after another. */
function OutcomeBars({ rows, max = 7 }) {
  const list = rows
    .map((r) => ({ ...r, n: r.win + r.loss + r.open }))
    .sort((a, b) => b.n - a.n)
    .slice(0, max)
  if (!list.length) return <Empty>Nothing to show yet.</Empty>
  const top = Math.max(...list.map((r) => r.n), 1)
  return (
    <div className="flex flex-col gap-1.5">
      {list.map((r, i) => {
        const wr = pctOf(r.win, r.loss)
        return (
          <motion.div key={r.key} whileHover={{ x: 3 }} className="flex items-center gap-2">
            <span className="w-[68px] shrink-0 truncate font-semibold" title={r.label || r.key} style={{ fontSize: 'var(--tad-body)', color: 'var(--ta-ink)' }}>
              {r.label || r.key}
            </span>
            <div className="relative h-2.5 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: 'color-mix(in srgb, var(--ta-slate) 18%, transparent)' }}>
              <motion.div
                className="flex h-full origin-left overflow-hidden rounded-full"
                style={{ width: `${(r.n / top) * 100}%` }}
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 + i * 0.07, duration: 0.7, ease: EASE }}
              >
                {r.win > 0 && <span style={{ width: `${(r.win / r.n) * 100}%`, backgroundColor: POS }} />}
                {r.loss > 0 && <span style={{ width: `${(r.loss / r.n) * 100}%`, backgroundColor: NEG }} />}
                {r.open > 0 && <span style={{ width: `${(r.open / r.n) * 100}%`, backgroundColor: AMBER }} />}
              </motion.div>
            </div>
            <span className="ta-num w-[58px] shrink-0 text-right font-bold" style={{ fontSize: 'var(--tad-micro)', color: wr == null ? 'var(--ta-slate)' : wr >= 50 ? POS : NEG }}>
              {r.win}W·{r.loss}L {wr == null ? '' : `${wr}%`}
            </span>
          </motion.div>
        )
      })}
    </div>
  )
}

function Legend() {
  return (
    <div className="flex items-center gap-3" style={{ fontSize: 'var(--tad-micro)', color: 'var(--ta-slate)' }}>
      {[['Win', POS], ['Loss', NEG], ['Open', AMBER]].map(([l, c]) => (
        <span key={l} className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c }} />
          {l}
        </span>
      ))}
    </div>
  )
}

/** Win-rate ring + streak chips. */
function PulseCard({ chrono, delay }) {
  const res = chrono.map(outcomeOf).filter((o) => o === 'win' || o === 'loss')
  const wins = res.filter((o) => o === 'win').length
  const losses = res.length - wins
  const wr = pctOf(wins, losses)
  let cur = 0
  let curType = null
  for (let i = res.length - 1; i >= 0; i--) {
    if (curType == null) curType = res[i]
    if (res[i] === curType) cur += 1
    else break
  }
  let bestW = 0
  let worstL = 0
  let run = 0
  let prev = null
  res.forEach((o) => {
    run = o === prev ? run + 1 : 1
    prev = o
    if (o === 'win') bestW = Math.max(bestW, run)
    else worstL = Math.max(worstL, run)
  })
  const R = 34
  const C = 2 * Math.PI * R
  const chips = [
    { label: 'Current streak', value: cur ? `${cur} ${curType === 'win' ? 'W' : 'L'}` : '—', color: curType === 'win' ? POS : NEG, hot: curType === 'win' && cur >= 2 },
    { label: 'Best win run', value: bestW || '—', color: POS },
    { label: 'Worst loss run', value: worstL || '—', color: NEG },
  ]
  return (
    <Card title="Performance pulse" icon={Flame} delay={delay} accent={POS}>
      {res.length === 0 ? (
        <Empty>Needs at least one Target / SL result.</Empty>
      ) : (
        <div className="flex items-center gap-4">
          <div className="relative h-[84px] w-[84px] shrink-0">
            <svg viewBox="0 0 84 84" className="h-full w-full -rotate-90">
              <circle cx="42" cy="42" r={R} fill="none" stroke="currentColor" strokeWidth="8" style={{ color: 'color-mix(in srgb, var(--ta-slate) 20%, transparent)' }} />
              <motion.circle
                cx="42" cy="42" r={R} fill="none" strokeWidth="8" strokeLinecap="round"
                stroke={wr >= 50 ? POS : NEG}
                strokeDasharray={C}
                initial={{ strokeDashoffset: C }}
                whileInView={{ strokeDashoffset: C * (1 - (wr || 0) / 100) }}
                viewport={{ once: true }}
                transition={{ duration: 1.2, ease: EASE, delay: delay + 0.15 }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <CountUp value={wr} suffix="%" className="ta-num font-extrabold" style={{ fontSize: 'var(--tad-value)', color: 'var(--ta-ink)' }} />
              <span style={{ fontSize: 'var(--tad-micro)', color: 'var(--ta-slate)' }}>{wins}W / {losses}L</span>
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            {chips.map((c, i) => (
              <motion.div
                key={c.label}
                initial={{ opacity: 0, x: 12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: delay + 0.2 + i * 0.08, duration: 0.4, ease: EASE }}
                className="flex items-center justify-between rounded-lg px-2 py-1"
                style={{ backgroundColor: `color-mix(in srgb, ${c.color} 11%, transparent)` }}
              >
                <span style={{ fontSize: 'var(--tad-micro)', color: 'var(--ta-slate)' }}>{c.label}</span>
                <span className="ta-num flex items-center gap-1 font-extrabold" style={{ fontSize: 'var(--tad-body)', color: c.color }}>
                  {c.hot && (
                    <motion.span animate={{ scale: [1, 1.25, 1] }} transition={{ duration: 1.1, repeat: Infinity }}>
                      <Flame size={11} />
                    </motion.span>
                  )}
                  {c.value}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}

/** Dot-per-trade timeline of the most recent results. */
function StreakDots({ chrono, delay }) {
  const last = chrono.slice(-48)
  return (
    <Card title="Result timeline" icon={Activity} span={2} delay={delay} accent={AMBER}>
      {last.length === 0 ? (
        <Empty>No trades yet.</Empty>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {last.map((t, i) => {
              const o = outcomeOf(t)
              const c = o === 'win' ? POS : o === 'loss' ? NEG : AMBER
              return (
                <motion.span
                  key={t.id || i}
                  title={`${t.pair || t.instrumentName || ''} · ${t.date || ''} · ${t.status || 'Pending'}`}
                  initial={{ scale: 0, opacity: 0 }}
                  whileInView={{ scale: 1, opacity: 1 }}
                  viewport={{ once: true }}
                  whileHover={{ scale: 1.5, y: -2 }}
                  transition={{ delay: delay + i * 0.018, type: 'spring', stiffness: 420, damping: 18 }}
                  className="h-3.5 w-3.5 rounded-[5px]"
                  style={{ backgroundColor: c, boxShadow: `0 0 0 2px color-mix(in srgb, ${c} 25%, transparent)` }}
                />
              )
            })}
          </div>
          <div className="mt-1.5 flex items-center justify-between">
            <Legend />
            <span style={{ fontSize: 'var(--tad-micro)', color: 'var(--ta-slate)' }}>oldest → latest · last {last.length}</span>
          </div>
        </>
      )}
    </Card>
  )
}

/** Calendar heat-map — one cell per day, newest week on the right. */
function CalendarHeat({ trades, delay }) {
  const { cols, hasAny, monthLabels } = useMemo(() => {
    const byDay = new Map()
    trades.forEach((t) => {
      const k = dayKey(parseDate(t))
      if (!byDay.has(k)) byDay.set(k, { w: 0, l: 0, o: 0 })
      const r = byDay.get(k)
      const o = outcomeOf(t)
      if (o === 'win') r.w += 1
      else if (o === 'loss') r.l += 1
      else r.o += 1
    })
    const latest = trades.reduce((m, t) => Math.max(m, +parseDate(t)), 0) || Date.now()
    const end = new Date(latest)
    end.setDate(end.getDate() + (7 - (end.getDay() || 7))) // sunday of latest week
    const weeks = 14
    const start = new Date(end)
    start.setDate(end.getDate() - weeks * 7 + 1)
    const cols = []
    const monthLabels = []
    let lastMonth = -1
    for (let w = 0; w < weeks; w++) {
      const col = []
      for (let d = 0; d < 7; d++) {
        const dt = new Date(start)
        dt.setDate(start.getDate() + w * 7 + d)
        const k = dayKey(dt)
        col.push({ k, rec: byDay.get(k) || null, future: dt > new Date(latest) && !byDay.get(k) })
        if (d === 0 && dt.getMonth() !== lastMonth) {
          lastMonth = dt.getMonth()
          monthLabels.push({ w, label: dt.toLocaleString('en', { month: 'short' }) })
        }
      }
      cols.push(col)
    }
    return { cols, hasAny: byDay.size > 0, monthLabels }
  }, [trades])

  const colorOf = (rec) => {
    if (!rec) return null
    if (rec.w > rec.l) return POS
    if (rec.l > rec.w) return NEG
    return AMBER
  }
  return (
    <Card title="Calendar heat-map" icon={CalendarDays} span={2} delay={delay} accent={POS}>
      {!hasAny ? (
        <Empty>No dated trades yet.</Empty>
      ) : (
        <div className="overflow-x-auto pb-1">
          <div className="relative mb-1 flex gap-[3px]" style={{ height: 10 }}>
            {cols.map((_, w) => {
              const m = monthLabels.find((x) => x.w === w)
              return (
                <span key={w} className="w-[15px] shrink-0 overflow-visible whitespace-nowrap" style={{ fontSize: 7, color: 'var(--ta-slate)' }}>
                  {m?.label || ''}
                </span>
              )
            })}
          </div>
          <div className="flex gap-[3px]">
            {cols.map((col, w) => (
              <div key={w} className="flex flex-col gap-[3px]">
                {col.map((cell, d) => {
                  const c = colorOf(cell.rec)
                  const n = cell.rec ? cell.rec.w + cell.rec.l + cell.rec.o : 0
                  return (
                    <motion.span
                      key={cell.k}
                      title={cell.rec ? `${cell.k} · ${cell.rec.w}W ${cell.rec.l}L${cell.rec.o ? ` ${cell.rec.o} open` : ''}` : cell.k}
                      initial={{ scale: 0, opacity: 0 }}
                      whileInView={{ scale: 1, opacity: 1 }}
                      viewport={{ once: true }}
                      whileHover={{ scale: 1.45 }}
                      transition={{ delay: delay + (w * 7 + d) * 0.0045, type: 'spring', stiffness: 420, damping: 22 }}
                      className="h-[15px] w-[15px] rounded-[4px]"
                      style={{
                        backgroundColor: c ? c : 'color-mix(in srgb, var(--ta-slate) 14%, transparent)',
                        opacity: c ? Math.min(1, 0.45 + n * 0.2) : cell.future ? 0.35 : 1,
                      }}
                    />
                  )
                })}
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex items-center justify-between">
            <Legend />
            <span style={{ fontSize: 'var(--tad-micro)', color: 'var(--ta-slate)' }}>darker = more trades that day</span>
          </div>
        </div>
      )}
    </Card>
  )
}

/** Win-rate line over a sliding window of resolved trades. */
function RollingWinRate({ chrono, delay }) {
  const res = chrono.map(outcomeOf).filter((o) => o === 'win' || o === 'loss')
  const win = Math.min(5, Math.max(3, Math.floor(res.length / 3)))
  const pts = []
  for (let i = win - 1; i < res.length; i++) {
    const slice = res.slice(i - win + 1, i + 1)
    pts.push((slice.filter((o) => o === 'win').length / win) * 100)
  }
  const W = 300
  const H = 96
  const P = 8
  const xy = pts.map((v, i) => [P + (i / Math.max(1, pts.length - 1)) * (W - P * 2), P + (1 - v / 100) * (H - P * 2)])
  const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = xy.length ? `${line} L${xy[xy.length - 1][0]},${H - P} L${xy[0][0]},${H - P} Z` : ''
  const lastVal = pts[pts.length - 1]
  return (
    <Card title={`Rolling win rate · last ${win}`} icon={TrendingUp} delay={delay} accent="#2563eb">
      {pts.length < 2 ? (
        <Empty>Needs a few more Target / SL results.</Empty>
      ) : (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} className="h-[96px] w-full">
            <defs>
              <linearGradient id="rwr-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563eb" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
              </linearGradient>
            </defs>
            <line x1={P} x2={W - P} y1={P + (H - P * 2) / 2} y2={P + (H - P * 2) / 2} stroke="currentColor" strokeDasharray="3 4" style={{ color: 'color-mix(in srgb, var(--ta-slate) 45%, transparent)' }} />
            <motion.path d={area} fill="url(#rwr-fill)" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: delay + 0.7, duration: 0.8 }} />
            <motion.path
              d={line} fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
              initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }}
              transition={{ delay, duration: 1.2, ease: EASE }}
            />
            <motion.circle
              cx={xy[xy.length - 1][0]} cy={xy[xy.length - 1][1]} r="3.6" fill="#2563eb"
              initial={{ scale: 0 }} whileInView={{ scale: 1 }} viewport={{ once: true }} transition={{ delay: delay + 1.1, type: 'spring' }}
            />
          </svg>
          <div className="flex items-center justify-between" style={{ fontSize: 'var(--tad-micro)', color: 'var(--ta-slate)' }}>
            <span>50% line dashed</span>
            <span className="font-bold" style={{ color: lastVal >= 50 ? POS : NEG }}>now {Math.round(lastVal)}%</span>
          </div>
        </>
      )}
    </Card>
  )
}

/** Wins vs losses by weekday as growing columns. */
function WeekdayColumns({ trades, delay }) {
  const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const rows = names.map((n, i) => ({ n, i, win: 0, loss: 0 }))
  trades.forEach((t) => {
    const d = parseDate(t).getDay()
    const idx = d === 0 ? 6 : d - 1
    const o = outcomeOf(t)
    if (o === 'win') rows[idx].win += 1
    else if (o === 'loss') rows[idx].loss += 1
  })
  const top = Math.max(...rows.map((r) => r.win + r.loss), 1)
  const any = rows.some((r) => r.win + r.loss > 0)
  return (
    <Card title="Day of week" icon={Clock} delay={delay} accent="#7c3aed">
      {!any ? (
        <Empty>No results yet.</Empty>
      ) : (
        <>
          <div className="flex h-[96px] items-end justify-between gap-1.5">
            {rows.map((r, i) => {
              const h = ((r.win + r.loss) / top) * 100
              const wr = pctOf(r.win, r.loss)
              return (
                <motion.div key={r.n} whileHover={{ y: -3 }} className="flex h-full flex-1 flex-col items-center justify-end gap-0.5" title={`${r.n}: ${r.win}W ${r.loss}L`}>
                  <span className="ta-num font-bold" style={{ fontSize: 7.5, color: wr == null ? 'var(--ta-slate)' : wr >= 50 ? POS : NEG }}>
                    {wr == null ? '' : `${wr}%`}
                  </span>
                  <motion.div
                    className="flex w-full origin-bottom flex-col-reverse overflow-hidden rounded-t-md"
                    style={{ height: `${Math.max(h, r.win + r.loss ? 6 : 0)}%` }}
                    initial={{ scaleY: 0 }} whileInView={{ scaleY: 1 }} viewport={{ once: true }}
                    transition={{ delay: delay + i * 0.06, duration: 0.65, ease: EASE }}
                  >
                    <span style={{ height: `${(r.win / Math.max(1, r.win + r.loss)) * 100}%`, backgroundColor: POS }} />
                    <span style={{ height: `${(r.loss / Math.max(1, r.win + r.loss)) * 100}%`, backgroundColor: NEG }} />
                  </motion.div>
                  <span style={{ fontSize: 7.5, color: 'var(--ta-slate)' }}>{r.n}</span>
                </motion.div>
              )
            })}
          </div>
        </>
      )}
    </Card>
  )
}

/** Avg validation score of winners vs losers. */
function ValidationEdge({ trades, delay }) {
  const avg = (o) => {
    const v = trades.filter((t) => outcomeOf(t) === o).map(scorePct).filter((x) => x != null)
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
  }
  const w = avg('win')
  const l = avg('loss')
  const rows = [
    { label: 'Winning trades', v: w, c: POS },
    { label: 'Losing trades', v: l, c: NEG },
  ]
  return (
    <Card title="Validation edge" icon={Shield} delay={delay} accent="#0891b2">
      {w == null && l == null ? (
        <Empty>No validation rules ticked on these trades.</Empty>
      ) : (
        <div className="flex flex-col gap-3 py-1">
          {rows.map((r, i) => (
            <div key={r.label} className="flex flex-col gap-1">
              <div className="flex items-center justify-between" style={{ fontSize: 'var(--tad-body)' }}>
                <span style={{ color: 'var(--ta-ink)' }}>{r.label}</span>
                <CountUp value={r.v == null ? null : Math.round(r.v)} suffix="%" className="ta-num font-extrabold" style={{ color: r.c }} />
              </div>
              <div className="h-2.5 overflow-hidden rounded-full" style={{ backgroundColor: 'color-mix(in srgb, var(--ta-slate) 18%, transparent)' }}>
                <motion.div
                  className="h-full origin-left rounded-full"
                  style={{ width: `${r.v || 0}%`, background: `linear-gradient(90deg, ${r.c}, color-mix(in srgb, ${r.c} 60%, white))` }}
                  initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }}
                  transition={{ delay: delay + 0.1 + i * 0.12, duration: 0.8, ease: EASE }}
                />
              </div>
            </div>
          ))}
          <p style={{ fontSize: 'var(--tad-micro)', color: 'var(--ta-slate)' }}>
            {w != null && l != null
              ? w > l
                ? `Winners were ${Math.round(w - l)} pts better validated — the checklist is paying off.`
                : 'Losers were validated as well as winners — the checklist isn’t separating them yet.'
              : 'Average % of active rules ticked per trade.'}
          </p>
        </div>
      )}
    </Card>
  )
}

/** Big animated headline numbers. */
function HeadlineRow({ trades, chrono, delay }) {
  const res = chrono.map(outcomeOf)
  const wins = res.filter((o) => o === 'win').length
  const losses = res.filter((o) => o === 'loss').length
  const open = res.length - wins - losses
  const wr = pctOf(wins, losses)
  const ratio = losses ? wins / losses : null
  const days = new Set(trades.map((t) => dayKey(parseDate(t)))).size
  const pairs = new Set(trades.map((t) => t.pair || t.instrumentName).filter(Boolean)).size
  const items = [
    { label: 'Win / loss ratio', value: ratio, decimals: 2, color: ratio == null ? 'var(--ta-slate)' : ratio >= 1 ? POS : NEG, icon: Sparkles },
    { label: 'Trading days', value: days, color: '#2563eb', icon: CalendarDays },
    { label: 'Instruments', value: pairs, color: '#7c3aed', icon: Compass },
    { label: 'Still open', value: open, color: AMBER, icon: Timer },
    { label: 'Hit rate', value: wr, suffix: '%', color: wr == null ? 'var(--ta-slate)' : wr >= 50 ? POS : NEG, icon: Flame },
  ]
  return (
    <div className="col-span-full grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
      {items.map((it, i) => {
        const Icon = it.icon
        return (
          <motion.div
            key={it.label}
            initial={{ opacity: 0, y: 14, scale: 0.94 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true }}
            whileHover={{ y: -4, scale: 1.03 }}
            transition={{ delay: delay + i * 0.06, duration: 0.45, ease: EASE }}
            className="ta-pro-card relative flex flex-col items-center gap-0.5 overflow-hidden py-3 text-center"
          >
            <motion.span
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-[3px] origin-left"
              style={{ backgroundColor: it.color }}
              initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }}
              transition={{ delay: delay + 0.3 + i * 0.06, duration: 0.7, ease: EASE }}
            />
            <Icon size={13} style={{ color: it.color }} />
            <CountUp value={it.value} decimals={it.decimals || 0} suffix={it.suffix || ''} className="ta-num font-extrabold" style={{ fontSize: 'var(--tad-hero)', color: it.color }} />
            <span className="font-semibold uppercase tracking-wide" style={{ fontSize: 'var(--tad-micro)', color: 'var(--ta-slate)' }}>{it.label}</span>
          </motion.div>
        )
      })}
    </div>
  )
}

export default function ShareInsightWidgets({ trades, delayBase = 0.2 }) {
  const chrono = useMemo(() => sortChrono(trades), [trades])
  const byPair = useMemo(() => tally(trades, (t) => [t.pair || t.instrumentName]), [trades])
  const byTf = useMemo(() => tally(trades, (t) => [t.timeframe]), [trades])
  const bySetup = useMemo(() => tally(trades, (t) => t.setupTypes || []), [trades])
  const byDir = useMemo(() => tally(trades, (t) => [t.direction]), [trades])
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted || !trades.length) return null
  const d = delayBase

  return (
    <>
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: d, duration: 0.3 }}
        className="col-span-full mt-1 flex items-center gap-1.5"
      >
        <span className="h-[2px] w-4 rounded-full" style={{ backgroundColor: 'var(--ta-accent)' }} />
        <span className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: 'var(--ta-slate)' }}>
          Insights · from Target / SL results
        </span>
      </motion.div>

      <HeadlineRow trades={trades} chrono={chrono} delay={d + 0.04} />
      <PulseCard chrono={chrono} delay={d + 0.06} />
      <RollingWinRate chrono={chrono} delay={d + 0.08} />
      <ValidationEdge trades={trades} delay={d + 0.1} />
      <StreakDots chrono={chrono} delay={d + 0.12} />
      <WeekdayColumns trades={trades} delay={d + 0.14} />
      <CalendarHeat trades={trades} delay={d + 0.16} />

      <Card title="Win rate by instrument" icon={Compass} delay={d + 0.18} accent="#d97706">
        <OutcomeBars rows={byPair} />
        <div className="mt-2"><Legend /></div>
      </Card>
      <Card title="Win rate by time frame" icon={Timer} delay={d + 0.2} accent="#0f766e">
        <OutcomeBars rows={byTf} />
        <div className="mt-2"><Legend /></div>
      </Card>
      <Card title="Buy vs Sell results" icon={Layers} delay={d + 0.22} accent="#2563eb">
        <OutcomeBars rows={byDir} />
        <div className="mt-2"><Legend /></div>
      </Card>
      {bySetup.length > 0 && (
        <Card title="Win rate by setup type" icon={Sparkles} span={3} delay={d + 0.24} accent="#db2777">
          <OutcomeBars rows={bySetup} />
          <div className="mt-2"><Legend /></div>
        </Card>
      )}
    </>
  )
}
