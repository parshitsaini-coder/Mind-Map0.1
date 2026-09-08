import { memo } from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getStraightPath,
  getSmoothStepPath,
  getSimpleBezierPath,
} from '@xyflow/react'
import { ICONS } from '../../theme/iconSet'

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
function ConnectorDemoEdge({
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
  const [edgePath, labelX, labelY] = resolvePath(data?.pathType, {
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
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
