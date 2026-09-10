import { memo, useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronRight, ChevronDown, CheckSquare, Square, Star, FileText, ListChecks, TrendingUp } from 'lucide-react'
import { useViewerStore } from '../../store/viewerStore'
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

// Section — Full-bleed node image, mirrors CustomNode.jsx's imageRadiusClass.
const imageRadiusClass = {
  rectangle: 'rounded-md',
  oval: 'rounded-full',
  cloud: 'rounded-[40%]',
  hexagon: 'rounded-lg clip-hex',
  'no-border': 'rounded-none',
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
// (shape, colors, icon/emoji/image, task state, badges, notes indicator,
// applied checklists, linked trade) but strips every editing affordance —
// no rename, no add/delete child, no dragging, no task toggling, no
// ticking checklist items. The interactive bits kept are the
// expand/collapse chevron (branch + per-checklist) and the linked-trade
// badge, which opens a read-only trade detail popup (ViewerTradeDetailModal)
// sourced from the checklists/trades snapshot embedded in the share link.
function ViewerNode({ id, data }) {
  const toggleCollapse = useViewerStore((s) => s.toggleCollapse)
  const childCount = useViewerStore(
    (s) => s.edges.filter((e) => e.source === id && e.type !== 'crossEdge').length
  )
  const appliedChecklists = data.checklists || []
  const allChecklists = useViewerStore((s) => s.checklists)
  const linkedTrade = useViewerStore((s) =>
    data.linkedTradeId ? s.trades.find((t) => t.id === data.linkedTradeId) : null
  )
  const [collapsedChecklists, setCollapsedChecklists] = useState({})

  const IconComp = data.icon ? ICONS[data.icon] : null
  const badges = data.badges || {}
  const hasNotes = (data.notes || '').replace(/<[^>]*>/g, '').trim().length > 0
  const hasExtras = hasNotes || (data.attachments || []).length > 0 || data.audioNote || data.videoEmbed
  const task = data.task
  // Section — Full-bleed node image, mirrors CustomNode.jsx.
  const hasImage = Boolean(data.image)
  // Section — Node size, mirrors CustomNode.jsx's sizeScale. Resizes the
  // real box (not a CSS transform) so it renders the same as the editor —
  // see CustomNode.jsx for why a transform breaks connector alignment.
  const sizeScale = data.sizeScale || 1
  const baseFontSize = 12
  const headerPadY = 6 * sizeScale
  const headerPadX = 12 * sizeScale
  const headerGap = 6 * sizeScale
  const iconSize = Math.round(13 * sizeScale)

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      className={`relative flex flex-col border text-xs font-medium shadow-sm ${shapeClass[data.shape] || 'rounded-md'}`}
      style={{
        backgroundColor: data.color || 'var(--color-cream)',
        borderColor: 'var(--color-slate)',
        borderWidth: 1,
        color: data.textColor || 'var(--color-ink)',
        minWidth: (appliedChecklists.length > 0 ? 180 : hasImage ? 96 : 90) * sizeScale,
        minHeight: hasImage ? 72 * sizeScale : undefined,
        width: hasImage ? 96 * sizeScale : undefined,
        height: hasImage ? 72 * sizeScale : undefined,
        maxWidth: hasImage ? 96 * sizeScale : undefined,
        overflow: hasImage ? 'hidden' : undefined,
        textAlign: 'center',
      }}
    >
      <Handle type="target" position={Position.Left} className="!pointer-events-none !bg-slate-600 !w-1.5 !h-1.5" />

      {hasImage && (
        <img
          src={data.image}
          alt=""
          onClick={(e) => {
            e.stopPropagation()
            useUiStore.getState().openImageLightbox(data.image)
          }}
          title="Click to view full size"
          className={`nodrag nopan pointer-events-auto absolute inset-0 h-full w-full cursor-zoom-in object-cover ${imageRadiusClass[data.shape] || 'rounded-md'}`}
          style={{ objectPosition: 'center' }}
        />
      )}

      <div
        className={`relative flex w-full items-center ${hasImage ? 'mt-auto rounded-b-[inherit] bg-black/45' : ''}`}
        style={{
          gap: headerGap,
          padding: `${headerPadY}px ${headerPadX}px`,
          ...(hasImage ? { color: '#fff' } : undefined),
        }}
      >
        {task && (
          <span className="shrink-0" title={task.dueDate ? `Due ${task.dueDate}` : 'To-do'}>
            {task.done ? (
              <CheckSquare size={iconSize} color={hasImage ? '#fff' : 'var(--color-ink)'} />
            ) : (
              <Square size={iconSize} color={hasImage ? '#fff' : 'var(--color-ink)'} />
            )}
          </span>
        )}

        {!data.image && data.emoji && (
          <span className="shrink-0" style={{ fontSize: iconSize }}>
            {data.emoji}
          </span>
        )}
        {!data.image && !data.emoji && IconComp && <IconComp size={iconSize} className="shrink-0" />}

        <span
          className={`flex-1 truncate ${task?.done ? 'line-through opacity-60' : ''}`}
          style={{
            ...nodeTextStyle(data),
            fontSize: `${(nodeTextStyle(data).fontSize ? parseFloat(nodeTextStyle(data).fontSize) : baseFontSize) * sizeScale}px`,
            ...(hasImage ? { color: '#fff' } : undefined),
          }}
        >
          {data.label}
        </span>

        {linkedTrade && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              useViewerStore.getState().openTradeDetail(linkedTrade.id)
            }}
            className="nodrag nopan pointer-events-auto flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
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
          <button
            onClick={(e) => {
              e.stopPropagation()
              toggleCollapse(id)
            }}
            className="nodrag nopan pointer-events-auto absolute -right-5 top-1/2 z-10 flex h-5 w-5 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-[var(--color-cream)] shadow hover:bg-[var(--color-sage)]"
            title={data.collapsed ? `Expand (${childCount} hidden)` : 'Collapse branch'}
          >
            {data.collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
          </button>
        )}

        {hasExtras && (
          <FileText size={11} className="absolute -top-1.5 right-3" color="var(--color-slate)" title="Has notes/attachments" />
        )}
      </div>

      {/* Applied checklists — mirrors CustomNode's full-body checklist
          display, but every checkbox here is inert (span, not a button):
          this view never mutates node data, so ticking items has to stay
          in the real editor. Collapsing a checklist's item list is purely
          local/visual, same as the editor. */}
      {appliedChecklists.length > 0 && (
        <div
          className="relative nodrag nopan pointer-events-auto w-full cursor-default border-t px-2.5 py-1.5"
          style={{ borderColor: 'rgba(0,0,0,0.12)', textAlign: 'left' }}
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
                  <span className="flex flex-1 items-center gap-1 truncate text-left">
                    <ListChecks size={10} className="shrink-0" />
                    <span className="flex-1 truncate">{def.name}</span>
                  </span>
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
                            <span key={item.id} className="flex w-full items-center gap-1.5 px-0.5 py-0.5 text-left text-[11px]">
                              {isChecked ? (
                                <CheckSquare size={12} className="shrink-0" color="var(--color-accent)" />
                              ) : (
                                <Square size={12} className="shrink-0" color="var(--color-slate)" />
                              )}
                              <span className={isChecked ? 'line-through opacity-60' : ''}>{item.label}</span>
                            </span>
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

      <Handle type="source" position={Position.Right} className="!pointer-events-none !bg-slate-600 !w-1.5 !h-1.5" />

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
    </motion.div>
  )
}

export default memo(ViewerNode)
