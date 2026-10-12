import { useState } from 'react'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Pencil } from 'lucide-react'
import { useMapStore } from '../../store/mapStore'
import { useUiStore } from '../../store/uiStore'
import { buildForest } from '../layouts/layoutUtils'

function Row({ node, depth, childrenMap, nodesById, editingId, setEditingId }) {
  const updateNodeData = useMapStore((s) => s.updateNodeData)
  const toggleHidden = useMapStore((s) => s.toggleHidden)
  const [draft, setDraft] = useState(node.data.label)
  const kids = (childrenMap.get(node.id) || []).map((id) => nodesById.get(id)).filter(Boolean)
  const isHidden = !!node.data.hidden
  const isEditing = editingId === node.id

  const startEditing = () => {
    setDraft(node.data.label)
    setEditingId(node.id)
  }

  const commit = () => {
    setEditingId(null)
    updateNodeData(node.id, { label: draft })
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.15, delay: Math.min(depth, 6) * 0.02 }}
    >
      <div
        className="group flex items-center gap-1 rounded px-1 py-0.5 text-[11px] hover:bg-[var(--color-sage)]/30"
        style={{ paddingLeft: depth * 14 }}
      >
        <span className="text-[var(--color-slate)]">•</span>
        {isEditing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={(e) => e.target.select()}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit()
              if (e.key === 'Escape') setEditingId(null)
            }}
            className="flex-1 rounded border border-[var(--color-accent)] bg-white/70 px-1 outline-none"
          />
        ) : (
          <button
            onDoubleClick={startEditing}
            onClick={() =>
              useMapStore.setState((s) => ({ nodes: s.nodes.map((n) => ({ ...n, selected: n.id === node.id })) }))
            }
            className={`flex-1 truncate text-left ${node.data.task?.done ? 'line-through opacity-60' : ''} ${isHidden ? 'italic opacity-50' : ''}`}
          >
            {node.data.label}
          </button>
        )}
        {!isEditing && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              startEditing()
            }}
            title="Edit text"
            className="shrink-0 rounded p-0.5 text-[var(--color-slate)]/70 opacity-0 hover:bg-[var(--color-sage)]/60 group-hover:opacity-100"
          >
            <Pencil size={11} />
          </button>
        )}
        <button
          onClick={() => toggleHidden(node.id)}
          title={isHidden ? 'Show on mind map' : 'Hide from mind map'}
          className={`shrink-0 rounded p-0.5 hover:bg-[var(--color-sage)]/60 ${isHidden ? 'opacity-100 text-[var(--color-slate)]' : 'opacity-0 group-hover:opacity-100 text-[var(--color-slate)]/70'}`}
        >
          {isHidden ? <EyeOff size={12} /> : <Eye size={12} />}
        </button>
      </div>
      {kids.map((kid) => (
        <Row
          key={kid.id}
          node={kid}
          depth={depth + 1}
          childrenMap={childrenMap}
          nodesById={nodesById}
          editingId={editingId}
          setEditingId={setEditingId}
        />
      ))}
    </motion.div>
  )
}

export default function OutlineView() {
  const nodes = useMapStore((s) => s.nodes)
  const edges = useMapStore((s) => s.edges)
  const [editingId, setEditingId] = useState(null)

  const { childrenMap, roots } = buildForest(nodes, edges)
  const nodesById = new Map(nodes.map((n) => [n.id, n]))

  return (
    <div className="flex flex-col gap-1">
      <p className="mb-1 text-[10px] text-[var(--color-slate)]">
        Click the ✎ (or double-click a line) to edit its text right here. Single-click to select on canvas.
      </p>
      {roots.map((rootId) => {
        const root = nodesById.get(rootId)
        if (!root) return null
        return (
          <Row
            key={rootId}
            node={root}
            depth={0}
            childrenMap={childrenMap}
            nodesById={nodesById}
            editingId={editingId}
            setEditingId={setEditingId}
          />
        )
      })}
    </div>
  )
}
