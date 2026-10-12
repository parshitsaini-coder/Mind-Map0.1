import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { MessageSquare } from 'lucide-react'
import { useMapStore } from '../../store/mapStore'

function renderWithMentions(text) {
  const parts = text.split(/(@\w+)/g)
  return parts.map((part, i) =>
    part.startsWith('@') ? (
      <span key={i} className="font-semibold" style={{ color: '#b8860b' }}>{part}</span>
    ) : (
      <span key={i}>{part}</span>
    )
  )
}

export default function CommentsPanel() {
  const nodes = useMapStore((s) => s.nodes)
  const addComment = useMapStore((s) => s.addComment)
  const [draft, setDraft] = useState('')

  const selectedNode = nodes.find((n) => n.selected && n.type !== 'boundaryGroup')

  if (!selectedNode) {
    return (
      <p className="text-xs text-[var(--color-slate)]">
        Select a node to view or add comments. Use @name to mention a collaborator.
      </p>
    )
  }

  const comments = selectedNode.data.comments || []

  const submit = () => {
    if (!draft.trim()) return
    addComment(selectedNode.id, 'You', draft.trim())
    setDraft('')
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="truncate text-[10px] font-medium uppercase tracking-wide text-[var(--color-slate)]">
        On "{selectedNode.data.label}"
      </p>
      <ul className="flex max-h-48 flex-col gap-1.5 overflow-y-auto">
        {comments.length === 0 && <p className="text-[10px] text-[var(--color-slate)]">No comments yet.</p>}
        <AnimatePresence initial={false}>
          {comments.map((c) => (
            <motion.li
              key={c.id}
              layout
              initial={{ opacity: 0, y: 6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.16 }}
              className="rounded-md bg-[var(--color-sage)]/25 px-2 py-1 text-[10px]"
            >
              <p className="font-medium">{c.author}</p>
              <p>{renderWithMentions(c.text)}</p>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      <div className="flex gap-1">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Add a comment, @mention someone…"
          className="flex-1 rounded-md border border-[var(--color-sage)] bg-white/60 px-2 py-1 text-[10px] outline-none focus:border-[var(--color-accent)]"
        />
        <button onClick={submit} className="rounded-md border border-[var(--color-slate)] px-2" title="Post comment">
          <MessageSquare size={12} />
        </button>
      </div>
    </div>
  )
}
