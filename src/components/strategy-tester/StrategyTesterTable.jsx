import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Pencil, Trash2, Eye, EyeOff } from 'lucide-react'
import { useStrategyTesterStore } from '../../store/strategyTesterStore'
import {
  FIELD_TYPE_MAP,
  FIELD_HEADER_COLORS,
  DATE_HEADER_COLORS,
  defaultFieldWidth,
  DEFAULT_DATE_WIDTH,
  MIN_COL_WIDTH,
  MAX_COL_WIDTH,
  daysInMonth,
  dateKey,
  weekdayFor,
} from '../../utils/strategyTesterFields'
import AddFieldMenu from './AddFieldMenu'
import FieldCell from './FieldCell'
import SelectOptionsPopup from './SelectOptionsPopup'
import WeekdayFilterPopup from './WeekdayFilterPopup'

// Inline-editable label shared by strategy names and field labels — click
// the text to turn it into a small input, Enter/blur commits, Esc cancels.
function EditableLabel({ value, onCommit, className, inputClassName, placeholder, style }) {
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
      {value || placeholder}
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

function StrategyGroupHeader({ strategy, isOnly }) {
  const colSpan = strategy.fields.length || 1

  const handleRemove = () => {
    if (!window.confirm(`Remove "${strategy.name}" and all its data for every month? This can't be undone.`)) return
    useStrategyTesterStore.getState().removeStrategy(strategy.id)
  }

  const handleHide = () => useStrategyTesterStore.getState().toggleStrategyHidden(strategy.id)

  return (
    <th colSpan={colSpan} className="st-th-group px-1.5 text-left align-middle">
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
  if (hiddenStrategies.length === 0) return null
  return (
    <div
      className="mb-1 flex shrink-0 flex-wrap items-center gap-1 rounded-lg border px-1.5 py-1"
      style={{ borderColor: 'var(--tad-border-strong)', backgroundColor: 'var(--ta-surface)' }}
    >
      <span className="text-[8px] font-semibold uppercase tracking-wide opacity-60" style={{ color: 'var(--ta-ink)' }}>
        Hidden:
      </span>
      {hiddenStrategies.map((st) => (
        <motion.button
          key={st.id}
          type="button"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          title={`Show "${st.name}" again`}
          onClick={() => useStrategyTesterStore.getState().toggleStrategyHidden(st.id)}
          className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold"
          style={{ backgroundColor: 'var(--ta-bg)', color: 'var(--ta-ink)' }}
        >
          <Eye size={9} />
          {st.name}
        </motion.button>
      ))}
    </div>
  )
}

function FieldHeaderCell({ strategy, field }) {
  const meta = FIELD_TYPE_MAP[field.type]
  const [menuAt, setMenuAt] = useState(null)
  const isSelect = ['select', 'multiselect', 'checkbox'].includes(field.type)
  return (
    <th
      className="st-th-field group px-1 py-0.5 text-center align-middle"
      style={{ minWidth: meta?.width ?? 50 }}
      onContextMenu={
        isSelect
          ? (e) => {
              e.preventDefault()
              setMenuAt({ x: e.clientX, y: e.clientY })
            }
          : undefined
      }
    >
      {menuAt && (
        <SelectOptionsPopup strategyId={strategy.id} fieldId={field.id} x={menuAt.x} y={menuAt.y} onClose={() => setMenuAt(null)} />
      )}
      <ColResizer
        colId={field.id}
        onCommit={(w) => useStrategyTesterStore.getState().setFieldWidth(strategy.id, field.id, w)}
        onReset={() => {
          const col = document.querySelector(`col[data-col="${field.id}"]`)
          if (col) col.style.width = `${defaultFieldWidth(field.type)}px`
          useStrategyTesterStore.getState().setFieldWidth(strategy.id, field.id, undefined)
        }}
      />
      <div className="flex items-center justify-center gap-0.5">
        <EditableLabel
          value={field.label}
          onCommit={(label) => useStrategyTesterStore.getState().renameField(strategy.id, field.id, label)}
          className="st-hd-chip text-[8px] uppercase"
          style={{
            '--c1': (FIELD_HEADER_COLORS[field.type] || DATE_HEADER_COLORS)[0],
            '--c2': (FIELD_HEADER_COLORS[field.type] || DATE_HEADER_COLORS)[1],
          }}
          inputClassName="w-full rounded border bg-transparent px-0.5 text-center text-[8px] font-semibold outline-none"
        />
        <button
          type="button"
          title={`Remove ${field.label}`}
          onClick={() => useStrategyTesterStore.getState().removeField(strategy.id, field.id)}
          className="shrink-0 opacity-0 transition-opacity group-hover:opacity-60 hover:!opacity-100"
          style={{ color: 'var(--ta-slate)' }}
        >
          ×
        </button>
      </div>
    </th>
  )
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

  const numDays = daysInMonth(year, month)
  const rows = Array.from({ length: numDays }, (_, i) => i + 1).filter((d) =>
    visibleWeekdays.includes(new Date(year, month, d).getDay())
  )
  const dayFilterActive = visibleWeekdays.length < 7
  const today = new Date()
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month

  const visibleStrategies = strategies.filter((st) => !st.hidden)
  const hiddenStrategies = strategies.filter((st) => st.hidden)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <HiddenStrategiesBar hiddenStrategies={hiddenStrategies} />
      <div className="ta-scroll min-h-0 flex-1 overflow-auto rounded-lg border" style={{ borderColor: 'var(--tad-border-strong)' }}>
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
              className="st-th-corner min-w-[64px] px-1.5 text-left text-[9px] font-bold uppercase tracking-wide"
            >
              <span className="st-hd-chip text-[9px]" style={{ '--c1': DATE_HEADER_COLORS[0], '--c2': DATE_HEADER_COLORS[1] }}>
                Date
              </span>
              {dayFilterActive && (
                <span className="ml-1 rounded-full px-1 text-[7px] font-bold normal-case" style={{ backgroundColor: 'var(--ta-accent)', color: '#fffcf2' }}>
                  {visibleWeekdays.length}/7
                </span>
              )}
              {dateMenuAt && <WeekdayFilterPopup x={dateMenuAt.x} y={dateMenuAt.y} onClose={() => setDateMenuAt(null)} />}
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
              <StrategyGroupHeader key={st.id} strategy={st} isOnly={strategies.length === 1} />
            ))}
            {showAddStrategy && (
              <th rowSpan={2} className="st-th-group px-1 text-center align-middle">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.94 }}
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
            {visibleStrategies.map((st) =>
              st.fields.length > 0 ? (
                st.fields.map((f) => <FieldHeaderCell key={f.id} strategy={st} field={f} />)
              ) : (
                <th key={st.id} className="st-th-field px-1 py-0.5 text-center">
                  <span className="text-[8px] italic" style={{ color: 'var(--ta-slate)', opacity: 0.7 }}>
                    add a field →
                  </span>
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((day) => {
            const dk = dateKey(year, month, day)
            const isToday = isCurrentMonth && today.getDate() === day
            return (
              <tr key={day} className={isToday ? 'st-today' : ''}>
                <td className="st-td-date px-1.5 text-[9px] font-semibold">
                  <div className="flex items-baseline gap-1">
                    <span>{day}</span>
                    <span className="text-[7.5px] font-normal opacity-60">{weekdayFor(year, month, day)}</span>
                  </div>
                </td>
                {visibleStrategies.map((st) =>
                  st.fields.length > 0 ? (
                    st.fields.map((f) => (
                      <td key={f.id} className="text-center">
                        <FieldCell
                          strategyId={st.id}
                          field={f}
                          rowLabel={`${day} ${weekdayFor(year, month, day)}`}
                          value={entries?.[st.id]?.[dk]?.[f.id]}
                          onChange={(v) => useStrategyTesterStore.getState().setCellValue(st.id, dk, f.id, v)}
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
