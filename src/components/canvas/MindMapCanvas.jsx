import { useMemo, useEffect, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useMapStore } from '../../store/mapStore'
import { useUiStore } from '../../store/uiStore'
import CustomNode from './CustomNode'
import CustomEdge from './CustomEdge'
import CrossEdge from './CrossEdge'
import ConnectorDemoEdge from './ConnectorDemoEdge'
import BoundaryGroup from './BoundaryGroup'
import PresentationMode from '../modes/PresentationMode'
import { getSubtreeIds } from '../modes/FocusMode'
import SearchBar from '../toolbar/SearchBar'
import MockCursors from './MockCursors'
import { computeHidden } from '../../utils/graphUtils'


function FlowInner() {
  const nodes = useMapStore((s) => s.nodes)
  const edges = useMapStore((s) => s.edges)
  const onNodesChange = useMapStore((s) => s.onNodesChange)
  const onEdgesChange = useMapStore((s) => s.onEdgesChange)
  const onConnect = useMapStore((s) => s.onConnect)
  const layout = useUiStore((s) => s.layout)
  const focusMode = useUiStore((s) => s.focusMode)
  const presentationMode = useUiStore((s) => s.presentationMode)
  const presentationIndex = useUiStore((s) => s.presentationIndex)
  const showMockCursors = useUiStore((s) => s.showMockCursors)
  const [transitioning, setTransitioning] = useState(false)
  const { fitView } = useReactFlow()

  // Section 4.2 — smooth repositioning transition (not an instant jump)
  // whenever the active layout changes.
  useEffect(() => {
    setTransitioning(true)
    const t = setTimeout(() => setTransitioning(false), 650)
    return () => clearTimeout(t)
  }, [layout])

  const nodeTypes = useMemo(() => ({ mindNode: CustomNode, boundaryGroup: BoundaryGroup }), [])
  const edgeTypes = useMemo(() => ({ mindEdge: CustomEdge, crossEdge: CrossEdge, demoEdge: ConnectorDemoEdge }), [])

  // Section 4.6 — expand/collapse: hide descendants of collapsed nodes.
  const { hiddenNodeIds, hiddenEdgeIds } = useMemo(() => computeHidden(nodes, edges), [nodes, edges])

  // Section 4.6 — focus mode: dim everything outside the selected branch.
  const selectedNode = nodes.find((n) => n.selected && n.type !== 'boundaryGroup')
  const focusIds = useMemo(
    () => (focusMode && selectedNode ? getSubtreeIds(selectedNode.id, edges) : null),
    [focusMode, selectedNode, edges]
  )

  useEffect(() => {
    if (focusMode && focusIds) {
      fitView({ nodes: [...focusIds].map((id) => ({ id })), duration: 500, padding: 0.3 })
    }
  }, [focusMode, focusIds, fitView])

  // Section 4.6 — presentation mode: step through top-level branches.
  const presentationOrder = useMemo(() => {
    const roots = nodes.filter((n) => n.data?.isRoot).map((n) => n.id)
    const order = []
    const visit = (id) => {
      order.push(id)
      edges.filter((e) => e.source === id && e.type !== 'crossEdge').forEach((e) => visit(e.target))
    }
    roots.forEach(visit)
    return order
  }, [nodes, edges])

  useEffect(() => {
    if (presentationMode && presentationOrder.length) {
      const id = presentationOrder[presentationIndex % presentationOrder.length]
      fitView({ nodes: [{ id }], duration: 600, padding: 0.6 })
    }
  }, [presentationMode, presentationIndex, presentationOrder, fitView])

  const visibleNodes = nodes
    .filter((n) => !hiddenNodeIds.has(n.id))
    .map((n) => {
      const dimmed = (focusIds && !focusIds.has(n.id)) || (presentationMode && n.id !== presentationOrder[presentationIndex % presentationOrder.length])
      return dimmed ? { ...n, style: { ...n.style, opacity: 0.18 } } : n
    })
  const visibleEdges = edges
    .filter((e) => !hiddenEdgeIds.has(e.id))
    .map((e) => {
      const dimmed = focusIds && (!focusIds.has(e.source) || !focusIds.has(e.target))
      return dimmed ? { ...e, style: { ...e.style, opacity: 0.15 } } : e
    })

  return (
    <div
      className={`relative h-full w-full ${transitioning ? 'layout-transition' : ''}`}
      style={{ backgroundColor: 'var(--color-bg-main)' }}
    >
      <SearchBar />
      <ReactFlow
        nodes={visibleNodes}
        edges={visibleEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={() => useUiStore.getState().setActivePanel('inspector')}
        onEdgeClick={() => useUiStore.getState().setActivePanel('inspector')}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={['Backspace', 'Delete']}
        selectionKeyCode="Shift"
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="var(--color-sage)" />
        <Controls showInteractive={false} className="!shadow-md !rounded-md overflow-hidden" />
        <MiniMap
          pannable
          zoomable
          nodeColor={() => '#f5cb5c'}
          maskColor="rgba(236,235,228,0.6)"
          className="!rounded-md !shadow-md"
        />
      </ReactFlow>
      {presentationMode && <PresentationMode order={presentationOrder} />}
      {showMockCursors && <MockCursors />}
    </div>
  )
}

export default function MindMapCanvas() {
  return (
    <ReactFlowProvider>
      <FlowInner />
    </ReactFlowProvider>
  )
}
