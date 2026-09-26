import { motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, TrendingUp } from 'lucide-react'
import { fetchTradeShare } from '../../lib/tradeShare'
import { tradeThemeCssVars, isGlassTheme, isClayTheme } from '../../theme/tradeAnalysisThemes'
import { splitTradesByCurrency, formatSignedAmount, CURRENCY_GROUP_LABEL } from '../../utils/currency'
import ViewerTradeCard from './ViewerTradeCard'
import ImageLightbox from '../common/ImageLightbox'

const ERROR_MESSAGES = {
  ended: 'This share link was ended by its owner.',
  expired: 'This share link has expired.',
  'not-found': 'This share link looks broken or no longer exists.',
  'not-configured': 'This share link can\u2019t be opened right now.',
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
      <div className="flex h-screen w-screen items-center justify-center bg-[#ecebe4] text-sm text-[#242423]">
        Loading shared trades…
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#ecebe4] px-6 text-center text-sm text-[#242423]">
        {ERROR_MESSAGES[state.error] || 'This share link looks broken or out of date.'}
      </div>
    )
  }

  const { theme_name: theme, expires_at: expiresAt } = state.data
  const themeName = theme || 'classic'
  const isGlass = isGlassTheme(themeName)
  const isClay = isClayTheme(themeName)

  return (
    <div
      data-ta-theme={themeName}
      className={`min-h-screen w-screen ${isGlass ? 'ta-liquid-bg' : isClay ? 'ta-clay-bg' : ''}`}
      style={isGlass || isClay ? { ...tradeThemeCssVars(themeName) } : { backgroundColor: '#ffffff', ...tradeThemeCssVars(themeName) }}
    >
      {/* Top bar — mirrors the editor's own top bar closely enough to
          read as "the same product", but strips every interactive control
          down to just a refresh button. */}
      <div
        className="sticky top-0 z-20 flex h-10 shrink-0 items-center gap-2 border-b px-3"
        style={{ backgroundColor: 'var(--ta-surface)', borderColor: 'var(--ta-slate)' }}
      >
        <TrendingUp size={14} style={{ color: 'var(--ta-accent)' }} />
        <span className="text-[12px] font-semibold" style={{ color: 'var(--ta-ink)' }}>
          📊 Shared Trades
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-bold"
          style={{ backgroundColor: 'color-mix(in srgb, var(--ta-accent) 16%, transparent)', color: 'var(--ta-accent)' }}
        >
          {trades.length} trade{trades.length === 1 ? '' : 's'}
        </span>
        <span className="ml-auto text-[10px]" style={{ color: 'var(--ta-slate)' }}>
          {expiresAt ? `Expires ${new Date(expiresAt).toLocaleDateString()}` : 'View only'}
        </span>
        <button
          onClick={handleRefresh}
          title="Refresh to see the latest"
          className="flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium"
          style={{ backgroundColor: 'var(--ta-bg)', color: 'var(--ta-ink)' }}
        >
          <RefreshCw size={10} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

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
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.22 }}
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
          beside one narrow card column. */}
      <div className="mx-auto grid w-full max-w-[1400px] grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {trades.length === 0 ? (
          <div className="col-span-full flex flex-col items-center gap-2 py-16 text-center">
            <span className="text-3xl">📈</span>
            <p className="text-xs font-semibold" style={{ color: 'var(--ta-ink)' }}>No trades in this link</p>
            <p className="max-w-[220px] text-[11px]" style={{ color: 'var(--ta-slate)' }}>
              The owner shared a filter that currently matches nothing.
            </p>
          </div>
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

      <ImageLightbox />
    </div>
  )
}
