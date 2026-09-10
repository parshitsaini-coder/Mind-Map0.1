import { Plus, Minus, X, Divide, Equal, XCircle } from 'lucide-react'
import { useMapStore } from '../../store/mapStore'

// Right-click menu for a connector line (edge). Lets the user tag the
// connector with a math operator so a chain of connectors can express a
// calculation, e.g. Node(2) --(+)--> Node(4) --(=)--> Node(result).
// Nothing gets computed until "=" is chosen — see setEdgeOperator /
// runCalculation in mapStore.js for the actual math.
export default function EdgeContextMenu({ id, x, y, onClose }) {
  const edge = useMapStore((s) => s.edges.find((e) => e.id === id))
  const setEdgeOperator = useMapStore((s) => s.setEdgeOperator)
  const clearEdgeOperator = useMapStore((s) => s.clearEdgeOperator)

  if (!edge) return null

  const run = (fn) => {
    fn()
    onClose()
  }

  const activeOp = edge.data?.calcOp

  const items = [
    { key: '+', icon: Plus, label: 'Add (+)' },
    { key: '-', icon: Minus, label: 'Subtract (−)' },
    { key: '*', icon: X, label: 'Multiply (×)' },
    { key: '/', icon: Divide, label: 'Divide (÷)' },
    { key: '=', icon: Equal, label: 'Equals (=) — calculate' },
  ]

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault()
          onClose()
        }}
      />
      <div
        className="fixed z-50 w-52 overflow-hidden rounded-md border py-1 shadow-lg"
        style={{ top: y, left: x, backgroundColor: 'var(--color-cream)', borderColor: 'var(--color-sage)' }}
      >
        <div className="px-3 py-1 text-[10px] font-medium uppercase tracking-wide opacity-50">
          Calculation
        </div>
        {items.map((item) => (
          <button
            key={item.key}
            onClick={() => run(() => setEdgeOperator(id, item.key))}
            className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-[var(--color-sage)]/60 ${
              activeOp === item.key ? 'font-semibold' : ''
            }`}
            style={{ color: 'var(--color-ink)' }}
          >
            <item.icon size={13} />
            {item.label}
            {activeOp === item.key && <span className="ml-auto text-[10px] opacity-60">active</span>}
          </button>
        ))}
        {activeOp && (
          <button
            onClick={() => run(() => clearEdgeOperator(id))}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-[#c1443c] transition-colors hover:bg-[var(--color-sage)]/60"
          >
            <XCircle size={13} />
            Clear operator
          </button>
        )}
      </div>
    </>
  )
}
