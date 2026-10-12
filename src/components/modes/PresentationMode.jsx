import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useMapStore } from '../../store/mapStore'
import { useUiStore } from '../../store/uiStore'

export default function PresentationMode({ order }) {
  const nodes = useMapStore((s) => s.nodes)
  const presentationIndex = useUiStore((s) => s.presentationIndex)
  const setPresentationIndex = useUiStore((s) => s.setPresentationIndex)
  const togglePresentationMode = useUiStore((s) => s.togglePresentationMode)

  if (order.length === 0) return null
  const currentId = order[presentationIndex % order.length]
  const currentNode = nodes.find((n) => n.id === currentId)

  const go = (delta) =>
    setPresentationIndex((presentationIndex + delta + order.length) % order.length)

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-3 rounded-full border px-4 py-2 shadow-lg"
        style={{ backgroundColor: 'var(--color-cream)', borderColor: 'var(--color-sage)' }}
      >
        <button onClick={() => go(-1)} className="rounded-full p-1 hover:bg-[var(--color-sage)]">
          <ChevronLeft size={14} />
        </button>
        <span className="min-w-[120px] truncate text-center text-xs font-medium" style={{ color: 'var(--color-ink)' }}>
          {currentNode?.data?.label || '—'}
        </span>
        <span className="text-[10px] text-[var(--color-slate)]">
          {(presentationIndex % order.length) + 1} / {order.length}
        </span>
        <button onClick={() => go(1)} className="rounded-full p-1 hover:bg-[var(--color-sage)]">
          <ChevronRight size={14} />
        </button>
        <button onClick={togglePresentationMode} className="ml-1 rounded-full p-1 hover:bg-[var(--color-sage)]" title="Exit presentation">
          <X size={14} />
        </button>
      </motion.div>
    </AnimatePresence>
  )
}
