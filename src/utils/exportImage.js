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
    PADDING * scale
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
