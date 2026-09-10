import { useCallback, useEffect, useState } from 'react'
import { fetchLiveShare } from '../../lib/liveShare'
import SharedMapView from './SharedMapView'

// How often an open live-link tab re-fetches on its own, so it feels
// "live" even without the visitor manually refreshing. A refresh always
// re-fetches too, since this component re-runs its effect on mount either
// way.
const POLL_INTERVAL_MS = 15000

const ERROR_MESSAGES = {
  ended: 'This live link was ended by its owner.',
  expired: 'This live link has expired.',
  'not-found': 'This live link looks broken or no longer exists.',
  'not-configured': 'This live link can\u2019t be opened right now.',
}

// Section — live-link routing. Rendered by main.jsx instead of <App/> for a
// `?live=<id>` URL (see the `?map=` one-time link above it in main.jsx).
// Unlike that one, the map data isn't in the URL at all — it's fetched from
// Supabase by id, and re-fetched periodically, so the owner's later edits
// show up here without the link itself ever changing.
export default function LiveMapView({ shareId }) {
  const [state, setState] = useState({ status: 'loading', data: null, error: null })

  const load = useCallback(async () => {
    const result = await fetchLiveShare(shareId)
    if (result.error) setState({ status: 'error', data: null, error: result.error })
    else setState({ status: 'ready', data: result.data, error: null })
  }, [shareId])

  useEffect(() => {
    load()
    const interval = setInterval(load, POLL_INTERVAL_MS)
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
    }
  }, [load])

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
      <div
        className="pointer-events-none fixed bottom-3 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1 text-[10px] font-medium shadow"
        style={{ backgroundColor: 'var(--color-ink)', color: 'var(--color-cream)' }}
      >
        ● Live — updates automatically
      </div>
    </>
  )
}
