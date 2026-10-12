import { useEffect } from 'react'
import { useTerminalStore } from '../../store/terminalStore'

const COLORS = { info: '#334155', win: '#166534', loss: '#991b1b', error: '#b45309' }

function Toast({ n }) {
  useEffect(() => {
    const t = setTimeout(() => useTerminalStore.getState().dismissNotice(n.id), 4500)
    return () => clearTimeout(t)
  }, [n.id])
  return (
    <button
      type="button"
      onClick={() => useTerminalStore.getState().dismissNotice(n.id)}
      className="pointer-events-auto rounded-lg px-3 py-2 text-left text-[12px] font-semibold text-white shadow-lg"
      style={{ backgroundColor: COLORS[n.kind] || COLORS.info }}
    >
      {n.text}
    </button>
  )
}

export default function Toasts() {
  const notices = useTerminalStore((s) => s.notices)
  if (!notices.length) return null
  return (
    <div role="status" aria-live="polite" className="pointer-events-none absolute left-1/2 top-12 z-40 md:top-24 flex w-[min(92vw,380px)] -translate-x-1/2 flex-col gap-2">
      {notices.map((n) => <Toast key={n.id} n={n} />)}
    </div>
  )
}
