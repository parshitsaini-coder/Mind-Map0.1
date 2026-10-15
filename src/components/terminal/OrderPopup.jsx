import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Target, Zap, Pencil, X, AlertTriangle, TrendingDown, Minus, Repeat2 } from 'lucide-react'
import { useTerminalStore } from '../../store/terminalStore'
import { money, fmtPrice } from '../../lib/terminal/popupModel'
import { useMotion, useCountUp } from './motionHooks'

const TONE = { buy: '#15803d', sell: '#b91c1c', win: '#15803d', loss: '#7f1d1d', error: '#b45309', neutral: '#475569', info: '#1d4ed8' }
const ICON = { target: Target, bolt: Zap, pencil: Pencil, x: X, alert: AlertTriangle, down: TrendingDown, dash: Minus, flip: Repeat2 }

// the circle draws itself, then the tick strokes in
function DrawnCheck({ animate }) {
  const d = (delay, dur) => (animate ? { duration: dur, delay, ease: 'easeOut' } : { duration: 0 })
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true">
      <motion.circle cx="17" cy="17" r="14" stroke="#fff" strokeWidth="2.4" initial={{ pathLength: animate ? 0 : 1 }} animate={{ pathLength: 1 }} transition={d(0, 0.28)} />
      <motion.path d="M10.5 17.5l4.6 4.6 8.4-9.4" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: animate ? 0 : 1 }} animate={{ pathLength: 1 }} transition={d(0.22, 0.2)} />
    </svg>
  )
}

function Body({ m, mo }) {
  const ms = mo.full ? 650 : 0
  const pnl = useCountUp(m.count ? m.count.to : 0, m.count ? ms : 0)
  const roll = useCountUp(m.roll ? m.roll.to : 0, m.roll ? ms : 0, { from: m.roll ? m.roll.from : 0 })
  const Icon = ICON[m.icon]
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-[34px] w-[34px] shrink-0 items-center justify-center">
        {mo.full && <motion.span aria-hidden className="absolute inset-0 rounded-full bg-white/30" initial={{ scale: 0.6, opacity: 0.7 }} animate={{ scale: 2.2, opacity: 0 }} transition={{ duration: 0.7, ease: 'easeOut' }} />}
        {m.icon === 'check' ? <DrawnCheck animate={mo.full} /> : Icon ? <Icon size={26} color="#fff" strokeWidth={2.4} /> : null}
      </div>
      <div className="min-w-0 flex-1 leading-tight">
        <div data-testid="popup-title" className="text-[13px] font-extrabold tracking-wide text-white">{m.title}</div>
        {m.lines.map((l, i) => <div key={i} className="truncate text-[11px] font-semibold text-white/85">{l}</div>)}
        {m.roll && <div data-testid="popup-roll" className="text-[11px] font-bold tabular-nums text-white">{fmtPrice(m.roll.symbol, roll)}</div>}
        {m.count && <div data-testid="popup-pnl" className="text-[18px] font-extrabold tabular-nums text-white">{money(pnl)}</div>}
      </div>
    </div>
  )
}

export default function OrderPopup() {
  const popup = useTerminalStore((s) => s.popup)
  const pos = useTerminalStore((s) => s.chartSettings.anim.popupPos)
  const mo = useMotion()
  const dismiss = useTerminalStore.getState().dismissPopup
  useEffect(() => {
    if (!popup) return undefined
    const t = setTimeout(dismiss, mo.popupMs)
    return () => clearTimeout(t)
  }, [popup?.key, mo.popupMs]) // eslint-disable-line react-hooks/exhaustive-deps
  const bottom = pos === 'bottom'
  const y0 = bottom ? 24 : -24
  const enter = mo.full ? { opacity: 1, y: 0, scale: 1, x: popup?.shake ? [0, -9, 9, -6, 6, 0] : 0 } : { opacity: 1, y: 0, scale: 1, x: 0 }
  return (
    <div className={`pointer-events-none absolute left-1/2 z-[45] w-[min(92vw,340px)] -translate-x-1/2 ${bottom ? 'bottom-16' : 'top-14 md:top-20'}`}>
      <AnimatePresence mode="wait">
        {popup && (
          <motion.div key={popup.key} role="status" aria-live="polite" data-testid="order-popup" data-variant={popup.variant} data-id={popup.id}
            initial={mo.full ? { opacity: 0, y: y0, scale: 0.92 } : { opacity: 0 }}
            animate={enter}
            exit={{ opacity: 0, y: mo.full ? y0 / 2 : 0, transition: { duration: mo.full ? 0.16 : mo.fadeMs / 1000 } }}
            transition={mo.full ? { type: 'spring', stiffness: 520, damping: 30, mass: 0.7, x: { duration: 0.3 } } : { duration: mo.fadeMs / 1000 }}
            drag={mo.off ? false : 'y'} dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.5}
            onDragEnd={(_, i) => { if (Math.abs(i.offset.y) > 28) dismiss() }}
            onClick={dismiss}
            className="pointer-events-auto relative cursor-pointer rounded-xl px-3.5 py-3 shadow-2xl"
            style={{ backgroundColor: TONE[popup.tone] || TONE.info, touchAction: 'none' }}>
            <Body m={popup} mo={mo} />
            {mo.full && popup.sparkle && Array.from({ length: 8 }, (_, i) => (
              <motion.span key={i} aria-hidden className="absolute h-1.5 w-1.5 rounded-full bg-yellow-200" style={{ left: `${10 + i * 11}%`, top: 0 }}
                initial={{ opacity: 1, y: 0, scale: 1 }} animate={{ opacity: 0, y: -22 - (i % 3) * 8, scale: 0.4 }} transition={{ duration: 0.8, delay: 0.25 + i * 0.03 }} />
            ))}
            <button type="button" aria-label="Dismiss" onClick={(e) => { e.stopPropagation(); dismiss() }} className="absolute right-1.5 top-1.5 rounded p-1 text-white/70 hover:bg-white/15 hover:text-white"><X size={12} /></button>
            <div aria-hidden className="absolute bottom-0 left-0 h-[3px] rounded-b-xl bg-white/50" style={{ animation: `tm-shrink ${mo.popupMs}ms linear forwards`, width: '100%', transformOrigin: 'left' }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
