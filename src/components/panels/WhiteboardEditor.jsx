import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Pencil,
  Eraser,
  Minus,
  Square,
  Circle as CircleIcon,
  MoveUpRight,
  Type,
  Undo2,
  Redo2,
  Trash2,
  Download,
  X,
  Check,
} from 'lucide-react'
import { useMapStore } from '../../store/mapStore'

// Fixed internal drawing resolution — the <canvas> is scaled to fit its
// container via CSS, but every stored coordinate is in this space, so a
// whiteboard drawn on desktop still looks right when reopened on the
// mobile bottom-sheet.
const CANVAS_W = 1000
const CANVAS_H = 620

const TOOLS = [
  { key: 'pen', icon: Pencil, label: 'Pen' },
  { key: 'eraser', icon: Eraser, label: 'Eraser' },
  { key: 'line', icon: Minus, label: 'Line' },
  { key: 'rect', icon: Square, label: 'Rectangle' },
  { key: 'ellipse', icon: CircleIcon, label: 'Ellipse' },
  { key: 'arrow', icon: MoveUpRight, label: 'Arrow' },
  { key: 'text', icon: Type, label: 'Text — click the board to type' },
]

const PALETTE = ['#242423', '#c1443c', '#3a6ea5', '#3d6b52', '#b8860b', '#7b4fa0', '#ffffff']

function pointerPos(canvas, e) {
  const rect = canvas.getBoundingClientRect()
  const point = e.touches?.[0] || e.changedTouches?.[0] || e
  return {
    x: ((point.clientX - rect.left) / rect.width) * CANVAS_W,
    y: ((point.clientY - rect.top) / rect.height) * CANVAS_H,
  }
}

function drawElement(ctx, el) {
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  if (el.type === 'path') {
    if (el.points.length < 2) return
    ctx.strokeStyle = el.erase ? '#ffffff' : el.color
    ctx.lineWidth = el.size
    ctx.beginPath()
    ctx.moveTo(el.points[0].x, el.points[0].y)
    el.points.forEach((p) => ctx.lineTo(p.x, p.y))
    ctx.stroke()
    return
  }

  if (el.type === 'line' || el.type === 'arrow') {
    ctx.strokeStyle = el.color
    ctx.lineWidth = el.size
    ctx.beginPath()
    ctx.moveTo(el.x1, el.y1)
    ctx.lineTo(el.x2, el.y2)
    ctx.stroke()
    if (el.type === 'arrow') {
      const angle = Math.atan2(el.y2 - el.y1, el.x2 - el.x1)
      const headLen = 8 + el.size * 1.5
      ctx.beginPath()
      ctx.moveTo(el.x2, el.y2)
      ctx.lineTo(el.x2 - headLen * Math.cos(angle - Math.PI / 6), el.y2 - headLen * Math.sin(angle - Math.PI / 6))
      ctx.moveTo(el.x2, el.y2)
      ctx.lineTo(el.x2 - headLen * Math.cos(angle + Math.PI / 6), el.y2 - headLen * Math.sin(angle + Math.PI / 6))
      ctx.stroke()
    }
    return
  }

  if (el.type === 'rect') {
    ctx.strokeStyle = el.color
    ctx.lineWidth = el.size
    ctx.strokeRect(Math.min(el.x1, el.x2), Math.min(el.y1, el.y2), Math.abs(el.x2 - el.x1), Math.abs(el.y2 - el.y1))
    return
  }

  if (el.type === 'ellipse') {
    ctx.strokeStyle = el.color
    ctx.lineWidth = el.size
    const cx = (el.x1 + el.x2) / 2
    const cy = (el.y1 + el.y2) / 2
    const rx = Math.abs(el.x2 - el.x1) / 2
    const ry = Math.abs(el.y2 - el.y1) / 2
    ctx.beginPath()
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
    ctx.stroke()
    return
  }

  if (el.type === 'text') {
    ctx.fillStyle = el.color
    ctx.font = `${el.fontSize}px sans-serif`
    ctx.textBaseline = 'top'
    // Support multi-line text (Enter key while typing).
    el.text.split('\n').forEach((line, i) => ctx.fillText(line, el.x, el.y + i * el.fontSize * 1.25))
  }
}

// Rough bounding box for a text element, used to hit-test clicks so an
// existing text can be re-opened for editing/deleting instead of always
// creating a new one on top of it.
function textBounds(ctx, el) {
  ctx.font = `${el.fontSize}px sans-serif`
  const lines = el.text.split('\n')
  const width = Math.max(...lines.map((l) => ctx.measureText(l).width), 20)
  const height = lines.length * el.fontSize * 1.25
  return { x: el.x, y: el.y, width, height }
}

// Full-screen modal — a small freeform drawing board (pen, eraser, shapes,
// arrows, text, color/size, undo/redo, clear, download) that saves onto the
// selected node as `data.whiteboard`. Vector `elements` are kept so the
// board can be reopened and continued later; a rendered `thumbnail` PNG is
// stored alongside it for the Node Inspector preview and the on-canvas
// "has extras" indicator, without needing to replay the drawing to show it.
export default function WhiteboardEditor({ nodeId, data, onClose }) {
  const updateNodeData = useMapStore((s) => s.updateNodeData)
  const canvasRef = useRef(null)
  const drawingRef = useRef(null)
  const textAreaRef = useRef(null)

  const [elements, setElements] = useState(() => data.whiteboard?.elements || [])
  const [redoStack, setRedoStack] = useState([])
  const [tool, setTool] = useState('pen')
  const [color, setColor] = useState('#242423')
  const [size, setSize] = useState(3)
  // Text is edited directly on the board — no popup. null = not editing;
  // otherwise { x, y, value, color, fontSize } for the box currently open.
  const [editingText, setEditingText] = useState(null)

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
    elements.forEach((el) => drawElement(ctx, el))
    if (drawingRef.current) drawElement(ctx, drawingRef.current)
  }, [elements])

  useEffect(() => {
    redraw()
  }, [redraw])

  // Lock page scroll while the board is open — it's a full-screen modal.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // Keep the on-canvas text box focused as soon as it appears/moves (so
  // "click anywhere and just type" works, and re-editing existing text
  // starts with the cursor ready to go).
  useEffect(() => {
    if (editingText && textAreaRef.current) {
      const el = textAreaRef.current
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }
  }, [editingText?.x, editingText?.y])

  const commitElement = (el) => {
    setElements((prev) => [...prev, el])
    setRedoStack([])
  }

  const handleMove = (e) => {
    if (!drawingRef.current) return
    e.preventDefault?.()
    const pos = pointerPos(canvasRef.current, e)
    if (drawingRef.current.type === 'path') {
      drawingRef.current.points.push(pos)
    } else {
      drawingRef.current.x2 = pos.x
      drawingRef.current.y2 = pos.y
    }
    redraw()
  }

  // Finish whatever text box is currently open: saves it as a text element
  // if it has content, or simply drops it (delete) if left empty.
  const commitTextEdit = () => {
    setEditingText((current) => {
      if (current && current.value.trim()) {
        commitElement({
          type: 'text',
          color: current.color,
          fontSize: current.fontSize,
          x: current.x,
          y: current.y,
          text: current.value,
        })
      }
      return null
    })
  }

  // Explicit delete for the text box currently being edited — used by the
  // small trash button next to it, so removing text doesn't rely on typing
  // it away first.
  const deleteEditingText = () => {
    setEditingText(null)
  }

  const handleStart = (e) => {
    const canvas = canvasRef.current
    const pos = pointerPos(canvas, e)

    if (tool === 'text') {
      // If a text box is already open, clicking elsewhere on the board
      // commits/deletes it first (same as clicking away), then opens the
      // new one — so you never lose what you just typed.
      if (editingText) commitTextEdit()

      const ctx = canvas.getContext('2d')
      // Clicking on top of an existing text re-opens it for editing/delete
      // instead of stacking a new box on top of it.
      const hit = [...elements].reverse().find((el) => {
        if (el.type !== 'text') return false
        const b = textBounds(ctx, el)
        return pos.x >= b.x && pos.x <= b.x + b.width && pos.y >= b.y && pos.y <= b.y + b.height
      })

      if (hit) {
        setElements((prev) => prev.filter((el) => el !== hit))
        setEditingText({ x: hit.x, y: hit.y, value: hit.text, color: hit.color, fontSize: hit.fontSize })
      } else {
        setEditingText({ x: pos.x, y: pos.y, value: '', color, fontSize: 14 + size * 3 })
      }
      return
    }

    drawingRef.current =
      tool === 'pen' || tool === 'eraser'
        ? { type: 'path', color, size: tool === 'eraser' ? size * 4 : size, erase: tool === 'eraser', points: [pos] }
        : { type: tool, color, size, x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y }

    const move = (moveEvent) => handleMove(moveEvent)
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      window.removeEventListener('touchmove', move)
      window.removeEventListener('touchend', up)
      if (drawingRef.current) {
        commitElement(drawingRef.current)
        drawingRef.current = null
      }
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    window.addEventListener('touchmove', move, { passive: false })
    window.addEventListener('touchend', up)
  }

  const undo = () => {
    if (!elements.length) return
    setRedoStack((r) => [...r, elements[elements.length - 1]])
    setElements((prev) => prev.slice(0, -1))
  }

  const redo = () => {
    if (!redoStack.length) return
    setElements((prev) => [...prev, redoStack[redoStack.length - 1]])
    setRedoStack((r) => r.slice(0, -1))
  }

  const clearAll = () => {
    if (elements.length && !window.confirm('Clear the whole whiteboard?')) return
    setEditingText(null)
    setElements([])
    setRedoStack([])
  }

  const handleDownload = () => {
    const link = document.createElement('a')
    link.download = `${(data.label || 'whiteboard').replace(/\s+/g, '-')}.png`
    link.href = canvasRef.current.toDataURL('image/png')
    link.click()
  }

  const handleSave = () => {
    // Any text box still open should be saved (or dropped if empty) before
    // the thumbnail is rendered, otherwise it would be silently lost.
    let finalElements = elements
    if (editingText && editingText.value.trim()) {
      const finalText = {
        type: 'text',
        color: editingText.color,
        fontSize: editingText.fontSize,
        x: editingText.x,
        y: editingText.y,
        text: editingText.value,
      }
      finalElements = [...elements, finalText]
      drawElement(canvasRef.current.getContext('2d'), finalText)
    }
    const thumbnail = canvasRef.current.toDataURL('image/png')
    updateNodeData(nodeId, { whiteboard: { elements: finalElements, thumbnail, updatedAt: Date.now() } })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-black/50 p-2 sm:p-6"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col overflow-hidden rounded-lg bg-[var(--color-cream)] shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-sage)] px-3 py-2">
          <p className="truncate text-sm font-medium">Whiteboard — {data.label}</p>
          <button onClick={onClose} className="shrink-0 rounded p-1 hover:bg-[var(--color-sage)]/40" title="Close">
            <X size={16} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-sage)] px-3 py-2">
          <div className="flex flex-wrap gap-1 rounded-md border border-[var(--color-sage)] p-1">
            {TOOLS.map((t) => (
              <button
                key={t.key}
                title={t.label}
                onClick={() => {
                  if (tool === 'text' && t.key !== 'text') commitTextEdit()
                  setTool(t.key)
                }}
                className={`rounded p-1.5 ${tool === t.key ? 'bg-[var(--color-accent)]' : 'hover:bg-[var(--color-sage)]/50'}`}
              >
                <t.icon size={14} />
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            {PALETTE.map((c) => (
              <button
                key={c}
                onClick={() => {
                  setColor(c)
                  if (editingText) setEditingText((cur) => (cur ? { ...cur, color: c } : cur))
                }}
                title={c}
                className={`h-5 w-5 rounded-full border ${color === c ? 'ring-2 ring-[var(--color-accent)] ring-offset-1' : ''}`}
                style={{ backgroundColor: c, borderColor: 'var(--color-slate)' }}
              />
            ))}
            <input
              type="color"
              value={color}
              onChange={(e) => {
                setColor(e.target.value)
                if (editingText) setEditingText((cur) => (cur ? { ...cur, color: e.target.value } : cur))
              }}
              title="Custom color"
              className="h-5 w-5 cursor-pointer rounded-full border-none bg-transparent p-0"
            />
          </div>

          <label className="flex items-center gap-1 text-[11px] text-[var(--color-slate)]">
            Size
            <input
              type="range"
              min="1"
              max="20"
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              className="w-20 accent-[var(--color-accent)]"
            />
          </label>

          {tool === 'text' && (
            <p className="text-[10px] italic text-[var(--color-slate)]">Board pe kahin bhi click karo aur type karo.</p>
          )}

          <div className="ml-auto flex items-center gap-1">
            <button onClick={undo} disabled={!elements.length} title="Undo" className="rounded p-1.5 hover:bg-[var(--color-sage)]/50 disabled:opacity-30">
              <Undo2 size={14} />
            </button>
            <button onClick={redo} disabled={!redoStack.length} title="Redo" className="rounded p-1.5 hover:bg-[var(--color-sage)]/50 disabled:opacity-30">
              <Redo2 size={14} />
            </button>
            <button onClick={clearAll} title="Clear all" className="rounded p-1.5 hover:bg-[var(--color-sage)]/50">
              <Trash2 size={14} />
            </button>
            <button onClick={handleDownload} title="Download as image" className="rounded p-1.5 hover:bg-[var(--color-sage)]/50">
              <Download size={14} />
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div className="relative flex-1 overflow-auto bg-[var(--color-sage)]/20 p-3">
          <div className="relative mx-auto" style={{ width: '100%', maxWidth: CANVAS_W, aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}>
            <canvas
              ref={canvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              onMouseDown={handleStart}
              onTouchStart={handleStart}
              className="h-full w-full touch-none rounded-md border border-[var(--color-sage)] bg-white shadow-inner"
            />

            {/* Inline text box — sits directly on the board at the clicked
                spot. No popup/prompt: type straight into it, Escape or the
                trash icon deletes it, clicking elsewhere or Save commits it. */}
            {editingText && (
              <div
                className="absolute flex items-start gap-1"
                style={{
                  left: `${(editingText.x / CANVAS_W) * 100}%`,
                  top: `${(editingText.y / CANVAS_H) * 100}%`,
                }}
              >
                <textarea
                  ref={textAreaRef}
                  rows={1}
                  value={editingText.value}
                  onChange={(e) => {
                    const v = e.target.value
                    setEditingText((cur) => (cur ? { ...cur, value: v } : cur))
                    e.target.style.height = 'auto'
                    e.target.style.height = `${e.target.scrollHeight}px`
                  }}
                  onBlur={commitTextEdit}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      e.preventDefault()
                      deleteEditingText()
                    }
                  }}
                  placeholder="Type…"
                  style={{
                    color: editingText.color,
                    fontSize: editingText.fontSize,
                    lineHeight: 1.25,
                    minWidth: 40,
                  }}
                  className="resize-none overflow-hidden border border-dashed border-[var(--color-accent)] bg-white/70 px-1 outline-none"
                />
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={deleteEditingText}
                  title="Delete text"
                  className="shrink-0 rounded bg-[var(--color-cream)] p-0.5 text-[var(--color-slate)] shadow hover:text-red-600"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-[var(--color-sage)] px-3 py-2">
          <p className="text-[10px] text-[var(--color-slate)]">Draws, shapes aur text sab is node ke saath save honge.</p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-md border border-[var(--color-slate)] px-3 py-1.5 text-[11px] hover:bg-[var(--color-sage)]/30"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1 rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-[11px] font-medium hover:opacity-90"
            >
              <Check size={12} /> Save & attach to node
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
