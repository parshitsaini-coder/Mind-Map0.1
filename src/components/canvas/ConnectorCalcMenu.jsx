import { useMapStore } from '../../store/mapStore'
import { CALC_OPERATOR_META } from '../../utils/calcOperators'

// Section — Connector Calculations. Right-click on any connector line and
// pick +, -, *, / or = — this is the entry point that writes
// data.calcOp onto the connector (see mapStore.setEdgeCalcOp), which the
// calc engine (utils/calcEngine.js) then reads to feed live results into
// whichever node an "=" connector points at. Clicking the already-active
// operator again clears it (handled by the toggle in setEdgeCalcOp).
export default function ConnectorCalcMenu({ id, x, y, onClose }) {
  const edge = useMapStore((s) => s.edges.find((e) => e.id === id))
  const setEdgeCalcOp = useMapStore((s) => s.setEdgeCalcOp)

  if (!edge) return null

  const activeOp = edge.data?.calcOp || null

  return (
    <>
      {/* Full-viewport transparent layer so a click/right-click anywhere
          else on the page closes the menu, like a native context menu. */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault()
          onClose()
        }}
      />
      <div
        className="fixed z-50 w-48 overflow-hidden rounded-md border py-1 shadow-lg"
        style={{ top: y, left: x, backgroundColor: 'var(--color-cream)', borderColor: 'var(--color-sage)' }}
      >
        <div
          className="px-3 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wide"
          style={{ color: 'var(--color-slate)' }}
        >
          Connector Calculation
        </div>
        {CALC_OPERATOR_META.map(({ op, icon: Icon, label }) => {
          const active = activeOp === op
          return (
            <button
              key={op}
              onClick={() => {
                setEdgeCalcOp(id, op)
                onClose()
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-[var(--color-sage)]/60"
              style={{
                color: active ? 'var(--color-accent)' : 'var(--color-ink)',
                backgroundColor: active ? 'rgba(0,0,0,0.05)' : undefined,
                fontWeight: active ? 600 : 500,
              }}
            >
              <Icon size={13} />
              {label}
              {active && <span className="ml-auto text-[10px]">✓</span>}
            </button>
          )
        })}
        {activeOp && (
          <button
            onClick={() => {
              setEdgeCalcOp(id, activeOp) // toggles the active operator off
              onClose()
            }}
            className="mt-0.5 flex w-full items-center gap-2 border-t px-3 py-1.5 text-left text-xs text-[#c1443c] hover:bg-[var(--color-sage)]/60"
            style={{ borderColor: 'var(--color-sage)' }}
          >
            Clear operator
          </button>
        )}
      </div>
    </>
  )
}
