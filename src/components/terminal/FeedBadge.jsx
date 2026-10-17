import { useEffect, useState } from 'react'
import { useFeedStatus, feedStatusNow } from './hooks'
import { marketStatus } from '../../lib/terminal/marketHours'

const LOOK = {
  live: { text: 'Live', color: '#4ade80' },
  delayed: { text: 'Delayed', color: '#fbbf24' },
  offline: { text: 'Offline', color: '#f87171' },
  closed: { text: 'Market closed', color: '#94a3b8' },
  loading: { text: 'Connecting…', color: '#94a3b8' },
}
export const stateLook = (state) => LOOK[state] || LOOK.loading

// Connection badge: Live / Delayed / Offline / Market closed (+ tooltip with last update and reason).
export default function FeedBadge({ compact = false }) {
  const st = useFeedStatus()
  const [, tick] = useState(0)
  useEffect(() => { const iv = setInterval(() => tick((n) => n + 1), 15000); return () => clearInterval(iv) }, [])
  const now = feedStatusNow()
  const look = stateLook(st.state)
  const ago = now.lastUpdate ? Math.max(0, Math.round(Date.now() / 1000 - now.lastUpdate)) : null
  const tip = [
    `${look.text} · ${st.provider}`,
    ago != null ? `Last update ${ago < 90 ? `${ago}s` : `${Math.round(ago / 60)} min`} ago` : 'No price yet',
    st.state === 'closed' ? marketStatus().closedMessage : null,
    st.reason,
    'Prices are indicative, for practice only',
  ].filter(Boolean).join('\n')
  return (
    <span data-testid="feed-badge" data-state={st.state} title={tip} className="flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold" style={{ borderColor: look.color + '66', color: look.color }}>
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: look.color }} />
      {compact ? look.text.split(' ')[0] : look.text}
    </span>
  )
}

// Slim strip under the top rows while the market is closed.
export function MarketClosedStrip() {
  const st = useFeedStatus()
  const [, tick] = useState(0)
  useEffect(() => { const iv = setInterval(() => tick((n) => n + 1), 30000); return () => clearInterval(iv) }, [])
  if (st.state !== 'closed') return null
  return (
    <div data-testid="market-closed-strip" role="status" className="tm-mc flex shrink-0 items-center justify-center gap-2 border-b px-2 py-0.5 text-[10px] font-semibold" style={{ borderColor: 'var(--tm-border)', backgroundColor: 'rgba(148,163,184,0.12)', color: '#cbd5e1' }}>
      {marketStatus().closedMessage} · market orders are paused, pending orders stay active
    </div>
  )
}
