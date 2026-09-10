import { useMemo, useEffect, useState, useCallback } from 'react'
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
import NodeContextMenu from './NodeContextMenu'
import ConnectorCalcMenu from './ConnectorCalcMenu'
import { computeHidden } from '../../utils/graphUtils'
import { useDeferredHidden } from '../../hooks/useDeferredHidden'


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
  const jumpToken = useUiStore((s) => s.jumpToken)
  const [transitioning, setTransitioning] = useState(false)
  const [contextMenu, setContextMenu] = useState(null)
  const [edgeContextMenu, setEdgeContextMenu] = useState(null)
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

  // Section — collapse now fades a branch out instead of popping it away:
  // exitingNodeIds/exitingEdgeIds stay rendered at opacity 0 for one beat
  // before removedNodeIds/removedEdgeIds actually drops them from what
  // React Flow renders. Re-expanding cancels the fade and remounts the
  // node fresh, which plays CustomNode's own entrance animation.
  const { exitingIds: exitingNodeIds, removedIds: removedNodeIds } = useDeferredHidden(hiddenNodeIds)
  const { exitingIds: exitingEdgeIds, removedIds: removedEdgeIds } = useDeferredHidden(hiddenEdgeIds)

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

  // Section — Node Linking / Backlinks: jump to a node picked from the
  // Node Inspector's Linked Nodes / Backlinks list. Expands any collapsed
  // ancestor along the way first so the target is actually on-canvas
  // before centering the view on it.
  useEffect(() => {
    if (!jumpToken?.id) return
    const targetId = jumpToken.id
    const { nodes: liveNodes, edges: liveEdges, toggleCollapse } = useMapStore.getState()
    const parentOf = new Map(liveEdges.filter((e) => e.type !== 'crossEdge').map((e) => [e.target, e.source]))
    let cursor = parentOf.get(targetId)
    while (cursor) {
      const ancestor = liveNodes.find((n) => n.id === cursor)
      if (ancestor?.data?.collapsed) toggleCollapse(cursor)
      cursor = parentOf.get(cursor)
    }
    const t = setTimeout(() => fitView({ nodes: [{ id: targetId }], duration: 500, padding: 0.6 }), 50)
    return () => clearTimeout(t)
  }, [jumpToken, fitView])

  const visibleNodes = nodes
    .filter((n) => !removedNodeIds.has(n.id))
    .map((n) => {
      const exiting = exitingNodeIds.has(n.id)
      const dimmed = (focusIds && !focusIds.has(n.id)) || (presentationMode && n.id !== presentationOrder[presentationIndex % presentationOrder.length])
      if (!exiting && !dimmed) return n
      return {
        ...n,
        style: {
          ...n.style,
          opacity: exiting ? 0 : 0.18,
          pointerEvents: exiting ? 'none' : n.style?.pointerEvents,
        },
      }
    })
  const visibleEdges = edges
    .filter((e) => !removedEdgeIds.has(e.id))
    .map((e) => {
      const exiting = exitingEdgeIds.has(e.id)
      const dimmed = focusIds && (!focusIds.has(e.source) || !focusIds.has(e.target))
      if (!exiting && !dimmed) return e
      return { ...e, style: { ...e.style, opacity: exiting ? 0 : 0.15 } }
    })

  // Right-click on a node opens a small context menu (add child/sibling,
  // duplicate, collapse, delete) instead of the browser's default menu.
  const onNodeContextMenu = useCallback((event, node) => {
    event.preventDefault()
    if (node.type === 'boundaryGroup') return
    const menuWidth = 176
    const menuHeight = 190
    setContextMenu({
      id: node.id,
      x: Math.min(event.clientX, window.innerWidth - menuWidth - 8),
      y: Math.min(event.clientY, window.innerHeight - menuHeight - 8),
    })
  }, [])

  // Section — Connector Calculations. Right-click on a connector line
  // opens ConnectorCalcMenu (+, -, ×, ÷, =) instead of the browser's
  // default menu, same pattern as onNodeContextMenu above.
  const onEdgeContextMenu = useCallback((event, edge) => {
    event.preventDefault()
    const menuWidth = 192
    const menuHeight = 230
    setEdgeContextMenu({
      id: edge.id,
      x: Math.min(event.clientX, window.innerWidth - menuWidth - 8),
      y: Math.min(event.clientY, window.innerHeight - menuHeight - 8),
    })
  }, [])

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
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={['Backspace', 'Delete']}
        selectionKeyCode="Shift"
        multiSelectionKeyCode={['Meta', 'Control']}
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
      {presentationMode && <PresentationMode order={presentationOrder} />}
      {showMockCursors && <MockCursors />}
      {contextMenu && (
        <NodeContextMenu
          id={contextMenu.id}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}
      {edgeContextMenu && (
        <ConnectorCalcMenu
          id={edgeContextMenu.id}
          x={edgeContextMenu.x}
          y={edgeContextMenu.y}
          onClose={() => setEdgeContextMenu(null)}
        />
      )}
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
