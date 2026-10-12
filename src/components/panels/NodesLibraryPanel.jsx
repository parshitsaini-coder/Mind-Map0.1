import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, LayoutTemplate, Rows3, Columns3, CircleDot, Grid3x3 } from 'lucide-react'
import { useUiStore } from '../../store/uiStore'
import { useMapStore } from '../../store/mapStore'
import { COLORS } from '../../theme/tokens'

const PALETTE = Object.values(COLORS)

const LAYOUT_OPTIONS = [
  { id: 'horizontal', label: 'Horizontal', icon: Rows3 },
  { id: 'vertical', label: 'Vertical', icon: Columns3 },
  { id: 'circular', label: 'Circular', icon: CircleDot },
  { id: 'grid', label: 'Grid', icon: Grid3x3 },
]

// Tiny dot diagram showing roughly how `count` nodes will be arranged for
// a given layout — pure decoration, but it's what turns "Horizontal" from
// a word into something the person can actually picture before they add
// anything to the map.
function LayoutPreviewDots({ layout, count, color }) {
  const n = Math.max(1, Math.min(12, count))
  const dots = Array.from({ length: n })
  const cols = Math.ceil(Math.sqrt(n))

  const style = (i) => {
    if (layout === 'vertical') return { left: '50%', top: `${8 + (i * 84) / Math.max(n - 1, 1)}%`, transform: 'translate(-50%,-50%)' }
    if (layout === 'circular') {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2
      const r = 34
      return { left: `${50 + r * Math.cos(angle)}%`, top: `${50 + r * Math.sin(angle)}%`, transform: 'translate(-50%,-50%)' }
    }
    if (layout === 'grid') {
      const row = Math.floor(i / cols)
      const col = i % cols
      const rows = Math.ceil(n / cols)
      return {
        left: `${10 + (col * 80) / Math.max(cols - 1, 1)}%`,
        top: `${20 + (row * 60) / Math.max(rows - 1, 1)}%`,
        transform: 'translate(-50%,-50%)',
      }
    }
    // horizontal
    return { left: `${8 + (i * 84) / Math.max(n - 1, 1)}%`, top: '50%', transform: 'translate(-50%,-50%)' }
  }

  return (
    <div className="relative h-20 w-full overflow-hidden rounded-lg border border-dashed border-[var(--color-sage)] bg-white/40">
      {dots.map((_, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.15, delay: i * 0.02 }}
          className="absolute h-3 w-3 rounded-full border border-black/10 shadow-sm"
          style={{ ...style(i), backgroundColor: color }}
        />
      ))}
    </div>
  )
}

export default function NodesLibraryPanel() {
  const open = useUiStore((s) => s.nodesLibraryOpen)
  const toggleNodesLibrary = useUiStore((s) => s.toggleNodesLibrary)
  const showToast = useUiStore((s) => s.showToast)
  const nodes = useMapStore((s) => s.nodes)
  const addNodeBatch = useMapStore((s) => s.addNodeBatch)

  const [layout, setLayout] = useState('horizontal')
  const [count, setCount] = useState(4)
  const [fontSize, setFontSize] = useState(12)
  const [bgColor, setBgColor] = useState('#e8eddf')
  const [textColor, setTextColor] = useState('#242423')

  if (!open) return null

  const selected = nodes.filter((n) => n.selected && n.type !== 'boundaryGroup')
  const targetNode = selected.length === 1 ? selected[0] : null

  const handleAdd = () => {
    if (!targetNode) return
    addNodeBatch(targetNode.id, { layout, count, fontSize, bgColor, textColor })
    showToast(`Added ${count} ${layout} nodes under "${targetNode.data?.label}"`)
    toggleNodesLibrary()
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/40 p-6"
        onClick={(e) => e.target === e.currentTarget && toggleNodesLibrary()}
      >
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          className="mt-8 w-full max-w-lg rounded-xl p-5 shadow-2xl"
          style={{ backgroundColor: '#f5f5f0' }}
        >
          <div className="mb-1 flex items-start justify-between">
            <div className="flex items-center gap-1.5">
              <LayoutTemplate size={16} color="var(--color-accent)" />
              <h2 className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
                Nodes Library
              </h2>
            </div>
            <button onClick={toggleNodesLibrary} className="rounded p-0.5 hover:bg-[var(--color-sage)]">
              <X size={15} />
            </button>
          </div>
          <p className="mb-3 text-[10.5px] text-[var(--color-slate)]">
            Pick a layout, then batch-add several styled child nodes under the selected node in one go.
          </p>

          {/* Section — which node this batch attaches to. Mirrors the
              Style Library's "select node(s) first" pattern, but this
              needs exactly one node since every new node becomes its
              child. */}
          <div
            className={`mb-3 rounded-md border px-2.5 py-1.5 text-[11px] ${
              targetNode ? 'border-[var(--color-sage)] text-[var(--color-ink)]' : 'border-dashed border-[var(--color-slate)] text-[var(--color-slate)]'
            }`}
          >
            {targetNode ? (
              <>
                Will attach under <strong>{targetNode.data?.label}</strong>
              </>
            ) : (
              'Select exactly one node on the canvas first — the new nodes attach as its children.'
            )}
          </div>

          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[var(--color-slate)]">Layout</p>
          <div className="mb-3 grid grid-cols-4 gap-1.5">
            {LAYOUT_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setLayout(opt.id)}
                className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-[10px] transition-colors ${
                  layout === opt.id
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/25'
                    : 'border-[var(--color-sage)] hover:bg-white/60'
                }`}
              >
                <opt.icon size={16} />
                {opt.label}
              </button>
            ))}
          </div>

          <div className="mb-3">
            <LayoutPreviewDots layout={layout} count={count} color={bgColor} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="col-span-2 flex flex-col gap-1 text-[10px] font-medium uppercase tracking-wide text-[var(--color-slate)]">
              Number of nodes — {count}
              <input
                type="range"
                min="1"
                max="12"
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="w-full accent-[var(--color-accent)]"
              />
            </label>

            <label className="flex flex-col gap-1 text-[10px] font-medium uppercase tracking-wide text-[var(--color-slate)]">
              Text size — {fontSize}px
              <input
                type="range"
                min="9"
                max="24"
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="w-full accent-[var(--color-accent)]"
              />
            </label>

            <div className="flex flex-col gap-1 text-[10px] font-medium uppercase tracking-wide text-[var(--color-slate)]">
              Node background
              <div className="flex flex-wrap items-center gap-1">
                {PALETTE.map((c) => (
                  <button
                    key={c}
                    onClick={() => setBgColor(c)}
                    className={`h-5 w-5 rounded-full border ${bgColor === c ? 'ring-2 ring-[var(--color-accent)] ring-offset-1' : ''}`}
                    style={{ backgroundColor: c, borderColor: 'var(--color-slate)' }}
                  />
                ))}
                <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="h-5 w-5 cursor-pointer rounded-full" />
              </div>
            </div>

            <div className="flex flex-col gap-1 text-[10px] font-medium uppercase tracking-wide text-[var(--color-slate)]">
              Text color
              <div className="flex flex-wrap items-center gap-1">
                {['#242423', '#333533', '#ffffff', '#f5cb5c', '#4a6fa5'].map((c) => (
                  <button
                    key={c}
                    onClick={() => setTextColor(c)}
                    className={`h-5 w-5 rounded-full border ${textColor === c ? 'ring-2 ring-[var(--color-accent)] ring-offset-1' : ''}`}
                    style={{ backgroundColor: c, borderColor: 'var(--color-slate)' }}
                  />
                ))}
                <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="h-5 w-5 cursor-pointer rounded-full" />
              </div>
            </div>
          </div>

          <button
            onClick={handleAdd}
            disabled={!targetNode}
            className={`mt-4 w-full rounded-md py-2 text-[12px] font-semibold transition-colors ${
              targetNode ? 'text-[var(--color-ink)] hover:opacity-90' : 'cursor-not-allowed opacity-40 text-[var(--color-slate)]'
            }`}
            style={{ backgroundColor: targetNode ? 'var(--color-accent)' : 'var(--color-sage)' }}
          >
            Add {count} nodes
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
