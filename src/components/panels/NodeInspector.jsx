import { lazy, Suspense, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Star, X as XIcon } from 'lucide-react'
import { useMapStore } from '../../store/mapStore'
import { COLORS, NODE_SHAPES } from '../../theme/tokens'
import { LINE_STYLE_PRESETS } from '../canvas/edgePathUtils'
import IconLibrary from './IconLibrary'

// Section 14 — perf pass: Tiptap (NotesEditor) and emoji-picker-react are the
// two biggest contributors to bundle size, and neither is needed until the
// person actually opens that collapsible section. Code-split both so the
// eager main bundle no longer pays for them.
const NotesEditor = lazy(() => import('./NotesEditor'))
const EmojiPicker = lazy(() => import('emoji-picker-react'))

function PanelLoading() {
  return <p className="px-1 py-2 text-[10px] text-[#333533]">Loading…</p>
}

const PALETTE = Object.values(COLORS)
const TEXT_COLORS = ['#242423', '#333533', '#f5cb5c', '#e8eddf', '#ffffff']

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
      className={`flex h-7 w-7 items-center justify-center border ${shapeCls} ${
        active ? 'border-[#f5cb5c] border-2' : 'border-[#333533]'
      }`}
      style={{ backgroundColor: '#e8eddf' }}
    />
  )
}

function ColorSwatch({ color, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`h-6 w-6 rounded-full border ${active ? 'ring-2 ring-[#f5cb5c] ring-offset-1' : ''}`}
      style={{ backgroundColor: color, borderColor: '#333533' }}
      title={color}
    />
  )
}

// Mini SVG preview of a line-style preset (curved/straight/step/dotted/
// animated…) so the "Line style" picker shows what each button actually
// looks like instead of a plain text label.
function LineStyleSwatch({ preset, active, onClick }) {
  const { pathType, dash, cap } = preset.data
  const pathD =
    pathType === 'straight'
      ? 'M4 20 L44 20'
      : pathType === 'step' || pathType === 'smoothstep'
        ? 'M4 20 L24 20 L24 8 L44 8'
        : 'M4 20 Q 16 4, 24 12 T 44 8'
  return (
    <button
      onClick={onClick}
      title={preset.label}
      className={`flex h-9 w-12 items-center justify-center rounded-md border ${
        active ? 'border-[#f5cb5c] border-2 bg-[#f5cb5c]/10' : 'border-[#cfdbd5] hover:bg-[#cfdbd5]/20'
      }`}
    >
      <svg width="44" height="24" viewBox="0 0 48 24" className={preset.data.animated ? 'edge-preview-animated' : ''}>
        <path
          d={pathD}
          fill="none"
          stroke="#333533"
          strokeWidth="2"
          strokeDasharray={dash || undefined}
          strokeLinecap={cap || undefined}
        />
      </svg>
    </button>
  )
}

export default function NodeInspector() {
  const nodes = useMapStore((s) => s.nodes)
  const edges = useMapStore((s) => s.edges)
  const updateNodeData = useMapStore((s) => s.updateNodeData)
  const updateNodesData = useMapStore((s) => s.updateNodesData)
  const updateEdgeStyle = useMapStore((s) => s.updateEdgeStyle)
  const updateEdgeData = useMapStore((s) => s.updateEdgeData)
  const updateEdgeMarker = useMapStore((s) => s.updateEdgeMarker)
  const [showEmoji, setShowEmoji] = useState(false)
  const [showIcons, setShowIcons] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [showLineIcon, setShowLineIcon] = useState(false)

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
      <div className="flex flex-col gap-3">
        <p className="text-[10px] font-medium uppercase tracking-wide text-[#333533]">
          {selectedNodes.length} nodes selected
        </p>
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[#333533]">Shape</p>
          <div className="flex flex-wrap gap-1.5">
            {NODE_SHAPES.map((shape) => (
              <ShapeSwatch key={shape} shape={shape} active={false} onClick={() => updateNodesData(ids, { shape })} />
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[#333533]">Fill color</p>
          <div className="flex flex-wrap gap-1.5">
            {PALETTE.map((color) => (
              <ColorSwatch key={color} color={color} active={false} onClick={() => updateNodesData(ids, { color })} />
            ))}
            <input
              type="color"
              onChange={(e) => updateNodesData(ids, { color: e.target.value })}
              className="h-6 w-6 cursor-pointer rounded-full border-0 bg-transparent p-0"
              title="Custom color"
            />
          </div>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[#333533]">Text color</p>
          <div className="flex flex-wrap gap-1.5">
            {TEXT_COLORS.map((color) => (
              <ColorSwatch
                key={color}
                color={color}
                active={false}
                onClick={() => updateNodesData(ids, { textColor: color })}
              />
            ))}
            <input
              type="color"
              onChange={(e) => updateNodesData(ids, { textColor: e.target.value })}
              className="h-6 w-6 cursor-pointer rounded-full border-0 bg-transparent p-0"
              title="Custom text color"
            />
          </div>
        </div>
        <div>
          <p className="mb-1 text-[10px] text-[#333533]">Priority</p>
          <div className="flex flex-wrap gap-1">
            {[null, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((p) => (
              <button
                key={p ?? 'none'}
                onClick={() => updateNodesData(ids, (data) => ({ badges: { ...(data.badges || {}), priority: p } }))}
                className="h-5 w-5 rounded bg-[#cfdbd5]/50 text-[10px] hover:bg-[#cfdbd5]"
              >
                {p ?? '×'}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[9px] italic text-[#333533]">
            Priority is set per node — existing progress/star badges on each node are kept.
          </p>
        </div>
        <p className="text-[10px] text-[#333533]">
          Click empty canvas to deselect, or select a single node for full options (notes, icon, emoji, image, task).
        </p>
      </div>
    )
  }

  if (selectedNode) {
    const badges = selectedNode.data.badges || {}
    return (
      <div className="flex flex-col gap-3">
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[#333533]">Shape</p>
          <div className="flex flex-wrap gap-1.5">
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
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[#333533]">Fill color</p>
          <div className="flex flex-wrap gap-1.5">
            {PALETTE.map((color) => (
              <ColorSwatch
                key={color}
                color={color}
                active={selectedNode.data.color === color}
                onClick={() => updateNodeData(selectedNode.id, { color })}
              />
            ))}
            <input
              type="color"
              value={selectedNode.data.color}
              onChange={(e) => updateNodeData(selectedNode.id, { color: e.target.value })}
              className="h-6 w-6 cursor-pointer rounded-full border-0 bg-transparent p-0"
              title="Custom color"
            />
          </div>
        </div>

        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[#333533]">Text color</p>
          <div className="flex flex-wrap gap-1.5">
            {TEXT_COLORS.map((color) => (
              <ColorSwatch
                key={color}
                color={color}
                active={(selectedNode.data.textColor || '#242423') === color}
                onClick={() => updateNodeData(selectedNode.id, { textColor: color })}
              />
            ))}
            <input
              type="color"
              value={selectedNode.data.textColor || '#242423'}
              onChange={(e) => updateNodeData(selectedNode.id, { textColor: e.target.value })}
              className="h-6 w-6 cursor-pointer rounded-full border-0 bg-transparent p-0"
              title="Custom text color"
            />
          </div>
        </div>

        {/* Section 4.5 — task management: to-do marker, due date, assignee */}
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[#333533]">Task</p>
          {selectedNode.data.task ? (
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-1.5 text-[10px]">
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
                  className="rounded-md border border-[#cfdbd5] bg-white/60 px-1.5 py-1 text-[10px]"
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
                  className="rounded-md border border-[#cfdbd5] bg-white/60 px-1.5 py-1 text-[10px]"
                />
              </label>
              <button
                onClick={() => updateNodeData(selectedNode.id, { task: null })}
                className="w-fit text-[10px] text-[#333533] underline hover:text-[#242423]"
              >
                Remove task
              </button>
            </div>
          ) : (
            <button
              onClick={() => updateNodeData(selectedNode.id, { task: { done: false, dueDate: '', assignee: '' } })}
              className="rounded-md border border-dashed border-[#333533] px-2 py-1 text-[10px] hover:bg-[#cfdbd5]/30"
            >
              + Turn into a to-do task
            </button>
          )}
        </div>

        {/* Section 4.4 — rich text notes, hyperlinks, attachments, audio, video */}
        <div>
          <button
            onClick={() => setShowNotes((v) => !v)}
            className="mb-1 flex w-full items-center justify-between text-[10px] font-medium uppercase tracking-wide text-[#333533]"
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
            className="mb-1 flex w-full items-center justify-between text-[10px] font-medium uppercase tracking-wide text-[#333533]"
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
            className="mb-1 flex w-full items-center justify-between text-[10px] font-medium uppercase tracking-wide text-[#333533]"
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
                className="max-w-full overflow-hidden rounded-md border border-[#cfdbd5]"
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
                    className="w-full border-t border-[#cfdbd5] py-1 text-[10px] hover:bg-[#cfdbd5]/40"
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
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[#333533]">Image</p>
          {selectedNode.data.image ? (
            <div className="flex items-center gap-2">
              <img src={selectedNode.data.image} alt="" className="h-8 w-8 rounded object-cover" />
              <button
                onClick={() => updateNodeData(selectedNode.id, { image: null })}
                className="flex items-center gap-1 text-[10px] text-[#333533] underline hover:text-[#242423]"
              >
                <XIcon size={10} /> Remove
              </button>
            </div>
          ) : (
            <label className="cursor-pointer rounded-md border border-dashed border-[#333533] px-2 py-1.5 text-[10px] text-[#333533] hover:bg-[#cfdbd5]/30">
              Upload image
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </label>
          )}
        </div>

        {/* Section 4.3 — sticker/badge markers */}
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[#333533]">Badges</p>
          <div className="flex flex-col gap-2">
            <div>
              <p className="mb-1 text-[10px] text-[#333533]">Priority</p>
              <div className="flex flex-wrap gap-1">
                {[null, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((p) => (
                  <button
                    key={p ?? 'none'}
                    onClick={() => updateNodeData(selectedNode.id, { badges: { ...badges, priority: p } })}
                    className={`h-5 w-5 rounded text-[10px] ${
                      badges.priority === p ? 'bg-[#f5cb5c]' : 'bg-[#cfdbd5]/50 hover:bg-[#cfdbd5]'
                    }`}
                  >
                    {p ?? '×'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1 text-[10px] text-[#333533]">Progress — {badges.progress ?? 0}%</p>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={badges.progress ?? 0}
                onChange={(e) =>
                  updateNodeData(selectedNode.id, { badges: { ...badges, progress: Number(e.target.value) } })
                }
                className="w-full accent-[#f5cb5c]"
              />
            </div>
            <button
              onClick={() => updateNodeData(selectedNode.id, { badges: { ...badges, star: !badges.star } })}
              className={`flex w-fit items-center gap-1 rounded-md border px-2 py-1 text-[10px] ${
                badges.star ? 'border-[#f5cb5c] bg-[#f5cb5c]/30' : 'border-[#cfdbd5]'
              }`}
            >
              <Star size={11} fill={badges.star ? '#f5cb5c' : 'none'} /> Star
            </button>
          </div>
        </div>

        <p className="text-[10px] text-[#333533]">Double-click the node on canvas to edit its label.</p>
      </div>
    )
  }

  if (selectedEdge) {
    const stroke = selectedEdge.style?.stroke || '#333533'
    const strokeWidth = selectedEdge.style?.strokeWidth || 1.5
    const lineData = selectedEdge.data || {}
    const activePresetKey = LINE_STYLE_PRESETS.find(
      (p) =>
        (p.data.pathType || 'bezier') === (lineData.pathType || 'bezier') &&
        (p.data.dash || '') === (lineData.dash !== undefined ? lineData.dash : '6') &&
        !!p.data.animated === (lineData.animated !== false)
    )?.key
    const hasEndArrow = !!selectedEdge.markerEnd
    const hasStartArrow = !!selectedEdge.markerStart
    const arrowState = hasStartArrow && hasEndArrow ? 'both' : hasEndArrow ? 'end' : 'none'
    const setArrow = (mode) => {
      const marker = { type: 'arrowclosed', color: stroke, width: 16, height: 16 }
      updateEdgeMarker(selectedEdge.id, {
        markerEnd: mode === 'none' ? undefined : marker,
        markerStart: mode === 'both' ? marker : undefined,
      })
    }
    return (
      <div className="flex flex-col gap-3">
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[#333533]">Branch color</p>
          <div className="flex flex-wrap gap-1.5">
            {PALETTE.map((color) => (
              <ColorSwatch
                key={color}
                color={color}
                active={stroke === color}
                onClick={() => updateEdgeStyle(selectedEdge.id, { stroke: color })}
              />
            ))}
            <input
              type="color"
              value={stroke}
              onChange={(e) => updateEdgeStyle(selectedEdge.id, { stroke: e.target.value })}
              className="h-6 w-6 cursor-pointer rounded-full border-0 bg-transparent p-0"
              title="Custom color"
            />
          </div>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[#333533]">
            Thickness — {strokeWidth}px
          </p>
          <input
            type="range"
            min="1"
            max="6"
            step="0.5"
            value={strokeWidth}
            onChange={(e) => updateEdgeStyle(selectedEdge.id, { strokeWidth: Number(e.target.value) })}
            className="w-full accent-[#f5cb5c]"
          />
        </div>

        {/* Section 4.8 — 9 one-click connector line styles (curved, straight,
            step, dotted, animated, simple-curve…), matching the styles
            visually demoed on the connector-styles sample map. */}
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[#333533]">Line style</p>
          <div className="grid grid-cols-3 gap-1.5">
            {LINE_STYLE_PRESETS.map((preset) => (
              <LineStyleSwatch
                key={preset.key}
                preset={preset}
                active={activePresetKey === preset.key}
                onClick={() => updateEdgeData(selectedEdge.id, preset.data)}
              />
            ))}
          </div>
        </div>

        {/* Arrowhead toggle — none / end / both ends. */}
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[#333533]">Arrow</p>
          <div className="flex gap-1.5">
            {[
              { key: 'none', label: 'None' },
              { key: 'end', label: 'End →' },
              { key: 'both', label: '↔ Both' },
            ].map((opt) => (
              <button
                key={opt.key}
                onClick={() => setArrow(opt.key)}
                className={`rounded-md border px-2 py-1 text-[10px] ${
                  arrowState === opt.key
                    ? 'border-[#f5cb5c] bg-[#f5cb5c]/30'
                    : 'border-[#cfdbd5] hover:bg-[#cfdbd5]/30'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Section 4.8 — icon-in-middle connector decoration. */}
        <div>
          <button
            onClick={() => setShowLineIcon((v) => !v)}
            className="mb-1 flex w-full items-center justify-between text-[10px] font-medium uppercase tracking-wide text-[#333533]"
          >
            <span>Icon in middle {lineData.iconMid ? `— ${lineData.iconMid}` : ''}</span>
            <span>{showLineIcon ? '−' : '+'}</span>
          </button>
          <AnimatePresence initial={false}>
            {showLineIcon && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <IconLibrary
                  activeIcon={lineData.iconMid}
                  onSelect={(name) => updateEdgeData(selectedEdge.id, { iconMid: name })}
                />
                {lineData.iconMid && (
                  <button
                    onClick={() => updateEdgeData(selectedEdge.id, { iconMid: null })}
                    className="mt-1 w-full rounded-md border border-[#cfdbd5] py-1 text-[10px] hover:bg-[#cfdbd5]/40"
                  >
                    Remove icon
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    )
  }

  return (
    <p className="text-xs text-[#333533]">
      Select a node or a branch line on the canvas to edit its shape, color, or thickness.
    </p>
  )
}
