import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { Plus, Trash2, X } from 'lucide-react'
import { useStrategyTesterStore } from '../../store/strategyTesterStore'
import { SELECT_COLORS, optionTextStyle } from '../../utils/strategyTesterFields'

function ColorPicker({ value, onPick }) {
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-md p-1" style={{ backgroundColor: 'var(--ta-bg)' }}>
      {SELECT_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onPick(c)}
          className="h-3.5 w-3.5 rounded-full transition-transform hover:scale-125"
          style={{
            backgroundColor: c,
            outline: value === c ? '2px solid var(--ta-ink)' : 'none',
            outlineOffset: 1,
          }}
        />
      ))}
      <label
        title="Custom colour"
        className="relative h-3.5 w-3.5 cursor-pointer overflow-hidden rounded-full border"
        style={{ borderColor: 'var(--ta-slate)', background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' }}
      >
        <input
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#6b7280'}
          onChange={(e) => onPick(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>
    </div>
  )
}

function StyleBtn({ active, onClick, title, children }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="flex h-5 min-w-[20px] items-center justify-center rounded px-1 text-[10px] transition-colors"
      style={{
        backgroundColor: active ? 'var(--ta-accent)' : 'var(--ta-bg)',
        color: active ? '#fffcf2' : 'var(--ta-ink)',
      }}
    >
      {children}
    </button>
  )
}

function OptionRow({ strategyId, fieldId, option }) {
  const [panelOpen, setPanelOpen] = useState(false)
  const [draft, setDraft] = useState(option.label)
  const st = useStrategyTesterStore.getState
  const style = option.style || {}
  const patch = (p) => st().updateFieldOption(strategyId, fieldId, option.id, p)
  const setStyle = (p) => patch({ style: { ...style, ...p } })

  const commit = () => {
    const next = draft.trim()
    if (next && next !== option.label) patch({ label: next })
    else setDraft(option.label)
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          title="Colour & text style"
          onClick={() => setPanelOpen((o) => !o)}
          className="h-4 w-4 shrink-0 rounded-full border"
          style={{ backgroundColor: option.color, borderColor: 'rgba(0,0,0,0.15)' }}
        />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') setDraft(option.label)
          }}
          className="min-w-0 flex-1 rounded px-1.5 py-0.5 text-[10px] font-semibold outline-none"
          style={{ backgroundColor: `${option.color}26`, color: option.color, ...optionTextStyle(option) }}
        />
        <button
          type="button"
          title="Delete"
          onClick={() => st().removeFieldOption(strategyId, fieldId, option.id)}
          className="shrink-0 opacity-50 hover:opacity-100"
          style={{ color: 'var(--ta-slate)' }}
        >
          <Trash2 size={10} />
        </button>
      </div>

      {panelOpen && (
        <div className="flex flex-col gap-1.5 rounded-md border p-1.5" style={{ borderColor: 'var(--tad-border)' }}>
          <p className="text-[8px] font-semibold uppercase tracking-wide" style={{ color: 'var(--ta-slate)' }}>
            Colour
          </p>
          <ColorPicker value={option.color} onPick={(c) => patch({ color: c })} />

          <div className="flex items-center justify-between">
            <p className="text-[8px] font-semibold uppercase tracking-wide" style={{ color: 'var(--ta-slate)' }}>
              Text colour
            </p>
            {option.textColor && (
              <button
                type="button"
                onClick={() => patch({ textColor: undefined })}
                className="text-[8px] font-semibold underline"
                style={{ color: 'var(--ta-slate)' }}
              >
                same as colour
              </button>
            )}
          </div>
          <ColorPicker value={option.textColor || option.color} onPick={(c) => patch({ textColor: c })} />

          <p className="text-[8px] font-semibold uppercase tracking-wide" style={{ color: 'var(--ta-slate)' }}>
            Text style
          </p>
          <div className="flex flex-wrap items-center gap-1">
            <StyleBtn active={style.bold} title="Bold" onClick={() => setStyle({ bold: !style.bold })}>
              <b>B</b>
            </StyleBtn>
            <StyleBtn active={style.italic} title="Italic" onClick={() => setStyle({ italic: !style.italic })}>
              <i>I</i>
            </StyleBtn>
            <StyleBtn active={style.underline} title="Underline" onClick={() => setStyle({ underline: !style.underline })}>
              <u>U</u>
            </StyleBtn>
            <StyleBtn active={style.strike} title="Strikethrough" onClick={() => setStyle({ strike: !style.strike })}>
              <s>S</s>
            </StyleBtn>
            <span className="mx-0.5 h-4 w-px" style={{ backgroundColor: 'var(--ta-slate)', opacity: 0.3 }} />
            {[
              ['sm', 'A', 8],
              ['md', 'A', 10],
              ['lg', 'A', 13],
            ].map(([key, ch, px]) => (
              <StyleBtn
                key={key}
                active={(style.size || 'md') === key}
                title={key === 'sm' ? 'Small text' : key === 'lg' ? 'Large text' : 'Normal text'}
                onClick={() => setStyle({ size: key })}
              >
                <span style={{ fontSize: px, lineHeight: 1, fontWeight: 600 }}>{ch}</span>
              </StyleBtn>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Right-click manager for a Select column: add new options, rename them,
// recolour (palette or custom colour) and delete. Opened from a Select
// cell or its column header at the mouse position `{ x, y }`.
export default function SelectOptionsPopup({ strategyId, fieldId, x, y, onClose }) {
  const field = useStrategyTesterStore((s) =>
    s.strategies.find((st) => st.id === strategyId)?.fields.find((f) => f.id === fieldId)
  )
  const options = field?.options || []
  const isCheckbox = field?.type === 'checkbox'
  const [label, setLabel] = useState('')
  const [color, setColor] = useState(SELECT_COLORS[(options.length + 1) % SELECT_COLORS.length])
  const [pos, setPos] = useState(null)
  const popRef = useRef(null)
  const rootRef = useRef(document.querySelector('[data-ta-theme]') || document.body)

  useLayoutEffect(() => {
    const root = rootRef.current.getBoundingClientRect()
    const W = 224
    const H = popRef.current?.offsetHeight || 300
    const left = Math.max(8, Math.min(x, window.innerWidth - W - 8))
    const top = Math.max(8, Math.min(y, window.innerHeight - H - 8))
    setPos({ left: left - root.left, top: top - root.top })
  }, [x, y, options.length])

  useEffect(() => {
    const onDown = (e) => {
      if (!popRef.current?.contains(e.target)) onClose()
    }
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  if (!field) return null

  const add = () => {
    const name = label.trim()
    if (!name) return
    useStrategyTesterStore.getState().addFieldOption(strategyId, fieldId, name, color)
    setLabel('')
    setColor(SELECT_COLORS[(options.length + 2) % SELECT_COLORS.length])
  }

  return createPortal(
    <motion.div
      ref={popRef}
      data-st-popover
      onContextMenu={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.12, ease: [0.23, 1, 0.32, 1] } }}
      transition={{ type: 'spring', stiffness: 500, damping: 32 }}
      className="ta-glass-popover fixed z-[100] flex w-56 flex-col gap-2 rounded-lg border p-2 shadow-xl"
      style={{
        left: pos?.left ?? -9999,
        top: pos?.top ?? -9999,
        transformOrigin: 'top left',
        backgroundColor: 'var(--ta-surface)',
        borderColor: 'var(--ta-slate)',
        color: 'var(--ta-ink)',
      }}
    >
      <div className="flex items-center justify-between">
        <p className="text-[9px] font-bold uppercase tracking-wide" style={{ color: 'var(--ta-slate)' }}>
          {isCheckbox ? 'Checkboxes' : 'Options'} — {field.label}
        </p>
        <button type="button" onClick={onClose} style={{ color: 'var(--ta-slate)' }}>
          <X size={10} />
        </button>
      </div>

      {isCheckbox && (
        <div className="flex flex-col gap-1">
          <p className="text-[8.5px] font-semibold uppercase tracking-wide" style={{ color: 'var(--ta-slate)' }}>
            Box colour {options.length > 0 && '(single box only)'}
          </p>
          <ColorPicker
            value={field.color}
            onPick={(c) => useStrategyTesterStore.getState().setFieldColor(strategyId, fieldId, c)}
          />
        </div>
      )}

      <div className="ta-scroll flex max-h-52 flex-col gap-1.5 overflow-y-auto pr-0.5">
        {options.length === 0 && (
          <p className="text-[9px] italic" style={{ color: 'var(--ta-slate)' }}>
            {isCheckbox
              ? 'No named checkboxes yet — this is a single tick box. Add names below to make a multi-checkbox list.'
              : 'No options yet — add your first one below.'}
          </p>
        )}
        {options.map((o, i) => (
          <div key={o.id} className="st-item-in" style={{ '--i': i }}>
            <OptionRow strategyId={strategyId} fieldId={fieldId} option={o} />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1.5 border-t pt-2" style={{ borderColor: 'var(--tad-border)' }}>
        <p className="text-[8.5px] font-semibold uppercase tracking-wide" style={{ color: 'var(--ta-slate)' }}>
          {isCheckbox ? 'New checkbox' : 'New option'}
        </p>
        <div className="flex items-center gap-1">
          <span className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: color }} />
          <input
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder={isCheckbox ? 'Checkbox name…' : 'Option name…'}
            className="min-w-0 flex-1 rounded border bg-transparent px-1.5 py-0.5 text-[10px] outline-none"
            style={{ borderColor: 'var(--tad-border)' }}
          />
          <button
            type="button"
            onClick={add}
            disabled={!label.trim()}
            className="flex shrink-0 items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-semibold disabled:opacity-40"
            style={{ backgroundColor: 'var(--ta-accent)', color: '#fffcf2' }}
          >
            <Plus size={9} />
            Add
          </button>
        </div>
        <ColorPicker value={color} onPick={setColor} />
      </div>
    </motion.div>,
    rootRef.current
  )
}
