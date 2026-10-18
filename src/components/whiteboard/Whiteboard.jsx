import { useEffect, useRef, useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  X,
  Undo2,
  Redo2,
  Trash2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Pin,
  Minus,
  Plus,
  ImagePlus,
  Loader2,
  Palette,
} from 'lucide-react'
import { useWhiteboardStore, WHITEBOARD_COLORS, BOARD_BG_PRESETS } from '../../store/whiteboardStore'
import { useMapStore } from '../../store/mapStore'
import { useUiStore } from '../../store/uiStore'
import { uploadNodeImage } from '../../lib/imageUpload'
import { captureWhiteboardAsDataUrl } from '../../utils/exportImage'
import WhiteboardElement from './WhiteboardElement'
import ShapeElement from './ShapeElement'
import WhiteboardLeftBar from './WhiteboardLeftBar'
import CursorFx from './CursorFx'
import ShapeToolbar from './ShapeToolbar'
import { TOOLS as SHAPE_TOOLS, DRAW_SHORTCUTS, shapeBounds } from './drawShapes'

const TOOL_KEYS = { v: 'select', t: 'text', s: 'sticky', p: 'pen', e: 'eraser', m: 'measure' }

const ERASE_RADIUS = 16

function ToolButton({ icon: Icon, label, active, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      title={label}
      disabled={disabled}
      className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors disabled:opacity-30 ${
        active ? 'bg-[var(--color-accent)]' : 'hover:bg-[var(--color-sage)]'
      }`}
    >
      <Icon size={12} color="var(--color-ink)" />
    </button>
  )
}

// Tools pinned (⭐) from the left bar's flyouts, mirrored in the top bar for one-click access.
function PinnedTools() {
  const favs = useWhiteboardStore((s) => s.drawFavs)
  const tool = useWhiteboardStore((s) => s.tool)
  const drawTool = useWhiteboardStore((s) => s.drawTool)
  const penKind = useWhiteboardStore((s) => s.penKind)
  const list = favs.filter((id) => SHAPE_TOOLS[id])
  if (!list.length) return null
  const isActive = (id) => {
    const spec = SHAPE_TOOLS[id]
    if (spec.native?.tool === 'pen') return tool === 'pen' && penKind === spec.native.penKind
    if (spec.native) return tool === spec.native.tool
    return tool === 'draw' && drawTool === id
  }
  const pick = (id) => {
    const st = useWhiteboardStore.getState()
    const spec = SHAPE_TOOLS[id]
    if (spec.native?.tool === 'pen') st.setPenKind(spec.native.penKind)
    else if (spec.native) st.setTool(spec.native.tool)
    else st.setDrawTool(id)
  }
  return (
    <>
      <div className="mx-0.5 h-4 w-px shrink-0" style={{ backgroundColor: 'var(--color-sage)' }} />
      <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto" data-testid="wb-pinned">
        <AnimatePresence initial={false}>
          {list.map((id) => {
            const Icon = SHAPE_TOOLS[id].icon
            const active = isActive(id)
            return (
              <motion.button
                key={id}
                layout
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.85 }}
                transition={{ type: 'spring', stiffness: 500, damping: 26 }}
                onClick={() => pick(id)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  useWhiteboardStore.getState().toggleFav(id)
                }}
                title={`${SHAPE_TOOLS[id].name} (pinned — right-click to unpin)`}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors"
                style={{ backgroundColor: active ? 'var(--color-accent)' : undefined }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.backgroundColor = 'var(--color-sage)' }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = active ? 'var(--color-accent)' : '' }}
              >
                <Icon size={12} color="var(--color-ink)" />
              </motion.button>
            )
          })}
        </AnimatePresence>
      </div>
    </>
  )
}

function getElementBounds(el) {
  if (el.type === 'shape') return shapeBounds(el)
  if (el.type === 'path') {
    const xs = el.points.map((p) => p.x)
    const ys = el.points.map((p) => p.y)
    return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) }
  }
  return { x: el.x, y: el.y, width: el.width, height: el.height }
}

// Small round "custom color" swatch — a rainbow-wheel circle that opens the
// browser's native color picker on click, so any hex color can be picked
// for a note/pen stroke/background, not just the fixed preset swatches.
function CustomColorSwatch({ value, onChange, size = 'h-4 w-4', title = 'Custom color…' }) {
  return (
    <label
      title={title}
      className={`relative ${size} shrink-0 cursor-pointer overflow-hidden rounded-full border`}
      style={{ borderColor: 'var(--color-slate)', background: 'conic-gradient(red, #fbbf24, #34d399, #38bdf8, #818cf8, #f472b6, red)' }}
    >
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </label>
  )
}

// Popover for the toolbar's "Background" button — preset swatches plus a
// custom color picker, targeting the whiteboard canvas's own background
// (independent of note/pen colors). See useWhiteboardStore.boardColor.
function BackgroundPicker({ current, onPick, onClose }) {
  return (
    <div
      className="absolute top-full right-0 z-10 mt-1 flex flex-col gap-1.5 rounded-md border p-2 shadow-lg"
      style={{ backgroundColor: 'var(--color-cream)', borderColor: 'var(--color-sage)' }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-slate)]">Board background</p>
      <div className="flex items-center gap-1.5">
        {BOARD_BG_PRESETS.map((c) => (
          <button
            key={c}
            onClick={() => onPick(c)}
            title={c}
            className={`h-5 w-5 shrink-0 rounded-full border ${current === c ? 'ring-2 ring-[var(--color-accent)] ring-offset-1' : ''}`}
            style={{ backgroundColor: c, borderColor: 'var(--color-slate)' }}
          />
        ))}
        <CustomColorSwatch value={current || '#ecebe4'} onChange={onPick} size="h-5 w-5" title="Custom background color…" />
      </div>
      <button
        onClick={onClose}
        className="mt-0.5 text-center text-[10px] text-[var(--color-slate)] hover:text-[var(--color-ink)]"
      >
        Done
      </button>
    </div>
  )
}


// button — lets you pick any node on the current mind map to copy this
// whiteboard note onto (see mapStore.attachWhiteboardNote).
function NodePicker({ onPick, onClose }) {
  const [query, setQuery] = useState('')
  const nodes = useMapStore((s) => s.nodes).filter((n) => n.type !== 'boundaryGroup')
  const filtered = nodes.filter((n) => (n.data?.label || '').toLowerCase().includes(query.toLowerCase()))

  return (
    <div
      className="absolute top-full left-0 z-10 mt-1 w-48 rounded-md border shadow-lg"
      style={{ backgroundColor: 'var(--color-cream)', borderColor: 'var(--color-sage)' }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search nodes…"
        className="w-full border-b bg-transparent px-2 py-1.5 text-[11px] outline-none"
        style={{ borderColor: 'var(--color-sage)' }}
      />
      <div className="max-h-40 overflow-y-auto">
        {filtered.length === 0 && <p className="px-2 py-1.5 text-[10px] text-[var(--color-slate)]">No nodes found.</p>}
        {filtered.map((n) => (
          <button
            key={n.id}
            onClick={() => onPick(n.id, n.data?.label)}
            className="block w-full truncate px-2 py-1.5 text-left text-[11px] hover:bg-[var(--color-sage)]/50"
          >
            {n.data?.label || 'Untitled'}
          </button>
        ))}
      </div>
      <button
        onClick={onClose}
        className="block w-full border-t px-2 py-1 text-center text-[10px] text-[var(--color-slate)] hover:text-[var(--color-ink)]"
        style={{ borderColor: 'var(--color-sage)' }}
      >
        Cancel
      </button>
    </div>
  )
}

// Floating mini-toolbar that hovers just above the selected element —
// recolor, resize font (text/sticky), attach to a node, delete.
function SelectionToolbar({ element, pan, zoom, canvasRef }) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const bounds = getElementBounds(element)
  const left = pan.x + bounds.x * zoom
  const top = pan.y + bounds.y * zoom - 42

  const attach = (nodeId, label) => {
    useMapStore.getState().attachWhiteboardNote(nodeId, {
      id: `wbnote_${Date.now()}`,
      text: (element.content || '').trim() || 'Untitled note',
      color: element.color,
      ts: Date.now(),
    })
    useUiStore.getState().showToast(`Note attached to "${label || 'node'}"`)
    setPickerOpen(false)
  }

  if (element.type === 'shape' || element.type === 'path') return <ShapeToolbar element={element} pan={pan} zoom={zoom} bounds={bounds} canvasRef={canvasRef} />

  return (
    <div
      className="absolute z-10 flex items-center gap-1 rounded-md border px-1.5 py-1 shadow-lg"
      style={{ left, top: Math.max(4, top), backgroundColor: 'var(--color-cream)', borderColor: 'var(--color-sage)' }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {element.type !== 'path' && (
        <>
          {WHITEBOARD_COLORS.slice(0, 6).map((c) => (
            <button
              key={c}
              onClick={() => useWhiteboardStore.getState().setElementColor(element.id, c)}
              className={`h-4 w-4 shrink-0 rounded-full border ${element.color === c ? 'ring-2 ring-[var(--color-accent)] ring-offset-1' : ''}`}
              style={{ backgroundColor: c, borderColor: 'var(--color-slate)' }}
              title={c}
            />
          ))}
          <CustomColorSwatch value={element.color} onChange={(c) => useWhiteboardStore.getState().setElementColor(element.id, c)} />
          <div className="mx-0.5 h-4 w-px" style={{ backgroundColor: 'var(--color-sage)' }} />
          <button onClick={() => useWhiteboardStore.getState().bumpFontSize(element.id, -2)} title="Smaller text" className="rounded p-0.5 hover:bg-[var(--color-sage)]">
            <Minus size={11} />
          </button>
          <button onClick={() => useWhiteboardStore.getState().bumpFontSize(element.id, 2)} title="Bigger text" className="rounded p-0.5 hover:bg-[var(--color-sage)]">
            <Plus size={11} />
          </button>
          <div className="mx-0.5 h-4 w-px" style={{ backgroundColor: 'var(--color-sage)' }} />
          <div className="relative">
            <button
              onClick={() => setPickerOpen((v) => !v)}
              title="Attach this note to a mind-map node"
              className="flex items-center gap-1 rounded p-0.5 px-1 hover:bg-[var(--color-sage)]"
            >
              <Pin size={11} />
            </button>
            {pickerOpen && <NodePicker onPick={attach} onClose={() => setPickerOpen(false)} />}
          </div>
        </>
      )}
      {element.type === 'path' && (
        <>
          {WHITEBOARD_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => useWhiteboardStore.getState().setElementColor(element.id, c)}
              className={`h-4 w-4 shrink-0 rounded-full border ${element.color === c ? 'ring-2 ring-[var(--color-accent)] ring-offset-1' : ''}`}
              style={{ backgroundColor: c, borderColor: 'var(--color-slate)' }}
              title={c}
            />
          ))}
          <CustomColorSwatch value={element.color} onChange={(c) => useWhiteboardStore.getState().setElementColor(element.id, c)} />
        </>
      )}
      <div className="mx-0.5 h-4 w-px" style={{ backgroundColor: 'var(--color-sage)' }} />
      <button
        onClick={() => useWhiteboardStore.getState().deleteElement(element.id)}
        title="Delete (Del)"
        className="rounded p-0.5 text-red-600 hover:bg-red-500/10"
      >
        <Trash2 size={12} />
      </button>
    </div>
  )
}

// Ruler overlay for the Measure tool: shaded box, diagonal, and a read-out.
function MeasureOverlay({ m, zoom }) {
  const { a, b } = m
  const dx = b.x - a.x
  const dy = b.y - a.y
  const dist = Math.hypot(dx, dy)
  const ang = (-Math.atan2(dy, dx) * 180) / Math.PI
  const label = `Δx ${Math.round(dx)}  Δy ${Math.round(-dy)}  ·  ${Math.round(dist)} px  ·  ${Math.round(ang * 10) / 10}°`
  const fs = 12 / zoom
  const tw = label.length * fs * 0.56 + 14 / zoom
  const th = fs * 1.9
  const up = dy > 0 ? 1 : -1
  const col = dy <= 0 ? '#089981' : '#f23645'
  return (
    <svg style={{ position: 'absolute', left: 0, top: 0, width: 1, height: 1, overflow: 'visible', pointerEvents: 'none' }}>
      <rect x={Math.min(a.x, b.x)} y={Math.min(a.y, b.y)} width={Math.abs(dx)} height={Math.abs(dy)} fill={col} fillOpacity={0.12} stroke={col} strokeWidth={1 / zoom} strokeDasharray={`${4 / zoom} ${3 / zoom}`} />
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={col} strokeWidth={1.5 / zoom} />
      <circle cx={a.x} cy={a.y} r={3 / zoom} fill={col} />
      <circle cx={b.x} cy={b.y} r={3 / zoom} fill={col} />
      <rect x={b.x - tw / 2} y={b.y + up * (14 / zoom) - th / 2} width={tw} height={th} rx={4 / zoom} fill={col} />
      <text x={b.x} y={b.y + up * (14 / zoom) + fs * 0.35} textAnchor="middle" fontSize={fs} fontWeight={600} fill="#fff" fontFamily="system-ui, sans-serif">
        {label}
      </text>
    </svg>
  )
}

export default function Whiteboard() {
  const isOpen = useWhiteboardStore((s) => s.isOpen)
  const elements = useWhiteboardStore((s) => s.elements)
  const selectedId = useWhiteboardStore((s) => s.selectedId)
  const tool = useWhiteboardStore((s) => s.tool)
  const color = useWhiteboardStore((s) => s.color)
  const strokeWidth = useWhiteboardStore((s) => s.strokeWidth)
  const pan = useWhiteboardStore((s) => s.pan)
  const zoom = useWhiteboardStore((s) => s.zoom)
  const history = useWhiteboardStore((s) => s.history)
  const boardColor = useWhiteboardStore((s) => s.boardColor)
  const drawTool = useWhiteboardStore((s) => s.drawTool)
  const cursorMode = useWhiteboardStore((s) => s.cursorMode)
  const lockAll = useWhiteboardStore((s) => s.lockAll)
  const hideAll = useWhiteboardStore((s) => s.hideAll)

  const [addToNodeOpen, setAddToNodeOpen] = useState(false)
  const [savingToNode, setSavingToNode] = useState(false)
  const [bgPickerOpen, setBgPickerOpen] = useState(false)

  // "Add to node" toolbar button — rasterizes everything currently on the
  // board into one PNG and saves it as the picked node's image (same
  // node.data.image field / upload pipeline as a manual image upload in the
  // Node Inspector), so a whole whiteboard sketch can live on a node instead
  // of just individual text/sticky notes (see the Pin/"attach" flow above).
  const handleAddWhiteboardToNode = async (nodeId, label) => {
    setAddToNodeOpen(false)
    setSavingToNode(true)
    try {
      const dataUrl = await captureWhiteboardAsDataUrl(useWhiteboardStore.getState().elements, useWhiteboardStore.getState().boardColor || undefined)
      const blob = await (await fetch(dataUrl)).blob()
      const file = new File([blob], 'whiteboard.png', { type: 'image/png' })
      const { url, hosted, error } = await uploadNodeImage(file)
      useMapStore.getState().updateNodeData(nodeId, { image: url })
      useUiStore
        .getState()
        .showToast(
          hosted
            ? `Whiteboard image added to "${label || 'node'}"`
            : 'Whiteboard image added — saved locally since no image host is configured, so it won\u2019t appear in share links.'
        )
      if (error) console.error('Whiteboard image upload fallback reason:', error)
    } catch (err) {
      useUiStore.getState().showToast(err.message || 'Could not save the whiteboard image to that node.')
    } finally {
      setSavingToNode(false)
    }
  }

  const canvasRef = useRef(null)
  const drawState = useRef(null)
  const erasingRef = useRef(false)
  const erasedThisStroke = useRef(new Set())
  const [justCreatedId, setJustCreatedId] = useState(null)

  // Shape drawing state. `draft` is the shape being placed (points clicked so
  // far + the live cursor point); mirrored in a ref so window-level key
  // handlers always see the latest value.
  const [draft, setDraftState] = useState(null)
  const draftRef = useRef(null)
  const setDraft = (d) => {
    draftRef.current = d
    setDraftState(d)
  }
  const [measure, setMeasure] = useState(null) // { a, b, done, down }
  const measureRef = useRef(null)
  const setMeasureBoth = (m) => {
    measureRef.current = m
    setMeasure(m)
  }
  const [zoomBox, setZoomBox] = useState(null) // screen-space rubber band
  const [editShapeId, setEditShapeId] = useState(null)

  const toBoardCoords = useCallback(
    (clientX, clientY) => {
      const rect = canvasRef.current.getBoundingClientRect()
      return { x: (clientX - rect.left - pan.x) / zoom, y: (clientY - rect.top - pan.y) / zoom }
    },
    [pan, zoom]
  )

  const hitTest = useCallback(
    (bx, by, cx, cy) => {
      const store = useWhiteboardStore.getState()
      const els = store.elements
      // Shapes: ask the browser which fat-stroke hit path is under the cursor.
      const dom = cx != null ? document.elementFromPoint(cx, cy)?.closest?.('[data-wb-id]') : null
      if (dom) {
        const id = dom.getAttribute('data-wb-id')
        const el = els.find((e) => e.id === id)
        if (el && !el.locked && !store.lockAll) return id
      }
      // Walk from topmost (last-drawn) down so overlapping elements erase the
      // one actually on top first.
      for (let i = els.length - 1; i >= 0; i--) {
        const el = els[i]
        if (el.type === 'shape' || el.hidden || el.locked || store.lockAll) continue
        if (el.type === 'path') {
          const hit = el.points.some((p) => Math.hypot(p.x - bx, p.y - by) < ERASE_RADIUS / zoom)
          if (hit) return el.id
        } else {
          if (bx >= el.x && bx <= el.x + el.width && by >= el.y && by <= el.y + el.height) return el.id
        }
      }
      return null
    },
    [zoom]
  )

  // Magnet: snap a point to the closest existing anchor (shape points, stroke
  // ends, note corners/centres) within a few pixels.
  const snapPoint = (pt) => {
    const store = useWhiteboardStore.getState()
    if (store.magnet === 'off') return pt
    const radius = (store.magnet === 'weak' ? 10 : 30) / zoom
    const cand = []
    store.elements.forEach((el) => {
      if (el.hidden) return
      if (el.type === 'shape') el.points.forEach((p) => cand.push(p))
      else if (el.type === 'path') cand.push(el.points[0], el.points[el.points.length - 1])
      else cand.push({ x: el.x, y: el.y }, { x: el.x + el.width, y: el.y }, { x: el.x, y: el.y + el.height }, { x: el.x + el.width, y: el.y + el.height }, { x: el.x + el.width / 2, y: el.y + el.height / 2 })
    })
    let best = null
    let bd = radius
    cand.forEach((c) => {
      if (!c) return
      const d = Math.hypot(c.x - pt.x, c.y - pt.y)
      if (d < bd) {
        bd = d
        best = c
      }
    })
    return best ? { x: best.x, y: best.y } : pt
  }

  const finishDraft = (d, pts) => {
    const spec = SHAPE_TOOLS[d.tool]
    const store = useWhiteboardStore.getState()
    const id = store.addElement({
      type: 'shape',
      tool: d.tool,
      points: pts,
      color: store.drawColor,
      strokeWidth: Math.max(1, store.strokeWidth),
      lineStyle: 'solid',
      fill: !!spec.fill,
      fillOpacity: 0.18,
      fontSize: d.tool === 'emoji' ? 36 : 12,
      ...(d.tool === 'emoji' ? { emoji: store.glyph } : {}),
      ...(spec.text ? { text: '' } : {}),
    })
    setDraft(null)
    if (spec.text) setEditShapeId(id)
    if (store.stayDrawing) store.selectElement(null)
    else store.setTool('select')
  }

  // Drops trailing duplicate points (a double-click registers two mousedowns).
  const dedupe = (pts) => {
    const out = [...pts]
    while (out.length > 1 && Math.hypot(out[out.length - 1].x - out[out.length - 2].x, out[out.length - 1].y - out[out.length - 2].y) < 4 / zoom) out.pop()
    return out
  }

  const finishOpenDraft = () => {
    const d = draftRef.current
    if (!d) return
    const pts = dedupe(d.pts)
    if (pts.length >= 2) finishDraft(d, pts)
    else setDraft(null)
  }

  const handleCanvasMouseDown = (e) => {
    // Elements handle their own mousedown for the 'select' tool and call
    // stopPropagation, so if we get here with 'select' active the click was
    // on empty canvas. Other tools (text/sticky/pen/eraser) intentionally
    // act regardless of what's underneath the cursor.
    const { x, y } = toBoardCoords(e.clientX, e.clientY)
    const store = useWhiteboardStore.getState()

    if (tool === 'select') {
      store.selectElement(null)
      // Panning by dragging empty canvas is intentionally disabled — the
      // board background stays fixed (see the wheel handler below and the
      // black boundary border), so nothing needs to start here.
    } else if (tool === 'draw') {
      const spec = SHAPE_TOOLS[drawTool]
      if (!spec?.render || e.button !== 0) return
      // Keep focus where it is — the inline text editor (opened right after placing) must not lose it to the mousedown default.
      e.preventDefault()
      const pt = snapPoint({ x, y })
      const d = draftRef.current
      if (!d) {
        if (spec.n === 1) {
          finishDraft({ tool: drawTool }, [pt])
          return
        }
        setDraft({ tool: drawTool, pts: [pt], cur: pt, down: { x: e.clientX, y: e.clientY }, dragged: false })
      } else {
        const pts = [...d.pts, pt]
        if (spec.n && pts.length >= spec.n) finishDraft(d, pts)
        else setDraft({ ...d, pts, cur: pt, down: null, dragged: false })
      }
    } else if (tool === 'measure') {
      const pt = snapPoint({ x, y })
      const m = measureRef.current
      if (m && !m.done && !m.down) setMeasureBoth({ ...m, b: pt, done: true })
      else setMeasureBoth({ a: pt, b: pt, done: false, down: { x: e.clientX, y: e.clientY } })
    } else if (tool === 'zoom') {
      const rect = canvasRef.current.getBoundingClientRect()
      setZoomBox({ x0: e.clientX - rect.left, y0: e.clientY - rect.top, x1: e.clientX - rect.left, y1: e.clientY - rect.top })
    } else if (tool === 'text') {
      const id = store.addElement({ type: 'text', x: x - 80, y: y - 16, width: 170, height: 40, content: '', color: store.color, fontSize: 15 })
      setJustCreatedId(id)
      store.setTool('select')
    } else if (tool === 'sticky') {
      const id = store.addElement({ type: 'sticky', x: x - 80, y: y - 70, width: 160, height: 140, content: '', color: store.color, fontSize: 13 })
      setJustCreatedId(id)
      store.setTool('select')
    } else if (tool === 'pen') {
      const hl = store.penKind === 'highlighter'
      const id = store.addElement({
        type: 'path',
        points: [{ x, y }],
        color: store.color,
        strokeWidth: hl ? Math.max(14, store.strokeWidth * 4) : store.strokeWidth,
        ...(hl ? { opacity: 0.35, highlight: true } : {}),
      })
      drawState.current = id
    } else if (tool === 'eraser') {
      erasingRef.current = true
      erasedThisStroke.current = new Set()
      const hitId = hitTest(x, y, e.clientX, e.clientY)
      if (hitId && !erasedThisStroke.current.has(hitId)) {
        erasedThisStroke.current.add(hitId)
        store.deleteElement(hitId)
      }
    }
  }

  const handleCanvasMouseMove = (e) => {
    if (drawState.current) {
      const { x, y } = toBoardCoords(e.clientX, e.clientY)
      useWhiteboardStore.getState().appendPointToPath(drawState.current, { x, y })
    } else if (erasingRef.current) {
      const { x, y } = toBoardCoords(e.clientX, e.clientY)
      const hitId = hitTest(x, y, e.clientX, e.clientY)
      if (hitId && !erasedThisStroke.current.has(hitId)) {
        erasedThisStroke.current.add(hitId)
        useWhiteboardStore.getState().deleteElement(hitId)
      }
    }

    const d = draftRef.current
    if (d) {
      const { x, y } = toBoardCoords(e.clientX, e.clientY)
      const cur = snapPoint({ x, y })
      const dragged = d.dragged || (d.down ? Math.hypot(e.clientX - d.down.x, e.clientY - d.down.y) > 5 : false)
      setDraft({ ...d, cur, dragged })
    }
    const m = measureRef.current
    if (m && !m.done) {
      const { x, y } = toBoardCoords(e.clientX, e.clientY)
      setMeasureBoth({ ...m, b: snapPoint({ x, y }) })
    }
    setZoomBox((zb) => {
      if (!zb) return zb
      const rect = canvasRef.current.getBoundingClientRect()
      return { ...zb, x1: e.clientX - rect.left, y1: e.clientY - rect.top }
    })
  }

  const handleCanvasMouseUp = () => {
    drawState.current = null
    erasingRef.current = false

    const d = draftRef.current
    if (d && d.down) {
      const spec = SHAPE_TOOLS[d.tool]
      if (d.dragged && spec?.n >= 2 && d.pts.length === 1) {
        const pts = [...d.pts, d.cur]
        if (spec.n === 2) finishDraft(d, pts)
        else setDraft({ ...d, pts, down: null, dragged: false })
      } else {
        setDraft({ ...d, down: null })
      }
    }
    const m = measureRef.current
    if (m && m.down) {
      const moved = Math.hypot(m.b.x - m.a.x, m.b.y - m.a.y) * zoom > 5
      setMeasureBoth({ ...m, down: null, done: moved })
    }
    setZoomBox((zb) => {
      if (!zb) return null
      const rect = canvasRef.current.getBoundingClientRect()
      const w = Math.abs(zb.x1 - zb.x0)
      const h = Math.abs(zb.y1 - zb.y0)
      if (w > 12 && h > 12) {
        const bx0 = (Math.min(zb.x0, zb.x1) - pan.x) / zoom
        const by0 = (Math.min(zb.y0, zb.y1) - pan.y) / zoom
        const bw = w / zoom
        const bh = h / zoom
        const nz = Math.min(3, Math.max(0.25, Math.min(rect.width / bw, rect.height / bh)))
        const store = useWhiteboardStore.getState()
        store.setZoom(nz)
        store.setPan({ x: rect.width / 2 - (bx0 + bw / 2) * nz, y: rect.height / 2 - (by0 + bh / 2) * nz })
        store.setTool('select')
      }
      return null
    })
  }

  const handleCanvasDoubleClick = () => {
    const d = draftRef.current
    if (d && SHAPE_TOOLS[d.tool]?.n === 0) finishOpenDraft()
  }

  useEffect(() => {
    const h = (e) => setEditShapeId(e.detail)
    window.addEventListener('wb-edit-shape', h)
    return () => window.removeEventListener('wb-edit-shape', h)
  }, [])

  // Leaving the select tool throws away any half-placed shape / measurement.
  useEffect(() => {
    if (tool !== 'draw') setDraft(null)
    if (tool !== 'measure') setMeasureBoth(null)
    if (tool !== 'zoom') setZoomBox(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, drawTool])

  // Native (non-passive) wheel listener so preventDefault reliably stops the
  // page from scrolling while zooming the board. Plain scroll no longer pans
  // the board — the background is fixed in place (Ctrl/Cmd + scroll, or the
  // zoom buttons, still zoom in/out around the fixed origin).
  useEffect(() => {
    const el = canvasRef.current
    if (!isOpen || !el) return
    const onWheel = (e) => {
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) {
        const store = useWhiteboardStore.getState()
        store.setZoom(store.zoom * (1 - e.deltaY * 0.001))
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [isOpen])

  // Keyboard shortcuts scoped to the whiteboard — intercepted in the capture
  // phase on window so they win over the app-wide mind-map shortcuts
  // (Ctrl+Z etc.) for as long as the whiteboard is open.
  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e) => {
      const tag = e.target.tagName
      const isTyping = tag === 'TEXTAREA' || tag === 'INPUT'
      const store = useWhiteboardStore.getState()
      if (e.key === 'Escape') {
        // An open toolbar flyout handles its own Escape (see WhiteboardLeftBar).
        if (document.querySelector('[data-wbfly]')) return
        e.stopPropagation()
        if (isTyping) {
          e.target.blur?.()
          return
        }
        // First Escape cancels a half-drawn shape / measurement / armed tool; the next closes the board.
        if (draftRef.current) {
          setDraft(null)
          return
        }
        if (measureRef.current) {
          setMeasureBoth(null)
          return
        }
        if (store.tool !== 'select') {
          store.setTool('select')
          return
        }
        store.close()
        return
      }
      if (!isTyping && e.key === 'Enter' && draftRef.current) {
        e.preventDefault()
        finishOpenDraft()
        return
      }
      if (!isTyping && e.altKey && !e.ctrlKey && !e.metaKey && DRAW_SHORTCUTS[e.code]) {
        e.preventDefault()
        e.stopPropagation()
        store.setDrawTool(DRAW_SHORTCUTS[e.code])
        return
      }
      if (!isTyping && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        e.stopPropagation()
        if (e.shiftKey) store.redo()
        else store.undo()
        return
      }
      if (!isTyping && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        e.stopPropagation()
        store.redo()
        return
      }
      if (!isTyping && (e.key === 'Delete' || e.key === 'Backspace') && store.selectedId) {
        e.preventDefault()
        e.stopPropagation()
        store.deleteElement(store.selectedId)
        return
      }
      if (!isTyping && !e.ctrlKey && !e.metaKey && !e.altKey && TOOL_KEYS[e.key.toLowerCase()]) {
        e.stopPropagation()
        store.setTool(TOOL_KEYS[e.key.toLowerCase()])
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, zoom])

  if (!isOpen) return null

  const selectedElement = elements.find((e) => e.id === selectedId)
  const draftSpec = draft ? SHAPE_TOOLS[draft.tool] : null
  const draftPts = draft
    ? (() => {
        const arr = [...draft.pts]
        const n = draftSpec.n || arr.length + 1
        while (arr.length < n) arr.push(draft.cur)
        return arr
      })()
    : null
  const editShape = editShapeId ? elements.find((e) => e.id === editShapeId) : null
  const armedSpec = tool === 'draw' ? SHAPE_TOOLS[drawTool] : null
  const showAll = !hideAll

  const dotCursor =
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><circle cx='8' cy='8' r='3' fill='%23242423' stroke='white' stroke-width='1.5'/></svg>\") 8 8, auto"
  const canvasCursor =
    tool === 'select'
      ? cursorMode === 'cross'
        ? 'crosshair'
        : cursorMode === 'dot'
          ? dotCursor
          : cursorMode === 'demo'
            ? 'none'
            : 'default'
      : tool === 'eraser'
        ? 'cell'
        : tool === 'pen' || tool === 'draw' || tool === 'measure' || tool === 'zoom'
          ? 'crosshair'
          : 'copy'

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex flex-col"
        style={{ backgroundColor: 'var(--color-bg-main)' }}
      >
        {/* Toolbar */}
        <div
          className="flex h-8 shrink-0 items-center gap-1.5 border-b px-2"
          style={{ backgroundColor: 'var(--color-cream)', borderColor: 'var(--color-sage)' }}
        >
          <span className="hidden shrink-0 items-center gap-1 text-[11px] font-semibold sm:flex" style={{ color: 'var(--color-ink)' }}>
            📝 Whiteboard
          </span>
          <div className="mx-0.5 hidden h-4 w-px shrink-0 sm:block" style={{ backgroundColor: 'var(--color-sage)' }} />

          <div className="flex shrink-0 items-center gap-1">
            {WHITEBOARD_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => useWhiteboardStore.getState().setColor(c)}
                title={c}
                className={`h-4 w-4 shrink-0 rounded-full border ${color === c ? 'ring-2 ring-[var(--color-accent)] ring-offset-1' : ''}`}
                style={{ backgroundColor: c, borderColor: 'var(--color-slate)' }}
              />
            ))}
            <CustomColorSwatch value={color} onChange={(c) => useWhiteboardStore.getState().setColor(c)} size="h-4 w-4" />
          </div>

          {(tool === 'pen' || tool === 'draw') && (
            <div className="hidden shrink-0 items-center gap-1 md:flex">
              <span className="text-[10px] text-[var(--color-slate)]">Width</span>
              <input
                type="range"
                min="1"
                max="12"
                value={strokeWidth}
                onChange={(e) => useWhiteboardStore.getState().setStrokeWidth(Number(e.target.value))}
                className="w-16 accent-[var(--color-accent)]"
              />
            </div>
          )}

          {armedSpec && (
            <span className="hidden max-w-[260px] shrink-0 truncate text-[10px] italic text-[var(--color-slate)] lg:inline" title="Esc cancels">
              {armedSpec.name} — {armedSpec.n === 1 ? 'click to place' : armedSpec.n === 0 ? 'click points, double-click or Enter to finish' : `drag, or click ${armedSpec.n} points`}
            </span>
          )}

          <div className="mx-0.5 h-4 w-px shrink-0" style={{ backgroundColor: 'var(--color-sage)' }} />
          <ToolButton icon={Undo2} label="Undo (Ctrl+Z)" disabled={!history.past.length} onClick={() => useWhiteboardStore.getState().undo()} />
          <ToolButton icon={Redo2} label="Redo (Ctrl+Y)" disabled={!history.future.length} onClick={() => useWhiteboardStore.getState().redo()} />
          <ToolButton
            icon={Trash2}
            label="Clear whole board"
            disabled={!elements.length}
            onClick={() => {
              if (window.confirm('Clear the entire whiteboard? This removes every note and drawing (Ctrl+Z can undo it).')) {
                useWhiteboardStore.getState().clearBoard()
              }
            }}
          />

          <div className="relative">
            <ToolButton
              icon={savingToNode ? (props) => <Loader2 {...props} className="animate-spin" /> : ImagePlus}
              label="Add whiteboard image to a node"
              disabled={!elements.length || savingToNode}
              onClick={() => setAddToNodeOpen((v) => !v)}
            />
            {addToNodeOpen && <NodePicker onPick={handleAddWhiteboardToNode} onClose={() => setAddToNodeOpen(false)} />}
          </div>

          <PinnedTools />

          <div className="ml-auto flex shrink-0 items-center gap-1">
            <ToolButton icon={ZoomOut} label="Zoom out" onClick={() => useWhiteboardStore.getState().setZoom(zoom - 0.15)} />
            <span className="w-8 select-none text-center text-[9.5px]" style={{ color: 'var(--color-slate)' }}>
              {Math.round(zoom * 100)}%
            </span>
            <ToolButton icon={ZoomIn} label="Zoom in" onClick={() => useWhiteboardStore.getState().setZoom(zoom + 0.15)} />
            <ToolButton icon={RotateCcw} label="Reset view" onClick={() => useWhiteboardStore.getState().resetView()} />
            <div className="mx-0.5 h-4 w-px" style={{ backgroundColor: 'var(--color-sage)' }} />
            <div className="relative">
              <ToolButton icon={Palette} label="Whiteboard background color" active={bgPickerOpen} onClick={() => setBgPickerOpen((v) => !v)} />
              {bgPickerOpen && (
                <BackgroundPicker
                  current={boardColor}
                  onPick={(c) => useWhiteboardStore.getState().setBoardColor(c)}
                  onClose={() => setBgPickerOpen(false)}
                />
              )}
            </div>
            <div className="mx-0.5 h-4 w-px" style={{ backgroundColor: 'var(--color-sage)' }} />
            <ToolButton icon={X} label="Close whiteboard (Esc)" onClick={() => useWhiteboardStore.getState().close()} />
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
        <WhiteboardLeftBar />

        {/* Canvas */}
        <div
          ref={canvasRef}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
          onDoubleClick={handleCanvasDoubleClick}
          className="relative min-h-0 flex-1 overflow-hidden select-none"
          style={{
            backgroundColor: boardColor || 'var(--color-bg-main)',
            border: '3px solid #000000',
            cursor: canvasCursor,
          }}
        >
          <div
            className="whiteboard-elements-layer"
            style={{ position: 'absolute', top: 0, left: 0, width: 0, height: 0, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}
          >
            {showAll &&
              elements
                .filter((el) => !el.hidden)
                .map((el) =>
                  el.type === 'shape' ? (
                    <ShapeElement
                      key={el.id}
                      element={el}
                      isSelected={selectedId === el.id}
                      tool={tool}
                      zoom={zoom}
                      locked={lockAll || el.locked}
                      onSelect={(id) => useWhiteboardStore.getState().selectElement(id)}
                      onEditText={setEditShapeId}
                    />
                  ) : (
                    <WhiteboardElement
                      key={el.id}
                      element={el}
                      isSelected={selectedId === el.id}
                      tool={tool}
                      zoom={zoom}
                      locked={lockAll || el.locked}
                      onSelect={(id) => useWhiteboardStore.getState().selectElement(id)}
                      autoFocusEdit={justCreatedId === el.id}
                    />
                  )
                )}

            {/* Shape being placed */}
            {draft && draftSpec && (
              <ShapeElement
                preview
                tool="draw"
                zoom={zoom}
                onSelect={() => {}}
                element={{
                  id: '__draft',
                  type: 'shape',
                  tool: draft.tool,
                  points: draftPts,
                  color: useWhiteboardStore.getState().drawColor,
                  strokeWidth: Math.max(1, strokeWidth),
                  fill: !!draftSpec.fill,
                  fillOpacity: 0.18,
                  fontSize: draft.tool === 'emoji' ? 36 : 12,
                  emoji: useWhiteboardStore.getState().glyph,
                  text: draftSpec.text ? 'Text' : undefined,
                }}
              />
            )}

            {/* Ruler */}
            {measure && <MeasureOverlay m={measure} zoom={zoom} />}
          </div>

          {/* Hover guides / laser pointer */}
          {tool === 'select' && (cursorMode === 'cross' || cursorMode === 'demo') && <CursorFx containerRef={canvasRef} mode={cursorMode} />}

          {/* Zoom-to-area rubber band */}
          {zoomBox && (
            <div
              className="pointer-events-none absolute border-2 border-dashed"
              style={{
                left: Math.min(zoomBox.x0, zoomBox.x1),
                top: Math.min(zoomBox.y0, zoomBox.y1),
                width: Math.abs(zoomBox.x1 - zoomBox.x0),
                height: Math.abs(zoomBox.y1 - zoomBox.y0),
                borderColor: 'var(--color-accent)',
                backgroundColor: 'rgba(37,99,235,0.08)',
              }}
            />
          )}

          {/* Text editor for shapes that carry text (callout, pin, flag note…) */}
          {editShape && SHAPE_TOOLS[editShape.tool] && (
            <textarea
              autoFocus
              rows={2}
              value={editShape.text || ''}
              placeholder="Type…"
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => useWhiteboardStore.getState().updateElementBurst(editShape.id, { text: e.target.value })}
              onBlur={() => setEditShapeId(null)}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  e.currentTarget.blur()
                }
              }}
              className="absolute z-20 resize-none rounded border-2 bg-white px-1.5 py-1 text-[12px] font-semibold text-[#242423] shadow-lg outline-none"
              style={(() => {
                const spec = SHAPE_TOOLS[editShape.tool]
                const at = spec.textAt ? spec.textAt(editShape.points) : editShape.points[0]
                return { left: pan.x + at.x * zoom, top: pan.y + at.y * zoom, width: 170, transform: 'translate(-20%, -120%)', borderColor: 'var(--color-accent)' }
              })()}
            />
          )}

          {selectedElement && showAll && tool === 'select' && <SelectionToolbar element={selectedElement} pan={pan} zoom={zoom} canvasRef={canvasRef} />}

          {elements.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <p className="max-w-xs text-center text-xs text-[var(--color-slate)]">
                Pick a tool on the left — lines, Fibonacci, patterns, shapes, <strong>Text</strong>, <strong>Sticky note</strong>, brushes, emojis and
                more. Select a note afterwards to attach it to any node in your mind map. 📌
              </p>
            </div>
          )}
        </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
