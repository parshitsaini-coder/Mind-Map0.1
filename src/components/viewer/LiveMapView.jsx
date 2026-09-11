import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { fetchLiveShare } from '../../lib/liveShare'
import SharedMapView from './SharedMapView'

const ERROR_MESSAGES = {
  ended: 'This live link was ended by its owner.',
  expired: 'This live link has expired.',
  'not-found': 'This live link looks broken or no longer exists.',
  'not-configured': 'This live link can\u2019t be opened right now.',
}

// Section — live-link routing. Rendered by main.jsx instead of <App/> for a
// `?live=<id>` URL (see the `?map=` one-time link above it in main.jsx).
// Unlike that one, the map data isn't in the URL at all — it's fetched from
// Supabase by id. Unlike an earlier version of this component, it does NOT
// auto-poll in the background — the owner's later edits only show up when
// the visitor taps the refresh button (top-right), so the view never
// silently jumps to a different state mid-read.
export default function LiveMapView({ shareId }) {
  const [state, setState] = useState({ status: 'loading', data: null, error: null })
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    const result = await fetchLiveShare(shareId)
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
    // Keep the spin visible briefly even on a fast fetch, so the click
    // reads as "it did something" rather than an instant, easy-to-miss swap.
    setTimeout(() => setRefreshing(false), 400)
  }

  if (state.status === 'loading') {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#ecebe4] text-sm text-[#242423]">
        Loading live map…
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#ecebe4] px-6 text-center text-sm text-[#242423]">
        {ERROR_MESSAGES[state.error] || 'This live link looks broken or out of date.'}
      </div>
    )
  }

  const { nodes, edges, checklists, trades, validation_rules, theme_name } = state.data
  return (
    <>
      <SharedMapView
        nodes={nodes || []}
        edges={edges || []}
        checklists={checklists || []}
        trades={trades || []}
        validationRules={validation_rules || []}
        themeName={theme_name}
      />
      <button
        onClick={handleRefresh}
        title="Refresh to see the latest edits"
        className="fixed right-4 top-4 z-30 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium shadow transition-transform duration-100 hover:scale-105 active:scale-95"
        style={{ backgroundColor: 'var(--color-ink)', color: 'var(--color-cream)' }}
      >
        <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
        Refresh
      </button>
      <div
        className="pointer-events-none fixed bottom-3 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1 text-[10px] font-medium shadow"
        style={{ backgroundColor: 'var(--color-ink)', color: 'var(--color-cream)' }}
      >
        ● Live — tap Refresh for the latest
      </div>
    </>
  )
}
