import { memo, useState, useCallback } from 'react'
import { Handle, Position } from '@xyflow/react'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus, Trash2, Star, FileText, CheckSquare, Square, ChevronRight, ChevronDown, Link2, Pin, TrendingUp, ListChecks } from 'lucide-react'
import { useMapStore } from '../../store/mapStore'
import { useUiStore } from '../../store/uiStore'
import { useTradeAnalysisStore } from '../../store/tradeAnalysisStore'
import { useChecklistStore } from '../../store/checklistStore'
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
  const deleteNode = useMapStore((s) => s.deleteNodeAnimated)
  const toggleCollapse = useMapStore((s) => s.toggleCollapse)
  const childCount = useMapStore(
    (s) => s.edges.filter((e) => e.source === id && e.type !== 'crossEdge').length
  )
  // Section — Linked Trade. Set via the node's right-click "Add trade"
  // menu item (NodeContextMenu.jsx) or the inspector's Linked Trade
  // section; stored as just an id on data.linkedTradeId so the trade
  // itself always lives in tradeAnalysisStore, not duplicated here. Look
  // the trade up live so renaming/deleting it in Trade Analysis is
  // reflected immediately; a stale id (trade deleted) simply renders no
  // badge rather than erroring.
  const linkedTrade = useTradeAnalysisStore((s) =>
    data.linkedTradeId ? s.trades.find((t) => t.id === data.linkedTradeId) : null
  )

  // Section — Checklist Library badge. Sums checked/total across every
  // checklist applied to this node (data.checklists), looking each
  // template's items up live in checklistStore so edits/deletes there
  // show up immediately. Clicking it reopens ChecklistPanel scoped to
  // this node so items can be ticked off without leaving the canvas.
  const appliedChecklists = data.checklists || []
  const allChecklists = useChecklistStore((s) => s.checklists)

  const toggleChecklistItemOnNode = useMapStore((s) => s.toggleChecklistItemOnNode)
  // Section — Checklist Library collapse state. Purely local/visual (not
  // persisted): each applied checklist starts expanded; the chevron on its
  // left toggles just that checklist's item list with a height/slide
  // animation, independent of any other checklist on the same node.
  const [collapsedChecklists, setCollapsedChecklists] = useState({})

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
      className={`group relative flex flex-col border text-xs font-medium shadow-sm ${shapeClass[data.shape] || 'rounded-md'} ${data.animationClass || ''}`}
      style={{
        background: data.customBg || data.color || 'var(--color-cream)',
        backgroundSize: data.bgSize,
        borderColor: selected ? 'var(--color-accent)' : border?.color || 'var(--color-slate)',
        borderWidth: selected ? 2 : border?.width ?? 1,
        borderStyle: border?.style || 'solid',
        boxShadow: glowShadow || undefined,
        '--sonar-color': data.glowColor ? `${data.glowColor}8c` : undefined,
        color: data.textColor || 'var(--color-ink)',
        minWidth: appliedChecklists.length > 0 ? 180 : 90,
        textAlign: 'center',
      }}
      onDoubleClick={() => setEditing(true)}
    >
      <Handle type="target" position={Position.Left} className="!bg-slate-600 !w-1.5 !h-1.5" />
      <Handle type="target" position={Position.Top} id="top" className="!bg-slate-600 !w-1.5 !h-1.5" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="!bg-slate-600 !w-1.5 !h-1.5" />

      {/* Header row — label, icon/emoji, linked-trade tag, assignee. Kept as
          its own row (rather than the whole card) so the Section — Checklist
          Library body below can render full-width beneath it. */}
      <div className="relative flex w-full items-center gap-1.5 px-3 py-1.5">
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
        {linkedTrade && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              useUiStore.getState().openTradeDetail(id, linkedTrade.id)
            }}
            className="flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
            style={{ backgroundColor: 'var(--color-accent)', color: '#fff' }}
            title={`Linked trade: ${linkedTrade.pair} — click to view details`}
          >
            <TrendingUp size={9} />
            {linkedTrade.pair}
          </button>
        )}
        {task?.assignee && (
          <span
            title={task.assignee}
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-[8px] font-bold"
          >
            {task.assignee[0].toUpperCase()}
          </span>
        )}

        {childCount > 0 && (
          <motion.button
            whileTap={{ scale: 0.8 }}
            transition={{ duration: 0.12 }}
            onClick={(e) => {
              e.stopPropagation()
              toggleCollapse(id)
            }}
            className="absolute -right-4 top-1/2 -translate-y-1/2 rounded-full bg-[var(--color-cream)] p-0.5 shadow"
            title={data.collapsed ? `Expand (${childCount} hidden)` : 'Collapse branch'}
          >
            <motion.span
              key={data.collapsed ? 'collapsed' : 'expanded'}
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
              className="flex"
            >
              {data.collapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
            </motion.span>
          </motion.button>
        )}

        {hasExtras && (
          <FileText size={11} className="absolute -top-1.5 right-3" color="var(--color-slate)" title="Has notes/attachments" />
        )}
        {(data.links || []).length > 0 && (
          <Link2
            size={11}
            className="absolute -top-1.5 right-8"
            color="var(--color-slate)"
            title={`Linked to ${data.links.length} node${data.links.length > 1 ? 's' : ''}`}
          />
        )}
        {(data.whiteboardNotes || []).length > 0 && (
          <Pin
            size={11}
            className="absolute -top-1.5 right-[52px]"
            color="var(--color-slate)"
            title={`${data.whiteboardNotes.length} whiteboard note${data.whiteboardNotes.length > 1 ? 's' : ''} attached`}
          />
        )}
      </div>

      {/* Section — Checklist Library, shown in full on the node itself (every
          item, tickable right here) instead of just a "checked/total" badge.
          Clicking a checklist's title still opens ChecklistPanel to add
          checklists, rename items, or remove one from this node. */}
      {appliedChecklists.length > 0 && (
        <div
          className="w-full cursor-default border-t px-2.5 py-1.5"
          style={{ borderColor: 'rgba(0,0,0,0.12)', textAlign: 'left' }}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          {appliedChecklists.map((applied) => {
            const def = allChecklists.find((c) => c.id === applied.checklistId)
            if (!def) return null
            const checkedCount = applied.checkedItemIds.filter((cid) => def.items.some((it) => it.id === cid)).length
            const percent = def.items.length ? Math.round((checkedCount / def.items.length) * 100) : 0
            const isCollapsed = Boolean(collapsedChecklists[applied.checklistId])
            return (
              <div key={applied.checklistId} className="mb-1.5 last:mb-0">
                <div className="mb-0.5 flex w-full items-center gap-1 text-[10px] font-semibold" style={{ color: 'var(--color-slate)' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setCollapsedChecklists((prev) => ({ ...prev, [applied.checklistId]: !prev[applied.checklistId] }))
                    }}
                    className="shrink-0"
                    title={isCollapsed ? 'Show checkboxes' : 'Hide checkboxes'}
                  >
                    {isCollapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      useUiStore.getState().openChecklistPanel(id)
                    }}
                    className="flex flex-1 items-center gap-1 truncate text-left"
                    title="Manage this checklist"
                  >
                    <ListChecks size={10} className="shrink-0" />
                    <span className="flex-1 truncate">{def.name}</span>
                  </button>
                  <span className="shrink-0" title={`${checkedCount}/${def.items.length} checked`}>
                    <ProgressRing percent={percent} />
                  </span>
                </div>
                <AnimatePresence initial={false}>
                  {!isCollapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="flex flex-col gap-0.5">
                        {def.items.length === 0 && (
                          <p className="pl-4 text-[10px] italic opacity-60">No checkboxes yet.</p>
                        )}
                        {def.items.map((item) => {
                          const isChecked = applied.checkedItemIds.includes(item.id)
                          return (
                            <button
                              key={item.id}
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleChecklistItemOnNode(id, applied.checklistId, item.id)
                              }}
                              className="flex w-full items-center gap-1.5 rounded px-0.5 py-0.5 text-left text-[11px] hover:bg-black/5"
                            >
                              {isChecked ? (
                                <CheckSquare size={12} className="shrink-0" color="var(--color-accent)" />
                              ) : (
                                <Square size={12} className="shrink-0" color="var(--color-slate)" />
                              )}
                              <span className={isChecked ? 'line-through opacity-60' : ''}>{item.label}</span>
                            </button>
                          )
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      )}

      <Handle type="source" position={Position.Right} className="!bg-slate-600 !w-1.5 !h-1.5" />

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

      <div
        className={`absolute -bottom-6 left-1/2 -translate-x-1/2 gap-1 group-hover:flex ${selected ? 'flex' : 'hidden'}`}
      >
        <motion.button
          whileHover={{ scale: 1.12 }}
          whileTap={{ scale: 0.82 }}
          transition={{ duration: 0.14 }}
          onClick={(e) => {
            e.stopPropagation()
            addChildNode(id, { fromHandle: 'bottom' })
          }}
          className="rounded-full bg-[var(--color-accent)] p-0.5 shadow hover:brightness-95"
          title="Add child below"
        >
          <Plus size={10} />
        </motion.button>
      </div>

      <div className={`absolute -top-6 right-0 gap-1 group-hover:flex ${selected ? 'flex' : 'hidden'}`}>
        <motion.button
          whileHover={{ scale: 1.12 }}
          whileTap={{ scale: 0.82 }}
          transition={{ duration: 0.14 }}
          onClick={() => addChildNode(id)}
          className="rounded-full bg-[var(--color-accent)] p-0.5 shadow hover:brightness-95"
          title="Add child (Tab)"
        >
          <Plus size={10} />
        </motion.button>
        {!data.isRoot && (
          <motion.button
            whileHover={{ scale: 1.12 }}
            whileTap={{ scale: 0.82 }}
            transition={{ duration: 0.14 }}
            onClick={() => deleteNode(id)}
            className="rounded-full bg-[var(--color-sage)] p-0.5 shadow hover:brightness-95"
            title="Delete (Del)"
          >
            <Trash2 size={10} />
          </motion.button>
        )}
      </div>
    </motion.div>
  )
}

export default memo(CustomNode)
