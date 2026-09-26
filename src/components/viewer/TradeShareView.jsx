import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, TrendingUp } from 'lucide-react'
import { fetchTradeShare } from '../../lib/tradeShare'
import { tradeThemeCssVars, isGlassTheme, isClayTheme } from '../../theme/tradeAnalysisThemes'
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

  const { trades = [], validation_rules: validationRules = [], theme_name: theme, expires_at: expiresAt } = state.data
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

      {/* Body — one column, vertically stacked cards, centered with a
          readable max-width regardless of viewport size. */}
      <div className="mx-auto flex w-full max-w-md flex-col gap-2.5 p-3">
        {trades.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
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
