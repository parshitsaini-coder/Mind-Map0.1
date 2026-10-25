import { memo, useMemo } from 'react'
import { useWhiteboardStore } from '../../store/whiteboardStore'
import { TOOLS, build, shapeBounds, lineExtras } from './drawShapes'

const DASH = { solid: undefined, dashed: '9 6', dotted: '2 6' }

// Renders one TradingView-style drawing (see drawShapes.jsx). Visible pass is
// click-through; a second transparent "hit" pass with fat strokes handles drag,
// select, double-click-to-edit and the eraser (`data-wb-id`). Selected shapes
// show a dashed box plus a draggable handle on every anchor point.
function ShapeElement({ element, isSelected, tool, zoom, onSelect, onEditText, preview, locked }) {
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
    cw: element.candleW,
    ch: element.candleH,
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
    [spec, pts, opts.c, opts.w, opts.dash, opts.fill, opts.fo, opts.fc, opts.text, opts.fs, opts.emoji, opts.cw, opts.ch, element.arrowStart, element.arrowEnd, element.extendL, element.extendR]
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

  // Candles: 8 resize handles (corners + sides). The candle scales
  // symmetrically around its anchor point, so the handle simply follows the
  // pointer and width/height factors are derived from its distance to the
  // anchor — sides change one axis, corners both.
  const isCandle = !!spec.candle
  const startCandleResize = (hx, hy, axisX, axisY) => (e) => {
    e.stopPropagation()
    e.preventDefault()
    if (locked) return
    const sx = e.clientX
    const sy = e.clientY
    const ax = pts[0].x
    const ay = pts[0].y
    const kw0 = element.candleW ?? 1
    const kh0 = element.candleH ?? 1
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
    useWhiteboardStore.getState().pushSnapshot()
    const onMove = (ev) => {
      const nx = hx + (ev.clientX - sx) / zoom
      const ny = hy + (ev.clientY - sy) / zoom
      const patch = {}
      if (axisX) patch.candleW = Math.round(clamp(Math.max(0, Math.abs(nx - ax) - 6) / 12, 0.3, 6) * 100) / 100
      if (axisY) patch.candleH = Math.round(clamp(Math.max(0, Math.abs(ny - ay) - 6) / 58, 0.3, 8) * 100) / 100
      if (axisX && !axisY) patch.candleH = kh0
      if (axisY && !axisX) patch.candleW = kw0
      useWhiteboardStore.getState().setElementStyle(element.id, patch)
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }
  const candleHandles = isCandle
    ? [
        // [x, y, axisX, axisY, cursor]
        [b.x - 6, b.y - 6, true, true, 'nwse-resize'],
        [b.x + b.width / 2, b.y - 6, false, true, 'ns-resize'],
        [b.x + b.width + 6, b.y - 6, true, true, 'nesw-resize'],
        [b.x + b.width + 6, b.y + b.height / 2, true, false, 'ew-resize'],
        [b.x + b.width + 6, b.y + b.height + 6, true, true, 'nwse-resize'],
        [b.x + b.width / 2, b.y + b.height + 6, false, true, 'ns-resize'],
        [b.x - 6, b.y + b.height + 6, true, true, 'nesw-resize'],
        [b.x - 6, b.y + b.height / 2, true, false, 'ew-resize'],
      ]
    : null

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
      {isSelected && !preview && tool === 'select' && !locked && candleHandles &&
        candleHandles.map(([hx, hy, ax, ay, cur], i) => (
          <rect
            key={`rs${i}`}
            x={hx - hr}
            y={hy - hr}
            width={hr * 2}
            height={hr * 2}
            rx={1.5 / zoom}
            fill="#fff"
            stroke="var(--color-accent)"
            strokeWidth={1.6 / zoom}
            className="wb-handle"
            style={{ pointerEvents: 'all', cursor: cur }}
            onMouseDown={startCandleResize(hx, hy, ax, ay)}
          />
        ))}
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

export default memo(ShapeElement)
