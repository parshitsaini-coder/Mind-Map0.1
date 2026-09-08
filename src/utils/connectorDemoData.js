// Section 4.8 — "15+ example connector lines styles should be visually
// demoed on a demo/sample map (curved, straight, dashed, with arrow,
// with icon-in-middle)".
//
// Generates a standalone sample map: one caption node + one dot node per
// row, joined by a `demoEdge` (see ConnectorDemoEdge.jsx) whose `data`
// describes exactly how that row's line should look. Loaded via the
// toolbar's "Connector styles demo" button / mapStore.loadConnectorDemo().

const ROW_H = 68
const SOURCE_X = 0
const TARGET_X = 380

// pathType: 'straight' | 'bezier' | 'smoothstep' | 'step' | 'simplebezier'
export const CONNECTOR_STYLES = [
  { label: 'Straight — Solid', pathType: 'straight' },
  { label: 'Straight — Dashed', pathType: 'straight', dash: '6 4' },
  { label: 'Straight — Dotted', pathType: 'straight', dash: '1.5 4', cap: 'round' },
  { label: 'Straight — Arrow', pathType: 'straight', arrowEnd: true },
  { label: 'Bezier — Curved Solid', pathType: 'bezier' },
  { label: 'Bezier — Curved Dashed', pathType: 'bezier', dash: '6 4' },
  { label: 'Bezier — Animated Flow', pathType: 'bezier', dash: '6 4', animated: true, color: '#f5cb5c' },
  { label: 'Bezier — Double Arrow', pathType: 'bezier', arrowEnd: true, arrowStart: true },
  { label: 'Smoothstep — Rounded Elbow', pathType: 'smoothstep' },
  { label: 'Smoothstep — Dashed Elbow', pathType: 'smoothstep', dash: '5 3' },
  { label: 'Step — Sharp Corners', pathType: 'step' },
  { label: 'Simple Bezier — Soft Curve', pathType: 'simplebezier' },
  { label: 'Thick Branch (4px)', pathType: 'bezier', strokeWidth: 4, color: '#e07856' },
  { label: 'Thin Hairline — Dotted', pathType: 'straight', strokeWidth: 1, dash: '1 3', cap: 'round' },
  { label: 'Dash-Dot Pattern', pathType: 'bezier', dash: '8 3 2 3' },
  { label: 'Curved + Icon-in-Middle (Star)', pathType: 'bezier', iconMid: 'Star', color: '#f5cb5c' },
  { label: 'Curved + Icon-in-Middle (Flag)', pathType: 'smoothstep', iconMid: 'Flag', color: '#4fb0a5' },
  { label: 'Animated Arrow Flow', pathType: 'smoothstep', dash: '6 4', animated: true, arrowEnd: true, color: '#8a7fd1' },
  { label: 'Elbow — Long Dash', pathType: 'step', dash: '10 4', color: '#606c38' },
  { label: 'Curved — Thin Accent', pathType: 'simplebezier', strokeWidth: 1, color: '#bc6c25' },
  { label: 'Straight — Thick Bold', pathType: 'straight', strokeWidth: 5, color: '#242423' },
  { label: 'Smoothstep + Icon (Heart)', pathType: 'smoothstep', iconMid: 'Heart', color: '#e07856' },
  { label: 'Bezier — Long Dash Arrow', pathType: 'bezier', dash: '12 5', arrowEnd: true, color: '#4a6fa5' },
  { label: 'Step — Dotted Thin', pathType: 'step', dash: '1.5 4', cap: 'round', strokeWidth: 1 },
]

export function buildConnectorDemo() {
  const nodes = []
  const edges = []

  CONNECTOR_STYLES.forEach((style, i) => {
    const y = i * ROW_H
    const sourceId = `demo_src_${i}`
    const targetId = `demo_tgt_${i}`

    nodes.push({
      id: sourceId,
      type: 'mindNode',
      position: { x: SOURCE_X, y },
      draggable: true,
      data: { label: style.label, shape: 'no-border', color: 'transparent' },
    })
    nodes.push({
      id: targetId,
      type: 'mindNode',
      position: { x: TARGET_X, y },
      draggable: true,
      data: { label: '•', shape: 'oval', color: '#cfdbd5' },
    })

    edges.push({
      id: `demo_edge_${i}`,
      source: sourceId,
      target: targetId,
      type: 'demoEdge',
      markerEnd: style.arrowEnd ? { type: 'arrowclosed', color: style.color || '#333533', width: 16, height: 16 } : undefined,
      markerStart: style.arrowStart ? { type: 'arrowclosed', color: style.color || '#333533', width: 16, height: 16 } : undefined,
      data: {
        pathType: style.pathType,
        dash: style.dash,
        strokeWidth: style.strokeWidth || 2,
        color: style.color || '#333533',
        animated: !!style.animated,
        iconMid: style.iconMid || null,
        cap: style.cap,
      },
    })
  })

  return { nodes, edges }
}
