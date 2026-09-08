import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { motion } from 'framer-motion'
import { ChevronRight, ChevronDown, CheckSquare, Square, Star, FileText } from 'lucide-react'
import { useViewerStore } from '../../store/viewerStore'
import { ICONS } from '../../theme/iconSet'

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

// Read-only counterpart to canvas/CustomNode.jsx, used only by the
// shared-link viewer (SharedMapView). Shows everything a node can carry
// (shape, colors, icon/emoji/image, task state, badges, notes indicator)
// but strips every editing affordance — no rename, no add/delete child, no
// dragging, no task toggling. The single interactive bit kept is the
// expand/collapse chevron, per the "only open/close children" requirement.
function ViewerNode({ id, data }) {
  const toggleCollapse = useViewerStore((s) => s.toggleCollapse)
  const childCount = useViewerStore(
    (s) => s.edges.filter((e) => e.source === id && e.type !== 'crossEdge').length
  )

  const IconComp = data.icon ? ICONS[data.icon] : null
  const badges = data.badges || {}
  const hasNotes = (data.notes || '').replace(/<[^>]*>/g, '').trim().length > 0
  const hasExtras = hasNotes || (data.attachments || []).length > 0 || data.audioNote || data.videoEmbed
  const task = data.task

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      className={`relative flex items-center gap-1.5 border px-3 py-1.5 text-xs font-medium shadow-sm ${shapeClass[data.shape] || 'rounded-md'}`}
      style={{
        backgroundColor: data.color || 'var(--color-cream)',
        borderColor: 'var(--color-slate)',
        borderWidth: 1,
        color: data.textColor || 'var(--color-ink)',
        minWidth: 90,
        textAlign: 'center',
      }}
    >
      <Handle type="target" position={Position.Left} className="!bg-slate-600 !w-1.5 !h-1.5" />

      {task && (
        <span className="shrink-0" title={task.dueDate ? `Due ${task.dueDate}` : 'To-do'}>
          {task.done ? (
            <CheckSquare size={13} color="var(--color-ink)" />
          ) : (
            <Square size={13} color="var(--color-ink)" />
          )}
        </span>
      )}

      {data.image && (
        <img src={data.image} alt="" className="h-5 w-5 shrink-0 rounded object-cover" />
      )}
      {!data.image && data.emoji && <span className="shrink-0">{data.emoji}</span>}
      {!data.image && !data.emoji && IconComp && <IconComp size={13} className="shrink-0" />}

      <span className={`flex-1 ${task?.done ? 'line-through opacity-60' : ''}`}>{data.label}</span>

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

      {badges.priority && (
        <span
          className="absolute -left-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white"
          style={{ backgroundColor: 'var(--color-ink)' }}
        >
          {badges.priority}
        </span>
      )}
      {badges.star && (
        <Star size={12} className="absolute -bottom-1.5 -left-1.5" fill="var(--color-accent)" color="var(--color-ink)" />
      )}
      {typeof badges.progress === 'number' && badges.progress > 0 && (
        <span className="absolute -bottom-2 -right-2">
          <ProgressRing percent={badges.progress} />
        </span>
      )}
      {hasExtras && (
        <FileText size={11} className="absolute -top-1.5 right-3" color="var(--color-slate)" title="Has notes/attachments" />
      )}
    </motion.div>
  )
}

export default memo(ViewerNode)
