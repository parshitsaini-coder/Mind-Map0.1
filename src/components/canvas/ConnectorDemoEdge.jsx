import { memo } from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getStraightPath,
  getSmoothStepPath,
  getSimpleBezierPath,
  useInternalNode,
} from '@xyflow/react'
import { ICONS } from '../../theme/iconSet'
import { getFloatingEdgeParams } from '../../utils/floatingEdgeUtils'

// Section 4.8 — connector styles showcase. One component handles every row
// of the demo map; `data.pathType` picks which React Flow path algorithm to
// draw, everything else (dash pattern, width, color, animation, arrows,
// icon-in-middle) comes from `data` too.
function resolvePath(pathType, params) {
  switch (pathType) {
    case 'straight':
      return getStraightPath(params)
    case 'smoothstep':
      return getSmoothStepPath({ ...params, borderRadius: 10 })
    case 'step':
      return getSmoothStepPath({ ...params, borderRadius: 0 })
    case 'simplebezier':
      return getSimpleBezierPath(params)
    case 'bezier':
    default:
      return getBezierPath(params)
  }
}

// Section 14 — perf pass: memoized like the other edge/node components.
// Section — floating connectors: picking a style from the Connector
// Styles panel switches an edge's `type` to this component (see
// applyLineStyleToSelectedEdges in mapStore.js), so it needs the same
// live-position re-projection as CustomEdge/CrossEdge — otherwise a
// styled connector reverts to the fixed left/right handle and cuts
// straight through the node the moment either end has been dragged
// somewhere that fixed handle doesn't face.
function ConnectorDemoEdge({
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
  markerStart,
  selected,
}) {
  const sourceNode = useInternalNode(source)
  const targetNode = useInternalNode(target)
  const floating = getFloatingEdgeParams(sourceNode, targetNode)

  const [edgePath, labelX, labelY] = resolvePath(data?.pathType, {
    sourceX: floating?.sx ?? sourceX,
    sourceY: floating?.sy ?? sourceY,
    sourcePosition: floating?.sourcePos ?? sourcePosition,
    targetX: floating?.tx ?? targetX,
    targetY: floating?.ty ?? targetY,
    targetPosition: floating?.targetPos ?? targetPosition,
  })

  const IconComp = data?.iconMid ? ICONS[data.iconMid] : null

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        markerStart={markerStart}
        interactionWidth={24}
        style={{
          stroke: selected ? 'var(--color-accent)' : data?.color || 'var(--color-slate)',
          strokeWidth: (data?.strokeWidth || 2) + (selected ? 1.5 : 0),
          strokeDasharray: data?.dash || undefined,
          strokeLinecap: data?.cap || undefined,
          animation: data?.animated ? 'dashdraw 0.9s linear infinite' : undefined,
          filter: selected ? 'drop-shadow(0 0 2px var(--color-accent))' : undefined,
        }}
      />
      {IconComp && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              pointerEvents: 'none',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              backgroundColor: 'var(--color-cream)',
              borderColor: data?.color || 'var(--color-slate)',
            }}
            className="flex h-5 w-5 items-center justify-center rounded-full border shadow"
          >
            <IconComp size={11} color="var(--color-ink)" />
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

export default memo(ConnectorDemoEdge)
