import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, X } from 'lucide-react'
import { useTerminalStore } from '../../store/terminalStore'
import { useMotion } from './motionHooks'

// Full-width banner shown after a stop-out until the person dismisses it.
export default function StopoutBanner() {
  const b = useTerminalStore((s) => s.banner)
  const mo = useMotion()
  return (
    <AnimatePresence>
      {b && (
        <motion.div role="alert" data-testid="stopout-banner" initial={{ opacity: 0, y: mo.full ? -30 : 0 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: mo.off ? 0 : mo.full ? 0.25 : mo.fadeMs / 1000 }}
          className="absolute inset-x-0 top-0 z-[55] flex items-center gap-2 bg-red-700 px-3 py-2 text-[12px] font-bold text-white shadow-lg">
          <AlertTriangle size={16} aria-hidden />
          <span className="min-w-0 flex-1 truncate">STOP-OUT — {b.text}</span>
          <button type="button" aria-label="Dismiss stop-out banner" data-testid="stopout-dismiss" onClick={() => useTerminalStore.getState().dismissBanner()} className="tm-tap rounded p-1 hover:bg-white/20"><X size={14} /></button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
