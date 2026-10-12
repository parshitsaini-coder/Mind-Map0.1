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
// category: 'line' | 'animated' | 'color' | 'icon' — used to group the
// styles into sections inside the Connector Styles panel.
export const CONNECTOR_STYLES = [
  { label: 'Straight — Solid', pathType: 'straight', category: 'line' },
  { label: 'Straight — Dashed', pathType: 'straight', dash: '6 4', category: 'line' },
  { label: 'Straight — Dotted', pathType: 'straight', dash: '1.5 4', cap: 'round', category: 'line' },
  { label: 'Straight — Arrow', pathType: 'straight', arrowEnd: true, category: 'line' },
  { label: 'Bezier — Curved Solid', pathType: 'bezier', category: 'line' },
  { label: 'Bezier — Curved Dashed', pathType: 'bezier', dash: '6 4', category: 'line' },
  { label: 'Bezier — Animated Flow', pathType: 'bezier', dash: '6 4', animated: true, color: '#f5cb5c', category: 'animated' },
  { label: 'Bezier — Double Arrow', pathType: 'bezier', arrowEnd: true, arrowStart: true, category: 'line' },
  { label: 'Smoothstep — Rounded Elbow', pathType: 'smoothstep', category: 'line' },
  { label: 'Smoothstep — Dashed Elbow', pathType: 'smoothstep', dash: '5 3', category: 'line' },
  { label: 'Step — Sharp Corners', pathType: 'step', category: 'line' },
  { label: 'Simple Bezier — Soft Curve', pathType: 'simplebezier', category: 'line' },
  { label: 'Thick Branch (4px)', pathType: 'bezier', strokeWidth: 4, color: '#e07856', category: 'color' },
  { label: 'Thin Hairline — Dotted', pathType: 'straight', strokeWidth: 1, dash: '1 3', cap: 'round', category: 'line' },
  { label: 'Dash-Dot Pattern', pathType: 'bezier', dash: '8 3 2 3', category: 'line' },
  { label: 'Curved + Icon-in-Middle (Star)', pathType: 'bezier', iconMid: 'Star', color: '#f5cb5c', category: 'icon' },
  { label: 'Curved + Icon-in-Middle (Flag)', pathType: 'smoothstep', iconMid: 'Flag', color: '#4fb0a5', category: 'icon' },
  { label: 'Animated Arrow Flow', pathType: 'smoothstep', dash: '6 4', animated: true, arrowEnd: true, color: '#8a7fd1', category: 'animated' },
  { label: 'Elbow — Long Dash', pathType: 'step', dash: '10 4', color: '#606c38', category: 'color' },
  { label: 'Curved — Thin Accent', pathType: 'simplebezier', strokeWidth: 1, color: '#bc6c25', category: 'color' },
  { label: 'Straight — Thick Bold', pathType: 'straight', strokeWidth: 5, color: '#242423', category: 'color' },
  { label: 'Smoothstep + Icon (Heart)', pathType: 'smoothstep', iconMid: 'Heart', color: '#e07856', category: 'icon' },
  { label: 'Bezier — Long Dash Arrow', pathType: 'bezier', dash: '12 5', arrowEnd: true, color: '#4a6fa5', category: 'color' },
  { label: 'Step — Dotted Thin', pathType: 'step', dash: '1.5 4', cap: 'round', strokeWidth: 1, category: 'line' },
  { label: 'Pulse — Animated Dots', pathType: 'straight', dash: '2 6', cap: 'round', animated: true, color: '#4fb0a5', category: 'animated' },
  { label: 'Animated — Elbow Flow', pathType: 'step', dash: '5 3', animated: true, color: '#e07856', category: 'animated' },

  // Section — "Effects" category: 12 extra styles beyond the base line/
  // color/icon sets, built around three new visual mechanics that
  // ConnectorDemoEdge/CustomEdge render: a persistent breathing glow
  // (`glow` + `.connector-glow-pulse`), a two-stop gradient stroke
  // (`gradient: [from, to]`, painted via a per-edge <linearGradient>), and
  // a breathing line thickness (`pulseWidth` + `.connector-width-pulse`).
  { label: 'Neon Glow — Straight', pathType: 'straight', color: '#f5cb5c', strokeWidth: 2.5, glow: true, category: 'effect' },
  { label: 'Neon Glow — Curved', pathType: 'bezier', color: '#4fb0a5', strokeWidth: 2.5, glow: true, category: 'effect' },
  { label: 'Electric Pulse — Arrow', pathType: 'smoothstep', dash: '4 4', animated: true, glow: true, arrowEnd: true, color: '#8a7fd1', category: 'effect' },
  { label: 'Gradient Flow — Sunrise', pathType: 'bezier', gradient: ['#f5cb5c', '#e07856'], strokeWidth: 3, category: 'effect' },
  { label: 'Gradient Flow — Ocean', pathType: 'simplebezier', gradient: ['#4fb0a5', '#4a6fa5'], strokeWidth: 3, category: 'effect' },
  { label: 'Gradient Flow — Berry', pathType: 'smoothstep', gradient: ['#9163cb', '#e0607e'], strokeWidth: 3, category: 'effect' },
  { label: 'Rainbow Arrow', pathType: 'bezier', gradient: ['#4361ee', '#f5cb5c'], arrowEnd: true, strokeWidth: 2.5, category: 'effect' },
  { label: 'Pulsing Width — Curved', pathType: 'bezier', color: '#242423', pulseWidth: true, category: 'effect' },
  { label: 'Pulsing Width — Arrow', pathType: 'straight', color: '#e07856', arrowEnd: true, pulseWidth: true, category: 'effect' },
  { label: 'Dashed Glow — Elbow', pathType: 'step', dash: '6 4', color: '#6a9955', glow: true, category: 'effect' },
  { label: 'Soft Glow Halo', pathType: 'smoothstep', color: '#5c7a89', strokeWidth: 3, glow: true, category: 'effect' },
  { label: 'Comet Trail — Glow Arrow', pathType: 'bezier', dash: '3 7', animated: true, glow: true, arrowEnd: true, color: '#f5cb5c', category: 'effect' },
]

// Ordered list of category sections shown in the Connector Styles panel.
export const CONNECTOR_STYLE_CATEGORIES = [
  { key: 'line', label: 'Line Styles' },
  { key: 'animated', label: 'Animated' },
  { key: 'color', label: 'Colors' },
  { key: 'icon', label: 'Icons' },
  { key: 'effect', label: 'Effects \u2728' },
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
        glow: !!style.glow,
        gradient: style.gradient || null,
        pulseWidth: !!style.pulseWidth,
      },
    })
  })

  return { nodes, edges }
}
