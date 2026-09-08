import { useState } from 'react'
import { motion } from 'framer-motion'
import { useMapStore } from '../../store/mapStore'
import { useUiStore } from '../../store/uiStore'
import { buildForest } from '../layouts/layoutUtils'

function Row({ node, depth, childrenMap, nodesById, editingId, setEditingId }) {
  const updateNodeData = useMapStore((s) => s.updateNodeData)
  const [draft, setDraft] = useState(node.data.label)
  const kids = (childrenMap.get(node.id) || []).map((id) => nodesById.get(id)).filter(Boolean)

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
        className="flex items-center gap-1 rounded px-1 py-0.5 text-[11px] hover:bg-[var(--color-sage)]/30"
        style={{ paddingLeft: depth * 14 }}
      >
        <span className="text-[var(--color-slate)]">•</span>
        {editingId === node.id ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && commit()}
            className="flex-1 bg-transparent outline-none"
          />
        ) : (
          <button
            onDoubleClick={() => { setDraft(node.data.label); setEditingId(node.id) }}
            onClick={() =>
              useMapStore.setState((s) => ({ nodes: s.nodes.map((n) => ({ ...n, selected: n.id === node.id })) }))
            }
            className={`flex-1 truncate text-left ${node.data.task?.done ? 'line-through opacity-60' : ''}`}
          >
            {node.data.label}
          </button>
        )}
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
      <p className="mb-1 text-[10px] text-[var(--color-slate)]">Double-click a line to rename. Single-click to select on canvas.</p>
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
