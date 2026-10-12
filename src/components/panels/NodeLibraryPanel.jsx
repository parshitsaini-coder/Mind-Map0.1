import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { LibraryBig, X, Minus, Plus } from 'lucide-react'
import { useUiStore } from '../../store/uiStore'
import { useMapStore, NODE_LIBRARY_LAYOUTS, computeNodeLibraryPositions } from '../../store/mapStore'
import { COLORS } from '../../theme/tokens'
import { MIN_FONT_SIZE, MAX_FONT_SIZE, DEFAULT_FONT_SIZE } from '../../utils/textStyle'

const BG_PRESETS = [...Object.values(COLORS), '#f6d55c', '#8fbcbb', '#e07a5f', '#a3c4bc']
const TEXT_PRESETS = ['var(--color-ink)', 'var(--color-slate)', 'var(--color-accent)', '#ffffff']

function ColorSwatch({ color, active, onClick, title }) {
  return (
    <button
      onClick={onClick}
      title={title || color}
      className={`h-5 w-5 shrink-0 rounded-full border ${active ? 'ring-2 ring-[var(--color-accent)] ring-offset-1' : ''}`}
      style={{ backgroundColor: color, borderColor: 'var(--color-slate)' }}
    />
  )
}

function CustomColorInput({ value, onChange, title }) {
  return (
    <label
      className="relative flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full"
      style={{
        background:
          'conic-gradient(from 0deg, var(--color-accent), #e57373, #ba68c8, #64b5f6, #81c784, var(--color-accent))',
      }}
      title={title || 'Custom color'}
    >
      <span className="pointer-events-none h-3 w-3 rounded-full border border-white/70" style={{ backgroundColor: value }} />
      <input type="color" value={value} onChange={onChange} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
    </label>
  )
}

// Small live SVG preview of each layout shape — a filled dot for the parent
// node and hollow dots for the N new nodes it would create, using the exact
// same position math (computeNodeLibraryPositions) as the real thing, just
// scaled down to fit a 96x64 thumbnail.
function LayoutPreview({ layoutId, count }) {
  const fakeParent = { position: { x: 0, y: 0 } }
  const positions = useMemo(() => computeNodeLibraryPositions(layoutId, Math.min(count, 8), fakeParent), [layoutId, count])
  const xs = positions.map((p) => p.x).concat(0)
  const ys = positions.map((p) => p.y).concat(0)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const pad = 14
  const w = Math.max(maxX - minX, 1)
  const h = Math.max(maxY - minY, 1)
  const scale = Math.min((96 - pad * 2) / w, (64 - pad * 2) / h, 1)
  const toX = (x) => (x - minX) * scale + pad
  const toY = (y) => (y - minY) * scale + pad

  return (
    <svg viewBox="0 0 96 64" className="h-16 w-24">
      {positions.map((p, i) => (
        <line key={i} x1={toX(0)} y1={toY(0)} x2={toX(p.x)} y2={toY(p.y)} stroke="var(--color-slate)" strokeWidth="1" strokeDasharray="2 2" opacity="0.6" />
      ))}
      <circle cx={toX(0)} cy={toY(0)} r="5" fill="var(--color-accent)" />
      {positions.map((p, i) => (
        <circle key={i} cx={toX(p.x)} cy={toY(p.y)} r="4" fill="var(--color-cream)" stroke="var(--color-slate)" strokeWidth="1.2" />
      ))}
    </svg>
  )
}

export default function NodeLibraryPanel() {
  const open = useUiStore((s) => s.nodeLibraryOpen)
  const toggleNodeLibrary = useUiStore((s) => s.toggleNodeLibrary)
  const showToast = useUiStore((s) => s.showToast)
  const nodes = useMapStore((s) => s.nodes)
  const addNodeLayoutBatch = useMapStore((s) => s.addNodeLayoutBatch)

  const [layout, setLayout] = useState('horizontal')
  const [count, setCount] = useState(4)
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE)
  const [color, setColor] = useState(COLORS.cream)
  const [textColor, setTextColor] = useState('var(--color-ink)')

  if (!open) return null

  const selectedNodes = nodes.filter((n) => n.selected && n.type !== 'boundaryGroup')
  const parent = selectedNodes.length === 1 ? selectedNodes[0] : null

  const handleAdd = () => {
    if (!parent) return
    addNodeLayoutBatch(parent.id, { layout, count, fontSize, color, textColor })
    showToast(`Added ${count} nodes (${NODE_LIBRARY_LAYOUTS.find((l) => l.id === layout)?.label}) under "${parent.data?.label || 'node'}"`)
    toggleNodeLibrary()
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/40 p-6"
        onClick={(e) => e.target === e.currentTarget && toggleNodeLibrary()}
      >
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          className="mt-8 w-full max-w-2xl rounded-xl p-5 shadow-2xl"
          style={{ backgroundColor: '#f5f5f0' }}
        >
          <div className="mb-1 flex items-start justify-between">
            <div className="flex items-center gap-1.5">
              <LibraryBig size={16} color="var(--color-accent)" />
              <h2 className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
                Node Library
              </h2>
            </div>
            <button onClick={toggleNodeLibrary} className="rounded p-0.5 hover:bg-[var(--color-sage)]">
              <X size={15} />
            </button>
          </div>
          <p className="mb-3 text-[10.5px] text-[var(--color-slate)]">
            Pick a layout, choose how many nodes and how they look, then add them all under{' '}
            {parent ? (
              <strong>"{parent.data?.label || parent.id}"</strong>
            ) : (
              <span className="text-[#c1443c]">a node you select first</span>
            )}
            .
          </p>

          {/* Layout templates */}
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {NODE_LIBRARY_LAYOUTS.map((l) => (
              <button
                key={l.id}
                onClick={() => setLayout(l.id)}
                className={`flex flex-col items-center gap-1 rounded-lg border p-2 transition-colors ${
                  layout === l.id
                    ? 'border-[var(--color-accent)] bg-white'
                    : 'border-transparent hover:border-[var(--color-sage)] hover:bg-white/60'
                }`}
              >
                <LayoutPreview layoutId={l.id} count={count} />
                <span className="text-[10.5px] font-medium" style={{ color: 'var(--color-ink)' }}>
                  {l.label}
                </span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Node count */}
            <div>
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[var(--color-slate)]">
                Number of nodes
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCount((c) => Math.max(1, c - 1))}
                  className="rounded p-1 hover:bg-[var(--color-sage)]"
                >
                  <Minus size={13} />
                </button>
                <input
                  type="number"
                  min={1}
                  max={24}
                  value={count}
                  onChange={(e) => setCount(Math.max(1, Math.min(24, Number(e.target.value) || 1)))}
                  className="w-12 rounded border border-[var(--color-sage)] bg-white px-1.5 py-0.5 text-center text-[11px]"
                />
                <button
                  onClick={() => setCount((c) => Math.min(24, c + 1))}
                  className="rounded p-1 hover:bg-[var(--color-sage)]"
                >
                  <Plus size={13} />
                </button>
                <span className="text-[10px] text-[var(--color-slate)]">(max 24)</span>
              </div>
            </div>

            {/* Text size */}
            <div>
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[var(--color-slate)]">
                Text size — {fontSize}px
              </p>
              <input
                type="range"
                min={MIN_FONT_SIZE}
                max={MAX_FONT_SIZE}
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="w-full accent-[var(--color-accent)]"
              />
            </div>

            {/* Background color */}
            <div>
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[var(--color-slate)]">
                Node background color
              </p>
              <div className="flex flex-wrap gap-1.5">
                {BG_PRESETS.map((c) => (
                  <ColorSwatch key={c} color={c} active={color === c} onClick={() => setColor(c)} />
                ))}
                <CustomColorInput value={color} onChange={(e) => setColor(e.target.value)} title="Custom background color" />
              </div>
            </div>

            {/* Text color */}
            <div>
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[var(--color-slate)]">
                Text color
              </p>
              <div className="flex flex-wrap gap-1.5">
                {TEXT_PRESETS.map((c) => (
                  <ColorSwatch key={c} color={c} active={textColor === c} onClick={() => setTextColor(c)} />
                ))}
                <CustomColorInput value={textColor} onChange={(e) => setTextColor(e.target.value)} title="Custom text color" />
              </div>
            </div>
          </div>

          {!parent && (
            <p className="mt-4 rounded-md bg-[#c1443c]/10 px-2.5 py-1.5 text-[10.5px] text-[#c1443c]">
              {selectedNodes.length > 1
                ? 'Select just one node to attach the new nodes to.'
                : 'Click a node on the canvas to select it first, then come back here.'}
            </p>
          )}

          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={toggleNodeLibrary}
              className="rounded-md px-3 py-1.5 text-[11px] font-medium hover:bg-[var(--color-sage)]"
              style={{ color: 'var(--color-ink)' }}
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={!parent}
              className="rounded-md px-3 py-1.5 text-[11px] font-medium shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
              style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-ink)' }}
            >
              Add {count} node{count > 1 ? 's' : ''}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
