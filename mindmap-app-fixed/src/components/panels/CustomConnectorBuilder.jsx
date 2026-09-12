import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Wand2, Spline, Palette, ArrowRightToLine, Sparkles, Smile } from 'lucide-react'
import { useMapStore } from '../../store/mapStore'
import { useUiStore } from '../../store/uiStore'
import { ICONS } from '../../theme/iconSet'

const PATH_TYPES = [
  { value: 'straight', label: 'Straight' },
  { value: 'bezier', label: 'Bezier' },
  { value: 'simplebezier', label: 'Simple Bezier' },
  { value: 'smoothstep', label: 'Smoothstep' },
  { value: 'step', label: 'Step' },
]

const DASH_PATTERNS = [
  { value: undefined, label: 'Solid' },
  { value: '6 4', label: 'Dashed' },
  { value: '1.5 4', label: 'Dotted', cap: 'round' },
  { value: '8 3 2 3', label: 'Dash-dot' },
  { value: '12 5', label: 'Long dash' },
  { value: '2 6', label: 'Fine dots', cap: 'round' },
]

const CAPS = [
  { value: undefined, label: 'Butt' },
  { value: 'round', label: 'Round' },
  { value: 'square', label: 'Square' },
]

const MID_ICON_NAMES = ['Star', 'Flag', 'Heart', 'Zap', 'Target', 'CheckCircle', 'AlertTriangle', 'Bell']

// Every section fades/slides in with a small stagger, matching the
// Custom Style Builder's entrance so both builders feel like one family.
const sectionVariants = {
  hidden: { opacity: 0, y: 8 },
  show: (i) => ({ opacity: 1, y: 0, transition: { delay: 0.03 * i, duration: 0.25, ease: 'easeOut' } }),
}

function Section({ icon: Icon, title, index, children }) {
  return (
    <motion.div
      custom={index}
      variants={sectionVariants}
      initial="hidden"
      animate="show"
      className="rounded-lg border border-[var(--color-sage)]/60 bg-white/50 p-3"
    >
      <div className="mb-2.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-slate)]">
        <Icon size={12} className="text-[var(--color-accent)]" />
        {title}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">{children}</div>
    </motion.div>
  )
}

function Field({ label, full, children }) {
  return (
    <label className={`flex flex-col gap-1 text-[9px] font-medium uppercase tracking-wide text-[var(--color-slate)] ${full ? 'col-span-2' : ''}`}>
      {label}
      {children}
    </label>
  )
}

function ColorField({ label, value, onChange }) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-1.5 rounded-md border border-[var(--color-sage)] bg-white/60 px-1.5 py-1">
        <span className="relative h-5 w-5 shrink-0 overflow-hidden rounded-full border border-black/10 shadow-inner" style={{ backgroundColor: value }}>
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
        </span>
        <span className="truncate text-[10px] normal-case tracking-normal text-[var(--color-ink)]">{value}</span>
      </div>
    </Field>
  )
}

function SliderField({ label, value, ...props }) {
  return (
    <Field label={label} full>
      <input type="range" value={value} className="styled-range w-full" {...props} />
    </Field>
  )
}

// Toggle "pill" — used for arrow-start/end, animated, glow, pulse-width.
function ToggleField({ label, checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-left text-[10.5px] transition-colors ${
        checked ? 'border-[var(--color-accent)] bg-white shadow-sm' : 'border-[var(--color-sage)] bg-white/60 hover:bg-white'
      }`}
    >
      <span className="text-[var(--color-ink)]">{label}</span>
      <motion.span
        className="relative h-4 w-7 shrink-0 rounded-full"
        animate={{ backgroundColor: checked ? 'var(--color-accent)' : 'var(--color-sage)' }}
      >
        <motion.span
          className="absolute top-0.5 h-3 w-3 rounded-full bg-white shadow"
          animate={{ left: checked ? 14 : 2 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      </motion.span>
    </button>
  )
}

// Path preview for the path-type swatch grid — draws the actual curve
// shape so picking a type means seeing it, not reading its name.
function PathPreview({ type }) {
  let d = 'M4 18 H56'
  if (type === 'step') d = 'M4 18 H26 V8 H56'
  else if (type === 'smoothstep') d = 'M4 18 H22 Q26 18 26 13 V13 Q26 8 30 8 H56'
  else if (type === 'bezier' || type === 'simplebezier') d = 'M4 18 C 22 4, 38 32, 56 18'
  return (
    <svg viewBox="0 0 60 26" className="h-6 w-full">
      <path d={d} fill="none" stroke="var(--color-ink)" strokeWidth="2" />
    </svg>
  )
}

// Dash-pattern preview swatch.
function DashPreview({ dash, cap }) {
  return (
    <svg viewBox="0 0 60 12" className="h-4 w-full">
      <path d="M4 6 H56" fill="none" stroke="var(--color-ink)" strokeWidth="2" strokeDasharray={dash} strokeLinecap={cap} />
    </svg>
  )
}

function SwatchGrid({ options, renderPreview, value, onChange, columns = 3, getKey = (o) => o.value ?? o.label }) {
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <motion.button
            key={getKey(opt)}
            type="button"
            onClick={() => onChange(opt.value)}
            title={opt.label}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.95 }}
            className={`flex flex-col items-center gap-1 rounded-md border p-1.5 transition-colors ${
              active ? 'border-[var(--color-accent)] bg-white shadow-sm' : 'border-transparent hover:border-[var(--color-sage)] hover:bg-white/60'
            }`}
          >
            {renderPreview(opt)}
            <span className="truncate text-[9px] normal-case leading-tight text-[var(--color-slate)]">{opt.label}</span>
          </motion.button>
        )
      })}
    </div>
  )
}

// Custom Connector Builder — the connector-line counterpart to
// CustomStyleBuilder.jsx. Every field here maps 1:1 onto the same shape
// CONNECTOR_STYLES entries use (pathType/dash/cap/strokeWidth/color/
// gradient/arrowStart/arrowEnd/animated/glow/pulseWidth/iconMid), so a
// saved custom connector applies through the exact same
// applyLineStyleToSelectedEdges path as any built-in style.
export default function CustomConnectorBuilder({ onClose }) {
  const addCustomConnectorStyle = useMapStore((s) => s.addCustomConnectorStyle)
  const applyLineStyleToSelectedEdges = useMapStore((s) => s.applyLineStyleToSelectedEdges)
  const showToast = useUiStore((s) => s.showToast)

  const [name, setName] = useState('My Connector')
  const [pathType, setPathType] = useState('bezier')
  const [useGradient, setUseGradient] = useState(false)
  const [color, setColor] = useState('#333533')
  const [gradFrom, setGradFrom] = useState('#f5cb5c')
  const [gradTo, setGradTo] = useState('#e07856')
  const [strokeWidth, setStrokeWidth] = useState(2)
  const [dashPreset, setDashPreset] = useState(0)
  const [cap, setCap] = useState(undefined)
  const [arrowStart, setArrowStart] = useState(false)
  const [arrowEnd, setArrowEnd] = useState(true)
  const [animated, setAnimated] = useState(false)
  const [glow, setGlow] = useState(false)
  const [pulseWidth, setPulseWidth] = useState(false)
  const [iconMid, setIconMid] = useState(null)

  const dash = DASH_PATTERNS[dashPreset]?.value
  const effectiveCap = cap ?? DASH_PATTERNS[dashPreset]?.cap
  const gradient = useGradient ? [gradFrom, gradTo] : null
  const strokeColor = useGradient ? 'url(#custom-connector-preview-gradient)' : color

  const previewD =
    pathType === 'step'
      ? 'M6 30 H80 V12 H170'
      : pathType === 'smoothstep'
      ? 'M6 30 H70 Q80 30 80 20 V22 Q80 12 90 12 H170'
      : pathType === 'bezier' || pathType === 'simplebezier'
      ? 'M6 30 C 60 6, 110 54, 170 30'
      : 'M6 30 H170'

  const effectClass = [animated ? 'connector-preview-animated' : '', glow ? 'connector-glow-pulse' : '', pulseWidth ? 'connector-width-pulse' : '']
    .filter(Boolean)
    .join(' ')

  const IconMidComp = iconMid ? ICONS[iconMid] : null

  const buildStyle = () => ({
    id: `custom_connector_${Date.now()}`,
    label: name.trim() || 'Custom Connector',
    category: 'custom',
    pathType,
    dash,
    cap: effectiveCap,
    strokeWidth,
    color: useGradient ? gradFrom : color,
    gradient,
    arrowStart,
    arrowEnd,
    animated,
    glow,
    pulseWidth,
    iconMid,
  })

  const handleSave = () => {
    const style = buildStyle()
    addCustomConnectorStyle(style)
    const count = applyLineStyleToSelectedEdges(style)
    showToast(count ? `Saved "${style.label}" and applied to ${count} connector${count > 1 ? 's' : ''}` : `Saved "${style.label}" to your custom connectors`)
    onClose()
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/50 p-6 backdrop-blur-[2px]"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 340, damping: 28 }}
        className="relative mt-8 w-full max-w-xl overflow-hidden rounded-2xl shadow-2xl"
        style={{ backgroundColor: '#f5f5f0' }}
      >
        <div
          className="h-1 w-full"
          style={{ background: 'linear-gradient(90deg, var(--color-accent), var(--color-sage), var(--color-accent))', backgroundSize: '200% 100%' }}
        />

        <div className="p-5">
          <div className="mb-3 flex items-start justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
              <Wand2 size={15} className="text-[var(--color-accent)]" />
              Custom connector line
            </h2>
            <motion.button onClick={onClose} whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }} className="rounded-full p-1 hover:bg-[var(--color-sage)]">
              <X size={15} />
            </motion.button>
          </div>

          {/* Live preview — draws the exact path/dash/cap/color/gradient/
              glow/pulse/icon combination currently configured below. */}
          <motion.div
            layout
            className="relative mb-4 flex items-center justify-center overflow-hidden rounded-lg border border-dashed border-[var(--color-sage)] bg-white/40 py-6"
          >
            <svg viewBox="0 0 176 40" className="h-10 w-44">
              {useGradient && (
                <defs>
                  <linearGradient id="custom-connector-preview-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor={gradFrom} />
                    <stop offset="100%" stopColor={gradTo} />
                  </linearGradient>
                </defs>
              )}
              <path
                d={previewD}
                fill="none"
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeDasharray={dash}
                strokeLinecap={effectiveCap}
                className={effectClass}
                style={{
                  '--glow-color': useGradient ? gradFrom : color,
                  '--pulse-min': Math.max(1, strokeWidth - 1.5) + 'px',
                  '--pulse-max': strokeWidth + 3 + 'px',
                }}
              />
              {arrowEnd && <polygon points="170,30 160,25 160,35" fill={useGradient ? gradTo : color} />}
              {arrowStart && <polygon points="6,30 16,25 16,35" fill={useGradient ? gradFrom : color} />}
              {IconMidComp && (
                <foreignObject x="72" y={pathType === 'straight' ? 12 : 4} width="18" height="18">
                  <div
                    className="flex h-[18px] w-[18px] items-center justify-center rounded-full border shadow"
                    style={{ backgroundColor: 'var(--color-cream)', borderColor: useGradient ? gradFrom : color }}
                  >
                    <IconMidComp size={10} color="var(--color-ink)" />
                  </div>
                </foreignObject>
              )}
            </svg>
          </motion.div>

          <div className="flex max-h-[54vh] flex-col gap-2.5 overflow-y-auto pr-1">
            <Section icon={Sparkles} title="Basics" index={0}>
              <Field label="Connector name" full>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="rounded-md border border-[var(--color-sage)] bg-white/60 px-2 py-1 text-[11px] normal-case tracking-normal text-[var(--color-ink)]"
                  placeholder="e.g. Sunset Flow"
                />
              </Field>

              <div className="col-span-2">
                <Field label="Line shape">
                  <SwatchGrid
                    options={PATH_TYPES}
                    value={pathType}
                    onChange={setPathType}
                    columns={5}
                    renderPreview={(opt) => <PathPreview type={opt.value} />}
                  />
                </Field>
              </div>
            </Section>

            <Section icon={Palette} title="Color" index={1}>
              <label className="col-span-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-[var(--color-slate)]">
                <input type="checkbox" checked={useGradient} onChange={(e) => setUseGradient(e.target.checked)} />
                Gradient stroke
              </label>

              <AnimatePresence mode="wait" initial={false}>
                {!useGradient ? (
                  <motion.div key="solid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="col-span-2 grid grid-cols-2 gap-x-3 gap-y-2.5">
                    <ColorField label="Line color" value={color} onChange={setColor} />
                  </motion.div>
                ) : (
                  <motion.div key="gradient" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="col-span-2 grid grid-cols-2 gap-x-3 gap-y-2.5">
                    <ColorField label="Gradient from" value={gradFrom} onChange={setGradFrom} />
                    <ColorField label="Gradient to" value={gradTo} onChange={setGradTo} />
                  </motion.div>
                )}
              </AnimatePresence>
            </Section>

            <Section icon={Spline} title="Line detail" index={2}>
              <SliderField label={`Thickness — ${strokeWidth}px`} min="0.5" max="8" step="0.5" value={strokeWidth} onChange={(e) => setStrokeWidth(Number(e.target.value))} />

              <div className="col-span-2">
                <Field label="Dash pattern">
                  <SwatchGrid
                    options={DASH_PATTERNS}
                    value={dash}
                    onChange={(v) => setDashPreset(DASH_PATTERNS.findIndex((p) => p.value === v))}
                    columns={3}
                    getKey={(o) => o.label}
                    renderPreview={(opt) => <DashPreview dash={opt.value} cap={opt.cap} />}
                  />
                </Field>
              </div>

              <div className="col-span-2">
                <Field label="Line cap">
                  <SwatchGrid
                    options={CAPS}
                    value={cap}
                    onChange={setCap}
                    columns={3}
                    getKey={(o) => o.label}
                    renderPreview={(opt) => <DashPreview dash={undefined} cap={opt.value} />}
                  />
                </Field>
              </div>
            </Section>

            <Section icon={ArrowRightToLine} title="Arrowheads" index={3}>
              <ToggleField label="Arrow at start" checked={arrowStart} onChange={setArrowStart} />
              <ToggleField label="Arrow at end" checked={arrowEnd} onChange={setArrowEnd} />
            </Section>

            <Section icon={Sparkles} title="Motion & effects" index={4}>
              <ToggleField label="Animated flow" checked={animated} onChange={setAnimated} />
              <ToggleField label="Glow" checked={glow} onChange={setGlow} />
              <ToggleField label="Pulsing width" checked={pulseWidth} onChange={setPulseWidth} />
            </Section>

            <Section icon={Smile} title="Icon in middle" index={5}>
              <div className="col-span-2">
                <SwatchGrid
                  options={[{ value: null, label: 'None' }, ...MID_ICON_NAMES.map((n) => ({ value: n, label: n }))]}
                  value={iconMid}
                  onChange={setIconMid}
                  columns={5}
                  getKey={(o) => o.value ?? 'none'}
                  renderPreview={(opt) => {
                    const Comp = opt.value ? ICONS[opt.value] : null
                    return (
                      <span className="flex h-6 w-full items-center justify-center rounded bg-white">
                        {Comp ? <Comp size={13} color="var(--color-ink)" /> : <span className="text-[9px] text-[var(--color-slate)]">—</span>}
                      </span>
                    )
                  }}
                />
              </div>
            </Section>
          </div>

          <div className="mt-4 flex justify-end gap-2 border-t pt-3" style={{ borderColor: 'var(--color-sage)' }}>
            <motion.button
              onClick={onClose}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="rounded-md border border-[var(--color-sage)] px-3 py-1.5 text-[11px] text-[var(--color-slate)] hover:bg-[var(--color-sage)]/30"
            >
              Cancel
            </motion.button>
            <motion.button
              onClick={handleSave}
              whileHover={{ scale: 1.03, boxShadow: '0 4px 14px rgba(0,0,0,0.15)' }}
              whileTap={{ scale: 0.97 }}
              className="rounded-md px-3 py-1.5 text-[11px] font-semibold text-white"
              style={{ backgroundColor: 'var(--color-accent)' }}
            >
              Save connector
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
