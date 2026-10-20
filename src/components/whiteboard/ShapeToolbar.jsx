import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  GripHorizontal, PaintBucket, Type, Layers, Copy, Lock, LockOpen, Eye, EyeOff, Trash2, BringToFront, SendToBack, ArrowUp, ArrowDown,
  MoveUpRight, Check, Pencil, Maximize2,
} from 'lucide-react'
import { useWhiteboardStore } from '../../store/whiteboardStore'
import { TOOLS } from './drawShapes'

// ──────────────────────────────────────────────────────────────────────────
// Floating "edit" toolbar for the selected drawing — colour grid, fill,
// opacity, width, line style, arrows / extend, text size, layer order,
// duplicate / lock / hide / delete. Spring pop-in, tap animations, animated
// popovers; the bar itself can be dragged out of the way.
// ──────────────────────────────────────────────────────────────────────────

const mix = (hex, t, to = 255) => {
  const n = parseInt(hex.slice(1), 16)
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (to - v) * t))
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}
const HUES = ['#f23645', '#ff9800', '#ffeb3b', '#4caf50', '#089981', '#00bcd4', '#2962ff', '#673ab7', '#9c27b0', '#e91e63']
const GRAYS = ['#ffffff', '#d1d4dc', '#b2b5be', '#9598a1', '#787b86', '#5d606b', '#434651', '#2a2e39', '#131722', '#000000']
const GRID = [GRAYS, HUES.map((h) => mix(h, 0.8)), HUES.map((h) => mix(h, 0.5)), HUES, HUES.map((h) => mix(h, 0.35, 0)), HUES.map((h) => mix(h, 0.65, 0))]
const WIDTHS = [1, 2, 3, 4, 6, 8, 10, 12]
const spring = { type: 'spring', stiffness: 520, damping: 30 }
let savedOffset = {} // per-element drag offset, so the bar stays where you parked it

function IconBtn({ title, onClick, active, children, danger, disabled, wide }) {
  return (
    <motion.button
      type="button"
      aria-label={title}
      title={title}
      disabled={disabled}
      onClick={onClick}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.82, rotate: danger ? -8 : 0 }}
      transition={spring}
      className={`group relative flex h-7 ${wide ? 'min-w-[34px] px-1.5' : 'w-7'} shrink-0 items-center justify-center gap-0.5 rounded-md text-[var(--color-ink)] disabled:opacity-30 ${
        active ? 'bg-[var(--color-accent)]' : danger ? 'text-red-600 hover:bg-red-500/10' : 'hover:bg-[var(--color-sage)]'
      }`}
    >
      {children}
    </motion.button>
  )
}

const Sep = () => <div className="mx-0.5 h-5 w-px shrink-0" style={{ backgroundColor: 'var(--color-sage)' }} />

function Popover({ children, width = 232, align = 'left' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.95 }}
      transition={spring}
      data-wbpop
      className="absolute top-full z-30 mt-1.5 rounded-lg border p-2 shadow-xl"
      style={{ width, [align]: 0, transformOrigin: align === 'left' ? 'top left' : 'top right', backgroundColor: 'var(--color-cream)', borderColor: 'var(--color-sage)' }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {children}
    </motion.div>
  )
}

function Slider({ label, value, min, max, step = 1, suffix = '', onChange }) {
  return (
    <label className="mt-2 flex items-center gap-2 text-[10px] text-[var(--color-slate)]">
      <span className="w-12 shrink-0">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="min-w-0 flex-1 accent-[var(--color-accent)]" />
      <span className="w-9 shrink-0 text-right font-semibold text-[var(--color-ink)]">
        {Math.round(value * (suffix === '%' ? 100 : 1))}
        {suffix}
      </span>
    </label>
  )
}

function ColorGrid({ value, onPick }) {
  return (
    <div>
      <div className="grid grid-cols-10 gap-[3px]">
        {GRID.flat().map((c, i) => {
          const on = (value || '').toLowerCase() === c.toLowerCase()
          return (
            <motion.button
              key={`${c}${i}`}
              type="button"
              title={c}
              onClick={() => onPick(c)}
              whileHover={{ scale: 1.25, zIndex: 2 }}
              whileTap={{ scale: 0.8 }}
              transition={spring}
              className="relative h-[18px] w-[18px] rounded-[4px] border"
              style={{ backgroundColor: c, borderColor: 'rgba(0,0,0,0.18)' }}
            >
              {on && <Check size={11} strokeWidth={3.5} className="absolute inset-0 m-auto" color={mix(c, 1, 0) === '#000000' || c === '#000000' ? '#fff' : parseInt(c.slice(1), 16) > 0x888888 ? '#000' : '#fff'} />}
            </motion.button>
          )
        })}
      </div>
      <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1 text-[11px] font-medium hover:bg-[var(--color-sage)]/50" style={{ borderColor: 'var(--color-sage)' }}>
        <span className="h-4 w-4 rounded-full border" style={{ background: 'conic-gradient(red, #fbbf24, #34d399, #38bdf8, #818cf8, #f472b6, red)', borderColor: 'var(--color-slate)' }} />
        Custom colour…
        <input type="color" value={/^#[0-9a-f]{6}$/i.test(value || '') ? value : '#2563eb'} onChange={(e) => onPick(e.target.value)} className="sr-only" />
      </label>
    </div>
  )
}

const Dash = ({ d, w = 2 }) => (
  <svg width="46" height="10" aria-hidden>
    <line x1="2" y1="5" x2="44" y2="5" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeDasharray={d} />
  </svg>
)

export default function ShapeToolbar({ element, pan, zoom, bounds, canvasRef }) {
  const wb = useWhiteboardStore.getState()
  const spec = element.type === 'shape' ? TOOLS[element.tool] : null
  const isShape = element.type === 'shape'
  const [open, setOpen] = useState(null) // 'stroke' | 'fill' | 'width' | 'style' | 'arrows' | 'text' | 'layer'
  const [drag, setDrag] = useState(savedOffset[element.id] || { x: 0, y: 0 })
  const ref = useRef(null)
  const [size, setSize] = useState({ w: 360, cw: 1200 })

  useLayoutEffect(() => {
    if (ref.current && canvasRef?.current) setSize({ w: ref.current.offsetWidth, cw: canvasRef.current.clientWidth })
  }, [element.id, open, spec, isShape])

  useEffect(() => {
    setOpen(null)
    setDrag(savedOffset[element.id] || { x: 0, y: 0 })
  }, [element.id])

  useEffect(() => {
    if (!open) return undefined
    const off = (e) => {
      if (!e.target.closest?.('[data-wbpop]') && !e.target.closest?.('[data-wbpopbtn]')) setOpen(null)
    }
    window.addEventListener('pointerdown', off)
    return () => window.removeEventListener('pointerdown', off)
  }, [open])

  const set = (patch) => wb.setElementStyle(element.id, patch)
  const w = element.strokeWidth || 2
  const color = element.color || '#2563eb'
  const lineStyle = element.lineStyle || 'solid'
  const fillColor = element.fillColor || color
  const lineLike = !!spec?.lineLike
  const canFill = spec?.fill !== undefined
  const hasText = !!(spec?.text || spec?.glyph)
  const toggle = (name) => setOpen((o) => (o === name ? null : name))

  let left = pan.x + bounds.x * zoom
  let top = pan.y + bounds.y * zoom - 52
  if (top < 6) top = pan.y + (bounds.y + bounds.height) * zoom + 14
  left = Math.max(6, Math.min(left, size.cw - size.w - 6))

  const startMove = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const sx = e.clientX
    const sy = e.clientY
    const base = drag
    const move = (ev) => {
      const next = { x: base.x + ev.clientX - sx, y: base.y + ev.clientY - sy }
      savedOffset[element.id] = next
      setDrag(next)
    }
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const pop = (name, btn, body, width, align) => (
    <div className="relative" key={name}>
      <span data-wbpopbtn>{btn}</span>
      <AnimatePresence>{open === name && <Popover width={width} align={align}>{body}</Popover>}</AnimatePresence>
    </div>
  )

  return (
    <motion.div
      ref={ref}
      key={element.id}
      initial={{ opacity: 0, y: 10, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={spring}
      className="absolute z-20 flex items-center gap-0.5 rounded-xl border px-1 py-1 shadow-2xl backdrop-blur"
      style={{
        left: left + drag.x,
        top: Math.max(4, top + drag.y),
        backgroundColor: 'color-mix(in srgb, var(--color-cream) 94%, transparent)',
        borderColor: 'var(--color-sage)',
        transformOrigin: 'bottom left',
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div onMouseDown={startMove} title="Drag to move this bar" className="flex h-7 w-4 shrink-0 cursor-grab items-center justify-center text-[var(--color-slate)] active:cursor-grabbing">
        <GripHorizontal size={13} className="rotate-90" />
      </div>

      {/* Stroke / line colour + opacity */}
      {pop(
        'stroke',
        <IconBtn title="Colour & opacity" active={open === 'stroke'} onClick={() => toggle('stroke')}>
          <motion.span key={color} initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={spring} className="h-4 w-4 rounded-full border-2" style={{ backgroundColor: color, borderColor: 'var(--color-ink)' }} />
        </IconBtn>,
        <>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--color-slate)]">{isShape ? 'Line / text colour' : 'Stroke colour'}</p>
          <ColorGrid value={color} onPick={(c) => wb.setElementColor(element.id, c)} />
          <Slider label="Opacity" value={element.opacity ?? 1} min={0.1} max={1} step={0.05} suffix="%" onChange={(v) => set({ opacity: v })} />
        </>,
        236
      )}

      {/* Fill */}
      {canFill &&
        pop(
          'fill',
          <IconBtn title="Fill" active={open === 'fill'} onClick={() => toggle('fill')}>
            <PaintBucket size={15} />
            <motion.span animate={{ opacity: element.fill ? 1 : 0.25 }} className="absolute bottom-0.5 left-1.5 right-1.5 h-[3px] rounded-full" style={{ backgroundColor: fillColor }} />
          </IconBtn>,
          <>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-slate)]">Background fill</p>
              <button type="button" onClick={() => set({ fill: !element.fill })} className={`relative h-4 w-8 rounded-full transition-colors ${element.fill ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-sage)]'}`} aria-pressed={!!element.fill}>
                <motion.span layout transition={spring} className="absolute top-0.5 h-3 w-3 rounded-full bg-[var(--color-ink)]" style={{ left: element.fill ? 18 : 2 }} />
              </button>
            </div>
            <ColorGrid value={fillColor} onPick={(c) => set({ fillColor: c, fill: true })} />
            <Slider label="Opacity" value={element.fillOpacity ?? 0.18} min={0.02} max={1} step={0.02} suffix="%" onChange={(v) => set({ fillOpacity: v, fill: true })} />
          </>,
          236
        )}

      {/* Width */}
      {!spec?.glyph &&
        pop(
          'width',
          <IconBtn title="Line width" wide active={open === 'width'} onClick={() => toggle('width')}>
            <svg width="16" height="14" aria-hidden>
              <line x1="1" y1="7" x2="15" y2="7" stroke="currentColor" strokeWidth={Math.min(6, w)} strokeLinecap="round" />
            </svg>
            <span className="text-[10px] font-bold tabular-nums">{w}</span>
          </IconBtn>,
          <div className="flex flex-col gap-0.5">
            {WIDTHS.map((n) => (
              <motion.button key={n} type="button" whileTap={{ scale: 0.96 }} onClick={() => set({ strokeWidth: n })} className={`flex items-center gap-3 rounded px-2 py-1 text-[11px] ${w === n ? 'bg-[var(--color-accent)]/60' : 'hover:bg-[var(--color-sage)]/60'}`}>
                <span className="w-6 text-left font-semibold tabular-nums">{n}px</span>
                <svg width="100" height="12" aria-hidden className="flex-1">
                  <line x1="2" y1="6" x2="98" y2="6" stroke="currentColor" strokeWidth={n} strokeLinecap="round" />
                </svg>
                {w === n && <Check size={12} />}
              </motion.button>
            ))}
          </div>,
          170
        )}

      {/* Line style */}
      {!spec?.glyph &&
        pop(
          'style',
          <IconBtn title="Line style" wide active={open === 'style'} onClick={() => toggle('style')}>
            <Dash d={lineStyle === 'dashed' ? '9 6' : lineStyle === 'dotted' ? '1 6' : undefined} />
          </IconBtn>,
          <div className="flex flex-col gap-0.5">
            {[['solid', undefined, 'Solid'], ['dashed', '9 6', 'Dashed'], ['dotted', '1 6', 'Dotted']].map(([id, d, name]) => (
              <motion.button key={id} type="button" whileTap={{ scale: 0.96 }} onClick={() => set({ lineStyle: id })} className={`flex items-center gap-3 rounded px-2 py-1.5 text-[11px] ${lineStyle === id ? 'bg-[var(--color-accent)]/60' : 'hover:bg-[var(--color-sage)]/60'}`}>
                <Dash d={d} w={3} />
                <span className="font-medium">{name}</span>
                {lineStyle === id && <Check size={12} className="ml-auto" />}
              </motion.button>
            ))}
          </div>,
          160
        )}

      {/* Arrow ends / extend */}
      {lineLike &&
        pop(
          'arrows',
          <IconBtn title="Arrows & extend" active={open === 'arrows' || element.arrowStart || element.arrowEnd || element.extendL || element.extendR} onClick={() => toggle('arrows')}>
            <MoveUpRight size={15} />
          </IconBtn>,
          <div className="flex flex-col gap-1">
            {[['arrowStart', 'Arrow at start'], ['arrowEnd', 'Arrow at end'], ['extendL', 'Extend left'], ['extendR', 'Extend right']].map(([k, label]) => (
              <motion.button key={k} type="button" whileTap={{ scale: 0.96 }} onClick={() => set({ [k]: !element[k] })} className="flex items-center gap-2 rounded px-2 py-1.5 text-left text-[11px] font-medium hover:bg-[var(--color-sage)]/60">
                <span className={`flex h-4 w-4 items-center justify-center rounded border ${element[k] ? 'bg-[var(--color-accent)]' : ''}`} style={{ borderColor: 'var(--color-slate)' }}>
                  {element[k] && <Check size={11} strokeWidth={3.5} />}
                </span>
                {label}
              </motion.button>
            ))}
          </div>,
          180
        )}

      {/* Candle size — width (thick/thin) and height (tall/short) */}
      {spec?.candle &&
        pop(
          'csize',
          <IconBtn title="Candle size" active={open === 'csize'} onClick={() => toggle('csize')}>
            <Maximize2 size={15} />
          </IconBtn>,
          <>
            <Slider label="Width" value={element.candleW ?? 1} min={0.4} max={3} step={0.1} suffix="%" onChange={(v) => set({ candleW: v })} />
            <Slider label="Height" value={element.candleH ?? 1} min={0.4} max={4} step={0.1} suffix="%" onChange={(v) => set({ candleH: v })} />
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={() => set({ candleW: 1, candleH: 1 })}
              className="mt-2 flex w-full items-center justify-center rounded-md bg-[var(--color-accent)] py-1.5 text-[11px] font-semibold"
            >
              Reset size
            </motion.button>
          </>,
          214
        )}

      {/* Text */}
      {hasText &&
        pop(
          'text',
          <IconBtn title="Text / size" active={open === 'text'} onClick={() => toggle('text')}>
            <Type size={15} />
          </IconBtn>,
          <>
            <Slider label="Size" value={element.fontSize || (spec.glyph ? 36 : 12)} min={spec.glyph ? 14 : 8} max={spec.glyph ? 140 : 48} suffix="px" onChange={(v) => set({ fontSize: v })} />
            {spec.text && (
              <motion.button
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setOpen(null)
                  window.dispatchEvent(new CustomEvent('wb-edit-shape', { detail: element.id }))
                }}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md bg-[var(--color-accent)] py-1.5 text-[11px] font-semibold"
              >
                <Pencil size={12} /> Edit text
              </motion.button>
            )}
          </>,
          214
        )}

      {/* Layer order */}
      {pop(
        'layer',
        <IconBtn title="Layer order" active={open === 'layer'} onClick={() => toggle('layer')}>
          <Layers size={15} />
        </IconBtn>,
        <div className="flex flex-col gap-0.5">
          {[['front', BringToFront, 'Bring to front'], ['forward', ArrowUp, 'Bring forward'], ['backward', ArrowDown, 'Send backward'], ['back', SendToBack, 'Send to back']].map(([m, Icon, name]) => (
            <motion.button key={m} type="button" whileTap={{ scale: 0.95, x: 3 }} onClick={() => wb.reorderElement(element.id, m)} className="flex items-center gap-2 rounded px-2 py-1.5 text-left text-[11px] font-medium hover:bg-[var(--color-sage)]/60">
              <Icon size={13} /> {name}
            </motion.button>
          ))}
        </div>,
        170,
        'right'
      )}

      <Sep />
      <IconBtn title="Duplicate (copy)" onClick={() => wb.duplicateElement(element.id)}>
        <Copy size={14} />
      </IconBtn>
      <IconBtn title={element.locked ? 'Unlock' : 'Lock'} active={!!element.locked} onClick={() => wb.toggleElementFlag(element.id, 'locked')}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={element.locked ? 'l' : 'u'} initial={{ scale: 0.4, rotate: -30, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} transition={{ duration: 0.12 }}>
            {element.locked ? <Lock size={14} /> : <LockOpen size={14} />}
          </motion.span>
        </AnimatePresence>
      </IconBtn>
      <IconBtn
        title="Hide (show again from the Object tree)"
        onClick={() => {
          wb.toggleElementFlag(element.id, 'hidden')
          wb.selectElement(null)
        }}
      >
        {element.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
      </IconBtn>
      <IconBtn title="Delete (Del)" danger onClick={() => wb.deleteElement(element.id)}>
        <Trash2 size={14} />
      </IconBtn>
    </motion.div>
  )
}
