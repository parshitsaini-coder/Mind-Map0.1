import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Search, TrendingUp, ArrowUpRight } from 'lucide-react'
import { useUiStore } from '../../store/uiStore'
import { useMapStore } from '../../store/mapStore'
import { useTradeAnalysisStore } from '../../store/tradeAnalysisStore'

const TYPE_BADGE_STYLE = {
  Equity: { bg: 'rgba(235,94,40,0.18)', text: '#c1450f' },
  Forex: { bg: 'rgba(37,99,235,0.16)', text: '#1d4ed8' },
  Commodity: { bg: 'rgba(217,119,6,0.18)', text: '#b45309' },
}

// Right-click a node → "Add trade" opens this. It lists every trade already
// logged in Trade Analysis so one can be attached to that node without
// leaving the mind map; picking one just stamps `linkedTradeId` onto the
// node's data (CustomNode.jsx then shows the pair as a small badge, and
// TradeDetailModal is the read-only popup that badge opens). Deliberately
// uses the mind map's --color-* palette rather than Trade Analysis's own
// --ta-* theme, since it's opened over the canvas, not over that overlay.
export default function TradeLinkPickerModal() {
  const nodeId = useUiStore((s) => s.tradeLinkPickerNodeId)
  const close = useUiStore((s) => s.closeTradeLinkPicker)
  const node = useMapStore((s) => (nodeId ? s.nodes.find((n) => n.id === nodeId) : null))
  const updateNodeData = useMapStore((s) => s.updateNodeData)
  const trades = useTradeAnalysisStore((s) => s.trades)
  const [query, setQuery] = useState('')

  const open = Boolean(nodeId && node)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const sorted = [...trades].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    if (!q) return sorted
    return sorted.filter(
      (t) =>
        t.pair?.toLowerCase().includes(q) ||
        t.instrumentName?.toLowerCase().includes(q) ||
        t.name?.toLowerCase().includes(q)
    )
  }, [trades, query])

  const handleClose = () => {
    close()
    setQuery('')
  }

  const pick = (tradeId) => {
    if (nodeId) updateNodeData(nodeId, { linkedTradeId: tradeId })
    handleClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
        >
          <motion.div
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-lg border shadow-2xl"
            style={{ backgroundColor: 'var(--color-cream)', borderColor: 'var(--color-sage)' }}
          >
            <div
              className="flex shrink-0 items-center justify-between border-b px-3 py-2"
              style={{ borderColor: 'var(--color-sage)' }}
            >
              <div>
                <p className="text-xs font-semibold text-[var(--color-ink)]">Link a trade</p>
                <p className="truncate text-[10px] text-[var(--color-slate)]">
                  to "{node?.data?.label || 'this node'}"
                </p>
              </div>
              <button
                onClick={handleClose}
                className="rounded-full p-1 text-[var(--color-slate)] hover:bg-[var(--color-sage)]/60 hover:text-[var(--color-ink)]"
                aria-label="Close"
              >
                <X size={14} />
              </button>
            </div>

            <div className="shrink-0 border-b px-3 py-2" style={{ borderColor: 'var(--color-sage)' }}>
              <div
                className="flex items-center gap-1.5 rounded-md border px-2 py-1"
                style={{ borderColor: 'var(--color-sage)', backgroundColor: 'white' }}
              >
                <Search size={12} className="shrink-0 text-[var(--color-slate)]" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search stock / pair…"
                  className="w-full bg-transparent text-xs outline-none placeholder:text-[var(--color-slate)]"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {trades.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                  <TrendingUp size={22} className="text-[var(--color-slate)]" />
                  <p className="text-xs text-[var(--color-slate)]">
                    No trades logged yet. Add one in Trade Analysis first, then come back to link it here.
                  </p>
                  <button
                    onClick={() => {
                      handleClose()
                      useTradeAnalysisStore.getState().open()
                    }}
                    className="mt-1 flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-medium text-white"
                    style={{ backgroundColor: 'var(--color-accent)' }}
                  >
                    Open Trade Analysis <ArrowUpRight size={12} />
                  </button>
                </div>
              ) : filtered.length === 0 ? (
                <p className="px-2 py-6 text-center text-xs text-[var(--color-slate)]">
                  No trades match "{query}".
                </p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {filtered.map((t) => {
                    const badge = TYPE_BADGE_STYLE[t.instrumentType]
                    const isCurrent = node?.data?.linkedTradeId === t.id
                    return (
                      <li key={t.id}>
                        <button
                          onClick={() => pick(t.id)}
                          disabled={isCurrent}
                          className={`flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left transition-colors ${
                            isCurrent ? 'cursor-default' : 'hover:bg-[var(--color-sage)]/40'
                          }`}
                          style={{
                            borderColor: isCurrent ? 'var(--color-accent)' : 'var(--color-sage)',
                            backgroundColor: isCurrent ? 'var(--color-sage)/30' : 'transparent',
                          }}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-xs font-medium text-[var(--color-ink)]">{t.pair}</span>
                              {badge && (
                                <span
                                  className="shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-semibold"
                                  style={{ backgroundColor: badge.bg, color: badge.text }}
                                >
                                  {t.instrumentType}
                                </span>
                              )}
                              <span
                                className="shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-semibold text-white"
                                style={{ backgroundColor: t.direction === 'Buy' ? '#16a34a' : '#dc2626' }}
                              >
                                {t.direction}
                              </span>
                            </div>
                            <p className="truncate text-[10px] text-[var(--color-slate)]">
                              {t.date} · {t.timeframe}
                              {t.instrumentName && t.instrumentName !== t.pair ? ` · ${t.instrumentName}` : ''}
                            </p>
                          </div>
                          <span
                            className="shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold"
                            style={{
                              backgroundColor: isCurrent ? 'transparent' : 'var(--color-accent)',
                              color: isCurrent ? 'var(--color-slate)' : 'white',
                            }}
                          >
                            {isCurrent ? 'Linked' : 'Add'}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
