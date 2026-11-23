import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import {
  Table2,
  LineChart,
  ChevronLeft,
  ChevronRight,
  Eye,
  RefreshCw,
  Link2Off,
  Clock,
  SearchX,
  ServerCog,
  Lock,
  Filter,
  X,
  StickyNote,
  ExternalLink,
  Star,
  Check,
  Loader2,
} from 'lucide-react'
import { fetchStrategyShare, registerStrategyShareView } from '../../lib/strategyShare'
import { tradeThemeCssVars, tradeHeaderCssVars, isGlassTheme, isClayTheme } from '../../theme/tradeAnalysisThemes'
import {
  MONTH_NAMES,
  WEEKDAY_SHORT,
  WEEKDAY_COLORS,
  daysInMonth,
  dateKey,
  defaultFieldWidth,
  optionTextStyle,
} from '../../utils/strategyTesterFields'
import { categoriesOf, rowHasOption, rowHasValue, computeBreakdown } from '../../utils/strategyBreakdown'
import { computeStats } from '../../utils/strategyStats'
import StrategyCompare from '../strategy-tester/StrategyCompare'
import { Card, Grid, Stat, HBar, SectionHeader, fmtPct } from '../trade-analysis/analysis/primitives'
import { useUiStore } from '../../store/uiStore'
import ImageLightbox from '../common/ImageLightbox'

const EASE = [0.23, 1, 0.32, 1]

const ERRORS = {
  ended: { icon: Link2Off, accent: '#eb5e28', title: 'This link was closed', message: 'The owner turned this share link off.' },
  expired: { icon: Clock, accent: '#e8871e', title: 'This link has expired', message: 'Its viewing window has run out.' },
  'not-found': { icon: SearchX, accent: '#dc2626', title: "This link isn't valid", message: 'It looks broken, mistyped, or the strategy it pointed to is gone.' },
  'not-configured': { icon: ServerCog, accent: '#6b7280', title: "Can't open this link yet", message: 'Sharing isn’t set up on this deployment.' },
}

function ErrorScreen({ kind, onRetry }) {
  const cfg = ERRORS[kind] || ERRORS['not-found']
  const Icon = cfg.icon
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#ecebe4] px-6 text-[#242423]">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE }} className="flex max-w-sm flex-col items-center gap-3 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: `${cfg.accent}1f`, color: cfg.accent }}>
          <Icon size={26} />
        </span>
        <h1 className="text-lg font-bold">{cfg.title}</h1>
        <p className="text-sm opacity-70">{cfg.message}</p>
        {onRetry && (
          <button type="button" onClick={onRetry} className="mt-1 rounded-full px-4 py-1.5 text-xs font-semibold text-white" style={{ backgroundColor: cfg.accent }}>
            Try again
          </button>
        )}
      </motion.div>
    </div>
  )
}

// Read-only version of the Table cells — same look, nothing editable.
function ReadOnlyCell({ field, value }) {
  const dash = <span style={{ color: 'var(--ta-slate)', opacity: 0.5 }}>—</span>
  const empty = value == null || value === '' || (Array.isArray(value) && value.length === 0)
  const tag = (label, color) => (
    <span className="rounded-[3px] px-1.5 py-[1px] text-[8.5px] font-bold" style={{ backgroundColor: color, color: '#fffcf2' }}>
      {label}
    </span>
  )
  switch (field.type) {
    case 'image':
      return value ? (
        <button type="button" onClick={() => useUiStore.getState().openImageLightbox(value)} className="h-6 w-9 overflow-hidden rounded-[3px] border transition-transform hover:scale-[1.15]" style={{ borderColor: 'var(--tad-border)' }}>
          <img src={value} alt="" className="h-full w-full object-cover" loading="lazy" />
        </button>
      ) : (
        dash
      )
    case 'buysell':
      return value === 'buy' ? tag('Buy', '#16a34a') : value === 'sell' ? tag('Sell', '#dc2626') : dash
    case 'sltarget': {
      const k = typeof value === 'string' ? value : value?.sl ? 'sl' : value?.target ? 'target' : null
      return k === 'sl' ? tag('SL', '#dc2626') : k === 'target' ? tag('Target', '#16a34a') : dash
    }
    case 'outcome':
      return value === 'win' ? tag('Win', '#16a34a') : value === 'loss' ? tag('Loss', '#dc2626') : value === 'be' ? tag('BE', '#64748b') : dash
    case 'select':
    case 'multiselect':
    case 'checkbox': {
      if (field.type === 'checkbox' && !(field.options || []).length) return value === true ? <Check size={12} style={{ color: '#16a34a' }} /> : dash
      const ids = Array.isArray(value) ? value : value ? [value] : []
      const opts = (field.options || []).filter((o) => ids.includes(o.id))
      if (!opts.length) return dash
      return (
        <span className="flex flex-wrap justify-center gap-0.5">
          {opts.map((o) => (
            <span key={o.id} className="rounded-[4px] px-1.5 py-[1px] text-[9px] font-semibold" style={{ backgroundColor: `${o.color}26`, color: o.color, ...optionTextStyle(o) }}>
              {o.label}
            </span>
          ))}
        </span>
      )
    }
    case 'pnl': {
      if (empty) return dash
      const n = parseFloat(value)
      return <b style={{ color: n > 0 ? '#16a34a' : n < 0 ? '#dc2626' : 'var(--ta-ink)' }}>{value}</b>
    }
    case 'rating': {
      const n = Number(value) || 0
      if (!n) return dash
      return (
        <span className="flex gap-[1px]">
          {[1, 2, 3, 4, 5].map((i) => (
            <Star key={i} size={9} fill={i <= n ? '#f59e0b' : 'none'} style={{ color: i <= n ? '#f59e0b' : 'var(--ta-slate)', opacity: i <= n ? 1 : 0.4 }} />
          ))}
        </span>
      )
    }
    case 'notes':
      return empty ? dash : (
        <span className="flex items-center gap-0.5" title={value}>
          <StickyNote size={10} style={{ color: 'var(--ta-accent)' }} />
          <span className="max-w-[160px] truncate text-[9px]">{value}</span>
        </span>
      )
    case 'link':
      return empty ? dash : (
        <a href={/^https?:\/\//i.test(value) ? value : `https://${value}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-0.5 text-[9px] underline" style={{ color: 'var(--ta-accent)' }}>
          <span className="max-w-[120px] truncate">{value}</span>
          <ExternalLink size={9} />
        </a>
      )
    default:
      return empty ? dash : <span className="text-[10px] font-medium">{String(value)}</span>
  }
}

function timeAgo(iso) {
  if (!iso) return ''
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  return `${Math.floor(s / 86400)} d ago`
}

// `?strategyShare=<id>` — a read-only Table + Analysis for ONE strategy.
// Rendered by main.jsx instead of <App/>, so it never touches the visitor's
// own projects, account or local data.
export default function StrategyShareView({ shareId }) {
  const [state, setState] = useState({ status: 'loading', row: null, error: null })
  const [refreshing, setRefreshing] = useState(false)
  const [views, setViews] = useState(null)
  const counted = useRef(false)
  const now = new Date()
  const [ym, setYm] = useState({ year: now.getFullYear(), month: now.getMonth() })
  const [tab, setTab] = useState('table')
  const [onlyLogged, setOnlyLogged] = useState(true)
  const [filter, setFilter] = useState({})
  const [filterOpen, setFilterOpen] = useState(false)

  const load = async (initial) => {
    if (!initial) setRefreshing(true)
    const res = await fetchStrategyShare(shareId)
    if (res.error) setState({ status: 'error', row: null, error: res.error })
    else {
      setState({ status: 'ready', row: res.data, error: null })
      setViews(res.data.view_count ?? null)
      if (initial && !counted.current) {
        counted.current = true
        registerStrategyShareView(shareId).then((n) => n != null && setViews(n))
      }
    }
    setRefreshing(false)
  }

  useEffect(() => {
    load(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareId])

  const payload = state.row?.payload
  const strategy = payload?.strategy
  const entries = payload?.entries
  const extra = payload?.rows || {}
  const theme = state.row?.theme_name

  // Open on the latest month that actually has entries.
  const seeded = useRef(false)
  useEffect(() => {
    if (!entries || seeded.current) return
    seeded.current = true
    const keys = Object.keys(entries).filter((k) => /^\d{4}-\d{2}/.test(k)).sort()
    if (keys.length) {
      const last = keys[keys.length - 1]
      setYm({ year: Number(last.slice(0, 4)), month: Number(last.slice(5, 7)) - 1 })
    }
  }, [entries])

  const cats = useMemo(() => (strategy ? categoriesOf(strategy) : []), [strategy])
  const filterActive = Object.keys(filter).length > 0
  const passes = (row) => {
    if (!filterActive) return true
    if (!row) return false
    return cats.every((c) => !filter[c.fieldId] || filter[c.fieldId].some((k) => rowHasOption(row, c, k)))
  }

  const { year, month } = ym
  const rows = useMemo(() => {
    if (!strategy) return []
    const out = []
    for (let day = 1; day <= daysInMonth(year, month); day++) {
      const base = dateKey(year, month, day)
      const wd = new Date(year, month, day).getDay()
      ;[null, ...(extra[base] || [])].forEach((id, n) => {
        const rk = id ? `${base}#${id}` : base
        const row = entries?.[rk]
        if (onlyLogged && !rowHasValue(strategy, row)) return
        if (!passes(row)) return
        out.push({ rk, day, wd, n, row })
      })
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strategy, entries, extra, year, month, onlyLogged, filter])

  const stats = useMemo(() => (strategy ? computeStats(strategy, entries, year, month) : null), [strategy, entries, year, month])
  const breakdown = useMemo(() => (strategy ? computeBreakdown(strategy, entries, year, month) : null), [strategy, entries, year, month])

  const shift = (d) =>
    setYm(({ year: y, month: m }) => {
      const t = new Date(y, m + d, 1)
      return { year: t.getFullYear(), month: t.getMonth() }
    })

  if (state.status === 'loading') {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#ecebe4]">
        <Loader2 className="animate-spin text-[#242423]/50" />
      </div>
    )
  }
  if (state.status === 'error') return <ErrorScreen kind={state.error} onRetry={() => { setState({ status: 'loading' }); load(true) }} />

  const isGlass = isGlassTheme(theme)
  const isClay = isClayTheme(theme)
  const accent = 'var(--ta-accent)'

  return (
    <MotionConfig reducedMotion="user">
      <div
        data-ta-theme={theme}
        data-ta-density="dense"
        className={`flex h-screen w-screen flex-col ${isGlass ? 'ta-liquid-bg' : isClay ? 'ta-clay-bg' : ''}`}
        style={isGlass || isClay ? { ...tradeThemeCssVars(theme), ...tradeHeaderCssVars(theme) } : { backgroundColor: '#ffffff', ...tradeThemeCssVars(theme), ...tradeHeaderCssVars(theme) }}
      >
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.26, ease: EASE }}
          className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b px-3 py-2"
          style={{ backgroundColor: 'var(--ta-surface)', borderColor: 'var(--ta-slate)', color: 'var(--ta-ink)' }}
        >
          <div className="min-w-0">
            <h1 className="truncate text-[13px] font-bold leading-tight">{state.row.strategy_name || strategy?.name}</h1>
            <p className="flex items-center gap-1.5 text-[9px]" style={{ color: 'var(--ta-slate)' }}>
              <Lock size={9} /> View only
              {views != null && (
                <>
                  · <Eye size={9} /> {views}
                </>
              )}
              {state.row.updated_at && <>· updated {timeAgo(state.row.updated_at)}</>}
            </p>
          </div>

          <div className="flex items-center gap-0.5 rounded-full p-0.5" style={{ backgroundColor: 'var(--ta-bg)' }}>
            {[
              { id: 'table', label: 'Table', icon: Table2 },
              { id: 'analysis', label: 'Analysis', icon: LineChart },
            ].map((t) => {
              const on = tab === t.id
              const Icon = t.icon
              return (
                <button key={t.id} type="button" onClick={() => setTab(t.id)} className="relative flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-semibold" style={{ color: on ? '#fffcf2' : 'var(--ta-ink)', transition: 'color 0.15s ease' }}>
                  {on && <motion.span layoutId="ssv-tab" transition={{ type: 'spring', stiffness: 640, damping: 40 }} className="absolute inset-0 rounded-full" style={{ backgroundColor: accent }} />}
                  <Icon size={11} className="relative" />
                  <span className="relative">{t.label}</span>
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-1 rounded-full px-1 py-0.5" style={{ backgroundColor: 'var(--ta-bg)' }}>
            <button type="button" onClick={() => shift(-1)} className="rounded-full p-1 hover:bg-black/5" aria-label="Previous month">
              <ChevronLeft size={12} />
            </button>
            <span className="min-w-[88px] text-center text-[10px] font-semibold">
              {MONTH_NAMES[month]} {year}
            </span>
            <button type="button" onClick={() => shift(1)} className="rounded-full p-1 hover:bg-black/5" aria-label="Next month">
              <ChevronRight size={12} />
            </button>
          </div>

          <button type="button" onClick={() => load(false)} title="Refresh" className="ml-auto rounded-full p-1.5 hover:bg-black/5" style={{ color: 'var(--ta-ink)' }}>
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </motion.header>

        <div className="min-h-0 flex-1 overflow-y-auto ta-scroll" style={{ color: 'var(--ta-ink)' }}>
          <AnimatePresence mode="wait" initial={false}>
            {tab === 'table' ? (
              <motion.div key="table" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.16, ease: EASE }} className="p-3">
                {/* Controls */}
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setOnlyLogged((v) => !v)}
                    className="rounded-full px-2.5 py-1 text-[9px] font-semibold"
                    style={onlyLogged ? { backgroundColor: accent, color: '#fffcf2' } : { backgroundColor: 'var(--ta-bg)', color: 'var(--ta-ink)' }}
                  >
                    {onlyLogged ? 'Logged days only' : 'All days'}
                  </button>
                  {cats.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setFilterOpen((v) => !v)}
                      className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[9px] font-semibold"
                      style={filterActive ? { backgroundColor: accent, color: '#fffcf2' } : { backgroundColor: 'var(--ta-bg)', color: 'var(--ta-ink)' }}
                    >
                      <Filter size={9} /> Filter
                    </button>
                  )}
                  {filterActive && (
                    <button type="button" onClick={() => setFilter({})} className="flex items-center gap-0.5 text-[9px] font-semibold" style={{ color: 'var(--ta-slate)' }}>
                      <X size={9} /> Clear
                    </button>
                  )}
                  <span className="ml-auto text-[9px] tabular-nums" style={{ color: 'var(--ta-slate)' }}>
                    {rows.length} row{rows.length === 1 ? '' : 's'}
                  </span>
                </div>

                <AnimatePresence initial={false}>
                  {filterOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.18, ease: EASE }}
                      className="mb-2 overflow-hidden rounded-xl border"
                      style={{ borderColor: 'var(--ta-slate)', backgroundColor: 'var(--ta-surface)' }}
                    >
                      <div className="flex flex-col gap-1.5 p-2.5">
                        {cats.map((c) => (
                          <div key={c.fieldId} className="flex flex-wrap items-center gap-1">
                            <span className="w-24 shrink-0 truncate text-[8.5px] font-bold uppercase tracking-wide" style={{ color: 'var(--ta-slate)' }}>
                              {c.label}
                            </span>
                            {c.options.map((o) => {
                              const on = (filter[c.fieldId] || []).includes(o.key)
                              const col = o.color || 'var(--ta-accent)'
                              return (
                                <button
                                  key={o.key}
                                  type="button"
                                  onClick={() =>
                                    setFilter((f) => {
                                      const cur = f[c.fieldId] || []
                                      const next = cur.includes(o.key) ? cur.filter((k) => k !== o.key) : [...cur, o.key]
                                      const out = { ...f, [c.fieldId]: next }
                                      if (!next.length) delete out[c.fieldId]
                                      return out
                                    })
                                  }
                                  className="rounded-full px-2 py-0.5 text-[9px] font-semibold"
                                  style={{ backgroundColor: on ? col : 'var(--ta-bg)', color: on ? '#fffcf2' : 'var(--ta-ink)', boxShadow: on ? 'none' : `inset 0 0 0 1px ${col}55`, transition: 'background-color 0.12s ease, color 0.12s ease' }}
                                >
                                  {o.label}
                                </button>
                              )
                            })}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--ta-slate)', backgroundColor: 'var(--ta-surface)' }}>
                  <table className="w-full border-collapse text-[10px]">
                    <thead>
                      <tr style={{ backgroundColor: 'var(--ta-bg)' }}>
                        <th className="sticky left-0 z-10 w-[84px] px-2 py-1.5 text-left text-[9px] font-bold uppercase tracking-wide" style={{ backgroundColor: 'var(--ta-bg)' }}>
                          Date
                        </th>
                        {strategy.fields.map((f) => (
                          <th key={f.id} className="px-2 py-1.5 text-center text-[9px] font-bold uppercase tracking-wide" style={{ minWidth: Math.max(60, Math.min(defaultFieldWidth(f.type), 220)) }}>
                            {f.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 && (
                        <tr>
                          <td colSpan={strategy.fields.length + 1} className="px-3 py-8 text-center text-[10px]" style={{ color: 'var(--ta-slate)' }}>
                            {filterActive ? 'No rows match this filter.' : 'Nothing logged this month.'}
                          </td>
                        </tr>
                      )}
                      {rows.map(({ rk, day, wd, n, row }, i) => (
                        <motion.tr
                          key={rk}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.18, delay: Math.min(i, 14) * 0.012, ease: EASE }}
                          className="border-t"
                          style={{ borderColor: 'color-mix(in srgb, var(--ta-slate) 30%, transparent)' }}
                        >
                          <td className="sticky left-0 z-10 px-2 py-1" style={{ backgroundColor: 'var(--ta-surface)' }}>
                            <span className="flex items-center gap-1">
                              <b className="w-4 text-right text-[11px]">{day}</b>
                              <span className="rounded-full px-1.5 py-[1px] text-[8px] font-bold" style={{ backgroundColor: `${WEEKDAY_COLORS[wd]}26`, color: '#000' }}>
                                {WEEKDAY_SHORT[wd].toUpperCase()}
                              </span>
                              {n > 0 && <span className="text-[8px] font-semibold" style={{ color: 'var(--ta-slate)' }}>#{n + 1}</span>}
                            </span>
                          </td>
                          {strategy.fields.map((f) => (
                            <td key={f.id} className="px-1.5 py-1 text-center">
                              <div className="flex min-h-[18px] items-center justify-center">
                                <ReadOnlyCell field={f} value={row?.[f.id]} />
                              </div>
                            </td>
                          ))}
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            ) : (
              <motion.div key="analysis" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.16, ease: EASE }} className="px-3 pb-8 pt-1">
                <SectionHeader title={`${MONTH_NAMES[month]} ${year}`} subtitle={`${stats.filledDays}/${stats.numDays} days logged · ${breakdown.total} entries`} />
                <Grid cols="grid-cols-2 sm:grid-cols-4">
                  <Card><Stat label="Entries" value={breakdown.total} accent /></Card>
                  <Card><Stat label="Days logged" value={stats.filledDays} /></Card>
                  {stats.hasOutcome && <Card><Stat label="Win rate" value={stats.winRatePct} formatter={(v) => fmtPct(v)} accent /></Card>}
                  {stats.hasOutcome && <Card><Stat label="W · L · BE" value={stats.wins} sub={`${stats.wins} · ${stats.losses} · ${stats.breakevens}`} /></Card>}
                  {stats.hasPnl && <Card><Stat label="Total P&L" value={stats.pnlTotal} decimals={0} accent formatter={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(0)}`} /></Card>}
                </Grid>

                {stats.hasBuysell && (
                  <Card className="mt-2">
                    <div className="flex flex-col gap-1.5">
                      <HBar label="Buy" pct={stats.buys + stats.sells > 0 ? (stats.buys / (stats.buys + stats.sells)) * 100 : 0} value={stats.buys} color="#16a34a" />
                      <HBar label="Sell" pct={stats.buys + stats.sells > 0 ? (stats.sells / (stats.buys + stats.sells)) * 100 : 0} value={stats.sells} color="#dc2626" />
                    </div>
                  </Card>
                )}

                <StrategyCompare strategy={strategy} strategyEntries={entries} year={year} month={month} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <ImageLightbox blurCorner />
      </div>
    </MotionConfig>
  )
}
