import { useState, useRef, useEffect } from 'react'
import { useWhiteboardStore } from '../../store/whiteboardStore'

// Renders one whiteboard element (a free-positioned text box, a sticky note,
// or a freehand pen stroke) and owns its own drag / resize / edit
// interactions. Coordinates are all in board space — the parent canvas
// applies the pan/zoom transform once, so children here just use their raw
// x/y/points and divide client deltas by the current zoom.
export default function WhiteboardElement({ element, isSelected, tool, zoom, onSelect, autoFocusEdit }) {
  const [editing, setEditing] = useState(false)
  const textareaRef = useRef(null)

  useEffect(() => {
    if (autoFocusEdit && (element.type === 'text' || element.type === 'sticky')) {
      setEditing(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocusEdit])

  useEffect(() => {
    if (editing) textareaRef.current?.focus()
  }, [editing])

  const startDrag = (e) => {
    if (tool !== 'select' || editing) return
    e.stopPropagation()
    onSelect(element.id)
    const startClientX = e.clientX
    const startClientY = e.clientY
    const store = useWhiteboardStore.getState()
    store.pushSnapshot()
    const startX = element.x
    const startY = element.y
    const startPoints = element.points

    const onMove = (ev) => {
      const dx = (ev.clientX - startClientX) / zoom
      const dy = (ev.clientY - startClientY) / zoom
      if (element.type === 'path') {
        useWhiteboardStore.getState().setElementPoints(
          element.id,
          startPoints.map((p) => ({ x: p.x + dx, y: p.y + dy }))
        )
      } else {
        useWhiteboardStore.getState().setElementPosition(element.id, startX + dx, startY + dy)
      }
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const startResize = (e) => {
    e.stopPropagation()
    onSelect(element.id)
    const startClientX = e.clientX
    const startClientY = e.clientY
    const startW = element.width
    const startH = element.height
    useWhiteboardStore.getState().pushSnapshot()

    const onMove = (ev) => {
      const dx = (ev.clientX - startClientX) / zoom
      const dy = (ev.clientY - startClientY) / zoom
      useWhiteboardStore
        .getState()
        .setElementSize(element.id, Math.max(90, startW + dx), Math.max(44, startH + dy))
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  if (element.type === 'path') {
    const xs = element.points.map((p) => p.x)
    const ys = element.points.map((p) => p.y)
    const minX = Math.min(...xs) - 12
    const minY = Math.min(...ys) - 12
    const d = element.points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x - minX} ${p.y - minY}`)
      .join(' ')
    const w = Math.max(...xs) - Math.min(...xs) + 24
    const h = Math.max(...ys) - Math.min(...ys) + 24
    return (
      <svg
        style={{ position: 'absolute', left: minX, top: minY, width: w, height: h, overflow: 'visible', cursor: tool === 'select' ? 'move' : 'default' }}
        onMouseDown={startDrag}
        onClick={(e) => {
          if (tool === 'select') {
            e.stopPropagation()
            onSelect(element.id)
          }
        }}
      >
        {/* Wider transparent stroke = easier hit target than the visible line */}
        <path d={d} fill="none" stroke="transparent" strokeWidth={Math.max(16, element.strokeWidth + 12)} strokeLinecap="round" strokeLinejoin="round" />
        <path
          d={d}
          fill="none"
          stroke={element.color}
          strokeWidth={element.strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ filter: isSelected ? 'drop-shadow(0 0 0 1px var(--color-accent))' : undefined }}
        />
        {isSelected && (
          <rect x={0} y={0} width={w} height={h} fill="none" stroke="var(--color-accent)" strokeDasharray="4 3" strokeWidth={1.5} rx={6} />
        )}
      </svg>
    )
  }

  const isSticky = element.type === 'sticky'

  return (
    <div
      onMouseDown={startDrag}
      onDoubleClick={(e) => {
        if (tool !== 'select') return
        e.stopPropagation()
        onSelect(element.id)
        setEditing(true)
      }}
      onClick={(e) => {
        if (tool === 'select') {
          e.stopPropagation()
          onSelect(element.id)
        }
      }}
      style={{
        position: 'absolute',
        left: element.x,
        top: element.y,
        width: element.width,
        height: element.height,
        background: isSticky ? element.color : 'transparent',
        border: isSticky ? '1px solid rgba(0,0,0,0.12)' : isSelected ? '1.5px dashed var(--color-accent)' : '1.5px dashed transparent',
        borderRadius: isSticky ? 6 : 4,
        boxShadow: isSticky ? '0 3px 8px rgba(0,0,0,0.18)' : isSelected ? '0 0 0 1px var(--color-accent)' : 'none',
        cursor: tool === 'select' ? (editing ? 'text' : 'move') : 'default',
        padding: 8,
        display: 'flex',
      }}
    >
      {editing ? (
        <textarea
          ref={textareaRef}
          value={element.content || ''}
          placeholder="Type something…"
          onChange={(e) => useWhiteboardStore.getState().updateElementBurst(element.id, { content: e.target.value })}
          onBlur={() => setEditing(false)}
          onMouseDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Escape') {
              e.currentTarget.blur()
            }
          }}
          style={{
            width: '100%',
            height: '100%',
            resize: 'none',
            outline: 'none',
            background: 'transparent',
            border: 'none',
            fontSize: element.fontSize || (isSticky ? 13 : 14),
            fontWeight: isSticky ? 500 : 500,
            color: isSticky ? '#242423' : element.color,
            fontFamily: 'inherit',
          }}
        />
      ) : (
        <span
          style={{
            width: '100%',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontSize: element.fontSize || (isSticky ? 13 : 14),
            fontWeight: 500,
            color: isSticky ? '#242423' : element.color,
            opacity: element.content ? 1 : 0.45,
          }}
        >
          {element.content || 'Double-click to type…'}
        </span>
      )}

      {isSelected && tool === 'select' && (
        <div
          onMouseDown={startResize}
          title="Resize"
          style={{
            position: 'absolute',
            right: -4,
            bottom: -4,
            width: 12,
            height: 12,
            borderRadius: 3,
            background: 'var(--color-accent)',
            border: '1px solid var(--color-ink)',
            cursor: 'nwse-resize',
          }}
        />
      )}
    </div>
  )
}
