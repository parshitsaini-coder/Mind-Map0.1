import { useRef, useState } from 'react'
import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { StickyNote, ListChecks } from 'lucide-react'
import { useUiStore } from '../../store/uiStore'
import { TYPE_BADGE_STYLE, TIMEFRAME_BADGE_STYLE, TIMEFRAME_DEFAULT_STYLE } from '../trade-analysis/TradesTable'
import { symbolForType } from '../../utils/currency'

const STATUS_STYLE = {
  Pending: { bg: 'rgba(235,94,40,0.14)', text: 'var(--ta-accent)' },
  'Target Hit': { bg: 'rgba(95,138,82,0.16)', text: '#4c6f42' },
  'SL Hit': { bg: 'rgba(179,80,58,0.16)', text: '#9c4a34' },
}

// Read-only counterpart to trade-analysis/TradeCards.jsx, used only by the
// share-link viewer (TradeShareView). Same badges/pills/P&L styling so a
// shared link reads as "the same product", just with every editing
// affordance (status dropdown, delete, +Add P&L, image upload, validation
// editor) removed — a visitor can look, and open a screenshot full-size,
// nothing else.
//
// The card also tilts toward the cursor and carries a soft light that
// tracks it (pure motion-values, no re-renders) — makes the read-only
// grid feel alive to point at instead of just a flat sheet of paper.
export default function ViewerTradeCard({ trade, validationRules, idx = 0 }) {
  const [notesExpanded, setNotesExpanded] = useState(false)
  const cardRef = useRef(null)

  // Raw 0..1 pointer position inside the card, eased through a spring so
  // the tilt/glow settle smoothly rather than snapping to the cursor.
  const px = useMotionValue(0.5)
  const py = useMotionValue(0.5)
  const springCfg = { stiffness: 340, damping: 24, mass: 0.5 }
  const sx = useSpring(px, springCfg)
  const sy = useSpring(py, springCfg)
  const rotateX = useTransform(sy, [0, 1], [7, -7])
  const rotateY = useTransform(sx, [0, 1], [-7, 7])
  const glowX = useTransform(sx, (v) => `${v * 100}%`)
  const glowY = useTransform(sy, (v) => `${v * 100}%`)
  const glowBackground = useMotionTemplate`radial-gradient(circle at ${glowX} ${glowY}, color-mix(in srgb, var(--ta-accent) 22%, transparent), transparent 55%)`

  const handlePointerMove = (e) => {
    const rect = cardRef.current?.getBoundingClientRect()
    if (!rect) return
    px.set((e.clientX - rect.left) / rect.width)
    py.set((e.clientY - rect.top) / rect.height)
  }
  const handlePointerLeave = () => {
    px.set(0.5)
    py.set(0.5)
  }

  const checkedRules = (trade.validationRuleIds || [])
    .map((id) => {
      const r = validationRules.find((vr) => vr.id === id)
      return r ? { id, label: r.label, color: r.color } : null
    })
    .filter(Boolean)

  const statusStyle = STATUS_STYLE[trade.status] || STATUS_STYLE.Pending

  return (
    <motion.div
      ref={cardRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={{ scale: 1.025, y: -5 }}
      whileTap={{ scale: 0.99 }}
      transition={{
        opacity: { delay: Math.min(idx, 14) * 0.022, duration: 0.16, ease: 'easeOut' },
        y: { type: 'spring', stiffness: 420, damping: 26, delay: Math.min(idx, 14) * 0.022 },
        scale: { type: 'spring', stiffness: 420, damping: 24 },
      }}
      style={{
        backgroundColor: 'var(--ta-surface)',
        borderColor: 'var(--ta-slate)',
        rotateX,
        rotateY,
        transformPerspective: 700,
      }}
      className="ta-card-glow group relative flex w-full flex-col gap-2 rounded-2xl border p-3"
    >
      {/* Cursor-tracking sheen — purely decorative, sits above the content
          but never intercepts clicks (pointer-events-none), and only
          shows once the pointer is actually over the card. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: glowBackground }}
      />
      {/* Header — pair/instrument + date */}
      <div className="relative flex items-start justify-between gap-1.5">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-bold" style={{ color: 'var(--ta-ink)' }}>{trade.pair}</p>
          {trade.instrumentName && trade.instrumentName !== trade.pair && (
            <p className="truncate text-[9px]" style={{ color: 'var(--ta-slate)' }}>{trade.instrumentName}</p>
          )}
        </div>
        <span
          className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold tracking-wide"
          style={{ backgroundColor: 'color-mix(in srgb, var(--ta-accent) 16%, transparent)', color: 'var(--ta-accent)' }}
        >
          {trade.date}
        </span>
      </div>

      {/* Badges row — type / timeframe / direction / price */}
      <div className="relative flex flex-wrap items-center gap-1">
        <span
          className="rounded-full px-1.5 py-0.5 text-[8px] font-semibold"
          style={{
            backgroundColor: (TYPE_BADGE_STYLE[trade.instrumentType] || TIMEFRAME_DEFAULT_STYLE).bg,
            color: (TYPE_BADGE_STYLE[trade.instrumentType] || TIMEFRAME_DEFAULT_STYLE).text,
          }}
        >
          {trade.instrumentType}
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-bold"
          style={{
            backgroundColor: (TIMEFRAME_BADGE_STYLE[trade.timeframe] || TIMEFRAME_DEFAULT_STYLE).bg,
            color: (TIMEFRAME_BADGE_STYLE[trade.timeframe] || TIMEFRAME_DEFAULT_STYLE).text,
          }}
        >
          {trade.timeframe}
        </span>
        <span
          className="rounded-full px-1.5 py-0.5 text-[8px] font-semibold text-white"
          style={{ backgroundColor: trade.direction === 'Buy' ? '#16a34a' : '#dc2626' }}
        >
          {trade.direction}
        </span>
        <span className="ml-auto text-[11px] font-bold" style={{ color: 'var(--ta-ink)' }}>
          {symbolForType(trade.instrumentType)}{trade.price}
        </span>
      </div>

      {/* P&L + Status — plain read-only pills, no dropdown/edit affordance */}
      <div className="relative flex items-center justify-between gap-1.5">
        <span
          className="rounded-full px-1.5 py-0.5 text-[8.5px] font-bold"
          style={
            trade.pnl == null
              ? { color: 'var(--ta-slate)', border: '1px dashed var(--ta-slate)' }
              : trade.pnl > 0
                ? { backgroundColor: 'rgba(22,163,74,0.14)', color: '#16a34a' }
                : trade.pnl < 0
                  ? { backgroundColor: 'rgba(220,38,38,0.14)', color: '#dc2626' }
                  : { backgroundColor: 'var(--ta-bg)', color: 'var(--ta-ink)' }
          }
        >
          {trade.pnl == null ? 'No P&L logged' : `${trade.pnl > 0 ? '+' : ''}${symbolForType(trade.instrumentType)}${trade.pnl}`}
        </span>
        <span className="rounded-full px-2 py-0.5 text-[9.5px] font-semibold" style={{ backgroundColor: statusStyle.bg, color: statusStyle.text }}>
          {trade.status}
        </span>
      </div>

      {/* Screenshot + Result images side by side — click opens the shared
          fullscreen lightbox, same as the editor. */}
      {(trade.screenshotUrl || trade.resultImageUrl) && (
        <div className="relative flex items-center gap-2">
          {trade.screenshotUrl && (
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[7px] font-semibold uppercase tracking-wide" style={{ color: 'var(--ta-slate)' }}>Setup</span>
              <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.95 }} onClick={() => useUiStore.getState().openImageLightbox(trade.screenshotUrl)} title="View screenshot">
                <img src={trade.screenshotUrl} alt="Screenshot" className="h-12 w-12 cursor-zoom-in rounded object-cover" />
              </motion.button>
            </div>
          )}
          {trade.resultImageUrl && (
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[7px] font-semibold uppercase tracking-wide" style={{ color: 'var(--ta-slate)' }}>Result</span>
              <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.95 }} onClick={() => useUiStore.getState().openImageLightbox(trade.resultImageUrl)} title="View result image">
                <img src={trade.resultImageUrl} alt="Result" className="h-12 w-12 cursor-zoom-in rounded object-cover" />
              </motion.button>
            </div>
          )}
          {trade.validationScore && (
            <span
              className="ml-auto shrink-0 self-start rounded-full px-1.5 py-0.5 text-[7.5px] font-semibold"
              style={{ backgroundColor: 'var(--ta-accent)', color: '#fffcf2' }}
            >
              {trade.validationScore.checked}/{trade.validationScore.total}
            </span>
          )}
        </div>
      )}

      {/* Validation badges */}
      {checkedRules.length > 0 && (
        <div className="relative flex flex-wrap items-center gap-1">
          <ListChecks size={10} className="shrink-0" style={{ color: 'var(--ta-slate)' }} />
          {checkedRules.slice(0, 10).map((rule) => (
            <span
              key={rule.id}
              className="truncate rounded-full px-1.5 py-0.5 text-[7.5px]"
              style={{ backgroundColor: rule.color || 'var(--ta-bg)', color: 'var(--ta-ink)', maxWidth: 110 }}
              title={rule.label}
            >
              {rule.label}
            </span>
          ))}
          {checkedRules.length > 10 && (
            <span
              className="shrink-0 rounded-full px-1.5 py-0.5 text-[7.5px] font-semibold"
              style={{ backgroundColor: 'var(--ta-bg)', color: 'var(--ta-slate)' }}
              title={checkedRules.slice(10).map((r) => r.label).join(', ')}
            >
              +{checkedRules.length - 10} more
            </span>
          )}
        </div>
      )}

      {/* Notes — collapsed to one line, expandable */}
      {trade.notes && (
        <button
          onClick={() => setNotesExpanded((v) => !v)}
          className={`relative flex items-start gap-1 rounded-lg px-1.5 py-1 text-left text-[9px] ${notesExpanded ? '' : 'truncate'}`}
          title={notesExpanded ? 'Click to collapse' : trade.notes}
          style={{ backgroundColor: 'var(--ta-bg)', color: 'var(--ta-ink)' }}
        >
          <StickyNote size={10} className="mt-0.5 shrink-0" style={{ color: 'var(--ta-slate)' }} />
          <span className={notesExpanded ? 'whitespace-pre-wrap break-words' : 'truncate'}>{trade.notes}</span>
        </button>
      )}
    </motion.div>
  )
}
