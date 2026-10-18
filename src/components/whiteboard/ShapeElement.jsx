import { useMemo } from 'react'
import { useWhiteboardStore } from '../../store/whiteboardStore'
import { TOOLS, build, shapeBounds, lineExtras } from './drawShapes'

const DASH = { solid: undefined, dashed: '9 6', dotted: '2 6' }

// Renders one TradingView-style drawing (see drawShapes.jsx). Visible pass is
// click-through; a second transparent "hit" pass with fat strokes handles drag,
// select, double-click-to-edit and the eraser (`data-wb-id`). Selected shapes
// show a dashed box plus a draggable handle on every anchor point.
export default function ShapeElement({ element, isSelected, tool, zoom, onSelect, onEditText, preview, locked }) {
  const spec = TOOLS[element.tool]
  const pts = element.points

  const opts = {
    c: element.color || '#2563eb',
    w: element.strokeWidth || 2,
    dash: DASH[element.lineStyle],
    fill: !!element.fill,
    fo: element.fillOpacity ?? 0.18,
    fc: element.fillColor,
    text: element.text,
    fs: element.fontSize || (element.tool === 'emoji' ? 36 : 12),
    emoji: element.emoji,
  }

  const visible = useMemo(
    () =>
      spec?.render
        ? build(opts, (H) => {
            spec.render(pts, H)
            if (spec.lineLike) lineExtras(element, pts, H)
          })
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spec, pts, opts.c, opts.w, opts.dash, opts.fill, opts.fo, opts.fc, opts.text, opts.fs, opts.emoji, element.arrowStart, element.arrowEnd, element.extendL, element.extendR]
  )
  const hitPass = useMemo(
    () =>
      spec?.render && !preview
        ? build({ ...opts, hit: true }, (H) => {
            spec.render(pts, H)
            if (spec.lineLike) lineExtras(element, pts, H)
          })
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spec, pts, opts.w, opts.fill, opts.text, opts.fs, opts.emoji, preview, element.arrowStart, element.arrowEnd, element.extendL, element.extendR]
  )

  if (!spec?.render || !pts?.length) return null

  const canMove = tool === 'select' && !locked && !preview

  const startDrag = (e) => {
    if (tool !== 'select' || preview) return
    e.stopPropagation()
    onSelect(element.id)
    if (locked) return
    const sx = e.clientX
    const sy = e.clientY
    const start = element.points
    useWhiteboardStore.getState().pushSnapshot()
    const onMove = (ev) => {
      const dx = (ev.clientX - sx) / zoom
      const dy = (ev.clientY - sy) / zoom
      useWhiteboardStore.getState().setElementPoints(element.id, start.map((p) => ({ x: p.x + dx, y: p.y + dy })))
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const startHandleDrag = (i) => (e) => {
    e.stopPropagation()
    if (locked) return
    const sx = e.clientX
    const sy = e.clientY
    const start = element.points
    useWhiteboardStore.getState().pushSnapshot()
    const onMove = (ev) => {
      const dx = (ev.clientX - sx) / zoom
      const dy = (ev.clientY - sy) / zoom
      useWhiteboardStore.getState().setElementPoints(element.id, start.map((p, j) => (j === i ? { x: p.x + dx, y: p.y + dy } : p)))
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const b = shapeBounds(element)
  const hr = 5 / zoom

  return (
    <svg
      data-wb-id={element.id}
      style={{ position: 'absolute', left: 0, top: 0, width: 1, height: 1, overflow: 'visible', pointerEvents: 'none', opacity: (element.opacity ?? 1) * (preview ? 0.85 : 1) }}
    >
      <g className={preview ? undefined : 'wb-shape-in'}>{visible}</g>
      {hitPass && (
        <g
          onMouseDown={startDrag}
          onClick={(e) => {
            if (tool === 'select') {
              e.stopPropagation()
              onSelect(element.id)
            }
          }}
          onDoubleClick={(e) => {
            if (tool !== 'select' || !spec.text) return
            e.stopPropagation()
            onEditText?.(element.id)
          }}
          style={{ cursor: canMove ? 'move' : 'default' }}
        >
          {hitPass}
        </g>
      )}
      {isSelected && !preview && (
        <g style={{ pointerEvents: 'none' }}>
          <rect x={b.x - 6} y={b.y - 6} width={b.width + 12} height={b.height + 12} fill="none" stroke="var(--color-accent)" strokeDasharray="4 3" strokeWidth={1.2 / zoom} rx={4} className="wb-ants" />
        </g>
      )}
      {isSelected && !preview && tool === 'select' && !locked &&
        pts.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={hr}
            fill="#fff"
            stroke="var(--color-accent)"
            strokeWidth={1.6 / zoom}
            className="wb-handle"
            style={{ pointerEvents: 'all', cursor: 'crosshair' }}
            onMouseDown={startHandleDrag(i)}
          />
        ))}
    </svg>
  )
}
