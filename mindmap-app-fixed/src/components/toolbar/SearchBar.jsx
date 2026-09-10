import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronUp, ChevronDown, X, Replace } from 'lucide-react'
import { useMapStore } from '../../store/mapStore'
import { useUiStore } from '../../store/uiStore'

export default function SearchBar() {
  const searchOpen = useUiStore((s) => s.searchOpen)
  const toggleSearch = useUiStore((s) => s.toggleSearch)
  const nodes = useMapStore((s) => s.nodes)
  const replaceInLabels = useMapStore((s) => s.replaceInLabels)
  const [query, setQuery] = useState('')
  const [replacement, setReplacement] = useState('')
  const [matchIndex, setMatchIndex] = useState(0)

  const matches = useMemo(
    () =>
      query
        ? nodes.filter((n) => n.type !== 'boundaryGroup' && n.data?.label?.toLowerCase().includes(query.toLowerCase()))
        : [],
    [nodes, query]
  )

  const jumpTo = (idx) => {
    if (!matches.length) return
    const wrapped = ((idx % matches.length) + matches.length) % matches.length
    setMatchIndex(wrapped)
    const target = matches[wrapped]
    useMapStore.setState((s) => ({ nodes: s.nodes.map((n) => ({ ...n, selected: n.id === target.id })) }))
  }

  return (
    <AnimatePresence>
      {searchOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="absolute left-1/2 top-2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-lg border px-2 py-1.5 shadow-lg"
          style={{ backgroundColor: 'var(--color-cream)', borderColor: 'var(--color-sage)' }}
        >
          <input
            autoFocus
            value={query}
            onChange={(e) => { setQuery(e.target.value); setMatchIndex(0) }}
            onKeyDown={(e) => e.key === 'Enter' && jumpTo(matchIndex + 1)}
            placeholder="Search nodes…"
            className="w-32 rounded-md border border-[var(--color-sage)] bg-white/70 px-2 py-1 text-[11px] outline-none focus:border-[var(--color-accent)]"
          />
          <span className="w-12 text-[10px] text-[var(--color-slate)]">
            {matches.length ? `${matchIndex + 1}/${matches.length}` : '0/0'}
          </span>
          <button onClick={() => jumpTo(matchIndex - 1)} className="rounded p-1 hover:bg-[var(--color-sage)]"><ChevronUp size={12} /></button>
          <button onClick={() => jumpTo(matchIndex + 1)} className="rounded p-1 hover:bg-[var(--color-sage)]"><ChevronDown size={12} /></button>
          <div className="mx-1 h-4 w-px" style={{ backgroundColor: 'var(--color-sage)' }} />
          <input
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
            placeholder="Replace with…"
            className="w-24 rounded-md border border-[var(--color-sage)] bg-white/70 px-2 py-1 text-[11px] outline-none focus:border-[var(--color-accent)]"
          />
          <button
            onClick={() => replaceInLabels(query, replacement)}
            className="flex items-center gap-1 rounded-md border border-[var(--color-slate)] px-1.5 py-1 text-[10px] hover:bg-[var(--color-sage)]/40"
            title="Replace all"
          >
            <Replace size={11} /> All
          </button>
          <button onClick={toggleSearch} className="rounded p-1 hover:bg-[var(--color-sage)]"><X size={13} /></button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
