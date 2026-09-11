import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, Bold, Italic, Underline } from 'lucide-react'
import { useMapStore } from '../../store/mapStore'
import { ANIMATION_OPTIONS } from '../../utils/nodeStyles'
import { FONT_FAMILIES, MIN_FONT_SIZE, MAX_FONT_SIZE, DEFAULT_FONT_SIZE } from '../../utils/textStyle'

const BORDER_STYLES = ['solid', 'dashed', 'dotted', 'double']

// A single labeled row wrapper so every control in the builder lines up
// the same way (label above, control below) without repeating the same
// two lines of markup for every field.
function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1 text-[10px] font-medium uppercase tracking-wide text-[var(--color-slate)]">
      {label}
      {children}
    </label>
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
          <button
            key={opt.value || 'none'}
            type="button"
            onClick={() => onChange(opt.value)}
            title={opt.label}
            className={`flex flex-col items-center gap-1 rounded-md border p-1.5 transition-colors ${
              active ? 'border-[var(--color-accent)] bg-white' : 'border-transparent hover:border-[var(--color-sage)] hover:bg-white/60'
            }`}
          >
            {renderPreview(opt)}
            <span className="truncate text-[9px] normal-case leading-tight text-[var(--color-slate)]">{opt.label}</span>
          </button>
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
      className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/50 p-6"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        className="mt-8 w-full max-w-xl rounded-xl p-5 shadow-2xl"
        style={{ backgroundColor: '#f5f5f0' }}
      >
        <div className="mb-3 flex items-start justify-between">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
            Custom node style
          </h2>
          <button onClick={onClose} className="rounded p-0.5 hover:bg-[var(--color-sage)]">
            <X size={15} />
          </button>
        </div>

        {/* Live preview — exact same rendering rules as the real canvas
            node / the gallery's PresetSwatch, so what's built here is
            what actually lands on the map. */}
        <div className="mb-4 flex items-center justify-center rounded-lg border border-dashed border-[var(--color-sage)] bg-white/40 py-4">
          <span
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
          </span>
        </div>

        <div className="grid max-h-[54vh] grid-cols-2 gap-3 overflow-y-auto pr-1">
          <div className="col-span-2">
            <Field label="Style name">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-md border border-[var(--color-sage)] bg-white/60 px-2 py-1 text-[11px] normal-case tracking-normal text-[var(--color-ink)]"
                placeholder="e.g. Sunset Pop"
              />
            </Field>
          </div>

          <div className="col-span-2 flex items-center gap-2">
            <label className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-[var(--color-slate)]">
              <input type="checkbox" checked={useGradient} onChange={(e) => setUseGradient(e.target.checked)} />
              Gradient background
            </label>
          </div>

          {!useGradient ? (
            <Field label="Background color">
              <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="h-7 w-full cursor-pointer rounded" />
            </Field>
          ) : (
            <>
              <Field label="Gradient from">
                <input type="color" value={gradFrom} onChange={(e) => setGradFrom(e.target.value)} className="h-7 w-full cursor-pointer rounded" />
              </Field>
              <Field label="Gradient to">
                <input type="color" value={gradTo} onChange={(e) => setGradTo(e.target.value)} className="h-7 w-full cursor-pointer rounded" />
              </Field>
              <div className="col-span-2">
                <Field label={`Gradient angle — ${gradAngle}°`}>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    value={gradAngle}
                    onChange={(e) => setGradAngle(Number(e.target.value))}
                    className="w-full accent-[var(--color-accent)]"
                  />
                </Field>
              </div>
            </>
          )}

          <Field label="Text color">
            <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="h-7 w-full cursor-pointer rounded" />
          </Field>

          {/* ── New: text size ─────────────────────────────────────── */}
          <Field label={`Text size — ${fontSize}px`}>
            <input
              type="range"
              min={MIN_FONT_SIZE}
              max={MAX_FONT_SIZE}
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="w-full accent-[var(--color-accent)]"
            />
          </Field>

          {/* ── New: font family, as a visual grid (each tile rendered in
              its own actual font) instead of a plain <select> ─────────── */}
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

          {/* ── New: bold / italic / underline toggles ───────────────── */}
          <div className="col-span-2">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[var(--color-slate)]">Text style</p>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setBold((v) => !v)}
                title="Bold"
                className={`flex h-7 w-9 items-center justify-center rounded-md border ${bold ? 'border-[var(--color-accent)] bg-white' : 'border-[var(--color-sage)] bg-white/60 hover:bg-white'}`}
              >
                <Bold size={13} />
              </button>
              <button
                type="button"
                onClick={() => setItalic((v) => !v)}
                title="Italic"
                className={`flex h-7 w-9 items-center justify-center rounded-md border ${italic ? 'border-[var(--color-accent)] bg-white' : 'border-[var(--color-sage)] bg-white/60 hover:bg-white'}`}
              >
                <Italic size={13} />
              </button>
              <button
                type="button"
                onClick={() => setUnderline((v) => !v)}
                title="Underline"
                className={`flex h-7 w-9 items-center justify-center rounded-md border ${underline ? 'border-[var(--color-accent)] bg-white' : 'border-[var(--color-sage)] bg-white/60 hover:bg-white'}`}
              >
                <Underline size={13} />
              </button>
            </div>
          </div>

          <Field label="Border color">
            <input type="color" value={borderColor} onChange={(e) => setBorderColor(e.target.value)} className="h-7 w-full cursor-pointer rounded" />
          </Field>

          <Field label={`Border width — ${borderWidth}px`}>
            <input
              type="range"
              min="0"
              max="6"
              step="0.5"
              value={borderWidth}
              onChange={(e) => setBorderWidth(Number(e.target.value))}
              className="w-full accent-[var(--color-accent)]"
            />
          </Field>

          {/* ── Border style, now a visual grid — each tile shows a real
              box drawn with that exact border-style ─────────────────── */}
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

          {/* ── New: corner roundness ─────────────────────────────────── */}
          <div className="col-span-2">
            <Field label={`Corner roundness — ${borderRadius}px`}>
              <input
                type="range"
                min="0"
                max="40"
                value={borderRadius}
                onChange={(e) => setBorderRadius(Number(e.target.value))}
                className="w-full accent-[var(--color-accent)]"
              />
            </Field>
          </div>

          <div className="col-span-2 flex items-center gap-2">
            <label className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-[var(--color-slate)]">
              <input type="checkbox" checked={useGlow} onChange={(e) => setUseGlow(e.target.checked)} />
              Glow effect
            </label>
            {useGlow && (
              <input type="color" value={glowColor} onChange={(e) => setGlowColor(e.target.value)} className="h-6 w-10 cursor-pointer rounded" />
            )}
          </div>

          {/* ── Motion/animation, now a visual grid — each tile is a small
              box that actually plays the node-anim-* animation live ──── */}
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

          <Field label={`Node size — ${Math.round(sizeScale * 100)}%`}>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.05"
              value={sizeScale}
              onChange={(e) => setSizeScale(Number(e.target.value))}
              className="w-full accent-[var(--color-accent)]"
            />
          </Field>

          {/* ── New: opacity ──────────────────────────────────────────── */}
          <Field label={`Opacity — ${Math.round(opacity * 100)}%`}>
            <input
              type="range"
              min="0.2"
              max="1"
              step="0.05"
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              className="w-full accent-[var(--color-accent)]"
            />
          </Field>
        </div>

        <div className="mt-4 flex justify-end gap-2 border-t pt-3" style={{ borderColor: 'var(--color-sage)' }}>
          <button
            onClick={onClose}
            className="rounded-md border border-[var(--color-sage)] px-3 py-1.5 text-[11px] text-[var(--color-slate)] hover:bg-[var(--color-sage)]/30"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="rounded-md px-3 py-1.5 text-[11px] font-semibold text-white hover:opacity-90"
            style={{ backgroundColor: 'var(--color-accent)' }}
          >
            Save style
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
