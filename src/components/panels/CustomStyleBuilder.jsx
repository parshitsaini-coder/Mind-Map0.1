import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Bold, Italic, Underline, Palette, Type, Square, Sparkles, Move, Wand2 } from 'lucide-react'
import { useMapStore } from '../../store/mapStore'
import { ANIMATION_OPTIONS } from '../../utils/nodeStyles'
import { FONT_FAMILIES, MIN_FONT_SIZE, MAX_FONT_SIZE, DEFAULT_FONT_SIZE } from '../../utils/textStyle'

const BORDER_STYLES = ['solid', 'dashed', 'dotted', 'double']

// Every section fades/slides in with a small stagger so the panel feels
// composed rather than dumped on screen all at once.
const sectionVariants = {
  hidden: { opacity: 0, y: 8 },
  show: (i) => ({ opacity: 1, y: 0, transition: { delay: 0.03 * i, duration: 0.25, ease: 'easeOut' } }),
}

// A titled card wrapper used for every group of controls (Background,
// Typography, Border, Effects, Layout) — gives the panel clear visual
// rhythm instead of one long unbroken grid.
function Section({ icon: Icon, title, index, children, className = '' }) {
  return (
    <motion.div
      custom={index}
      variants={sectionVariants}
      initial="hidden"
      animate="show"
      className={`rounded-lg border border-[var(--color-sage)]/60 bg-white/50 p-3 ${className}`}
    >
      <div className="mb-2.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-slate)]">
        <Icon size={12} className="text-[var(--color-accent)]" />
        {title}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">{children}</div>
    </motion.div>
  )
}

// A single labeled row wrapper so every control in the builder lines up
// the same way (label above, control below) without repeating the same
// two lines of markup for every field.
function Field({ label, full, children }) {
  return (
    <label className={`flex flex-col gap-1 text-[9px] font-medium uppercase tracking-wide text-[var(--color-slate)] ${full ? 'col-span-2' : ''}`}>
      {label}
      {children}
    </label>
  )
}

// Compact color control — a small round swatch button (opens the native
// picker) plus its hex value, instead of a full-width color bar. Reads
// much lighter and lines up two per row.
function ColorField({ label, value, onChange }) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-1.5 rounded-md border border-[var(--color-sage)] bg-white/60 px-1.5 py-1">
        <span className="relative h-5 w-5 shrink-0 overflow-hidden rounded-full border border-black/10 shadow-inner" style={{ backgroundColor: value }}>
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </span>
        <span className="truncate text-[10px] normal-case tracking-normal text-[var(--color-ink)]">{value}</span>
      </div>
    </Field>
  )
}

// A slider with its current value shown as a small pill at the end of
// the label, and a slightly thicker styled track.
function SliderField({ label, value, ...props }) {
  return (
    <Field label={label} full>
      <input type="range" value={value} className="styled-range w-full" {...props} />
    </Field>
  )
}

// Visual grid picker — replaces a plain <select> with a row of clickable
// swatch tiles that each render a real preview of the option (an actual
// bordered box for border styles, an actual *animating* box for motion
// options, using the exact same node-anim-* CSS classes the canvas node
// uses) so picking a look means seeing it, not reading its name off a list.
function SwatchGrid({ options, renderPreview, value, onChange, columns = 4 }) {
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <motion.button
            key={opt.value || 'none'}
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

// Section — Custom Style Library. Opened from the Style Library's
// "Custom" tab via its "+ Add" tile. Every field here maps 1:1 onto the
// same preset shape (color/customBg/textColor/customBorder/glowColor/
// animationClass/sizeScale/fontSize/fontFamily/bold/italic/underline/
// opacity/borderRadius) that the built-in NODE_STYLE_PRESETS use, so once
// saved a custom style applies through the exact same applyNodeStyle path
// as any ready-made one — no separate code path to keep in sync.
export default function CustomStyleBuilder({ onClose }) {
  const addCustomNodeStyle = useMapStore((s) => s.addCustomNodeStyle)

  const [name, setName] = useState('My Style')
  const [useGradient, setUseGradient] = useState(false)
  const [bgColor, setBgColor] = useState('#f5cb5c')
  const [gradFrom, setGradFrom] = useState('#667eea')
  const [gradTo, setGradTo] = useState('#764ba2')
  const [gradAngle, setGradAngle] = useState(135)
  const [textColor, setTextColor] = useState('#242423')
  const [borderColor, setBorderColor] = useState('#242423')
  const [borderWidth, setBorderWidth] = useState(1)
  const [borderStyle, setBorderStyle] = useState('solid')
  const [borderRadius, setBorderRadius] = useState(8)
  const [useGlow, setUseGlow] = useState(false)
  const [glowColor, setGlowColor] = useState('#00f5ff')
  const [animationClass, setAnimationClass] = useState('')
  const [sizeScale, setSizeScale] = useState(1)
  const [opacity, setOpacity] = useState(1)
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE)
  const [fontFamily, setFontFamily] = useState('sans')
  const [bold, setBold] = useState(false)
  const [italic, setItalic] = useState(false)
  const [underline, setUnderline] = useState(false)

  const customBg = useGradient ? `linear-gradient(${gradAngle}deg, ${gradFrom}, ${gradTo})` : null
  const glowShadow = useGlow ? `0 0 10px 2px ${glowColor}55` : null

  const buildPreset = () => ({
    id: `custom_${Date.now()}`,
    name: name.trim() || 'Custom Style',
    category: 'Custom',
    color: useGradient ? null : bgColor,
    customBg,
    bgSize: useGradient ? undefined : null,
    textColor,
    customBorder: { color: borderColor, width: borderWidth, style: borderStyle },
    borderRadius,
    glowColor: useGlow ? glowColor : null,
    animationClass: animationClass || null,
    sizeScale,
    opacity,
    fontSize,
    fontFamily,
    bold,
    italic,
    underline,
  })

  const handleSave = () => {
    addCustomNodeStyle(buildPreset())
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
        {/* Accent top bar */}
        <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, var(--color-accent), var(--color-sage), var(--color-accent))', backgroundSize: '200% 100%' }} />

        <div className="p-5">
          <div className="mb-3 flex items-start justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
              <Wand2 size={15} className="text-[var(--color-accent)]" />
              Custom node style
            </h2>
            <motion.button
              onClick={onClose}
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              className="rounded-full p-1 hover:bg-[var(--color-sage)]"
            >
              <X size={15} />
            </motion.button>
          </div>

          {/* Live preview — exact same rendering rules as the real canvas
              node / the gallery's PresetSwatch, so what's built here is
              what actually lands on the map. */}
          <motion.div
            layout
            className="relative mb-4 flex items-center justify-center overflow-hidden rounded-lg border border-dashed border-[var(--color-sage)] py-5"
            style={{
              backgroundImage:
                'linear-gradient(45deg, #ffffffaa 25%, transparent 25%), linear-gradient(-45deg, #ffffffaa 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ffffffaa 75%), linear-gradient(-45deg, transparent 75%, #ffffffaa 75%)',
              backgroundSize: '16px 16px',
              backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
              backgroundColor: 'rgba(255,255,255,0.35)',
            }}
          >
            <motion.span
              layout
              className={`flex items-center justify-center px-4 py-2 font-medium shadow-sm ${animationClass}`}
              style={{
                background: customBg || bgColor,
                borderColor: borderColor,
                borderWidth,
                borderStyle,
                borderRadius: `${borderRadius}px`,
                boxShadow: glowShadow || undefined,
                '--sonar-color': useGlow ? `${glowColor}8c` : undefined,
                color: textColor,
                transform: `scale(${sizeScale})`,
                opacity,
                fontSize: `${fontSize}px`,
                fontFamily: FONT_FAMILIES.find((f) => f.key === fontFamily)?.value,
                fontWeight: bold ? 700 : undefined,
                fontStyle: italic ? 'italic' : undefined,
                textDecoration: underline ? 'underline' : undefined,
              }}
            >
              {name || 'Node'}
            </motion.span>
          </motion.div>

          <div className="flex max-h-[54vh] flex-col gap-2.5 overflow-y-auto pr-1">
            <Section icon={Sparkles} title="Basics" index={0}>
              <Field label="Style name" full>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="rounded-md border border-[var(--color-sage)] bg-white/60 px-2 py-1 text-[11px] normal-case tracking-normal text-[var(--color-ink)]"
                  placeholder="e.g. Sunset Pop"
                />
              </Field>
            </Section>

            <Section icon={Palette} title="Background" index={1}>
              <label className="col-span-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-[var(--color-slate)]">
                <input type="checkbox" checked={useGradient} onChange={(e) => setUseGradient(e.target.checked)} />
                Gradient background
              </label>

              <AnimatePresence mode="wait" initial={false}>
                {!useGradient ? (
                  <motion.div
                    key="solid"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="col-span-2 grid grid-cols-2 gap-x-3 gap-y-2.5"
                  >
                    <ColorField label="Background color" value={bgColor} onChange={setBgColor} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="gradient"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="col-span-2 grid grid-cols-2 gap-x-3 gap-y-2.5"
                  >
                    <ColorField label="Gradient from" value={gradFrom} onChange={setGradFrom} />
                    <ColorField label="Gradient to" value={gradTo} onChange={setGradTo} />
                    <SliderField
                      label={`Gradient angle — ${gradAngle}°`}
                      min="0"
                      max="360"
                      value={gradAngle}
                      onChange={(e) => setGradAngle(Number(e.target.value))}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </Section>

            <Section icon={Type} title="Typography" index={2}>
              <ColorField label="Text color" value={textColor} onChange={setTextColor} />
              <SliderField
                label={`Text size — ${fontSize}px`}
                min={MIN_FONT_SIZE}
                max={MAX_FONT_SIZE}
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
              />

              <div className="col-span-2">
                <Field label="Font">
                  <SwatchGrid
                    options={FONT_FAMILIES.map((f) => ({ value: f.key, label: f.label }))}
                    value={fontFamily}
                    onChange={setFontFamily}
                    columns={4}
                    renderPreview={(opt) => (
                      <span
                        className="flex h-6 w-full items-center justify-center rounded bg-white text-[11px]"
                        style={{ fontFamily: FONT_FAMILIES.find((f) => f.key === opt.value)?.value }}
                      >
                        Aa
                      </span>
                    )}
                  />
                </Field>
              </div>

              <div className="col-span-2">
                <p className="mb-1 text-[9px] font-medium uppercase tracking-wide text-[var(--color-slate)]">Text style</p>
                <div className="flex gap-1.5">
                  {[
                    { key: 'bold', icon: Bold, active: bold, toggle: () => setBold((v) => !v) },
                    { key: 'italic', icon: Italic, active: italic, toggle: () => setItalic((v) => !v) },
                    { key: 'underline', icon: Underline, active: underline, toggle: () => setUnderline((v) => !v) },
                  ].map(({ key, icon: Icon, active, toggle }) => (
                    <motion.button
                      key={key}
                      type="button"
                      onClick={toggle}
                      title={key}
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.92 }}
                      className={`flex h-7 w-9 items-center justify-center rounded-md border transition-colors ${
                        active ? 'border-[var(--color-accent)] bg-white shadow-sm' : 'border-[var(--color-sage)] bg-white/60 hover:bg-white'
                      }`}
                    >
                      <Icon size={13} />
                    </motion.button>
                  ))}
                </div>
              </div>
            </Section>

            <Section icon={Square} title="Border" index={3}>
              <ColorField label="Border color" value={borderColor} onChange={setBorderColor} />
              <SliderField
                label={`Border width — ${borderWidth}px`}
                min="0"
                max="6"
                step="0.5"
                value={borderWidth}
                onChange={(e) => setBorderWidth(Number(e.target.value))}
              />

              <div className="col-span-2">
                <Field label="Border style">
                  <SwatchGrid
                    options={BORDER_STYLES.map((s) => ({ value: s, label: s }))}
                    value={borderStyle}
                    onChange={setBorderStyle}
                    columns={4}
                    renderPreview={(opt) => (
                      <span
                        className="h-6 w-full rounded bg-white"
                        style={{ borderColor, borderWidth: Math.max(borderWidth, 1.5), borderStyle: opt.value }}
                      />
                    )}
                  />
                </Field>
              </div>

              <SliderField
                label={`Corner roundness — ${borderRadius}px`}
                min="0"
                max="40"
                value={borderRadius}
                onChange={(e) => setBorderRadius(Number(e.target.value))}
              />
            </Section>

            <Section icon={Sparkles} title="Effects" index={4}>
              <div className="col-span-2 flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-[var(--color-slate)]">
                  <input type="checkbox" checked={useGlow} onChange={(e) => setUseGlow(e.target.checked)} />
                  Glow effect
                </label>
                <AnimatePresence>
                  {useGlow && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      className="relative h-5 w-5 shrink-0 overflow-hidden rounded-full border border-black/10 shadow-inner"
                      style={{ backgroundColor: glowColor }}
                    >
                      <input
                        type="color"
                        value={glowColor}
                        onChange={(e) => setGlowColor(e.target.value)}
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      />
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>

              <div className="col-span-2">
                <Field label="Motion / animation">
                  <SwatchGrid
                    options={ANIMATION_OPTIONS}
                    value={animationClass}
                    onChange={setAnimationClass}
                    columns={3}
                    renderPreview={(opt) => (
                      <span
                        className={`flex h-7 w-full items-center justify-center rounded ${opt.value}`}
                        style={{
                          background: customBg || bgColor,
                          color: textColor,
                          boxShadow: useGlow ? `0 0 8px 1px ${glowColor}66` : undefined,
                          '--sonar-color': useGlow ? `${glowColor}8c` : undefined,
                        }}
                      />
                    )}
                  />
                </Field>
              </div>
            </Section>

            <Section icon={Move} title="Layout" index={5}>
              <SliderField
                label={`Node size — ${Math.round(sizeScale * 100)}%`}
                min="0.5"
                max="2"
                step="0.05"
                value={sizeScale}
                onChange={(e) => setSizeScale(Number(e.target.value))}
              />
              <SliderField
                label={`Opacity — ${Math.round(opacity * 100)}%`}
                min="0.2"
                max="1"
                step="0.05"
                value={opacity}
                onChange={(e) => setOpacity(Number(e.target.value))}
              />
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
              Save style
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
