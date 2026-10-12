import { useEffect, useRef, useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  X,
  MousePointer2,
  Type,
  StickyNote,
  Pencil,
  Eraser,
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

const TOOLS = [
  { id: 'select', icon: MousePointer2, label: 'Select / move (V)' },
  { id: 'text', icon: Type, label: 'Add text anywhere (T)' },
  { id: 'sticky', icon: StickyNote, label: 'Add sticky note (S)' },
  { id: 'pen', icon: Pencil, label: 'Draw (P)' },
  { id: 'eraser', icon: Eraser, label: 'Eraser (E)' },
]

const TOOL_KEYS = { v: 'select', t: 'text', s: 'sticky', p: 'pen', e: 'eraser' }

const ERASE_RADIUS = 16

function ToolButton({ icon: Icon, label, active, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      title={label}
      disabled={disabled}
      className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors disabled:opacity-30 ${
        active ? 'bg-[var(--color-accent)]' : 'hover:bg-[var(--color-sage)]'
      }`}
    >
      <Icon size={14} color="var(--color-ink)" />
    </button>
  )
}

function getElementBounds(el) {
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
function SelectionToolbar({ element, pan, zoom }) {
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

  const toBoardCoords = useCallback(
    (clientX, clientY) => {
      const rect = canvasRef.current.getBoundingClientRect()
      return { x: (clientX - rect.left - pan.x) / zoom, y: (clientY - rect.top - pan.y) / zoom }
    },
    [pan, zoom]
  )

  const hitTest = useCallback((bx, by) => {
    const els = useWhiteboardStore.getState().elements
    // Walk from topmost (last-drawn) down so overlapping elements erase the
    // one actually on top first.
    for (let i = els.length - 1; i >= 0; i--) {
      const el = els[i]
      if (el.type === 'path') {
        const hit = el.points.some((p) => Math.hypot(p.x - bx, p.y - by) < ERASE_RADIUS / zoom)
        if (hit) return el.id
      } else {
        if (bx >= el.x && bx <= el.x + el.width && by >= el.y && by <= el.y + el.height) return el.id
      }
    }
    return null
  }, [zoom])

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
    } else if (tool === 'text') {
      const id = store.addElement({ type: 'text', x: x - 80, y: y - 16, width: 170, height: 40, content: '', color: store.color, fontSize: 15 })
      setJustCreatedId(id)
      store.setTool('select')
    } else if (tool === 'sticky') {
      const id = store.addElement({ type: 'sticky', x: x - 80, y: y - 70, width: 160, height: 140, content: '', color: store.color, fontSize: 13 })
      setJustCreatedId(id)
      store.setTool('select')
    } else if (tool === 'pen') {
      const id = store.addElement({ type: 'path', points: [{ x, y }], color: store.color, strokeWidth: store.strokeWidth })
      drawState.current = id
    } else if (tool === 'eraser') {
      erasingRef.current = true
      erasedThisStroke.current = new Set()
      const hitId = hitTest(x, y)
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
      const hitId = hitTest(x, y)
      if (hitId && !erasedThisStroke.current.has(hitId)) {
        erasedThisStroke.current.add(hitId)
        useWhiteboardStore.getState().deleteElement(hitId)
      }
    }
  }

  const handleCanvasMouseUp = () => {
    drawState.current = null
    erasingRef.current = false
  }

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
        e.stopPropagation()
        store.close()
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
      if (!isTyping && TOOL_KEYS[e.key.toLowerCase()]) {
        e.stopPropagation()
        store.setTool(TOOL_KEYS[e.key.toLowerCase()])
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [isOpen])

  if (!isOpen) return null

  const selectedElement = elements.find((e) => e.id === selectedId)

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
          className="flex h-11 shrink-0 items-center gap-2 border-b px-2"
          style={{ backgroundColor: 'var(--color-cream)', borderColor: 'var(--color-sage)' }}
        >
          <span className="hidden shrink-0 items-center gap-1 text-xs font-semibold sm:flex" style={{ color: 'var(--color-ink)' }}>
            📝 Whiteboard
          </span>
          <div className="mx-0.5 hidden h-5 w-px shrink-0 sm:block" style={{ backgroundColor: 'var(--color-sage)' }} />

          <div className="flex shrink-0 items-center gap-0.5 rounded-md border p-0.5" style={{ borderColor: 'var(--color-sage)' }}>
            {TOOLS.map((t) => (
              <ToolButton key={t.id} icon={t.icon} label={t.label} active={tool === t.id} onClick={() => useWhiteboardStore.getState().setTool(t.id)} />
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {WHITEBOARD_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => useWhiteboardStore.getState().setColor(c)}
                title={c}
                className={`h-5 w-5 shrink-0 rounded-full border ${color === c ? 'ring-2 ring-[var(--color-accent)] ring-offset-1' : ''}`}
                style={{ backgroundColor: c, borderColor: 'var(--color-slate)' }}
              />
            ))}
            <CustomColorSwatch value={color} onChange={(c) => useWhiteboardStore.getState().setColor(c)} size="h-5 w-5" />
          </div>

          {tool === 'pen' && (
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

          <div className="mx-0.5 h-5 w-px shrink-0" style={{ backgroundColor: 'var(--color-sage)' }} />
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

          <div className="ml-auto flex shrink-0 items-center gap-1">
            <ToolButton icon={ZoomOut} label="Zoom out" onClick={() => useWhiteboardStore.getState().setZoom(zoom - 0.15)} />
            <span className="w-9 select-none text-center text-[10px]" style={{ color: 'var(--color-slate)' }}>
              {Math.round(zoom * 100)}%
            </span>
            <ToolButton icon={ZoomIn} label="Zoom in" onClick={() => useWhiteboardStore.getState().setZoom(zoom + 0.15)} />
            <ToolButton icon={RotateCcw} label="Reset view" onClick={() => useWhiteboardStore.getState().resetView()} />
            <div className="mx-0.5 h-5 w-px" style={{ backgroundColor: 'var(--color-sage)' }} />
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
            <div className="mx-0.5 h-5 w-px" style={{ backgroundColor: 'var(--color-sage)' }} />
            <ToolButton icon={X} label="Close whiteboard (Esc)" onClick={() => useWhiteboardStore.getState().close()} />
          </div>
        </div>

        {/* Canvas */}
        <div
          ref={canvasRef}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
          className="relative min-h-0 flex-1 overflow-hidden select-none"
          style={{
            backgroundColor: boardColor || 'var(--color-bg-main)',
            border: '3px solid #000000',
            cursor: tool === 'select' ? 'default' : tool === 'eraser' ? 'cell' : tool === 'pen' ? 'crosshair' : 'copy',
          }}
        >
          <div
            className="whiteboard-elements-layer"
            style={{ position: 'absolute', top: 0, left: 0, width: 0, height: 0, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}
          >
            {elements.map((el) => (
              <WhiteboardElement
                key={el.id}
                element={el}
                isSelected={selectedId === el.id}
                tool={tool}
                zoom={zoom}
                onSelect={(id) => useWhiteboardStore.getState().selectElement(id)}
                autoFocusEdit={justCreatedId === el.id}
              />
            ))}
          </div>

          {selectedElement && tool === 'select' && <SelectionToolbar element={selectedElement} pan={pan} zoom={zoom} />}

          {elements.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <p className="max-w-xs text-center text-xs text-[var(--color-slate)]">
                Pick a tool above — <strong>Text</strong> or <strong>Sticky note</strong> to write anywhere, <strong>Pen</strong> to draw. Select
                a note afterwards to attach it to any node in your mind map. 📌
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
