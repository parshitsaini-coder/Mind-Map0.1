import { memo } from 'react'
import { BaseEdge, EdgeLabelRenderer } from '@xyflow/react'
import { resolvePath } from './edgePathUtils'
import { ICONS } from '../../theme/iconSet'

// Section 4.8 — connector styles showcase. One component handles every row
// of the demo map; `data.pathType` picks which React Flow path algorithm to
// draw (via the shared `resolvePath` helper — also used by CustomEdge/
// CrossEdge so the Node Inspector's Line style picker matches this demo),
// everything else (dash pattern, width, color, animation, arrows,
// icon-in-middle) comes from `data` too.

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
        style={{
          stroke: data?.color || '#333533',
          strokeWidth: data?.strokeWidth || 2,
          strokeDasharray: data?.dash || undefined,
          strokeLinecap: data?.cap || undefined,
          animation: data?.animated ? 'dashdraw 0.9s linear infinite' : undefined,
        }}
      />
      {IconComp && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              pointerEvents: 'none',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              backgroundColor: '#e8eddf',
              borderColor: data?.color || '#333533',
            }}
            className="flex h-5 w-5 items-center justify-center rounded-full border shadow"
          >
            <IconComp size={11} color="#242423" />
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

export default memo(ConnectorDemoEdge)
