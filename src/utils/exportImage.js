import { toPng } from 'html-to-image'
import { getNodesBounds, getViewportForBounds } from '@xyflow/react'
import { jsPDF } from 'jspdf'

// Canvas background — kept in sync with --color-bg-main in index.css.
const CANVAS_BG = '#ecebe4'

const MAX_DIMENSION = 4096
const PADDING = 60 // px of breathing room around the outermost nodes

/**
 * Renders the current map (all nodes, not just what's on screen) to a PNG
 * data URL by temporarily re-framing React Flow's viewport element and
 * rasterizing it with html-to-image.
 */
async function renderMapToDataUrl(nodes) {
  const visibleNodes = nodes.filter((n) => n.type !== 'boundaryGroup' || true)
  if (!visibleNodes.length) {
    throw new Error('Nothing to export — the map is empty.')
  }

  const viewportEl = document.querySelector('.react-flow__viewport')
  if (!viewportEl) {
    throw new Error('Could not find the canvas to export.')
  }

  const bounds = getNodesBounds(visibleNodes)
  const rawWidth = bounds.width + PADDING * 2
  const rawHeight = bounds.height + PADDING * 2

  // Scale down proportionally if the map is huge, so we never ask the
  // browser to rasterize an unreasonably large canvas.
  const scale = Math.min(1, MAX_DIMENSION / Math.max(rawWidth, rawHeight))
  const imageWidth = Math.max(1, Math.round(rawWidth * scale))
  const imageHeight = Math.max(1, Math.round(rawHeight * scale))

  const viewport = getViewportForBounds(
    bounds,
    imageWidth,
    imageHeight,
    0.05,
    2,
    `${PADDING * scale}px`
  )

  const dataUrl = await toPng(viewportEl, {
    backgroundColor: CANVAS_BG,
    width: imageWidth,
    height: imageHeight,
    pixelRatio: 2, // crisp export on retina displays
    style: {
      width: `${imageWidth}px`,
      height: `${imageHeight}px`,
      transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
    },
    filter: (el) => {
      // Skip UI chrome that sometimes gets portalled inside the viewport
      // (e.g. connection-line helper elements) — keep nodes & edges only.
      const cls = el.classList
      if (!cls) return true
      return !cls.contains('react-flow__connectionline')
    },
  })

  return { dataUrl, imageWidth, imageHeight }
}

function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement('a')
  a.setAttribute('download', filename)
  a.setAttribute('href', dataUrl)
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

export async function exportMapAsPng(nodes, filename = 'mindmap.png') {
  const { dataUrl } = await renderMapToDataUrl(nodes)
  downloadDataUrl(dataUrl, filename)
}

function getWhiteboardElementBounds(el) {
  if (el.type === 'path') {
    const xs = el.points.map((p) => p.x)
    const ys = el.points.map((p) => p.y)
    return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) }
  }
  return { x: el.x, y: el.y, width: el.width, height: el.height }
}

/**
 * Rasterizes just the drawn content of the free-form Whiteboard (not the
 * whole viewport — only the area actually covered by notes/drawings, plus
 * padding) to a PNG data URL, regardless of the board's current pan/zoom.
 * Used by the whiteboard's "Add to node" button to save a snapshot of the
 * board as a node's image (see Whiteboard.jsx).
 */
export async function captureWhiteboardAsDataUrl(elements, bgColor = CANVAS_BG) {
  if (!elements.length) {
    throw new Error('The whiteboard is empty — add a note or drawing first.')
  }

  const layerEl = document.querySelector('.whiteboard-elements-layer')
  if (!layerEl) {
    throw new Error('Could not find the whiteboard canvas to capture.')
  }

  const boundsList = elements.map(getWhiteboardElementBounds)
  const minX = Math.min(...boundsList.map((b) => b.x)) - PADDING
  const minY = Math.min(...boundsList.map((b) => b.y)) - PADDING
  const maxX = Math.max(...boundsList.map((b) => b.x + b.width)) + PADDING
  const maxY = Math.max(...boundsList.map((b) => b.y + b.height)) + PADDING
  const rawWidth = Math.max(1, maxX - minX)
  const rawHeight = Math.max(1, maxY - minY)

  const scale = Math.min(1, MAX_DIMENSION / Math.max(rawWidth, rawHeight))
  const imageWidth = Math.max(1, Math.round(rawWidth * scale))
  const imageHeight = Math.max(1, Math.round(rawHeight * scale))

  return toPng(layerEl, {
    backgroundColor: bgColor,
    width: imageWidth,
    height: imageHeight,
    pixelRatio: 2,
    style: {
      width: `${imageWidth}px`,
      height: `${imageHeight}px`,
      transform: `translate(${-minX * scale}px, ${-minY * scale}px) scale(${scale})`,
      transformOrigin: '0 0',
    },
  })
}

export async function exportMapAsPdf(nodes, filename = 'mindmap.pdf') {
  const { dataUrl, imageWidth, imageHeight } = await renderMapToDataUrl(nodes)
  const orientation = imageWidth >= imageHeight ? 'landscape' : 'portrait'

  const pdf = new jsPDF({
    orientation,
    unit: 'px',
    format: [imageWidth, imageHeight],
    compress: true,
  })

  pdf.addImage(dataUrl, 'PNG', 0, 0, imageWidth, imageHeight)
  pdf.save(filename)
}
