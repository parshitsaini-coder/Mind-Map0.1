import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  RefreshCw,
  TrendingUp,
  Link2Off,
  Clock,
  SearchX,
  ServerCog,
  AlertTriangle,
  Sparkles,
  LayoutGrid,
  BarChart3,
} from 'lucide-react'
import { fetchTradeShare } from '../../lib/tradeShare'
import { tradeThemeCssVars, isGlassTheme, isClayTheme } from '../../theme/tradeAnalysisThemes'
import { splitTradesByCurrency, formatSignedAmount, CURRENCY_GROUP_LABEL } from '../../utils/currency'
import ViewerTradeCard from './ViewerTradeCard'
import ShareAnalysisWidgets from './ShareAnalysisWidgets'
import ImageLightbox from '../common/ImageLightbox'

// Each error carries its own icon, accent color and a short human hint —
// drives both the copy and the "aurora" backdrop (--ts-accent) in the
// error screen below. Kept separate from the old flat message strings so
// the visuals and the copy can't drift out of sync.
const ERROR_CONFIG = {
  ended: {
    icon: Link2Off,
    accent: '#eb5e28',
    title: 'This link was closed',
    message: 'The owner turned this share link off.',
    hint: 'Ask them to send a fresh link if you still need to see these trades.',
  },
  expired: {
    icon: Clock,
    accent: '#e8871e',
    title: 'This link has expired',
    message: 'Its viewing window has run out.',
    hint: 'Share links auto-expire on a timer the owner set when they made it.',
  },
  'not-found': {
    icon: SearchX,
    accent: '#dc2626',
    title: "This link isn't valid",
    message: 'It looks broken, mistyped, or the trades it pointed to are gone.',
    hint: 'Double-check the link, or ask the owner to re-share it.',
  },
  'not-configured': {
    icon: ServerCog,
    accent: '#6b7280',
    title: "Can't open this link yet",
    message: 'Shared trades aren\u2019t wired up on this deployment.',
    hint: 'The site owner needs to finish the Supabase setup for sharing to work.',
  },
}
const FALLBACK_ERROR = {
  icon: AlertTriangle,
  accent: '#dc2626',
  title: 'This link looks broken',
  message: 'It may be out of date or no longer exists.',
  hint: 'Try again, or ask the owner for a new link.',
}

// Section — Trade Analysis share-link routing. Rendered by main.jsx instead
// of <App/> for a `?tradeShare=<id>` URL (see the mind map's own `?live=`
// route in main.jsx, which this deliberately mirrors). Unlike that route,
// this shows ONLY the filtered trades the owner picked when they hit
// Share — as a vertically-stacked, read-only card list anyone with the
// link can scroll through and open images on, in whatever color theme the
// owner had selected. No top toolbar, no form, no table — nothing a
// visitor could edit.
export default function TradeShareView({ shareId }) {
  const [state, setState] = useState({ status: 'loading', data: null, error: null })
  const [refreshing, setRefreshing] = useState(false)
  // 'cards' — the original read-only trade-card grid. 'analysis' — a
  // storeless widgets dashboard (equity curve, win rate, P&L breakdowns,
  // best/worst trades) computed straight from these same trades. See
  // ShareAnalysisWidgets.jsx for why this can't just reuse the editor's
  // own Analysis tab.
  const [view, setView] = useState('cards')

  const load = useCallback(async () => {
    const result = await fetchTradeShare(shareId)
    if (result.error) setState({ status: 'error', data: null, error: result.error })
    else setState({ status: 'ready', data: result.data, error: null })
  }, [shareId])

  useEffect(() => {
    load()
  }, [load])

  const handleRefresh = async () => {
    if (refreshing) return
    setRefreshing(true)
    await load()
    setTimeout(() => setRefreshing(false), 400)
  }

  const handleRetry = async () => {
    if (refreshing) return
    setRefreshing(true)
    setState({ status: 'loading', data: null, error: null })
    await load()
    setRefreshing(false)
  }

  // Derived unconditionally (with safe fallbacks) so this stays before the
  // loading/error early-returns below and never breaks hook order.
  const trades = state.data?.trades || []
  const validationRules = state.data?.validation_rules || []

  const stats = useMemo(() => {
    const total = trades.length
    const buy = trades.filter((t) => t.direction === 'Buy').length
    const sell = trades.filter((t) => t.direction === 'Sell').length
    const decided = trades.filter((t) => t.status === 'Target Hit' || t.status === 'SL Hit')
    const wins = trades.filter((t) => t.status === 'Target Hit').length
    const winRate = decided.length ? Math.round((wins / decided.length) * 100) : null

    // P&L must never be summed across currencies (₹ Equity vs $ Forex/
    // Commodity) — see utils/currency.js's splitTradesByCurrency — so this
    // produces one total per currency group that actually has trades.
    const { INR, USD } = splitTradesByCurrency(trades)
    const pnlTotal = (group) => {
      const withPnl = group.filter((t) => t.pnl != null && !Number.isNaN(Number(t.pnl)))
      if (withPnl.length === 0) return null
      return withPnl.reduce((sum, t) => sum + Number(t.pnl), 0)
    }
    const pnlGroups = [
      { currency: 'INR', total: pnlTotal(INR), sampleType: INR[0]?.instrumentType },
      { currency: 'USD', total: pnlTotal(USD), sampleType: USD[0]?.instrumentType },
    ].filter((g) => g.total !== null)

    return { total, buy, sell, winRate, pnlGroups }
  }, [trades])

  if (state.status === 'loading') {
    return (
      <div className="relative flex h-screen w-screen items-center justify-center overflow-hidden" style={{ '--ts-accent': '#eb5e28' }}>
        <div className="ts-aurora-bg" />
        <span className="ts-mote" /><span className="ts-mote" /><span className="ts-mote" />
        <span className="ts-mote" /><span className="ts-mote" /><span className="ts-mote" /><span className="ts-mote" />

        <div className="ts-card-in relative z-10 flex w-[min(360px,88vw)] flex-col items-center gap-5 rounded-3xl border border-black/5 bg-white/80 px-8 py-10 text-center shadow-[0_24px_60px_-20px_rgba(0,0,0,0.25)] backdrop-blur-xl">
          <div className="relative flex h-16 w-16 items-center justify-center">
            <span className="ts-ring" /><span className="ts-ring" /><span className="ts-ring" />
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2.6, repeat: Infinity, ease: 'linear' }}
              className="flex h-12 w-12 items-center justify-center rounded-full shadow-lg"
              style={{ background: 'linear-gradient(135deg, var(--ts-accent), color-mix(in srgb, var(--ts-accent) 60%, #fff 40%))' }}
            >
              <TrendingUp size={20} className="text-white" strokeWidth={2.4} />
            </motion.div>
          </div>

          <div className="flex flex-col gap-1">
            <p className="text-[14px] font-bold text-[#242423]">
              Loading shared trades
              <span className="ts-dot">.</span><span className="ts-dot">.</span><span className="ts-dot">.</span>
            </p>
            <p className="text-[11px] text-[#6b6a67]">Fetching the trades the owner shared with you</p>
          </div>

          <div className="ts-shimmer-track h-1.5 w-full rounded-full" />
        </div>
      </div>
    )
  }

  if (state.status === 'error') {
    const cfg = ERROR_CONFIG[state.error] || FALLBACK_ERROR
    const Icon = cfg.icon
    return (
      <div className="relative flex h-screen w-screen items-center justify-center overflow-hidden px-6" style={{ '--ts-accent': cfg.accent }}>
        <div className="ts-aurora-bg" />
        <span className="ts-mote" /><span className="ts-mote" /><span className="ts-mote" />
        <span className="ts-mote" /><span className="ts-mote" /><span className="ts-mote" /><span className="ts-mote" />

        <div className="ts-card-in relative z-10 flex w-[min(420px,92vw)] flex-col items-center gap-5 rounded-3xl border border-black/5 bg-white/85 px-8 py-10 text-center shadow-[0_28px_70px_-22px_rgba(0,0,0,0.3)] backdrop-blur-xl">
          <motion.div
            className="relative flex h-16 w-16 items-center justify-center"
            initial={{ rotate: -8, scale: 0.7 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.1 }}
          >
            <span className="ts-ring" /><span className="ts-ring" />
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full shadow-lg"
              style={{ background: 'linear-gradient(135deg, var(--ts-accent), color-mix(in srgb, var(--ts-accent) 55%, #fff 45%))' }}
            >
              <Icon size={24} className="text-white" strokeWidth={2.2} />
            </div>
          </motion.div>

          <motion.div
            className="flex flex-col gap-1.5"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.35 }}
          >
            <h1 className="text-[16px] font-extrabold text-[#242423]">{cfg.title}</h1>
            <p className="text-[12.5px] font-medium text-[#4b4a47]">{cfg.message}</p>
          </motion.div>

          <motion.p
            className="rounded-xl px-3 py-2 text-[11px] leading-relaxed text-[#6b6a67]"
            style={{ backgroundColor: 'color-mix(in srgb, var(--ts-accent) 8%, transparent)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.32, duration: 0.35 }}
          >
            {cfg.hint}
          </motion.p>

          <motion.button
            onClick={handleRetry}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.42, duration: 0.3 }}
            className="flex items-center gap-1.5 rounded-full px-4 py-2 text-[11px] font-bold text-white shadow-md"
            style={{ background: 'var(--ts-accent)' }}
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            Try again
          </motion.button>

          <motion.div
            className="flex items-center gap-1 text-[10px] font-medium text-[#a3a29e]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.55, duration: 0.4 }}
          >
            <Sparkles size={10} />
            <span>Mind Map · Trade Analysis</span>
          </motion.div>
        </div>
      </div>
    )
  }

  const { theme_name: theme, expires_at: expiresAt } = state.data
  const themeName = theme || 'classic'
  const isGlass = isGlassTheme(themeName)
  const isClay = isClayTheme(themeName)

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="ready"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        data-ta-theme={themeName}
        className={`min-h-screen w-screen ${isGlass ? 'ta-liquid-bg' : isClay ? 'ta-clay-bg' : ''}`}
        style={isGlass || isClay ? { ...tradeThemeCssVars(themeName) } : { backgroundColor: '#ffffff', ...tradeThemeCssVars(themeName) }}
      >
        {/* Top bar — mirrors the editor's own top bar closely enough to
            read as "the same product", but strips every interactive control
            down to just a refresh button. */}
        <motion.div
          initial={{ y: -16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="sticky top-0 z-20 flex h-10 shrink-0 items-center gap-2 border-b px-3"
          style={{ backgroundColor: 'var(--ta-surface)', borderColor: 'var(--ta-slate)' }}
        >
          <motion.div
            animate={{ rotate: [0, -6, 6, -3, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 4, ease: 'easeInOut' }}
          >
            <TrendingUp size={14} style={{ color: 'var(--ta-accent)' }} />
          </motion.div>
          <span className="text-[12px] font-semibold" style={{ color: 'var(--ta-ink)' }}>
            📊 Shared Trades
          </span>
          <motion.span
            key={trades.length}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 18 }}
            className="rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={{ backgroundColor: 'color-mix(in srgb, var(--ta-accent) 16%, transparent)', color: 'var(--ta-accent)' }}
          >
            {trades.length} trade{trades.length === 1 ? '' : 's'}
          </motion.span>
          {trades.length > 0 && (
            <div
              className="ml-auto flex items-center gap-0.5 rounded-full p-0.5"
              style={{ backgroundColor: 'var(--ta-bg)' }}
            >
              {[
                { id: 'cards', label: 'Cards', icon: LayoutGrid },
                { id: 'analysis', label: 'Analysis', icon: BarChart3 },
              ].map((tab) => {
                const active = view === tab.id
                return (
                  <motion.button
                    key={tab.id}
                    onClick={() => setView(tab.id)}
                    whileTap={{ scale: 0.94 }}
                    className="relative flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold"
                    style={{ color: active ? '#fffcf2' : 'var(--ta-ink)' }}
                  >
                    {active && (
                      <motion.span
                        layoutId="ts-view-pill"
                        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                        className="absolute inset-0 rounded-full"
                        style={{ backgroundColor: 'var(--ta-accent)' }}
                      />
                    )}
                    <tab.icon size={10} className="relative" />
                    <span className="relative">{tab.label}</span>
                  </motion.button>
                )
              })}
            </div>
          )}
          <span className={trades.length > 0 ? 'text-[10px]' : 'ml-auto text-[10px]'} style={{ color: 'var(--ta-slate)' }}>
            {expiresAt ? `Expires ${new Date(expiresAt).toLocaleDateString()}` : 'View only'}
          </span>
          <motion.button
            onClick={handleRefresh}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.94 }}
            title="Refresh to see the latest"
            className="flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium"
            style={{ backgroundColor: 'var(--ta-bg)', color: 'var(--ta-ink)' }}
          >
            <RefreshCw size={10} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </motion.button>
        </motion.div>

        {/* Stats strip — the at-a-glance numbers a visitor actually cares
            about (how many, which side, how it went), computed client-side
            from the same trades the cards below render. Wraps to its own
            row(s) on narrow screens instead of squeezing into the 40px top
            bar; fills out on wide screens instead of leaving dead air
            beside a narrow card column. */}
        {trades.length > 0 && (
          <div
            className="flex flex-wrap items-stretch justify-center gap-2 border-b px-3 py-2.5"
            style={{ borderColor: 'var(--ta-slate)', backgroundColor: 'color-mix(in srgb, var(--ta-bg) 55%, transparent)' }}
          >
            {[
              { emoji: '📊', label: 'Total Trades', value: stats.total, color: 'var(--ta-accent)' },
              { emoji: '🟢', label: 'Buy Side', value: stats.buy, color: '#16a34a' },
              { emoji: '🔴', label: 'Sell Side', value: stats.sell, color: '#dc2626' },
              {
                emoji: '🎯',
                label: 'Win Rate',
                value: stats.winRate === null ? '—' : `${stats.winRate}%`,
                color: stats.winRate === null ? 'var(--ta-slate)' : stats.winRate >= 50 ? '#16a34a' : '#dc2626',
              },
              ...(stats.pnlGroups.length > 0
                ? stats.pnlGroups.map((g) => ({
                    emoji: '💰',
                    label: stats.pnlGroups.length > 1 ? `P&L · ${CURRENCY_GROUP_LABEL[g.currency]}` : 'P&L',
                    value: formatSignedAmount(g.total, g.sampleType),
                    color: g.total > 0 ? '#16a34a' : g.total < 0 ? '#dc2626' : 'var(--ta-ink)',
                  }))
                : [{ emoji: '💰', label: 'P&L', value: 'No P&L logged', color: 'var(--ta-slate)' }]),
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 10, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                whileHover={{ y: -2 }}
                transition={{ delay: 0.08 + i * 0.05, duration: 0.28, ease: 'easeOut' }}
                className="ta-card-glow flex min-w-[104px] flex-1 flex-col items-center gap-0.5 rounded-xl border px-3 py-2 sm:flex-none"
                style={{ backgroundColor: 'var(--ta-surface)', borderColor: 'var(--ta-slate)' }}
              >
                <span className="text-base leading-none">{stat.emoji}</span>
                <span className="text-[13px] font-extrabold leading-tight" style={{ color: stat.color }}>
                  {stat.value}
                </span>
                <span
                  className="text-center text-[8.5px] font-semibold uppercase leading-tight tracking-wide"
                  style={{ color: 'var(--ta-slate)' }}
                >
                  {stat.label}
                </span>
              </motion.div>
            ))}
          </div>
        )}

        {/* Body — stacked on phones, a filled-out multi-column grid on
            wider screens so the layout doesn't leave two dead margins
            beside one narrow card column. Swaps for the Analysis widgets
            dashboard when that tab is selected in the top bar. */}
        {view === 'analysis' && trades.length > 0 ? (
          <AnimatePresence mode="wait">
            <motion.div
              key="analysis"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <ShareAnalysisWidgets trades={trades} validationRules={validationRules} />
            </motion.div>
          </AnimatePresence>
        ) : (
        <div className="mx-auto grid w-full max-w-[1400px] grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {trades.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="col-span-full flex flex-col items-center gap-2 py-16 text-center"
            >
              <motion.span
                className="text-3xl"
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
              >
                📈
              </motion.span>
              <p className="text-xs font-semibold" style={{ color: 'var(--ta-ink)' }}>No trades in this link</p>
              <p className="max-w-[220px] text-[11px]" style={{ color: 'var(--ta-slate)' }}>
                The owner shared a filter that currently matches nothing.
              </p>
            </motion.div>
          ) : (
            trades
              .slice()
              .sort((a, b) => {
                if (a.date !== b.date) return a.date < b.date ? 1 : -1
                return (b.createdAt || 0) - (a.createdAt || 0)
              })
              .map((trade, idx) => (
                <ViewerTradeCard key={trade.id} trade={trade} validationRules={validationRules} idx={idx} />
              ))
          )}
        </div>
        )}

        <ImageLightbox />
      </motion.div>
    </AnimatePresence>
  )
}
