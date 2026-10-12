import { memo } from 'react'
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, useInternalNode } from '@xyflow/react'
import { getFloatingEdgeParams } from '../../utils/floatingEdgeUtils'
import { CALC_OPERATOR_ICON } from '../../utils/calcOperators'

// Used for non-hierarchical "cross-branch relationship" links (Section 4.1),
// as opposed to CustomEdge which represents parent → child tree structure.
// Section 14 — perf pass: memoized like CustomEdge.
// Section — floating connectors, same as CustomEdge: re-projects onto
// whichever side of each node actually faces the other based on live
// position, instead of the fixed handle the link was created on.
function CrossEdge({ id, source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, style, markerEnd, selected }) {
  const sourceNode = useInternalNode(source)
  const targetNode = useInternalNode(target)
  const floating = getFloatingEdgeParams(sourceNode, targetNode)

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX: floating?.sx ?? sourceX,
    sourceY: floating?.sy ?? sourceY,
    sourcePosition: floating?.sourcePos ?? sourcePosition,
    targetX: floating?.tx ?? targetX,
    targetY: floating?.ty ?? targetY,
    targetPosition: floating?.targetPos ?? targetPosition,
    borderRadius: 12,
  })

  // Section — Connector Calculations. Same operator badge as CustomEdge —
  // purely additive, the relationship-line style/opacity below is untouched.
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
          strokeDasharray: '2 4',
          opacity: 0.75,
          ...style,
          ...(selected
            ? { stroke: 'var(--color-accent)', strokeWidth: (style?.strokeWidth || 1.5) + 1.5, opacity: 1, filter: 'drop-shadow(0 0 2px var(--color-accent))' }
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

export default memo(CrossEdge)
