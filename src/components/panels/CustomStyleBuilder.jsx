import { useState } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useMapStore } from '../../store/mapStore'
import { ANIMATION_OPTIONS } from '../../utils/nodeStyles'

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

// Section — Custom Style Library. Opened from the Style Library's
// "Custom" tab via its "+ Add" tile. Every field here maps 1:1 onto the
// same preset shape (color/customBg/textColor/customBorder/glowColor/
// animationClass/sizeScale) that the built-in NODE_STYLE_PRESETS use, so
// once saved a custom style applies through the exact same
// applyNodeStyle path as any ready-made one — no separate code path to
// keep in sync.
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
  const [useGlow, setUseGlow] = useState(false)
  const [glowColor, setGlowColor] = useState('#00f5ff')
  const [animationClass, setAnimationClass] = useState('')
  const [sizeScale, setSizeScale] = useState(1)

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
    glowColor: useGlow ? glowColor : null,
    animationClass: animationClass || null,
    sizeScale,
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
        className="mt-8 w-full max-w-lg rounded-xl p-5 shadow-2xl"
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
            className={`flex items-center justify-center rounded-md px-4 py-2 text-[12px] font-medium shadow-sm ${animationClass}`}
            style={{
              background: customBg || bgColor,
              backgroundSize: useGradient ? undefined : undefined,
              borderColor: borderColor,
              borderWidth,
              borderStyle,
              boxShadow: glowShadow || undefined,
              '--sonar-color': useGlow ? `${glowColor}8c` : undefined,
              color: textColor,
              transform: `scale(${sizeScale})`,
            }}
          >
            {name || 'Node'}
          </span>
        </div>

        <div className="grid max-h-[50vh] grid-cols-2 gap-3 overflow-y-auto pr-1">
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

          <Field label="Border style">
            <select
              value={borderStyle}
              onChange={(e) => setBorderStyle(e.target.value)}
              className="rounded-md border border-[var(--color-sage)] bg-white/60 px-2 py-1 text-[11px] normal-case tracking-normal text-[var(--color-ink)]"
            >
              {BORDER_STYLES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>

          <div className="col-span-2 flex items-center gap-2">
            <label className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-[var(--color-slate)]">
              <input type="checkbox" checked={useGlow} onChange={(e) => setUseGlow(e.target.checked)} />
              Glow effect
            </label>
            {useGlow && (
              <input type="color" value={glowColor} onChange={(e) => setGlowColor(e.target.value)} className="h-6 w-10 cursor-pointer rounded" />
            )}
          </div>

          <Field label="Motion / animation">
            <select
              value={animationClass}
              onChange={(e) => setAnimationClass(e.target.value)}
              className="rounded-md border border-[var(--color-sage)] bg-white/60 px-2 py-1 text-[11px] normal-case tracking-normal text-[var(--color-ink)]"
            >
              {ANIMATION_OPTIONS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </Field>

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
