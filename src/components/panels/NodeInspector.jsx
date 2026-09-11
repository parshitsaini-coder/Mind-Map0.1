import { lazy, Suspense, useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Star, X as XIcon, Bold, Italic, Underline, Minus, Plus, Link2, ArrowUpRight, PenSquare, Pin, TrendingUp } from 'lucide-react'
import { useMapStore } from '../../store/mapStore'
import { useUiStore } from '../../store/uiStore'
import { useWhiteboardStore } from '../../store/whiteboardStore'
import { useTradeAnalysisStore } from '../../store/tradeAnalysisStore'
import { uploadNodeImage } from '../../lib/imageUpload'
import { COLORS, NODE_SHAPES } from '../../theme/tokens'
import { FONT_FAMILIES, MIN_FONT_SIZE, MAX_FONT_SIZE, DEFAULT_FONT_SIZE } from '../../utils/textStyle'
import IconLibrary from './IconLibrary'
import DatePicker from '../common/DatePicker'

// Section 14 — perf pass: Tiptap (NotesEditor) and emoji-picker-react are the
// two biggest contributors to bundle size, and neither is needed until the
// person actually opens that collapsible section. Code-split both so the
// eager main bundle no longer pays for them.
const NotesEditor = lazy(() => import('./NotesEditor'))
const EmojiPicker = lazy(() => import('emoji-picker-react'))

function PanelLoading() {
  return <p className="px-1 py-2 text-[10px] text-[var(--color-slate)]">Loading…</p>
}

// `date` is stored as a plain 'YYYY-MM-DD' string from <input type="date">.
// Parsing it with just `new Date(dateStr)` reads it as UTC midnight, which
// can roll back a day in negative-offset timezones — split it into parts
// and construct a local date instead so the weekday always matches what
// the person actually picked on the calendar.
export function formatNodeDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })
}

const PALETTE = Object.values(COLORS)
const TEXT_COLORS = ['var(--color-ink)', 'var(--color-slate)', 'var(--color-accent)', 'var(--color-cream)', '#ffffff']

// Picking a plain fill color here should always visibly "win" over whatever
// the Style Library (gradients/glow/animation) previously set — otherwise a
// gradient/animated preset would keep showing underneath the new solid pick.
const STYLE_EXTRAS_CLEAR = { customBg: null, bgSize: null, glowColor: null, customBorder: null, animationClass: null }

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
  const linkNode = useMapStore((s) => s.linkNode)
  const unlinkNode = useMapStore((s) => s.unlinkNode)
  const updateNodesData = useMapStore((s) => s.updateNodesData)
  const updateEdgeStyle = useMapStore((s) => s.updateEdgeStyle)
  const [showEmoji, setShowEmoji] = useState(false)
  const [showIcons, setShowIcons] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [showWhiteboard, setShowWhiteboard] = useState(false)
  const [showLinks, setShowLinks] = useState(false)
  const removeWhiteboardNote = useMapStore((s) => s.removeWhiteboardNote)
  const [linkPickerOpen, setLinkPickerOpen] = useState(false)

  const selectedNodes = nodes.filter((n) => n.selected && n.type !== 'boundaryGroup')
  const selectedNode = selectedNodes.length === 1 ? selectedNodes[0] : null
  const selectedEdge = edges.find((e) => e.selected)
  const linkedTrade = useTradeAnalysisStore((s) =>
    selectedNode?.data?.linkedTradeId ? s.trades.find((t) => t.id === selectedNode.data.linkedTradeId) : null
  )

  const [imageUploading, setImageUploading] = useState(false)
  // Drives the "tagda" success burst (rings + spring pop + badge) right
  // after an image lands on the node — flips back off on its own so the
  // burst plays once per upload rather than sticking around.
  const [justUploaded, setJustUploaded] = useState(false)

  const uploadImageFile = async (file) => {
    if (!file || !selectedNode) return
    setImageUploading(true)
    try {
      const { url, hosted, error } = await uploadNodeImage(file)
      updateNodeData(selectedNode.id, { image: url })
      setJustUploaded(true)
      setTimeout(() => setJustUploaded(false), 1500)
      if (!hosted) {
        useUiStore
          .getState()
          .showToast(
            error
              ? 'Image saved locally — upload failed, so it won\u2019t appear in share links.'
              : 'Image saved locally — connect Supabase Storage so it appears in share links too.'
          )
      }
    } finally {
      setImageUploading(false)
    }
  }

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    uploadImageFile(file)
  }

  const handleImageDrop = (e) => {
    e.preventDefault()
    const file = Array.from(e.dataTransfer?.files || []).find((f) => f.type.startsWith('image/'))
    if (file) uploadImageFile(file)
  }

  // Ctrl+V / Cmd+V paste-to-upload — active only while a single node is
  // selected, so pasting an image anywhere on the page drops it straight
  // onto that node without needing to click the drop zone first. Skips
  // when the caret is in a text input/textarea/contenteditable (label
  // editing, notes, etc.) so an incidental image in the clipboard doesn't
  // hijack an unrelated text paste.
  useEffect(() => {
    if (!selectedNode) return
    const onPaste = (e) => {
      const active = document.activeElement
      const isTyping = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)
      if (isTyping) return
      const item = Array.from(e.clipboardData?.items || []).find((it) => it.type.startsWith('image/'))
      if (!item) return
      const file = item.getAsFile()
      if (file) uploadImageFile(file)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNode?.id])

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
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[var(--color-slate)]">Size</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                updateNodesData(ids, (data) => ({
                  sizeScale: Math.max(0.5, Math.round(((data.sizeScale || 1) - 0.1) * 10) / 10),
                }))
              }
              className="flex h-6 w-6 items-center justify-center rounded border text-sm font-semibold hover:bg-[var(--color-sage)]/30"
              style={{ borderColor: 'var(--color-slate)' }}
              title="Decrease size"
            >
              −
            </button>
            <button
              onClick={() =>
                updateNodesData(ids, (data) => ({
                  sizeScale: Math.min(2, Math.round(((data.sizeScale || 1) + 0.1) * 10) / 10),
                }))
              }
              className="flex h-6 w-6 items-center justify-center rounded border text-sm font-semibold hover:bg-[var(--color-sage)]/30"
              style={{ borderColor: 'var(--color-slate)' }}
              title="Increase size"
            >
              +
            </button>
            <button
              onClick={() => updateNodesData(ids, { sizeScale: 1 })}
              className="text-[10px] underline text-[var(--color-slate)]"
              title="Reset to 100%"
            >
              Reset
            </button>
          </div>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[var(--color-slate)]">Fill color</p>
          <div className="flex flex-wrap gap-1">
            {PALETTE.map((color) => (
              <ColorSwatch key={color} color={color} active={false} onClick={() => updateNodesData(ids, { color, ...STYLE_EXTRAS_CLEAR })} />
            ))}
            <CustomColorInput
              value="var(--color-accent)"
              onChange={(e) => updateNodesData(ids, { color: e.target.value, ...STYLE_EXTRAS_CLEAR })}
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
      <div key={selectedNode.id} className="inspector-animate flex flex-col gap-2">
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
        {/* Section — Node size. `data.sizeScale` is a plain multiplier (1 =
            100%) applied in CustomNode as a scale transform, so the whole
            card — border, image, text, badges — grows/shrinks as one unit.
            Clamped to 0.5–2 so nodes can't be shrunk to nothing or blown up
            past what's still usable on the canvas. */}
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[var(--color-slate)]">Size</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                updateNodeData(selectedNode.id, {
                  sizeScale: Math.max(0.5, Math.round(((selectedNode.data.sizeScale || 1) - 0.1) * 10) / 10),
                })
              }
              className="flex h-6 w-6 items-center justify-center rounded border text-sm font-semibold hover:bg-[var(--color-sage)]/30"
              style={{ borderColor: 'var(--color-slate)' }}
              title="Decrease size"
            >
              −
            </button>
            <span className="w-10 text-center text-[11px] tabular-nums text-[var(--color-slate)]">
              {Math.round((selectedNode.data.sizeScale || 1) * 100)}%
            </span>
            <button
              onClick={() =>
                updateNodeData(selectedNode.id, {
                  sizeScale: Math.min(2, Math.round(((selectedNode.data.sizeScale || 1) + 0.1) * 10) / 10),
                })
              }
              className="flex h-6 w-6 items-center justify-center rounded border text-sm font-semibold hover:bg-[var(--color-sage)]/30"
              style={{ borderColor: 'var(--color-slate)' }}
              title="Increase size"
            >
              +
            </button>
            {selectedNode.data.sizeScale && selectedNode.data.sizeScale !== 1 && (
              <button
                onClick={() => updateNodeData(selectedNode.id, { sizeScale: 1 })}
                className="text-[10px] underline text-[var(--color-slate)]"
                title="Reset to 100%"
              >
                Reset
              </button>
            )}
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
                onClick={() => updateNodeData(selectedNode.id, { color, ...STYLE_EXTRAS_CLEAR })}
              />
            ))}
            <CustomColorInput
              value={selectedNode.data.color}
              onChange={(e) => updateNodeData(selectedNode.id, { color: e.target.value, ...STYLE_EXTRAS_CLEAR })}
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
                <DatePicker
                  value={selectedNode.data.task.dueDate || ''}
                  onChange={(v) =>
                    updateNodeData(selectedNode.id, { task: { ...selectedNode.data.task, dueDate: v } })
                  }
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

        {/* Section — Linked Trade. Mirrors the Task section's shape: a
            "+ Link a trade" prompt when nothing's attached, otherwise the
            pair name plus View/Change/Unlink actions. The actual trade
            data stays in tradeAnalysisStore — this only stores the id — so
            "View" opens the same read-only TradeDetailModal the node's
            canvas badge opens, rather than duplicating that UI here. */}
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[var(--color-slate)]">Linked Trade</p>
          {linkedTrade ? (
            <div className="flex items-center gap-1.5 rounded-md border border-[var(--color-sage)] bg-white/40 px-2 py-1.5">
              <TrendingUp size={12} className="shrink-0 text-[var(--color-slate)]" />
              <span className="flex-1 truncate text-[11px] font-medium text-[var(--color-ink)]">{linkedTrade.pair}</span>
              <button
                onClick={() => useUiStore.getState().openTradeDetail(selectedNode.id, linkedTrade.id)}
                className="text-[10px] text-[var(--color-accent)] underline hover:opacity-80"
              >
                View
              </button>
              <button
                onClick={() => useUiStore.getState().openTradeLinkPicker(selectedNode.id)}
                className="text-[10px] text-[var(--color-slate)] underline hover:text-[var(--color-ink)]"
              >
                Change
              </button>
              <button
                onClick={() => updateNodeData(selectedNode.id, { linkedTradeId: null })}
                className="text-[10px] text-[var(--color-slate)] underline hover:text-[#c1443c]"
              >
                Unlink
              </button>
            </div>
          ) : (
            <button
              onClick={() => useUiStore.getState().openTradeLinkPicker(selectedNode.id)}
              className="rounded-md border border-dashed border-[var(--color-slate)] px-2 py-1 text-[10px] hover:bg-[var(--color-sage)]/30"
            >
              + Link a trade
            </button>
          )}
        </div>

        {/* Section — Date. A plain calendar picker independent of the
            to-do Task's own due-date field. Storing just the ISO date
            string (`data.date`) is enough — the weekday shown here and on
            the node's canvas chip is derived from it with
            toLocaleDateString rather than persisted separately, so it
            can never drift out of sync with the date itself. */}
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[var(--color-slate)]">Date</p>
          <div className="flex flex-col gap-1">
            <DatePicker
              value={selectedNode.data.date || ''}
              onChange={(v) => updateNodeData(selectedNode.id, { date: v || null })}
            />
            {selectedNode.data.date && (
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[var(--color-slate)]">
                  {formatNodeDate(selectedNode.data.date)}
                </span>
                <button
                  onClick={() => updateNodeData(selectedNode.id, { date: null })}
                  className="text-[10px] text-[var(--color-slate)] underline hover:text-[#c1443c]"
                >
                  Remove
                </button>
              </div>
            )}
          </div>
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

        {/* Section — Whiteboard notes attached to this node. The Whiteboard
            itself is a single free-form canvas (toolbar's pen-square icon);
            a note created there gets copied here via "Attach to node". */}
        <div>
          <button
            onClick={() => setShowWhiteboard((v) => !v)}
            className="mb-1 flex w-full items-center justify-between text-[10px] font-medium uppercase tracking-wide text-[var(--color-slate)]"
          >
            <span>Whiteboard notes {(selectedNode.data.whiteboardNotes || []).length > 0 ? `(${selectedNode.data.whiteboardNotes.length})` : ''}</span>
            <span>{showWhiteboard ? '−' : '+'}</span>
          </button>
          <AnimatePresence initial={false}>
            {showWhiteboard && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="flex flex-col gap-1.5 rounded-md border border-[var(--color-sage)] bg-white/40 p-2">
                  {(selectedNode.data.whiteboardNotes || []).length === 0 && (
                    <p className="text-[10px] text-[var(--color-slate)]">
                      No whiteboard notes attached yet. Open the Whiteboard, write a note anywhere, then use its
                      "Attach to node" (📌) button to add it here.
                    </p>
                  )}
                  {(selectedNode.data.whiteboardNotes || []).map((note) => (
                    <div
                      key={note.id}
                      className="flex items-start gap-1.5 rounded px-1.5 py-1 text-[10px]"
                      style={{ backgroundColor: note.color || 'var(--color-sage)' }}
                    >
                      <Pin size={10} className="mt-0.5 shrink-0" />
                      <span className="flex-1 whitespace-pre-wrap break-words">{note.text}</span>
                      <button
                        onClick={() => removeWhiteboardNote(selectedNode.id, note.id)}
                        title="Remove this attached note"
                        className="shrink-0 text-[var(--color-ink)]/60 hover:text-[var(--color-ink)]"
                      >
                        <XIcon size={11} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => useWhiteboardStore.getState().open()}
                    className="mt-0.5 flex w-fit items-center gap-1 rounded-md border border-dashed border-[var(--color-slate)] px-2 py-1 text-[10px] hover:bg-[var(--color-sage)]/30"
                  >
                    <PenSquare size={11} /> Open Whiteboard
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Section — Node Linking / Backlinks. Outgoing links are stored on
            this node (data.links); backlinks (who points at this node) are
            derived on the fly by scanning every other node's data.links. */}
        <div>
          <button
            onClick={() => setShowLinks((v) => !v)}
            className="mb-1 flex w-full items-center justify-between text-[10px] font-medium uppercase tracking-wide text-[var(--color-slate)]"
          >
            <span>Linked nodes</span>
            <span>{showLinks ? '−' : '+'}</span>
          </button>
          <AnimatePresence initial={false}>
            {showLinks && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                {(() => {
                  const outgoingIds = (selectedNode.data.links || []).filter((id) => nodes.some((n) => n.id === id))
                  const backlinkNodes = nodes.filter(
                    (n) => n.id !== selectedNode.id && (n.data.links || []).includes(selectedNode.id)
                  )
                  const linkableNodes = nodes.filter(
                    (n) =>
                      n.id !== selectedNode.id &&
                      n.type !== 'boundaryGroup' &&
                      !outgoingIds.includes(n.id)
                  )
                  const jump = (id) => {
                    useMapStore.getState().selectNodeOnly(id)
                    useUiStore.getState().jumpToNode(id)
                  }
                  return (
                    <div className="flex flex-col gap-2 rounded-md border border-[var(--color-sage)] bg-white/40 p-2">
                      <div>
                        <p className="mb-1 text-[9px] font-medium uppercase tracking-wide text-[var(--color-slate)]">
                          Links to ({outgoingIds.length})
                        </p>
                        {outgoingIds.length === 0 && (
                          <p className="text-[10px] text-[var(--color-slate)]">No outgoing links yet.</p>
                        )}
                        <div className="flex flex-col gap-1">
                          {outgoingIds.map((id) => {
                            const target = nodes.find((n) => n.id === id)
                            return (
                              <div
                                key={id}
                                className="flex items-center gap-1 rounded border border-[var(--color-sage)] bg-white/70 px-1.5 py-1 text-[10px]"
                              >
                                <button
                                  onClick={() => jump(id)}
                                  className="flex flex-1 items-center gap-1 truncate text-left hover:underline"
                                  title="Jump to this node"
                                >
                                  <ArrowUpRight size={11} className="shrink-0" />
                                  <span className="truncate">{target?.data?.label || 'Untitled'}</span>
                                </button>
                                <button
                                  onClick={() => unlinkNode(selectedNode.id, id)}
                                  title="Remove link"
                                  className="shrink-0 text-[var(--color-slate)] hover:text-[var(--color-ink)]"
                                >
                                  <XIcon size={11} />
                                </button>
                              </div>
                            )
                          })}
                        </div>

                        {linkPickerOpen ? (
                          <div className="mt-1.5 flex flex-col gap-1">
                            <div className="max-h-32 overflow-y-auto rounded border border-[var(--color-sage)] bg-white/70">
                              {linkableNodes.length === 0 && (
                                <p className="px-1.5 py-1 text-[10px] text-[var(--color-slate)]">No other nodes to link.</p>
                              )}
                              {linkableNodes.map((n) => (
                                <button
                                  key={n.id}
                                  onClick={() => {
                                    linkNode(selectedNode.id, n.id)
                                    setLinkPickerOpen(false)
                                  }}
                                  className="block w-full truncate px-1.5 py-1 text-left text-[10px] hover:bg-[var(--color-sage)]/40"
                                >
                                  {n.data?.label || 'Untitled'}
                                </button>
                              ))}
                            </div>
                            <button
                              onClick={() => setLinkPickerOpen(false)}
                              className="w-fit text-[10px] text-[var(--color-slate)] underline hover:text-[var(--color-ink)]"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setLinkPickerOpen(true)}
                            className="mt-1.5 flex items-center gap-1 rounded-md border border-dashed border-[var(--color-slate)] px-2 py-1 text-[10px] hover:bg-[var(--color-sage)]/30"
                          >
                            <Link2 size={11} /> Link to another node
                          </button>
                        )}
                      </div>

                      <div className="border-t border-[var(--color-sage)] pt-1.5">
                        <p className="mb-1 text-[9px] font-medium uppercase tracking-wide text-[var(--color-slate)]">
                          Backlinks ({backlinkNodes.length})
                        </p>
                        {backlinkNodes.length === 0 && (
                          <p className="text-[10px] text-[var(--color-slate)]">No other node links here yet.</p>
                        )}
                        <div className="flex flex-col gap-1">
                          {backlinkNodes.map((n) => (
                            <button
                              key={n.id}
                              onClick={() => jump(n.id)}
                              className="flex items-center gap-1 truncate rounded border border-[var(--color-sage)] bg-white/70 px-1.5 py-1 text-left text-[10px] hover:underline"
                              title="Jump to this node"
                            >
                              <ArrowUpRight size={11} className="shrink-0" />
                              <span className="truncate">{n.data?.label || 'Untitled'}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
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

        {/* Section 4.3 — image upload into nodes. Accepts click-to-browse,
            drag-and-drop, and Ctrl+V paste (see the paste listener above). */}
        <div onDrop={handleImageDrop} onDragOver={(e) => e.preventDefault()}>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[var(--color-slate)]">Image</p>
          {imageUploading ? (
            <p className="text-[10px] text-[var(--color-slate)]">Uploading…</p>
          ) : selectedNode.data.image ? (
            <div className="flex items-center gap-2">
              <div className="relative flex h-8 w-8 items-center justify-center">
                {justUploaded && (
                  <>
                    <span
                      className="image-upload-ring pointer-events-none absolute inset-0 rounded-full"
                      style={{ border: '2px solid var(--color-accent)' }}
                    />
                    <span
                      className="image-upload-ring pointer-events-none absolute inset-0 rounded-full"
                      style={{ border: '2px solid var(--color-accent)', animationDelay: '0.15s' }}
                    />
                    <span
                      className="image-upload-ring pointer-events-none absolute inset-0 rounded-full"
                      style={{ border: '2px solid var(--color-accent)', animationDelay: '0.3s' }}
                    />
                  </>
                )}
                <motion.img
                  key={selectedNode.data.image}
                  src={selectedNode.data.image}
                  alt=""
                  className="relative h-8 w-8 rounded object-cover"
                  initial={justUploaded ? { scale: 0.15, opacity: 0, rotate: -20 } : false}
                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 16 }}
                />
              </div>
              <button
                onClick={() => updateNodeData(selectedNode.id, { image: null })}
                className="flex items-center gap-1 text-[10px] text-[var(--color-slate)] underline hover:text-[var(--color-ink)]"
              >
                <XIcon size={10} /> Remove
              </button>
              <AnimatePresence>
                {justUploaded && (
                  <motion.span
                    initial={{ opacity: 0, y: 4, scale: 0.7 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.8 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className="rounded-full px-2 py-0.5 text-[9px] font-semibold"
                    style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-ink)' }}
                  >
                    ✨ Added!
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <label className="flex cursor-pointer flex-col items-center gap-0.5 rounded-md border border-dashed border-[var(--color-slate)] px-2 py-2 text-center text-[10px] text-[var(--color-slate)] hover:bg-[var(--color-sage)]/30">
              <span>Upload image</span>
              <span className="text-[9px] opacity-70">or drag &amp; drop / paste (Ctrl+V)</span>
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </label>
          )}
          {selectedNode.data.image && !imageUploading && !selectedNode.data.image.startsWith('data:') && (
            <p className="mt-1 text-[9px] text-[var(--color-slate)]">✓ Hosted — will show up in share links.</p>
          )}
          {selectedNode.data.image && !imageUploading && selectedNode.data.image.startsWith('data:') && (
            <p className="mt-1 text-[9px] text-[var(--color-slate)]">⚠ Embedded locally — may be left out of share links if the map is large.</p>
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
