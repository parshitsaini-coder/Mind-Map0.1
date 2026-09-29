import { memo, useCallback, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { ExternalLink, Star, StickyNote } from 'lucide-react'
import { useStrategyTesterStore } from '../../store/strategyTesterStore'
import NotesPopup from './NotesPopup'
import RRRSelect from './RRRSelect'
import ImageCell from './ImageCell'
import SelectCell from './SelectCell'
import CheckboxCell from './CheckboxCell'

const inputCls = 'st-cell-input'

// Five stars with a hover preview (stars light up to the one under the
// pointer) and a small left-to-right pop wave when a rating is set.
function RatingCell({ value, onChange, label }) {
  const n = Number(value) || 0
  const [hover, setHover] = useState(0)
  const [wave, setWave] = useState(0)
  const shown = hover || n
  return (
    <div
      className="flex items-center justify-center gap-[1px]"
      title={n ? `${n}/5` : label}
      onMouseLeave={() => setHover(0)}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={`${i}-${wave}`}
          type="button"
          onMouseEnter={() => setHover(i)}
          onClick={() => {
            setWave((w) => w + 1)
            onChange(n === i ? null : i)
          }}
          className={`st-star flex ${wave > 0 && i <= n ? 'st-star-wave' : ''}`}
          style={{ '--i': i - 1 }}
        >
          <Star
            size={9}
            strokeWidth={2}
            style={{
              color: i <= shown ? '#f59e0b' : 'var(--ta-slate)',
              fill: i <= shown ? '#f59e0b' : 'transparent',
              opacity: i <= shown ? (hover && i > n ? 0.65 : 1) : 0.4,
              transition: 'color 0.12s ease, fill 0.12s ease, opacity 0.12s ease',
            }}
          />
        </button>
      ))}
    </div>
  )
}

// Grid cells are memoised: typing in one cell only re-renders that cell, not
// all ~300 of them. `onChange` is built here from stable props (strategy id,
// day key, field id) so it never breaks the memo.
export default memo(function FieldCellMemo({ strategyId, field, dk, value, rowLabel }) {
  const onChange = useCallback(
    (v) => useStrategyTesterStore.getState().setCellValue(strategyId, dk, field.id, v),
    [strategyId, dk, field.id]
  )
  return <FieldCell strategyId={strategyId} field={field} value={value} onChange={onChange} rowLabel={rowLabel} />
})

function FieldCell({ strategyId, field, value, onChange, rowLabel }) {
  const [notesOpen, setNotesOpen] = useState(false)

  switch (field.type) {
    case 'checkbox':
      return <CheckboxCell strategyId={strategyId} field={field} value={value} onChange={onChange} />

    case 'buysell':
      return (
        <div className="flex items-center justify-center gap-0.5">
          {[
            { key: 'buy', label: 'B', color: '#16a34a' },
            { key: 'sell', label: 'S', color: '#dc2626' },
          ].map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => onChange(value === opt.key ? null : opt.key)}
              className={`st-toggle flex h-4 w-4 items-center justify-center rounded-[3px] text-[8.5px] font-bold ${value === opt.key ? 'is-on' : ''}`}
              style={{
                backgroundColor: value === opt.key ? opt.color : 'transparent',
                color: value === opt.key ? '#fffcf2' : 'var(--ta-slate)',
                border: `1px solid ${value === opt.key ? opt.color : 'var(--tad-border)'}`,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )

    case 'outcome':
      return (
        <div className="flex items-center justify-center gap-0.5">
          {[
            { key: 'win', label: 'W', color: '#16a34a' },
            { key: 'loss', label: 'L', color: '#dc2626' },
            { key: 'be', label: 'BE', color: 'var(--ta-slate)' },
          ].map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => onChange(value === opt.key ? null : opt.key)}
              title={opt.key === 'be' ? 'Breakeven' : opt.key === 'win' ? 'Win' : 'Loss'}
              className={`st-toggle flex h-4 min-w-[13px] items-center justify-center rounded-[3px] px-0.5 text-[7.5px] font-bold ${value === opt.key ? 'is-on' : ''}`}
              style={{
                backgroundColor: value === opt.key ? opt.color : 'transparent',
                color: value === opt.key ? '#fffcf2' : 'var(--ta-slate)',
                border: `1px solid ${value === opt.key ? opt.color : 'var(--tad-border)'}`,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )

    case 'rrr':
      return <RRRSelect value={value || null} onChange={onChange} label={field.label} />

    case 'sltarget':
      return (
        <div className="flex flex-col items-stretch gap-[1px] px-0.5 leading-none">
          <div className="flex items-center gap-0.5">
            <span className="text-[6.5px] font-bold" style={{ color: '#dc2626' }}>
              SL
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={value?.sl ?? ''}
              onChange={(e) => onChange({ ...(value || {}), sl: e.target.value })}
              className={inputCls}
              style={{ color: '#dc2626' }}
              placeholder="—"
            />
          </div>
          <div className="flex items-center gap-0.5">
            <span className="text-[6.5px] font-bold" style={{ color: '#16a34a' }}>
              TP
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={value?.target ?? ''}
              onChange={(e) => onChange({ ...(value || {}), target: e.target.value })}
              className={inputCls}
              style={{ color: '#16a34a' }}
              placeholder="—"
            />
          </div>
        </div>
      )

    case 'pnl': {
      const num = value === '' || value == null ? null : parseFloat(value)
      const color = num == null || Number.isNaN(num) ? 'var(--ta-ink)' : num > 0 ? '#16a34a' : num < 0 ? '#dc2626' : 'var(--ta-ink)'
      return (
        <input
          type="text"
          inputMode="decimal"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
          style={{ color, fontWeight: 700 }}
          placeholder="—"
        />
      )
    }

    case 'number':
      return (
        <input
          type="text"
          inputMode="decimal"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
          placeholder="—"
        />
      )

    case 'notes':
      return (
        <>
          <button
            type="button"
            onClick={() => setNotesOpen(true)}
            title={value ? value : 'Add a note'}
            className="flex h-full w-full items-center justify-center gap-0.5 px-0.5"
          >
            <span key={value ? 'has' : 'none'} className={`flex ${value ? 'st-chip-in' : ''}`}>
              <StickyNote size={10} style={{ color: value ? 'var(--ta-accent)' : 'var(--ta-slate)', opacity: value ? 1 : 0.45, transition: 'color 0.2s ease, opacity 0.2s ease' }} />
            </span>
            {value ? (
              <span className="truncate text-[8px]" style={{ color: 'var(--ta-ink)', maxWidth: 46 }}>
                {value}
              </span>
            ) : null}
          </button>
          <AnimatePresence>
            {notesOpen && (
              <NotesPopup
                title={`${field.label} — ${rowLabel}`}
                value={value}
                onSave={onChange}
                onClose={() => setNotesOpen(false)}
              />
            )}
          </AnimatePresence>
        </>
      )

    case 'image':
      return <ImageCell value={value} onChange={onChange} />

    case 'multiselect':
      return <SelectCell strategyId={strategyId} field={field} value={value} onChange={onChange} />

    case 'text':
      return (
        <input
          type="text"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
          style={{ textAlign: 'left', paddingLeft: 4, paddingRight: 4 }}
          placeholder="—"
          title={value || field.label}
        />
      )

    case 'time':
      return (
        <input
          type="time"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        />
      )

    case 'rating':
      return <RatingCell value={value} onChange={onChange} label={field.label} />

    case 'link': {
      const href = value ? (/^https?:\/\//i.test(value) ? value : `https://${value}`) : ''
      return (
        <div className="flex items-center gap-0.5 px-0.5">
          <input
            type="text"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            className={inputCls}
            style={{ textAlign: 'left', paddingLeft: 2 }}
            placeholder="https://…"
            title={value || field.label}
          />
          {href && (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              title="Open link"
              className="flex shrink-0"
              style={{ color: 'var(--ta-accent)' }}
            >
              <ExternalLink size={9} />
            </a>
          )}
        </div>
      )
    }

    case 'select':
      return <SelectCell strategyId={strategyId} field={field} value={value} onChange={onChange} />

    default:
      return null
  }
}
