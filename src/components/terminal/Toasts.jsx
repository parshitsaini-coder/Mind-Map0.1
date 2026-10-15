import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, TrendingDown, AlertTriangle, Info, Target, Zap, Pencil, X, Repeat2 } from 'lucide-react'
import { useTerminalStore } from '../../store/terminalStore'
import { useMotion } from './motionHooks'

const COLORS = { info: 'var(--tm-border2)', win: '#166534', loss: '#991b1b', error: '#b45309' }
const ICONS = {
  'order.pending.placed': Target, 'order.pending.triggered': Zap, 'order.modified': Pencil, 'order.cancelled': X, 'order.rejected': AlertTriangle,
  'position.reversed': Repeat2, 'position.sl.hit': TrendingDown, 'position.tp.hit': CheckCircle2, 'account.stopout': AlertTriangle, 'account.margin.warning': AlertTriangle,
}
const KIND_ICON = { win: CheckCircle2, loss: TrendingDown, error: AlertTriangle, info: Info }

function Toast({ n, mo }) {
  const secs = useTerminalStore((s) => s.chartSettings.alerts.toastSeconds)
  const total = Math.round(secs * 1000)
  const left = useRef(total)
  const started = useRef(0)
  const timer = useRef(null)
  const bar = useRef(null)
  const dismiss = () => useTerminalStore.getState().dismissNotice(n.id)
  const run = () => { started.current = performance.now(); timer.current = setTimeout(dismiss, left.current); if (bar.current) bar.current.style.animationPlayState = 'running' }
  const pause = () => { clearTimeout(timer.current); left.current -= performance.now() - started.current; if (bar.current) bar.current.style.animationPlayState = 'paused' }
  useEffect(() => { run(); return () => clearTimeout(timer.current) }, [n.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const Icon = ICONS[n.eventId] || KIND_ICON[n.kind] || Info
  return (
    <motion.div layout={mo.full ? 'position' : false} role="status" data-testid="toast" data-kind={n.kind} data-event={n.eventId || ''}
      initial={mo.full ? { opacity: 0, y: -18, scale: 0.94 } : { opacity: 0 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={mo.off ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, x: 40, transition: { duration: mo.full ? 0.18 : mo.fadeMs / 1000 } }}
      transition={mo.full ? { type: 'spring', stiffness: 480, damping: 32 } : { duration: mo.off ? 0 : mo.fadeMs / 1000 }}
      drag={mo.off ? false : 'x'} dragConstraints={{ left: 0, right: 0 }} dragElastic={0.6}
      onDragEnd={(_, i) => { if (Math.abs(i.offset.x) > 60 || Math.abs(i.velocity.x) > 500) dismiss() }}
      onMouseEnter={pause} onMouseLeave={run}
      className="pointer-events-auto relative overflow-hidden rounded-lg text-[12px] font-semibold text-white shadow-lg" style={{ backgroundColor: COLORS[n.kind] || COLORS.info, touchAction: 'pan-y' }}>
      <div className="flex items-center gap-2 px-3 py-2">
        <Icon size={15} className="shrink-0 opacity-90" aria-hidden />
        <button type="button" onClick={dismiss} className="min-w-0 flex-1 text-left" aria-label={`Dismiss: ${n.text}`}>{n.text}</button>
        {n.action && (
          <button type="button" onClick={() => { n.action.run(); dismiss() }} className="h-8 shrink-0 rounded bg-white/20 px-3 text-[11px] font-bold hover:bg-white/30">{n.action.label}</button>
        )}
      </div>
      {!mo.off && <div ref={bar} aria-hidden className="h-[2px] origin-left bg-white/45" style={{ animation: `tm-shrink ${total}ms linear forwards` }} />}
    </motion.div>
  )
}

export default function Toasts() {
  const notices = useTerminalStore((s) => s.notices)
  const popupShown = useTerminalStore((s) => !!s.popup && s.chartSettings.anim.popupPos === 'top')
  const mo = useMotion()
  return (
    <div role="region" aria-label="Notifications" aria-live="polite" className={`pointer-events-none absolute left-1/2 z-40 flex w-[min(92vw,380px)] -translate-x-1/2 flex-col gap-2 ${popupShown ? 'top-[9.5rem] md:top-[12rem]' : 'top-12 md:top-24'}`}>
      <AnimatePresence initial={false}>
        {notices.map((n) => <Toast key={n.id} n={n} mo={mo} />)}
      </AnimatePresence>
    </div>
  )
}
