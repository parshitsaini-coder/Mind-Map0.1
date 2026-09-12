import { useEffect, useMemo } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useViewerStore } from '../../store/viewerStore'
import ViewerNode from './ViewerNode'
import ViewerBoundaryGroup from './ViewerBoundaryGroup'
import CustomEdge from '../canvas/CustomEdge'
import CrossEdge from '../canvas/CrossEdge'
import ConnectorDemoEdge from '../canvas/ConnectorDemoEdge'
import { computeHidden } from '../../utils/graphUtils'
import { applyThemeVars } from '../../theme/tokens'
import ImageLightbox from '../common/ImageLightbox'
import ViewerTradeDetailModal from './ViewerTradeDetailModal'

function ViewerInner() {
  const nodes = useViewerStore((s) => s.nodes)
  const edges = useViewerStore((s) => s.edges)

  const nodeTypes = useMemo(() => ({ mindNode: ViewerNode, boundaryGroup: ViewerBoundaryGroup }), [])
  const edgeTypes = useMemo(() => ({ mindEdge: CustomEdge, crossEdge: CrossEdge, demoEdge: ConnectorDemoEdge }), [])

  // revealManualHidden: true — match the editor canvas's own behavior
  // (MindMapCanvas.jsx). A manually-hidden node's own content stays
  // hidden, but its descendants are shown as normal. Previously this left
  // the default `false`, which cascade-hides the entire downstream branch
  // of any hidden node — fine for genuinely private content, but
  // surprising for the common case of just tidying up one node, since it
  // silently swallowed everything after it in the live/shared view even
  // though the owner's own canvas kept showing it.
  const { hiddenNodeIds, hiddenEdgeIds } = useMemo(
    () => computeHidden(nodes, edges, { revealManualHidden: true }),
    [nodes, edges]
  )
  const visibleNodes = nodes.filter((n) => !hiddenNodeIds.has(n.id))
  const visibleEdges = edges.filter((e) => !hiddenEdgeIds.has(e.id))

  return (
    <div className="relative h-screen w-screen overflow-hidden" style={{ backgroundColor: 'var(--color-bg-main)' }}>
      <ReactFlow
        nodes={visibleNodes}
        edges={visibleEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        onNodeClick={() => {}}
        panOnDrag
        fitView
        minZoom={0.15}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="var(--color-sage)" />
        <Controls showInteractive={false} className="!shadow-md !rounded-md overflow-hidden" />
        <MiniMap
          pannable
          zoomable
          nodeColor={() => 'var(--color-accent)'}
          maskColor="rgba(236,235,228,0.6)"
          className="!rounded-md !shadow-md"
        />
      </ReactFlow>

      <div
        className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-medium shadow"
        style={{ backgroundColor: 'var(--color-ink)', color: 'var(--color-cream)' }}
      >
        View only — shared mind map
      </div>
    </div>
  )
}

// Section — shared-link viewer. Rendered by main.jsx *instead of* the full
// <App/> whenever the URL carries a `?map=` param, so someone opening a
// shared link only ever sees the mind map itself (canvas + expand/collapse),
// with no top toolbar, tabs bar, or side panels, and never touches the
// viewer's own saved projects.
export default function SharedMapView({ nodes, edges, checklists = [], trades = [], validationRules = [], themeName }) {
  useEffect(() => {
    applyThemeVars(themeName || 'default')
    useViewerStore.getState().setMap(nodes, edges, { checklists, trades, validationRules })
  }, [nodes, edges, checklists, trades, validationRules, themeName])

  return (
    <ReactFlowProvider>
      <ViewerInner />
      <ImageLightbox />
      <ViewerTradeDetailModal />
    </ReactFlowProvider>
  )
}
