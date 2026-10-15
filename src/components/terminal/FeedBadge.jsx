import { useQuote } from './hooks'
import { marketStatus, closedMessage } from '../../lib/terminal/feed/marketHours'

const LABEL = { live: 'Live', delayed: 'Delayed', offline: 'Offline', closed: 'Market closed', connecting: 'Connecting' }
const COLOR = { live: '#22c55e', delayed: '#f59e0b', offline: '#ef4444', closed: '#94a3b8', connecting: '#94a3b8' }
const SHAPE = { live: '●', delayed: '◐', offline: '✕', closed: '■', connecting: '○' } // not colour alone

// Connection state of the price feed for one symbol: Live / Delayed / Offline / Market closed (text + shape + colour).
export function feedStateOf(q, symbol) {
  if (q) return q.closed ? 'closed' : q.state || 'live'
  return marketStatus(symbol, Date.now()).open ? 'connecting' : 'closed'
}

export function FeedDot({ symbol }) {
  const q = useQuote(symbol)
  const st = feedStateOf(q, symbol)
  const title = st === 'closed' ? closedMessage(symbol, Date.now()) || 'Market closed' : q ? `Last price update ${new Date(q.time * 1000).toLocaleTimeString()} · ${q.source || 'live data'}` : 'Waiting for the first price'
  return <span className="flex items-center gap-1 font-normal" title={title} style={{ color: 'var(--tm-muted)' }}><span aria-hidden="true" style={{ color: COLOR[st] }}>{SHAPE[st]}</span>{LABEL[st]}</span>
}

export default function FeedBadge({ symbol }) {
  const q = useQuote(symbol)
  const st = feedStateOf(q, symbol)
  return (
    <span className="flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold" role="status" aria-live="polite" style={{ border: `1px solid ${COLOR[st]}`, color: COLOR[st] }}>
      <span aria-hidden="true">{SHAPE[st]}</span>{LABEL[st]}
    </span>
  )
}
