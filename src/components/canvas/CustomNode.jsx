import { memo, useState, useCallback } from 'react'
import { Handle, Position } from '@xyflow/react'
import { motion } from 'framer-motion'
import { Plus, Trash2, Star, FileText, CheckSquare, Square, ChevronRight, ChevronDown } from 'lucide-react'
import { useMapStore } from '../../store/mapStore'
import { useUiStore } from '../../store/uiStore'
import { ICONS } from '../../theme/iconSet'
import { nodeTextStyle } from '../../utils/textStyle'

const shapeClass = {
  rectangle: 'rounded-md',
  oval: 'rounded-full px-5',
  cloud: 'rounded-[40%]',
  hexagon: 'rounded-lg clip-hex',
  'no-border': 'rounded-none border-none shadow-none',
}

function ProgressRing({ percent }) {
  const r = 7
  const c = 2 * Math.PI * r
  const offset = c - (percent / 100) * c
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <circle cx="9" cy="9" r={r} fill="none" stroke="var(--color-sage)" strokeWidth="2.5" />
      <circle
        cx="9"
        cy="9"
        r={r}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="2.5"
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 9 9)"
      />
    </svg>
  )
}

// Section 14 — perf pass: memoized so a node only re-renders when its own
// id/data/selected props actually change, instead of every node re-rendering
// whenever any other node or edge in the map is touched.
function CustomNode({ id, data, selected }) {
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState(data.label)
  const addChildNode = useMapStore((s) => s.addChildNode)
  const updateNodeData = useMapStore((s) => s.updateNodeData)
  const deleteNode = useMapStore((s) => s.deleteNode)
  const toggleCollapse = useMapStore((s) => s.toggleCollapse)
  const childCount = useMapStore(
    (s) => s.edges.filter((e) => e.source === id && e.type !== 'crossEdge').length
  )

  const commit = useCallback(() => {
    setEditing(false)
    updateNodeData(id, { label })
  }, [id, label, updateNodeData])

  const IconComp = data.icon ? ICONS[data.icon] : null
  const badges = data.badges || {}
  const hasNotes = (data.notes || '').replace(/<[^>]*>/g, '').trim().length > 0
  const hasExtras = hasNotes || (data.attachments || []).length > 0 || data.audioNote || data.videoEmbed
  const task = data.task
  const overdue = task?.dueDate && !task.done && new Date(task.dueDate) < new Date()
  const textStyle = nodeTextStyle(data)

  // Section — Style Library. `customBg` carries a full CSS `background`
  // value (gradients) that takes priority over the plain `color` swatch;
  // `glowColor` adds a static halo (Glow category); `customBorder` overrides
  // the default 1px slate / 2px accent-when-selected border; `animationClass`
  // is one of the node-anim-* CSS classes defined in index.css.
  const border = data.customBorder
  const glowShadow = data.glowColor ? `0 0 10px 2px ${data.glowColor}55` : null

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.7 }}
      whileHover={{ scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      className={`group relative flex items-center gap-1.5 border px-3 py-1.5 text-xs font-medium shadow-sm ${shapeClass[data.shape] || 'rounded-md'} ${data.animationClass || ''}`}
      style={{
        background: data.customBg || data.color || 'var(--color-cream)',
        backgroundSize: data.bgSize,
        borderColor: selected ? 'var(--color-accent)' : border?.color || 'var(--color-slate)',
        borderWidth: selected ? 2 : border?.width ?? 1,
        borderStyle: border?.style || 'solid',
        boxShadow: glowShadow || undefined,
        '--sonar-color': data.glowColor ? `${data.glowColor}8c` : undefined,
        color: data.textColor || 'var(--color-ink)',
        minWidth: 90,
        textAlign: 'center',
      }}
      onDoubleClick={() => setEditing(true)}
    >
      <Handle type="target" position={Position.Left} className="!bg-slate-600 !w-1.5 !h-1.5" />

      {task && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            updateNodeData(id, { task: { ...task, done: !task.done } })
          }}
          className="shrink-0"
          title={task.dueDate ? `Due ${task.dueDate}` : 'To-do'}
        >
          {task.done ? (
            <CheckSquare size={13} color="var(--color-ink)" />
          ) : (
            <Square size={13} color={overdue ? '#c1443c' : 'var(--color-ink)'} />
          )}
        </button>
      )}

      {data.image && (
        <img
          src={data.image}
          alt=""
          onClick={(e) => {
            e.stopPropagation()
            useUiStore.getState().openImageLightbox(data.image)
          }}
          title="Click to view full size"
          className="h-5 w-5 shrink-0 cursor-zoom-in rounded object-cover"
        />
      )}
      {!data.image && data.emoji && <span className="shrink-0">{data.emoji}</span>}
      {!data.image && !data.emoji && IconComp && <IconComp size={13} className="shrink-0" />}

      {editing ? (
        <input
          autoFocus
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
          style={textStyle}
          className="w-full bg-transparent text-center outline-none"
        />
      ) : (
        <span className={`flex-1 ${task?.done ? 'line-through opacity-60' : ''}`} style={textStyle}>
          {data.label}
        </span>
      )}
      {task?.assignee && (
        <span
          title={task.assignee}
          className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-[8px] font-bold"
        >
          {task.assignee[0].toUpperCase()}
        </span>
      )}
      <Handle type="source" position={Position.Right} className="!bg-slate-600 !w-1.5 !h-1.5" />

      {childCount > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            toggleCollapse(id)
          }}
          className="absolute -right-4 top-1/2 -translate-y-1/2 rounded-full bg-[var(--color-cream)] p-0.5 shadow"
          title={data.collapsed ? `Expand (${childCount} hidden)` : 'Collapse branch'}
        >
          {data.collapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
        </button>
      )}

      {/* Section 4.3/4.5 — sticker/badge markers */}
      {badges.priority && (
        <span
          className="badge-pop absolute -left-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white"
          style={{ backgroundColor: 'var(--color-ink)' }}
        >
          {badges.priority}
        </span>
      )}
      {badges.star && (
        <Star size={12} className="badge-pop absolute -bottom-1.5 -left-1.5" fill="var(--color-accent)" color="var(--color-ink)" />
      )}
      {typeof badges.progress === 'number' && badges.progress > 0 && (
        <span className="badge-pop absolute -bottom-2 -right-2">
          <ProgressRing percent={badges.progress} />
        </span>
      )}
      {hasExtras && (
        <FileText size={11} className="absolute -top-1.5 right-3" color="var(--color-slate)" title="Has notes/attachments" />
      )}

      <div className="absolute -top-2 -right-2 hidden group-hover:flex gap-1">
        <button
          onClick={() => addChildNode(id)}
          className="rounded-full bg-[var(--color-accent)] p-0.5 shadow hover:brightness-95"
          title="Add child (Tab)"
        >
          <Plus size={10} />
        </button>
        {!data.isRoot && (
          <button
            onClick={() => deleteNode(id)}
            className="rounded-full bg-[var(--color-sage)] p-0.5 shadow hover:brightness-95"
            title="Delete (Del)"
          >
            <Trash2 size={10} />
          </button>
        )}
      </div>
    </motion.div>
  )
}

export default memo(CustomNode)
