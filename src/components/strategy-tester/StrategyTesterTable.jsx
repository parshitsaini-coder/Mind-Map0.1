import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarDays, GripVertical, Trash2, Eye, EyeOff } from 'lucide-react'
import { useStrategyTesterStore } from '../../store/strategyTesterStore'
import {
  FIELD_TYPE_MAP,
  FIELD_HEADER_COLORS,
  DATE_HEADER_COLORS,
  optionTextStyle,
  defaultFieldWidth,
  DEFAULT_DATE_WIDTH,
  MIN_COL_WIDTH,
  MAX_COL_WIDTH,
  daysInMonth,
  dateKey,
  WEEKDAY_SHORT,
  WEEKDAY_COLORS,
} from '../../utils/strategyTesterFields'
import AddFieldMenu from './AddFieldMenu'
import FieldCell from './FieldCell'
import { beginColumnDrag } from './columnDrag'
import { EASE_OUT } from './motionBits'
import SelectOptionsPopup from './SelectOptionsPopup'
import WeekdayFilterPopup from './WeekdayFilterPopup'

// Inline-editable label shared by strategy names and field labels — click
// the text to turn it into a small input, Enter/blur commits, Esc cancels.
function EditableLabel({ value, onCommit, className, inputClassName, placeholder, style, display }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const ref = useRef(null)

  if (editing) {
    return (
      <input
        ref={ref}
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={() => {
          setEditing(false)
          const next = draft.trim()
          if (next && next !== value) onCommit(next)
          else setDraft(value)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') {
            setDraft(value)
            setEditing(false)
          }
        }}
        onClick={(e) => e.stopPropagation()}
        className={inputClassName}
      />
    )
  }
  return (
    <button
      type="button"
      title="Click to rename"
      onClick={() => {
        setDraft(value)
        setEditing(true)
      }}
      className={className}
      style={style}
    >
      {display || value || placeholder}
    </button>
  )
}

// Drag handle on a header cell's right edge. While dragging it writes the
// width straight onto the matching <col> (no React re-render per pixel, so
// it stays smooth) and saves to the store once on release. Double-click
// resets to the default width.
function ColResizer({ colId, onCommit, onReset }) {
  const onPointerDown = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const handle = e.currentTarget
    const th = handle.parentElement
    const col = th.closest('table')?.querySelector(`col[data-col="${colId}"]`)
    if (!col) return
    const startX = e.clientX
    const startW = col.getBoundingClientRect().width || th.getBoundingClientRect().width
    let latest = Math.round(startW)
    handle.setPointerCapture(e.pointerId)
    handle.classList.add('is-dragging')
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const move = (ev) => {
      latest = Math.round(Math.max(MIN_COL_WIDTH, Math.min(MAX_COL_WIDTH, startW + ev.clientX - startX)))
      col.style.width = `${latest}px`
    }
    const up = () => {
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', up)
      handle.removeEventListener('pointercancel', up)
      handle.classList.remove('is-dragging')
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      if (latest !== Math.round(startW)) onCommit(latest)
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', up)
    handle.addEventListener('pointercancel', up)
  }

  return (
    <div
      className="st-resizer"
      title="Drag to resize · double-click to reset"
      onPointerDown={onPointerDown}
      onDoubleClick={(e) => {
        e.stopPropagation()
        onReset()
      }}
      onClick={(e) => e.stopPropagation()}
    />
  )
}

function StrategyGroupHeader({ strategy, isOnly, isNew }) {
  const colSpan = strategy.fields.length || 1

  const handleRemove = () => {
    if (!window.confirm(`Remove "${strategy.name}" and all its data for every month? This can't be undone.`)) return
    useStrategyTesterStore.getState().removeStrategy(strategy.id)
  }

  const handleHide = () => useStrategyTesterStore.getState().toggleStrategyHidden(strategy.id)

  return (
    <th colSpan={colSpan} className={`st-th-group px-1.5 text-left align-middle ${isNew ? 'st-col-new' : ''}`}>
      <div className="flex items-center gap-1">
        <EditableLabel
          value={strategy.name}
          onCommit={(name) => useStrategyTesterStore.getState().renameStrategy(strategy.id, name)}
          placeholder="Strategy name"
          className="min-w-0 flex-1 truncate text-left text-[10px] font-bold hover:underline"
          inputClassName="min-w-0 flex-1 rounded border bg-transparent px-1 text-[10px] font-bold outline-none"
        />
        <span style={{ color: 'var(--ta-ink)' }}>
          <AddFieldMenu
            compact
            onPick={(type, label) => useStrategyTesterStore.getState().addField(strategy.id, type, label)}
          />
        </span>
        <motion.button
          type="button"
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.9 }}
          title="Hide this strategy's panel"
          onClick={handleHide}
          className="shrink-0 opacity-60 hover:opacity-100"
          style={{ color: 'var(--ta-slate)' }}
        >
          <EyeOff size={10} />
        </motion.button>
        {!isOnly && (
          <motion.button
            type="button"
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
            title="Remove this strategy"
            onClick={handleRemove}
            className="shrink-0 opacity-60 hover:opacity-100"
            style={{ color: 'var(--ta-slate)' }}
          >
            <Trash2 size={10} />
          </motion.button>
        )}
      </div>
    </th>
  )
}

// Small restore bar for hidden strategies — shown above the table so a
// hidden panel is never permanently lost, just tucked away.
function HiddenStrategiesBar({ hiddenStrategies }) {
  return (
    <AnimatePresence initial={false}>
      {hiddenStrategies.length > 0 && (
        <motion.div
          key="hidden-bar"
          initial={{ height: 0, opacity: 0, marginBottom: 0 }}
          animate={{ height: 'auto', opacity: 1, marginBottom: 4 }}
          exit={{ height: 0, opacity: 0, marginBottom: 0 }}
          transition={{ duration: 0.22, ease: EASE_OUT }}
          className="shrink-0 overflow-hidden"
        >
          <div
            className="flex flex-wrap items-center gap-1 rounded-lg border px-1.5 py-1"
            style={{ borderColor: 'var(--tad-border-strong)', backgroundColor: 'var(--ta-surface)' }}
          >
            <span className="text-[8px] font-semibold uppercase tracking-wide opacity-60" style={{ color: 'var(--ta-ink)' }}>
              Hidden:
            </span>
            <AnimatePresence mode="popLayout" initial={false}>
              {hiddenStrategies.map((st) => (
                <motion.button
                  key={st.id}
                  layout
                  type="button"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.12 } }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 480, damping: 30 }}
                  title={`Show "${st.name}" again`}
                  onClick={() => useStrategyTesterStore.getState().toggleStrategyHidden(st.id)}
                  className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold"
                  style={{ backgroundColor: 'var(--ta-bg)', color: 'var(--ta-ink)' }}
                >
                  <Eye size={9} />
                  {st.name}
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function FieldHeaderCell({ strategy, field, index = 0, isNew, onColDragStart }) {
  const meta = FIELD_TYPE_MAP[field.type]
  const [menuAt, setMenuAt] = useState(null)
  const isSelect = ['select', 'multiselect', 'checkbox'].includes(field.type)
  // A Checkbox column with named checkboxes shows those names (with their
  // colours / text styles) in the header instead of the generic "Checkbox"
  // label. Rename the column to anything else and that name is shown instead.
  const items = field.type === 'checkbox' && field.label === 'Checkbox' ? field.options || [] : []
  const showItems = items.length > 0
  return (
    <th
      data-field-id={field.id}
      className={`st-th-field st-th-drag group px-1 py-0.5 text-center align-middle ${isNew ? 'st-col-new' : ''}`}
      style={{ minWidth: meta?.width ?? 50 }}
      onPointerDown={onColDragStart}
      onContextMenu={
        isSelect
          ? (e) => {
              e.preventDefault()
              setMenuAt({ x: e.clientX, y: e.clientY })
            }
          : undefined
      }
    >
      <AnimatePresence>
        {menuAt && (
          <SelectOptionsPopup strategyId={strategy.id} fieldId={field.id} x={menuAt.x} y={menuAt.y} onClose={() => setMenuAt(null)} />
        )}
      </AnimatePresence>
      <ColResizer
        colId={field.id}
        onCommit={(w) => useStrategyTesterStore.getState().setFieldWidth(strategy.id, field.id, w)}
        onReset={() => {
          const col = document.querySelector(`col[data-col="${field.id}"]`)
          if (col) col.style.width = `${defaultFieldWidth(field.type)}px`
          useStrategyTesterStore.getState().setFieldWidth(strategy.id, field.id, undefined)
        }}
      />
      <GripVertical
        size={9}
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 opacity-0 transition-opacity duration-150 group-hover:opacity-40"
        style={{ color: 'var(--ta-slate)' }}
      />
      <div className="flex items-center justify-center gap-0.5">
        <EditableLabel
          value={field.label}
          onCommit={(label) => useStrategyTesterStore.getState().renameField(strategy.id, field.id, label)}
          className={showItems ? 'flex min-w-0 flex-wrap items-center justify-center gap-0.5' : 'st-hd-chip st-hd-themed st-hd-in text-[8px] uppercase'}
          style={
            showItems
              ? undefined
              : {
                  '--i': index,
                  '--c1': (FIELD_HEADER_COLORS[field.type] || DATE_HEADER_COLORS)[0],
                  '--c2': (FIELD_HEADER_COLORS[field.type] || DATE_HEADER_COLORS)[1],
                }
          }
          display={
            showItems
              ? items.map((o) => (
                  <span
                    key={o.id}
                    className="st-hd-chip st-hd-in text-[8px] uppercase"
                    style={{
                      '--i': index,
                      '--c1': o.color,
                      '--c2': `color-mix(in srgb, ${o.color} 65%, black)`,
                      ...optionTextStyle(o),
                    }}
                  >
                    {o.label}
                  </span>
                ))
              : undefined
          }
          inputClassName="w-full rounded border bg-transparent px-0.5 text-center text-[8px] font-semibold outline-none"
        />
        <button
          type="button"
          title={`Remove ${field.label}`}
          data-no-drag
          onClick={() => useStrategyTesterStore.getState().removeField(strategy.id, field.id)}
          className="shrink-0 scale-75 opacity-0 transition-[opacity,transform] duration-150 group-hover:scale-100 group-hover:opacity-60 hover:!opacity-100 active:!scale-90"
          style={{ color: 'var(--ta-slate)' }}
        >
          ×
        </button>
      </div>
    </th>
  )
}

// Tracks which strategies / fields were just added (or just un-hidden) so
// their header + cells can play a short reveal instead of popping in. The
// very first render is never "new" — only changes after mount are.
function useFreshIds(ids) {
  const prev = useRef(null)
  const [fresh, setFresh] = useState(() => new Set())
  const sig = ids.join('|')
  useEffect(() => {
    let t
    if (prev.current) {
      const added = ids.filter((id) => !prev.current.has(id))
      if (added.length) {
        setFresh(new Set(added))
        t = setTimeout(() => setFresh(new Set()), 900)
      }
    }
    prev.current = new Set(ids)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig])
  return fresh
}

export default function StrategyTesterTable() {
  const strategies = useStrategyTesterStore((s) => s.strategies)
  const entries = useStrategyTesterStore((s) => s.entries)
  const year = useStrategyTesterStore((s) => s.year)
  const month = useStrategyTesterStore((s) => s.month)
  const showAddStrategy = useStrategyTesterStore((s) => s.showAddStrategy)
  const visibleWeekdays = useStrategyTesterStore((s) => s.visibleWeekdays) || [0, 1, 2, 3, 4, 5, 6]
  const [dateMenuAt, setDateMenuAt] = useState(null)
  const dateColWidth = useStrategyTesterStore((s) => s.dateColWidth) || DEFAULT_DATE_WIDTH
  const scrollerRef = useRef(null)

  const numDays = daysInMonth(year, month)
  const rows = Array.from({ length: numDays }, (_, i) => i + 1).filter((d) =>
    visibleWeekdays.includes(new Date(year, month, d).getDay())
  )
  const dayFilterActive = visibleWeekdays.length < 7
  const today = new Date()
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month

  const visibleStrategies = strategies.filter((st) => !st.hidden)
  const hiddenStrategies = strategies.filter((st) => st.hidden)

  const fresh = useFreshIds(visibleStrategies.flatMap((st) => [st.id, ...st.fields.map((f) => f.id)]))

  // Drag a field header left/right to reorder columns inside its strategy.
  const startColDrag = (e, strategy, field) =>
    beginColumnDrag(e, {
      fieldIds: strategy.fields.map((f) => f.id),
      fieldId: field.id,
      scroller: scrollerRef.current,
      onReorder: (from, to) => useStrategyTesterStore.getState().reorderFields(strategy.id, from, to),
    })

  // Soft shadow under the sticky header / beside the sticky date column
  // once content is scrolled beneath them. Toggles data attributes only
  // when the state actually flips — no React re-render per scroll event.
  const onScroll = (e) => {
    const el = e.currentTarget
    const y = el.scrollTop > 2 ? '1' : '0'
    const x = el.scrollLeft > 2 ? '1' : '0'
    if (el.dataset.stY !== y) el.dataset.stY = y
    if (el.dataset.stX !== x) el.dataset.stX = x
  }

  // Re-keying the body replays the row cascade whenever the month or the
  // weekday filter changes.
  const bodyKey = `${year}-${month}-${visibleWeekdays.join('')}`

  return (
    <div className="flex h-full min-h-0 flex-col">
      <HiddenStrategiesBar hiddenStrategies={hiddenStrategies} />
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        data-st-x="0"
        data-st-y="0"
        className="st-scroller ta-scroll min-h-0 flex-1 overflow-auto rounded-lg border"
        style={{ borderColor: 'var(--tad-border-strong)' }}
      >
      <table className="st-table">
        <colgroup>
          <col data-col="date" style={{ width: dateColWidth }} />
          {visibleStrategies.map((st) =>
            st.fields.length > 0 ? (
              st.fields.map((f) => <col key={f.id} data-col={f.id} style={{ width: f.width || defaultFieldWidth(f.type) }} />)
            ) : (
              <col key={st.id} style={{ width: 120 }} />
            )
          )}
          {showAddStrategy && <col style={{ width: 104 }} />}
          {/* filler: soaks up leftover width so the table still fills the screen */}
          <col />
        </colgroup>
        <thead>
          <tr>
            <th
              rowSpan={2}
              onContextMenu={(e) => {
                e.preventDefault()
                setDateMenuAt({ x: e.clientX, y: e.clientY })
              }}
              title="Right-click to choose which days to show"
              className="st-th-corner min-w-[64px] text-left align-middle"
            >
              <div className="st-corner">
                <span className="st-hd-chip st-hd-themed st-hd-in st-corner-chip" style={{ '--i': 0, '--c1': DATE_HEADER_COLORS[0], '--c2': DATE_HEADER_COLORS[1] }}>
                  <CalendarDays size={10} strokeWidth={2.6} />
                  Date
                </span>
                <AnimatePresence initial={false}>
                  {dayFilterActive && (
                    <motion.span
                      key="day-filter-badge"
                      initial={{ opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.1 } }}
                      transition={{ type: 'spring', stiffness: 520, damping: 26 }}
                      title={`Showing ${visibleWeekdays.length} of 7 weekdays — right-click to change`}
                      className="st-corner-badge"
                    >
                      {visibleWeekdays.length}/7 days
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              <AnimatePresence>
                {dateMenuAt && <WeekdayFilterPopup x={dateMenuAt.x} y={dateMenuAt.y} onClose={() => setDateMenuAt(null)} />}
              </AnimatePresence>
              <ColResizer
                colId="date"
                onCommit={(w) => useStrategyTesterStore.getState().setDateColWidth(w)}
                onReset={() => {
                  const col = document.querySelector('col[data-col="date"]')
                  if (col) col.style.width = `${DEFAULT_DATE_WIDTH}px`
                  useStrategyTesterStore.getState().setDateColWidth(DEFAULT_DATE_WIDTH)
                }}
              />
            </th>
            {visibleStrategies.map((st) => (
              <StrategyGroupHeader key={st.id} strategy={st} isOnly={strategies.length === 1} isNew={fresh.has(st.id)} />
            ))}
            {showAddStrategy && (
              <th rowSpan={2} className="st-th-group px-1 text-center align-middle">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.94 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 24 }}
                  onClick={() => useStrategyTesterStore.getState().addStrategy()}
                  title="Add another strategy to test"
                  className="whitespace-nowrap rounded-full px-2 py-0.5 text-[9px] font-semibold"
                  style={{ backgroundColor: 'var(--ta-accent)', color: '#fffcf2' }}
                >
                  + Strategy
                </motion.button>
              </th>
            )}
            <th rowSpan={2} className="st-th-group" />
          </tr>
          <tr>
            {visibleStrategies.map((st) => {
              // running column index across strategies → header stagger
              const base = visibleStrategies.slice(0, visibleStrategies.indexOf(st)).reduce((n, x) => n + Math.max(1, x.fields.length), 1)
              return st.fields.length > 0 ? (
                st.fields.map((f, fi) => (
                  <FieldHeaderCell
                    key={f.id}
                    strategy={st}
                    field={f}
                    index={base + fi}
                    isNew={fresh.has(f.id) || fresh.has(st.id)}
                    onColDragStart={(e) => startColDrag(e, st, f)}
                  />
                ))
              ) : (
                <th key={st.id} className={`st-th-field px-1 py-0.5 text-center ${fresh.has(st.id) ? 'st-col-new' : ''}`}>
                  <span className="text-[8px] italic" style={{ color: 'var(--ta-slate)', opacity: 0.7 }}>
                    add a field →
                  </span>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody key={bodyKey}>
          {rows.map((day, rowIdx) => {
            const dk = dateKey(year, month, day)
            const isToday = isCurrentMonth && today.getDate() === day
            const wd = new Date(year, month, day).getDay()
            const rowLabel = `${day} ${WEEKDAY_SHORT[wd]}`
            return (
              <tr key={day} className={`st-row-in ${isToday ? 'st-today' : ''}`} style={{ '--i': rowIdx }}>
                <td className="st-td-date" style={{ '--wk': WEEKDAY_COLORS[wd] }}>
                  {(wd === 0 || wd === 6) && <span className="st-date-bg" aria-hidden="true" />}
                  <div className="st-date">
                    <span className="st-date-num">{day}</span>
                    <span className="st-wk">{WEEKDAY_SHORT[wd]}</span>
                  </div>
                </td>
                {visibleStrategies.map((st) =>
                  st.fields.length > 0 ? (
                    st.fields.map((f) => (
                      <td key={f.id} data-field-id={f.id} className={`text-center ${fresh.has(f.id) || fresh.has(st.id) ? 'st-col-new' : ''}`}>
                        <FieldCell
                          strategyId={st.id}
                          field={f}
                          dk={dk}
                          rowLabel={rowLabel}
                          value={entries?.[st.id]?.[dk]?.[f.id]}
                        />
                      </td>
                    ))
                  ) : (
                    <td key={st.id} />
                  )
                )}
                {showAddStrategy && <td />}
                <td />
              </tr>
            )
          })}
        </tbody>
      </table>
      </div>
    </div>
  )
}
