import { memo } from 'react'
import { BaseEdge, EdgeLabelRenderer, getBezierPath, useInternalNode } from '@xyflow/react'
import { getFloatingEdgeParams } from '../../utils/floatingEdgeUtils'
import { CALC_OPERATOR_ICON } from '../../utils/calcOperators'

// Section 14 — perf pass: memoized like CustomNode, for the same reason.
// Section — floating connectors: look up the source/target nodes' *live*
// positions (useInternalNode) and re-project the edge onto whichever side
// of each node actually faces the other, on every render, instead of
// trusting the fixed left/right/top/bottom handle the connection was
// created on. Falls back to React Flow's handle-based coordinates if
// either node isn't measured yet (e.g. the very first render).
function CustomEdge({ id, source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, style, markerEnd, selected }) {
  const sourceNode = useInternalNode(source)
  const targetNode = useInternalNode(target)
  const floating = getFloatingEdgeParams(sourceNode, targetNode)

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX: floating?.sx ?? sourceX,
    sourceY: floating?.sy ?? sourceY,
    sourcePosition: floating?.sourcePos ?? sourcePosition,
    targetX: floating?.tx ?? targetX,
    targetY: floating?.ty ?? targetY,
    targetPosition: floating?.targetPos ?? targetPosition,
  })

  // Section — Connector Calculations. A connector tagged with a math
  // operator (right-click → ConnectorCalcMenu) shows it as a small badge
  // at its midpoint. Purely additive on top of the existing dashed
  // marching-ants style/animation below — nothing about that changes.
  const OpIcon = data?.calcOp ? CALC_OPERATOR_ICON[data.calcOp] : null

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        interactionWidth={24}
        style={{
          stroke: 'var(--color-slate)',
          strokeWidth: 1.5,
          strokeDasharray: 6,
          animation: 'dashdraw 1.2s linear infinite',
          ...style,
          ...(selected
            ? { stroke: 'var(--color-accent)', strokeWidth: (style?.strokeWidth || 1.5) + 1.5, filter: 'drop-shadow(0 0 2px var(--color-accent))' }
            : null),
        }}
      />
      {OpIcon && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              pointerEvents: 'none',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              backgroundColor: data.calcOp === '=' ? 'var(--color-accent)' : 'var(--color-cream)',
              borderColor: 'var(--color-slate)',
              color: data.calcOp === '=' ? 'var(--color-cream)' : 'var(--color-ink)',
            }}
            className="flex h-5 w-5 items-center justify-center rounded-full border shadow"
            title={`Connector calculation: ${data.calcOp}`}
          >
            <OpIcon size={11} />
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

export default memo(CustomEdge)
