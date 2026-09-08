import { lazy, Suspense, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Star, X as XIcon, Bold, Italic, Underline, Minus, Plus } from 'lucide-react'
import { useMapStore } from '../../store/mapStore'
import { COLORS, NODE_SHAPES } from '../../theme/tokens'
import { FONT_FAMILIES, MIN_FONT_SIZE, MAX_FONT_SIZE, DEFAULT_FONT_SIZE } from '../../utils/textStyle'
import IconLibrary from './IconLibrary'

// Section 14 — perf pass: Tiptap (NotesEditor) and emoji-picker-react are the
// two biggest contributors to bundle size, and neither is needed until the
// person actually opens that collapsible section. Code-split both so the
// eager main bundle no longer pays for them.
const NotesEditor = lazy(() => import('./NotesEditor'))
const EmojiPicker = lazy(() => import('emoji-picker-react'))

function PanelLoading() {
  return <p className="px-1 py-2 text-[10px] text-[var(--color-slate)]">Loading…</p>
}

const PALETTE = Object.values(COLORS)
const TEXT_COLORS = ['var(--color-ink)', 'var(--color-slate)', 'var(--color-accent)', 'var(--color-cream)', '#ffffff']

function ShapeSwatch({ shape, active, onClick }) {
  const shapeCls = {
    rectangle: 'rounded-sm',
    oval: 'rounded-full',
    cloud: 'rounded-[40%]',
    hexagon: 'clip-hex',
    'no-border': 'rounded-none border-dashed',
  }[shape]
  return (
    <button
      onClick={onClick}
      title={shape}
      className={`flex h-6 w-6 items-center justify-center border ${shapeCls} ${
        active ? 'border-[var(--color-accent)] border-2' : 'border-[var(--color-slate)]'
      }`}
      style={{ backgroundColor: 'var(--color-cream)' }}
    />
  )
}

function ColorSwatch({ color, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`h-5 w-5 rounded-full border ${active ? 'ring-2 ring-[var(--color-accent)] ring-offset-1' : ''}`}
      style={{ backgroundColor: color, borderColor: 'var(--color-slate)' }}
      title={color}
    />
  )
}

// Custom color picker — wraps a native <input type="color"> so it always
// reads as "pick any color" (conic-gradient ring + centered swatch) rather
// than just another flat swatch, since the browser's native color-input
// rendering alone can be easy to miss next to the preset palette.
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
      <span
        className="pointer-events-none h-3 w-3 rounded-full border border-white/70"
        style={{ backgroundColor: value }}
      />
      <input
        type="color"
        value={value}
        onChange={onChange}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </label>
  )
}

// Section — text styling. Bold/italic/underline toggle straight off
// node.data, a stepper adjusts font size a couple px at a time, and a
// dropdown swaps the font family — all applied live via nodeTextStyle()
// in CustomNode/ViewerNode so what you see here is exactly what renders.
function TextStylePanel({ data, onChange }) {
  const fontSize = data.fontSize || DEFAULT_FONT_SIZE
  const bump = (delta) => onChange({ fontSize: Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, fontSize + delta)) })

  return (
    <div>
      <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[var(--color-slate)]">Text style</p>
      <div className="flex flex-wrap items-center gap-1">
        <button
          onClick={() => onChange({ bold: !data.bold })}
          title="Bold"
          className={`flex h-6 w-6 items-center justify-center rounded border ${
            data.bold ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/30' : 'border-[var(--color-sage)]'
          }`}
        >
          <Bold size={11} />
        </button>
        <button
          onClick={() => onChange({ italic: !data.italic })}
          title="Italic"
          className={`flex h-6 w-6 items-center justify-center rounded border ${
            data.italic ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/30' : 'border-[var(--color-sage)]'
          }`}
        >
          <Italic size={11} />
        </button>
        <button
          onClick={() => onChange({ underline: !data.underline })}
          title="Underline"
          className={`flex h-6 w-6 items-center justify-center rounded border ${
            data.underline ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/30' : 'border-[var(--color-sage)]'
          }`}
        >
          <Underline size={11} />
        </button>

        <div className="ml-1 flex items-center gap-0.5 rounded border border-[var(--color-sage)] px-0.5">
          <button onClick={() => bump(-1)} title="Smaller" className="flex h-5 w-5 items-center justify-center">
            <Minus size={9} />
          </button>
          <span className="w-6 text-center text-[10px] tabular-nums">{fontSize}</span>
          <button onClick={() => bump(1)} title="Larger" className="flex h-5 w-5 items-center justify-center">
            <Plus size={9} />
          </button>
        </div>

        <select
          value={data.fontFamily || 'sans'}
          onChange={(e) => onChange({ fontFamily: e.target.value })}
          className="ml-1 rounded border border-[var(--color-sage)] bg-white/60 px-1 py-0.5 text-[10px]"
          title="Font family"
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

export default function NodeInspector() {
  const nodes = useMapStore((s) => s.nodes)
  const edges = useMapStore((s) => s.edges)
  const updateNodeData = useMapStore((s) => s.updateNodeData)
  const updateNodesData = useMapStore((s) => s.updateNodesData)
  const updateEdgeStyle = useMapStore((s) => s.updateEdgeStyle)
  const [showEmoji, setShowEmoji] = useState(false)
  const [showIcons, setShowIcons] = useState(false)
  const [showNotes, setShowNotes] = useState(false)

  const selectedNodes = nodes.filter((n) => n.selected && n.type !== 'boundaryGroup')
  const selectedNode = selectedNodes.length === 1 ? selectedNodes[0] : null
  const selectedEdge = edges.find((e) => e.selected)

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file || !selectedNode) return
    const reader = new FileReader()
    reader.onload = () => updateNodeData(selectedNode.id, { image: reader.result })
    reader.readAsDataURL(file)
  }

  // Multiple nodes selected (Shift-drag box-select or Ctrl/Cmd-click) — show
  // a simplified panel whose controls apply to every selected node at once.
  if (selectedNodes.length > 1) {
    const ids = selectedNodes.map((n) => n.id)
    return (
      <div className="flex flex-col gap-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-slate)]">
          {selectedNodes.length} nodes selected
        </p>
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[var(--color-slate)]">Shape</p>
          <div className="flex flex-wrap gap-1">
            {NODE_SHAPES.map((shape) => (
              <ShapeSwatch key={shape} shape={shape} active={false} onClick={() => updateNodesData(ids, { shape })} />
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[var(--color-slate)]">Fill color</p>
          <div className="flex flex-wrap gap-1">
            {PALETTE.map((color) => (
              <ColorSwatch key={color} color={color} active={false} onClick={() => updateNodesData(ids, { color })} />
            ))}
            <CustomColorInput
              value="var(--color-accent)"
              onChange={(e) => updateNodesData(ids, { color: e.target.value })}
              title="Custom color"
            />
          </div>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[var(--color-slate)]">Text color</p>
          <div className="flex flex-wrap gap-1">
            {TEXT_COLORS.map((color) => (
              <ColorSwatch
                key={color}
                color={color}
                active={false}
                onClick={() => updateNodesData(ids, { textColor: color })}
              />
            ))}
            <CustomColorInput
              value="var(--color-ink)"
              onChange={(e) => updateNodesData(ids, { textColor: e.target.value })}
              title="Custom text color"
            />
          </div>
        </div>

        <TextStylePanel data={{}} onChange={(patch) => updateNodesData(ids, patch)} />
        <div>
          <p className="mb-1 text-[10px] text-[var(--color-slate)]">Priority</p>
          <div className="flex flex-wrap gap-1">
            {[null, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((p) => (
              <button
                key={p ?? 'none'}
                onClick={() => updateNodesData(ids, (data) => ({ badges: { ...(data.badges || {}), priority: p } }))}
                className="h-[18px] w-[18px] rounded bg-[var(--color-sage)]/50 text-[10px] hover:bg-[var(--color-sage)]"
              >
                {p ?? '×'}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[9px] italic text-[var(--color-slate)]">
            Priority is set per node — existing progress/star badges on each node are kept.
          </p>
        </div>
        <p className="text-[10px] text-[var(--color-slate)]">
          Click empty canvas to deselect, or select a single node for full options (notes, icon, emoji, image, task).
        </p>
      </div>
    )
  }

  if (selectedNode) {
    const badges = selectedNode.data.badges || {}
    return (
      <div className="flex flex-col gap-2">
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[var(--color-slate)]">Shape</p>
          <div className="flex flex-wrap gap-1">
            {NODE_SHAPES.map((shape) => (
              <ShapeSwatch
                key={shape}
                shape={shape}
                active={selectedNode.data.shape === shape}
                onClick={() => updateNodeData(selectedNode.id, { shape })}
              />
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[var(--color-slate)]">Fill color</p>
          <div className="flex flex-wrap gap-1">
            {PALETTE.map((color) => (
              <ColorSwatch
                key={color}
                color={color}
                active={selectedNode.data.color === color}
                onClick={() => updateNodeData(selectedNode.id, { color })}
              />
            ))}
            <CustomColorInput
              value={selectedNode.data.color}
              onChange={(e) => updateNodeData(selectedNode.id, { color: e.target.value })}
              title="Custom color"
            />
          </div>
        </div>

        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[var(--color-slate)]">Text color</p>
          <div className="flex flex-wrap gap-1">
            {TEXT_COLORS.map((color) => (
              <ColorSwatch
                key={color}
                color={color}
                active={(selectedNode.data.textColor || 'var(--color-ink)') === color}
                onClick={() => updateNodeData(selectedNode.id, { textColor: color })}
              />
            ))}
            <CustomColorInput
              value={selectedNode.data.textColor || 'var(--color-ink)'}
              onChange={(e) => updateNodeData(selectedNode.id, { textColor: e.target.value })}
              title="Custom text color"
            />
          </div>
        </div>

        <TextStylePanel data={selectedNode.data} onChange={(patch) => updateNodeData(selectedNode.id, patch)} />

        {/* Section 4.5 — task management: to-do marker, due date, assignee */}
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[var(--color-slate)]">Task</p>
          {selectedNode.data.task ? (
            <div className="flex flex-col gap-1">
              <label className="flex items-center gap-1 text-[10px]">
                <input
                  type="checkbox"
                  checked={!!selectedNode.data.task.done}
                  onChange={(e) =>
                    updateNodeData(selectedNode.id, { task: { ...selectedNode.data.task, done: e.target.checked } })
                  }
                />
                Mark as done
              </label>
              <label className="flex flex-col gap-0.5 text-[10px]">
                Due date
                <input
                  type="date"
                  value={selectedNode.data.task.dueDate || ''}
                  onChange={(e) =>
                    updateNodeData(selectedNode.id, { task: { ...selectedNode.data.task, dueDate: e.target.value } })
                  }
                  className="rounded-md border border-[var(--color-sage)] bg-white/60 px-1.5 py-1 text-[10px]"
                />
              </label>
              <label className="flex flex-col gap-0.5 text-[10px]">
                Assignee
                <input
                  type="text"
                  value={selectedNode.data.task.assignee || ''}
                  onChange={(e) =>
                    updateNodeData(selectedNode.id, { task: { ...selectedNode.data.task, assignee: e.target.value } })
                  }
                  placeholder="Name"
                  className="rounded-md border border-[var(--color-sage)] bg-white/60 px-1.5 py-1 text-[10px]"
                />
              </label>
              <button
                onClick={() => updateNodeData(selectedNode.id, { task: null })}
                className="w-fit text-[10px] text-[var(--color-slate)] underline hover:text-[var(--color-ink)]"
              >
                Remove task
              </button>
            </div>
          ) : (
            <button
              onClick={() => updateNodeData(selectedNode.id, { task: { done: false, dueDate: '', assignee: '' } })}
              className="rounded-md border border-dashed border-[var(--color-slate)] px-2 py-1 text-[10px] hover:bg-[var(--color-sage)]/30"
            >
              + Turn into a to-do task
            </button>
          )}
        </div>

        {/* Section 4.4 — rich text notes, hyperlinks, attachments, audio, video */}
        <div>
          <button
            onClick={() => setShowNotes((v) => !v)}
            className="mb-1 flex w-full items-center justify-between text-[10px] font-medium uppercase tracking-wide text-[var(--color-slate)]"
          >
            <span>Notes & attachments</span>
            <span>{showNotes ? '−' : '+'}</span>
          </button>
          <AnimatePresence initial={false}>
            {showNotes && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <Suspense fallback={<PanelLoading />}>
                  <NotesEditor nodeId={selectedNode.id} data={selectedNode.data} />
                </Suspense>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Section 4.3 — icon / clip-art library */}
        <div>
          <button
            onClick={() => { setShowIcons((v) => !v); setShowEmoji(false) }}
            className="mb-1 flex w-full items-center justify-between text-[10px] font-medium uppercase tracking-wide text-[var(--color-slate)]"
          >
            <span>Icon {selectedNode.data.icon ? `— ${selectedNode.data.icon}` : ''}</span>
            <span>{showIcons ? '−' : '+'}</span>
          </button>
          <AnimatePresence initial={false}>
            {showIcons && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <IconLibrary
                  activeIcon={selectedNode.data.icon}
                  onSelect={(name) => updateNodeData(selectedNode.id, { icon: name, emoji: null })}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Section 4.3 — emoji support */}
        <div>
          <button
            onClick={() => { setShowEmoji((v) => !v); setShowIcons(false) }}
            className="mb-1 flex w-full items-center justify-between text-[10px] font-medium uppercase tracking-wide text-[var(--color-slate)]"
          >
            <span>Emoji {selectedNode.data.emoji || ''}</span>
            <span>{showEmoji ? '−' : '+'}</span>
          </button>
          <AnimatePresence initial={false}>
            {showEmoji && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="max-w-full overflow-hidden rounded-md border border-[var(--color-sage)]"
              >
                <Suspense fallback={<PanelLoading />}>
                  <EmojiPicker
                    width="100%"
                    height={260}
                    onEmojiClick={(e) => updateNodeData(selectedNode.id, { emoji: e.emoji, icon: null })}
                  />
                </Suspense>
                {selectedNode.data.emoji && (
                  <button
                    onClick={() => updateNodeData(selectedNode.id, { emoji: null })}
                    className="w-full border-t border-[var(--color-sage)] py-1 text-[10px] hover:bg-[var(--color-sage)]/40"
                  >
                    Remove emoji
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Section 4.3 — image upload into nodes */}
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[var(--color-slate)]">Image</p>
          {selectedNode.data.image ? (
            <div className="flex items-center gap-2">
              <img src={selectedNode.data.image} alt="" className="h-8 w-8 rounded object-cover" />
              <button
                onClick={() => updateNodeData(selectedNode.id, { image: null })}
                className="flex items-center gap-1 text-[10px] text-[var(--color-slate)] underline hover:text-[var(--color-ink)]"
              >
                <XIcon size={10} /> Remove
              </button>
            </div>
          ) : (
            <label className="cursor-pointer rounded-md border border-dashed border-[var(--color-slate)] px-2 py-1.5 text-[10px] text-[var(--color-slate)] hover:bg-[var(--color-sage)]/30">
              Upload image
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </label>
          )}
        </div>

        {/* Section 4.3 — sticker/badge markers */}
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[var(--color-slate)]">Badges</p>
          <div className="flex flex-col gap-2">
            <div>
              <p className="mb-1 text-[10px] text-[var(--color-slate)]">Priority</p>
              <div className="flex flex-wrap gap-1">
                {[null, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((p) => (
                  <button
                    key={p ?? 'none'}
                    onClick={() => updateNodeData(selectedNode.id, { badges: { ...badges, priority: p } })}
                    className={`h-[18px] w-[18px] rounded text-[10px] ${
                      badges.priority === p ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-sage)]/50 hover:bg-[var(--color-sage)]'
                    }`}
                  >
                    {p ?? '×'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1 text-[10px] text-[var(--color-slate)]">Progress — {badges.progress ?? 0}%</p>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={badges.progress ?? 0}
                onChange={(e) =>
                  updateNodeData(selectedNode.id, { badges: { ...badges, progress: Number(e.target.value) } })
                }
                className="w-full accent-[var(--color-accent)]"
              />
            </div>
            <button
              onClick={() => updateNodeData(selectedNode.id, { badges: { ...badges, star: !badges.star } })}
              className={`flex w-fit items-center gap-1 rounded-md border px-2 py-1 text-[10px] ${
                badges.star ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/30' : 'border-[var(--color-sage)]'
              }`}
            >
              <Star size={11} fill={badges.star ? 'var(--color-accent)' : 'none'} /> Star
            </button>
          </div>
        </div>

        <p className="text-[10px] text-[var(--color-slate)]">Double-click the node on canvas to edit its label.</p>
      </div>
    )
  }

  if (selectedEdge) {
    const stroke = selectedEdge.style?.stroke || 'var(--color-slate)'
    const strokeWidth = selectedEdge.style?.strokeWidth || 1.5
    return (
      <div className="flex flex-col gap-2">
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[var(--color-slate)]">Branch color</p>
          <div className="flex flex-wrap gap-1">
            {PALETTE.map((color) => (
              <ColorSwatch
                key={color}
                color={color}
                active={stroke === color}
                onClick={() => updateEdgeStyle(selectedEdge.id, { stroke: color })}
              />
            ))}
            <CustomColorInput
              value={stroke}
              onChange={(e) => updateEdgeStyle(selectedEdge.id, { stroke: e.target.value })}
              title="Custom branch color"
            />
          </div>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[var(--color-slate)]">
            Thickness — {strokeWidth}px
          </p>
          <input
            type="range"
            min="1"
            max="6"
            step="0.5"
            value={strokeWidth}
            onChange={(e) => updateEdgeStyle(selectedEdge.id, { strokeWidth: Number(e.target.value) })}
            className="w-full accent-[var(--color-accent)]"
          />
        </div>
      </div>
    )
  }

  return (
    <p className="text-xs text-[var(--color-slate)]">
      Select a node or a branch line on the canvas to edit its shape, color, or thickness.
    </p>
  )
}
